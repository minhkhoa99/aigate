import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { lt, sql, type AnyColumn } from "drizzle-orm";
import { usageDaily, usageEvents, usageRequests, type DatabaseHandle, type UsageStatus } from "@aigate/database";
import { costOf, type TokenUsage } from "@aigate/engine";
import { DATABASE } from "../../../database.provider.js";
import { addDays, dayKey } from "../domain/usage.js";
import { PricingRepository } from "./pricing.repo.js";

// docs/contracts/usage.md "Writer" (schema rule 11): recording is synchronous and in memory; the database sees batches.

export const USAGE_CONFIG = Symbol("USAGE_CONFIG");
export interface UsageConfig {
  // AIGATE_USAGE_TIMEZONE, checked at startup.
  readonly timezone: string;
  // AIGATE_USAGE_RETENTION_DAYS for usage_events.
  readonly retentionDays: number;
  readonly flushIntervalMs: number;
}
export const DEFAULT_RETENTION_DAYS = 90;
export const DAILY_RETENTION_DAYS = 400;
const MAX_QUEUE = 10_000;
const FLUSH_AT = 200;
const WRITE_BATCH = 1_000;
// SQLite binds at most 999 variables per statement: 19 event columns × 50 rows.
const ROWS_PER_INSERT = 50;
const RING = 50;
const WATCHDOG_MS = 60_000;
const PRUNE_EVERY_MS = 3_600_000;
const DAY_MS = 86_400_000;

// Who made the call; one per upstream call of a client request.
export interface UsageCall {
  readonly requestId: string;
  readonly provider: string;
  readonly model: string;
  readonly connectionId: string | null;
  readonly apiKeyId: string | null;
  readonly endpoint: string;
}
export interface UsageOutcome {
  readonly status: UsageStatus;
  readonly errorCode: string | null;
  readonly usage: TokenUsage;
  readonly estimated: boolean;
  readonly latencyMs: number;
  readonly ttftMs: number | null;
}
export interface RecentEvent {
  at: number;
  requestId: string;
  provider: string;
  model: string;
  connectionId: string | null;
  status: UsageStatus;
  errorCode: string | null;
  inputTokens: number;
  outputTokens: number;
  cost: number | null;
  estimated: boolean;
  latencyMs: number;
  ttftMs: number | null;
}
// SP24b: how a client request ended, recorded once when its handler finishes.
export interface RequestOutcome {
  readonly requestId: string;
  readonly startedAt: number;
  readonly endpoint: string;
  readonly requestedModel: string | null;
  readonly apiKeyId: string | null;
  readonly stream: boolean;
  readonly httpStatus: number;
  readonly errorCode: string | null;
  // The client closed the connection before the answer ended.
  readonly clientGone: boolean;
}
interface RequestTally {
  attempts: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; reasoningTokens: number;
  cost: number; priced: number; unpriced: number;
  last?: { provider: string; model: string; connectionId: string | null; status: UsageStatus; errorCode: string | null; ttftMs: number | null };
}

export interface ActiveCount { provider: string; model: string; connectionId: string | null; count: number }
export interface WriterState { queued: number; dropped: number; failed: number }

type EventRow = typeof usageEvents.$inferInsert & { at: Date; cost: number | null };
type RequestRow = typeof usageRequests.$inferInsert;
// Requests in flight whose attempts are being tallied; the oldest is forgotten past this (a handler that never finished).
const MAX_OPEN_REQUESTS = 10_000;
// 22 request columns x 40 rows stays under SQLite's 999 bound variables.
const REQUESTS_PER_INSERT = 40;
interface DailyRow {
  day: string; provider: string; model: string; connectionId: string; apiKeyId: string; endpoint: string;
  requests: number; errors: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; reasoningTokens: number; cost: number; unpriced: number;
}

const emptyTally = (): RequestTally => ({ attempts: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, cost: 0, priced: 0, unpriced: 0 });

// ON CONFLICT: the stored counter plus the batch's.
const add = (column: AnyColumn) => sql`${column} + excluded.${sql.identifier(column.name)}`;

@Injectable()
export class UsageRecorder implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("UsageRecorder");
  private readonly queue: EventRow[] = [];
  private readonly requests: RequestRow[] = [];
  private readonly open = new Map<string, RequestTally>();
  private readonly keys = new WeakMap<object, string>();
  private dropped = 0;
  private failed = 0;
  private readonly ring: RecentEvent[] = [];
  private readonly active = new Map<string, ActiveCount & { timer: NodeJS.Timeout }>();
  private readonly changes = new EventEmitter();
  private flushing: Promise<void> | undefined;
  private timer: NodeJS.Timeout | undefined;
  private lastPrune = 0;

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    private readonly pricing: PricingRepository,
    @Inject(USAGE_CONFIG) readonly config: UsageConfig,
  ) {
    // One listener per dashboard stream; the controller caps the streams.
    this.changes.setMaxListeners(64);
  }

  onModuleInit(): void {
    this.timer = setInterval(() => void this.flush(), this.config.flushIntervalMs);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.flush();
  }

  // Never throws and never awaits: a failure here must not reach the client's answer.
  record(call: UsageCall, outcome: UsageOutcome, at = Date.now()): void {
    try {
      const { price } = this.pricing.price(call.provider, call.model);
      const { usage } = outcome;
      const cost = price ? costOf(usage, price) : null;
      this.queue.push({
        id: randomUUID(), at: new Date(at), ...call, status: outcome.status, errorCode: outcome.errorCode,
        inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cacheReadTokens: usage.cacheReadTokens ?? 0, cacheWriteTokens: usage.cacheWriteTokens ?? 0,
        reasoningTokens: usage.reasoningTokens ?? 0, estimated: outcome.estimated, cost, latencyMs: outcome.latencyMs, ttftMs: outcome.ttftMs,
      });
      if (this.queue.length > MAX_QUEUE) {
        this.queue.shift();
        this.dropped += 1;
      }
      this.ring.push({
        at, requestId: call.requestId, provider: call.provider, model: call.model, connectionId: call.connectionId, status: outcome.status, errorCode: outcome.errorCode,
        inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cost, estimated: outcome.estimated, latencyMs: outcome.latencyMs, ttftMs: outcome.ttftMs,
      });
      if (this.ring.length > RING) this.ring.shift();
      this.tally(call, outcome, cost);
      if (this.queue.length >= FLUSH_AT) void this.flush();
    } catch (error) {
      this.dropped += 1;
      this.logger.error("usage event not recorded", error instanceof Error ? error.stack : String(error));
    }
  }

  // The request row (docs/contracts/usage.md "Requests"): its attempts' totals and the last attempt. Never throws.
  finish(outcome: RequestOutcome, at = Date.now()): void {
    try {
      const tally = this.open.get(outcome.requestId) ?? emptyTally();
      this.open.delete(outcome.requestId);
      const { last } = tally;
      const status: UsageStatus = outcome.clientGone ? "aborted" : outcome.httpStatus >= 400 ? "error" : last?.status === "aborted" ? "aborted" : "success";
      this.requests.push({
        id: outcome.requestId, at: new Date(outcome.startedAt), endpoint: outcome.endpoint, requestedModel: outcome.requestedModel, apiKeyId: outcome.apiKeyId, stream: outcome.stream,
        status, httpStatus: outcome.httpStatus, errorCode: status === "success" ? null : outcome.errorCode ?? last?.errorCode ?? (outcome.clientGone ? "CLIENT_CLOSED" : null),
        attempts: tally.attempts, finalProvider: last?.provider ?? null, finalModel: last?.model ?? null, finalConnectionId: last?.connectionId ?? null,
        inputTokens: tally.inputTokens, outputTokens: tally.outputTokens, cacheReadTokens: tally.cacheReadTokens, cacheWriteTokens: tally.cacheWriteTokens, reasoningTokens: tally.reasoningTokens,
        cost: tally.priced > 0 ? tally.cost : null, unpriced: tally.unpriced, latencyMs: Math.max(0, at - outcome.startedAt), ttftMs: last?.ttftMs ?? null,
      });
      if (this.requests.length > MAX_QUEUE) {
        this.requests.shift();
        this.dropped += 1;
      }
      if (this.requests.length >= FLUSH_AT) void this.flush();
    } catch (error) {
      this.dropped += 1;
      this.logger.error("request row not recorded", error instanceof Error ? error.stack : String(error));
    }
  }

  // usage.pending-request-orphan-timeout: a live count per provider, model, and connection; the returned end is idempotent.
  begin(call: UsageCall): () => void {
    const id = `${call.provider}\u0000${call.model}\u0000${call.connectionId ?? ""}`;
    const entry = this.active.get(id);
    if (entry) {
      entry.count += 1;
      entry.timer.refresh();
    } else {
      const timer = setTimeout(() => { this.active.delete(id); this.changed(); }, WATCHDOG_MS);
      timer.unref();
      this.active.set(id, { provider: call.provider, model: call.model, connectionId: call.connectionId, count: 1, timer });
    }
    this.changed();
    let ended = false;
    return () => {
      if (ended) return;
      ended = true;
      const current = this.active.get(id);
      if (!current) return;
      current.count -= 1;
      if (current.count <= 0) {
        clearTimeout(current.timer);
        this.active.delete(id);
      }
      this.changed();
    };
  }

  live(): { active: ActiveCount[]; recent: RecentEvent[]; writer: WriterState } {
    return {
      active: [...this.active.values()].map(({ provider, model, connectionId, count }) => ({ provider, model, connectionId, count })),
      recent: this.ring.slice(-20).reverse(),
      writer: this.writer(),
    };
  }

  writer(): WriterState {
    return { queued: this.queue.length + this.requests.length, dropped: this.dropped, failed: this.failed };
  }

  // The AIGate key the /v1 gate accepted for a request, so every lane can attribute its usage.
  attribute(request: object, apiKeyId: string): void {
    this.keys.set(request, apiKeyId);
  }

  keyOf(request: object): string | null {
    return this.keys.get(request) ?? null;
  }

  onChange(listener: () => void): () => void {
    this.changes.on("change", listener);
    return () => this.changes.off("change", listener);
  }

  flush(): Promise<void> {
    this.flushing ??= this.drain().finally(() => { this.flushing = undefined; });
    return this.flushing;
  }

  // Retention (schema rule 10): events after retentionDays, daily rows after 400 days.
  async prune(now = Date.now()): Promise<void> {
    this.lastPrune = now;
    await this.database.db.delete(usageEvents).where(lt(usageEvents.at, new Date(now - this.config.retentionDays * DAY_MS)));
    await this.database.db.delete(usageRequests).where(lt(usageRequests.at, new Date(now - this.config.retentionDays * DAY_MS)));
    await this.database.db.delete(usageDaily).where(lt(usageDaily.day, addDays(dayKey(now, this.config.timezone), -DAILY_RETENTION_DAYS)));
  }

  private async drain(): Promise<void> {
    let wrote = false;
    // eslint-disable-next-line aigate/retry-through-helper -- each pass writes the next batch; a failed batch is counted, not retried.
    while (this.queue.length > 0 || this.requests.length > 0) {
      const batch = this.queue.splice(0, WRITE_BATCH);
      const requests = this.requests.splice(0, WRITE_BATCH);
      try {
        await this.write(batch, requests);
        wrote = true;
      } catch (error) {
        this.failed += 1;
        this.logger.error(`usage batch of ${batch.length} events and ${requests.length} requests not written`, error instanceof Error ? error.stack : String(error));
      }
    }
    if (Date.now() - this.lastPrune >= PRUNE_EVERY_MS) {
      await this.prune().catch((error: unknown) => this.logger.error("usage prune failed", error instanceof Error ? error.stack : String(error)));
    }
    if (wrote) this.changed();
  }

  private async write(batch: readonly EventRow[], requests: readonly RequestRow[]): Promise<void> {
    const daily = new Map<string, DailyRow>();
    for (const event of batch) {
      const day = dayKey(event.at.getTime(), this.config.timezone);
      const connectionId = event.connectionId ?? "";
      const apiKeyId = event.apiKeyId ?? "";
      const id = [day, event.provider, event.model, connectionId, apiKeyId, event.endpoint].join("\u0000");
      const row = daily.get(id) ?? {
        day, provider: event.provider, model: event.model, connectionId, apiKeyId, endpoint: event.endpoint,
        requests: 0, errors: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, cost: 0, unpriced: 0,
      };
      row.requests += 1;
      if (event.status !== "success") row.errors += 1;
      row.inputTokens += event.inputTokens;
      row.outputTokens += event.outputTokens;
      row.cacheReadTokens += event.cacheReadTokens ?? 0;
      row.cacheWriteTokens += event.cacheWriteTokens ?? 0;
      row.reasoningTokens += event.reasoningTokens ?? 0;
      if (event.cost === null) row.unpriced += 1;
      else row.cost += event.cost;
      daily.set(id, row);
    }
    const rows = [...daily.values()];
    await this.database.db.transaction(async (tx) => {
      for (let start = 0; start < batch.length; start += ROWS_PER_INSERT) await tx.insert(usageEvents).values(batch.slice(start, start + ROWS_PER_INSERT));
      for (let start = 0; start < requests.length; start += REQUESTS_PER_INSERT) {
        await tx.insert(usageRequests).values(requests.slice(start, start + REQUESTS_PER_INSERT)).onConflictDoNothing();
      }
      for (let start = 0; start < rows.length; start += ROWS_PER_INSERT) {
        await tx.insert(usageDaily).values(rows.slice(start, start + ROWS_PER_INSERT)).onConflictDoUpdate({
          target: [usageDaily.day, usageDaily.provider, usageDaily.model, usageDaily.connectionId, usageDaily.apiKeyId, usageDaily.endpoint],
          set: {
            requests: add(usageDaily.requests), errors: add(usageDaily.errors), inputTokens: add(usageDaily.inputTokens), outputTokens: add(usageDaily.outputTokens),
            cacheReadTokens: add(usageDaily.cacheReadTokens), cacheWriteTokens: add(usageDaily.cacheWriteTokens), reasoningTokens: add(usageDaily.reasoningTokens),
            cost: add(usageDaily.cost), unpriced: add(usageDaily.unpriced),
          },
        });
      }
    });
  }

  private tally(call: UsageCall, outcome: UsageOutcome, cost: number | null): void {
    let tally = this.open.get(call.requestId);
    if (!tally) {
      tally = emptyTally();
      this.open.set(call.requestId, tally);
      for (const oldest of this.open.keys()) {
        if (this.open.size <= MAX_OPEN_REQUESTS) break;
        this.open.delete(oldest);
      }
    }
    const { usage } = outcome;
    tally.attempts += 1;
    tally.inputTokens += usage.inputTokens;
    tally.outputTokens += usage.outputTokens;
    tally.cacheReadTokens += usage.cacheReadTokens ?? 0;
    tally.cacheWriteTokens += usage.cacheWriteTokens ?? 0;
    tally.reasoningTokens += usage.reasoningTokens ?? 0;
    if (cost === null) tally.unpriced += 1;
    else {
      tally.cost += cost;
      tally.priced += 1;
    }
    tally.last = { provider: call.provider, model: call.model, connectionId: call.connectionId, status: outcome.status, errorCode: outcome.errorCode, ttftMs: outcome.ttftMs };
  }

  private changed(): void {
    this.changes.emit("change");
  }
}
