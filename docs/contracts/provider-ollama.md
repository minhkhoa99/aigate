# Ollama provider contract (M2 SP14d)

Scope, per spec §9 (SP14, provider adapters by protocol family): one `AIProviderPort` for the `ollama` family, over `HttpTransportPort`. It maps CIP to `POST <host>/api/chat` and back, JSON and NDJSON. `createAdapter` picks it for `protocol: "ollama"`.
- **Served:** `ollama` (Ollama Cloud, API key) and `ollama-local` (optional key, a host per connection). The catalog now has **52** connectable providers.
- **Also in SP14d:** `assemblyai` and `deepgram` (speech-to-text only; the catalog called them openai-compatible because their 9router entries have no format) now say "Media and search services come with SP22/SP23". `nanobanana` (image-only, connectable since SP13) is unchanged; SP22 decides.
- **UI:** the Connections Add modal has a Host field and an optional key for Ollama Local; its row shows the host and an Edit button (`connections.md`).

**User decision (2026-09-26): correct behavior** where 9router drops fields, attachments, error lines, or a cut-off.

## Matrix entries

| Entry | Label | AIGate |
|---|---|---|
| `translator.openai-to-ollama-request` | `REFERENCE_BEHAVIOR` | See "Request". |
| same: dropped stop/seed/format/think/penalties, max_tokens only, URL images, image-only turns, empty tool results | `SUSPECTED_BUG`, corrected | Mapped or refused; nothing is dropped. |
| `translator.ollama-to-openai-response` | `REFERENCE_BEHAVIOR` | See "Answer" and "Stream". |
| same: error lines dropped, cut-off streams complete | `SUSPECTED_BUG`, corrected | Both are errors. |
| `connection.ollama-local-host` | `REFERENCE_BEHAVIOR` | See "ollama-local". |

## Request (CIP → /api/chat)

| CIP | Ollama |
|---|---|
| `model`, `stream` | `model`, `stream` (always a boolean) |
| `system` text parts | a first `{ role: "system", content }`, parts joined with `\n` |
| user `text` | `content` (parts joined with `\n`) |
| user `image` base64 | `images: [<raw base64>]`; an image-only turn is kept with `content: ""` |
| user `image` by URL, `detail` other than `auto`, `audio`, `video`, `file` | `UnsupportedFeatureError` |
| assistant `text`, `tool_call` | `{ role: "assistant", content, tool_calls: [{ type: "function", function: { name, arguments: <object> } }] }`; arguments that are not a JSON object → `INVALID_REQUEST` |
| `tool_result` | `{ role: "tool", tool_name (from the assistant call with that id, else "unknown_tool"), content }`; an empty result is kept |
| `tools` | OpenAI shape `{ type: "function", function: { name, description, parameters } }` |
| `toolChoice` | `tool_choice` in the OpenAI shape (9router passes it; Ollama may ignore it) |
| `temperature`, `topP`, `maxOutputTokens`, `stop` | `options.temperature`, `options.top_p`, `options.num_predict`, `options.stop` |
| `vendorExtensions.openai` `seed`, `presence_penalty`, `frequency_penalty` | `options.*` |
| `vendorExtensions.openai.response_format` | `format`: `json_object` → `"json"`, `json_schema` → its schema, `text` → none, other → `UnsupportedFeatureError` |
| `reasoning.effort` | `think: "low" \| "medium" \| "high"`; `reasoning_effort: "none"` → `think: false`; any other non-standard effort, and `reasoning.budgetTokens` → `UnsupportedFeatureError` |
| any other `vendorExtensions.openai` field, other namespaces | `UnsupportedFeatureError` naming the field |

Auth: `Authorization: Bearer <key>`; a keyless ollama-local connection sends no auth header. `accept` is `application/x-ndjson` when streaming.

## Answer (JSON body)

`message.thinking` → `thinking`, `message.content` → `text`, `message.tool_calls` → `tool_call { id: tc.id or call_<i>_<ms>, name, arguments: JSON string }` (a nameless call → `PROVIDER_UNAVAILABLE`); stop reason: a tool call → `tool_use`, `done_reason` `length`/`max_tokens` → `max_tokens`, else `end_turn`; usage `inputTokens = prompt_eval_count`, `outputTokens = eval_count`. A body with `error` → `PROVIDER_UNAVAILABLE` (bounded, redacted message). The id is the renderer's; the model is the answer's, else the requested one.

## Stream (NDJSON → StreamChunk)

Lines are read with `readJsonLines` (1 MiB per line; blank lines skipped). The first line starts the answer; `thinking` and `content` become deltas; each tool call arrives whole and gets the next index (at most 128); the `done: true` line gives usage and the stop reason and ends the answer. **Corrected:** a line with `error` → `PROVIDER_UNAVAILABLE` (a JSON error before the first chunk, an error event and no `[DONE]` after it); a line that is not a JSON object → `PROVIDER_UNAVAILABLE`; a body that ends without `done` → `PROVIDER_UNAVAILABLE` "ended the stream before it finished".

## ollama-local

- The key is optional (`auth.optional`); the connection is saved with `keyHint: "no key"`.
- The connection may carry a host (`baseUrl`); chat goes to `<host>/api/chat`, the model list and the connection test to `<host>/api/tags` (`withConnectionBaseUrl`, one trailing `/` removed). Without a host it is the catalog URL `http://localhost:11434`.
- The host must be `https`, or `http` to `localhost`, `127.0.0.1`, or `[::1]`, with no credentials, query, or fragment — the AIGate transport rule (9router accepts any URL, including http to another machine).
- The connection test is the adapter's `GET <modelsUrl>` (sent with the key when there is one); 2xx is active, 401/403 invalid, anything else unreachable with the reason.

## Models

`getModels` reads `/api/tags` `models[].model` (else `name`), at most 1000.

## Matrix

`translator.openai-to-ollama-request`, `translator.ollama-to-openai-response`, and `connection.ollama-local-host` are `implemented`.
