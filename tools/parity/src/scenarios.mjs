// The recorded scenarios for the M1 lane (OpenAI Chat in, OpenAI-compatible upstream out).
// `body` is what the client sends (the recorder adds a per-scenario model, because 9router locks a
// failing account per model). `vendor` is the scripted upstream answer. `covers` names the Feature
// Matrix entries each tape exercises (coverage, spec §8.5).
// `deviations` are the intentional differences from 9router, found by recording, each tied to its
// labeled matrix entry; tier 1 checks that AIGate shows the expected value instead of 9router's.

const completion = (message, finish = "stop") => ({
  id: "chatcmpl-vendor-1", object: "chat.completion", created: 1_700_000_000, model: "gpt-4.1-mini",
  choices: [{ index: 0, message: { role: "assistant", ...message }, finish_reason: finish }],
  usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17 },
});
const chunk = (delta, finish = null) => ({ id: "chatcmpl-vendor-s", object: "chat.completion.chunk", created: 1_700_000_000, model: "gpt-4.1-mini", choices: [{ index: 0, delta, finish_reason: finish }] });
const usageChunk = { id: "chatcmpl-vendor-s", object: "chat.completion.chunk", created: 1_700_000_000, model: "gpt-4.1-mini", choices: [], usage: { prompt_tokens: 9, completion_tokens: 3, total_tokens: 12 } };
const vendorError = (status, error, headers) => ({ status, json: { error }, headers });
const user = (text) => [{ role: "user", content: text }];
const weatherTool = [{ type: "function", function: { name: "get_weather", description: "Weather for a city", parameters: { type: "object", properties: { city: { type: "string" } }, required: ["city"] } } }];

export const SCENARIOS = [
  {
    id: "normal-json", title: "Non-streaming completion",
    covers: ["routing.non-streaming-response", "routing.request-preflight", "fallback.upstream-error-result"],
    body: { messages: user("Say hello"), stream: false },
    vendor: { status: 200, json: completion({ content: "Hello!" }) },
  },
  {
    id: "stream-text", title: "Streaming text with usage",
    covers: ["routing.streaming-pipeline", "routing.stream-mode-decision"],
    body: { messages: user("Say hello"), stream: true, stream_options: { include_usage: true } },
    vendor: { sse: [chunk({ role: "assistant", content: "" }), chunk({ content: "Hel" }), chunk({ content: "lo!" }), chunk({}, "stop"), usageChunk, "[DONE]"] },
  },
  {
    id: "stream-tool-call", title: "Streaming tool call",
    covers: ["routing.streaming-pipeline", "translator.tool-id-normalization"],
    body: { messages: user("Weather in Hanoi?"), tools: weatherTool, stream: true },
    vendor: { sse: [
      chunk({ role: "assistant", content: null, tool_calls: [{ index: 0, id: "call_abc123", type: "function", function: { name: "get_weather", arguments: "" } }] }),
      chunk({ tool_calls: [{ index: 0, function: { arguments: "{\"city\":" } }] }),
      chunk({ tool_calls: [{ index: 0, function: { arguments: "\"Hanoi\"}" } }] }),
      chunk({}, "tool_calls"), "[DONE]",
    ] },
  },
  {
    id: "json-tool-call", title: "Non-streaming tool call",
    covers: ["routing.non-streaming-response"],
    body: { messages: user("Weather in Hanoi?"), tools: weatherTool, tool_choice: "auto", stream: false },
    vendor: { status: 200, json: completion({ content: null, tool_calls: [{ id: "call_abc123", type: "function", function: { name: "get_weather", arguments: "{\"city\":\"Hanoi\"}" } }] }, "tool_calls") },
  },
  {
    id: "omitted-stream", title: "No stream flag (OpenAI default: JSON)",
    covers: ["routing.stream-mode-decision"],
    body: { messages: user("Say hello") },
    // The gateway decides the mode; the vendor answers in the mode it was asked for.
    vendor: (request) => (request?.stream ? { sse: [chunk({ role: "assistant", content: "Hello!" }), chunk({}, "stop"), "[DONE]"] } : { status: 200, json: completion({ content: "Hello!" }) }),
  },
  {
    id: "upstream-400-context", title: "Upstream 400 context_length_exceeded",
    covers: ["fallback.error-classification", "fallback.upstream-error-result"],
    body: { messages: user("very long"), stream: false },
    vendor: vendorError(400, { message: "This model's maximum context length is 128000 tokens.", type: "invalid_request_error", param: "messages", code: "context_length_exceeded" }),
  },
  {
    id: "upstream-401", title: "Upstream rejects the credential",
    covers: ["fallback.error-classification", "fallback.auth-refresh-retry"],
    body: { messages: user("hi"), stream: false },
    vendor: vendorError(401, { message: "Incorrect API key provided: sk-pari****-key.", type: "invalid_request_error", param: null, code: "invalid_api_key" }),
  },
  {
    id: "upstream-429-rate", title: "Upstream rate limit",
    covers: ["fallback.error-classification", "fallback.executor-retry-budget", "fallback.accounts-exhausted-response"],
    body: { messages: user("hi"), stream: false },
    vendor: vendorError(429, { message: "Rate limit reached for requests", type: "requests", param: null, code: "rate_limit_exceeded" }, { "retry-after": "1" }),
  },
  {
    id: "upstream-429-quota", title: "Upstream quota exhausted",
    covers: ["fallback.error-classification"],
    body: { messages: user("hi"), stream: false },
    vendor: vendorError(429, { message: "You exceeded your current quota.", type: "insufficient_quota", param: null, code: "insufficient_quota" }),
  },
  {
    id: "upstream-500", title: "Upstream 500 (not retried in place)",
    covers: ["fallback.error-classification", "fallback.executor-retry-budget"],
    body: { messages: user("hi"), stream: false },
    vendor: vendorError(500, { message: "The server had an error while processing your request.", type: "server_error", param: null, code: null }),
  },
  {
    id: "stream-cut", title: "Stream cut after the first chunk",
    covers: ["fallback.partial-stream-failure", "routing.streaming-pipeline"],
    body: { messages: user("Tell a story"), stream: true },
    vendor: { sse: [chunk({ role: "assistant", content: "" }), chunk({ content: "Once upon" })], cut: true },
  },
];

// Intentional differences from 9router, each tied to its labeled matrix entry and the contract that
// decided it. Found by recording 9router 0.5.55 (tools/parity/tapes); tier 1 fails on any other difference.
const USAGE_BUFFER = {
  entry: "routing.non-streaming-response", label: "SUSPECTED_BUG",
  reason: "9router adds 2000 buffer tokens to reported usage (open-sse/utils/usageTracking.js addBufferToUsage); AIGate reports the vendor's numbers",
};
const ERROR_SHAPE = {
  entry: "fallback.upstream-error-result", label: "REFERENCE_BEHAVIOR",
  reason: "9router 0.5.55 answers { error: { message } } only, with its node id and the raw upstream body in the message; AIGate sends the OpenAI shape with type and code (docs/contracts/protocol-openai.md)",
};
const DEVIATIONS = {
  "normal-json": [{ path: "usage", aigate: { prompt: 12, completion: 5, total: 17 }, ...USAGE_BUFFER }],
  "json-tool-call": [{ path: "usage", aigate: { prompt: 12, completion: 5, total: 17 }, ...USAGE_BUFFER }],
  "stream-tool-call": [{
    path: "usage", aigate: null, entry: "routing.streaming-pipeline", label: "SUSPECTED_BUG",
    reason: "9router invents an estimated usage chunk (with the 2000 buffer) the client did not ask for; AIGate sends usage only with stream_options.include_usage",
  }],
  "omitted-stream": [{
    path: "*", entry: "routing.stream-mode-decision", label: "SUSPECTED_BUG",
    reason: "9router labels the answer text/event-stream but sends the vendor's JSON body followed by a bare data: [DONE], readable as neither SSE nor JSON; AIGate follows the OpenAI default and returns JSON",
    aigate: { kind: "completion", status: 200, object: "chat.completion", text: "Hello!", reasoning: null, toolCalls: [], finishReason: "stop", usage: { prompt: 12, completion: 5, total: 17 } },
  }],
  "stream-cut": [
    { path: "terminal", aigate: "error", entry: "fallback.partial-stream-failure", label: "SUSPECTED_BUG", reason: "9router ends a cut stream silently; AIGate sends an error event and no [DONE]" },
    { path: "error", aigate: { type: "api_error", code: "provider_unavailable" }, entry: "fallback.partial-stream-failure", label: "SUSPECTED_BUG", reason: "the error event names the failure" },
  ],
  "upstream-400-context": [{ path: "error", aigate: { type: "invalid_request_error", code: "context_length_exceeded" }, ...ERROR_SHAPE }],
  "upstream-401": [
    { path: "status", aigate: 502, entry: "fallback.upstream-error-result", label: "SUSPECTED_BUG", reason: "an upstream credential failure is AIGate's configuration, not the client's key; 401 would blame the client (docs/contracts/protocol-openai.md)" },
    { path: "error", aigate: { type: "upstream_auth_error", code: "upstream_auth_error" }, ...ERROR_SHAPE },
  ],
  "upstream-429-rate": [{ path: "error", aigate: { type: "rate_limit_error", code: "rate_limit_exceeded" }, ...ERROR_SHAPE }],
  "upstream-429-quota": [{ path: "error", aigate: { type: "insufficient_quota", code: "insufficient_quota" }, ...ERROR_SHAPE }],
  "upstream-500": [
    { path: "status", aigate: 502, entry: "fallback.error-classification", label: "REFERENCE_BEHAVIOR", reason: "an upstream 5xx is PROVIDER_UNAVAILABLE, which a gateway reports as 502 Bad Gateway (docs/contracts/protocol-openai.md)" },
    { path: "error", aigate: { type: "api_error", code: "provider_unavailable" }, ...ERROR_SHAPE },
  ],
};
for (const scenario of SCENARIOS) scenario.deviations = DEVIATIONS[scenario.id] ?? [];
