# Chat lane contract (M1 SP12)

Scope, per spec §9: `POST /v1/chat/completions` on the OpenAI protocol, through **one** provider (OpenAI) and **one** API-key connection, with streaming, backpressure, and cancellation. `GET /v1/models` lists the models that can be called. Since SP15 the same lane also serves Anthropic clients at `POST /v1/messages` and `POST /v1/messages/count_tokens` (`protocol-anthropic.md`): a client protocol object decides how the body becomes CIP, how the request is prepared for the resolved provider, and how the answer and the stream go back; errors stay OpenAI-shaped for every protocol.

It glues together what earlier SPs built:
- the API-key gate (SP6)
- `parseOpenAIChatRequest` and the encoders (SP10)
- the active connection (SP11)
- capability checks (SP7)
- `OpenAICompatibleAdapter` (SP9) over `HttpTransportPort` (SP8)

Where the code lives:
- `apps/server/src/modules/routing/infrastructure/` holds `chat-lane.ts` and `v1-routes.ts`.
- The routes are registered directly on Fastify, so the handler owns the raw response.

## Rules from the reference

| Entry | Rule in 9router | Label | AIGate |
|---|---|---|---|
| `endpoint.enforce-require-api-key` | With `requireApiKey` on: a missing or invalid key is 401. With it off, the gate is skipped. The check runs after the JSON body is parsed. | `REFERENCE_BEHAVIOR` | Keep the 401 cases. The check runs in `onRequest`, **before the body is read**, so an unauthenticated caller cannot make AIGate parse 16 MiB. Status: `implemented`. |
| `endpoint.enforce-require-api-key` | With the key requirement off, any client that reaches the port is served, including a DNS-rebinding page or a LAN host. | `SUSPECTED_BUG` | Keyless mode is **this machine only**: the socket, `Host`, and any `Origin` must be loopback (`isLocalRequest`, as for first-password setup). Anything else is 403 `api_key_required`. |
| `settings.hot-path-read-no-cache` | Settings are read from the database on every chat request. | `IMPLEMENTATION_ACCIDENT` | `SettingsRepository.get()` is cached and written through (SP5). |
| `routing.lane-entry-routes` | Chat routes answer `OPTIONS` with `Access-Control-Allow-Origin: *`. | `SUSPECTED_BUG` (for a local gateway) | No CORS on `/v1`. Every call needs `Content-Type: application/json`, so a cross-site page cannot send a request without a preflight, and the preflight fails. SDKs and IDEs are not browsers and are unaffected. |
| `routing.request-preflight` | Parse JSON, strip `[1m]`, check the key, then check the model. | `REFERENCE_BEHAVIOR` | Order: key (before the body is read), then JSON, then `parseOpenAIChatRequest`, then model resolution, then capability check. The Claude Code `[1m]` marker belongs to the Anthropic lane (SP15). |
| `routing.model-resolution` | `x/y` resolves `x` as a provider alias; a bare name is looked up as a combo, then an alias. An unknown provider fails later with "No active credentials". | `REFERENCE_BEHAVIOR` | See "Model resolution" below. There are no combos until SP19. An unknown model is 404 `model_not_found` at once, and the message names both accepted forms. Status: `contracted`, because aliases come with SP13 and combos with SP19. |
| `routing.stream-mode-decision` | An omitted `stream` means streaming. | `SUSPECTED_BUG` | Implemented in SP10: omitted means JSON. |
| `routing.client-disconnect-propagation` | A disconnect is not propagated before the stream starts. Retries, token refreshes, and other accounts keep running after the client has left. | `SUSPECTED_BUG` | The response `close` event aborts one `AbortController`, which is part of the single `ExecCtx.signal`. It stops the transport, the retry wait, and the body read at any stage. Status: `implemented`. |
| `routing.streaming-pipeline` | Stall watchdog: 360 s of upstream silence ends the stream. Non-JSON `data:` lines are dropped. `[DONE]` is appended. | `REFERENCE_BEHAVIOR` | The idle timeout between chunks is `AIGATE_STREAM_IDLE_TIMEOUT_MS`, 300 000 by default and allowed from 1 000 to 600 000. On expiry, the upstream is aborted with `TIMEOUT` and the client gets an error event. A non-JSON event fails the stream visibly (SP9). `[DONE]` is sent only on success. Status: `implemented`. |
| `fallback.partial-stream-failure` | A stream cut off mid-answer looks finished. | `SUSPECTED_BUG` | The error event comes from `encoder.fail()`, with no `[DONE]`. Status: `implemented`. |
| `fallback.accounts-exhausted-response` | No connection gives 404 "No active credentials"; after fallback the upstream status is lost as 503. | `REFERENCE_BEHAVIOR` (404) / `SUSPECTED_BUG` (lost status) | No active connection is 404 `no_active_connection`, with a message that says where to add one. Upstream failures keep their mapped status through `toOpenAIError`, since there is no fallback in M1. Status: `contracted`; SP17 adds fallback. |
| `catalog.model-listing-live-override` | `/v1/models` makes a live upstream round trip per provider on every call. | `REFERENCE_BEHAVIOR` (live list) | `/v1/models` lists registry models of providers with an active connection, with no network call. A live list comes with SP13. Status: `contracted`. |
| `routing.usage-recording-timing` | Usage is recorded from the stream flush and lost on abort. | `SUSPECTED_BUG` | Not in SP12: usage recording is SP24. |

## Request flow and limits

| Step | Rule | Failure (OpenAI error shape `{ error: { message, type, code, param } }`) |
|---|---|---|
| Key gate (`onRequest`) | See above. | 401 `missing_api_key` / 401 `invalid_api_key` / 403 `api_key_required` |
| Body | JSON only, at most 16 MiB | 415 `unsupported_media_type`, 413 `request_too_large`, 400 `invalid_json` |
| Parse | `parseOpenAIChatRequest` | 400 naming the field, or 400 `unsupported_feature` |
| Resolve | Model resolution | 404 `model_not_found`, 400 `provider_not_supported`, 404 `no_active_connection`, 500 `credential_unreadable` |
| Capabilities | `assertModelSupports` | 404 `model_not_found` (missing capability), 400 (output limit) |
| Upstream | adapter; errors through `toOpenAIError` | 400/404/429/502/504 as in `protocol-openai.md` |

Every response carries `x-request-id`. One `ExecCtx.signal` combines three sources:
- the client disconnect
- a 600 s request budget
- for streams, the idle watchdog

## Model resolution

SP13 rules (`catalog-providers.md`):

1. `provider/model`, where `provider` is a registry id **or alias** (`ds/deepseek-chat`), calls that provider with `model` as given. It may be a model the registry does not declare; such a model gets the default capabilities.
2. `provider/model`, where `provider` is a catalog provider that cannot be connected yet, is 400 `provider_not_supported` with the catalog reason.
3. Any other string is a bare model id; a `/` inside it is part of the id (`zai-org/GLM-5.2`). Among the registry providers that declare it, the first in catalog order **with an active connection** serves it. When none has one: 404 `no_active_connection`, naming up to three of them. When none declares it: 404 `model_not_found`.
4. `provider/model`, where `provider` is none of the above but a custom provider's prefix (SP13b, `custom-providers.md`), calls that custom provider with `model` as given.
5. The provider needs an **active** connection (`isActive`). Its test status is not checked: a key that was never tested still works.

Example: `gpt-4.1` and `openai/gpt-4.1` are the same request. `openai/gpt-5-mini` works although the catalog does not declare it. `glm-5` is declared by six providers and goes to the first one you connected.

## Streaming

1. The adapter's first chunk is awaited **before** any header is sent. A failure up to then is a normal JSON error with its real status.
2. Then comes `200 text/event-stream`, with `cache-control: no-cache`, `x-accel-buffering: no`, and `x-request-id`. Encoder output is written as it comes.
3. **Backpressure:** when `write()` returns false, the lane waits for `drain`. That wait ends if the client leaves. The adapter reads no more upstream data until the client catches up, so memory stays bounded by the socket buffer.
4. **Idle:** each `next()` on the adapter has a timer. On expiry, the stream is aborted with `EngineError TIMEOUT`, which reaches the client as an error event.
5. **The end:**
   - Success sends `[DONE]`.
   - An upstream failure sends one error event and no `[DONE]`.
   - A client disconnect writes nothing more.
   - In every case the upstream body is cancelled.

## UI

`/gateway/endpoint` → `EndpointKeys`: the "Chat API pending" pill becomes a live readiness pill, computed from the connections query (shared by query key):
- "Ready" when an active connection's last test passed.
- "Connect a provider" (a link to `/providers/connections`) when there is no active connection.
- "Check connection" otherwise.

The screen also adds a copyable `curl` example that uses `openai/gpt-4.1-mini`. API clients read `/v1` errors in the OpenAI shape; the dashboard never calls `/v1`.

## Tests

`apps/server/test/chat-lane.test.mjs` uses Fastify inject with a fake transport. The streaming, backpressure, and disconnect tests run against a real listening server.
