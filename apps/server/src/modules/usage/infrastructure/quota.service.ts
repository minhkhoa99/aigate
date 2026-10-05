import { Inject, Injectable } from "@nestjs/common";
import { builtinRegistry, readBoundedText, type HttpTransportPort, type ProxyConfig } from "@aigate/engine";
import { ConnectionsRepository, type ConnectionView, type StoredCredential } from "../../connections/infrastructure/connections.repo.js";
import { TokenRefresher } from "../../connections/infrastructure/token-refresher.js";
import { ProxyPoolsRepository } from "../../transport/infrastructure/proxy-pools.repo.js";
import { HTTP_TRANSPORT } from "../../transport/transport.token.js";

const TIMEOUT_MS = 15_000;
const BODY_BYTES = 1024 * 1024;
const CACHE_MS = 60_000;
const MAX_CACHE = 100;
const PROVIDER_HEADERS = new Set(["codebuddy-cn", "codebuddy-intl"]);

export interface QuotaLine { name: string; used: number; total: number; remaining: number | null; resetAt: string | null; unlimited: boolean }
export interface QuotaView { connectionId: string; provider: string; name: string; plan: string | null; quotas: QuotaLine[]; message: string | null; fetchedAt: number; cached: boolean }
type CacheEntry = { value: QuotaView; expiresAt: number };
type Json = Record<string, unknown>;

const object = (value: unknown): Json => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const result: Json = {};
  for (const [key, entry] of Object.entries(value)) result[key] = entry;
  return result;
};
const number = (value: unknown, fallback = 0) => {
  const raw = typeof value === "object" && value !== null && !Array.isArray(value) ? Reflect.get(value, "val") ?? value : value;
  const parsed = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};
const text = (value: unknown): string | null => typeof value === "string" && value ? value : null;
const resetAt = (value: unknown): string | null => {
  const raw = typeof value === "number" && value < 1_000_000_000_000 ? value * 1000 : value;
  const date = new Date(typeof raw === "string" || typeof raw === "number" ? raw : NaN);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
const quota = (name: string, used: number, total: number, reset: unknown = null, unlimited = false): QuotaLine => ({ name, used: Math.max(0, used), total: Math.max(0, total), remaining: unlimited ? null : Math.max(0, total - used), resetAt: resetAt(reset), unlimited });
const percent = (name: string, used: unknown, reset: unknown = null): QuotaLine => quota(name, Math.max(0, Math.min(100, number(used))), 100, reset);

function claude(root: Json): Pick<QuotaView, "plan" | "quotas" | "message"> {
  const quotas: QuotaLine[] = [];
  for (const [key, value] of Object.entries(root)) {
    if (key !== "five_hour" && key !== "seven_day" && !key.startsWith("seven_day_")) continue;
    const window = object(value);
    if (typeof window.utilization !== "number") continue;
    const label = key === "five_hour" ? "Session (5h)" : key === "seven_day" ? "Weekly (7d)" : `Weekly ${key.slice(10)} (7d)`;
    quotas.push(percent(label, window.utilization, window.resets_at));
  }
  for (const value of Array.isArray(root.limits) ? root.limits : []) {
    const limit = object(value); const scope = object(object(limit.scope).model);
    if (limit.kind === "weekly_scoped" && typeof limit.percent === "number" && text(scope.display_name)) quotas.push(percent(`Weekly ${text(scope.display_name)} (7d)`, limit.percent, limit.resets_at));
  }
  return { plan: "Claude Code", quotas, message: quotas.length ? null : "Claude returned no quota windows." };
}

function github(root: Json): Pick<QuotaView, "plan" | "quotas" | "message"> {
  const quotas: QuotaLine[] = []; const reset = root.quota_reset_date ?? root.limited_user_reset_date;
  const snapshots = object(root.quota_snapshots);
  for (const name of ["chat", "completions", "premium_interactions"]) {
    const row = object(snapshots[name]);
    if (Object.keys(row).length) quotas.push(quota(name, number(row.entitlement) - number(row.remaining), number(row.entitlement), reset, row.unlimited === true));
  }
  const totals = object(root.monthly_quotas); const used = object(root.limited_user_quotas);
  for (const name of ["chat", "completions"]) if (typeof totals[name] === "number") quotas.push(quota(name, number(used[name]), number(totals[name]), reset));
  return { plan: text(root.copilot_plan) ?? text(root.access_type_sku), quotas, message: quotas.length ? null : "GitHub returned no quota windows." };
}

function codex(root: Json): Pick<QuotaView, "plan" | "quotas" | "message"> {
  const quotas: QuotaLine[] = []; const rate = object(root.rate_limit);
  for (const [name, key] of [["Session", "primary_window"], ["Weekly", "secondary_window"]] as const) {
    const window = object(rate[key] ?? root[key]);
    if (Object.keys(window).length) quotas.push(percent(name, window.used_percent ?? window.percent_used, window.reset_at ?? window.resets_at ?? window.resetAt));
  }
  const credits = object(root.reset_credits ?? root.resetCredits);
  if (typeof credits.availableCount === "number") quotas.push(quota("Reset credits", 0, number(credits.availableCount), null));
  return { plan: text(root.plan_type) ?? text(object(root.summary).plan), quotas, message: quotas.length ? null : "Codex returned no quota windows." };
}

function quotaFromUsage(root: Json, plan: string): Pick<QuotaView, "plan" | "quotas" | "message"> {
  const usage = object(root.usage); const quotas: QuotaLine[] = [];
  for (const [key, label] of [["rolling", "Rolling"], ["weekly", "Weekly"], ["monthly", "Monthly"]] as const) {
    const window = object(usage[key]);
    if (typeof window.percent === "number") quotas.push(percent(label, window.percent, window.resetsAt));
  }
  return { plan, quotas, message: quotas.length ? null : `${plan} returned no quota windows.` };
}

function glm(root: Json): Pick<QuotaView, "plan" | "quotas" | "message"> {
  const data = object(root.data); const quotas: QuotaLine[] = [];
  for (const value of Array.isArray(data.limits) ? data.limits : []) {
    const limit = object(value);
    if (limit.type !== "TOKENS_LIMIT" && limit.type !== "CREDIT_LIMIT") continue;
    const unit = number(limit.unit); const name = unit === 3 ? `Session (${number(limit.number)}h)` : unit === 6 ? "Weekly (7d)" : text(limit.type) ?? "Limit";
    quotas.push(percent(name, limit.percentage, limit.nextResetTime));
  }
  const level = text(data.level);
  return { plan: level ? `${level.slice(0, 1)}${level.slice(1).toLowerCase()}` : "GLM", quotas, message: quotas.length ? null : "GLM returned no quota windows." };
}

function deepseek(root: Json): Pick<QuotaView, "plan" | "quotas" | "message"> {
  const quotas = (Array.isArray(root.balance_infos) ? root.balance_infos : []).flatMap((value) => {
    const balance = object(value); const currency = text(balance.currency);
    const remaining = number(balance.total_balance ?? balance.totalBalance, NaN);
    return currency && Number.isFinite(remaining) ? [quota(`Balance (${currency.toUpperCase()})`, 0, remaining)] : [];
  });
  return { plan: root.is_available === false ? "DeepSeek (Insufficient Balance)" : "DeepSeek", quotas, message: quotas.length ? null : "DeepSeek returned no balances." };
}

function kimi(root: Json): Pick<QuotaView, "plan" | "quotas" | "message"> {
  const usage = object(root.usage); const quotas: QuotaLine[] = [];
  if (number(usage.limit) > 0) quotas.push(quota("Weekly", number(usage.used), number(usage.limit), usage.resetTime ?? usage.reset_at ?? usage.resetAt));
  for (const value of Array.isArray(root.limits) ? root.limits : []) {
    const detail = object(object(value).detail); const limit = number(detail.limit ?? detail.Limit);
    if (limit > 0) quotas.push(quota("Rate limit", limit - number(detail.remaining ?? detail.Remaining, limit), limit, detail.resetTime ?? detail.reset_at ?? detail.resetAt));
  }
  return { plan: text(object(object(root.user).membership).level) ?? "Kimi Coding", quotas, message: quotas.length ? null : "Kimi returned no quota windows." };
}

function codebuddy(root: Json): Pick<QuotaView, "plan" | "quotas" | "message"> {
  const data = object(object(object(root.data).Response).Data); const quotas: QuotaLine[] = [];
  for (const [index, value] of (Array.isArray(data.Accounts) ? data.Accounts : []).entries()) {
    const account = object(value); const total = number(account.CycleCapacitySizePrecise ?? account.CycleCapacitySize ?? account.CapacitySizePrecise ?? account.CapacitySize);
    if (total > 0) quotas.push(quota(`Package ${index + 1}`, number(account.CycleCapacityUsedPrecise ?? account.CycleCapacityUsed ?? account.CapacityUsedPrecise ?? account.CapacityUsed), total, account.CycleEndTime));
  }
  return { plan: text(object((Array.isArray(data.Accounts) ? data.Accounts : [])[0]).PackageName) ?? "CodeBuddy", quotas, message: quotas.length ? null : "CodeBuddy returned no credit packages." };
}

function minimax(root: Json, provider: string): Pick<QuotaView, "plan" | "quotas" | "message"> {
  const quotas: QuotaLine[] = [];
  const models = root.model_remains ?? root.modelRemains;
  for (const value of Array.isArray(models) ? models : []) {
    const row = object(value); const name = text(row.model_name ?? row.modelName) ?? "Model";
    for (const [label, totalKey, usedKey, remainingKey, resetKey] of [
      ["5h", "current_interval_total_count", "current_interval_usage_count", "current_interval_remaining_percent", "remains_time"],
      ["7d", "current_weekly_total_count", "current_weekly_usage_count", "current_weekly_remaining_percent", "weekly_remains_time"],
    ] as const) {
      const total = number(row[totalKey]); const count = number(row[usedKey]); const remaining = number(row[remainingKey], NaN);
      const used = provider === "minimax-cn" ? total - count : count;
      const reset = number(row[resetKey]); const resetDate = reset > 0 && reset < 1_000_000_000_000 ? Date.now() + reset : row[resetKey];
      if (total > 0 || count > 0 || Number.isFinite(remaining)) quotas.push(quota(`${name} (${label})`, Number.isFinite(remaining) ? 100 - remaining : used, Number.isFinite(remaining) ? 100 : total, resetDate));
    }
  }
  return { plan: "MiniMax", quotas, message: quotas.length ? null : "MiniMax returned no quota windows." };
}

function vercel(root: Json): Pick<QuotaView, "plan" | "quotas" | "message"> {
  const balance = number(root.balance); const used = number(root.total_used);
  return { plan: "Pay as you go", quotas: [{ name: "Credits (USD)", used, total: balance + used, remaining: balance, resetAt: null, unlimited: false }], message: null };
}

function ollama(root: Json): Pick<QuotaView, "plan" | "quotas" | "message"> {
  const quotas: QuotaLine[] = []; const limits = object(root.limits);
  for (const [key, label] of [["session", "Session (5h)"], ["weekly", "Weekly (7d)"], ["monthly", "Monthly"]] as const) {
    const value = object(limits[key]);
    if (typeof value.usage === "number") quotas.push(percent(label, value.usage * 100));
  }
  return { plan: "Ollama Cloud", quotas, message: quotas.length ? null : "Ollama did not report quota windows." };
}

const endpoint = (provider: string): string | undefined => ({
  claude: "https://api.anthropic.com/api/oauth/usage",
  github: "https://api.github.com/copilot_internal/user",
  codex: "https://chatgpt.com/backend-api/wham/usage",
  "gemini-cli": "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota",
  antigravity: "https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels",
  kiro: "https://codewhisperer.us-east-1.amazonaws.com/getUsageLimits?isEmailRequired=true&origin=AI_EDITOR&resourceType=AGENTIC_REQUEST",
  "opencode-go": "https://opencode.ai/zen/go/v1/usage",
  "opencode-zen": "https://opencode.ai/zen/v1/usage",
  glm: "https://api.z.ai/api/monitor/usage/quota/limit",
  "glm-cn": "https://open.bigmodel.cn/api/monitor/usage/quota/limit",
  deepseek: "https://api.deepseek.com/user/balance",
  groq: "https://api.groq.com/openai/v1/models",
  kimi: "https://api.kimi.com/coding/v1/usages",
  "codebuddy-cn": "https://copilot.tencent.com/v2/billing/meter/get-user-resource",
  "codebuddy-intl": "https://www.codebuddy.ai/v2/billing/meter/get-user-resource",
  "grok-cli": "https://cli-chat-proxy.grok.com/v1/billing?format=credits",
  "vercel-ai-gateway": "https://ai-gateway.vercel.sh/v1/credits",
  minimax: "https://www.minimax.io/v1/token_plan/remains",
  "minimax-cn": "https://www.minimaxi.com/v1/api/openplatform/coding_plan/remains",
  ollama: "https://ollama.com/api/usage",
  commandcode: "https://api.commandcode.ai/alpha/whoami",
}[provider]);

function headers(provider: string, key: string): Record<string, string> {
  if (provider === "github") return { authorization: `token ${key}`, accept: "application/json", "x-github-api-version": "2022-11-28", "user-agent": "GitHubCopilotChat/0.26.7", "editor-version": "vscode/1.85.0", "editor-plugin-version": "copilot-chat/0.26.7" };
  if (provider === "claude") return { authorization: `Bearer ${key}`, "anthropic-beta": "oauth-2025-04-20", "anthropic-version": "2023-06-01" };
  if (provider === "kimi") return { "x-api-key": key, accept: "application/json" };
  if (provider === "kiro") return { authorization: `Bearer ${key}`, accept: "application/json", "user-agent": "aws-sdk-js/1.0.0 KiroIDE", "x-amz-user-agent": "aws-sdk-js/1.0.0 KiroIDE" };
  if (provider === "grok-cli") return { authorization: `Bearer ${key}`, accept: "application/json", "user-agent": "grok-cli", "x-xai-token-auth": "xai-grok-cli", "x-grok-client-identifier": "grok-cli", "x-grok-client-version": "0.2.93", "x-grok-client-mode": "headless" };
  if (PROVIDER_HEADERS.has(provider)) return { ...(builtinRegistry.provider(provider)?.headers ?? {}), authorization: `Bearer ${key}`, "content-type": "application/json", accept: "application/json" };
  return { authorization: `Bearer ${key}`, accept: "application/json" };
}

@Injectable()
export class QuotaService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<QuotaView>>();

  constructor(
    private readonly connections: ConnectionsRepository,
    private readonly refresher: TokenRefresher,
    private readonly pools: ProxyPoolsRepository,
    @Inject(HTTP_TRANSPORT) private readonly transport: HttpTransportPort,
  ) {}

  async list(force = false): Promise<QuotaView[]> {
    const connections = (await this.connections.list()).filter((connection) => connection.isActive);
    const result: QuotaView[] = new Array(connections.length); let next = 0;
    const worker = async () => { for (;;) { const index = next++; if (index >= connections.length) return; result[index] = await this.one(connections[index], force); } };
    // ponytail: four concurrent vendor reads; add a provider-specific limit only when a vendor documents one.
    await Promise.all([worker(), worker(), worker(), worker()]);
    return result;
  }

  async refresh(id: string): Promise<QuotaView | undefined> {
    const view = await this.connections.get(id);
    return view?.isActive ? this.one(view, true) : undefined;
  }

  // Overview consumes only fresh successful readings; opening it never starts vendor traffic.
  cached(now: number): QuotaView[] {
    return [...this.cache.values()].filter((entry) => entry.expiresAt > now).map((entry) => entry.value);
  }

  private async one(connection: ConnectionView, force: boolean): Promise<QuotaView> {
    const now = Date.now(); const hit = this.cache.get(connection.id);
    if (!force && hit && hit.expiresAt > now) return { ...hit.value, cached: true };
    const running = this.inflight.get(connection.id);
    if (running) return running;
    const pending = this.load(connection, now).finally(() => this.inflight.delete(connection.id));
    this.inflight.set(connection.id, pending);
    return pending;
  }

  private async load(connection: ConnectionView, now: number): Promise<QuotaView> {
    const url = endpoint(connection.provider);
    if (!url) return { connectionId: connection.id, provider: connection.provider, name: connection.name, plan: null, quotas: [], message: "This provider does not expose a quota endpoint yet.", fetchedAt: now, cached: false };
    try {
      const saved = await this.connections.readKey(connection.id);
      if (!saved) return { connectionId: connection.id, provider: connection.provider, name: connection.name, plan: null, quotas: [], message: "Connection is no longer available.", fetchedAt: now, cached: false };
      const stored = await this.refresher.fresh(connection.provider, saved);
      const answer = await this.fetch(url, connection.provider, stored);
      const parsed = connection.provider === "claude" ? claude(answer.root) : connection.provider === "github" ? github(answer.root) : connection.provider === "codex" ? codex(answer.root)
        : connection.provider === "opencode-go" ? quotaFromUsage(answer.root, "OpenCode Go") : connection.provider === "opencode-zen" ? quotaFromUsage(answer.root, "OpenCode Zen")
          : connection.provider === "gemini-cli" ? this.googleQuota(answer.root, "Gemini CLI")
            : connection.provider === "antigravity" ? this.googleQuota(answer.root, "Antigravity")
              : connection.provider === "kiro" ? this.kiroQuota(answer.root)
          : connection.provider === "glm" || connection.provider === "glm-cn" ? glm(answer.root) : connection.provider === "deepseek" ? deepseek(answer.root)
            : connection.provider === "kimi" ? kimi(answer.root)
              : connection.provider === "codebuddy-cn" || connection.provider === "codebuddy-intl" ? codebuddy(answer.root)
                : connection.provider === "minimax" || connection.provider === "minimax-cn" ? minimax(answer.root, connection.provider)
                  : connection.provider === "vercel-ai-gateway" ? vercel(answer.root) : connection.provider === "ollama" ? ollama(answer.root)
                    : connection.provider === "grok-cli" || connection.provider === "commandcode" ? this.creditQuota(answer.root, connection.provider) : this.groq(answer.headers);
      const value = { connectionId: connection.id, provider: connection.provider, name: connection.name, ...parsed, fetchedAt: now, cached: false };
      return value.message === null ? this.remember(value) : value;
    } catch (error) {
      const message = error instanceof Error ? error.message : "The quota endpoint did not return usable data.";
      return { connectionId: connection.id, provider: connection.provider, name: connection.name, plan: null, quotas: [], message, fetchedAt: now, cached: false };
    }
  }

  private async fetch(url: string, provider: string, stored: StoredCredential): Promise<{ root: Json; headers: Readonly<Record<string, string>> }> {
    const proxy: ProxyConfig | undefined = await this.pools.resolve(stored.proxyPoolId);
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    const account: Record<string, string> = provider === "codex" && stored.accountId ? { "chatgpt-account-id": stored.accountId } : {};
    const google = provider === "gemini-cli" || provider === "antigravity";
    const request = async (target: string, method: "GET" | "POST", requestHeaders: Record<string, string>, body?: string) => {
      const response = await this.transport.send({ method, url: target, headers: requestHeaders, body, timeoutMs: TIMEOUT_MS }, { requestId: stored.id, signal, proxy });
      const raw = await readBoundedText(response.body, BODY_BYTES);
      if (response.status < 200 || response.status >= 300) throw new Error(`${provider} answered HTTP ${response.status}.`);
      try { return { root: object(JSON.parse(raw)), headers: response.headers }; } catch { throw new Error(`${provider} returned invalid quota data.`); }
    };
    if (provider === "commandcode") {
      const auth = headers(provider, stored.apiKey);
      const whoami = await request(`${url}?limits=1`, "GET", auth);
      const orgId = text(object(whoami.root.org).id);
      const params = orgId ? `?orgId=${encodeURIComponent(orgId)}` : "";
      const credits = await request(`https://api.commandcode.ai/alpha/billing/credits${params}`, "GET", auth);
      const subscriptions = await request(`https://api.commandcode.ai/alpha/billing/subscriptions${params}`, "GET", auth);
      return { root: { ...credits.root, subscription: subscriptions.root.data }, headers: credits.headers };
    }
    if (provider === "grok-cli") {
      const billing = await request(url, "GET", headers(provider, stored.apiKey));
      const user = await request("https://cli-chat-proxy.grok.com/v1/user?include=subscription", "GET", headers(provider, stored.apiKey)).catch(() => ({ root: {}, headers: billing.headers }));
      return { root: { ...billing.root, user: user.root }, headers: billing.headers };
    }
    if (provider === "minimax" || provider === "minimax-cn") {
      const fallbackUrl = provider === "minimax"
        ? "https://api.minimax.io/v1/api/openplatform/coding_plan/remains"
        : "https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains";
      const primary = await request(url, "GET", headers(provider, stored.apiKey)).catch((error: unknown) => {
        if (/HTTP (?:404|405|5\d\d)/.test(error instanceof Error ? error.message : "")) return null;
        throw error;
      });
      return primary ?? request(fallbackUrl, "GET", headers(provider, stored.apiKey));
    }
    const post = PROVIDER_HEADERS.has(provider) || google;
    const googleHeaders: Record<string, string> = provider === "antigravity" ? { "user-agent": "antigravity/ide/2.11.0 darwin/arm64", "x-client-name": "antigravity", "x-client-version": "1.107.0" } : {};
    let projectId: string | undefined = stored.projectId ?? stored.providerData?.projectId;
    if (provider === "gemini-cli" && !projectId) {
      const subscription: Json = await request("https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist", "POST", { ...headers(provider, stored.apiKey), "content-type": "application/json" }, JSON.stringify({ metadata: { ideType: "IDE_UNSPECIFIED", platform: "PLATFORM_UNSPECIFIED", pluginType: "GEMINI" } })).then((result) => result.root, () => ({}));
      const resolvedProject = text(subscription.cloudaicompanionProject);
      if (resolvedProject) projectId = resolvedProject;
    }
    const providerHeaders = provider === "kimi" && stored.oauth
      ? { authorization: `Bearer ${stored.apiKey}`, accept: "application/json", "content-type": "application/json", "x-msh-platform": "AIGate", "x-msh-version": "1.0", "x-msh-device-name": "AIGate", "x-msh-device-model": "server", "x-msh-device-id": stored.providerData?.deviceId ?? stored.id }
      : headers(provider, stored.apiKey);
    const requestHeaders: Record<string, string> = { ...providerHeaders, ...googleHeaders, ...(google ? { "content-type": "application/json" } : {}), ...account };
    const body = post ? JSON.stringify(google ? { ...(projectId ? { project: projectId } : {}) } : {}) : undefined;
    if (provider === "kiro") {
      const region = stored.providerData?.region && /^[a-z]{2}(-gov)?-[a-z]+-\d$/.test(stored.providerData.region) ? stored.providerData.region : "us-east-1";
      const kiroUrl = `https://codewhisperer.${region}.amazonaws.com/getUsageLimits?isEmailRequired=true&origin=AI_EDITOR&resourceType=AGENTIC_REQUEST`;
      const kiroHeaders: Record<string, string> = { ...requestHeaders, ...(stored.providerData?.authMethod === "api_key" ? { tokentype: "API_KEY" } : {}), ...(stored.providerData?.authMethod === "external_idp" ? { TokenType: "EXTERNAL_IDP" } : {}) };
      const result = await request(kiroUrl, "GET", kiroHeaders).catch(() => request(`https://codewhisperer.${region}.amazonaws.com/`, "POST", { ...kiroHeaders, "content-type": "application/x-amz-json-1.0", "x-amz-target": "AmazonCodeWhispererService.GetUsageLimits" }, JSON.stringify({ origin: "AI_EDITOR", resourceType: "AGENTIC_REQUEST", ...(stored.providerData?.profileArn ? { profileArn: stored.providerData.profileArn } : {}) })));
      return result;
    }
    const result = await request(url, post ? "POST" : "GET", requestHeaders, body);
    if (provider === "antigravity") {
      const summary = await request("https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary", "POST", requestHeaders, body).catch(() => null);
      return { ...result, root: { ...result.root, quotaSummary: summary?.root } };
    }
    return result;
  }

  private groq(headers: Readonly<Record<string, string>>): Pick<QuotaView, "plan" | "quotas" | "message"> {
    const quotas: QuotaLine[] = [];
    for (const [name, kind] of [["Requests", "requests"], ["Tokens", "tokens"]] as const) {
      const total = Number(headers[`x-ratelimit-limit-${kind}`]); const remaining = Number(headers[`x-ratelimit-remaining-${kind}`]);
      const reset = headers[`x-ratelimit-reset-${kind}`];
      if (Number.isFinite(total) && Number.isFinite(remaining)) quotas.push(quota(name, total - remaining, total, reset));
    }
    return { plan: "Groq", quotas, message: quotas.length ? null : "Groq did not report rate-limit windows for this key." };
  }

  private googleQuota(root: Json, plan: string): Pick<QuotaView, "plan" | "quotas" | "message"> {
    const quotas = (Array.isArray(root.buckets) ? root.buckets : []).flatMap((value) => {
      const bucket = object(value);
      return typeof bucket.remainingFraction === "number" ? [percent(text(bucket.modelId) ?? "Model", 100 * (1 - bucket.remainingFraction), bucket.resetTime)] : [];
    });
    if (quotas.length === 0 && root.models && typeof root.models === "object") for (const [name, value] of Object.entries(object(root.models))) {
      const info = object(object(value).quotaInfo);
      if (typeof info.remainingFraction === "number") quotas.push(percent(name, 100 * (1 - info.remainingFraction), info.resetTime));
    }
    const summary = object(root.quotaSummary);
    const nestedSummary = object(summary.quotaSummary);
    const groupValues = summary.groups ?? nestedSummary.groups;
    const groups = Array.isArray(groupValues) ? groupValues : [];
    for (const value of groups) {
      const group = object(value); const family = text(group.displayName) ?? "Quota";
      for (const bucketValue of Array.isArray(group.buckets) ? group.buckets : []) {
        const bucket = object(bucketValue); const window = text(bucket.window) ?? text(bucket.bucketId) ?? "";
        if (!/weekly|5h|daily/i.test(window) || bucket.disabled === true || typeof bucket.remainingFraction !== "number") continue;
        const label = /weekly/i.test(window) ? "Weekly" : "Session (5h)";
        quotas.push(percent(`${family} ${label}`, 100 * (1 - bucket.remainingFraction), bucket.resetTime));
      }
    }
    return { plan, quotas, message: quotas.length ? null : `${plan} returned no quota windows.` };
  }

  private kiroQuota(root: Json): Pick<QuotaView, "plan" | "quotas" | "message"> {
    const reset = root.nextDateReset ?? root.resetDate;
    const quotas = (Array.isArray(root.usageBreakdownList) ? root.usageBreakdownList : []).flatMap((value) => {
      const row = object(value); const total = number(row.usageLimitWithPrecision, NaN); const used = number(row.currentUsageWithPrecision, NaN);
      const label = text(row.resourceType) ?? "Requests";
      const result = Number.isFinite(total) && Number.isFinite(used) ? [quota(label, used, total, reset)] : [];
      const free = object(row.freeTrialInfo); const freeTotal = number(free.usageLimitWithPrecision, NaN); const freeUsed = number(free.currentUsageWithPrecision, NaN);
      if (Number.isFinite(freeTotal) && Number.isFinite(freeUsed)) result.push(quota(`${label} free trial`, freeUsed, freeTotal, free.freeTrialExpiry ?? reset));
      return result;
    });
    return { plan: "Kiro", quotas, message: quotas.length ? null : "Kiro did not report quota windows." };
  }

  private creditQuota(root: Json, provider: string): Pick<QuotaView, "plan" | "quotas" | "message"> {
    if (provider === "commandcode") {
      const credits = object(root.credits); const win = object(credits.windowLimits); const subscription = object(root.subscription);
      const planId = text(subscription.planId); const caps: Record<string, number> = { "individual-go": 10, "individual-goat": 70, "individual-pro": 30, "individual-pro-v1": 80, "individual-provider": 15, "individual-max": 150, "individual-ultra": 300, "teams-pro": 40 };
      const remaining = number(credits.monthlyCredits) + number(credits.purchasedCredits) + number(credits.freeCredits);
      const cap = planId ? caps[planId] ?? 0 : 0; const quotas: QuotaLine[] = [quota("Credits", cap > 0 ? Math.max(0, cap - remaining) : 0, cap > 0 ? cap : remaining, subscription.currentPeriodEnd, cap <= 0)];
      for (const [key, label] of [["fiveHour", "Session (5h)"], ["weekly", "Weekly"]] as const) { const row = object(win[key]); const total = number(row.cap, NaN); const used = number(row.used, NaN); if (Number.isFinite(total) && Number.isFinite(used)) quotas.push(quota(label, used, total, row.resetAt)); }
      return { plan: planId ?? "CommandCode", quotas, message: null };
    }
    const config = object(root.config); const user = object(root.user);
    const balance = number(config.prepaidBalance ?? config.onDemandCap ?? root.balance ?? root.credits ?? object(root.data).balance, NaN);
    const quotas: QuotaLine[] = [];
    const cap = number(config.onDemandCap, NaN); const spent = number(config.onDemandUsed, NaN);
    if (Number.isFinite(cap) && cap > 0) quotas.push(quota("On-demand", Number.isFinite(spent) ? spent : 0, cap, config.billingPeriodEnd ?? object(config.currentPeriod).end));
    if (Number.isFinite(balance) && balance > 0) quotas.push(quota("Credits", 0, balance));
    const usedPercent = number(config.creditUsagePercent, NaN);
    if (Number.isFinite(usedPercent)) quotas.push(percent("Weekly", usedPercent, object(config.currentPeriod).end));
    return { plan: text(user.subscriptionTier) ?? (provider === "grok-cli" ? "Grok CLI" : "CommandCode"), quotas, message: quotas.length ? null : `${provider} returned no credit balance.` };
  }

  private remember(value: QuotaView): QuotaView {
    if (!this.cache.has(value.connectionId) && this.cache.size >= MAX_CACHE) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(value.connectionId, { value, expiresAt: Date.now() + CACHE_MS });
    return value;
  }
}
