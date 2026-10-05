import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";

const configPath = process.platform === "win32"
  ? join(process.env["APPDATA"] ?? homedir(), "Code", "User", "chatLanguageModels.json")
  : process.platform === "darwin"
    ? join(homedir(), "Library", "Application Support", "Code", "User", "chatLanguageModels.json")
    : join(homedir(), ".config", "Code", "User", "chatLanguageModels.json");
const hash = (value: string | null) => value === null ? null : createHash("sha256").update(value).digest("hex");
type Draft = { action: "configure" | "reset"; before: string | null; next: string; expires: number };
type Entry = { name?: unknown; [key: string]: unknown };

// ponytail: previews are process-local, capped at 20 and expire after five minutes.
@Injectable()
export class CopilotSettingsService {
  private readonly previews = new Map<string, Draft>();
  private writeTail: Promise<void> = Promise.resolve();

  async status() {
    const source = await this.read();
    const entries = source === null ? [] : this.parse(source);
    const entry = entries.find((item) => item.name === "9Router");
    const models = Array.isArray(entry?.["models"])
      ? entry.models.map((model) => typeof model === "object" && model !== null && "id" in model && typeof model.id === "string" ? model.id : "").filter(Boolean)
      : [];
    return { installed: source !== null || await this.commandExists(), configured: models.length > 0, configPath, models };
  }

  async preview(input: unknown) {
    this.prune();
    if (this.previews.size >= 20) throw new ConflictException({ code: "PREVIEW_LIMIT", message: "Close or apply an earlier configuration preview, then retry." });
    const action = this.object(input)?.["action"];
    if (action !== "configure" && action !== "reset") throw new BadRequestException({ code: "INVALID_REQUEST", message: "action must be configure or reset" });
    const before = await this.read();
    const next = action === "configure" ? this.configure(before, input) : this.reset(before);
    const previewId = randomUUID();
    const expires = Date.now() + 300_000;
    this.previews.set(previewId, { action, before, next, expires });
    return { previewId, action, configPath, backupPath: `${configPath}.aigate.bak`, diff: this.diff(before ?? "", next), expiresAt: new Date(expires).toISOString() };
  }

  async apply(previewId: string) {
    const draft = this.previews.get(previewId);
    if (!draft || draft.expires < Date.now()) { this.previews.delete(previewId); throw new NotFoundException({ code: "PREVIEW_EXPIRED", message: "This preview expired. Review a new diff before applying." }); }
    let release!: () => void;
    const prior = this.writeTail;
    this.writeTail = new Promise<void>((resolve) => { release = resolve; });
    await prior;
    try {
      if (hash(await this.read()) !== hash(draft.before)) throw new ConflictException({ code: "CONFIG_CHANGED", message: "Copilot settings changed after the preview. Review a fresh diff before applying." });
      await mkdir(dirname(configPath), { recursive: true, mode: 0o700 });
      if (draft.before !== null) await this.write(`${configPath}.aigate.bak`, draft.before);
      await this.write(configPath, draft.next);
      this.previews.delete(previewId);
      return { success: true, action: draft.action, configPath };
    } finally { release(); }
  }

  private configure(source: string | null, input: unknown) {
    const body = this.object(input) ?? {};
    const baseUrl = typeof body["baseUrl"] === "string" ? body.baseUrl.trim() : "";
    const apiKey = typeof body["apiKey"] === "string" ? body.apiKey : "";
    const model = typeof body["model"] === "string" ? body.model.trim() : "";
    let url: URL;
    try { url = new URL(baseUrl); } catch { throw new BadRequestException({ code: "INVALID_REQUEST", message: "baseUrl must be an absolute HTTP or HTTPS URL" }); }
    if (!(url.protocol === "http:" || url.protocol === "https:") || url.username || url.password || url.search || url.hash || apiKey.length < 8 || apiKey.length > 4096 || /[\r\n]/.test(apiKey) || !model || model.length > 256) throw new BadRequestException({ code: "INVALID_REQUEST", message: "baseUrl, apiKey, or model is invalid" });
    const path = url.pathname.replace(/\/+$/, "");
    url.pathname = path.endsWith("/v1") ? path : `${path}/v1`;
    const endpoint = `${url.toString().replace(/\/$/, "")}/chat/completions#models.ai.azure.com`;
    const entry: Entry = { name: "9Router", vendor: "azure", apiKey, models: [{ id: model, name: model, url: endpoint, toolCalling: true, vision: false, maxInputTokens: 128_000, maxOutputTokens: 16_000 }] };
    const entries = source === null ? [] : this.parse(source);
    const index = entries.findIndex((item) => item.name === "9Router");
    if (index === -1) entries.push(entry); else entries[index] = entry;
    return JSON.stringify(entries, null, 2) + "\n";
  }

  private reset(source: string | null) {
    if (source === null) return "[]\n";
    return JSON.stringify(this.parse(source).filter((entry) => entry.name !== "9Router"), null, 2) + "\n";
  }

  private object(value: unknown): Record<string, unknown> | null { return typeof value === "object" && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null; }
  private parse(source: string): Entry[] { try { const parsed: unknown = JSON.parse(source); if (!Array.isArray(parsed)) throw new Error(); const entries = parsed.map((item) => this.object(item)); if (entries.some((item) => item === null)) throw new Error(); return entries.filter((item): item is Entry => item !== null); } catch { throw new BadRequestException({ code: "INVALID_REQUEST", message: "Copilot chatLanguageModels.json must contain an array before AIGate can safely edit it." }); } }
  private diff(before: string, next: string) { const oldLines = before.split(/\r?\n/).filter(Boolean), newLines = next.split(/\r?\n/).filter(Boolean), oldSet = new Set(oldLines), newSet = new Set(newLines); const redact = (line: string) => line.replace(/("(?:apiKey|api[_-]?key|token|secret)"\s*:\s*)"[^"]*"/i, '$1"[redacted]"'); return [...oldLines.filter((line) => !newSet.has(line)).map((line) => `- ${redact(line)}`), ...newLines.filter((line) => !oldSet.has(line)).map((line) => `+ ${redact(line)}`)].slice(0, 200); }
  private async read(): Promise<string | null> { try { const info = await lstat(configPath); if (!info.isFile() || info.isSymbolicLink() || info.size > 1_048_576) throw new Error("Copilot config must be a regular file within the 1 MiB limit"); return await readFile(configPath, "utf8"); } catch (error) { if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return null; throw error; } }
  private async write(path: string, content: string) { const temp = `${path}.${randomUUID()}.tmp`; let file; try { file = await open(temp, "wx", 0o600); await file.writeFile(content, "utf8"); await file.sync(); await file.close(); file = undefined; await rename(temp, path); } finally { await file?.close().catch(() => undefined); await rm(temp, { force: true }).catch(() => undefined); } }
  private async commandExists() { const names = process.platform === "win32" ? ["copilot.exe", "copilot.cmd", "copilot.bat"] : ["copilot"]; return (process.env.PATH ?? "").split(process.platform === "win32" ? ";" : ":").some((directory) => names.some((name) => existsSync(join(directory, name)))); }
  private prune() { for (const [id, draft] of this.previews) if (draft.expires < Date.now()) this.previews.delete(id); }
}
