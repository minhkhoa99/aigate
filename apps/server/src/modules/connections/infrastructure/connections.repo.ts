import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import { providerConnections, type DatabaseHandle, type TestStatus } from "@aigate/database";
import { DATABASE } from "../../../database.provider.js";
import { SECRET_CIPHER, type SecretCipherPort } from "../../../secret-cipher.js";
import { keyHint, maskHint, sealContext, type ConnectionChanges } from "../domain/connection.js";

// SP11 allows one connection per registry provider; the bound only guards the listing.
const MAX_CONNECTIONS = 100;

export interface ConnectionView {
  id: string;
  provider: string;
  name: string;
  keyHint: string;
  isActive: boolean;
  testStatus: TestStatus;
  lastError: string | null;
  lastErrorCode: string | null;
  lastTestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TestOutcome {
  testStatus: TestStatus;
  lastError: string | null;
  lastErrorCode: string | null;
}

// A positive allowlist: the sealed key is not in it, so no read can return it (catalog.connection-listing).
const t = providerConnections;
const columns = {
  id: t.id, provider: t.provider, name: t.name, keyHint: t.keyHint, isActive: t.isActive, testStatus: t.testStatus,
  lastError: t.lastError, lastErrorCode: t.lastErrorCode, lastTestedAt: t.lastTestedAt, createdAt: t.createdAt, updatedAt: t.updatedAt,
};
type Row = Omit<ConnectionView, "lastTestedAt" | "createdAt" | "updatedAt"> & { lastTestedAt: Date | null; createdAt: Date; updatedAt: Date };

const toView = (row: Row): ConnectionView => ({
  ...row,
  keyHint: maskHint(row.keyHint),
  lastTestedAt: row.lastTestedAt ? row.lastTestedAt.toISOString() : null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

@Injectable()
export class ConnectionsRepository {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipherPort,
  ) {}

  async list(): Promise<ConnectionView[]> {
    const rows = await this.database.db.select(columns).from(t).orderBy(asc(t.createdAt)).limit(MAX_CONNECTIONS);
    return rows.map(toView);
  }

  async get(id: string): Promise<ConnectionView | undefined> {
    const row = await this.database.db.select(columns).from(t).where(eq(t.id, id)).get();
    return row ? toView(row) : undefined;
  }

  // Undefined when the provider already has a connection: the unique index decides, never a prior SELECT.
  async create(input: { provider: string; name: string; apiKey: string }): Promise<ConnectionView | undefined> {
    const id = randomUUID();
    const now = new Date();
    const [row] = await this.database.db.insert(t).values({
      id, provider: input.provider, name: input.name, apiKeySealed: this.cipher.seal(input.apiKey, sealContext(id)),
      keyHint: keyHint(input.apiKey), createdAt: now, updatedAt: now,
    }).onConflictDoNothing({ target: t.provider }).returning(columns);
    return row ? toView(row) : undefined;
  }

  // A new key starts over as untested: the old result described a different key.
  async update(id: string, changes: ConnectionChanges): Promise<ConnectionView | undefined> {
    const { apiKey, ...rest } = changes;
    const key = apiKey === undefined ? {} : {
      apiKeySealed: this.cipher.seal(apiKey, sealContext(id)), keyHint: keyHint(apiKey),
      testStatus: "untested" as const, lastError: null, lastErrorCode: null, lastTestedAt: null,
    };
    const [row] = await this.database.db.update(t).set({ ...rest, ...key, updatedAt: new Date() }).where(eq(t.id, id)).returning(columns);
    return row ? toView(row) : undefined;
  }

  async remove(id: string): Promise<boolean> {
    const deleted = await this.database.db.delete(t).where(eq(t.id, id)).returning({ id: t.id });
    return deleted.length === 1;
  }

  // Throws SecretUnreadableError when the secret key changed since the key was saved.
  async readKey(id: string): Promise<{ provider: string; apiKey: string; sealed: string } | undefined> {
    const row = await this.database.db.select({ provider: t.provider, sealed: t.apiKeySealed }).from(t).where(eq(t.id, id)).get();
    return row ? { ...row, apiKey: this.cipher.open(row.sealed, sealContext(id)) } : undefined;
  }

  // Written only if the key is still the one that was tested; a key replaced mid-test keeps its untested state.
  async recordTest(id: string, sealed: string, outcome: TestOutcome): Promise<ConnectionView | undefined> {
    const [row] = await this.database.db.update(t).set({ ...outcome, lastTestedAt: new Date() })
      .where(and(eq(t.id, id), eq(t.apiKeySealed, sealed))).returning(columns);
    return row ? toView(row) : this.get(id);
  }
}
