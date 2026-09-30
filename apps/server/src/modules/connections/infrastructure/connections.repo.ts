import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, isNotNull, lt, or } from "drizzle-orm";
import { accountLocks, providerConnections, type AuthType, type DatabaseHandle, type TestStatus } from "@aigate/database";
import type { OAuthTokens } from "@aigate/engine";
import { DATABASE } from "../../../database.provider.js";
import { SECRET_CIPHER, type SecretCipherPort } from "../../../secret-cipher.js";
import { keyHint, maskHint, refreshContext, sealContext, type ConnectionChanges, type ConnectionFields } from "../domain/connection.js";

// SP11 allows one connection per registry provider; the bound only guards the listing.
const MAX_CONNECTIONS = 100;

export interface ConnectionView {
  id: string;
  provider: string;
  name: string;
  priority: number;
  keyHint: string;
  // The connection's own host (ollama-local) or endpoint (azure), or null for the catalog URL.
  baseUrl: string | null;
  // SP14g: azure deployment, api-version, organization; cloudflare-ai account id. Null when the provider takes none.
  deployment: string | null;
  apiVersion: string | null;
  organization: string | null;
  accountId: string | null;
  proxyPoolId: string | null;
  // SP16 (docs/contracts/oauth.md): how the connection authenticates, the account it signed in as, and when its token expires.
  authType: AuthType;
  email: string | null;
  expiresAt: string | null;
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

// A positive allowlist: the sealed key and tokens are not in it, so no read can return them (catalog.connection-listing).
const t = providerConnections;
const columns = {
  id: t.id, provider: t.provider, name: t.name, priority: t.priority, keyHint: t.keyHint, baseUrl: t.baseUrl,
  deployment: t.deployment, apiVersion: t.apiVersion, organization: t.organization, accountId: t.accountId, proxyPoolId: t.proxyPoolId, authType: t.authType, email: t.email,
  expiresAt: t.expiresAt, isActive: t.isActive, testStatus: t.testStatus, lastError: t.lastError, lastErrorCode: t.lastErrorCode, lastTestedAt: t.lastTestedAt,
  createdAt: t.createdAt, updatedAt: t.updatedAt,
};
type Row = Omit<ConnectionView, "expiresAt" | "lastTestedAt" | "createdAt" | "updatedAt"> & { expiresAt: Date | null; lastTestedAt: Date | null; createdAt: Date; updatedAt: Date };

// What withConnection needs to reach the provider (connection.ollama-local-host, connection.azure-openai-deployment, …).
const data = { baseUrl: t.baseUrl, deployment: t.deployment, apiVersion: t.apiVersion, organization: t.organization, accountId: t.accountId };
export type ConnectionData = { [K in keyof typeof data]: string | null };

// An oauth connection's refresh state (oauth.refresh-lifecycle).
export interface OAuthState {
  refreshToken: string | undefined;
  expiresAt: Date | null;
  // SP16b: codex refreshes a token whose last refresh is 8 days old (9router maxRefreshAgeMs).
  lastRefreshAt: Date | null;
}
// The key (or access token) routing and the connection test use, with the row it came from. SP16c: projectId is the
// Google Cloud Code project a gemini-cli sign-in found.
export type StoredCredential = { id: string; apiKey: string; proxyPoolId: string | null; oauth?: OAuthState; projectId?: string; providerData?: Readonly<Record<string, string>> } & ConnectionData;

const secret = {
  id: t.id, sealed: t.apiKeySealed, authType: t.authType, refreshSealed: t.refreshTokenSealed, expiresAt: t.expiresAt, lastRefreshAt: t.lastRefreshAt, oauthData: t.oauthData, proxyPoolId: t.proxyPoolId, ...data,
};

const toView = (row: Row): ConnectionView => ({
  ...row,
  keyHint: maskHint(row.keyHint),
  expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
  lastTestedAt: row.lastTestedAt ? row.lastTestedAt.toISOString() : null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

// One string of the sign-in data (oauth_data JSON).
const oauthField = (raw: string | null, field: string): string | undefined => {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    const value = typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, field) : undefined;
    return typeof value === "string" && value ? value : undefined;
  } catch {
    return undefined;
  }
};

// oauth.token-storage: a new sign-in updates the provider's connection when it is the same account (the email, and the
// username too when either side has one); SP11 allows one connection per provider, so another account conflicts.
function sameAccount(existing: { authType: AuthType; email: string | null; oauthData: string | null }, tokens: OAuthTokens): boolean {
  if (existing.authType !== "oauth" || !tokens.email || existing.email !== tokens.email) return false;
  const incoming = tokens.data.username;
  const stored = oauthField(existing.oauthData, "username");
  if (incoming && stored) return incoming === stored;
  return !incoming && !stored;
}

const expiry = (now: Date, seconds: number | undefined) => (seconds === undefined ? null : new Date(now.getTime() + seconds * 1000));

@Injectable()
export class ConnectionsRepository {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipherPort,
  ) {}

  async list(): Promise<ConnectionView[]> {
    const rows = await this.database.db.select(columns).from(t).orderBy(asc(t.provider), asc(t.priority)).limit(MAX_CONNECTIONS);
    return rows.map(toView);
  }

  async get(id: string): Promise<ConnectionView | undefined> {
    const row = await this.database.db.select(columns).from(t).where(eq(t.id, id)).get();
    return row ? toView(row) : undefined;
  }

  async create(input: { provider: string; name: string; apiKey: string; baseUrl?: string; priority?: number; proxyPoolId?: string | null } & ConnectionFields): Promise<ConnectionView | undefined> {
    const id = randomUUID();
    const now = new Date();
    return this.database.db.transaction(async (tx) => {
      const prior = await tx.select({ priority: t.priority, name: t.name }).from(t).where(eq(t.provider, input.provider)).limit(MAX_CONNECTIONS);
      if (prior.length >= MAX_CONNECTIONS) return undefined;
      const name = prior.some((row) => row.name === input.name) ? `${input.name} ${prior.length + 1}` : input.name;
      const [row] = await tx.insert(t).values({
        id, provider: input.provider, name, priority: input.priority ?? Math.max(0, ...prior.map((row) => row.priority)) + 1, apiKeySealed: this.cipher.seal(input.apiKey, sealContext(id)),
        keyHint: keyHint(input.apiKey), baseUrl: input.baseUrl ?? null, deployment: input.deployment ?? null, apiVersion: input.apiVersion ?? null,
        organization: input.organization ?? null, accountId: input.accountId ?? null, proxyPoolId: input.proxyPoolId ?? null, createdAt: now, updatedAt: now,
      }).returning(columns);
      return row ? toView(row) : undefined;
    });
  }

  // oauth.token-storage: create the oauth connection, or refresh the tokens of the same account's connection. The read
  // and the write share one transaction; no network I/O happens inside it.
  saveOAuth(input: { provider: string; name: string; tokens: OAuthTokens; organization?: string; accountId?: string }): Promise<ConnectionView | "conflict"> {
    return this.database.db.transaction(async (tx) => {
      const existing = (await tx.select({ id: t.id, authType: t.authType, email: t.email, oauthData: t.oauthData }).from(t).where(eq(t.provider, input.provider)).limit(MAX_CONNECTIONS)).find((row) => sameAccount(row, input.tokens));
      const id = existing?.id ?? randomUUID();
      const now = new Date();
      const { tokens } = input;
      const values = {
        apiKeySealed: this.cipher.seal(tokens.apiKey ?? tokens.accessToken, sealContext(id)), keyHint: keyHint(tokens.apiKey ?? tokens.accessToken), authType: "oauth" as const,
        refreshTokenSealed: tokens.refreshToken ? this.cipher.seal(tokens.refreshToken, refreshContext(id)) : null,
        expiresAt: expiry(now, tokens.expiresIn), email: tokens.email ?? null, oauthData: JSON.stringify(tokens.data), organization: input.organization ?? null,
        // A sign-in counts as a refresh (9router stamps lastRefreshAt on the codex sign-in).
        accountId: input.accountId ?? null, lastRefreshAt: now,
        isActive: true, testStatus: "active" as const, lastError: null, lastErrorCode: null, lastTestedAt: null, updatedAt: now,
      };
      const [row] = existing
        ? await tx.update(t).set(values).where(eq(t.id, id)).returning(columns)
        : await tx.insert(t).values({ id, provider: input.provider, name: input.name, priority: Math.max(0, ...(await tx.select({ priority: t.priority }).from(t).where(eq(t.provider, input.provider)).limit(MAX_CONNECTIONS)).map((row) => row.priority)) + 1, createdAt: now, ...values }).returning(columns);
      if (!row) throw new Error("the oauth connection was not saved");
      return toView(row);
    });
  }

  // oauth.refresh-lifecycle: the new access token (and refresh token, when the provider sent one) replace the old ones.
  // A refresh without an expiry keeps the old one, as 9router does.
  async storeRefresh(id: string, tokens: OAuthTokens): Promise<void> {
    const now = new Date();
    await this.database.db.update(t).set({
      apiKeySealed: this.cipher.seal(tokens.apiKey ?? tokens.accessToken, sealContext(id)), keyHint: keyHint(tokens.apiKey ?? tokens.accessToken),
      ...(tokens.refreshToken ? { refreshTokenSealed: this.cipher.seal(tokens.refreshToken, refreshContext(id)) } : {}),
      ...(tokens.expiresIn !== undefined ? { expiresAt: expiry(now, tokens.expiresIn) } : {}),
      lastRefreshAt: now, updatedAt: now,
    }).where(and(eq(t.id, id), eq(t.authType, "oauth")));
  }

  // The active oauth connections with a refresh token that expire before `before` (the background refresh).
  async oauthExpiring(before: Date): Promise<{ id: string; provider: string; refreshToken: string }[]> {
    const rows = await this.database.db.select({ id: t.id, provider: t.provider, refreshSealed: t.refreshTokenSealed }).from(t)
      .where(and(eq(t.authType, "oauth"), eq(t.isActive, true), isNotNull(t.refreshTokenSealed), lt(t.expiresAt, before))).limit(MAX_CONNECTIONS);
    return rows.flatMap((row) => (row.refreshSealed ? [{ id: row.id, provider: row.provider, refreshToken: this.cipher.open(row.refreshSealed, refreshContext(row.id)) }] : []));
  }

  // A new key starts over as untested: the old result described a different key.
  async update(id: string, changes: ConnectionChanges): Promise<ConnectionView | undefined> {
    if (changes.priority !== undefined) return this.reorder(id, changes.priority);
    const { apiKey, ...rest } = changes;
    const key = apiKey === undefined ? {} : {
      apiKeySealed: this.cipher.seal(apiKey, sealContext(id)), keyHint: keyHint(apiKey),
      testStatus: "untested" as const, lastError: null, lastErrorCode: null, lastTestedAt: null,
    };
    const [row] = await this.database.db.update(t).set({ ...rest, ...key, updatedAt: new Date() }).where(eq(t.id, id)).returning(columns);
    return row ? toView(row) : undefined;
  }

  private async reorder(id: string, priority: number): Promise<ConnectionView | undefined> {
    return this.database.db.transaction(async (tx) => {
      const current = await tx.select({ provider: t.provider }).from(t).where(eq(t.id, id)).get();
      if (!current) return undefined;
      const rows = await tx.select({ id: t.id }).from(t).where(eq(t.provider, current.provider)).orderBy(asc(t.priority)).limit(MAX_CONNECTIONS);
      const ids = rows.map((row) => row.id).filter((rowId) => rowId !== id);
      ids.splice(Math.min(priority - 1, ids.length), 0, id);
      const now = new Date();
      for (const [index, rowId] of ids.entries()) await tx.update(t).set({ priority: index + 1, updatedAt: now }).where(eq(t.id, rowId));
      const row = await tx.select(columns).from(t).where(eq(t.id, id)).get();
      return row ? toView(row) : undefined;
    });
  }

  async remove(id: string): Promise<boolean> {
    const deleted = await this.database.db.delete(t).where(eq(t.id, id)).returning({ id: t.id });
    return deleted.length === 1;
  }

  // Throws SecretUnreadableError when the secret key changed since the key was saved.
  async readKey(id: string): Promise<(StoredCredential & { provider: string; sealed: string }) | undefined> {
    const row = await this.database.db.select({ provider: t.provider, ...secret }).from(t).where(eq(t.id, id)).get();
    return row ? { provider: row.provider, sealed: row.sealed, ...this.open(row) } : undefined;
  }

  // The key and connection data routing uses (SP12): only an active connection counts; its test status does not.
  // Throws SecretUnreadableError when the secret key changed since the key was saved.
  async activeCredential(provider: string): Promise<StoredCredential | undefined> {
    const row = await this.database.db.select(secret).from(t).where(and(eq(t.provider, provider), eq(t.isActive, true))).orderBy(asc(t.priority)).get();
    return row ? this.open(row) : undefined;
  }

  // Async jobs (SP22 video) are account-bound, so polling may pin the active creating connection.
  async activeCredentialById(provider: string, id: string): Promise<StoredCredential | undefined> {
    const row = await this.database.db.select(secret).from(t).where(and(eq(t.id, id), eq(t.provider, provider), eq(t.isActive, true))).get();
    return row ? this.open(row) : undefined;
  }

  // The candidate selection and round-robin bookkeeping share a short SQLite transaction. No secret crosses this boundary.
  async selectActive(provider: string, model: string, excluded: ReadonlySet<string>, strategy: "fill-first" | "round-robin"): Promise<{ credential?: StoredCredential; retryAt?: Date }> {
    return this.database.db.transaction(async (tx) => {
      const now = new Date();
      await tx.delete(accountLocks).where(lt(accountLocks.until, now));
      const rows = await tx.select({ ...secret, priority: t.priority, lastUsedAt: t.lastUsedAt, consecutiveUseCount: t.consecutiveUseCount }).from(t)
        .where(and(eq(t.provider, provider), eq(t.isActive, true))).orderBy(asc(t.priority)).limit(MAX_CONNECTIONS);
      if (rows.length === 0) return {};
      const locks = await tx.select({ connectionId: accountLocks.connectionId, model: accountLocks.model, until: accountLocks.until }).from(accountLocks)
        .where(and(inArray(accountLocks.connectionId, rows.map((row) => row.id)), or(eq(accountLocks.model, model), eq(accountLocks.model, "__all")))).limit(MAX_CONNECTIONS * 2);
      const blocked = new Map<string, Date>();
      for (const lock of locks) if (lock.model === model || lock.model === "__all") {
        const old = blocked.get(lock.connectionId);
        if (!old || lock.until < old) blocked.set(lock.connectionId, lock.until);
      }
      const available = rows.filter((row) => !excluded.has(row.id) && !blocked.has(row.id));
      if (available.length === 0) return { retryAt: [...blocked.values()].sort((a, b) => a.getTime() - b.getTime())[0] };
      let chosen = available[0];
      if (strategy === "round-robin") {
        const recent = [...available].sort((a, b) => (b.lastUsedAt?.getTime() ?? -1) - (a.lastUsedAt?.getTime() ?? -1) || a.priority - b.priority)[0];
        chosen = recent.lastUsedAt && recent.consecutiveUseCount < 3
          ? recent
          : [...available].sort((a, b) => (a.lastUsedAt?.getTime() ?? -1) - (b.lastUsedAt?.getTime() ?? -1) || a.priority - b.priority)[0];
        await tx.update(t).set({ lastUsedAt: now, consecutiveUseCount: chosen.id === recent.id && recent.lastUsedAt ? recent.consecutiveUseCount + 1 : 1, updatedAt: now }).where(eq(t.id, chosen.id));
      }
      return { credential: this.open(chosen) };
    });
  }

  async lock(id: string, model: string, until: Date): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      await tx.delete(accountLocks).where(and(eq(accountLocks.connectionId, id), eq(accountLocks.model, model)));
      await tx.insert(accountLocks).values({ connectionId: id, model, until });
    });
  }

  async clearLock(id: string, model: string): Promise<void> {
    await this.database.db.delete(accountLocks).where(and(eq(accountLocks.connectionId, id), eq(accountLocks.model, model)));
  }

  async activeProviders(): Promise<Set<string>> {
    const rows = await this.database.db.select({ provider: t.provider }).from(t).where(eq(t.isActive, true)).limit(MAX_CONNECTIONS);
    return new Set(rows.map((row) => row.provider));
  }

  async activeCount(provider: string): Promise<number> {
    const rows = await this.database.db.select({ id: t.id }).from(t).where(and(eq(t.provider, provider), eq(t.isActive, true))).limit(MAX_CONNECTIONS);
    return rows.length;
  }

  // Written only if the key is still the one that was tested; a key replaced mid-test keeps its untested state.
  async recordTest(id: string, sealed: string, outcome: TestOutcome): Promise<ConnectionView | undefined> {
    const [row] = await this.database.db.update(t).set({ ...outcome, lastTestedAt: new Date() })
      .where(and(eq(t.id, id), eq(t.apiKeySealed, sealed))).returning(columns);
    return row ? toView(row) : this.get(id);
  }

  private open(row: {
    id: string; sealed: string; authType: AuthType; refreshSealed: string | null; expiresAt: Date | null; lastRefreshAt: Date | null; oauthData: string | null; proxyPoolId: string | null;
  } & ConnectionData): StoredCredential {
    const { id, sealed, authType, refreshSealed, expiresAt, lastRefreshAt, oauthData, ...rest } = row;
    const refreshToken = refreshSealed ? this.cipher.open(refreshSealed, refreshContext(id)) : undefined;
    const oauth = authType === "oauth" ? { oauth: { refreshToken, expiresAt, lastRefreshAt } } : {};
    const projectId = oauthField(oauthData, "projectId");
    let providerData: Readonly<Record<string, string>> | undefined;
    if (oauthData) {
      try {
        const parsed: unknown = JSON.parse(oauthData);
        if (typeof parsed === "object" && parsed !== null) {
          const entries = Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== "");
          if (entries.length > 0) providerData = Object.fromEntries(entries);
        }
      } catch { providerData = undefined; }
    }
    return { id, apiKey: this.cipher.open(sealed, sealContext(id)), ...oauth, ...(projectId ? { projectId } : {}), ...(providerData ? { providerData } : {}), ...rest };
  }
}
