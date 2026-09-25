// Contract: docs/contracts/protocol-openai.md — the client-facing OpenAI Chat Completions adapter.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  builtinRegistry, EngineError, OpenAIChatStreamEncoder, OpenAICompatibleAdapter, parseOpenAIChatRequest, toOpenAIChatCompletion,
  toOpenAIError, UnsupportedFeatureError,
} from "../dist/index.js";

const user = (content) => ({ role: "user", content });
const body = (extra = {}) => ({ model: "gpt-4.1", messages: [user("hi")], ...extra });
const invalidAt = (param) => (error) => error instanceof EngineError && error.code === "INVALID_REQUEST" && error.details.param === param;

test("a full OpenAI body maps to CIP, with unknown fields carried in vendorExtensions", () => {
  const { request, includeUsage } = parseOpenAIChatRequest({
    model: "gpt-4.1",
    messages: [
      { role: "system", content: "be brief" },
      { role: "developer", content: [{ type: "text", text: "use tools" }] },
      user([
        { type: "text", text: "look" },
        { type: "image_url", image_url: { url: "data:image/png;base64,AAAA", detail: "low" } },
        { type: "image_url", image_url: { url: "https://example.com/cat.png" } },
        { type: "input_audio", input_audio: { data: "UklG", format: "wav" } },
        { type: "file", file: { file_data: "data:application/pdf;base64,JVBE", filename: "a.pdf" } },
      ]),
      { role: "assistant", content: null, refusal: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "lookup", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "call_1", content: "42" },
    ],
    tools: [{ type: "function", function: { name: "lookup", description: "find", parameters: { type: "object" }, strict: true } }, { type: "function", function: { name: "ping" } }],
    tool_choice: { type: "function", function: { name: "lookup" } },
    stream: true, stream_options: { include_usage: true },
    max_tokens: 300, temperature: 0.5, top_p: 1, stop: "END", reasoning_effort: "low", n: 1,
    user: "u-1", seed: 7, response_format: { type: "text" }, presence_penalty: null,
  });
  assert.equal(includeUsage, true);
  assert.deepEqual(request, {
    model: "gpt-4.1",
    stream: true,
    system: [{ type: "text", text: "be brief" }, { type: "text", text: "use tools" }],
    messages: [
      { role: "user", content: [
        { type: "text", text: "look" },
        { type: "image", source: { kind: "base64", mediaType: "image/png", data: "AAAA" }, detail: "low" },
        { type: "image", source: { kind: "url", url: "https://example.com/cat.png" } },
        { type: "audio", source: { kind: "base64", mediaType: "audio/wav", data: "UklG" } },
        { type: "file", mediaType: "application/pdf", source: { kind: "base64", mediaType: "application/pdf", data: "JVBE" }, name: "a.pdf" },
      ] },
      { role: "assistant", content: [{ type: "tool_call", id: "call_1", name: "lookup", arguments: "{}" }] },
      { role: "tool", content: [{ type: "tool_result", toolCallId: "call_1", content: [{ type: "text", text: "42" }] }] },
    ],
    tools: [
      { name: "lookup", description: "find", parameters: { type: "object" }, strict: true },
      { name: "ping", parameters: { type: "object", properties: {} } },
    ],
    toolChoice: { name: "lookup" },
    maxOutputTokens: 300, temperature: 0.5, topP: 1, stop: ["END"], reasoning: { effort: "low" },
    vendorExtensions: { openai: { user: "u-1", seed: 7, response_format: { type: "text" }, presence_penalty: null } },
  });
});

test("an omitted stream flag means non-streaming; only a boolean is accepted", () => {
  assert.equal(parseOpenAIChatRequest(body()).request.stream, false);
  assert.equal(parseOpenAIChatRequest(body({ stream: false })).request.stream, false);
  assert.equal(parseOpenAIChatRequest(body({ stream: true })).request.stream, true);
  assert.equal(parseOpenAIChatRequest(body({ stream: true })).includeUsage, false);
  assert.throws(() => parseOpenAIChatRequest(body({ stream: "yes" })), invalidAt("stream"));
});

test("a non-standard reasoning_effort passes through instead of being dropped", () => {
  const { request } = parseOpenAIChatRequest(body({ reasoning_effort: "minimal" }));
  assert.equal(request.reasoning, undefined);
  assert.deepEqual(request.vendorExtensions, { openai: { reasoning_effort: "minimal" } });
});

test("a malformed body is INVALID_REQUEST naming the field", () => {
  const cases = [
    ["not an object", "body"],
    [{ messages: [user("hi")] }, "model"],
    [{ model: "has space", messages: [user("hi")] }, "model"],
    [body({ messages: [] }), "messages"],
    [body({ messages: "hi" }), "messages"],
    [body({ messages: Array.from({ length: 10_001 }, () => user("x")) }), "messages"],
    [body({ messages: [{ role: "robot", content: "x" }] }), "messages[0].role"],
    [body({ messages: [{ role: "user", content: "x", extra: 1 }] }), "messages[0].extra"],
    [body({ messages: [{ role: "assistant", content: null }] }), "messages[0]"],
    [body({ messages: [{ role: "tool", content: "x" }] }), "messages[0].tool_call_id"],
    [body({ messages: [user([{ type: "image_url", image_url: { url: "data:image/png,AAAA" } }])] }), "messages[0].content[0].image_url.url"],
    [body({ messages: [user([{ type: "image_url", image_url: { url: "ftp://x/y.png" } }])] }), "messages[0].content[0].image_url.url"],
    [body({ messages: [user([{ type: "image_url", image_url: { url: "https://x/y.png", detail: "max" } }])] }), "messages[0].content[0].image_url.detail"],
    [body({ messages: [user([{ type: "input_audio", input_audio: { data: "AA", format: "ogg" } }])] }), "messages[0].content[0].input_audio.format"],
    [body({ messages: [user([{ type: 7 }])] }), "messages[0].content[0].type"],
    [body({ tools: [{ type: "function", function: { name: "bad name" } }] }), "tools[0].function.name"],
    [body({ tools: [{ type: "function", function: { name: "ok", strict: "yes" } }] }), "tools[0].function.strict"],
    [body({ tool_choice: "sometimes" }), "tool_choice"],
    [body({ n: 2 }), "n"],
    [body({ max_tokens: 10, max_completion_tokens: 20 }), "max_tokens"],
    [body({ max_tokens: 0 }), "max_tokens"],
    [body({ temperature: 3 }), "temperature"],
    [body({ top_p: -0.1 }), "top_p"],
    [body({ stop: ["a", "b", "c", "d", "e"] }), "stop"],
    [body(Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`x${i}`, i]))), "body"],
  ];
  for (const [input, param] of cases) assert.throws(() => parseOpenAIChatRequest(input), invalidAt(param), param);
});

test("valid OpenAI that CIP cannot carry is UnsupportedFeatureError, never dropped", () => {
  const cases = [
    body({ messages: [user([{ type: "file", file: { file_id: "file-1" } }])] }),
    body({ messages: [user("hi"), { role: "system", content: "late" }] }),
    body({ messages: [{ role: "user", content: "hi", name: "alice" }] }),
    body({ messages: [{ role: "function", name: "f", content: "x" }] }),
    body({ messages: [{ role: "assistant", content: null, refusal: "no" }] }),
    body({ messages: [{ role: "system", content: [{ type: "image_url", image_url: { url: "https://x/y.png" } }] }] }),
    body({ messages: [user([{ type: "video_url", video_url: {} }])] }),
    body({ tools: [{ type: "custom", custom: { name: "x" } }] }),
    body({ tool_choice: { type: "allowed_tools", allowed_tools: {} } }),
  ];
  for (const input of cases) assert.throws(() => parseOpenAIChatRequest(input), UnsupportedFeatureError, JSON.stringify(input).slice(0, 120));
});

const response = {
  id: "chatcmpl-1", model: "gpt-4.1",
  content: [{ type: "thinking", text: "hm" }, { type: "text", text: "Hel" }, { type: "text", text: "lo" }, { type: "tool_call", id: "call_1", name: "lookup", arguments: "{}" }],
  stopReason: "tool_use",
  usage: { inputTokens: 70, outputTokens: 40, cacheReadTokens: 30, reasoningTokens: 12 },
};

test("a CanonicalResponse renders as chat.completion with OpenAI usage totals", () => {
  assert.deepEqual(toOpenAIChatCompletion(response, { created: 1700000000, fallbackId: "unused" }), {
    id: "chatcmpl-1", object: "chat.completion", created: 1700000000, model: "gpt-4.1",
    choices: [{
      index: 0, logprobs: null, finish_reason: "tool_calls",
      message: { role: "assistant", content: "Hello", reasoning_content: "hm", tool_calls: [{ id: "call_1", type: "function", function: { name: "lookup", arguments: "{}" } }] },
    }],
    usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140, prompt_tokens_details: { cached_tokens: 30 }, completion_tokens_details: { reasoning_tokens: 12 } },
  });
  const bare = toOpenAIChatCompletion({ id: "", model: "m", content: [], stopReason: "max_tokens", usage: { inputTokens: 1, outputTokens: 2 } }, { created: 1, fallbackId: "chatcmpl-req-9" });
  assert.equal(bare.id, "chatcmpl-req-9");
  assert.equal(bare.choices[0].message.content, null);
  assert.equal(bare.choices[0].finish_reason, "length");
  assert.deepEqual(bare.usage, { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 });
  assert.throws(() => toOpenAIChatCompletion({ ...response, content: [{ type: "image", source: { kind: "url", url: "https://x" } }] }, { created: 1, fallbackId: "x" }), UnsupportedFeatureError);
});

const frames = (sse) => sse.split("\n\n").filter(Boolean).map((line) => (line === "data: [DONE]" ? "[DONE]" : JSON.parse(line.slice(6))));
const meta = { created: 1700000000, fallbackId: "chatcmpl-fallback", model: "requested", includeUsage: true };

test("the stream encoder emits OpenAI chunks, with usage after the finish chunk", () => {
  const encoder = new OpenAIChatStreamEncoder(meta);
  const sse = [
    { type: "start", id: "chatcmpl-s", model: "gpt-4.1" },
    { type: "thinking_delta", index: 0, text: "hm" },
    { type: "text_delta", index: 0, text: "Hi" },
    { type: "tool_call_delta", index: 0, id: "call_1", name: "lookup", argumentsDelta: "" },
    { type: "tool_call_delta", index: 0, argumentsDelta: "{}" },
    { type: "usage", usage: { inputTokens: 9, outputTokens: 5 } },
    { type: "stop", stopReason: "tool_use" },
  ].map((chunk) => encoder.encode(chunk)).join("") + encoder.end();
  const base = { id: "chatcmpl-s", object: "chat.completion.chunk", created: 1700000000, model: "gpt-4.1" };
  const delta = (d) => ({ ...base, choices: [{ index: 0, delta: d, logprobs: null, finish_reason: null }] });
  assert.deepEqual(frames(sse), [
    delta({ role: "assistant", content: "" }),
    delta({ reasoning_content: "hm" }),
    delta({ content: "Hi" }),
    delta({ tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "lookup", arguments: "" } }] }),
    delta({ tool_calls: [{ index: 0, function: { arguments: "{}" } }] }),
    { ...base, choices: [{ index: 0, delta: {}, logprobs: null, finish_reason: "tool_calls" }] },
    { ...base, choices: [], usage: { prompt_tokens: 9, completion_tokens: 5, total_tokens: 14 } },
    "[DONE]",
  ]);
});

test("without include_usage no usage chunk is sent; a missing start chunk still opens the stream", () => {
  const encoder = new OpenAIChatStreamEncoder({ ...meta, includeUsage: false });
  const out = frames(encoder.encode({ type: "text_delta", index: 0, text: "x" }) + encoder.encode({ type: "usage", usage: { inputTokens: 1, outputTokens: 1 } }) + encoder.encode({ type: "stop", stopReason: "end_turn" }));
  assert.equal(out.length, 3);
  assert.equal(out[0].id, "chatcmpl-fallback");
  assert.equal(out[0].model, "requested");
  assert.deepEqual(out[0].choices[0].delta, { role: "assistant", content: "" });
  assert.equal(out[2].choices[0].finish_reason, "stop");
});

test("a failed stream ends with an error event and no [DONE]; the encoder then refuses more", () => {
  const encoder = new OpenAIChatStreamEncoder(meta);
  encoder.encode({ type: "start", id: "c", model: "m" });
  const failure = encoder.fail(new EngineError("PROVIDER_UNAVAILABLE", "OpenAI ended the stream before it finished", { partial: true }));
  assert.ok(!failure.includes("[DONE]"));
  assert.deepEqual(frames(failure), [{ error: { message: "OpenAI ended the stream before it finished", type: "api_error", code: "provider_unavailable", param: null } }]);
  assert.throws(() => encoder.encode({ type: "text_delta", index: 0, text: "late" }), /closed/);
  assert.throws(() => encoder.end(), /closed/);
});

test("each error maps to one OpenAI status, type, and code; internals never leak", () => {
  const cases = [
    [new EngineError("INVALID_REQUEST", "messages[0].role must be…", { param: "messages[0].role" }), 400, "invalid_request_error", "invalid_request", "messages[0].role"],
    [new EngineError("INVALID_REQUEST", "too long", { upstreamCode: "context_length_exceeded" }), 400, "invalid_request_error", "context_length_exceeded", null],
    [new EngineError("INVALID_REQUEST", "odd", { upstreamCode: "<script>" }), 400, "invalid_request_error", "invalid_request", null],
    [new UnsupportedFeatureError("a file_id reference", "AIGate"), 400, "invalid_request_error", "unsupported_feature", null],
    [new EngineError("MODEL_UNAVAILABLE", "no such model"), 404, "not_found_error", "model_not_found", null],
    [new EngineError("RATE_LIMIT", "slow down"), 429, "rate_limit_error", "rate_limit_exceeded", null],
    [new EngineError("QUOTA_EXHAUSTED", "no credit", { upstreamCode: "insufficient_quota" }), 429, "insufficient_quota", "insufficient_quota", null],
    [new EngineError("AUTH_ERROR", "OpenAI answered 401"), 502, "upstream_auth_error", "upstream_auth_error", null],
    [new EngineError("PROVIDER_UNAVAILABLE", "down"), 502, "api_error", "provider_unavailable", null],
    [new EngineError("TIMEOUT", "slow"), 504, "timeout_error", "timeout", null],
  ];
  for (const [error, status, type, code, param] of cases) {
    const { status: s, body } = toOpenAIError(error);
    assert.deepEqual([s, body.error.type, body.error.code, body.error.param, body.error.message], [status, type, code, param, error.message], error.message);
  }
  for (const secret of [new TypeError("Cannot read properties of undefined (reading 'x') at /srv/app.js:10"), new EngineError("INTERNAL_ERROR", "db path E:/data")]) {
    assert.deepEqual(toOpenAIError(secret), { status: 500, body: { error: { message: "Internal error", type: "server_error", code: "internal_error", param: null } } });
  }
});

// ---- round trip through the provider adapter over a fake transport ----

const enc = new TextEncoder();
const streamOf = (text) => new ReadableStream({ start(c) { c.enqueue(enc.encode(text)); c.close(); } });
const openai = builtinRegistry.provider("openai");
const ctx = { signal: new AbortController().signal, requestId: "rt" };
const credential = { kind: "api-key", apiKey: "sk-round-trip" };

test("OpenAI in → CIP → OpenAI upstream keeps detail, strict, and passthrough fields", async () => {
  const client = {
    model: "gpt-4.1",
    messages: [{ role: "system", content: "s" }, user([{ type: "text", text: "q" }, { type: "image_url", image_url: { url: "https://x/i.png", detail: "high" } }])],
    tools: [{ type: "function", function: { name: "f", parameters: { type: "object" }, strict: true } }],
    seed: 42, max_tokens: 50,
  };
  const sent = [];
  const transport = { async send(request) {
    sent.push(JSON.parse(request.body));
    return { status: 200, headers: { "content-type": "application/json" }, body: streamOf(JSON.stringify({ id: "x", model: "gpt-4.1", choices: [{ message: { content: "ok" }, finish_reason: "stop" }], usage: { prompt_tokens: 3, completion_tokens: 1 } })) };
  } };
  const { request } = parseOpenAIChatRequest(client);
  const answer = toOpenAIChatCompletion(await new OpenAICompatibleAdapter(openai, transport).execute(request, credential, ctx), { created: 1, fallbackId: "f" });
  assert.deepEqual(sent[0], {
    seed: 42, model: "gpt-4.1", stream: false,
    messages: [{ role: "system", content: "s" }, { role: "user", content: [{ type: "text", text: "q" }, { type: "image_url", image_url: { url: "https://x/i.png", detail: "high" } }] }],
    tools: [{ type: "function", function: { name: "f", parameters: { type: "object" }, strict: true } }],
    max_completion_tokens: 50,
  });
  assert.equal(answer.choices[0].message.content, "ok");
  assert.deepEqual(answer.usage, { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 });
});

test("an upstream stream relays to the client as OpenAI SSE, and a cut-off stream ends in an error event", async () => {
  const upstream = (events) => ({ async send() {
    return { status: 200, headers: { "content-type": "text/event-stream" }, body: streamOf(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("")) };
  } });
  const relay = async (transport) => {
    const encoder = new OpenAIChatStreamEncoder({ created: 1, fallbackId: "f", model: "gpt-4.1", includeUsage: false });
    let out = "";
    try {
      for await (const chunk of new OpenAICompatibleAdapter(openai, transport).stream(parseOpenAIChatRequest(body({ stream: true })).request, credential, ctx)) out += encoder.encode(chunk);
      out += encoder.end();
    } catch (error) {
      out += encoder.fail(error);
    }
    return frames(out);
  };
  const whole = await relay(upstream([{ id: "c", model: "gpt-4.1", choices: [{ delta: { content: "A" } }] }, { choices: [{ delta: {}, finish_reason: "stop" }] }]));
  assert.deepEqual(whole.map((f) => (f === "[DONE]" ? f : f.choices[0]?.delta?.content ?? f.choices[0]?.finish_reason)), ["", "A", "stop", "[DONE]"]);
  const cut = await relay(upstream([{ id: "c", model: "gpt-4.1", choices: [{ delta: { content: "A" } }] }]));
  assert.equal(cut.at(-1).error.code, "provider_unavailable");
  assert.ok(!cut.includes("[DONE]"));
});
