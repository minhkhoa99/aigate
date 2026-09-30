# Usage contract (M2 SP24a, SP24b)

Per-call usage recording, cost from pricing, summaries, the live stream, the pricing editor (SP24a), and request detail with the media lanes (SP24b). Matrix: `docs/discovery/feature-matrix/08-usage-quota.yaml` (`usage.*`, `pricing.*`) and `routing.usage-recording-timing`. Vendor quota is SP24c.

## What is recorded

One **usage event** per upstream call the chat lane makes, on `/v1/chat/completions`, `/v1/messages`, `/v1/responses` (and its aliases), and `/v1beta/models/*` generate. Every combo member and every fusion panel or judge call is its own event. Fields:
- `requestId`: the id of the client request, shared by its attempts.
- `provider`, `model`: the resolved provider id (or custom provider id) and catalog model id.
- `connectionId`, `apiKeyId`: null for keyless providers and keyless mode.
- `endpoint`: the client route.
- `status`: one of:
  - `success`: the answer or the stream finished.
  - `error`: the call failed; `errorCode` holds the lane's code.
  - `aborted`: the stream errored, stalled, or lost its client after it started.
- Tokens, in AIGate's convention (inputTokens excludes cache reads and writes; outputTokens includes reasoning): `inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `reasoningTokens`.
- `estimated`: true when the upstream sent no usage. Input is then estimated from the request, and output as emitted characters / 4.
- `cost` in USD, or null when the model has no price.
- `latencyMs`, and `ttftMs` for streams (null otherwise).

Every event is its own row; nothing is deduplicated. An error with zero tokens still counts as a request and an error.

## Writer

`UsageRecorder` queues events in memory and writes them in batches:
- It flushes every 1 s, or as soon as 200 events are queued, in one transaction. The transaction inserts the events and adds them into `usage_daily`.
- At most 10 000 events are queued. When the queue is full the oldest event is dropped.
- It counts `dropped` events and `failed` flushes. A failed batch is dropped, not retried.
- It flushes once more on shutdown.
- Recording never awaits the database on the request path and never changes the client's answer.

Live state is in memory:
- Active calls per provider, model, and connection. A 60 s watchdog resets a count that never finished.
- A ring of the 50 most recent events.

## Days, periods, retention

- Days are cut in `AIGATE_USAGE_TIMEZONE` (IANA). The default is the server's zone at startup. Every response names the zone.
- Periods:
  - `today` and `24h` read `usage_events` in hourly buckets.
  - `7d`, `30d`, and `90d` read `usage_daily` in daily buckets.
  - `custom` with `from` and `to` (`YYYY-MM-DD`, inclusive, at most 400 days) reads `usage_daily` in daily buckets.
- Retention: events are kept `AIGATE_USAGE_RETENTION_DAYS` (default 90) and daily rows 400 days. Both are pruned hourly.

## Cost

The price of a provider and model is resolved in this order:
1. The user's override for (provider, model).
2. The built-in provider table.
3. The built-in model table, with any `vendor/` prefix stripped.
4. The first matching built-in pattern.
5. None.

An override's fields replace only the fields it sets. Rates are USD per 1M tokens:

```
cost = input × input + cacheRead × (cached ?? input) + cacheWrite × (cache_creation ?? input)
     + (output − reasoning) × output + reasoning × (reasoning ?? output)
```

## Dashboard API (session)

| Method | Path | Answer |
|---|---|---|
| GET | `/api/usage/summary?period=&from=&to=` | `{ timezone, period, from, to, totals, byProvider, byModel, byAccount, byApiKey, byEndpoint, writer }` |
| GET | `/api/usage/chart?period=&from=&to=` | `{ timezone, bucket: "hour" \| "day", buckets: [{ start, requests, cost, tokens: { <provider>: n } }] }` |
| GET | `/api/usage/export.csv?period=&from=&to=` | CSV, one row per provider and model |
| GET | `/api/usage/stream` | SSE, see below |
| GET | `/api/pricing` | `{ overrides: [{ provider, model, input, output, cached, reasoning, cache_creation, updatedAt }] }` |
| GET | `/api/pricing/resolve?provider=&model=` | `{ price \| null, source: "override" \| "provider" \| "model" \| "pattern" \| "none" }` |
| PATCH | `/api/pricing` | `{ <provider>: { <model>: { input?, output?, cached?, reasoning?, cache_creation? } } }` → the overrides |
| DELETE | `/api/pricing?provider=&model=` | Reset one model, one provider, or everything (no query) → the overrides |

Summaries:
- Counters are `{ requests, errors, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, reasoningTokens, cost, unpriced }`, where `unpriced` counts events without a price.
- Breakdowns are sorted by requests and hold at most 200 rows each.
- Rows carry names from joins, and ids that no longer exist keep their raw id.
- `writer` is `{ queued, dropped, failed }`.

Stream:
- On connect, and at most every 250 ms after a flush, it sends `data: { active, recent, writer, flushedAt }`. `active` lists the live counts; `recent` is the last 20 events.
- A `: ping` comment is sent every 25 s.
- At most 16 clients at once.
- The dashboard refetches the summary and chart after a push, at most every 5 s.

Pricing PATCH:
- Every field must be one of the five names, with a finite value ≥ 0.
- At most 500 models per request, in one transaction.
- Provider and model ids are 1–200 characters.

Errors:
- 400 `INVALID_REQUEST`: bad period or dates, a range over 400 days, a bad pricing body, a missing `provider` or `model` on resolve.
- 503 `USAGE_STREAM_BUSY`: 16 live streams are already open.

All of these reach the dashboard through `apps/web/src/shared/errors.ts`.

## Requests (SP24b)

**What else is recorded.**
- One **request row** per client request, on the chat routes and on `/v1/embeddings`, `/v1/images/generations`, `/v1/audio/speech`, `/v1/audio/transcriptions`, `/v1/search`, `/v1/web/fetch`, and `/v1/videos/*`.
- The media lanes also record a usage event per upstream call (TTS per connection tried). Tokens come from the upstream `usage` when it sends one, otherwise 0; cost is null unless an override prices the model.

**Request row fields:**
- `id` (the `x-request-id`), `at` (start), `endpoint`, `requestedModel` (as the client sent it: a combo name, a bare id, or `provider/model`), `apiKeyId`, `stream`.
- `status`, one of:
  - `success`: the client got a 2xx and the stream, if any, finished.
  - `error`: the client got an error status.
  - `aborted`: the client left, or the stream failed after it started.
- `httpStatus`, `errorCode` (the lane's code, or the last attempt's).
- `attempts` (the request's usage events), and `finalProvider`, `finalModel`, `finalConnectionId` from the last attempt.
- The attempts' summed tokens, `cost` (null when no attempt was priced), `unpriced` (attempts without a price), `latencyMs`, `ttftMs` (the last attempt's).

Nothing from a request or answer body is stored. Rows share the writer and the event retention.

| Method | Path | Answer |
|---|---|---|
| GET | `/api/requests?cursor=&limit=&status=error&provider=&model=&endpoint=&fallback=1&from=&to=` | `{ items, nextCursor }`, newest first |
| GET | `/api/requests/filters` | `{ providers: [{ id, name }], models: [{ provider, model }], endpoints }` |
| GET | `/api/requests/:id` | `{ request, attempts }` |

Paging and filters:
- `limit` is 1–100 (default 50).
- `cursor` is the opaque `nextCursor` of the previous page (`null` on the last page).
- `status=error` matches error and aborted.
- `fallback=1` keeps requests with more than one attempt.
- `provider` and `model` match the final attempt.
- `from` and `to` are epoch ms.
- Items carry display names for the provider, the account, and the key.
- `filters` reads `usage_daily` within the retention, at most 500 entries per list.

Errors:
- 400 `INVALID_REQUEST`: bad cursor, limit, time, or status.
- 404 `NOT_FOUND`: an unknown or pruned request id.

UI:
- `/traffic/requests`: filters in the URL; a table of time, requested model, final provider, account, status and code, attempts, TTFT, latency, tokens, and cost; Load more by cursor, at most 500 rows on the page.
- `/traffic/requests/detail?id=<id>`: metrics, the attempt timeline (provider, account, status, error, latency, tokens), and the metadata with a copyable request id.

## Deviations from 9router

See the matrix entries for each one:
- One event per upstream call, with error and aborted events.
- No deduplication.
- A configured timezone.
- Retention.
- Buffered writes that count their losses.
- Aborted streams are recorded.
- Null cost when unpriced.
- Reasoning is billed once in AIGate's token convention.
- No `/api/pricing/defaults` and no `/api/usage/logs` alias pair.

## UI

`/traffic/usage`:
- A period picker (`?period=`, custom `from` and `to`).
- Four metrics: requests, input, output, cost, with unpriced shown when there is any.
- A stacked token chart by provider and a cost line.
- A provider × model table: requests, input, output, cached, cost, error %.
- Live active and recent calls.
- Export CSV.
- A warning when the writer dropped or failed.
- The Pricing modal: pick a provider and model, see the resolved price and its source, edit the five rates, reset a model, a provider, or everything.
