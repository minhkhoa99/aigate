# OpenAI Chat Completions protocol adapter contract (M1 SP10)

Scope, per spec §3 and §9: the client-facing half of the OpenAI protocol. It turns a `POST /v1/chat/completions` body into a `CanonicalRequest`, and turns a `CanonicalResponse`, `StreamChunk`s, or an error back into what an OpenAI client expects.
- SP10 is pure functions in `packages/engine/src/protocols/openai-chat.ts`. It has **no HTTP route and no UI**; `docs/design/API_UI_MAP.md` says so.
- SP12 mounts it on `/v1/chat/completions`, which is the first thing the `/gateway/endpoint` "Chat API pending" pill can show.

```
body ─▶ parseOpenAIChatRequest ─▶ { request: CanonicalRequest, includeUsage }
CanonicalResponse ─▶ toOpenAIChatCompletion ─▶ chat.completion JSON
StreamChunk* ─▶ OpenAIChatStreamEncoder.encode / end / fail ─▶ SSE text
error ─▶ toOpenAIError ─▶ { status, body: { error: { message, type, code, param } } }
```

## Rules from the reference

| Entry | Rule in 9router | Label | AIGate |
|---|---|---|---|
| `routing.stream-mode-decision` | An omitted `stream` flag means streaming, so curl gets SSE. | `SUSPECTED_BUG` | `stream` is `true` only when the body says `true`. Omitted or `false` means JSON, as in the OpenAI API. Any other value is `INVALID_REQUEST`. Status: `implemented`. |
| `routing.source-format-detection` | The format is sniffed from the path and from body fields; a plain OpenAI body with a top-level `system` is taken as Claude. | `REFERENCE_BEHAVIOR` (sniffing on one path: `IMPLEMENTATION_ACCIDENT`) | The route picks the adapter; there is no sniffing. `/v1/chat/completions` is always parsed as OpenAI Chat, and unknown top-level fields travel in `vendorExtensions.openai`. Status: `contracted`, because routes are SP12. |
| `routing.request-translation` | A missing translator leg is silent, and the untranslated body is sent upstream. | `SUSPECTED_BUG` (silent leg) | No pivot. One inbound adapter produces CIP, and one provider adapter consumes it. Anything either side cannot carry throws. Status: `contracted`. |
| `translator.pivot-loss` | The OpenAI pivot loses thinking blocks, `cache_control`, `is_error`, and URL images. | `REFERENCE_BEHAVIOR` (records the loss) | A loss becomes `UnsupportedFeatureError`, never a silent drop (spec §3.1). OpenAI `image_url.detail` and `function.strict` were added to CIP so an OpenAI → OpenAI trip keeps them. |
| `translator.tool-id-normalization` | Every tool id is forced to `^[a-zA-Z0-9_-]+$`, and missing tool responses are filled with empty ones. | `REFERENCE_BEHAVIOR` | Not ported in SP10, because the OpenAI → OpenAI trip keeps ids as given. It belongs to the Anthropic adapters (SP15). An empty tool answer is invented content, so a missing tool response goes upstream unchanged and its 400 is returned. |
| `routing.non-streaming-response` | `reasoning_content` is dropped when `content` is non-empty. | `IMPLEMENTATION_ACCIDENT` | Both are kept, since the DeepSeek-style API returns both. |
| `fallback.upstream-error-result` | The upstream status is passed to the client, so an upstream 401 reads as "your key is wrong". | `SUSPECTED_BUG` (for 401/403 only) | The client's own key is checked by `apikeys` (SP6). An upstream credential failure is AIGate's configuration problem, so it becomes **502** `upstream_auth_error`. Every other code keeps the meaning the upstream status had (table below). Status: `implemented` for the mapping. |

## Inbound: `parseOpenAIChatRequest(body)`

Every failure is `EngineError INVALID_REQUEST` with `details.param` naming the field, for example `messages[3].content`. Fields that are valid OpenAI but that CIP cannot carry throw `UnsupportedFeatureError`.

| OpenAI | CIP | Checks |
|---|---|---|
| `model` | `model` | a string, 1 to 256 printable characters |
| leading `system` / `developer` messages | `system` (text parts) | Text only. A system message after the conversation starts is unsupported. The system/developer distinction is not kept, because OpenAI treats them alike. |
| `user` content: string or parts | `text`, `image` (`data:` → base64, `http(s)` → url, with `detail`), `audio` (`input_audio` wav/mp3), `file` (`file_data` data URL + `filename`) | `file_id` and other part types are unsupported |
| `assistant`: `content` (string, text parts, or null), `tool_calls` | `text`, `tool_call` | `refusal: null` is accepted. A refusal text, `audio`, or `function_call` is unsupported. |
| `tool`: `tool_call_id`, `content` | a `tool` message with one `tool_result` | text content only |
| `function` role, message `name` | — | unsupported |
| any other message field | — | `INVALID_REQUEST` (OpenAI also rejects extra properties) |
| `tools[]` of type `function` | `ToolDefinition` (`strict` kept). An omitted `parameters` becomes `{type:"object",properties:{}}`, which OpenAI documents as the same thing. | name `^[a-zA-Z0-9_-]{1,64}$`; other tool types are unsupported |
| `tool_choice` | `"auto"`, `"none"`, `"required"`, `{ name }` | `allowed_tools` and custom tools are unsupported |
| `max_completion_tokens`, `max_tokens` | `maxOutputTokens` | a positive integer; both present and different → invalid |
| `temperature` / `top_p` | `temperature` / `topP` | a number, 0–2 / 0–1 |
| `stop` | `stop` | a string, or at most 4 strings |
| `reasoning_effort` `low`/`medium`/`high` | `reasoning.effort` | other values pass through `vendorExtensions.openai` |
| `stream` | `stream` | a boolean or omitted (omitted means false) |
| `stream_options.include_usage` | `includeUsage` (for the encoder) | a boolean; not sent upstream, because the provider adapter always asks for usage |
| `n` | — | only 1 is accepted: one choice in, one choice out |
| any other top-level field | `vendorExtensions.openai` | at most 64 of them |

Bounds:
- 10,000 messages, 512 parts per message, 128 tools, and 128 tool calls per message.
- A `data:` URL is split at the first comma, and the payload is never scanned with a regex.
- The HTTP body size limit is SP12's.

## Outbound: `toOpenAIChatCompletion(response, { created, fallbackId })`

- The JSON is `chat.completion` with one choice, `index: 0`, and `logprobs: null`.
- Text parts are joined into `content`. `null` means no text.
- `thinking` becomes `reasoning_content`, and `tool_call` becomes `tool_calls`.
- `stopReason` maps to `finish_reason`:
  - `end_turn` / `stop_sequence` → `stop`
  - `max_tokens` → `length`
  - `tool_use` → `tool_calls`
  - `content_filter` → `content_filter`
- `usage`:
  - `prompt_tokens` is input + cache reads + cache writes.
  - `completion_tokens` is output.
  - `total_tokens` is prompt + completion.
  - `cached_tokens` and `reasoning_tokens` are reported only when present.
- The CIP `id` is used, or `fallbackId` when it is empty.
- A media part in a response cannot be carried by chat completions, so it is unsupported.

## Streaming: `OpenAIChatStreamEncoder`

- Each call returns SSE text (`data: <json>\n\n`) for the route to write.
- `start` → the first chunk, `delta: { role: "assistant", content: "" }`.
- `text_delta` → `delta.content`. `thinking_delta` → `delta.reasoning_content`.
- `tool_call_delta` → `delta.tool_calls[{ index, id?, type: "function" when id is set, function: { name?, arguments } }]`.
- `usage` is held until `stop`. Then comes the finish chunk (`delta: {}`, `finish_reason`), then a `choices: []` chunk with `usage`, only when the client asked with `include_usage`. This is OpenAI's order.
- `end()` → `data: [DONE]\n\n`.
- `fail(error)` → one `data: {"error": {...}}` event, with the same body as `toOpenAIError`, and **no `[DONE]`**. A stream cut off mid-answer is visible to the client twice over: as an error event, and as a missing terminator (`fallback.partial-stream-failure` expected behavior).
- Encoding a chunk after `end()` or `fail()` is a programming error (`Error`).

## Errors: `toOpenAIError(error)`

| Source | Status | `type` | `code` |
|---|---|---|---|
| `INVALID_REQUEST` | 400 | `invalid_request_error` | the upstream code if known (for example `context_length_exceeded`, which agents use to trim context), else `invalid_request` |
| `UnsupportedFeatureError` | 400 | `invalid_request_error` | `unsupported_feature` |
| `MODEL_UNAVAILABLE` | 404 | `not_found_error` | the upstream code, else `model_not_found` |
| `RATE_LIMIT` | 429 | `rate_limit_error` | `rate_limit_exceeded` |
| `QUOTA_EXHAUSTED` | 429 | `insufficient_quota` | `insufficient_quota` |
| `AUTH_ERROR` (upstream) | 502 | `upstream_auth_error` | `upstream_auth_error` |
| `PROVIDER_UNAVAILABLE` | 502 | `api_error` | `provider_unavailable` |
| `TIMEOUT` | 504 | `timeout_error` | `timeout` |
| `INTERNAL_ERROR`, or anything that is not an `EngineError` | 500 | `server_error` | `internal_error` |

`param` is `details.param` when there is one, else `null`. The message is the `EngineError` message, which is already bounded and redacted by the provider adapter. For a non-`EngineError`, the message is a fixed "Internal error", so stack traces and paths never reach a client.

## Tests

`packages/engine/test/openai-protocol.test.mjs`: parse, render, encode, and error mapping, plus a round trip through `OpenAICompatibleAdapter` over a fake transport.
