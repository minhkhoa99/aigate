import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, lt, or, sql } from "drizzle-orm";
import { accountLocks, providerConnections, usageEvents, usageRequests, type DatabaseHandle } from "@aigate/database";
import { DATABASE } from "../../../database.provider.js";

// docs/contracts/overview.md: history grows; only SQL aggregates and bounded alerts leave SQLite.
export const OVERVIEW_HOUR_MS = 3_600_000;
export const OVERVIEW_DAY_MS = 24 * OVERVIEW_HOUR_MS;
export const MAX_OVERVIEW_PROVIDERS = 200;
export const MAX_OVERVIEW_ALERTS = 100;
const EXPIRY_WARNING_MS = 3 * OVERVIEW_DAY_MS;
const r = usageRequests;
const e = usageEvents;
const c = providerConnections;
const locks = accountLocks;

@Injectable()
export class OverviewRepository {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  hourly(now: number) {
    const from = now - 2 * OVERVIEW_DAY_MS;
    const hour = sql<number>`cast((${r.at} - ${from}) / ${OVERVIEW_HOUR_MS} as integer)`.mapWith(Number);
    return this.database.db.select({
      hour, requests: sql<number>`count(*)`.mapWith(Number),
      errors: sql<number>`sum(case when ${r.status} <> 'success' then 1 else 0 end)`.mapWith(Number),
      tokens: sql<number>`sum(${r.inputTokens} + ${r.outputTokens} + ${r.cacheReadTokens} + ${r.cacheWriteTokens})`.mapWith(Number),
      cost: sql<number>`coalesce(sum(${r.cost}), 0)`.mapWith(Number), unpriced: sql<number>`sum(${r.unpriced})`.mapWith(Number),
    }).from(r).where(and(gte(r.at, new Date(from)), lt(r.at, new Date(now)))).groupBy(hour).limit(48);
  }

  health(now: number) {
    const requests = sql<number>`count(*)`.mapWith(Number);
    return this.database.db.select({ provider: e.provider, requests,
      errors: sql<number>`sum(case when ${e.status} <> 'success' then 1 else 0 end)`.mapWith(Number),
    }).from(e).where(and(gte(e.at, new Date(now - OVERVIEW_HOUR_MS)), lt(e.at, new Date(now))))
      .groupBy(e.provider).orderBy(desc(requests), asc(e.provider)).limit(MAX_OVERVIEW_PROVIDERS + 1);
  }

  configuredProviders() {
    return this.database.db.select({ provider: c.provider, enabledConnections: sql<number>`count(*)`.mapWith(Number) }).from(c)
      .where(eq(c.isActive, true)).groupBy(c.provider).orderBy(asc(c.provider)).limit(MAX_OVERVIEW_PROVIDERS + 1);
  }

  counts(cachedIds: string[]) {
    const cached = cachedIds.length ? inArray(c.id, cachedIds) : sql`0`;
    return this.database.db.select({ enabledConnections: sql<number>`count(*)`.mapWith(Number),
      quotaChecked: sql<number>`coalesce(sum(case when ${cached} then 1 else 0 end), 0)`.mapWith(Number),
    }).from(c).where(eq(c.isActive, true)).get();
  }

  attention(now: number, lowQuotaIds: string[]) {
    return this.database.db.select({
      id: c.id, provider: c.provider, name: c.name, testStatus: c.testStatus, authType: c.authType, expiresAt: c.expiresAt,
      lockedModels: sql<number>`count(${locks.model})`.mapWith(Number),
      accountLocked: sql<number>`coalesce(max(case when ${locks.model} = '__all' then 1 else 0 end), 0)`.mapWith(Number),
      lockedUntil: sql<number | null>`max(${locks.until})`.mapWith((value) => value === null ? null : Number(value)),
    }).from(c).leftJoin(locks, and(eq(locks.connectionId, c.id), gt(locks.until, new Date(now))))
      .where(and(eq(c.isActive, true), or(
        inArray(c.testStatus, ["invalid", "no_quota", "unreachable"]),
        and(eq(c.authType, "oauth"), lt(c.expiresAt, new Date(now + EXPIRY_WARNING_MS))),
        isNotNull(locks.connectionId), lowQuotaIds.length ? inArray(c.id, lowQuotaIds) : undefined,
      ))).groupBy(c.id).orderBy(asc(c.provider), asc(c.id)).limit(MAX_OVERVIEW_ALERTS + 1);
  }
}
