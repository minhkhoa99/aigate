import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";

const CONFIG = join(homedir(), ".config", "opencode", "opencode.json");
const MAX_BYTES = 1_048_576;
const TTL_MS = 5 * 60_000;
const MAX_PREVIEWS = 20;
const hash = (value: string | null) => value === null ? null : createHash("sha256").update(value).digest("hex");
const object = (value: unknown): Record<string, unknown> | null => typeof value === "object" && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null;
type Draft = { action: "configure" | "reset"; before: string | null; next: string; expires: number };

// ponytail: previews are process-local and capped; use shared storage if AIGate runs as multiple server instances.
@Injectable()
export class OpenCodeSettingsService {
  private readonly previews = new Map<string, Draft>();
  private applying: Promise<void> = Promise.resolve();

  async status() {
    const source = await this.read();
    const config = source === null ? {} : this.parse(source);
    const provider = object(object(config.provider)?.["9router"]);
    const models = Object.keys(object(provider?.models) ?? {});
    const model = typeof config.model === "string" && config.model.startsWith("9router/") ? config.model.slice(8) : null;
    return { installed: source !== null || await this.commandExists(), configured: provider !== null, configPath: CONFIG, models, model };
  }

  async preview(input: unknown) {
    this.prune();
    if (this.previews.size >= MAX_PREVIEWS) throw new ConflictException({ code: "PREVIEW_LIMIT", message: "Close or apply an earlier configuration preview, then retry." });
    const action = object(input)?.action;
    if (action !== "configure" && action !== "reset") throw new BadRequestException({ code: "INVALID_REQUEST", message: "action must be configure or reset" });
    const before = await this.read();
    const next = action === "configure" ? this.configure(before, input) : this.reset(before);
    const id = randomUUID(); const expires = Date.now() + TTL_MS;
    this.previews.set(id, { action, before, next, expires });
    return { previewId: id, action, configPath: CONFIG, backupPath: `${CONFIG}.aigate.bak`, diff: this.diff(before ?? "", next), expiresAt: new Date(expires).toISOString() };
  }

  async apply(id: string) {
    const draft = this.previews.get(id);
    if (!draft || draft.expires < Date.now()) { this.previews.delete(id); throw new NotFoundException({ code: "PREVIEW_EXPIRED", message: "This preview expired. Review a new diff before applying." }); }
    let release!: () => void; const previous = this.applying; this.applying = new Promise<void>((resolve) => { release = resolve; }); await previous;
    try {
      const current = await this.read();
      if (hash(current) !== hash(draft.before)) { this.previews.delete(id); throw new ConflictException({ code: "CONFIG_CHANGED", message: "OpenCode settings changed after the preview. Review a fresh diff before applying." }); }
      await this.write(draft.next, current); this.previews.delete(id);
      return { success: true, action: draft.action, configPath: CONFIG, backupPath: current === null ? null : `${CONFIG}.aigate.bak` };
    } finally { release(); }
  }

  private configure(source: string | null, input: unknown): string {
    const body = object(input) ?? {};
    const rawUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
    const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";
    const model = typeof body.model === "string" ? body.model.trim() : "";
    let url: URL;
    try { url = new URL(rawUrl); } catch { throw new BadRequestException({ code: "INVALID_REQUEST", message: "baseUrl must be an absolute HTTP or HTTPS URL" }); }
    if (!(url.protocol === "http:" || url.protocol === "https:") || url.username || url.password || url.search || url.hash || apiKey.length < 8 || apiKey.length > 4096 || /[\r\n]/.test(apiKey) || !model || model.length > 256) throw new BadRequestException({ code: "INVALID_REQUEST", message: "baseUrl, apiKey, or model is invalid" });
    const path = url.pathname.replace(/\/+$/, ""); if (!path.endsWith("/v1")) url.pathname = `${path}/v1`;
    const config = source === null ? {} : this.parse(source);
    const providers = object(config.provider) ?? {};
    const existing = object(providers["9router"]) ?? {};
    const models = object(existing.models) ?? {};
    return JSON.stringify({ ...config, provider: { ...providers, "9router": { ...existing, npm: "@ai-sdk/openai-compatible", options: { ...(object(existing.options) ?? {}), baseURL: url.toString().replace(/\/$/, ""), apiKey }, models: { ...models, [model]: { name: model, modalities: { input: ["text", "image"], output: ["text"] } } } } }, model: `9router/${model}` }, null, 2) + "\n";
  }

  private reset(source: string | null): string {
    if (source === null) return "";
    const config = this.parse(source); const providers = object(config.provider) ?? {}; delete providers["9router"];
    const next: Record<string, unknown> = { ...config, ...(Object.keys(providers).length ? { provider: providers } : {}) };
    if (!Object.keys(providers).length) delete next.provider;
    if (typeof next.model === "string" && next.model.startsWith("9router/")) delete next.model;
    return JSON.stringify(next, null, 2) + "\n";
  }

  private parse(source: string): Record<string, unknown> { try { const row = object(JSON.parse(source)); if (!row) throw new Error(); return row; } catch { throw new BadRequestException({ code: "INVALID_REQUEST", message: "OpenCode opencode.json must contain a JSON object before AIGate can safely edit it." }); } }
  private diff(before: string, after: string): string[] { const oldLines = before.split(/\r?\n/).filter(Boolean); const newLines = after.split(/\r?\n/).filter(Boolean); const redact = (line: string) => line.replace(/("(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)"\s*:\s*)"[^"]*"/gi, '$1"[redacted]"'); const oldSet = new Set(oldLines); const newSet = new Set(newLines); return [...oldLines.filter((line) => !newSet.has(line)).map((line) => `- ${redact(line)}`), ...newLines.filter((line) => !oldSet.has(line)).map((line) => `+ ${redact(line)}`)].slice(0, 200); }
  private async read(): Promise<string | null> { try { const info = await lstat(CONFIG); if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_BYTES) throw new Error("OpenCode config must be a regular file within the 1 MiB limit"); return await readFile(CONFIG, "utf8"); } catch (error) { if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return null; throw error; } }
  private async write(content: string, before: string | null): Promise<void> { await mkdir(dirname(CONFIG), { recursive: true, mode: 0o700 }); if (before !== null) await this.atomic(`${CONFIG}.aigate.bak`, before); if (hash(await this.read()) !== hash(before)) throw new ConflictException({ code: "CONFIG_CHANGED", message: "OpenCode settings changed while applying. Review a fresh diff before applying." }); await this.atomic(CONFIG, content); }
  private async atomic(path: string, content: string): Promise<void> { const temp = `${path}.${randomUUID()}.tmp`; let file; try { file = await open(temp, "wx", 0o600); await file.writeFile(content, "utf8"); await file.sync(); await file.close(); file = undefined; await rename(temp, path); } finally { await file?.close().catch(() => undefined); await rm(temp, { force: true }).catch(() => undefined); } }
  private async commandExists(): Promise<boolean> { const { accessSync, constants, statSync } = await import("node:fs"); const extensions = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [""]; for (const directory of (process.env.PATH ?? "").split(process.platform === "win32" ? ";" : ":")) for (const extension of extensions) try { const candidate = join(directory, `opencode${extension}`); if (statSync(candidate).isFile()) { if (process.platform !== "win32") accessSync(candidate, constants.X_OK); return true; } } catch { /* continue */ } return false; }
  private prune(): void { for (const [id, draft] of this.previews) if (draft.expires < Date.now()) this.previews.delete(id); }
}
