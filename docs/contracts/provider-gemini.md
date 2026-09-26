# Gemini provider contract (M2 SP14e)

Scope, per spec §9 (SP14, provider adapters by protocol family): one `AIProviderPort` for the `gemini` family, over `HttpTransportPort`. It maps CIP to `POST <base>/models/<model>:generateContent` (JSON) and `:streamGenerateContent?alt=sse` (SSE) and back. `createAdapter` picks it for `protocol: "gemini"`.
- **Served:** `gemini` (Google AI Studio, API key). The catalog now has **53** connectable providers. `vertex` and `vertex-partner` still say "Needs the vertex adapter (SP14)".
- **UI:** no new screen. Gemini appears in the Connections Add modal like any API-key provider; its connection test and errors use the existing toasts.

**User decision (2026-09-26): keep 9router** for the request and the answer, including its silent drops. Only the tool-schema cleaner is corrected.

## Matrix entries

| Entry | Label | AIGate |
|---|---|---|
| `translator.openai-to-gemini-request` | `REFERENCE_BEHAVIOR` | See "Request". |
| same: dropped `stop`, `tool_choice`, `response_format`, penalties, seed, URL files/audio, video | `SUSPECTED_BUG`, kept | Dropped silently, as in 9router. |
| same: schema cleaner renames or removes parameters named like keywords, adds a required `reason` to empty objects | `SUSPECTED_BUG`, corrected | `cleanGeminiSchema` walks schema positions only; an empty object sends no `parameters`. |
| `translator.gemini-to-openai-response` | `REFERENCE_BEHAVIOR` | See "Answer" and "Stream". |
| same: raw lower-cased `finish_reason`, thoughts counted as prompt tokens, images as markdown, error chunks dropped, cut-off streams complete | `SUSPECTED_BUG`, kept | As in 9router. |

## Request (CIP → generateContent)

| CIP | Gemini |
|---|---|
| `model` | `model`, and the URL path `<chatUrl>/<model>:…` |
| `system` text parts | `systemInstruction: { role: "user", parts: [{ text }] }`, parts joined; with no messages it is sent as the only user turn instead |
| user `text` | `{ text }` |
| user `image`/`audio`/`file` base64 | `{ inlineData: { mime_type, data } }` |
| user `image` by http(s) URL | `{ fileData: { fileUri, mimeType: "image/*" } }` |
| any other part (URL file/audio, video, …) | dropped (kept 9router) |
| assistant `text` | a `model` turn `{ text }` |
| assistant `tool_call` | `{ functionCall: { id, name, args }, thoughtSignature? }`; `args` is the parsed JSON (`null` when it does not parse) |
| `tool_result` | a `user` turn after its model turn: `{ functionResponse: { id, name, response: { result } } }`; a JSON object answer is the result, any other value is wrapped `{ result: … }`. Sent when the model turn is not the last message or has an answer; a missing answer is `""`. |
| `tools` | `tools: [{ functionDeclarations: [{ name, description ("" if none), parameters? }] }]` |
| `temperature`, `topP`, `maxOutputTokens` | `generationConfig.temperature`, `.topP`, `.maxOutputTokens` |
| `vendorExtensions.openai.top_k` | `generationConfig.topK` |
| `reasoning` / `reasoning_effort` | `generationConfig.thinkingConfig`, see "Thinking" |
| any other `vendorExtensions.openai` field | dropped (kept 9router) |
| other `vendorExtensions` namespaces | `UnsupportedFeatureError` |

Always sent: `safetySettings` with `threshold: "OFF"` for hate speech, dangerous content, sexually explicit, harassment, and civic integrity.

Names (functions and tool calls): characters outside `[a-zA-Z0-9_.:-]` become `_`, a name not starting with a letter or `_` gets a leading `_`, cut to 64; an empty name is `_unknown`. The answer keeps the sanitized name.

Turns: empty parts are dropped, adjacent turns of the same role are merged, and a `{ role: "user", parts: [{ text: "..." }] }` turn is put first when the model would speak first.

Thought signatures: the first function call of a model turn carries the cached signature of that call id, else 9router's borrowed signature (`gemini-signature.ts`); later calls carry only a cached one. The cache is in memory: signatures seen in a stream, keyed by call id, one hour, at most 2000, and replayed only to the same model family (gemini, claude, or the model name). 9router's SQLite layer is not used by its Gemini path and is not ported.

Auth: `x-goog-api-key: <key>` (never the URL query). `accept` is `text/event-stream` when streaming.

## Thinking

| Model | Format |
|---|---|
| `gemini…image…` | none (no thinkingConfig) |
| other `gemini-3…` | level |
| `gemini-2.5…` | budget |

9router also caps the floors below at the model's output limit (65535 or 65536); no floor is above 65535, so AIGate leaves the cap out.

- Level models: `none`/`off` → `minimal`; `auto` → `high`; a budget maps to a level (≤768 minimal, ≤4096 low, ≤16384 medium, else high); `xhigh`/`max` → `high`. `thinkingConfig: { thinkingLevel, includeThoughts: level !== "minimal" }`. `maxOutputTokens` is raised to the level floor (minimal 4096, low 8192, medium 16384, high 65535).
- Budget models: `none` → `{ thinkingBudget: 0, includeThoughts: false }`; `auto` → `-1`; a level maps to 9router's budget table, clamped to 0..24576. `maxOutputTokens` is raised to the budget floor (≤1024 → 8192, ≤8192 → 16384, ≤24576 → 32768, dynamic → 32768).
- Other models: no thinkingConfig.

## Tool-schema cleaner (corrected)

`cleanGeminiSchema` copies the schema and runs 9router's phases in order over schema positions only (`properties` values, `items`, `anyOf`, `oneOf`, `allOf`, `prefixItems`; depth at most 64): `const` → `enum`; enum values as strings (type `string` when missing); `allOf` merged; `prefixItems` → `items`; `anyOf`/`oneOf` flattened to the richest non-null branch (object, then array, then any type); type arrays → the first non-null type; `type: "object"` inferred from `properties`, `items: { type: "string" }` for an array without items; 9router's unsupported keywords and `x-` keys removed; `required` pruned to existing properties. An object schema without properties returns `undefined`, so the declaration has no `parameters`.

## Answer (JSON body, kept 9router)

The body may be wrapped in `response`. The first candidate: thought parts → `thinking`, other text → `text`, inline image data → markdown `![image](data:<mime>;base64,<data>)` appended to the text, `functionCall` → `tool_call { id: call_<name>_<ms>_<i>, name, arguments: JSON of args }`. Stop reason: a tool call → `tool_use`, else the mapped `finishReason` (STOP → end_turn, MAX_TOKENS → max_tokens, SAFETY/RECITATION/BLOCKLIST/PROHIBITED_CONTENT → content_filter, other → end_turn). The OpenAI renderer sends the raw reason lower-cased (`vendorExtensions.openai.finish_reason`; `tool_calls` when there are calls), as 9router does. Usage: `inputTokens = promptTokenCount + thoughtsTokenCount`, `outputTokens = candidatesTokenCount`, `reasoningTokens = thoughtsTokenCount`. Id `chatcmpl-<responseId>`, model `modelVersion`. **Forced deviation:** a body without candidates is an empty answer with model `gemini` (9router returns the raw body; CIP has no raw form).

## Stream (SSE → StreamChunk, kept 9router)

Chunks without a candidate (error or blocked-prompt chunks) are skipped. The first candidate starts the answer (`chatcmpl-<responseId|msg_<ms>>`, model `modelVersion` or the requested one). Text and thought parts become deltas; a `functionCall` arrives whole as the next tool-call index (at most 128), and its signature (on the part, or pending from an earlier part) is cached. A part that carries a signature shows nothing else; inline image data becomes an `image_delta` chunk, rendered as 9router's non-standard `delta.images: [{ type: "image_url", image_url: { url: "data:…" } }]`. Usage: `inputTokens = prompt − cached`, `outputTokens = candidates + thoughts` (candidates from `total − prompt − thoughts` when missing), `cacheReadTokens`, `reasoningTokens`. A `finishReason` sends usage, then the mapped stop reason (STOP with tool calls → `tool_use`), and ends the answer. **Kept:** a stream that ends without `finishReason` still ends with `end_turn` (or `tool_use`). A non-SSE answer to a streaming request → `PROVIDER_UNAVAILABLE`.

## Models and connection test

`getModels` reads `GET <base>/models?pageSize=1000` with the key header: `models[].name` without the `models/` prefix, at most 1000. The connection test is `GET <base>/models`. Google answers a bad key with 400, so a 400 on the connection test is `invalid` (401/403 too); anything else follows the shared adapter rules.

## Other forced deviations

- CIP merges the leading system messages into one prompt, so all of them become `systemInstruction` (9router keeps the last one).
- The `/v1` lane serves chat models only, so image output models are rarely reached; the image paths are covered by adapter tests.

## Matrix

`translator.openai-to-gemini-request` and `translator.gemini-to-openai-response` are `implemented`.
