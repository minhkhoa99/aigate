# Overview contract (SP26)

SP26 is the next integration slice after SP25, selected from M3 U8 and design
§10.9.1. The roadmap ends its numbered M2 slices at SP25; Overview is an AIGate
addition, not a new 9Router endpoint port.

`GET /api/overview/summary` requires a dashboard session and returns
`Cache-Control: no-store`. It has no input parameters or vendor calls.

- `at`, `timezone`, `uptimeSeconds`, `enabledConnections`: response time, usage
  timezone, server process uptime, and SQL count of enabled saved accounts.
- `current`, `previous`: `{ requests, errors, tokens, cost, unpriced }` for the
  rolling 24 hours and preceding 24 hours. Requests and errors count client
  request rows, including pre-upstream failures and aborted requests. Tokens
  and cost sum every attempt attributed to those rows. Tokens include cache
  reads/writes; reasoning is already included in output and is not added again.
  Cost is the priced portion in USD; `unpriced` counts unpriced attempts.
- `buckets`: 24 hourly `{ start, requests, errors, tokens, cost, unpriced }`
  buckets, oldest first, including zero buckets. Windows are half-open at their
  shared boundary. SQL aggregates the 48-hour history into at most 48 rows.
- `providers`: at most 200 `{ provider, name, enabledConnections, requests,
  errors, errorRate, health }` rows. Last-hour upstream attempts determine
  health: no attempts = `unknown`, no errors = `healthy`, error rate below
  5% = `degraded`, otherwise `down`. Failed fallback attempts count here even
  when the client request succeeds. Configured providers with no recent
  attempts remain unknown; this is observed traffic health, not a probe.
  `providersTruncated` reports a capped provider list.
- `attention`: at most 100 enabled-account alerts with stable `id`, `provider`,
  `name`, `kind`, `tone`, `message`, and `until`. Includes current model/account
  locks, invalid/no-quota/unreachable test results, OAuth expiry within three
  days, and fresh cached quota with at most 10% remaining (or exhausted
  balances). Expired locks, disabled accounts and expired quota cache entries
  are excluded. Model locks describe blocked models, not a whole-account lock.
  `attentionTruncated` reports omitted alerts.
- `quotaChecked`: number of enabled accounts with fresh cached quota. Overview
  only consumes the existing 60-second/100-entry QuotaService cache. It never
  refreshes tokens or warms quota; open `/providers/quota` for vendor reads.
- `writer`: the existing `{ queued, dropped, failed }` writer counters.

The existing `/api/usage/stream` supplies the live panel's 20 recent upstream
attempts and active counts. It retains its 16-client, debounce, ping, buffer
cap, disconnect cleanup and `USAGE_STREAM_BUSY` behavior. Server shutdown closes
all live replies before the HTTP adapter waits for sockets. No second SSE service
or alias is introduced. Recent attempts are an in-memory ring since startup;
links to persisted request detail appear after the writer flushes.

SP26 completion: the web consumes this same stream using native fetch so its
actual HTTP refusal reaches the standard API error handler. Only the server's
503 `USAGE_STREAM_BUSY` means the tab limit; 401 `UNAUTHENTICATED` ends the session,
and other HTTP failures retain their own code/status. The handshake has a 10s
deadline; body reads have a resettable 60s heartbeat deadline (server pings at
25s), a 1 MiB per-line bound, and cancellation on unmount/restart. This endpoint
emits one JSON `data:` line per snapshot; comments/blank lines are ignored and
fragmented UTF-8/CRLF are supported. Invalid payloads are `BAD_RESPONSE`.

Unexpected EOF is `USAGE_STREAM_DISCONNECTED`, not a guessed tab-limit error.
Network/timeout/EOF/other 5xx failures reconnect after 1s then 2s; three consecutive
failed connections stop with the actual problem and a Reconnect action. A valid
snapshot resets the failure count. Authentication, tab-limit, other 4xx and
malformed-payload failures stop immediately. At most one connection, one retry
timer, one heartbeat timer and one trailing summary-refresh timer exist per view.
Disconnect hides active counts and labels recent attempts as last received;
writer counters then come from the polled summary. A flush inside the five-second
throttle window schedules one trailing refresh rather than losing the update.

`/` keeps the existing layout. It displays a copyable browser-origin `/v1`
endpoint, real uptime/counts, four metrics with hourly sparklines and relative
deltas (error delta in percentage points; zero prior baseline is explicit),
provider health and actionable links to Connections/Quota/Requests. Initial
loading, precise error with Retry, no-traffic CLI onboarding, writer loss,
unpriced cost, unknown quota, truncation and SSE reconnect/stopped states are
visible. Summary refreshes every 30 seconds and after SSE writes at most once
per five seconds; closing the screen closes the stream. A failed refresh marks
data unavailable rather than labelling stale figures as current. The endpoint and
core status counts remain visible on desktop, tablet and mobile widths.

Errors reuse `UNAUTHENTICATED`, transport errors and `HTTP_5xx` through
`shared/errors.ts`; `USAGE_STREAM_DISCONNECTED` is a web EOF code, and the summary
introduces no new server error code. No schema,
dependency, provider polling or extra cache is needed.

Runnable contract check: `node --test apps/server/test/overview.test.mjs` after
the server build. It also checks shutdown with an open live stream.
Web stream check: `node --test apps/web/src/shared/usage-stream.test.mjs`.

## SP28 presentation

Overview resolves owned copy and number/time display with the selected EN/VI
locale. USD, the summary's timezone, metric/bar math and health tones stay
unchanged. Provider/account names, model IDs, error codes and attention.message
are displayed verbatim. `useLiveUsage` stores one tagged raw failure, exposing
its existing English `stopped` field for Usage and a source `failure` for
Overview's render-time translation. Locale is absent from its effect dependencies,
query keys and request bodies. No summary/server/stream-reader behavior changed.
Native rendering and reader checks pass; live locale-switch lifecycle and visual
acceptance still require the planned isolated browser checks.
