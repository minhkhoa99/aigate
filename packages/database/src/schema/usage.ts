import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const USAGE_STATUSES = ["success", "error", "aborted"] as const;
export type UsageStatus = (typeof USAGE_STATUSES)[number];

// docs/contracts/usage.md. One row per upstream call (schema rule 5: no dedup). Connection and API key ids are data, not
// foreign keys: either may be deleted between the call and the buffered flush, and a failing key would drop the batch.
export const usageEvents = sqliteTable("usage_events", {
  id: text("id").primaryKey(),
  at: integer("at", { mode: "timestamp_ms" }).notNull(),
  requestId: text("request_id").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  connectionId: text("connection_id"),
  apiKeyId: text("api_key_id"),
  endpoint: text("endpoint").notNull(),
  status: text("status", { enum: USAGE_STATUSES }).notNull(),
  errorCode: text("error_code"),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  cacheReadTokens: integer("cache_read_tokens").notNull(),
  cacheWriteTokens: integer("cache_write_tokens").notNull(),
  reasoningTokens: integer("reasoning_tokens").notNull(),
  estimated: integer("estimated", { mode: "boolean" }).notNull().default(false),
  // USD; null when the model has no price.
  cost: real("cost"),
  latencyMs: integer("latency_ms").notNull(),
  ttftMs: integer("ttft_ms"),
}, (t) => [index("usage_events_at").on(t.at), index("usage_events_request").on(t.requestId)]);

// SP24b: one row per client request, metadata only (no body); its attempts are the usage_events rows with its id.
export const usageRequests = sqliteTable("usage_requests", {
  id: text("id").primaryKey(),
  at: integer("at", { mode: "timestamp_ms" }).notNull(),
  endpoint: text("endpoint").notNull(),
  requestedModel: text("requested_model"),
  apiKeyId: text("api_key_id"),
  stream: integer("stream", { mode: "boolean" }).notNull().default(false),
  status: text("status", { enum: USAGE_STATUSES }).notNull(),
  httpStatus: integer("http_status").notNull(),
  errorCode: text("error_code"),
  attempts: integer("attempts").notNull(),
  finalProvider: text("final_provider"),
  finalModel: text("final_model"),
  finalConnectionId: text("final_connection_id"),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  cacheReadTokens: integer("cache_read_tokens").notNull(),
  cacheWriteTokens: integer("cache_write_tokens").notNull(),
  reasoningTokens: integer("reasoning_tokens").notNull(),
  cost: real("cost"),
  unpriced: integer("unpriced").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  ttftMs: integer("ttft_ms"),
}, (t) => [index("usage_requests_at").on(t.at, t.id), index("usage_requests_status_at").on(t.status, t.at)]);

// The per-day rollup the long periods read. "" stands for no connection or no key, so the composite key matches on
// upsert (SQLite treats NULLs as distinct). `day` is YYYY-MM-DD in AIGATE_USAGE_TIMEZONE (schema rule 2).
export const usageDaily = sqliteTable("usage_daily", {
  day: text("day").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  connectionId: text("connection_id").notNull().default(""),
  apiKeyId: text("api_key_id").notNull().default(""),
  endpoint: text("endpoint").notNull(),
  requests: integer("requests").notNull(),
  errors: integer("errors").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  cacheReadTokens: integer("cache_read_tokens").notNull(),
  cacheWriteTokens: integer("cache_write_tokens").notNull(),
  reasoningTokens: integer("reasoning_tokens").notNull(),
  cost: real("cost").notNull(),
  unpriced: integer("unpriced").notNull(),
}, (t) => [primaryKey({ columns: [t.day, t.provider, t.model, t.connectionId, t.apiKeyId, t.endpoint] })]);

// pricing.crud-api: the user's rates (USD per 1M tokens) over the built-in table; a null field keeps the built-in rate.
export const pricingOverrides = sqliteTable("pricing_overrides", {
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  input: real("input"),
  output: real("output"),
  cached: real("cached"),
  reasoning: real("reasoning"),
  cacheCreation: real("cache_creation"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (t) => [primaryKey({ columns: [t.provider, t.model] })]);
