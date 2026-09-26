# OpenAI Responses provider contract (M2 SP14c)

Scope, per spec §9 (SP14, provider adapters by protocol family): one `AIProviderPort` for the `openai-responses` family, over `HttpTransportPort`. It maps CIP to `POST <chatUrl>` (`…/responses`) and back, JSON and SSE. `createAdapter` picks it for `protocol: "openai-responses"`.
- **Served:** `perplexity-agent` (API key; the catalog now has **50** connectable providers) and custom OpenAI-compatible providers with `apiType: "responses"` (`custom-providers.md`). `codex` and `grok-cli` use this family too but need OAuth (SP16).
- **UI:** no new screen for the catalog provider (`connectable` from `GET /api/providers`); the custom provider form gets an API select (`custom-providers.md`).

**User decision (2026-09-26), mixed:** the request translation and the stream keep 9router's behavior, including the rules labeled `SUSPECTED_BUG`; the non-streaming answer is corrected, because 9router returns an empty message there.

## Matrix entries

| Entry | Label | AIGate |
|---|---|---|
| `translator.openai-to-responses-request` | `REFERENCE_BEHAVIOR` | See "Request". |
| same: dropped fields, first system message only, parts as JSON text, `{}` arguments, cut names | `SUSPECTED_BUG`, kept by decision | Kept, except the system prompt (see "Request"). |
| `translator.responses-to-openai-stream` | `REFERENCE_BEHAVIOR` | See "Stream". |
| same: error as text, cut-off as complete, incomplete as stop, refusals dropped | `SUSPECTED_BUG`, kept by decision | Kept. |
| `routing.responses-non-stream-answer` | `SUSPECTED_BUG`, corrected by decision | See "Non-streaming answer". |

## Request (CIP → Responses, 9router)

| CIP | Responses |
|---|---|
| `model` | `model` |
| — | `store: false`; `stream: true` for a streaming client, **`false` for a non-streaming one** (the correction; 9router always sends `true`) |
| `system` text parts | `instructions`, joined with `\n`; `""` when there is none. CIP (SP10) keeps the leading system messages as one prompt, so **every** leading system message is included; 9router keeps only the first (the one deviation the protocol forces). |
| user `text` / `image` | `{ type: "message", role: "user", content: [{ type: "input_text", text } \| { type: "input_image", image_url, detail: detail ?? "auto" }] }` |
| user `audio`, `file`, … | `input_text` whose text is the JSON of the OpenAI chat part (9router) |
| assistant `text` | `output_text` in an assistant message item (no item when there is no text) |
| assistant `tool_call` | `{ type: "function_call", call_id, name, arguments }` after the message item; `call_id` cut to 64 characters (generated `call_<ms>_<n>` when empty); `name` trimmed and cut to 128; a nameless call is skipped; arguments that do not parse as JSON become `"{}"` |
| `tool_result` | `{ type: "function_call_output", call_id, output }`, the output being the text parts (or the JSON of any other part) concatenated |
| `tools` | `{ type: "function", name (trimmed, cut to 128; nameless dropped), description ?? "", parameters (an object schema gets `properties: {}`), strict? }` |
| `temperature`, `topP` | `temperature`, `top_p` |
| `maxOutputTokens` | `max_output_tokens` (a client `max_output_tokens` wins) |
| `reasoning.effort` (or a non-standard `reasoning_effort`) | `reasoning: { effort, summary: "auto" }`; `reasoning.budgetTokens` → `UnsupportedFeatureError` |
| `vendorExtensions.openai` `reasoning`, `service_tier`, `prompt_cache_key` | copied |
| `toolChoice`, `stop`, and every other `vendorExtensions.openai` field (`response_format`, `parallel_tool_calls`, `user`, `seed`, …) | **dropped silently** (9router) |
| other `vendorExtensions` namespaces | `UnsupportedFeatureError` |

Auth: `Authorization: Bearer <key>` (the catalog entry); `accept` follows the stream flag.

## Non-streaming answer (corrected)

`execute()` posts `stream: false` and reads the Responses object (at most 4 MiB):

| Responses | CIP |
|---|---|
| `id`, `model` | `id`, `model` (the requested model when absent) |
| `reasoning` items, `summary[].text` | one `thinking` part |
| `message` items, `output_text` | one `text` part |
| `message` items, `refusal` | `vendorExtensions.openai.refusal` (rendered as `message.refusal`, like SP9) |
| `function_call` / `custom_tool_call` | `tool_call { id: call_id, name, arguments (or input) }`; a missing `call_id` or `name` → `PROVIDER_UNAVAILABLE` |
| any other item (web search, file search, …) | ignored |
| stop reason | a tool call → `tool_use`; `status: "incomplete"` with `max_output_tokens` → `max_tokens`, with `content_filter` → `content_filter`; a refusal without text → `content_filter`; else `end_turn` |
| `status: "failed"` | `PROVIDER_UNAVAILABLE` with the bounded, redacted `error.message` |
| no `output` array | `PROVIDER_UNAVAILABLE` |
| `usage` | `inputTokens = input_tokens − cached_tokens`, `cacheReadTokens = input_tokens_details.cached_tokens`, `outputTokens = output_tokens`, `reasoningTokens = output_tokens_details.reasoning_tokens` |

## Stream (Responses SSE → StreamChunk, 9router)

| Event | Chunk |
|---|---|
| first event of any type | `start { id: "", model: requested model }` (9router makes a new `chatcmpl-<ms>` id; the renderer does the same) |
| `response.output_text.delta` | `text_delta` |
| `response.reasoning_summary_text.delta` | `thinking_delta` |
| `response.output_item.added` (`function_call` / `custom_tool_call`) | `tool_call_delta { index (next, keyed by the item id), id: call_id, name }`; at most 128 tool calls |
| `response.function_call_arguments.delta` / `custom_tool_call_input.delta` | `tool_call_delta { argumentsDelta }` routed by `item_id`, else to the last call |
| `response.output_item.done` with `arguments` | sent once, only if that call got no delta |
| `response.completed` / `response.done` | `usage` (as above), then `stop` (`tool_use` if any call, else `end_turn`); later events are not read |
| `error` / `response.failed` with an error | **`text_delta "[Error] <message>"`** (bounded, key redacted), then `stop end_turn` |
| end of body without `completed` | **a normal `stop`** (no error) |
| `response.incomplete`, refusal deltas, unparsable lines, other events | ignored |

A non-SSE answer to a streaming request is `PROVIDER_UNAVAILABLE` (as in SP9). HTTP errors, retries, and redaction are the shared `HttpProviderAdapter` rules (`provider-openai.md`).

## Models and connection test

Inherited from `OpenAICompatibleAdapter`: `GET <modelsUrl>` (`https://api.perplexity.ai/v1/models`; `<base>/models` for a custom provider).

## Matrix

`translator.openai-to-responses-request`, `translator.responses-to-openai-stream`, `routing.responses-non-stream-answer`, and `connection.provider-node-api-type` are `implemented`.
