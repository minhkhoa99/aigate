# OpenAI-compatible provider adapter contract (M1 SP9)

Scope, per spec §9: one `AIProviderPort` for the `openai-compatible` protocol family, over `HttpTransportPort`. It maps CIP to `POST {baseUrl}/chat/completions` and back, classifies upstream failures into the 8 error codes, retries only transient failures before the first chunk, and parses SSE with fixed bounds. SP9 has **no HTTP API and no UI**: `docs/design/API_UI_MAP.md` says so. Its errors reach users through `/v1` in SP12, and `validateCredential` backs the "Test connection" button in SP11.

- Code: `packages/engine/src/adapters/openai-compatible.ts`, `packages/engine/src/sse.ts`.
- Construction: `new OpenAICompatibleAdapter(provider, transport)`. The provider is a `ProviderDescriptor` from the registry. There is no default provider config.

## Rules from the reference

| Entry | Rule in 9router | Label | AIGate |
|---|---|---|---|
| `fallback.upstream-error-result` | A non-2xx body is read once; the message is `error.message`, and the upstream status is kept. | `REFERENCE_BEHAVIOR` | Keep. The status goes to `details.status`. The message is `error.message` (or a string `error`), at most 300 characters, with the credential redacted. An HTML or non-JSON error page gives the status only, so it never reaches a client. Status: `implemented`. |
| `fallback.error-classification` | Every failure, including a 400 or 404, locks the account and falls back. The final line is a catch-all `shouldFallback: true`. | `SUSPECTED_BUG` | Each status maps to one code (table below). `INVALID_REQUEST` is terminal through `FALLBACK_POLICY`. Account locks are for routing (SP12+). Status: `contracted`. |
| `fallback.error-classification` | Text rules win over status: a 400 whose message says "capacity" or "rate limit" counts as a rate limit. | `SUSPECTED_BUG` | Structured fields only: the status and `error.code` / `error.type`. The message text is never matched. |
| `fallback.executor-retry-budget` | 502 ×3 at 3 s, 503 ×3 at 2 s, 504 ×2 at 3 s, and network errors ×3; 429 and 500 get no in-place retry. The counter is per URL. | `REFERENCE_BEHAVIOR` | Keep the set: 502, 503, 504, and a transport failure with no status (connection refused, DNS, TLS). At most 3 attempts through `withRetry`, with 500 ms then 1000 ms waits, all inside `ctx.signal`. 429, 500, `TIMEOUT`, and redirects go straight to the caller. Status: `implemented`. |
| `fallback.executor-url-loop` | Multiple base URLs; the connect timer is cleared at headers, so the body is unbounded. | `IMPLEMENTATION_ACCIDENT` (unbounded body) | One `baseUrl` per descriptor. `timeoutMs` bounds headers and body (transport contract). Multi-URL is not ported until a provider needs it. |
| `routing.default-executor-openai-fallback` | A provider id with no registry entry silently gets OpenAI's URL and config. | `SUSPECTED_BUG` | Not possible: the adapter takes a `ProviderDescriptor` and has no default. An unknown provider is a routing error before any I/O. Status: `contracted`. |
| `routing.non-streaming-response` | A tool call forces `finish_reason` to `tool_calls`. | `REFERENCE_BEHAVIOR` | Keep. Any tool call gives `stopReason: "tool_use"`. |
| `routing.non-streaming-response` | The whole body is buffered, with no body timeout. | `IMPLEMENTATION_ACCIDENT` | Read with `readBoundedText` (4 MiB) inside the transport `timeoutMs`. |
| `routing.streaming-pipeline` | A 2xx that is neither SSE nor JSON is refused. | `REFERENCE_BEHAVIOR` | A streaming request whose 2xx response is not `text/event-stream` is `PROVIDER_UNAVAILABLE`, before the first chunk, so routing may fall back. |
| `fallback.partial-stream-failure` | A stream cut off mid-answer looks like a normal end to the client, and the account is marked healthy. | `SUSPECTED_BUG` | A stream that ends with neither `finish_reason` nor `[DONE]`, or carries an `error` event, throws `PROVIDER_UNAVAILABLE` with `details.partial: true`. Once any chunk was yielded, the caller must not retry or fall back (spec §5). Status: `contracted`; SP12 turns it into a client error event. |

## Request mapping (CIP → chat completions)

| CIP | OpenAI | Cannot carry → `UnsupportedFeatureError` |
|---|---|---|
| `system` | one `system` message; text parts only | image, file, or any non-text part |
| user `text` / `image` | `text` / `image_url` (a URL, or a `data:` URL from base64) | — |
| user `audio` | `input_audio`, base64 `audio/wav` or `audio/mpeg` only | an audio URL or another format |
| user `file` | `file.file_data` as a `data:` URL, with `filename` | a file by URL |
| user `video`, `thinking`, `tool_call` | — | always |
| assistant `text`, `tool_call` | `content`, `tool_calls[]` | assistant `thinking`, media |
| `tool_result` (in any message) | a `tool` message with `tool_call_id`; text parts only | non-text content, `isError: true` |
| `tools`, `toolChoice` | `tools[].function`, `tool_choice` | — |
| `maxOutputTokens` | `max_completion_tokens` | — |
| `temperature`, `topP`, `stop` | `temperature`, `top_p`, `stop` | — |
| `reasoning.effort` | `reasoning_effort` | `reasoning.budgetTokens` |
| `vendorExtensions.openai` | merged into the body first, so modelled fields win | any other namespace |

- The adapter throws `UnsupportedFeatureError` before any I/O and never drops a field silently (spec §3.1). Routing (SP12) decides if another candidate can take the request.
- `cacheControl` is the one exception. It is a hint, and OpenAI caches prompt prefixes automatically, so leaving it out does not change the answer.
- A single text part is sent as a string; anything else is sent as a part array.
- `execute()` always sends `stream: false`. `stream()` always sends `stream: true` with `stream_options.include_usage`.

## Response mapping

- `reasoning_content` (sent by DeepSeek-style servers) becomes a `thinking` part first. Then `content` becomes `text`, and `tool_calls` become `tool_call` parts. A refusal goes to `vendorExtensions.openai.refusal`.
- `finish_reason` maps as follows:
  - `stop` → `end_turn`
  - `length` → `max_tokens`
  - `tool_calls` or `function_call` → `tool_use`
  - `content_filter` → `content_filter`
  - null or unknown → `end_turn`
  - any tool call present → `tool_use`
- Usage is normalized for all providers, and `cip.ts` documents it:
  - `inputTokens` excludes cache reads: `prompt_tokens − cached_tokens`.
  - `cacheReadTokens` is `cached_tokens`.
  - `outputTokens` is `completion_tokens`, which includes `reasoningTokens`.
  - Missing usage becomes zeros.
- A body that is not JSON, or has no `choices[0].message`, is `PROVIDER_UNAVAILABLE`.

## Status classification

| Upstream | Code | In-place retry |
|---|---|---|
| 401, 403 | `AUTH_ERROR` | no |
| 402; 429 with `code`/`type` `insufficient_quota` | `QUOTA_EXHAUSTED` | no |
| 429 | `RATE_LIMIT` | no |
| 404; 400 with `code` `model_not_found` | `MODEL_UNAVAILABLE` | no |
| 408 | `TIMEOUT` | no |
| other 4xx | `INVALID_REQUEST` (terminal) | no |
| 502, 503, 504 | `PROVIDER_UNAVAILABLE` | yes |
| 500, other 5xx | `PROVIDER_UNAVAILABLE` | no |
| Transport: unreachable host | `PROVIDER_UNAVAILABLE` | yes |
| Transport: redirect, `TIMEOUT`, URL refused | unchanged | no |
| `ctx.signal` aborts | rejects with `ctx.signal.reason` | never |

Every error has `details.provider`; upstream errors also have `details.status` and, when given, `details.upstreamCode`. An API key that is empty, longer than 4096 characters, or has whitespace or control characters is `AUTH_ERROR` before any I/O, so it can never inject a header.

## Streaming (SSE) bounds

- Lines end with `\n` (a trailing `\r` is removed). `data:` lines are joined per event; comments and other fields are ignored.
- One line, or one event's data, may be at most 1 Mi characters. Past that, the body is cancelled and the adapter throws `PROVIDER_UNAVAILABLE`.
- A tool-call `index` must be an integer from 0 to 127.
- Chunks: `start` once, with the first event's `id` and `model`, then `thinking_delta` and `text_delta` at index 0, `tool_call_delta` at the OpenAI `index`, then `usage` (when sent), then `stop` last.
- The consumer can stop early (`break`, or `return()` on the iterator); the body is cancelled either way. `ctx.signal` aborts the read with the caller's reason.
- The transport's `timeoutMs` bounds the whole stream, at 600 s. An idle timeout between chunks comes with SP12.

## Other methods

- `getModels(credential, ctx)` calls `GET {baseUrl}/models` (15 s, retried like chat). It returns `ListedModel[]` as `{ id, descriptor? }`, where `descriptor` is the registry entry when the id is known. It never invents context windows for unknown ids. At most 1000 ids are read, and ids that are not valid model ids are skipped.
- `validateCredential(credential, ctx)` makes one `GET /models`, with no retry:
  - 2xx → `{ valid: true }`.
  - `AUTH_ERROR` or `QUOTA_EXHAUSTED` → `{ valid: false, code, message }`.
  - Anything else (network, timeout, 5xx) is thrown, because it says nothing about the key.

## Tests

- `packages/engine/test/openai-adapter.test.mjs` uses a fake `HttpTransportPort`. The SSE bytes are split at random points, including inside a UTF-8 character.
- `apps/server/test/transport.test.mjs` adds one end-to-end stream over `DirectTransport` against a local HTTP server.
