# Anthropic Messages provider contract (M2 SP14a)

Scope, per spec §9 (SP14, provider adapters by protocol family): one `AIProviderPort` for the `anthropic` family (9router format `claude`), over `HttpTransportPort`. It maps CIP to `POST <chatUrl>` (`…/v1/messages`) and back, JSON and SSE. The adapter is chosen by protocol (`createAdapter`); the `/v1` chat lane and the connection test use it unchanged.
- **Unblocked providers:** `anthropic`, `glm`, `kimi`, `minimax`, `minimax-cn` (API key). `claude` stays OAuth-only (SP16). The catalog now has **46** connectable providers.
- **UI:** no new screen. `/providers` pills, `ProviderDetail`, and the Connections Add modal read `connectable` from `GET /api/providers`, so the five providers become connectable there by themselves.
- **SP14b (done):** Anthropic-compatible custom providers reuse this adapter (`custom-providers.md` "Anthropic-compatible"); stream-only providers are in `stream-only-providers.md`.

**User decision (2026-09-26):** 9router's suspected bugs in this path are **not** ported; AIGate implements the correct behavior, as in SP9/SP10. Each deviation is listed below.

## Matrix entries

| Entry | Label | AIGate |
|---|---|---|
| `provider.anthropic-auth-and-headers` | `REFERENCE_BEHAVIOR` | `x-api-key: <key>` (raw) for every API-key provider in the family; `anthropic-version: 2023-06-01` is always sent (added when the catalog lacks it); the catalog `anthropic-beta` list is kept; `accept: text/event-stream` when streaming. Header names are lower-cased once, so a version header is never sent twice. |
| same, 403 counted as valid | `SUSPECTED_BUG` | Not ported: 401 and 403 are both `AUTH_ERROR` (invalid key). |
| `translator.openai-to-claude-request` | `REFERENCE_BEHAVIOR` | See "Request". |
| same, dropped fields, `none`→`auto`, injected Claude Code line, replaced cache markers, silent thinking removal | `SUSPECTED_BUG` | Not ported (see "Deviations"). |
| `translator.claude-to-openai-response` | `REFERENCE_BEHAVIOR` | See "Response" and "Stream". |
| same, dropped stream errors, raw non-stream stop reasons, lost cache usage, `<think>` tags, json fence stripping | `SUSPECTED_BUG` | Not ported (see "Deviations"). |

## Request (CIP → Messages)

| CIP | Messages |
|---|---|
| `model` | `model` |
| `maxOutputTokens` | `max_tokens`. Absent: 64000. With tools: at least 32000. Not above the thinking budget: budget + 1024. Then capped at the model's declared `maxOutputTokens` (the chat lane already refuses a client value above it). |
| `system` (text parts) | `system: [{ type: "text", text, cache_control? }]` |
| messages | `user` and `tool` → user turns, `assistant` → assistant turns. Consecutive same-role turns are merged; in a user turn the `tool_result` blocks come first. |
| `text` | `{ type: "text", text }`; `cacheControl: "ephemeral"` → `cache_control: { type: "ephemeral" }` |
| `image` base64 / url | `{ type: "image", source: { type: "base64", media_type, data } }` / `{ source: { type: "url", url } }`. `detail` other than `auto` → `UnsupportedFeatureError` (CIP rule). |
| `file` PDF base64 / url | `{ type: "document", source: … }`; any other file type → `UnsupportedFeatureError` |
| `audio`, `video` | `UnsupportedFeatureError` |
| `tool_call` | `{ type: "tool_use", id, name, input }`; arguments that are not a JSON object → `INVALID_REQUEST` |
| `tool_result` | `{ type: "tool_result", tool_use_id, content: [text or image blocks], is_error? }` |
| `thinking` with a signature / redacted | `{ type: "thinking", thinking, signature }` / `{ type: "redacted_thinking", data }`; without a signature → `UnsupportedFeatureError` |
| `tools` | `{ name, description?, input_schema }`; `type: "custom"` added for providers with the `requireClaudeToolType` quirk; `strict: true` → `UnsupportedFeatureError` |
| `toolChoice` | `auto` → `{type:"auto"}`, `none` → `{type:"none"}`, `required` → `{type:"any"}`, `{name}` → `{type:"tool", name}` |
| `temperature`, `topP`, `stop` | `temperature`, `top_p`, `stop_sequences` |
| `reasoning.effort` / `budgetTokens` | `thinking: { type: "enabled", budget_tokens }` with low 1024, medium 8192, high 24576, or the explicit budget. When the last turn is an assistant turn → `UnsupportedFeatureError` (Anthropic refuses thinking with a prefill). |
| `stream` | `stream` |
| `vendorExtensions.openai.user` | `metadata.user_id` |
| `vendorExtensions.openai.parallel_tool_calls: false` | `tool_choice.disable_parallel_tool_use: true` (with `{type:"auto"}` if no choice was given) |
| any other `vendorExtensions.openai.*` | `UnsupportedFeatureError` naming the field, e.g. `vendorExtensions.openai.seed` |
| `vendorExtensions.anthropic` | merged under the modelled fields (a modelled field wins) |
| `output_config` | never sent (so the `dropOutputConfig` quirk needs nothing) |

## Response (Messages JSON → CIP)

| Messages | CIP |
|---|---|
| `id`, `model` | `id`, `model` |
| `text` | `text` |
| `thinking` / `redacted_thinking` | `thinking { text, signature }` / `thinking { text: data, redacted: true }` |
| `tool_use` | `tool_call { id, name, arguments: JSON.stringify(input) }` |
| any other block type | `PROVIDER_UNAVAILABLE` ("sent an unsupported content block") — AIGate never asks for server tools |
| `stop_reason` | `end_turn`, `stop_sequence`, `max_tokens`, `tool_use` as is; `refusal` → `content_filter`; `model_context_window_exceeded` → `max_tokens`; anything else → `end_turn`. A tool call always means `tool_use`. |
| `usage` | `inputTokens = input_tokens` (Anthropic already excludes cache), `outputTokens = output_tokens`, `cacheReadTokens = cache_read_input_tokens`, `cacheWriteTokens = cache_creation_input_tokens` (when above 0). The OpenAI renderer adds them back into `prompt_tokens`. |

The same mapping is used for streaming and non-streaming.

## Stream (SSE events → StreamChunk)

| Event | Chunk |
|---|---|
| `message_start` | `start { id, model }`; usage seeded from `message.usage` |
| `content_block_start` `tool_use` | `tool_call_delta { index: n-th tool call, id, name, argumentsDelta: "" }` |
| `content_block_delta` `text_delta` / `thinking_delta` / `signature_delta` / `input_json_delta` | `text_delta` / `thinking_delta` / `thinking_delta { text: "", signature }` / `tool_call_delta { argumentsDelta }` |
| `message_delta` | stop reason; `usage.output_tokens` (and any input counts) update the usage |
| `message_stop` | the stream is finished: `usage`, then `stop` |
| `ping` | ignored |
| `error` | `PROVIDER_UNAVAILABLE` with `partial`, so the lane sends one error event and no `[DONE]` |
| end of body without `message_stop` | `PROVIDER_UNAVAILABLE` "ended the stream before it finished" (`fallback.partial-stream-failure`) |

Bounds: at most 128 tool calls, and the SSE reader limits from SP9. A `redacted_thinking` block in a stream has no OpenAI form and is not forwarded (the known pivot loss, `translator.pivot-loss`).

## Errors

Body `{ type: "error", error: { type, message } }`. Classification by status and `error.type` only: 401/403 or `authentication_error`/`permission_error` → `AUTH_ERROR`; 429 → `RATE_LIMIT`; 404 → `MODEL_UNAVAILABLE`; 408 → `TIMEOUT`; 413 → `INVALID_REQUEST`; 529 `overloaded_error` and other 5xx → `PROVIDER_UNAVAILABLE`; other 4xx → `INVALID_REQUEST`. The message is bounded to 300 characters with the key redacted. Retries: 502/503/504 and transport failures, at most 3 attempts, only before the first chunk (529 is not retried, as in 9router; account fallback is SP17).

## Connection test and models

`validateCredential`: `GET <modelsUrl>` (`<chatUrl>` with `/messages` → `/models`), 15 s, no retry. If that endpoint does not exist (404, as on some compatible hosts), one `POST <chatUrl>` with `max_tokens: 1` to the provider's first declared chat model. `AUTH_ERROR` → invalid, `QUOTA_EXHAUSTED` → no quota, anything else is thrown (unreachable). `getModels` reads `data[].id`.

## Deviations from 9router (not ported, user decision)

- `stop` → `stop_sequences`, `top_p` kept, `max_completion_tokens` honoured (the SP10 parser already folds it into `maxOutputTokens`).
- `tool_choice: "none"` → `{type:"none"}`.
- No "You are Claude Code…" line in API-key traffic; the client's system prompt is sent as given.
- The client's cache markers are kept; AIGate places none of its own (automatic placement belongs to SP21 Token Saver).
- Requested reasoning is never removed silently.
- A mid-stream `error` event fails the stream.
- Non-streaming uses the same stop-reason and usage mapping as streaming.
- No `<think>` tags in content; reasoning goes only to `reasoning_content`.
- Model text is never rewritten (no json-fence stripping).
- 403 is an invalid key in the connection test.

## Registry changes

- `ProviderDescriptor.protocol` is `"openai-compatible" | "anthropic"`, and it carries `quirks` (only `requireClaudeToolType` is read).
- `unsupportedReason` accepts `anthropic` with an API key when `chatUrl` ends in `/messages`.
- `toDescriptor` for `anthropic`: auth `x-api-key` raw, `modelsUrl` from `/messages` → `/models`, `anthropic-version` added when missing.

## Matrix

`provider.anthropic-auth-and-headers`, `translator.openai-to-claude-request`, and `translator.claude-to-openai-response` become `implemented`.
