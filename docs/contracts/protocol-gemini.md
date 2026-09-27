# Gemini client protocol contract (M2 SP15c)

Scope, per spec §9 (SP15, protocol adapters for the client formats): Gemini clients (Gemini CLI, the `@google/genai` SDK) call AIGate at `POST /v1beta/models/{model}:generateContent` and `:streamGenerateContent`, and list models at `GET /v1beta/models`. The body becomes CIP through 9router's text-only conversion (`parseGeminiGenerateRequest`), goes through the chat lane exactly like an OpenAI client (`chat-lane.md`: resolution, adapter, backpressure, idle timeout), and the answer is rendered back (`toGeminiResponse`, `GeminiStreamEncoder`). A TTS request is forwarded to Google unchanged (`geminiTtsRequest`).

**User decisions (2026-09-27).** Keep 9router: the text-only request (three settings); the answer without tool calls, without OpenAI's trailing usage, and with a mid-stream error ending the stream silently; the chat path reading only `Authorization` and `x-api-key`; the model id cut at the second path segment; any action other than `:streamGenerateContent` running a generation; `GET /v1beta/models` listing the whole catalog without a key. Port now (not deferred to the media SP): the TTS passthrough. A data line split across two network reads is not lost (9router's implementation accident; CIP streams have no such split).

## Matrix entries

| Entry | Label | AIGate |
|---|---|---|
| `translator.gemini-client-request` | `REFERENCE_BEHAVIOR`, `SUSPECTED_BUG` kept | See "Path, key and request". |
| `translator.openai-to-gemini-client-response` | `REFERENCE_BEHAVIOR`, `SUSPECTED_BUG` kept, `IMPLEMENTATION_ACCIDENT` dropped | See "Answer" and "Stream". |
| `catalog.v1beta-models-listing` | `REFERENCE_BEHAVIOR` | See "Model list". |
| `catalog.v1beta-generate-content-dispatch` | `REFERENCE_BEHAVIOR` | See "TTS passthrough". |
| `endpoint.rewrite-lanes` | `REFERENCE_BEHAVIOR` | `/v1beta/models` and `/v1beta/models/*` are served; `/v1/v1/*` is not served yet. |

## Path, key and request

- `POST /v1beta/models/*`, JSON bodies up to 16 MiB. The path after `models/` is split on `/`: two or more segments → `<first>/<second>` (later segments ignored), one segment → the model. The action is removed from the model; only `:streamGenerateContent` streams, and any other action (`:countTokens`) stays in the model name, which then fails resolution. `?alt=sse` is not needed.
- Key: in the `onRequest` hook, a request with no key at all is refused (401 `missing_api_key`); keyless mode serves this machine only (403 `api_key_required`), as on every lane. The handler then checks the key the path reads: the chat path reads `Authorization: Bearer`, then `x-api-key` (so `x-goog-api-key` alone is a 401, kept); the TTS path reads `Authorization: Bearer`, then `x-goog-api-key`, then `?key=` (not `x-api-key`).
- Request (9router's `convertGeminiToInternal`): `systemInstruction.parts[].text` joined with a newline → the system prompt (none when empty); each `contents[]` → a message, role `model` → assistant and any other role → user, text = `parts[].text` joined with a newline, a part without text counting as an empty string; `generationConfig.maxOutputTokens` (positive integer), `temperature` (0–2), `topP` (0–1). Everything else (tools, toolConfig, images, function calls and responses, stopSequences, responseSchema, thinkingConfig, safetySettings) is dropped.
- The request is then an ordinary chat request: `provider/model` or a bare id resolves as on `/v1/chat/completions`, and the resolved provider's adapter serves it.
- Errors before the first byte are the lane's OpenAI shape `{ error: { message, type, code, param } }` (9router passes handleChat's errors through). A body that is not JSON is the lane's 400 `invalid_json` (9router answers 500).

## Answer (non-streaming)

`{ candidates: [{ content: { role: "model", parts: [{ text, thought: true }?, { text: content or "" }] }, finishReason, index: 0 }], modelVersion: the provider's model (else the path model), usageMetadata: { promptTokenCount, candidatesTokenCount, totalTokenCount, thoughtsTokenCount? } }`. Tool calls are dropped. finishReason: stop → STOP, length → MAX_TOKENS, tool_calls → STOP, content_filter → SAFETY, anything else → STOP.

## Stream

Frames are `data: <json>\r\n\r\n`, no event names and no `[DONE]`:
- thinking → `{ candidates: [{ content: { role: "model", parts: [{ text, thought: true }] }, index: 0 }] }`; text → the same with `{ text }`; empty deltas, tool calls and images are dropped.
- The stop → `parts: [{ text: "" }]` with `finishReason` (as above). `usageMetadata` and `modelVersion` are added only when the provider reports usage with its finish, which is every provider except the openai-compatible family (OpenAI's usage arrives in a trailing chunk, dropped as in 9router).
- A failure after the first byte ends the stream with nothing more (9router drops the error frame, kept).

## Model list

`GET /v1beta/models`, no key (9router): every catalog model (all 121 providers, every kind) as `{ name: "models/<first alias or id>/<model>", displayName, description: "<key> model: <name>", supportedGenerationMethods: ["generateContent"], inputTokenLimit: 128000, outputTokenLimit: 8192 }`, and every gemini model again as `models/<model>` with `["generateContent", "streamGenerateContent"]`. Duplicate names are listed once.

## TTS passthrough

- Applies when `generationConfig.responseModalities` contains `AUDIO` (any case) or the model is a Gemini TTS model (the catalog's gemini models of kind `tts`), unless the model is under another provider prefix (`openai/…`); `models/` and `gemini/` prefixes are removed.
- The body goes unchanged to `https://generativelanguage.googleapis.com/v1beta/models/<model><action>` with the client's query minus `key`, `content-type: application/json` and the gemini connection's key in `x-goog-api-key`; 45 s for the whole exchange.
- The model must match `^[a-zA-Z0-9_.:-]+$` (400 `model`); no active gemini connection → 503 `no_active_connection`; network failure 502, timeout 504.
- Google's answer comes back as it is: status and body, with only its `content-type` (other upstream headers, cookies included, are not forwarded onto the dashboard's origin; 9router forwards them).
- AIGate has one connection per provider, so there is no fallback across gemini accounts (9router loops over them).

## Matrix

`translator.gemini-client-request`, `translator.openai-to-gemini-client-response`, `catalog.v1beta-models-listing` and `catalog.v1beta-generate-content-dispatch` are `implemented`.
