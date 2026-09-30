import { Inject, Injectable } from "@nestjs/common";
import { and, desc, gte, lte, sql, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { usageDaily, usageEvents, type DatabaseHandle } from "@aigate/database";
import { DATABASE } from "../../../database.provider.js";
import type { UsageRange } from "../domain/usage.js";

// docs/contracts/usage.md "Dashboard API": every figure is a GROUP BY in SQLite; hourly periods read events, longer ones
// the daily rollup (usage.stats-query-dual-path, usage.chart-data-buckets). Nothing loads rows to sum them in JS.

export interface Counters {
  requests: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  cost: number;
  unpriced: number;
}
export type Dimension = "provider" | "model" | "account" | "apiKey" | "endpoint";
export interface GroupRow extends Counters { provider: string | null; model: string | null; connectionId: string | null; apiKeyId: string | null; endpoint: string | null }
export interface ChartRow { bucket: string; provider: string; requests: number; tokens: number; cost: number }

export const MAX_BREAKDOWN = 200;
export const MAX_EXPORT = 5_000;
const MAX_CHART_ROWS = 50_000;
const HOUR_MS = 3_600_000;

const total = (expr: SQL) => sql<number>`coalesce(${expr}, 0)`.mapWith(Number);
const sum = (column: SQLiteColumn) => total(sql`sum(${column})`);

type Columns = { provider: SQLiteColumn; model: SQLiteColumn; connectionId: SQLiteColumn; apiKeyId: SQLiteColumn; endpoint: SQLiteColumn };
interface Source {
  readonly table: typeof usageEvents | typeof usageDaily;
  readonly where: SQL | undefined;
  readonly columns: Columns;
  readonly counters: Record<keyof Counters, SQL<number>>;
  readonly tokens: SQL<number>;
}

const events = usageEvents;
const daily = usageDaily;
function sourceOf(range: UsageRange): Source {
  if (range.bucket === "hour") {
    return {
      table: events,
      where: and(gte(events.at, new Date(range.fromMs)), lte(events.at, new Date(range.toMs))),
      columns: { provider: events.provider, model: events.model, connectionId: events.connectionId, apiKeyId: events.apiKeyId, endpoint: events.endpoint },
      counters: {
        requests: sql<number>`count(*)`.mapWith(Number),
        errors: total(sql`sum(case when ${events.status} <> 'success' then 1 else 0 end)`),
        inputTokens: sum(events.inputTokens), outputTokens: sum(events.outputTokens), cacheReadTokens: sum(events.cacheReadTokens),
        cacheWriteTokens: sum(events.cacheWriteTokens), reasoningTokens: sum(events.reasoningTokens), cost: sum(events.cost),
        unpriced: total(sql`sum(case when ${events.cost} is null then 1 else 0 end)`),
      },
      tokens: total(sql`sum(${events.inputTokens} + ${events.outputTokens} + ${events.cacheReadTokens} + ${events.cacheWriteTokens})`),
    };
  }
  return {
    table: daily,
    where: and(gte(daily.day, range.fromDay), lte(daily.day, range.toDay)),
    columns: { provider: daily.provider, model: daily.model, connectionId: daily.connectionId, apiKeyId: daily.apiKeyId, endpoint: daily.endpoint },
    counters: {
      requests: sum(daily.requests), errors: sum(daily.errors), inputTokens: sum(daily.inputTokens), outputTokens: sum(daily.outputTokens),
      cacheReadTokens: sum(daily.cacheReadTokens), cacheWriteTokens: sum(daily.cacheWriteTokens), reasoningTokens: sum(daily.reasoningTokens),
      cost: sum(daily.cost), unpriced: sum(daily.unpriced),
    },
    tokens: total(sql`sum(${daily.inputTokens} + ${daily.outputTokens} + ${daily.cacheReadTokens} + ${daily.cacheWriteTokens})`),
  };
}

const DIMENSIONS: Record<Dimension, readonly (keyof Columns)[]> = {
  provider: ["provider"], model: ["provider", "model"], account: ["provider", "connectionId"], apiKey: ["apiKeyId"], endpoint: ["endpoint"],
};
// "" is the rollup's stand-in for no connection or key; events store null.
const blankToNull = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

@Injectable()
export class UsageRepository {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  async totals(range: UsageRange): Promise<Counters> {
    const source = sourceOf(range);
    const row = await this.database.db.select(source.counters).from(source.table).where(source.where).get();
    return row ?? { requests: 0, errors: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, cost: 0, unpriced: 0 };
  }

  async breakdown(range: UsageRange, dimension: Dimension, limit = MAX_BREAKDOWN): Promise<GroupRow[]> {
    const source = sourceOf(range);
    const keys = DIMENSIONS[dimension];
    const picked = Object.fromEntries(keys.map((key) => [key, source.columns[key]]));
    const rows = await this.database.db.select({ ...picked, ...source.counters }).from(source.table).where(source.where)
      .groupBy(...keys.map((key) => source.columns[key])).orderBy(desc(source.counters.requests)).limit(limit);
    return rows.map((row) => {
      const record: Record<string, unknown> = row;
      return {
        provider: blankToNull(record.provider), model: blankToNull(record.model), connectionId: blankToNull(record.connectionId),
        apiKeyId: blankToNull(record.apiKeyId), endpoint: blankToNull(record.endpoint),
        requests: row.requests, errors: row.errors, inputTokens: row.inputTokens, outputTokens: row.outputTokens, cacheReadTokens: row.cacheReadTokens,
        cacheWriteTokens: row.cacheWriteTokens, reasoningTokens: row.reasoningTokens, cost: row.cost, unpriced: row.unpriced,
      };
    });
  }

  // Hourly buckets count from the start of the range (a local midnight for today), so offsets and DST need no SQL.
  async chart(range: UsageRange): Promise<ChartRow[]> {
    const source = sourceOf(range);
    const bucket = range.bucket === "hour"
      ? sql<string>`cast((${events.at} - ${range.fromMs}) / ${HOUR_MS} as integer)`.mapWith(String)
      : sql<string>`${daily.day}`.mapWith(String);
    return this.database.db.select({ bucket, provider: source.columns.provider, requests: source.counters.requests, tokens: source.tokens, cost: source.counters.cost })
      .from(source.table).where(source.where).groupBy(bucket, source.columns.provider).limit(MAX_CHART_ROWS);
  }
}
