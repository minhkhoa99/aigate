import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";

export type ManagedJsonTool = "crush" | "pi" | "smelt";
const hash = (value: string | null) => value === null ? null : createHash("sha256").update(value).digest("hex");
type Draft = { tool: ManagedJsonTool; path: string; before: string | null; next: string; action: "configure" | "reset"; expires: number };

// ponytail: 20 process-local previews expire after five minutes; move this state to storage only when multi-process writes exist.
@Injectable()
export class ManagedJsonSettingsService {
  private readonly previews = new Map<string, Draft>();
  private writeTail: Promise<void> = Promise.resolve();

  async status(value: string) {
    const tool = this.tool(value);
    const path = await this.path(tool);
    const source = await this.read(path);
    const config = source === null ? {} : this.parse(source, tool);
    const configured = tool === "smelt"
      ? config["_managedBy"] === "9router"
      : this.object(config["providers"])?.["9router"] !== undefined;
    return { installed: source !== null || await this.commandExists(tool), configured, configPath: path };
  }

  async preview(value: string, input: unknown) {
    const tool = this.tool(value);
    this.prune();
    if (this.previews.size >= 20) throw new ConflictException({ code: "PREVIEW_LIMIT", message: "Close or apply an earlier configuration preview, then retry." });
    const action = this.object(input)?.["action"];
    if (action !== "configure" && action !== "reset") throw new BadRequestException({ code: "INVALID_REQUEST", message: "action must be configure or reset" });
    const path = await this.path(tool);
    const before = await this.read(path);
    const next = action === "configure" ? this.configure(tool, before, input) : this.reset(tool, before);
    const previewId = randomUUID();
    const expires = Date.now() + 300_000;
    this.previews.set(previewId, { tool, path, before, next, action, expires });
    return { previewId, action, configPath: path, backupPath: `${path}.aigate.bak`, diff: this.diff(before ?? "", next), expiresAt: new Date(expires).toISOString() };
  }

  async apply(previewId: string) {
    const draft = this.previews.get(previewId);
    if (!draft || draft.expires < Date.now()) { this.previews.delete(previewId); throw new NotFoundException({ code: "PREVIEW_EXPIRED", message: "This preview expired. Review a new diff before applying." }); }
    let release!: () => void;
    const prior = this.writeTail;
    this.writeTail = new Promise<void>((resolve) => { release = resolve; });
    await prior;
    try {
      if (hash(await this.read(draft.path)) !== hash(draft.before)) throw new ConflictException({ code: "CONFIG_CHANGED", message: "Settings changed after the preview. Review a fresh diff before applying." });
      await mkdir(dirname(draft.path), { recursive: true, mode: 0o700 });
      if (draft.before !== null) await this.write(`${draft.path}.aigate.bak`, draft.before);
      await this.write(draft.path, draft.next);
      this.previews.delete(previewId);
      return { success: true, action: draft.action, configPath: draft.path };
    } finally { release(); }
  }

  private configure(tool: ManagedJsonTool, source: string | null, input: unknown) {
    const body = this.object(input) ?? {};
    const baseUrl = typeof body["baseUrl"] === "string" ? body.baseUrl.trim() : "";
    const apiKey = typeof body["apiKey"] === "string" ? body.apiKey : "";
    const model = typeof body["model"] === "string" ? body.model.trim() : "";
    let url: URL;
    try { url = new URL(baseUrl); } catch { throw new BadRequestException({ code: "INVALID_REQUEST", message: "baseUrl must be an absolute HTTP or HTTPS URL" }); }
    if (!(url.protocol === "http:" || url.protocol === "https:") || url.username || url.password || url.search || url.hash || apiKey.length < 8 || apiKey.length > 4096 || /[\r\n]/.test(apiKey) || !model || model.length > 256) throw new BadRequestException({ code: "INVALID_REQUEST", message: "baseUrl, apiKey, or model is invalid" });
    const path = url.pathname.replace(/\/+$/, "");
    url.pathname = path.endsWith("/v1") ? path : `${path}/v1`;
    const base = url.toString().replace(/\/$/, "");
    const config = source === null ? {} : this.parse(source, tool);
    if (tool === "crush") {
      const providers = this.object(config["providers"]) ?? {};
      return JSON.stringify({ ...config, providers: { ...providers, "9router": { type: "openai-compat", base_url: base, api_key: apiKey, models: [{ id: model, name: model, context_window: 128_000 }] } } }, null, 2) + "\n";
    }
    if (tool === "pi") {
      const providers = this.object(config["providers"]) ?? {};
      return JSON.stringify({ ...config, providers: { ...providers, "9router": { baseUrl: base, apiKey, api: "openai-completions", models: [{ id: model, name: model, contextWindow: 128_000, maxTokens: 16_384 }] } } }, null, 2) + "\n";
    }
    return JSON.stringify({ ...config, baseUrl: base, apiKey, model, _managedBy: "9router" }, null, 2) + "\n";
  }

  private reset(tool: ManagedJsonTool, source: string | null) {
    if (source === null) return "{}\n";
    const config = this.parse(source, tool);
    if (tool === "smelt") {
      const next = { ...config }; delete next["baseUrl"]; delete next["apiKey"]; delete next["model"]; delete next["_managedBy"];
      return JSON.stringify(next, null, 2) + "\n";
    }
    const providers = this.object(config["providers"]) ?? {};
    delete providers["9router"];
    const next = { ...config, ...(Object.keys(providers).length ? { providers } : {}) };
    if (!Object.keys(providers).length) delete next["providers"];
    return JSON.stringify(next, null, 2) + "\n";
  }

  private tool(value: string): ManagedJsonTool { if (value === "crush" || value === "pi" || value === "smelt") return value; throw new BadRequestException({ code: "INVALID_TOOL", message: "Unsupported CLI tool" }); }
  private async path(tool: ManagedJsonTool) { if (tool === "crush") return join(process.env["XDG_CONFIG_HOME"] ?? join(homedir(), ".config"), "crush", "crush.json"); if (tool === "smelt") return join(homedir(), ".smelt", "config.json"); const agent = join(homedir(), ".pi", "agent", "models.json"), root = join(homedir(), ".pi", "models.json"); return await this.exists(agent) ? agent : await this.exists(root) ? root : agent; }
  private object(value: unknown): Record<string, unknown> | null { return typeof value === "object" && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null; }
  private parse(source: string, tool: ManagedJsonTool) { try { const parsed = this.object(JSON.parse(source)); if (!parsed) throw new Error(); return parsed; } catch { throw new BadRequestException({ code: "INVALID_REQUEST", message: `${tool} settings must contain a JSON object before AIGate can safely edit it.` }); } }
  private diff(before: string, next: string) { const oldLines = before.split(/\r?\n/).filter(Boolean), newLines = next.split(/\r?\n/).filter(Boolean), oldSet = new Set(oldLines), newSet = new Set(newLines); const redact = (line: string) => line.replace(/("(?:apiKey|api[_-]?key|token|secret)"\s*:\s*)"[^"]*"/i, '$1"[redacted]"'); return [...oldLines.filter((line) => !newSet.has(line)).map((line) => `- ${redact(line)}`), ...newLines.filter((line) => !oldSet.has(line)).map((line) => `+ ${redact(line)}`)].slice(0, 200); }
  private async read(path: string): Promise<string | null> { try { const info = await lstat(path); if (!info.isFile() || info.isSymbolicLink() || info.size > 1_048_576) throw new Error("CLI config must be a regular file within the 1 MiB limit"); return await readFile(path, "utf8"); } catch (error) { if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return null; throw error; } }
  private async exists(path: string) { return existsSync(path); }
  private async write(path: string, content: string) { const temp = `${path}.${randomUUID()}.tmp`; let file; try { file = await open(temp, "wx", 0o600); await file.writeFile(content, "utf8"); await file.sync(); await file.close(); file = undefined; await rename(temp, path); } finally { await file?.close().catch(() => undefined); await rm(temp, { force: true }).catch(() => undefined); } }
  private async commandExists(tool: ManagedJsonTool) { const names = process.platform === "win32" ? [`${tool}.exe`, `${tool}.cmd`, `${tool}.bat`] : [tool]; return (process.env.PATH ?? "").split(process.platform === "win32" ? ";" : ":").some((directory) => names.some((name) => existsSync(join(directory, name)))); }
  private prune() { for (const [id, draft] of this.previews) if (draft.expires < Date.now()) this.previews.delete(id); }
}
