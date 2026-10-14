import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq } from "drizzle-orm";
import { apiKeys, type DatabaseHandle } from "@aigate/database";
import { DATABASE } from "../../../database.provider.js";
import { SECRET_CIPHER, type SecretCipherPort } from "../../../secret-cipher.js";
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
const sealContext = (id: string): string => `api_keys:${id}:key`;

@Injectable()
export class ApiKeysRepository {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipherPort,
  ) {}

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
      const id = randomUUID();
      const [row] = await tx.insert(apiKeys)
        .values({ id, name, keyHash: sha256(key), lastFour: key.slice(-4), keySealed: this.cipher.seal(key, sealContext(id)), createdAt: new Date() })
        .returning(columns);
      return row ? { view: toView(row), key } : undefined;
    });
  }

  async rotate(id: string): Promise<{ view: ApiKeyView; key: string } | undefined> {
    const key = KEY_PREFIX + randomBytes(32).toString("base64url");
    const [row] = await this.database.db.update(apiKeys)
      .set({ keyHash: sha256(key), lastFour: key.slice(-4), keySealed: this.cipher.seal(key, sealContext(id)) })
      .where(eq(apiKeys.id, id)).returning(columns);
    return row ? { view: toView(row), key } : undefined;
  }

  // Reveal the full key without rotating (copy without rotate). Throws SecretUnreadableError if sealed value unreadable.
  async reveal(id: string): Promise<string | undefined> {
    const row = await this.database.db.select({ keySealed: apiKeys.keySealed }).from(apiKeys).where(eq(apiKeys.id, id)).get();
    if (!row) return undefined;
    if (!row.keySealed) return undefined;
    return this.cipher.open(row.keySealed, sealContext(id));
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
    return (await this.activeId(key)) !== undefined;
  }

  // The id of the active key, so usage can be attributed to it (docs/contracts/usage.md).
  async activeId(key: string): Promise<string | undefined> {
    if (!isWellFormedKey(key)) return undefined;
    const row = await this.database.db.select({ id: apiKeys.id }).from(apiKeys)
      .where(and(eq(apiKeys.keyHash, sha256(key)), eq(apiKeys.isActive, true))).get();
    return row?.id;
  }
}
