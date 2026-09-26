# Anthropic Messages client protocol contract (M2 SP15)

Scope, per spec §9 (SP15, protocol adapters for the client formats): Anthropic clients (Claude Code, the Anthropic SDK) call AIGate at `POST /v1/messages` and `POST /v1/messages/count_tokens`. The body becomes CIP (`parseAnthropicMessagesRequest`), is prepared for the resolved provider (`anthropicRequestFor`), goes through the provider's adapter, and the answer is rendered back (`toAnthropicMessage`, `AnthropicStreamEncoder`). The lane is the chat lane (`chat-lane.md`): same key gate, resolution, backpressure, idle timeout. Responses (SP15b) and Gemini (SP15c) clients come next.

**User decisions (2026-09-27).** Keep 9router: errors stay OpenAI-shaped for every client protocol; an omitted `stream` streams; a non-streaming client gets a `chat.completion` unless the provider is openai-compatible (not stream-only) or Anthropic; the claude→openai request rules (drops and adjustments) for non-Anthropic providers; history thinking, cache_control and documents kept for Anthropic providers and dropped silently for others. Correct: real usage (no 2000-token buffer, no estimates, the usage that arrives after the finish is used), tool arguments streamed as they come, blocks opened when the call id and name are known, and `signature_delta`.

## Matrix entries

| Entry | Label | AIGate |
|---|---|---|
| `translator.claude-client-request` | `REFERENCE_BEHAVIOR` | See "Request". |
| same: stop_sequences, top_p, is_error, URL images dropped; tool_choice none → auto | `SUSPECTED_BUG`, kept | As 9router, for non-Anthropic providers. |
| `translator.openai-to-claude-client-response` | `REFERENCE_BEHAVIOR` | See "Answer" and "Stream". |
| same: +2000 usage and estimates; arguments buffered; no signature_delta | `SUSPECTED_BUG`, corrected | Real usage, live arguments, signature_delta. |
| same: chat.completion for some providers; OpenAI error shapes | `SUSPECTED_BUG`, kept | As 9router. |
| `routing.count-tokens-estimate` | `REFERENCE_BEHAVIOR` | See "count_tokens". |

## Routes and auth

- `POST /v1/messages` and `POST /v1/messages/count_tokens`, JSON bodies up to 16 MiB, behind the chat lane's key gate: `Authorization: Bearer <key>` or `x-api-key: <key>` (`endpoint.extract-header-order`); with Require API key off, this machine only.
- Errors are the lane's OpenAI shape `{ error: { message, type, code, param } }` with the lane's statuses (kept from 9router).

## Request (Anthropic body → CIP)

| Anthropic | CIP |
|---|---|
| `model` | `model` (required, 1–256 printable characters) |
| `max_tokens` | `maxOutputTokens` (positive integer) |
| `stream` | `stream`; **an omitted `stream` streams** unless `Accept` has `application/json` and not `text/event-stream` (9router, kept) |
| `system` (string or text blocks) | `system` text parts, with `cacheControl` for `cache_control` |
| a `role: "system"` message | a user message `<instructions>\n<text>\n</instructions>` (9router) |
| roles `user`, `tool` | user; any other role → assistant |
| `text` | text (+ `cacheControl`) |
| `image` base64 / url | image base64 / url |
| `document` base64 / url / text | file (PDF) / file by URL / text |
| `tool_use` | tool_call (arguments = JSON of `input`) |
| `tool_result` | tool_result (text and base64 image parts; other inner blocks as JSON text; `isError`) |
| `thinking` / `redacted_thinking` | thinking with `signature` / thinking `redacted` |
| other blocks (search_result, server_tool_use, …) | not in CIP: noted as Anthropic-only |
| `tools` | tool definitions (`input_schema`, else `{ type: object, properties: {} }`); a server tool (a type without a schema) is noted as Anthropic-only |
| `tool_choice` auto / any / tool / none | auto / required / `{ name }` / none; `disable_parallel_tool_use` → `vendorExtensions.openai.parallel_tool_calls: false` |
| `temperature`, `top_p`, `stop_sequences` | `temperature`, `topP`, `stop` |
| `thinking { type: enabled, budget_tokens }` | `reasoning.budgetTokens`, only when the last message is from the user (normalizeThinkingConfig) |
| adaptive/disabled `thinking`, `top_k`, `metadata`, and every other field | `vendorExtensions.anthropic`, as sent (at most 64 fields) |

A tool call without a tool_result in the next user turn gets a `[No response received]` result (9router).

## The request a provider receives

- **Anthropic provider** (anthropic, anthropic-compatible nodes): the parsed request unchanged; the Anthropic adapter (`provider-anthropic.md`) spreads `vendorExtensions.anthropic` into the body, so it is close to 9router's passthrough. A block or server tool CIP cannot hold → `unsupported_feature` "AIGate cannot carry … on this path" (9router passes them through; known gap).
- **Every other provider** (9router's claude→openai rules, kept):
  - thinking, `cache_control`, URL images, documents, `is_error` dropped; a turn left empty is removed;
  - tool_result text joined with a newline; its images follow in the user turn after `[Image from tool result <id>]`;
  - system text parts joined with a newline, a leading `x-anthropic-billing-header:` line removed;
  - `max_tokens` → at least 32000 with tools, `budget + 1024` when not above the budget, at most 64000;
  - tool descriptions default to `""`; `tool_choice` none → auto;
  - `stop_sequences`, `top_p`, `top_k`, `metadata`, parallel flag, and other fields dropped;
  - a thinking budget stays a budget for gemini, vertex and commandcode; otherwise it becomes an effort (low/medium/high, else `reasoning_effort` minimal/xhigh/max in `vendorExtensions.openai`).

## Answer (non-streaming)

- Openai-compatible (not stream-only) and Anthropic providers: `{ id (without "chatcmpl-", else msg_<request id>), type: "message", role: "assistant", model, content: [thinking (with signature) | redacted_thinking | text | tool_use { id, name, input }], stop_reason, stop_sequence: null, usage }`; no content → one empty text block.
- **Every other provider** (gemini, vertex, ollama, responses, commandcode, stream-only providers): the OpenAI `chat.completion` (9router, kept).
- Stop reasons: end_turn → `end_turn`, max_tokens → `max_tokens`, tool_use → `tool_use`, content_filter → `refusal`, stop_sequence → `stop_sequence`.
- Usage (corrected): `input_tokens` (without cache), `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens` when non-zero; no buffer, no estimate.

## Stream

Frames are `event: <type>\ndata: <json>\n\n`:
1. `message_start` (usage 0/0; the id as above; the model from the provider).
2. Thinking: `content_block_start { type: thinking }`, `thinking_delta`, and **`signature_delta`** when the provider sends a signature (corrected).
3. Text: `content_block_start { type: text }`, `text_delta`. A text or thinking block closes when the other kind starts.
4. Tool calls: `content_block_start { type: tool_use, id, name, input: {} }` when a call first appears, then **`input_json_delta` as the arguments arrive** (corrected). Tool blocks stay open until the stop, so interleaved calls keep every argument. Claude Code's `Read` tool is the exception: its arguments are buffered and sanitized (limit/offset as numbers, limit ≤ 2000, `pages` only for a .pdf), as 9router does.
5. At the stop: open blocks close, `message_delta { stop_reason, stop_sequence: null, usage }` with the real usage (including a usage chunk that came after the finish), then `message_stop`. No `ping`, no `[DONE]`.
- A failure after the first byte is `event: error` with `{ type: "error", error: <the OpenAI error object> }` (9router's Claude error event, kept); a failure before it is a normal JSON error.

## count_tokens

`POST /v1/messages/count_tokens` answers `{ input_tokens: ceil(chars / 4) }` from the system, tools and messages (keys included in object counts; tool_use counts name + input, tool_result its content, thinking its text; other blocks every field), as 9router estimates it. The model is ignored and no provider is called.

## Other deviations

- The openai provider (forceStream in 9router, not stream-only in AIGate since SP3) gets a message object for non-streaming clients.
- 9router's native Claude CLI passthrough (skipping translation for claude-cli user agents) is not separate: every request goes through CIP.

## Matrix

`translator.claude-client-request`, `translator.openai-to-claude-client-response`, and `routing.count-tokens-estimate` are `implemented`.
