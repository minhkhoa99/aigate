# Transport contract (M1 SP8)

Scope, per spec §9: `HttpTransportPort`, direct branch and timeout only. Relay, proxy pools, the outbound proxy, and MITM-bypass DNS sit behind the same port later (SP18). SP8 has **no HTTP API and no UI**, and `docs/design/API_UI_MAP.md` says so.

- The port is in `packages/engine/src/ports.ts`. The bounded body reader `readBoundedText` is in `packages/engine/src/http.ts`.
- The direct implementation, `DirectTransport`, is in `apps/server/src/modules/transport/infrastructure/direct-transport.ts`. `TransportModule` injects it under `HTTP_TRANSPORT`.

## Rules from the reference

| Entry | Rule in 9router | Label | AIGate |
|---|---|---|---|
| `transport.proxy-priority-chain` | With no relay and no proxy, the request goes to the unpatched global `fetch`. | `REFERENCE_BEHAVIOR` | Keep, as the direct branch. Status: `contracted`, because the relay and proxy branches come in SP18. |
| `transport.proxy-priority-chain` (`fallback.timeout: null`) | The direct chat fetch has no timeout. | `IMPLEMENTATION_ACCIDENT` | Every call states `timeoutMs` (1 to 600000 ms). It bounds the headers and the body, inside the shared `ctx.signal` deadline (spec §4.2). |
| SP0.1 / spec §11.2 | "Retry không trần — chỉ cho phép qua helper duy nhất". | spec rule | Lint rule `aigate/retry-through-helper`: a loop around an awaited `try/catch` in the server or engine is rejected; use `withRetry`. |
| SP0.1 / spec §4.2 | Raw `fetch` with an opaque signal stays rejected until a bounded helper exists. | spec rule | The transport is that helper. Lint rule `aigate/fetch-through-transport` rejects `fetch` anywhere in the server or packages except `modules/transport/infrastructure/`. `aigate/fetch-timeout` now accepts `AbortSignal.any([..., AbortSignal.timeout(n)])`. |

## Behavior: every failure has one mapping

| Situation | Result |
|---|---|
| Malformed URL, or not `https:` (plain `http:` is allowed only to localhost, 127.0.0.1, or [::1]) | `EngineError INVALID_REQUEST`, before any I/O |
| `timeoutMs` not an integer from 1 to 600000 | `RangeError` (a programming error) |
| The caller's `ctx.signal` aborts (client left, request budget spent), before or during the exchange or a body read | Rejects with `ctx.signal.reason` unchanged, never relabeled as a provider failure |
| No headers, or a stalled body, within `timeoutMs` | `EngineError TIMEOUT` with `{ host, timeoutMs }` |
| Connection refused, DNS failure, TLS failure | `EngineError PROVIDER_UNAVAILABLE` with `{ host }` |
| Upstream answers 3xx | `EngineError PROVIDER_UNAVAILABLE`, and the redirect is not followed, so the credential never goes to another host |
| Upstream answers 4xx or 5xx | Returned as a normal `HttpResponse`. The adapter classifies the status (SP9). |
| Body larger than `maxBytes` (default 4 MiB) in `readBoundedText` | The stream is cancelled and `EngineError PROVIDER_UNAVAILABLE` is thrown; a truncated body is never returned |

Error messages and details name the host only. Headers, including `Authorization`, never appear in them.

## Tests

`apps/server/test/transport.test.mjs` has 10 tests against a real local HTTP server. They cover every row above, and each checks that the credential is not in the error. Six mutations were caught:
- following redirects
- relabeling a caller abort
- dropping the per-request timeout; the test run then hangs and is cancelled, so the server, engine, and database test scripts now pass `--test-timeout=30000`
- allowing `http` to any host
- returning the raw body without error mapping
- an unbounded body read

`tools/lint/check.test.mjs` has tests for both new rules: violations are rejected, and the transport, `retry.ts`, and plain loops are not flagged.

## Deferred

- A streaming idle timeout (a gap between chunks) comes with SP12 streaming. Until then, `timeoutMs` bounds the whole stream.
- Relay, proxy pools, `strictProxy`, and MITM bypass come in SP18.
