// One behavior suite for every SQLite driver this runtime can load (SPIKE-1 checks).
import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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
      const image = await handle.snapshot(1024 * 1024);
      assert.equal(image.subarray(0, 16).toString("binary"), "SQLite format 3\0");
      await assert.rejects(handle.snapshot(1), RangeError);
      const snapshotFile = join(dirname(file), "snapshot.db");
      writeFileSync(snapshotFile, image);
      const copy = await openDatabase({ file: snapshotFile, migrationsFolder, driver: "node-sqlite" });
      try { assert.equal((await copy.db.select({ name: accounts.name }).from(accounts))[0].name, "one"); }
      finally { await copy.close(); }
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
    assert.deepEqual(tables.map((t) => t.name ?? t[0]), ["__drizzle_migrations", "account_locks", "api_keys", "capacity_pools", "combos", "custom_models", "dashboard_password", "pricing_overrides", "provider_connections", "provider_nodes", "provider_proxy_strategies", "provider_thinking", "proxy_pools", "sessions", "settings", "skill_index", "skills", "usage_daily", "usage_events", "usage_requests"]);
    await assert.rejects(() => handle.db.run(sql`insert into settings (id) values (2)`), "settings is a single row");
    // 0030: hybrid skill selection by default, and the skills a request used.
    await handle.db.run(sql`insert into settings (id) values (1) on conflict do nothing`);
    const [selection] = await handle.db.all(sql`select skills_selection from settings where id = 1`);
    assert.equal(selection.skills_selection ?? selection[0], "hybrid");
    const columns = await handle.db.all(sql`select name from pragma_table_info('usage_requests') where name = 'skills'`);
    assert.equal(columns.length, 1);
  } finally {
    await handle.close();
    cleanup();
  }
});

// Schema rule 8: 0028 carries the 0027 boolean into skills.mode (false became off) without rebuilding the table, so the
// cascading skill_index rows survive; 0029 drops the old column.
for (const driver of drivers) {
  test(`${driver}: migrations 0028-0029 carry skills.auto into mode and keep skill_index`, async () => {
    const { file, cleanup } = tempFile();
    const old = mkdtempSync(join(tmpdir(), "aigate-migrations-"));
    try {
      const real = fileURLToPath(new URL("../drizzle", import.meta.url));
      const journal = JSON.parse(readFileSync(join(real, "meta", "_journal.json"), "utf8"));
      const kept = journal.entries.filter((entry) => entry.idx <= 27);
      mkdirSync(join(old, "meta"));
      writeFileSync(join(old, "meta", "_journal.json"), JSON.stringify({ ...journal, entries: kept }));
      for (const entry of kept) copyFileSync(join(real, `${entry.tag}.sql`), join(old, `${entry.tag}.sql`));
      let handle = await openDatabase({ file, migrationsFolder: old, driver });
      await handle.db.run(sql`insert into skills (id, name, source, url, auto, created_at, updated_at) values ('l', 'link', 'link', 'https://x.test/a.md', 1, 1, 1)`);
      await handle.db.run(sql`insert into skills (id, name, source, content, auto, created_at, updated_at) values ('f', 'file', 'file', '# F', 0, 2, 2)`);
      await handle.db.run(sql`insert into skill_index (skill_id, link_content, document, indexed_at) values ('l', '# A', '{}', 1)`);
      await handle.close();
      handle = await openDatabase({ file, driver });
      try {
        const rows = await handle.db.all(sql`select id, mode from skills order by id`);
        assert.deepEqual(rows.map((row) => [row.id ?? row[0], row.mode ?? row[1]]), [["f", "off"], ["l", "auto"]]);
        const index = await handle.db.all(sql`select link_content from skill_index`);
        assert.deepEqual(index.map((row) => row.link_content ?? row[0]), ["# A"], "the cached link copy survives");
        const columns = await handle.db.all(sql`select name from pragma_table_info('skills')`);
        assert.ok(!columns.some((row) => (row.name ?? row[0]) === "auto"), "0029 dropped auto");
        await assert.rejects(() => handle.db.run(sql`update skills set mode = 'sometimes' where id = 'f'`), "mode is checked");
      } finally {
        await handle.close();
      }
    } finally {
      rmSync(old, { recursive: true, force: true });
      cleanup();
    }
  });
}

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
