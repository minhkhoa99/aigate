import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";

const CONFIG = join(homedir(), ".codex", "config.toml");
const PREVIEW_TTL_MS = 5 * 60_000;
const MAX_PREVIEWS = 20;
const quote = (value: string) => JSON.stringify(value);
const digest = (value: string | null) => value === null ? null : createHash("sha256").update(value).digest("hex");
const objectOf = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : undefined;
type Draft = { action: "configure" | "reset"; beforeHash: string | null; next: string; expires: number };

// ponytail: bounded in-memory previews; one server process and five-minute review window.
@Injectable()
export class CodexSettingsService {
  private readonly previews = new Map<string, Draft>();
  private applyTail: Promise<void> = Promise.resolve();

  async status() {
    const content = await this.read();
    return { installed: Boolean(content) || await this.commandExists(), configured: content ? this.hasAigate(content) : false, configPath: CONFIG, model: content ? this.rootValue(content, "model") : null };
  }

  async preview(input: unknown) {
    this.prune();
    if (this.previews.size >= MAX_PREVIEWS) throw new ConflictException({ code: "PREVIEW_LIMIT", message: "Close or apply an earlier configuration preview, then retry." });
    const action = objectOf(input)?.action;
    if (action !== "configure" && action !== "reset") throw new BadRequestException({ code: "INVALID_REQUEST", message: "action must be configure or reset" });
    const before = await this.read();
    const next = action === "configure" ? this.configure(before ?? "", input) : this.reset(before ?? "");
    const id = randomUUID();
    this.previews.set(id, { action, beforeHash: digest(before), next, expires: Date.now() + PREVIEW_TTL_MS });
    return { previewId: id, action, configPath: CONFIG, backupPath: `${CONFIG}.aigate.bak`, diff: this.diff(before ?? "", next), expiresAt: new Date(Date.now() + PREVIEW_TTL_MS).toISOString() };
  }

  async apply(id: string) {
    const draft = this.previews.get(id);
    if (!draft || draft.expires < Date.now()) { this.previews.delete(id); throw new NotFoundException({ code: "PREVIEW_EXPIRED", message: "This preview expired. Review a new diff before applying." }); }
    let release!: () => void;
    const previous = this.applyTail;
    this.applyTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      const current = await this.read();
      if (digest(current) !== draft.beforeHash) {
        this.previews.delete(id);
        throw new ConflictException({ code: "CONFIG_CHANGED", message: "Codex config changed after the preview. Review a fresh diff before applying." });
      }
      await this.atomicWrite(draft.next, current);
      this.previews.delete(id);
      return { success: true, action: draft.action, configPath: CONFIG, backupPath: current === null ? null : `${CONFIG}.aigate.bak` };
    } finally { release(); }
  }

  private configure(content: string, input: unknown): string {
    const body = objectOf(input) ?? {};
    const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
    const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";
    const model = typeof body.model === "string" ? body.model.trim() : "";
    const subagent = typeof body.subagentModel === "string" && body.subagentModel.trim() ? body.subagentModel.trim() : model;
    let url: URL;
    try { url = new URL(baseUrl); } catch { throw new BadRequestException({ code: "INVALID_REQUEST", message: "baseUrl must be an absolute HTTP or HTTPS URL" }); }
    if (!(url.protocol === "http:" || url.protocol === "https:") || url.username || url.password || url.search || url.hash || apiKey.length < 8 || apiKey.length > 4096 || /[\r\n]/.test(apiKey) || !model || model.length > 256 || !subagent || subagent.length > 256) {
      throw new BadRequestException({ code: "INVALID_REQUEST", message: "baseUrl, apiKey, model, or subagentModel is invalid" });
    }
    const pathname = url.pathname.replace(/\/+$/, "");
    if (!pathname.endsWith("/v1")) url.pathname = `${pathname}/v1`;
    const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
    const existingProvider = this.findTable(lines, "model_providers.9router");
    if (existingProvider && !existingProvider.lines.some((line) => /^\s*name\s*=\s*["']9Router["']/.test(line))) {
      throw new ConflictException({ code: "CONFIG_CONFLICT", message: "Codex already has a model_providers.9router section. Rename or remove it before applying AIGate settings." });
    }
    const withoutProvider = this.removeTable(lines, "model_providers.9router");
    const rootEnd = withoutProvider.findIndex((line) => /^\s*\[/.test(line));
    const insertion = rootEnd < 0 ? withoutProvider.length : rootEnd;
    const root = withoutProvider.slice(0, insertion).filter((line) => !/^\s*(?:model|model_provider)\s*=/.test(line));
    root.push(`model = ${quote(model)}`, 'model_provider = "9router"');
    const rest = withoutProvider.slice(insertion);
    const agentsHeader = rest.findIndex((line) => /^\s*\[agents\]\s*(?:#.*)?$/.test(line));
    if (agentsHeader >= 0) {
      let end = rest.findIndex((line, index) => index > agentsHeader && /^\s*\[/.test(line));
      if (end < 0) end = rest.length;
      const block = rest.slice(agentsHeader + 1, end).filter((line) => !/^\s*default_subagent_model\s*=/.test(line));
      rest.splice(agentsHeader + 1, end - agentsHeader - 1, ...block.filter((line) => !line.trim().startsWith("# AIGate managed")), `default_subagent_model = ${quote(subagent)} # AIGate managed`);
    } else rest.push("[agents]", `default_subagent_model = ${quote(subagent)} # AIGate managed`);
    return [...root, ...rest.filter((line, index, array) => index < array.length - 1 || line !== "")].join("\n").trimEnd() + `\n\n[model_providers.9router]\nname = "9Router"\nbase_url = ${quote(url.toString().replace(/\/$/, ""))}\nwire_api = "responses"\nhttp_headers = { Authorization = ${quote(`Bearer ${apiKey}`)} }\n`;
  }

  private reset(content: string): string {
    const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
    const rootEnd = lines.findIndex((line) => /^\s*\[/.test(line));
    const configured = /^\s*model_provider\s*=\s*["']9router["']/.test(lines.slice(0, rootEnd < 0 ? lines.length : rootEnd).join("\n"));
    let next = lines.filter((line, index) => !(configured && index < (rootEnd < 0 ? lines.length : rootEnd) && /^\s*(?:model|model_provider)\s*=/.test(line)));
    let inAgents = false;
    next = next.filter((line) => {
      if (/^\s*\[/.test(line)) inAgents = this.tableName(line) === "agents";
      return !(inAgents && /^\s*default_subagent_model\s*=.*# AIGate managed\s*$/.test(line));
    });
    const provider = this.findTable(next, "model_providers.9router");
    if (provider && provider.lines.some((line) => /^\s*name\s*=\s*["']9Router["']/.test(line))) next = this.removeTable(next, "model_providers.9router");
    return next.join("\n").trimEnd() + (next.length ? "\n" : "");
  }

  private findTable(lines: string[], name: string) {
    const start = lines.findIndex((line) => this.tableName(line) === name);
    if (start < 0) return undefined;
    let end = lines.findIndex((line, index) => index > start && /^\s*\[/.test(line));
    if (end < 0) end = lines.length;
    return { start, end, lines: lines.slice(start, end) };
  }

  private removeTable(lines: string[], name: string): string[] {
    const belongs = (line: string) => { const table = this.tableName(line); return table !== null && (table === name || table.startsWith(`${name}.`)); };
    for (let start = lines.findIndex(belongs); start >= 0; start = lines.findIndex(belongs)) {
      let end = lines.findIndex((line, index) => index > start && /^\s*\[/.test(line));
      if (end < 0) end = lines.length;
      lines.splice(start, end - start);
    }
    return lines;
  }

  private tableName(line: string): string | null {
    const match = line.match(/^\s*\[\[?([^\]]+)\]\]?\s*(?:#.*)?$/);
    return match?.[1]?.trim().replaceAll('"', "") ?? null;
  }

  private rootValue(content: string, key: string): string | null {
    const root = content.split(/\r?\n(?=\s*\[)/, 1)[0] ?? "";
    const match = root.match(new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']*)["']`, "m"));
    return match?.[1] ?? null;
  }

  private hasAigate(content: string): boolean { return /^\s*model_provider\s*=\s*["']9router["']/m.test(content); }

  private diff(before: string, after: string): string[] {
    const oldLines = before.split(/\r?\n/).filter(Boolean);
    const newLines = after.split(/\r?\n/).filter(Boolean);
    const redact = (line: string) => line.replace(/((?:authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)\s*=\s*)(?:"[^"]*"|'[^']*'|[^,}\s]+)/gi, '$1"[redacted]"');
    const oldSet = new Set(oldLines); const newSet = new Set(newLines);
    return [...oldLines.filter((line) => !newSet.has(line)).map((line) => `- ${redact(line)}`), ...newLines.filter((line) => !oldSet.has(line)).map((line) => `+ ${redact(line)}`)].slice(0, 200);
  }

  private async read(): Promise<string | null> {
    try {
      const info = await lstat(CONFIG);
      if (!info.isFile() || info.isSymbolicLink()) throw new Error("Codex config must be a regular file, not a symbolic link");
      if (info.size > 1_048_576) throw new Error("Codex config exceeds the 1 MiB safe editing limit");
      return await readFile(CONFIG, "utf8");
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return null;
      throw error;
    }
  }

  private async atomicWrite(content: string, before: string | null): Promise<void> {
    await mkdir(dirname(CONFIG), { recursive: true, mode: 0o700 });
    const temp = `${CONFIG}.${randomUUID()}.tmp`;
    const backup = `${CONFIG}.aigate.bak`;
    try {
      if (before !== null) await this.writeFileAtomically(backup, before, 0o600);
      const mode = await stat(CONFIG).then((info) => process.platform === "win32" ? info.mode & 0o777 : info.mode & 0o600).catch(() => 0o600);
      await this.writeFileAtomically(temp, content, mode);
      if (await this.read() !== before) throw new ConflictException({ code: "CONFIG_CHANGED", message: "Codex config changed while applying. Review a fresh diff before applying." });
      await rename(temp, CONFIG);
    } finally { await rm(temp, { force: true }).catch(() => undefined); }
  }

  private async writeFileAtomically(path: string, content: string, mode: number): Promise<void> {
    const temp = `${path}.${randomUUID()}.tmp`;
    let file;
    try {
      file = await open(temp, "wx", mode);
      await file.writeFile(content, "utf8");
      await file.sync();
      await file.close();
      file = undefined;
      await rename(temp, path);
    } finally {
      await file?.close().catch(() => undefined);
      await rm(temp, { force: true }).catch(() => undefined);
    }
  }

  private async commandExists(): Promise<boolean> {
    const pathValue = process.env.PATH ?? "";
    const extensions = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [""];
    const { accessSync, constants, statSync } = await import("node:fs");
    for (const directory of pathValue.split(process.platform === "win32" ? ";" : ":")) for (const extension of extensions) {
      const candidate = join(directory, `codex${extension}`);
      try { if (statSync(candidate).isFile()) { if (process.platform !== "win32") accessSync(candidate, constants.X_OK); return true; } } catch { /* try the next path */ }
    }
    return false;
  }

  private prune(): void {
    const now = Date.now();
    for (const [id, draft] of this.previews) if (draft.expires < now) this.previews.delete(id);
  }
}
