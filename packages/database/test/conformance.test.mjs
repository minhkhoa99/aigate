// One behavior suite for every SQLite driver this runtime can load (SPIKE-1 checks).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq, sql, sum } from "drizzle-orm";
import { openDatabase } from "../dist/index.js";
import { accounts, usage } from "./fixture/schema.ts";

const migrationsFolder = fileURLToPath(new URL("./fixture/drizzle", import.meta.url));
const drivers = process.versions.bun ? ["bun-sqlite", "sql-js"] : ["better-sqlite3", "node-sqlite", "sql-js"];
const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));
const count = async (db, table) => (await db.select({ n: sql`count(*)` }).from(table))[0].n;

function tempFile() {
  const dir = mkdtempSync(join(tmpdir(), "aigate-db-"));
  return {
    file: join(dir, "aigate.db"),
    // Windows can hold the file briefly after close; cleanup is best effort.
    cleanup: () => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } },
  };
}

for (const driver of drivers) {
  test(`${driver}: migrations, CRUD, aggregates, batch, transactions, isolation, persistence`, async () => {
    const { file, cleanup } = tempFile();
    let handle = await openDatabase({ file, migrationsFolder, driver });
    try {
      assert.equal(handle.driver, driver);
      const { db } = handle;

      const [row] = await db.insert(accounts).values({ id: "a1", name: "one", meta: { tier: "pro" }, updatedAt: 1 }).returning();
      assert.deepEqual(row, { id: "a1", name: "one", active: true, meta: { tier: "pro" }, updatedAt: 1 });
      assert.deepEqual((await db.select().from(accounts).where(eq(accounts.id, "a1")))[0], row);
      assert.equal(await db.select().from(accounts).where(eq(accounts.id, "missing")).get(), undefined, "get with no match");

      await db.update(accounts).set({ active: false }).where(eq(accounts.id, "a1"));
      assert.equal((await db.select({ active: accounts.active }).from(accounts))[0].active, false);

      await db.insert(usage).values([{ accountId: "a1", tokens: 5 }, { accountId: "a1", tokens: 7 }]);
      const totals = await db.select({ total: sum(usage.tokens) }).from(usage).groupBy(usage.accountId);
      assert.equal(Number(totals[0].total), 12);

      await assert.rejects(() => db.insert(usage).values({ accountId: "nope", tokens: 1 }), "foreign keys are enforced");

      let rows = await count(db, usage);
      await assert.rejects(() => db.batch([db.insert(usage).values({ accountId: "a1", tokens: 1 }), db.insert(accounts).values({ id: "a1", name: "dup", updatedAt: 1 })]));
      assert.equal(await count(db, usage), rows, "failed batch rolled back entirely");

      await assert.rejects(() => db.transaction(async (tx) => {
        await tx.insert(usage).values({ accountId: "a1", tokens: 1 });
        throw new Error("boom");
      }), /boom/);
      assert.equal(await count(db, usage), rows, "failed transaction rolled back");

      // A write issued while another transaction is open must not join it.
      const failing = db.transaction(async (tx) => {
        await tx.insert(usage).values({ accountId: "a1", tokens: 100 });
        await tick();
        throw new Error("boom");
      });
      await tick(5);
      await Promise.all([assert.rejects(failing, /boom/), db.insert(usage).values({ accountId: "a1", tokens: 1 })]);
      assert.equal(await count(db, usage), rows + 1, "outside write kept, failed transaction rolled back");

      const txn = () => db.transaction(async (tx) => { await tx.insert(usage).values({ accountId: "a1", tokens: 1 }); await tick(); });
      await Promise.all([txn(), txn()]);
      rows = await count(db, usage);

      await handle.close();
      handle = await openDatabase({ file, migrationsFolder, driver });
      assert.equal(await count(handle.db, usage), rows, "rows survive close and reopen");
    } finally {
      await handle.close();
      cleanup();
    }
  });
}

test("sql-js persists committed writes without a close", async () => {
  const { file, cleanup } = tempFile();
  const writer = await openDatabase({ file, migrationsFolder, driver: "sql-js" });
  try {
    await writer.db.insert(accounts).values({ id: "a1", name: "one", updatedAt: 1 });
    await tick(300);
    const reader = await openDatabase({ file, migrationsFolder, driver: "sql-js" });
    assert.equal(await count(reader.db, accounts), 1);
    await reader.close();
  } finally {
    await writer.close();
    cleanup();
  }
});

test("AIGate's own migrations create each context's tables", async () => {
  const { file, cleanup } = tempFile();
  const handle = await openDatabase({ file });
  try {
    const tables = await handle.db.all(sql`select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name`);
    assert.deepEqual(tables.map((t) => t.name ?? t[0]), ["__drizzle_migrations", "api_keys", "dashboard_password", "provider_connections", "provider_nodes", "sessions", "settings"]);
    await assert.rejects(() => handle.db.run(sql`insert into settings (id) values (2)`), "settings is a single row");
  } finally {
    await handle.close();
    cleanup();
  }
});

test("without a forced driver the runtime's first choice opens", async () => {
  const { file, cleanup } = tempFile();
  const handle = await openDatabase({ file, migrationsFolder });
  try {
    assert.equal(handle.driver, drivers[0]);
  } finally {
    await handle.close();
    cleanup();
  }
});
