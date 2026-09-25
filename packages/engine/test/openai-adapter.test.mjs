// Contract: docs/contracts/provider-openai.md — the adapter against a fake HttpTransportPort.
import { test } from "node:test";
import assert from "node:assert/strict";
import { builtinRegistry, EngineError, OpenAICompatibleAdapter, readSseData, UnsupportedFeatureError } from "../dist/index.js";

const SECRET = "sk-test-secret-value";
const credential = { kind: "api-key", apiKey: SECRET };
const openai = builtinRegistry.provider("openai");
const encoder = new TextEncoder();
const ctx = (signal = new AbortController().signal) => ({ signal, requestId: "test" });

// A body that hands out `bytes` in pieces of `size` bytes (so UTF-8 characters split), and records a cancel.
function body(text, size = 1 << 20) {
  const bytes = encoder.encode(text);
  let offset = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) return controller.close();
      controller.enqueue(bytes.slice(offset, offset + size));
      offset += size;
    },
    cancel() { stream.cancelled = true; },
  });
  return stream;
}
const json = (status, value, headers = {}) => ({ status, headers: { "content-type": "application/json", ...headers }, body: body(typeof value === "string" ? value : JSON.stringify(value)) });
const sse = (events, size = 3) => ({ status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" }, body: body(events.map((e) => `data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`).join(""), size) });

// Plays back one planned answer per call; a function answer may inspect the request or throw.
function fakeTransport(...answers) {
  const calls = [];
  return {
    calls,
    async send(request, context) {
      calls.push(request);
      const next = answers.shift();
      if (next === undefined) throw new Error("unexpected transport call");
      if (next instanceof Error) throw next;
      return typeof next === "function" ? next(request, context) : next;
    },
  };
}

const ok = { id: "chatcmpl-1", model: "gpt-4.1", choices: [{ message: { role: "assistant", content: "hi" }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 2 } };
const hello = { model: "gpt-4.1", stream: false, messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }] };
const noSecret = (error) => !error.message.includes(SECRET) && !JSON.stringify(error.details).includes(SECRET);
const isCode = (code, extra = () => true) => (error) => error instanceof EngineError && error.code === code && noSecret(error) && extra(error);
async function collect(iterable) {
  const chunks = [];
  for await (const chunk of iterable) chunks.push(chunk);
  return chunks;
}

test("execute maps CIP to a chat-completions body and the answer back", async () => {
  const transport = fakeTransport(json(200, {
    id: "chatcmpl-9", model: "gpt-4.1-2025",
    choices: [{ finish_reason: "stop", message: { role: "assistant", content: "Done", reasoning_content: "think", tool_calls: [{ id: "call_1", type: "function", function: { name: "lookup", arguments: "{\"q\":1}" } }] } }],
    usage: { prompt_tokens: 100, completion_tokens: 40, prompt_tokens_details: { cached_tokens: 30 }, completion_tokens_details: { reasoning_tokens: 12 } },
  }));
  const response = await new OpenAICompatibleAdapter(openai, transport).execute({
    model: "gpt-4.1", stream: true,
    system: [{ type: "text", text: "be brief", cacheControl: "ephemeral" }],
    messages: [
      { role: "user", content: [{ type: "text", text: "look" }, { type: "image", source: { kind: "base64", mediaType: "image/png", data: "AAAA" } }] },
      { role: "assistant", content: [{ type: "tool_call", id: "call_0", name: "lookup", arguments: "{}" }] },
      { role: "user", content: [{ type: "tool_result", toolCallId: "call_0", content: [{ type: "text", text: "42" }] }, { type: "text", text: "and?" }] },
    ],
    tools: [{ name: "lookup", description: "find", parameters: { type: "object" } }],
    toolChoice: { name: "lookup" }, maxOutputTokens: 500, temperature: 0.2, topP: 0.9, stop: ["END"], reasoning: { effort: "low" },
    vendorExtensions: { openai: { user: "u-1", model: "must-not-win" } },
  }, credential, ctx());

  const [call] = transport.calls;
  assert.equal(call.method, "POST");
  assert.equal(call.url, "https://api.openai.com/v1/chat/completions");
  assert.equal(call.headers.authorization, `Bearer ${SECRET}`);
  assert.ok(call.timeoutMs > 0);
  assert.deepEqual(JSON.parse(call.body), {
    user: "u-1", model: "gpt-4.1", stream: false,
    messages: [
      { role: "system", content: "be brief" },
      { role: "user", content: [{ type: "text", text: "look" }, { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }] },
      { role: "assistant", content: null, tool_calls: [{ id: "call_0", type: "function", function: { name: "lookup", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "call_0", content: "42" },
      { role: "user", content: "and?" },
    ],
    tools: [{ type: "function", function: { name: "lookup", description: "find", parameters: { type: "object" } } }],
    tool_choice: { type: "function", function: { name: "lookup" } },
    max_completion_tokens: 500, temperature: 0.2, top_p: 0.9, stop: ["END"], reasoning_effort: "low",
  });
  assert.deepEqual(response, {
    id: "chatcmpl-9", model: "gpt-4.1-2025",
    content: [{ type: "thinking", text: "think" }, { type: "text", text: "Done" }, { type: "tool_call", id: "call_1", name: "lookup", arguments: "{\"q\":1}" }],
    stopReason: "tool_use",
    usage: { inputTokens: 70, outputTokens: 40, cacheReadTokens: 30, reasoningTokens: 12 },
  });
});

test("a feature OpenAI cannot carry is refused before any I/O", async () => {
  const user = (part) => ({ ...hello, messages: [{ role: "user", content: [part] }] });
  const cases = [
    user({ type: "video", source: { kind: "url", url: "https://x/v.mp4" } }),
    user({ type: "audio", source: { kind: "url", url: "https://x/a.wav" } }),
    user({ type: "audio", source: { kind: "base64", mediaType: "audio/ogg", data: "AA" } }),
    user({ type: "file", mediaType: "application/pdf", source: { kind: "url", url: "https://x/f.pdf" } }),
    user({ type: "tool_result", toolCallId: "c", content: [{ type: "text", text: "boom" }], isError: true }),
    user({ type: "tool_result", toolCallId: "c", content: [{ type: "image", source: { kind: "url", url: "https://x/i.png" } }] }),
    { ...hello, messages: [{ role: "assistant", content: [{ type: "thinking", text: "hmm" }] }] },
    { ...hello, system: [{ type: "image", source: { kind: "url", url: "https://x/i.png" } }] },
    { ...hello, reasoning: { budgetTokens: 1000 } },
    { ...hello, vendorExtensions: { anthropic: { top_k: 5 } } },
  ];
  for (const request of cases) {
    const transport = fakeTransport();
    await assert.rejects(new OpenAICompatibleAdapter(openai, transport).execute(request, credential, ctx()), UnsupportedFeatureError, JSON.stringify(request));
    assert.equal(transport.calls.length, 0);
  }
});

test("each upstream status maps to one error code, never by message text", async () => {
  const cases = [
    [401, { error: { message: `Incorrect API key provided: ${SECRET}` } }, "AUTH_ERROR"],
    [403, { error: { message: "region" } }, "AUTH_ERROR"],
    [402, {}, "QUOTA_EXHAUSTED"],
    [429, { error: { message: "You exceeded your current quota", type: "insufficient_quota", code: "insufficient_quota" } }, "QUOTA_EXHAUSTED"],
    [429, { error: { message: "Rate limit reached" } }, "RATE_LIMIT"],
    [404, { error: { message: "The model does not exist", code: "model_not_found" } }, "MODEL_UNAVAILABLE"],
    [400, { error: { message: "no such model", code: "model_not_found" } }, "MODEL_UNAVAILABLE"],
    [408, {}, "TIMEOUT"],
    [400, { error: { message: "rate limit, capacity, overloaded" } }, "INVALID_REQUEST"],
    [422, { error: "bad schema" }, "INVALID_REQUEST"],
    [500, "<html><title>oops</title></html>", "PROVIDER_UNAVAILABLE"],
  ];
  for (const [status, reply, code] of cases) {
    const transport = fakeTransport(json(status, reply));
    await assert.rejects(new OpenAICompatibleAdapter(openai, transport).execute(hello, credential, ctx()), isCode(code, (error) =>
      error.details.status === status && error.details.provider === "openai" && !error.message.includes("<html>")), `${status} ${JSON.stringify(reply)}`);
    assert.equal(transport.calls.length, 1, `${status} is not retried`);
  }
  const echoed = fakeTransport(json(401, { error: { message: `bad key ${SECRET}` } }));
  await assert.rejects(new OpenAICompatibleAdapter(openai, echoed).execute(hello, credential, ctx()), (error) => error.message.includes("bad key ***"));
});

test("502, 503, 504 and an unreachable host are retried at most 3 times; nothing else is", async () => {
  const network = new EngineError("PROVIDER_UNAVAILABLE", "Could not reach api.openai.com", { host: "api.openai.com" });
  const recovers = fakeTransport(json(503, {}), network, json(200, ok));
  assert.equal((await new OpenAICompatibleAdapter(openai, recovers).execute(hello, credential, ctx())).content[0].text, "hi");
  assert.equal(recovers.calls.length, 3);

  const down = fakeTransport(json(502, {}), json(504, {}), json(502, {}), json(200, ok));
  await assert.rejects(new OpenAICompatibleAdapter(openai, down).execute(hello, credential, ctx()), isCode("PROVIDER_UNAVAILABLE", (e) => e.details.status === 502));
  assert.equal(down.calls.length, 3);

  const final = [
    new EngineError("PROVIDER_UNAVAILABLE", "redirect", { host: "x", status: 302 }),
    new EngineError("TIMEOUT", "slow", { host: "x", timeoutMs: 1 }),
    json(429, {}), json(500, {}),
  ];
  for (const answer of final) {
    const transport = fakeTransport(answer, json(200, ok));
    await assert.rejects(new OpenAICompatibleAdapter(openai, transport).execute(hello, credential, ctx()), EngineError);
    assert.equal(transport.calls.length, 1);
  }
});

test("a caller abort during the retry wait rejects with the caller reason at once", async () => {
  const controller = new AbortController();
  const transport = fakeTransport(() => {
    setTimeout(() => controller.abort(new Error("client left")), 10);
    return json(503, {});
  }, json(200, ok));
  const started = Date.now();
  await assert.rejects(new OpenAICompatibleAdapter(openai, transport).execute(hello, credential, ctx(controller.signal)), /client left/);
  assert.ok(Date.now() - started < 400, "did not wait out the backoff");
  assert.equal(transport.calls.length, 1);
});

test("an API key that could break the header is AUTH_ERROR before any I/O", async () => {
  for (const apiKey of ["", "sk bad", "sk\r\nx-evil: 1", "k".repeat(4097)]) {
    const transport = fakeTransport();
    await assert.rejects(new OpenAICompatibleAdapter(openai, transport).execute(hello, { kind: "api-key", apiKey }, ctx()), isCode("AUTH_ERROR"));
    assert.equal(transport.calls.length, 0);
  }
});

test("a 2xx body that is not a chat response is PROVIDER_UNAVAILABLE", async () => {
  for (const reply of ["not json", { choices: [] }, { choices: [{ message: { tool_calls: [{ function: { name: "x" } }] } }] }]) {
    await assert.rejects(new OpenAICompatibleAdapter(openai, fakeTransport(json(200, reply))).execute(hello, credential, ctx()), isCode("PROVIDER_UNAVAILABLE"));
  }
});

const streamEvents = [
  { id: "chatcmpl-s", model: "gpt-4.1", choices: [{ index: 0, delta: { role: "assistant" } }] },
  { choices: [{ delta: { reasoning_content: "hm" } }] },
  { choices: [{ delta: { content: "Xin chào " } }] },
  { choices: [{ delta: { content: "👋" } }] },
  { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "lookup", arguments: "" } }] } }] },
  { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "{\"q\":" } }] } }] },
  { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "1}" } }] } }] },
  { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
  { choices: [], usage: { prompt_tokens: 9, completion_tokens: 5 } },
  "[DONE]",
];

test("stream parses SSE split mid-character into ordered CIP chunks, usage before stop", async () => {
  const transport = fakeTransport(sse(streamEvents, 3));
  const chunks = await collect(new OpenAICompatibleAdapter(openai, transport).stream(hello, credential, ctx()));
  const sent = JSON.parse(transport.calls[0].body);
  assert.equal(sent.stream, true);
  assert.deepEqual(sent.stream_options, { include_usage: true });
  assert.equal(transport.calls[0].headers.accept, "text/event-stream");
  assert.deepEqual(chunks, [
    { type: "start", id: "chatcmpl-s", model: "gpt-4.1" },
    { type: "thinking_delta", index: 0, text: "hm" },
    { type: "text_delta", index: 0, text: "Xin chào " },
    { type: "text_delta", index: 0, text: "👋" },
    { type: "tool_call_delta", index: 0, id: "call_1", name: "lookup", argumentsDelta: "" },
    { type: "tool_call_delta", index: 0, argumentsDelta: "{\"q\":" },
    { type: "tool_call_delta", index: 0, argumentsDelta: "1}" },
    { type: "usage", usage: { inputTokens: 9, outputTokens: 5 } },
    { type: "stop", stopReason: "tool_use" },
  ]);
});

test("readSseData handles CRLF, comments, other fields, and multi-line data", async () => {
  const events = await collect(readSseData(body(": ping\r\nevent: x\r\ndata: a\r\ndata: b\r\n\r\nid: 3\ndata:c\n\ndata: tail", 2)));
  assert.deepEqual(events, ["a\nb", "c", "tail"]);
});

test("a stream cut off before it finished is an error, never a normal end", async () => {
  const cut = { status: 200, headers: { "content-type": "text/event-stream" }, body: body(`data: ${JSON.stringify(streamEvents[0])}\n\ndata: ${JSON.stringify(streamEvents[2])}\n\n`) };
  const seen = [];
  await assert.rejects((async () => { for await (const chunk of new OpenAICompatibleAdapter(openai, fakeTransport(cut)).stream(hello, credential, ctx())) seen.push(chunk.type); })(),
    isCode("PROVIDER_UNAVAILABLE", (error) => error.details.partial === true));
  assert.deepEqual(seen, ["start", "text_delta"]);
});

test("an error event mid-stream fails the stream as partial, with the credential redacted", async () => {
  const reply = sse([streamEvents[0], { error: { message: `upstream broke for ${SECRET}` } }]);
  await assert.rejects(collect(new OpenAICompatibleAdapter(openai, fakeTransport(reply)).stream(hello, credential, ctx())),
    isCode("PROVIDER_UNAVAILABLE", (error) => error.details.partial === true && error.message.includes("***")));
});

test("stream failures before the first chunk are thrown from the first next()", async () => {
  const html = { status: 200, headers: { "content-type": "text/html" }, body: body("<html>captive portal</html>") };
  const iterator = new OpenAICompatibleAdapter(openai, fakeTransport(html)).stream(hello, credential, ctx())[Symbol.asyncIterator]();
  await assert.rejects(iterator.next(), isCode("PROVIDER_UNAVAILABLE", (error) => error.details.partial === undefined));
  assert.equal(html.body.cancelled, true);
  await assert.rejects(collect(new OpenAICompatibleAdapter(openai, fakeTransport(json(401, {}))).stream(hello, credential, ctx())), isCode("AUTH_ERROR"));
});

test("stream bounds: an endless line, a wild tool index; an early break cancels the body", async () => {
  const endless = { status: 200, headers: { "content-type": "text/event-stream" }, body: body(`data: ${"x".repeat(2 * 1024 * 1024)}`, 64 * 1024) };
  await assert.rejects(collect(new OpenAICompatibleAdapter(openai, fakeTransport(endless)).stream(hello, credential, ctx())), isCode("PROVIDER_UNAVAILABLE"));
  assert.equal(endless.body.cancelled, true);

  const wild = sse([streamEvents[0], { choices: [{ delta: { tool_calls: [{ index: 9999, function: { arguments: "" } }] } }] }, streamEvents[7], "[DONE]"]);
  await assert.rejects(collect(new OpenAICompatibleAdapter(openai, fakeTransport(wild)).stream(hello, credential, ctx())), isCode("PROVIDER_UNAVAILABLE", (error) => /tool call index/.test(error.message)));

  const reply = sse(streamEvents);
  for await (const chunk of new OpenAICompatibleAdapter(openai, fakeTransport(reply)).stream(hello, credential, ctx())) {
    assert.equal(chunk.type, "start");
    break;
  }
  assert.equal(reply.body.cancelled, true);
});

test("getModels lists upstream ids, attaching registry data only to known ones", async () => {
  const data = [{ id: "gpt-4.1" }, { id: "my-local-model" }, { id: "bad id with spaces" }, "junk", ...Array.from({ length: 1500 }, (_, i) => ({ id: `m-${i}` }))];
  const transport = fakeTransport(json(200, { object: "list", data }));
  const models = await new OpenAICompatibleAdapter(openai, transport).getModels(credential, ctx());
  assert.equal(transport.calls[0].method, "GET");
  assert.equal(transport.calls[0].url, "https://api.openai.com/v1/models");
  assert.equal(models[0].id, "gpt-4.1");
  assert.equal(models[0].descriptor.contextWindow, 1_000_000);
  assert.deepEqual(models[1], { id: "my-local-model" });
  assert.ok(models.length <= 1000);
  await assert.rejects(new OpenAICompatibleAdapter(openai, fakeTransport(json(200, { data: "nope" }))).getModels(credential, ctx()), isCode("PROVIDER_UNAVAILABLE"));
});

test("validateCredential answers only about the key and never retries", async () => {
  const check = (...answers) => {
    const transport = fakeTransport(...answers);
    return { transport, result: new OpenAICompatibleAdapter(openai, transport).validateCredential(credential, ctx()) };
  };
  assert.deepEqual(await check(json(200, { data: [] })).result, { valid: true });
  const rejected = await check(json(401, { error: { message: `bad ${SECRET}` } })).result;
  assert.equal(rejected.valid, false);
  assert.equal(rejected.code, "AUTH_ERROR");
  assert.ok(!rejected.message.includes(SECRET));
  assert.equal((await check(json(429, { error: { code: "insufficient_quota" } })).result).code, "QUOTA_EXHAUSTED");
  const down = check(json(503, {}), json(200, {}));
  await assert.rejects(down.result, isCode("PROVIDER_UNAVAILABLE"));
  assert.equal(down.transport.calls.length, 1);
  const badKey = await new OpenAICompatibleAdapter(openai, fakeTransport()).validateCredential({ kind: "api-key", apiKey: "has space" }, ctx());
  assert.equal(badKey.code, "AUTH_ERROR");
});
