# Command Code provider contract (M2 SP14h)

Scope, per spec §9 (SP14, provider adapters by protocol family): one `AIProviderPort` for the `commandcode` family, over `HttpTransportPort`. It maps CIP to `POST https://api.commandcode.ai/alpha/generate` (an envelope with `params`) and reads NDJSON AI SDK v5 events back. `createAdapter` picks `CommandCodeAdapter` for `protocol: "commandcode"`.
- **Served:** `commandcode` (API key, "user_…"). The catalog now has **59** connectable providers.
- **UI:** no new screen; Command Code appears in the Connections Add modal like any API-key provider, and its test result uses the existing toasts.

**User decision (2026-09-27): keep 9router** for the request (drops and defaults) and for the stream (error text, cut-offs, finish mapping, usage), except the executor's implementation accidents: every NDJSON line is read (9router's peek loses the rest of the first read) and the OpenAI stream ends with `[DONE]` (9router's translate mode never sends it). **Corrected:** the connection test. Security, not a choice: an image by URL is refused (9router fetches it server-side) and `config.workingDir` is `/` (9router sends the server directory).

## Matrix entries

| Entry | Label | AIGate |
|---|---|---|
| `translator.openai-to-commandcode-request` | `REFERENCE_BEHAVIOR` | See "Request". |
| same: drops, 64000/0.3 defaults, developer as user, `{}` for bad arguments, empty toolName | `SUSPECTED_BUG`, kept | As 9router, with the forced deviations below. |
| `translator.commandcode-to-openai-response` | `REFERENCE_BEHAVIOR` | See "Stream" and "Non-streaming clients". |
| same: error text replaced, cut-off complete, error finish as stop, usage details dropped | `SUSPECTED_BUG`, kept | As 9router. |
| same: lines lost in the peek, no `[DONE]` | `IMPLEMENTATION_ACCIDENT` | Every line read; `[DONE]` sent. |
| `connection.commandcode-key-test` | `REFERENCE_BEHAVIOR` | See "Connection test". |
| same: Test "not supported", validate passes an in-band error | `SUSPECTED_BUG`, corrected | A ping that reads the first event. |

## Request (CIP → envelope)

```
{ threadId: <uuid>, memory: "", config: { workingDir: "/", date: "YYYY-MM-DD", environment: <process.platform>, structure: [], isGitRepo: false,
  currentBranch: "", mainBranch: "", gitStatus: "", recentCommits: [] }, params, model, stream: true }
```

| CIP | params |
|---|---|
| `model` | `model` (and the envelope `model`) |
| `system` text parts | `system`, parts joined with a blank line |
| user `text` | `{ type: "text", text }` |
| user `image` base64 | `{ type: "image", image: "data:<mime>;base64,<data>", mimeType, mediaType }` |
| user `image` by URL | `UnsupportedFeatureError` (security; 9router downloads it) |
| user audio, file, other parts | dropped (kept) |
| assistant | `[{ type: "reasoning", text: <thinking> or " " when there are tool calls }, { type: "text", text }, { type: "tool-call", toolCallId, toolName, input: <parsed arguments, {} when they do not parse> }]` |
| `tool_result` | `{ role: "tool", content: [{ type: "tool-result", toolCallId, toolName: "", output: { type: "text", value } }] }` |
| `tools` | `[{ name, description, input_schema: parameters or { type: "object" } }]` (`strict` dropped) |
| `maxOutputTokens` | `max_tokens`, default **64000** |
| `temperature` | `temperature`, default **0.3** |
| `topP` | `top_p` when set |
| reasoning | `reasoning_effort`: the effort level (`xhigh`, `max`, `auto` pass through); a budget → level (9router's table, else `medium`); `none`/`off` → left out |
| `toolChoice`, `stop`, `vendorExtensions.openai.*` (response_format, seed, penalties, …) | dropped silently (kept) |
| other `vendorExtensions` namespaces | `UnsupportedFeatureError` |

Headers: `x-command-code-version: 0.25.7`, `x-cli-environment: cli` (catalog), `x-session-id: <uuid>` per attempt, `Authorization: Bearer <key>`, `Accept: text/event-stream`, `Content-Type: application/json`.

**Forced deviations (CIP):** a `developer` message is part of the system prompt (9router makes it a user message); `max_completion_tokens` is honored like `max_tokens` (9router ignores it and sends 64000).

## Stream (NDJSON → StreamChunk)

- Lines are read with `readJsonLines` (1 MiB per line); a `data:` prefix is tolerated; unparsable lines and events without `type` are skipped.
- **Before the first content event** (`text-delta`, `reasoning-delta`, `tool-input-start`, `tool-call`, `finish`, `finish-step`): an `error` event is an error with the event's `statusCode`/`status` (400–599), else a status guessed from the message (rate limit 429, unauthorized/invalid api key/authentication 401, payment required/billing 402, quota/forbidden/permission 403, not found 404, else 503), classified like an HTTP status, message "Command Code answered <status>: [CommandCode error: <message>]". A 502/503/504 (HTTP or in-band) is retried, up to 3 attempts, each with a new session id.
- `text-delta` (`text`, else `delta`) → text; `reasoning-delta` (`text`) → thinking; `tool-input-start` → a tool call (id from `id`, `toolCallId`, else `call_<n>_<ms>`), `tool-input-delta` → its arguments (unknown ids dropped), `tool-call` → a whole call only when its id is new; at most 128 calls.
- `finish-step` stores its mapped reason and usage (last wins); `finish` sends usage (`totalUsage`, else the stored one) and the stop reason (stored, else `finish`'s own, else stop), then ends. Reasons: `stop` → end_turn, `length` → max_tokens, `tool-calls`/`tool_use` → tool_use, `content-filter` → content_filter, `error` and anything else → end_turn (9router passes unknown reasons raw; CIP has no raw form). Usage: `inputTokens`, `outputTokens` only.
- **Kept:** an `error` event after content ends the stream with `PROVIDER_UNAVAILABLE` "upstream connection lost" (the upstream message is not shown); a stream that ends without `finish` ends with end_turn; `tool-error` and `abort` events are ignored.
- The start chunk is `chatcmpl-<ms>` with the requested model.

## Non-streaming clients

`execute()` collapses the stream (forceStream): text joined; reasoning kept only when there is no text; tool calls merged by index (then tool_use); usage from the stream. **Kept:** a mid-stream error → "Command Code sent a stream that failed: Failed to convert streaming response to JSON"; a stream with no content or finish → "…: Invalid SSE response".

## Connection test (corrected)

A one-token ping (`params.max_tokens: 1`, the first catalog model, "ping"), one attempt, read up to the first content event: HTTP 401/403 or an in-band authentication error → `invalid` ("Command Code answered 401: Invalid 'Authorization' header or token." — checked live 2026-09-27 with a fake key); a billing/quota answer → `no_quota`; a content event → `active`; anything else → `unreachable`.

## Models

`getModels` returns the 22 catalog models without calling Command Code, as 9router does.

## Matrix

`translator.openai-to-commandcode-request`, `translator.commandcode-to-openai-response`, and `connection.commandcode-key-test` are `implemented`.
