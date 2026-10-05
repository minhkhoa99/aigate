import { BadRequestException, Controller, Get, Header, Query, Res, ServiceUnavailableException, type OnModuleDestroy } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { addDays, csvField, InvalidPeriod, parsePeriod, startOfDay, type UsageRange } from "../domain/usage.js";
import { DisplayNames } from "./display-names.js";
import { UsageRecorder } from "./usage-recorder.js";
import { MAX_EXPORT, UsageRepository, type Counters, type GroupRow } from "./usage.repo.js";

// docs/contracts/usage.md "Dashboard API". Protected by the global dashboard guard.

const MAX_STREAMS = 16;
const PUSH_DEBOUNCE_MS = 250;
const PING_MS = 25_000;
// A dashboard tab that stops reading is dropped rather than buffered without end.
const MAX_STREAM_BUFFER = 1024 * 1024;
const HOUR_MS = 3_600_000;

type Query = { period?: string; from?: string; to?: string };
const counters = (row: Counters): Counters => ({
  requests: row.requests, errors: row.errors, inputTokens: row.inputTokens, outputTokens: row.outputTokens, cacheReadTokens: row.cacheReadTokens,
  cacheWriteTokens: row.cacheWriteTokens, reasoningTokens: row.reasoningTokens, cost: row.cost, unpriced: row.unpriced,
});
interface Bucket { start: number; day?: string; requests: number; cost: number; tokens: Record<string, number> }

@Controller("api/usage")
export class UsageController implements OnModuleDestroy {
  private readonly streams = new Set<FastifyReply["raw"]>();

  constructor(
    private readonly usage: UsageRepository,
    private readonly recorder: UsageRecorder,
    private readonly displayNames: DisplayNames,
  ) {}

  onModuleDestroy(): void {
    for (const raw of this.streams) raw.destroy();
  }

  @Get("summary")
  @Header("Cache-Control", "no-store")
  async summary(@Query() query: Query) {
    const range = this.range(query);
    const names = await this.displayNames.load();
    const totals = await this.usage.totals(range);
    const byProvider = await this.usage.breakdown(range, "provider");
    const byModel = await this.usage.breakdown(range, "model");
    const byAccount = await this.usage.breakdown(range, "account");
    const byApiKey = await this.usage.breakdown(range, "apiKey");
    const byEndpoint = await this.usage.breakdown(range, "endpoint");
    const provider = (row: GroupRow) => ({ provider: row.provider, providerName: names.provider(row.provider) });
    return {
      timezone: this.recorder.config.timezone, ...range, totals: counters(totals),
      byProvider: byProvider.map((row) => ({ ...provider(row), ...counters(row) })),
      byModel: byModel.map((row) => ({ ...provider(row), model: row.model, ...counters(row) })),
      byAccount: byAccount.map((row) => ({ ...provider(row), connectionId: row.connectionId, name: names.connection(row.connectionId), ...counters(row) })),
      byApiKey: byApiKey.map((row) => ({ apiKeyId: row.apiKeyId, name: names.key(row.apiKeyId), ...counters(row) })),
      byEndpoint: byEndpoint.map((row) => ({ endpoint: row.endpoint, ...counters(row) })),
      writer: this.recorder.writer(),
    };
  }

  @Get("chart")
  @Header("Cache-Control", "no-store")
  async chart(@Query() query: Query) {
    const range = this.range(query);
    const rows = await this.usage.chart(range);
    const timezone = this.recorder.config.timezone;
    const buckets = new Map<string, Bucket>();
    if (range.bucket === "hour") {
      for (let index = 0; index * HOUR_MS < range.toMs - range.fromMs; index += 1) buckets.set(String(index), { start: range.fromMs + index * HOUR_MS, requests: 0, cost: 0, tokens: {} });
    } else {
      for (let day = range.fromDay; day <= range.toDay; day = addDays(day, 1)) buckets.set(day, { start: startOfDay(day, timezone), day, requests: 0, cost: 0, tokens: {} });
    }
    for (const row of rows) {
      const bucket = buckets.get(row.bucket);
      if (!bucket) continue;
      bucket.requests += row.requests;
      bucket.cost += row.cost;
      bucket.tokens[row.provider] = (bucket.tokens[row.provider] ?? 0) + row.tokens;
    }
    return { timezone, bucket: range.bucket, buckets: [...buckets.values()] };
  }

  @Get("export.csv")
  async export(@Query() query: Query, @Res({ passthrough: true }) reply: FastifyReply): Promise<string> {
    const range = this.range(query);
    const names = await this.displayNames.load();
    const rows = await this.usage.breakdown(range, "model", MAX_EXPORT);
    const header = ["provider", "provider_name", "model", "requests", "errors", "input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens", "reasoning_tokens", "cost_usd", "unpriced"];
    const lines = rows.map((row) => [row.provider, names.provider(row.provider), row.model, row.requests, row.errors, row.inputTokens, row.outputTokens, row.cacheReadTokens,
      row.cacheWriteTokens, row.reasoningTokens, row.cost.toFixed(6), row.unpriced].map(csvField).join(","));
    const label = range.bucket === "day" ? `${range.fromDay}_${range.toDay}` : range.period;
    reply.header("Cache-Control", "no-store").header("Content-Type", "text/csv; charset=utf-8").header("Content-Disposition", `attachment; filename="aigate-usage-${label}.csv"`);
    return [header.join(","), ...lines].join("\r\n") + "\r\n";
  }

  // usage.sse-live-stream: the live counts on connect, then after changes (debounced), with a keepalive comment.
  @Get("stream")
  stream(@Res() reply: FastifyReply): void {
    if (this.streams.size >= MAX_STREAMS) throw new ServiceUnavailableException({ code: "USAGE_STREAM_BUSY", message: `${MAX_STREAMS} live usage views are already open. Close another dashboard tab and reload.` });
    reply.hijack();
    const raw = reply.raw;
    this.streams.add(raw);
    raw.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache", "x-accel-buffering": "no" });
    let pending: NodeJS.Timeout | undefined;
    const write = (text: string) => {
      if (raw.writableLength > MAX_STREAM_BUFFER) raw.destroy();
      else raw.write(text);
    };
    const send = () => write(`data: ${JSON.stringify({ ...this.recorder.live(), flushedAt: Date.now() })}\n\n`);
    const off = this.recorder.onChange(() => { pending ??= setTimeout(() => { pending = undefined; send(); }, PUSH_DEBOUNCE_MS); });
    const ping = setInterval(() => write(": ping\n\n"), PING_MS);
    raw.once("close", () => {
      this.streams.delete(raw);
      off();
      clearInterval(ping);
      clearTimeout(pending);
    });
    send();
  }

  private range(query: Query): UsageRange {
    try {
      return parsePeriod(query, Date.now(), this.recorder.config.timezone);
    } catch (error) {
      if (error instanceof InvalidPeriod) throw new BadRequestException({ code: "INVALID_REQUEST", message: error.message });
      throw error;
    }
  }
}
