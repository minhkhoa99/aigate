import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

export type DriverName = "bun-sqlite" | "better-sqlite3" | "node-sqlite" | "sql-js";
export type Method = "run" | "all" | "values" | "get";

// Every supported client is synchronous; sqlite-proxy only wraps it in an async API.
export interface SyncClient {
  readonly driver: DriverName;
  exec(query: string, params: unknown[], method: Method): unknown;
  close(): void;
  // In-memory clients write their image to disk; file-backed clients do not need this.
  persist?(): void;
}

const FILE_PRAGMAS = ["PRAGMA journal_mode = WAL", "PRAGMA busy_timeout = 5000", "PRAGMA foreign_keys = ON"];

// SQLite bindings accept null, numbers, bigints, strings, and byte arrays. Drizzle has already
// mapped booleans and JSON columns; anything else reaching here is a caller bug.
type SqlValue = null | number | bigint | string | Uint8Array;
function toSqlValues(params: unknown[]): SqlValue[] {
  return params.map((value) => {
    if (value === undefined) return null;
    if (value === null || typeof value === "number" || typeof value === "bigint" || typeof value === "string" || value instanceof Uint8Array) {
      return value;
    }
    throw new TypeError(`Unsupported SQLite parameter type: ${typeof value}`);
  });
}

// sql.js cannot bind bigint; accept only values that survive the conversion exactly.
function toSqlJsValues(params: unknown[]): (null | number | string | Uint8Array)[] {
  return toSqlValues(params).map((value) => {
    if (typeof value !== "bigint") return value;
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new RangeError(`sql.js cannot bind ${value}: outside the safe integer range`);
    }
    return Number(value);
  });
}

async function openBunSqlite(file: string): Promise<SyncClient> {
  const { Database } = await import("bun:sqlite");
  const client = new Database(file);
  const exec = (query: string, params: unknown[], method: Method) => {
    const stmt = client.query(query);
    if (method === "run") {
      stmt.run(...toSqlValues(params));
      return [];
    }
    const rows = stmt.values(...toSqlValues(params));
    return method === "get" ? rows[0] : rows;
  };
  for (const pragma of FILE_PRAGMAS) exec(pragma, [], "run");
  return { driver: "bun-sqlite", exec, close: () => client.close() };
}

async function openBetterSqlite(file: string): Promise<SyncClient> {
  const { default: Database } = await import("better-sqlite3");
  const client = new Database(file);
  const exec = (query: string, params: unknown[], method: Method) => {
    const stmt = client.prepare(query);
    if (!stmt.reader) {
      stmt.run(...toSqlValues(params));
      return [];
    }
    stmt.raw(true);
    const rows = method === "get" ? stmt.get(...toSqlValues(params)) : stmt.all(...toSqlValues(params));
    return method === "run" ? [] : rows;
  };
  for (const pragma of FILE_PRAGMAS) exec(pragma, [], "run");
  return { driver: "better-sqlite3", exec, close: () => client.close() };
}

async function openNodeSqlite(file: string): Promise<SyncClient> {
  const { DatabaseSync } = await import("node:sqlite");
  const client = new DatabaseSync(file);
  const exec = (query: string, params: unknown[], method: Method) => {
    const stmt = client.prepare(query);
    if (method === "run") {
      stmt.run(...toSqlValues(params));
      return [];
    }
    stmt.setReturnArrays(true);
    return method === "get" ? stmt.get(...toSqlValues(params)) : stmt.all(...toSqlValues(params));
  };
  for (const pragma of FILE_PRAGMAS) exec(pragma, [], "run");
  return { driver: "node-sqlite", exec, close: () => client.close() };
}

async function openSqlJs(file: string): Promise<SyncClient> {
  const { default: initSqlJs } = await import("sql.js");
  const SQL = await initSqlJs();
  const client = new SQL.Database(existsSync(file) ? readFileSync(file) : undefined);
  let dirty = false;
  const exec = (query: string, params: unknown[], method: Method) => {
    const stmt = client.prepare(query);
    try {
      stmt.bind(toSqlJsValues(params));
      const rows: unknown[] = [];
      while (stmt.step()) rows.push(stmt.get());
      if (!/^\s*select\b/i.test(query)) dirty = true;
      if (method === "run") return [];
      return method === "get" ? rows[0] : rows;
    } finally {
      stmt.free();
    }
  };
  const enableForeignKeys = () => {
    client.run("PRAGMA foreign_keys = ON");
  };
  const persist = () => {
    if (!dirty) return;
    // Write, then rename, so a crash mid-write never leaves a truncated database file.
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, client.export());
    renameSync(tmp, file);
    dirty = false;
    // export() reopens the in-memory database, which resets pragmas.
    enableForeignKeys();
  };
  enableForeignKeys();
  return { driver: "sql-js", exec, close: () => client.close(), persist };
}

export const openers: Record<DriverName, (file: string) => Promise<SyncClient>> = {
  "bun-sqlite": openBunSqlite,
  "better-sqlite3": openBetterSqlite,
  "node-sqlite": openNodeSqlite,
  "sql-js": openSqlJs,
};
