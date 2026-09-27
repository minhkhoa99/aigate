import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { OAUTH_PROVIDERS, withRetry, type HttpTransportPort, type OAuthTokens } from "@aigate/engine";
import { HTTP_TRANSPORT } from "../../transport/transport.module.js";
import { ConnectionsRepository, type StoredCredential } from "./connections.repo.js";

// oauth.refresh-lifecycle, kept as 9router has it (user decision 2026-09-27): proactive refreshes of one connection share
// one in-flight promise; the reactive refresh after a 401/403 tries three times (1 s, then 2 s apart) without that lock,
// even for a connection that cannot refresh; every 5 minutes the tokens that expire within 30 minutes are refreshed.
const LEAD_MS = 5 * 60_000;
const BACKGROUND_LEAD_MS = 30 * 60_000;
const BACKGROUND_INTERVAL_MS = 5 * 60_000;
const REFRESH_BUDGET_MS = 20_000;
const REACTIVE_ATTEMPTS = 3;
// Three refreshes (20 s each at most) and the two pauses.
const REACTIVE_BUDGET_MS = 90_000;

@Injectable()
export class TokenRefresher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("TokenRefresher");
  // At most one entry per connection, removed when its refresh settles.
  private readonly inflight = new Map<string, Promise<string | undefined>>();
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly connections: ConnectionsRepository,
    @Inject(HTTP_TRANSPORT) private readonly transport: HttpTransportPort,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.background(), BACKGROUND_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  // Proactive (checkAndRefreshToken): a token that expires within the provider's lead (5 minutes unless it names one:
  // claude 4 h, codex 5 days) or whose last refresh is older than its maximum age (codex 8 days) is refreshed before it is
  // used; a failed refresh leaves the old token.
  async fresh<T extends StoredCredential>(provider: string, stored: T): Promise<T> {
    const refreshToken = stored.oauth?.refreshToken;
    if (!refreshToken || !this.due(provider, stored)) return stored;
    const token = await this.locked(stored.id, provider, refreshToken);
    return token ? { ...stored, apiKey: token } : stored;
  }

  // 9router shouldRefreshCredentials.
  due(provider: string, stored: StoredCredential): boolean {
    const oauth = stored.oauth;
    if (!oauth) return false;
    const flow = OAUTH_PROVIDERS[provider];
    const now = Date.now();
    const expiring = oauth.expiresAt !== null && oauth.expiresAt.getTime() - now < (flow?.refreshLeadMs ?? LEAD_MS);
    const stale = flow?.maxRefreshAgeMs !== undefined && (oauth.lastRefreshAt === null || now - oauth.lastRefreshAt.getTime() > flow.maxRefreshAgeMs);
    return expiring || stale;
  }

  // Reactive (refreshWithRetry after a 401/403): three attempts, attempt × delayMs apart, without the lock. A connection
  // without a refresh token fails every attempt, as in 9router.
  async reactive(provider: string, stored: StoredCredential, delayMs: number): Promise<string | undefined> {
    const refreshToken = stored.oauth?.refreshToken;
    try {
      // withRetry waits delayMs, then 2 × delayMs: 9router's 1 s and 2 s.
      return await withRetry(async () => {
        const tokens = refreshToken ? await this.refresh(provider, stored.id, refreshToken) : null;
        if (!tokens) throw new Error(refreshToken ? `${provider} refused the refresh` : `${provider} has no refresh token`);
        return tokens.accessToken;
      }, { signal: AbortSignal.timeout(REACTIVE_BUDGET_MS), maxAttempts: REACTIVE_ATTEMPTS, baseDelayMs: delayMs, maxDelayMs: delayMs * 2, shouldRetry: () => true });
    } catch (error) {
      this.logger.warn(`${provider} reactive refresh failed: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }

  private locked(id: string, provider: string, refreshToken: string): Promise<string | undefined> {
    const running = this.inflight.get(id);
    if (running) return running;
    const pending = this.refresh(provider, id, refreshToken)
      .then((tokens) => tokens?.accessToken)
      .catch((error: unknown) => {
        this.logger.warn(`${provider} refresh failed: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
      })
      .finally(() => this.inflight.delete(id));
    this.inflight.set(id, pending);
    return pending;
  }

  private async refresh(provider: string, id: string, refreshToken: string): Promise<OAuthTokens | null> {
    const io = { transport: this.transport, ctx: { signal: AbortSignal.timeout(REFRESH_BUDGET_MS), requestId: randomUUID() } };
    const tokens = await OAUTH_PROVIDERS[provider]?.refresh?.(refreshToken, io) ?? null;
    if (tokens) await this.connections.storeRefresh(id, tokens);
    return tokens;
  }

  // One connection at a time; the query is bounded to 100 rows.
  private async background(): Promise<void> {
    try {
      for (const row of await this.connections.oauthExpiring(new Date(Date.now() + BACKGROUND_LEAD_MS))) {
        await this.locked(row.id, row.provider, row.refreshToken);
      }
    } catch (error) {
      this.logger.warn(`background refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
