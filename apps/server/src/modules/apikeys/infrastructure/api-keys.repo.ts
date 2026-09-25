import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq } from "drizzle-orm";
import { apiKeys, type DatabaseHandle } from "@aigate/database";
import { DATABASE } from "../../../database.provider.js";
import { isWellFormedKey, KEY_PREFIX, maskKey, MAX_KEYS } from "../domain/api-key.js";

export interface ApiKeyView {
  id: string;
  name: string;
  maskedKey: string;
  isActive: boolean;
  createdAt: string;
}

const columns = { id: apiKeys.id, name: apiKeys.name, lastFour: apiKeys.lastFour, isActive: apiKeys.isActive, createdAt: apiKeys.createdAt };
type Row = { id: string; name: string; lastFour: string; isActive: boolean; createdAt: Date };

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const toView = (row: Row): ApiKeyView => ({
  id: row.id, name: row.name, maskedKey: maskKey(row.lastFour), isActive: row.isActive, createdAt: row.createdAt.toISOString(),
});

@Injectable()
export class ApiKeysRepository {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  async list(): Promise<ApiKeyView[]> {
    const rows = await this.database.db.select(columns).from(apiKeys).orderBy(desc(apiKeys.createdAt)).limit(MAX_KEYS);
    return rows.map(toView);
  }

  // Returns undefined at the key limit. The count and insert share one transaction, so
  // concurrent creates cannot pass the limit together.
  create(name: string): Promise<{ view: ApiKeyView; key: string } | undefined> {
    return this.database.db.transaction(async (tx) => {
      const total = await tx.select({ n: count() }).from(apiKeys).get();
      if ((total?.n ?? 0) >= MAX_KEYS) return undefined;
      const key = KEY_PREFIX + randomBytes(32).toString("base64url");
      const [row] = await tx.insert(apiKeys)
        .values({ id: randomUUID(), name, keyHash: sha256(key), lastFour: key.slice(-4), createdAt: new Date() })
        .returning(columns);
      return row ? { view: toView(row), key } : undefined;
    });
  }

  async setActive(id: string, isActive: boolean): Promise<ApiKeyView | undefined> {
    const [row] = await this.database.db.update(apiKeys).set({ isActive }).where(eq(apiKeys.id, id)).returning(columns);
    return row ? toView(row) : undefined;
  }

  async remove(id: string): Promise<boolean> {
    const deleted = await this.database.db.delete(apiKeys).where(eq(apiKeys.id, id)).returning({ id: apiKeys.id });
    return deleted.length === 1;
  }

  // apikey.validate-lookup: valid when an active row has this hash. Malformed keys never reach the database.
  async isValid(key: string): Promise<boolean> {
    if (!isWellFormedKey(key)) return false;
    const row = await this.database.db.select({ id: apiKeys.id }).from(apiKeys)
      .where(and(eq(apiKeys.keyHash, sha256(key)), eq(apiKeys.isActive, true))).get();
    return row !== undefined;
  }
}
