import { Controller, Get, Header } from "@nestjs/common";
import { DisplayNames } from "./display-names.js";
import { MAX_OVERVIEW_ALERTS, MAX_OVERVIEW_PROVIDERS, OVERVIEW_DAY_MS, OVERVIEW_HOUR_MS, OverviewRepository } from "./overview.repo.js";
import { QuotaService, type QuotaLine } from "./quota.service.js";
import { UsageRecorder } from "./usage-recorder.js";

interface Metrics { requests: number; errors: number; tokens: number; cost: number; unpriced: number }
interface Alert { id: string; provider: string; name: string; kind: "lock" | "credential" | "expiry" | "quota"; tone: "warning" | "danger"; message: string; until: number | null }
const empty = (): Metrics => ({ requests: 0, errors: 0, tokens: 0, cost: 0, unpriced: 0 });
// A credit balance can have no reported total; only exhaustion is meaningful in that case.
const lowQuota = (line: QuotaLine) => !line.unlimited && line.remaining !== null &&
  (line.remaining <= 0 || (line.total > 0 && line.remaining / line.total <= 0.1));

@Controller("api/overview")
export class OverviewController {
  constructor(
    private readonly overview: OverviewRepository,
    private readonly names: DisplayNames,
    private readonly quotas: QuotaService,
    private readonly recorder: UsageRecorder,
  ) {}

  @Get("summary")
  @Header("Cache-Control", "no-store")
  async summary() {
    const at = Date.now();
    const cachedQuota = this.quotas.cached(at);
    const low = new Map(cachedQuota.flatMap((account) => {
      const line = account.quotas.find(lowQuota);
      return line ? [[account.connectionId, line] as const] : [];
    }));
    const [hours, health, configured, counts, accounts, names] = await Promise.all([
      this.overview.hourly(at), this.overview.health(at), this.overview.configuredProviders(),
      this.overview.counts(cachedQuota.map((row) => row.connectionId)), this.overview.attention(at, [...low.keys()]), this.names.load(),
    ]);
    const current = empty();
    const previous = empty();
    const buckets = Array.from({ length: 24 }, (_, index) => ({ start: at - OVERVIEW_DAY_MS + index * OVERVIEW_HOUR_MS, ...empty() }));
    for (const { hour, ...metrics } of hours) {
      const target = hour < 24 ? previous : current;
      target.requests += metrics.requests; target.errors += metrics.errors; target.tokens += metrics.tokens;
      target.cost += metrics.cost; target.unpriced += metrics.unpriced;
      if (hour >= 24) Object.assign(buckets[hour - 24], metrics);
    }
    const providerRows = new Map(configured.map((row) => [row.provider, { ...row, requests: 0, errors: 0 }]));
    for (const row of health) providerRows.set(row.provider, { ...row, enabledConnections: providerRows.get(row.provider)?.enabledConnections ?? 0 });
    const providers = [...providerRows.values()].sort((a, b) => b.requests - a.requests || a.provider.localeCompare(b.provider));
    const attention: Alert[] = [];
    for (const account of accounts) {
      const base = { provider: account.provider, name: account.name };
      if (account.lockedModels > 0) attention.push({ ...base, id: `${account.id}:lock`, kind: "lock", tone: "warning", until: account.lockedUntil,
        message: account.accountLocked ? "Account is temporarily blocked for all models." : `${account.lockedModels} model route(s) are temporarily blocked.` });
      if (["invalid", "no_quota", "unreachable"].includes(account.testStatus)) attention.push({ ...base, id: `${account.id}:credential`, kind: "credential",
        tone: account.testStatus === "unreachable" ? "warning" : "danger", until: null,
        message: account.testStatus === "invalid" ? "Last connection test rejected the credential." : account.testStatus === "no_quota" ? "Last connection test reported no quota or credit." : "Last connection test could not reach the provider." });
      const expiry = account.expiresAt?.getTime();
      if (account.authType === "oauth" && expiry !== undefined && expiry < at + 3 * OVERVIEW_DAY_MS) attention.push({ ...base,
        id: `${account.id}:expiry`, kind: "expiry", tone: expiry <= at ? "danger" : "warning", until: expiry,
        message: expiry <= at ? "OAuth access token expired; automatic refresh may renew it on the next request." : "OAuth access token expires within three days; automatic refresh may renew it." });
      const quota = low.get(account.id);
      if (quota) attention.push({ ...base, id: `${account.id}:quota`, kind: "quota", tone: (quota.remaining ?? 0) <= 0 ? "danger" : "warning", until: null,
        message: `${quota.name}: ${quota.remaining} remaining${quota.total > 0 ? ` of ${quota.total}` : ""} (cached vendor reading).` });
    }
    return {
      at, timezone: this.recorder.config.timezone, uptimeSeconds: Math.floor(process.uptime()),
      enabledConnections: counts?.enabledConnections ?? 0, quotaChecked: counts?.quotaChecked ?? 0,
      current, previous, buckets,
      providers: providers.slice(0, MAX_OVERVIEW_PROVIDERS).map((row) => ({ ...row, name: names.provider(row.provider),
        errorRate: row.requests ? row.errors / row.requests : null,
        health: row.requests === 0 ? "unknown" : row.errors === 0 ? "healthy" : row.errors / row.requests < 0.05 ? "degraded" : "down",
      })),
      providersTruncated: providers.length > MAX_OVERVIEW_PROVIDERS || health.length > MAX_OVERVIEW_PROVIDERS || configured.length > MAX_OVERVIEW_PROVIDERS,
      attention: attention.slice(0, MAX_OVERVIEW_ALERTS), attentionTruncated: accounts.length > MAX_OVERVIEW_ALERTS || attention.length > MAX_OVERVIEW_ALERTS,
      writer: this.recorder.writer(),
    };
  }
}
