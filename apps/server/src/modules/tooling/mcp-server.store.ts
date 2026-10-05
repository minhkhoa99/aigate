import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

export const TOOLING_DATA_DIR = Symbol("TOOLING_DATA_DIR");
const MAX_SERVERS = 100;
const MAX_FILE_BYTES = 1_048_576;
export interface McpServer { id: string; name: string; url: string; scope: "user" | "project"; enabled: boolean; createdAt: string; updatedAt: string }
const isServer = (value: unknown): value is McpServer => {
  if (typeof value !== "object" || value === null) return false;
  const row = Object.fromEntries(Object.entries(value));
  return typeof row.id === "string" && typeof row.name === "string" && typeof row.url === "string"
    && (row.scope === "user" || row.scope === "project") && typeof row.enabled === "boolean"
    && typeof row.createdAt === "string" && typeof row.updatedAt === "string";
};

@Injectable()
export class McpServerStore {
  private tail: Promise<void> = Promise.resolve();
  private readonly file: string;
  private readonly root: string;

  constructor(@Inject(TOOLING_DATA_DIR) dataDir: string) { this.root = dataDir; this.file = join(dataDir, "mcp-servers.json"); }

  list(): Promise<McpServer[]> { return this.read(); }

  create(input: unknown): Promise<McpServer> {
    return this.exclusive(async () => {
      const rows = await this.read();
      if (rows.length >= MAX_SERVERS) throw new ConflictException({ code: "MCP_SERVER_LIMIT", message: `A maximum of ${MAX_SERVERS} MCP servers can be configured.` });
      const value = this.parse(input);
      if (rows.some((row) => row.name.toLowerCase() === value.name.toLowerCase())) throw new ConflictException({ code: "MCP_SERVER_EXISTS", message: "An MCP server with this name already exists." });
      const now = new Date().toISOString();
      const server = { id: randomUUID(), ...value, enabled: true, createdAt: now, updatedAt: now };
      await this.write([...rows, server]);
      return server;
    });
  }

  update(id: string, input: unknown): Promise<McpServer> {
    return this.exclusive(async () => {
      const rows = await this.read();
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) throw new NotFoundException({ code: "NOT_FOUND", message: "No MCP server with that id." });
      const body = this.object(input);
      const current = rows[index]!;
      const value = this.parse({ name: body.name ?? current.name, url: body.url ?? current.url, scope: body.scope ?? current.scope });
      if (rows.some((row, position) => position !== index && row.name.toLowerCase() === value.name.toLowerCase())) throw new ConflictException({ code: "MCP_SERVER_EXISTS", message: "An MCP server with this name already exists." });
      const next = { ...current, ...value, enabled: body.enabled === undefined ? current.enabled : this.boolean(body.enabled, "enabled"), updatedAt: new Date().toISOString() };
      rows[index] = next;
      await this.write(rows);
      return next;
    });
  }

  remove(id: string): Promise<void> {
    return this.exclusive(async () => {
      const rows = await this.read();
      const next = rows.filter((row) => row.id !== id);
      if (next.length === rows.length) throw new NotFoundException({ code: "NOT_FOUND", message: "No MCP server with that id." });
      await this.write(next);
    });
  }

  private parse(input: unknown): Pick<McpServer, "name" | "url" | "scope"> {
    const body = this.object(input);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
    const scope = body.scope === "project" ? "project" : body.scope === "user" ? "user" : null;
    let url: URL;
    try { url = new URL(rawUrl); } catch { throw new BadRequestException({ code: "INVALID_REQUEST", message: "url must be an absolute HTTP or HTTPS URL." }); }
    const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname.toLowerCase());
    if (!name || name.length > 64 || !scope || !(url.protocol === "https:" || url.protocol === "http:" && local) || url.username || url.password || url.search || url.hash || rawUrl.length > 2048) {
      throw new BadRequestException({ code: "INVALID_REQUEST", message: "Use a name up to 64 characters, an HTTPS URL (HTTP is allowed only for localhost), and a user or project scope." });
    }
    return { name, url: url.toString(), scope };
  }

  private async read(): Promise<McpServer[]> {
    try {
      const info = await lstat(this.file);
      if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_FILE_BYTES) throw new Error("MCP server store is not a regular file within the 1 MiB limit");
      const parsed: unknown = JSON.parse(await readFile(this.file, "utf8"));
      if (!Array.isArray(parsed) || parsed.length > MAX_SERVERS || !parsed.every(isServer)) throw new Error("MCP server store has an invalid shape");
      return parsed.map(({ id, name, url, scope, enabled, createdAt, updatedAt }) => ({ id, name, url, scope, enabled, createdAt, updatedAt }));
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return [];
      throw error;
    }
  }

  private async write(rows: McpServer[]): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const old = await this.read();
    const current = JSON.stringify(old);
    const next = JSON.stringify(rows, null, 2) + "\n";
    const backup = `${this.file}.bak`;
    if (old.length) await this.atomicFile(backup, current + "\n");
    await this.atomicFile(this.file, next);
  }

  private async atomicFile(path: string, content: string): Promise<void> {
    const temp = `${path}.${randomUUID()}.tmp`;
    let file;
    try {
      file = await open(temp, "wx", 0o600);
      await file.writeFile(content, "utf8");
      await file.sync();
      await file.close();
      file = undefined;
      await rename(temp, path);
    } finally { await file?.close().catch(() => undefined); await rm(temp, { force: true }).catch(() => undefined); }
  }

  private async exclusive<T>(work: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const prior = this.tail;
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    await prior;
    try { return await work(); } finally { release(); }
  }

  private object(input: unknown): Record<string, unknown> { return typeof input === "object" && input !== null && !Array.isArray(input) ? Object.fromEntries(Object.entries(input)) : {}; }
  private boolean(value: unknown, name: string): boolean { if (typeof value !== "boolean") throw new BadRequestException({ code: "INVALID_REQUEST", message: `${name} must be a boolean.` }); return value; }
}
