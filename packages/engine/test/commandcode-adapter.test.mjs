// Contract: docs/contracts/provider-commandcode.md — the commandcode adapter against a fake HttpTransportPort.
import { test } from "node:test";
import assert from "node:assert/strict";
import { builtinRegistry, CommandCodeAdapter, createAdapter, UnsupportedFeatureError } from "../dist/index.js";

const commandcode = builtinRegistry.provider("commandcode");
const credential = { kind: "api-key", apiKey: "user_commandcode_secret_1234" };
const encoder = new TextEncoder();
const ctx = () => ({ signal: new AbortController().signal, requestId: "test" });
const stream = (text) => new ReadableStream({ start(controller) { controller.enqueue(encoder.encode(text)); controller.close(); } });
// All lines in one read: 9router's peek loses what follows the first content event; AIGate must not.
const ndjson = (events) => ({ status: 200, headers: { "content-type": "application/x-ndjson" }, body: stream(events.map((e) => (typeof e === "string" ? e : JSON.stringify(e))).join("\n") + "\n") });
const json = (status, value) => ({ status, headers: { "content-type": "application/json" }, body: stream(JSON.stringify(value)) });
function fakeTransport(...answers) {
  const calls = [];
  return {
    calls,
    async send(request) {
      calls.push(request);
      const next = answers.shift();
      if (next === undefined) throw new Error(`unexpected transport call to ${request.url}`);
      return next;
    },
  };
}
async function collect(iterable) {
  const chunks = [];
  for await (const chunk of iterable) chunks.push(chunk);
  return chunks;
}
const hello = { model: "deepseek/deepseek-v4-pro", stream: true, messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }] };
const done = (reason = "stop") => [{ type: "finish-step", finishReason: reason, usage: { inputTokens: 5, outputTokens: 2 } }, { type: "finish" }];

test("commandcode is connectable with its CLI headers, a session id per request, and a Bearer key", async () => {
  assert.ok(createAdapter(commandcode, fakeTransport()) instanceof CommandCodeAdapter);
  assert.equal(commandcode.chatUrl, "https://api.commandcode.ai/alpha/generate");
  const transport = fakeTransport(ndjson([{ type: "text-delta", text: "a" }, ...done()]), ndjson([{ type: "text-delta", text: "b" }, ...done()]));
  const adapter = new CommandCodeAdapter(commandcode, transport);
  await collect(adapter.stream(hello, credential, ctx()));
  await collect(adapter.stream(hello, credential, ctx()));
  const [first, second] = transport.calls;
  assert.deepEqual([first.headers["x-command-code-version"], first.headers["x-cli-environment"], first.headers.authorization, first.headers.accept],
    ["0.25.7", "cli", `Bearer ${credential.apiKey}`, "text/event-stream"]);
  assert.match(first.headers["x-session-id"], /^[0-9a-f-]{36}$/);
  assert.notEqual(first.headers["x-session-id"], second.headers["x-session-id"]);
});

test("the envelope keeps 9router's request rules: defaults, drops, blocks, and a neutral workingDir", async () => {
  const transport = fakeTransport(ndjson([{ type: "text-delta", text: "ok" }, ...done()]));
  await collect(new CommandCodeAdapter(commandcode, transport).stream({
    ...hello,
    system: [{ type: "text", text: "be" }, { type: "text", text: "brief" }],
    messages: [
      { role: "user", content: [{ type: "text", text: "look" }, { type: "image", source: { kind: "base64", mediaType: "image/png", data: "AAAA" } }, { type: "audio", source: { kind: "base64", mediaType: "audio/wav", data: "UklG" } }] },
      { role: "assistant", content: [{ type: "text", text: "calling" }, { type: "tool_call", id: "t1", name: "lookup", arguments: "not json" }] },
      { role: "tool", content: [{ type: "tool_result", toolCallId: "t1", content: [{ type: "text", text: "42" }] }] },
    ],
    tools: [{ name: "lookup", description: "d" }],
    toolChoice: "required", stop: ["x"], topP: 0.5,
  }, credential, ctx()));
  const sent = JSON.parse(transport.calls[0].body);
  assert.match(sent.threadId, /^[0-9a-f-]{36}$/);
  assert.deepEqual([sent.memory, sent.model, sent.stream, sent.config.workingDir, sent.config.environment, sent.config.isGitRepo], ["", "deepseek/deepseek-v4-pro", true, "/", process.platform, false]);
  assert.match(sent.config.date, /^\d{4}-\d{2}-\d{2}$/);
  const params = sent.params;
  assert.deepEqual([params.max_tokens, params.temperature, params.top_p, params.stream, params.system], [64000, 0.3, 0.5, true, "be\n\nbrief"]);
  for (const dropped of ["tool_choice", "stop", "reasoning_effort"]) assert.equal(params[dropped], undefined, dropped);
  assert.deepEqual(params.messages, [
    { role: "user", content: [{ type: "text", text: "look" }, { type: "image", image: "data:image/png;base64,AAAA", mimeType: "image/png", mediaType: "image/png" }] },
    { role: "assistant", content: [{ type: "reasoning", text: " " }, { type: "text", text: "calling" }, { type: "tool-call", toolCallId: "t1", toolName: "lookup", input: {} }] },
    { role: "tool", content: [{ type: "tool-result", toolCallId: "t1", toolName: "", output: { type: "text", value: "42" } }] },
  ]);
  assert.deepEqual(params.tools, [{ name: "lookup", description: "d", input_schema: { type: "object" } }]);
  await assert.rejects(collect(new CommandCodeAdapter(commandcode, fakeTransport()).stream({ ...hello, messages: [{ role: "user", content: [{ type: "image", source: { kind: "url", url: "https://x.example/a.png" } }] }] }, credential, ctx())),
    (e) => e instanceof UnsupportedFeatureError, "an image by URL is refused (9router fetches it server-side)");
});

test("thinking becomes params.reasoning_effort: a level, a budget as a level, none left out", async () => {
  const effortOf = async (extra) => {
    const transport = fakeTransport(ndjson([{ type: "text-delta", text: "ok" }, ...done()]));
    await collect(new CommandCodeAdapter(commandcode, transport).stream({ ...hello, maxOutputTokens: 100, temperature: 1, ...extra }, credential, ctx()));
    const params = JSON.parse(transport.calls[0].body).params;
    assert.deepEqual([params.max_tokens, params.temperature], [100, 1]);
    return params.reasoning_effort;
  };
  assert.equal(await effortOf({ reasoning: { effort: "high" } }), "high");
  assert.equal(await effortOf({ reasoning: { budgetTokens: 2000 } }), "low");
  assert.equal(await effortOf({ reasoning: { budgetTokens: 0 } }), "medium");
  assert.equal(await effortOf({ vendorExtensions: { openai: { reasoning_effort: "xhigh" } } }), "xhigh");
  assert.equal(await effortOf({ vendorExtensions: { openai: { reasoning_effort: "none" } } }), undefined);
});

test("every NDJSON line becomes a chunk, even those after the first content event in the same read", async () => {
  const transport = fakeTransport(ndjson([
    { type: "start" }, "not json", { type: "reasoning-delta", text: "think" }, { type: "text-delta", delta: "Hel" }, "data: {\"type\":\"text-delta\",\"text\":\"lo\"}",
    { type: "tool-input-start", id: "c1", toolName: "lookup" }, { type: "tool-input-delta", id: "c1", delta: "{\"q\":" }, { type: "tool-input-delta", id: "zz", delta: "lost" },
    { type: "tool-input-delta", id: "c1", inputTextDelta: "1}" }, { type: "tool-call", toolCallId: "c1", toolName: "lookup", input: { q: 1 } },
    { type: "tool-call", toolCallId: "c2", toolName: "other", input: { a: true } },
    { type: "finish-step", finishReason: "tool-calls", usage: { inputTokens: 1, outputTokens: 1 } }, { type: "finish", totalUsage: { inputTokens: 9, outputTokens: 4, cachedInputTokens: 3, reasoningTokens: 2 } },
    { type: "text-delta", text: "after finish" },
  ]));
  const chunks = await collect(new CommandCodeAdapter(commandcode, transport).stream(hello, credential, ctx()));
  assert.match(chunks[0].id, /^chatcmpl-\d+$/);
  assert.deepEqual(chunks.slice(1), [
    { type: "thinking_delta", index: 0, text: "think" },
    { type: "text_delta", index: 0, text: "Hel" },
    { type: "text_delta", index: 0, text: "lo" },
    { type: "tool_call_delta", index: 0, id: "c1", name: "lookup", argumentsDelta: "" },
    { type: "tool_call_delta", index: 0, argumentsDelta: "{\"q\":" },
    { type: "tool_call_delta", index: 0, argumentsDelta: "1}" },
    { type: "tool_call_delta", index: 1, id: "c2", name: "other", argumentsDelta: "{\"a\":true}" },
    { type: "usage", usage: { inputTokens: 9, outputTokens: 4 } },
    { type: "stop", stopReason: "tool_use" },
  ], "cached and reasoning tokens are dropped, as in 9router");
});

test("finish reasons follow 9router: error and unknown end the turn, length is max_tokens; a cut-off ends normally", async () => {
  const stopOf = async (events) => (await collect(new CommandCodeAdapter(commandcode, fakeTransport(ndjson(events))).stream(hello, credential, ctx()))).at(-1);
  assert.deepEqual(await stopOf([{ type: "text-delta", text: "a" }, ...done("length")]), { type: "stop", stopReason: "max_tokens" });
  assert.deepEqual(await stopOf([{ type: "text-delta", text: "a" }, ...done("content-filter")]), { type: "stop", stopReason: "content_filter" });
  assert.deepEqual(await stopOf([{ type: "text-delta", text: "a" }, ...done("error")]), { type: "stop", stopReason: "end_turn" });
  assert.deepEqual(await stopOf([{ type: "text-delta", text: "a" }, { type: "finish", finishReason: "length" }]), { type: "stop", stopReason: "max_tokens" }, "no finish-step: finish's own reason");
  assert.deepEqual(await stopOf([{ type: "text-delta", text: "a" }, { type: "tool-error", error: "x" }]), { type: "stop", stopReason: "end_turn" }, "cut off without finish");
});

test("an error before content is an HTTP-style error (retried when 5xx); after content it is 9router's fixed text", async () => {
  const early = (value) => collect(new CommandCodeAdapter(commandcode, fakeTransport(ndjson([{ type: "start" }, value]))).stream(hello, credential, ctx()));
  await assert.rejects(early({ type: "error", error: { message: "slow down", statusCode: 429 } }),
    (e) => e.code === "RATE_LIMIT" && e.message === "Command Code answered 429: [CommandCode error: slow down]");
  await assert.rejects(early({ type: "error", error: `Unauthorized for ${credential.apiKey}` }), (e) => e.code === "AUTH_ERROR" && e.details.status === 401 && e.message.includes("***"));
  await assert.rejects(early({ type: "error", message: "billing problem" }), (e) => e.code === "QUOTA_EXHAUSTED" && e.details.status === 402);
  const retried = fakeTransport(ndjson([{ type: "error", error: "overloaded" }]), ndjson([{ type: "text-delta", text: "ok" }, ...done()]));
  const chunks = await collect(new CommandCodeAdapter(commandcode, retried).stream(hello, credential, ctx()));
  assert.equal(retried.calls.length, 2, "an in-band 503 before content is retried");
  assert.notEqual(retried.calls[0].headers["x-session-id"], retried.calls[1].headers["x-session-id"]);
  assert.equal(chunks[1].text, "ok");
  const late = new CommandCodeAdapter(commandcode, fakeTransport(ndjson([{ type: "text-delta", text: "par" }, { type: "error", error: "boom" }]), ndjson([{ type: "text-delta", text: "par" }, { type: "error", error: "boom" }])));
  await assert.rejects(collect(late.stream(hello, credential, ctx())), (e) => e.code === "PROVIDER_UNAVAILABLE" && e.details.partial === true && e.message === "upstream connection lost");
  await assert.rejects(late.execute({ ...hello, stream: false }, credential, ctx()), (e) => e.message === "Command Code sent a stream that failed: Failed to convert streaming response to JSON");
});

test("a non-streaming client gets the collapsed stream", async () => {
  const run = (events) => new CommandCodeAdapter(commandcode, fakeTransport(ndjson(events))).execute({ ...hello, stream: false }, credential, ctx());
  const answer = await run([{ type: "reasoning-delta", text: "hmm" }, { type: "text-delta", text: "Hi" }, ...done()]);
  assert.deepEqual([answer.content, answer.stopReason, answer.usage, answer.model], [[{ type: "text", text: "Hi" }], "end_turn", { inputTokens: 5, outputTokens: 2 }, hello.model], "reasoning is dropped when there is content");
  assert.deepEqual((await run([{ type: "reasoning-delta", text: "only" }, ...done()])).content, [{ type: "thinking", text: "only" }]);
  const tools = await run([{ type: "tool-call", toolCallId: "c9", toolName: "f", input: "{}" }, ...done("stop")]);
  assert.deepEqual([tools.content, tools.stopReason], [[{ type: "tool_call", id: "c9", name: "f", arguments: "{}" }], "tool_use"]);
  await assert.rejects(run([{ type: "start" }]), (e) => e.message === "Command Code sent an empty stream: Invalid SSE response");
});

test("the connection test sends a one-token ping and reads the first event", async () => {
  const transport = fakeTransport(
    json(401, { success: false, error: { code: "UNAUTHORIZED", status: 401, message: "Invalid 'Authorization' header or token." } }),
    ndjson([{ type: "start" }, { type: "error", error: "authentication failed" }]),
    ndjson([{ type: "error", error: { message: "no credits", statusCode: 402 } }]),
    ndjson([{ type: "start" }, { type: "text-delta", text: "p" }, ...done()]),
    json(503, { error: { message: "busy" } }),
  );
  const adapter = new CommandCodeAdapter(commandcode, transport);
  assert.deepEqual(await adapter.validateCredential(credential, ctx()), { valid: false, code: "AUTH_ERROR", message: "Command Code answered 401: Invalid 'Authorization' header or token." });
  const ping = JSON.parse(transport.calls[0].body).params;
  assert.deepEqual([ping.model, ping.max_tokens, ping.messages], [commandcode.models[0].id, 1, [{ role: "user", content: [{ type: "text", text: "ping" }] }]]);
  assert.deepEqual((await adapter.validateCredential(credential, ctx())).code, "AUTH_ERROR", "an error event in a 200 answer");
  assert.deepEqual((await adapter.validateCredential(credential, ctx())).code, "QUOTA_EXHAUSTED");
  assert.deepEqual(await adapter.validateCredential(credential, ctx()), { valid: true });
  await assert.rejects(adapter.validateCredential(credential, ctx()), (e) => e.code === "PROVIDER_UNAVAILABLE");
  assert.equal(transport.calls.length, 5, "the test never retries, even a 503");
  assert.equal((await adapter.getModels(credential, ctx())).length, commandcode.models.length);
});
