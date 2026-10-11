import { AsyncLocalStorage } from "node:async_hooks";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle, type AsyncBatchRemoteCallback, type AsyncRemoteCallback, type SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import { openers, type DriverName, type SyncClient } from "./clients.js";

export type { DriverName } from "./clients.js";
export type Database = SqliteRemoteDatabase<Record<string, never>>;

export interface DatabaseHandle {
  readonly db: Database;
  readonly driver: DriverName;
  snapshot(maxBytes: number): Promise<Buffer>;
  close(): Promise<void>;
}

// AIGate's own migrations. Each bounded context adds its tables here when its SP lands.
export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../drizzle", import.meta.url));

export interface OpenOptions {
  file: string;
  migrationsFolder?: string;
  // Force one driver instead of the runtime's fallback chain.
  driver?: DriverName;
}

// ponytail: an in-memory driver may lose up to this much of its latest writes on a crash.
const PERSIST_DEBOUNCE_MS = 100;

// Drizzle types proxy rows as any[], but `get` with no match must pass undefined: its mapGetResult
// returns undefined for a falsy row, while [] would become a row of undefined fields.
// eslint-disable-next-line aigate/no-type-assertion -- the library type is wrong for this one case
const toProxyRows = (rows: unknown): { rows: unknown[] } => ({ rows: rows as unknown[] });

function fallbackOrder(): DriverName[] {
  return process.versions.bun ? ["bun-sqlite", "sql-js"] : ["better-sqlite3", "node-sqlite", "sql-js"];
}

async function openClient(file: string, drivers: DriverName[]): Promise<SyncClient> {
  const failures: string[] = [];
  for (const driver of drivers) {
    try {
      return await openers[driver](file);
    } catch (error) {
      failures.push(`${driver}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`No SQLite driver could open ${file}. ${failures.join("; ")}`);
}

// SPIKE-1: sqlite-proxy shares one connection, so an open async transaction must own it.
// Statements inside the transaction (tracked with AsyncLocalStorage) run at once; every other
// statement waits. ponytail: one lock serializes all access to a database. SQLite has a single
// writer anyway, so never await network I/O inside a transaction.
export async function openDatabase(options: OpenOptions): Promise<DatabaseHandle> {
  const client = await openClient(options.file, options.driver ? [options.driver] : fallbackOrder());
  const inTransaction = new AsyncLocalStorage<true>();
  let tail: Promise<unknown> = Promise.resolve();
  let persistTimer: NodeJS.Timeout | undefined;

  function serialize<T>(work: () => T | Promise<T>): Promise<T> {
    const run = tail.then(work);
    tail = run.catch(() => undefined);
    return run;
  }

  function schedulePersist() {
    if (!client.persist || persistTimer) return;
    persistTimer = setTimeout(() => {
      persistTimer = undefined;
      void serialize(() => client.persist?.());
    }, PERSIST_DEBOUNCE_MS);
    persistTimer.unref();
  }

  function atomic<T>(work: () => T): T {
    client.exec("BEGIN", [], "run");
    try {
      const result = work();
      client.exec("COMMIT", [], "run");
      return result;
    } catch (error) {
      client.exec("ROLLBACK", [], "run");
      throw error;
    }
  }

  function call<T>(work: () => T): Promise<T> {
    const run = inTransaction.getStore() ? Promise.resolve().then(work) : serialize(work);
    return run.finally(schedulePersist);
  }

  const run: AsyncRemoteCallback = async (query, params, method) => toProxyRows(await call(() => client.exec(query, params, method)));
  const runBatch: AsyncBatchRemoteCallback = async (queries) => {
    const results = await call(() => atomic(() => queries.map((q) => client.exec(q.sql, q.params, q.method))));
    return results.map(toProxyRows);
  };
  const db = drizzle(run, runBatch);
  const transaction = db.transaction.bind(db);
  const guarded: typeof db.transaction = (work, config) =>
    serialize(() => inTransaction.run(true, () => transaction(work, config))).finally(schedulePersist);
  db.transaction = guarded;

  const runMigrations = (queries: string[]) =>
    call(() =>
      atomic(() => {
        for (const query of queries) client.exec(query, [], "run");
      }),
    );
  await migrate(db, runMigrations, { migrationsFolder: options.migrationsFolder ?? MIGRATIONS_FOLDER });

  return {
    db,
    driver: client.driver,
    snapshot: async (maxBytes) => {
      if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new RangeError("snapshot byte limit must be positive");
      const directory = await mkdtemp(join(tmpdir(), "aigate-snapshot-"));
      const file = join(directory, "aigate.db");
      try {
        const inMemory = await serialize(() => {
          const count = client.exec("PRAGMA page_count", [], "get");
          const size = client.exec("PRAGMA page_size", [], "get");
          const pages = Array.isArray(count) ? count[0] : undefined;
          const bytes = Array.isArray(size) ? size[0] : undefined;
          if (typeof pages !== "number" || typeof bytes !== "number" || pages * bytes > maxBytes) throw new RangeError("Database exceeds the backup limit");
          if (client.snapshot) return client.snapshot();
          client.exec("VACUUM INTO ?", [file], "run");
          return undefined;
        });
        if (inMemory) {
          if (inMemory.byteLength > maxBytes) throw new RangeError("Database exceeds the backup limit");
          return Buffer.from(inMemory);
        }
        if ((await stat(file)).size > maxBytes) throw new RangeError("Database exceeds the backup limit");
        return await readFile(file);
      } finally { await rm(directory, { recursive: true, force: true }); }
    },
    close: () =>
      serialize(() => {
        clearTimeout(persistTimer);
        client.persist?.();
        client.close();
      }),
  };
}
