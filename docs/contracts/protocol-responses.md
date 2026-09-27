# OpenAI Responses client protocol contract (M2 SP15b)

Scope, per spec §9 (SP15, protocol adapters for the client formats): Responses clients (Codex CLI, the OpenAI SDK `responses` API) call AIGate at `POST /v1/responses`, `POST /v1/responses/compact`, and 9router's aliases `POST /responses` and `POST /codex/*`. The body becomes CIP through 9router's Responses → chat pivot (`parseOpenAIResponsesRequest`), is prepared for the resolved provider (`responsesRequestFor`), goes through the provider's adapter, and the answer is rendered back (`toResponsesObject`, `ResponsesStreamEncoder`). The lane is the chat lane (`chat-lane.md`): same key gate, resolution, backpressure, idle timeout. Gemini clients (SP15c) come next.

**User decisions (2026-09-27).** Keep 9router on every point: the request drops and copied fields for non-Responses providers (tool_choice in the Responses shape, other fields copied into the chat body, hosted tools and unknown items dropped); the SSE events (reasoning, text and the first tool call share output_index 0, response.completed carries no output, status is always completed, a mid-stream failure is the chat error frame and `[DONE]`); the non-streaming answer (an omitted `stream` streams, a response object only for an openai or Responses provider, status is the chat finish reason); and `/compact` (an ordinary answer, `_compact` copied upstream).

## Matrix entries

| Entry | Label | AIGate |
|---|---|---|
| `translator.responses-client-request` | `REFERENCE_BEHAVIOR` | See "Request" and "The request a provider receives". |
| same: tool_choice raw, input_file raw, fields copied, hosted tools dropped | `SUSPECTED_BUG`, kept | As 9router, except where CIP cannot hold it (below). |
| `translator.openai-to-responses-client-response` | `REFERENCE_BEHAVIOR` | See "Answer" and "Stream". |
| same: output_index 0, completed without output, status, error frame, chat.completion for some providers | `SUSPECTED_BUG`, kept | As 9router. |
| `routing.responses-compact-lane` | `SUSPECTED_BUG`, kept | `_compact: true` is added to the body; no provider compacts (codex is not ported). |
| `endpoint.rewrite-lanes` | `REFERENCE_BEHAVIOR` | `/responses` and `/codex/*` (and `/codex`) serve `/v1/responses`; `/v1/v1/*` and `/v1beta/*` are not served yet. |

## Routes and auth

- `POST /v1/responses`, `/v1/responses/compact`, `/responses`, `/codex`, `/codex/*` (any suffix is ignored, as in 9router), JSON bodies up to 16 MiB, behind the chat lane's key gate (`Authorization: Bearer <key>` or `x-api-key`).
- Errors are the lane's OpenAI shape `{ error: { message, type, code, param } }` (kept from 9router).

## Request (9router's Responses → chat pivot, in CIP)

| Responses | CIP |
|---|---|
| `model` | `model` (required, 1–256 printable characters) |
| `input` string | one user message; a blank string → `"..."` |
| `input` array | items below; an empty array → one user message `"..."`; missing, `""`, or another type → 400 `input` |
| `instructions` | the first system text |
| message item (`type: message`, or a `role` without `type`) | user or assistant message; `system` and `developer` messages join the CIP system prompt |
| `input_text`, `output_text` | text |
| `input_image` | image (`image_url`, else `file_id`, as an http(s) or base64 data URL; `detail` low/high/auto, default auto) |
| any other part (`input_file`, `refusal`, …) | refused: `unsupported_feature` "AIGate cannot carry input_file content" (9router copies it raw) |
| consecutive `function_call` / `custom_tool_call` | one assistant turn of tool calls; a call without a name is skipped; custom input → arguments `{"input": …}` |
| `function_call_output` / `custom_tool_call_output` | a tool message; a non-string output becomes its JSON text |
| `reasoning` | thinking at the start of the next assistant turn (summary texts joined with a newline, else content texts; several items joined with a newline); `encrypted_content` → the thinking signature; a user or system message in between drops it |
| `additional_tools` | more tools |
| other item types (`item_reference`, `web_search_call`, …) | dropped |
| `tools` | function tools (`parameters` missing → `{ type: object, properties: {} }`; an object without properties gets `properties: {}`; `strict` kept); custom tools → a function with one required string `input` and the format syntax and definition after the description; chat-shaped tools pass; hosted tools (no name) dropped |
| `tool_choice` auto / none / required | the same choice; any other value is copied as sent into `vendorExtensions.openai.tool_choice` |
| `max_tokens`, else `max_output_tokens` | `maxOutputTokens` |
| `temperature`, `top_p` | `temperature` (0–2), `topP` (0–1) |
| `reasoning.effort` low/medium/high | `reasoning.effort`; another value → `vendorExtensions.openai.reasoning_effort` |
| `stream` | `stream`; **an omitted `stream` streams** unless `Accept` has `application/json` and not `text/event-stream` (9router, kept) |
| `include`, `prompt_cache_key`, `store`, `client_metadata` | deleted |
| every other field (`text`, `previous_response_id`, `truncation`, `metadata`, `parallel_tool_calls`, `service_tier`, `user`, `_compact`, …) | `vendorExtensions.openai`, as sent (at most 64 fields) |

## The request a provider receives

- **Responses provider** (`openai-responses`: perplexity-agent, custom nodes with the Responses API): the client body unchanged, with the upstream model id and the stream decision (9router's same-format passthrough). The adapter sends `vendorExtensions.responses` as the body.
- **OpenAI-compatible provider** (including stream-only ones): the pivot, with every copied field spread into the chat body by the adapter; reasoning history goes back as `reasoning_content` on the assistant message and its signature as `encrypted_content`.
- **Every other provider** (anthropic, gemini, vertex, ollama, commandcode): the pivot without `vendorExtensions` (9router's openai → target translators build a new body); reasoning history is removed for anthropic and ollama, whose 9router translators ignore `reasoning_content`.

## Answer (non-streaming)

- Openai-compatible and Responses providers: `{ id: resp_<id without "chatcmpl-"> (a Responses provider's own resp_ id kept), object: "response", created_at, model (else "unknown"), status, background: false, error: null, output, usage: { input_tokens, output_tokens, total_tokens } }`.
- `output`: a `reasoning` item `{ summary: [{ summary_text }] }`, a `message` item `{ role: assistant, content: [{ output_text, text, annotations: [] }] }`, then `function_call { id: fc_<call id>, call_id, name, arguments }` or, for a custom tool, `custom_tool_call { id: ctc_<call id>, call_id, name, input }` (the `{ input }` wrapper removed).
- `status`: `completed` for stop and tool_calls, otherwise the chat finish reason (`length`, `content_filter`), kept.
- **Every other provider** (anthropic, gemini, vertex, ollama, commandcode): the OpenAI `chat.completion` (kept).

## Stream

Frames are `event: <type>\ndata: <json>\n\n`; every event carries `sequence_number` from 1.
1. `response.created` `{ id: resp_<chat id>, object, created_at, status: in_progress, background: false, error: null, output: [] }`, `response.in_progress`.
2. Reasoning (thinking, or text inside `<think>…</think>`): `output_item.added { id: rs_<resp>_0, type: reasoning, summary: [] }`, `reasoning_summary_part.added`, `reasoning_summary_text.delta`; closed with `reasoning_summary_text.done`, `reasoning_summary_part.done`, `output_item.done`.
3. Text: `output_item.added { id: msg_<resp>_0, type: message }`, `content_part.added`, `output_text.delta`; closed (by a tool call or the stop) with `output_text.done`, `content_part.done`, `output_item.done`.
4. Tool calls: `output_item.added { id: fc_<call id>, type: function_call, arguments: "", call_id, name }` once the id and name are known, `function_call_arguments.delta` as arguments arrive; at the stop `function_call_arguments.done` and `output_item.done`. A custom tool's input is sent only at the stop: `custom_tool_call_input.delta` and `.done` with the unwrapped input.
5. `output_index` is 0 for reasoning and text and the tool index for tools (kept).
6. `response.completed { id, object, created_at, status: completed, background: false, error: null, usage? }`: on an openai-compatible provider it waits for the usage chunk after the finish (sent at the stop when usage is known, else when the upstream ends); on every other provider it is sent at the stop with the usage known by then. No `[DONE]`.
- A failure after the first byte is `data: {"error": <OpenAI error>}` then `data: [DONE]` (kept); a failure before it is a normal JSON error.

## Other deviations

- CIP holds one system prompt, so a `system` or `developer` message joins it instead of keeping its place (9router keeps it in place for chat providers).
- A part CIP cannot hold (`input_file`, `refusal`) and an image URL that is not http(s) or base64 are refused with a 400 instead of reaching the provider raw.
- A body without `input` is a 400 (9router passes it on untranslated).
- A Responses provider's answer goes through CIP (the Responses adapter) and is rendered again: server-side items (web search calls, …) are not repeated to the client.

## Matrix

`translator.responses-client-request`, `translator.openai-to-responses-client-response` and `routing.responses-compact-lane` are `implemented`.
