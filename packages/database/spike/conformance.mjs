// SPIKE-1 conformance: run one behavior suite against one SQLite driver.
// Usage: node spike/conformance.mjs <driver>   (bun for bun-sqlite and bun-sqlite-locked)
// Native drivers: better-sqlite3, bun-sqlite, sql-js, node-sqlite-proxy (unlocked proxy).
// Locked variants route every client through sqlite-proxy plus lockedProxy():
//   better-sqlite3-locked, bun-sqlite-locked, sql-js-locked, node-sqlite-locked.
import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq, sql, sum } from "drizzle-orm";
import { accounts, usage } from "../test/fixture/schema.ts";

const driver = process.argv[2];
const migrationsFolder = fileURLToPath(new URL("../test/fixture/drizzle", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), `spike-${driver}-`));
const file = join(dir, "aigate.db");

// All four clients are synchronous; only the sqlite-proxy API is async. Serialize access so an
// open transaction owns the connection: statements issued inside it (tracked with
// AsyncLocalStorage) run immediately, everything else waits for it to finish.
// ponytail: one lock per database serializes all access; SQLite has a single writer anyway.
async function lockedProxy(exec, closeClient) {
  const { drizzle } = await import("drizzle-orm/sqlite-proxy");
  const { migrate } = await import("drizzle-orm/sqlite-proxy/migrator");
  const inTransaction = new AsyncLocalStorage();
  let tail = Promise.resolve();
  const serialize = (fn) => {
    const run = tail.then(fn);
    tail = run.catch(() => undefined);
    return run;
  };
  const call = (fn) => (inTransaction.getStore() ? Promise.resolve().then(fn) : serialize(fn));
  const atomicBatch = (queries) => {
    exec("BEGIN", [], "run");
    try {
      const rows = queries.map((q) => exec(q.sql, q.params, q.method));
      exec("COMMIT", [], "run");
      return rows;
    } catch (error) {
      exec("ROLLBACK", [], "run");
      throw error;
    }
  };
  const db = drizzle(
    async (query, params, method) => call(() => exec(query, params, method)),
    async (queries) => call(() => atomicBatch(queries)),
  );
  const transaction = db.transaction.bind(db);
  db.transaction = (fn, config) => serialize(() => inTransaction.run(true, () => transaction(fn, config)));
  const runMigrations = () => migrate(db, async (queries) => serialize(() => { for (const q of queries) exec(q, [], "run"); }), { migrationsFolder });
  return { db, mode: "async", migrate: runMigrations, close: closeClient };
}

// Each driver returns { db, mode: "sync" | "async", migrate(), close() }.
const drivers = {
  async "better-sqlite3"() {
    const { default: Database } = await import("better-sqlite3");
    const { drizzle } = await import("drizzle-orm/better-sqlite3");
    const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
    const client = new Database(file);
    const db = drizzle(client);
    return { db, mode: "sync", migrate: () => migrate(db, { migrationsFolder }), close: () => client.close() };
  },
  async "bun-sqlite"() {
    const { Database } = await import("bun:sqlite");
    const { drizzle } = await import("drizzle-orm/bun-sqlite");
    const { migrate } = await import("drizzle-orm/bun-sqlite/migrator");
    const client = new Database(file);
    const db = drizzle(client);
    return { db, mode: "sync", migrate: () => migrate(db, { migrationsFolder }), close: () => client.close() };
  },
  async "sql-js"() {
    const { default: initSqlJs } = await import("sql.js");
    const { drizzle } = await import("drizzle-orm/sql-js");
    const { migrate } = await import("drizzle-orm/sql-js/migrator");
    const SQL = await initSqlJs();
    const client = new SQL.Database(existsSync(file) ? readFileSync(file) : undefined);
    const db = drizzle(client);
    // sql.js is in-memory; persistence is our job.
    const close = () => { writeFileSync(file, client.export()); client.close(); };
    return { db, mode: "sync", migrate: () => migrate(db, { migrationsFolder }), close };
  },
  async "node-sqlite-proxy"() {
    const { DatabaseSync } = await import("node:sqlite");
    const { drizzle } = await import("drizzle-orm/sqlite-proxy");
    const { migrate } = await import("drizzle-orm/sqlite-proxy/migrator");
    const client = new DatabaseSync(file);
    const exec = (query, params, method) => {
      const stmt = client.prepare(query);
      if (method === "run") { stmt.run(...params); return { rows: [] }; }
      stmt.setReturnArrays(true);
      if (method === "get") return { rows: stmt.get(...params) };
      return { rows: stmt.all(...params) };
    };
    const db = drizzle(
      async (query, params, method) => exec(query, params, method),
      async (queries) => queries.map((q) => exec(q.sql, q.params, q.method)),
    );
    const runMigrations = () => migrate(db, async (queries) => { for (const q of queries) client.exec(q); }, { migrationsFolder });
    return { db, mode: "async", migrate: runMigrations, close: () => client.close() };
  },
};

drivers["better-sqlite3-locked"] = async () => {
  const { default: Database } = await import("better-sqlite3");
  const client = new Database(file);
  const exec = (query, params, method) => {
    const stmt = client.prepare(query);
    if (method === "run" || !stmt.reader) { stmt.run(...params); return { rows: [] }; }
    stmt.raw(true);
    return { rows: method === "get" ? stmt.get(...params) : stmt.all(...params) };
  };
  return lockedProxy(exec, () => client.close());
};
drivers["bun-sqlite-locked"] = async () => {
  const { Database } = await import("bun:sqlite");
  const client = new Database(file);
  const exec = (query, params, method) => {
    const stmt = client.query(query);
    if (method === "run") { stmt.run(...params); return { rows: [] }; }
    const rows = stmt.values(...params);
    return { rows: method === "get" ? rows[0] : rows };
  };
  return lockedProxy(exec, () => client.close());
};
drivers["sql-js-locked"] = async () => {
  const { default: initSqlJs } = await import("sql.js");
  const SQL = await initSqlJs();
  const client = new SQL.Database(existsSync(file) ? readFileSync(file) : undefined);
  const exec = (query, params, method) => {
    const stmt = client.prepare(query);
    try {
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.get());
      if (method === "run") return { rows: [] };
      return { rows: method === "get" ? rows[0] : rows };
    } finally {
      stmt.free();
    }
  };
  return lockedProxy(exec, () => { writeFileSync(file, client.export()); client.close(); });
};
drivers["node-sqlite-locked"] = async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const client = new DatabaseSync(file);
  const exec = (query, params, method) => {
    const stmt = client.prepare(query);
    if (method === "run") { stmt.run(...params); return { rows: [] }; }
    stmt.setReturnArrays(true);
    return { rows: method === "get" ? stmt.get(...params) : stmt.all(...params) };
  };
  return lockedProxy(exec, () => client.close());
};

// A sync driver can start an async callback and then reject it; its later throw must not crash the run.
process.on("uncaughtException", (error) => { if (error?.message !== "boom") throw error; });
process.on("unhandledRejection", (error) => { if (error?.message !== "boom") throw error; });

const results = [];
async function check(name, fn) {
  try {
    const note = await fn();
    results.push({ name, ok: true, note: note ?? "" });
  } catch (error) {
    results.push({ name, ok: false, note: String(error?.message ?? error).split("\n")[0].slice(0, 160) });
  }
}
function expect(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
const count = async (db, table) => (await db.select({ n: sql`count(*)` }).from(table))[0].n;

if (!drivers[driver]) throw new Error(`unknown driver ${driver}`);
let conn = await drivers[driver]();
const { mode } = conn;

await check("migrate", async () => { await conn.migrate(); await conn.migrate(); return "ran twice, idempotent"; });

await check("insert returning + json/boolean roundtrip", async () => {
  const [row] = await conn.db.insert(accounts).values({ id: "a1", name: "one", meta: { tier: "pro" }, updatedAt: 1 }).returning();
  expect(row, { id: "a1", name: "one", active: true, meta: { tier: "pro" }, updatedAt: 1 }, "returning");
  const [read] = await conn.db.select().from(accounts).where(eq(accounts.id, "a1"));
  expect(read, row, "select");
});

await check("update + delete", async () => {
  await conn.db.insert(accounts).values({ id: "tmp", name: "tmp", updatedAt: 1 });
  await conn.db.update(accounts).set({ active: false, updatedAt: 2 }).where(eq(accounts.id, "tmp"));
  const [row] = await conn.db.select({ active: accounts.active }).from(accounts).where(eq(accounts.id, "tmp"));
  expect(row.active, false, "updated boolean");
  await conn.db.delete(accounts).where(eq(accounts.id, "tmp"));
  expect(await count(conn.db, accounts), 1, "rows after delete");
});

await check("aggregate in SQL", async () => {
  await conn.db.insert(usage).values([{ accountId: "a1", tokens: 5 }, { accountId: "a1", tokens: 7 }]);
  const rows = await conn.db.select({ accountId: usage.accountId, total: sum(usage.tokens) }).from(usage).groupBy(usage.accountId);
  expect(rows.map((r) => [r.accountId, Number(r.total)]), [["a1", 12]], "sum group by");
});

await check("batch", async () => {
  if (typeof conn.db.batch !== "function") throw new Error("db.batch is not available on this driver");
  await conn.db.batch([conn.db.insert(usage).values({ accountId: "a1", tokens: 1 }), conn.db.insert(usage).values({ accountId: "a1", tokens: 1 })]);
});

await check("batch rolls back entirely when one statement fails", async () => {
  if (typeof conn.db.batch !== "function") throw new Error("db.batch is not available on this driver");
  const before = await count(conn.db, usage);
  let failed = false;
  try {
    await conn.db.batch([conn.db.insert(usage).values({ accountId: "a1", tokens: 1 }), conn.db.insert(accounts).values({ id: "a1", name: "dup", updatedAt: 1 })]);
  } catch {
    failed = true;
  }
  expect(failed, true, "duplicate key rejected");
  expect(await count(conn.db, usage), before, "rows after failed batch");
});

await check("transaction commit", async () => {
  const before = await count(conn.db, usage);
  if (mode === "sync") conn.db.transaction((tx) => { tx.insert(usage).values({ accountId: "a1", tokens: 1 }).run(); });
  else await conn.db.transaction(async (tx) => { await tx.insert(usage).values({ accountId: "a1", tokens: 1 }); });
  expect(await count(conn.db, usage), before + 1, "committed rows");
});

await check("transaction rollback on throw", async () => {
  const before = await count(conn.db, usage);
  try {
    if (mode === "sync") conn.db.transaction((tx) => { tx.insert(usage).values({ accountId: "a1", tokens: 1 }).run(); throw new Error("boom"); });
    else await conn.db.transaction(async (tx) => { await tx.insert(usage).values({ accountId: "a1", tokens: 1 }); throw new Error("boom"); });
  } catch (error) {
    if (error.message !== "boom") throw error;
  }
  expect(await count(conn.db, usage), before, "rows after rollback");
});

await check("async callback in transaction", async () => {
  // Portable repository code would want one transaction style for every driver.
  const before = await count(conn.db, usage);
  await conn.db.transaction(async (tx) => { await tx.insert(usage).values({ accountId: "a1", tokens: 1 }); });
  expect(await count(conn.db, usage), before + 1, "rows");
});

await check("isolation: concurrent write during an open transaction survives its rollback", async () => {
  const before = await count(conn.db, usage);
  const failing = conn.db.transaction(async (tx) => {
    await tx.insert(usage).values({ accountId: "a1", tokens: 100 });
    await tick();
    throw new Error("boom");
  }).catch((error) => { if (error.message !== "boom") throw error; });
  await tick().then(() => undefined);
  const outside = conn.db.insert(usage).values({ accountId: "a1", tokens: 1 });
  await Promise.all([failing, outside]);
  expect(await count(conn.db, usage), before + 1, "rows (outside write kept, failed tx rolled back)");
});

await check("isolation: two concurrent transactions", async () => {
  const before = await count(conn.db, usage);
  const txn = () => conn.db.transaction(async (tx) => { await tx.insert(usage).values({ accountId: "a1", tokens: 1 }); await tick(); });
  await Promise.all([txn(), txn()]);
  expect(await count(conn.db, usage), before + 2, "rows");
});

await check("persistence after reopen", async () => {
  const before = await count(conn.db, usage);
  conn.close();
  conn = await drivers[driver]();
  expect(await count(conn.db, usage), before, "rows after reopen");
});

conn.close();
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
console.log(JSON.stringify({ driver, runtime, results }));
try { rmSync(dir, { recursive: true, force: true }); } catch { /* Windows may still hold the file; tmp cleanup is best effort */ }
