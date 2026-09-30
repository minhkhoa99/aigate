import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, gt, gte, inArray, lt, lte, or, type SQL } from "drizzle-orm";
import { usageDaily, usageEvents, usageRequests, type DatabaseHandle } from "@aigate/database";
import { DATABASE } from "../../../database.provider.js";

// docs/contracts/usage.md "Requests": newest first by (at, id), so a cursor pages without gaps or repeats.

export interface RequestFilter {
  readonly errorsOnly: boolean;
  readonly provider?: string;
  readonly model?: string;
  readonly endpoint?: string;
  readonly fallback: boolean;
  readonly fromMs?: number;
  readonly toMs?: number;
  readonly before?: { readonly at: number; readonly id: string };
}

export const MAX_ATTEMPTS_SHOWN = 200;
const MAX_FILTER_VALUES = 500;
const MAX_ENDPOINTS = 50;

const r = usageRequests;
const requestColumns = {
  id: r.id, at: r.at, endpoint: r.endpoint, requestedModel: r.requestedModel, apiKeyId: r.apiKeyId, stream: r.stream, status: r.status, httpStatus: r.httpStatus,
  errorCode: r.errorCode, attempts: r.attempts, finalProvider: r.finalProvider, finalModel: r.finalModel, finalConnectionId: r.finalConnectionId,
  inputTokens: r.inputTokens, outputTokens: r.outputTokens, cacheReadTokens: r.cacheReadTokens, cacheWriteTokens: r.cacheWriteTokens, reasoningTokens: r.reasoningTokens,
  cost: r.cost, unpriced: r.unpriced, latencyMs: r.latencyMs, ttftMs: r.ttftMs,
};
const e = usageEvents;
const attemptColumns = {
  id: e.id, at: e.at, provider: e.provider, model: e.model, connectionId: e.connectionId, status: e.status, errorCode: e.errorCode,
  inputTokens: e.inputTokens, outputTokens: e.outputTokens, cacheReadTokens: e.cacheReadTokens, cacheWriteTokens: e.cacheWriteTokens, reasoningTokens: e.reasoningTokens,
  estimated: e.estimated, cost: e.cost, latencyMs: e.latencyMs, ttftMs: e.ttftMs,
};

@Injectable()
export class RequestsRepository {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  // One row more than the page, so the caller knows whether another page exists.
  list(filter: RequestFilter, limit: number) {
    const conditions: (SQL | undefined)[] = [
      filter.errorsOnly ? inArray(r.status, ["error", "aborted"]) : undefined,
      filter.provider ? eq(r.finalProvider, filter.provider) : undefined,
      filter.model ? eq(r.finalModel, filter.model) : undefined,
      filter.endpoint ? eq(r.endpoint, filter.endpoint) : undefined,
      filter.fallback ? gt(r.attempts, 1) : undefined,
      filter.fromMs === undefined ? undefined : gte(r.at, new Date(filter.fromMs)),
      filter.toMs === undefined ? undefined : lte(r.at, new Date(filter.toMs)),
      filter.before ? or(lt(r.at, new Date(filter.before.at)), and(eq(r.at, new Date(filter.before.at)), lt(r.id, filter.before.id))) : undefined,
    ];
    return this.database.db.select(requestColumns).from(r).where(and(...conditions)).orderBy(desc(r.at), desc(r.id)).limit(limit + 1);
  }

  async detail(id: string) {
    const request = await this.database.db.select(requestColumns).from(r).where(eq(r.id, id)).get();
    if (!request) return undefined;
    const attempts = await this.database.db.select(attemptColumns).from(e).where(eq(e.requestId, id)).orderBy(asc(e.at), asc(e.id)).limit(MAX_ATTEMPTS_SHOWN);
    return { request, attempts };
  }

  // The filter lists come from the small daily rollup, not from scanning requests.
  async filters(sinceDay: string) {
    const recent = gte(usageDaily.day, sinceDay);
    const models = await this.database.db.selectDistinct({ provider: usageDaily.provider, model: usageDaily.model }).from(usageDaily).where(recent)
      .orderBy(asc(usageDaily.provider), asc(usageDaily.model)).limit(MAX_FILTER_VALUES);
    const endpoints = await this.database.db.selectDistinct({ endpoint: usageDaily.endpoint }).from(usageDaily).where(recent).orderBy(asc(usageDaily.endpoint)).limit(MAX_ENDPOINTS);
    return { models, endpoints: endpoints.map((row) => row.endpoint) };
  }
}
