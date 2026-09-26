// Contract: docs/contracts/provider-openai-responses.md — the Responses adapter against a fake HttpTransportPort.
import { test } from "node:test";
import assert from "node:assert/strict";
import { builtinRegistry, createAdapter, EngineError, OpenAIResponsesAdapter } from "../dist/index.js";

const SECRET = "pplx-test-secret-value";
const credential = { kind: "api-key", apiKey: SECRET };
const pplx = builtinRegistry.provider("perplexity-agent");
const encoder = new TextEncoder();
const ctx = () => ({ signal: new AbortController().signal, requestId: "test" });

function body(text, size = 1 << 20) {
  const bytes = encoder.encode(text);
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) return controller.close();
      controller.enqueue(bytes.slice(offset, offset + size));
      offset += size;
    },
  });
}
const json = (status, value) => ({ status, headers: { "content-type": "application/json" }, body: body(JSON.stringify(value)) });
const sse = (events, size = 5) => ({
  status: 200, headers: { "content-type": "text/event-stream" },
  body: body(events.map((e) => `event: ${e.type ?? "x"}\ndata: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`).join(""), size),
});
function fakeTransport(...answers) {
  const calls = [];
  return {
    calls,
    async send(request) {
      calls.push(request);
      const next = answers.shift();
      if (next === undefined) throw new Error("unexpected transport call");
      if (next instanceof Error) throw next;
      return next;
    },
  };
}
async function collect(iterable) {
  const chunks = [];
  for await (const chunk of iterable) chunks.push(chunk);
  return chunks;
}
const hello = { model: "openai/gpt-5.4", stream: false, messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }] };
const reply = {
  id: "resp_1", object: "response", model: "openai/gpt-5.4", status: "completed",
  output: [
    { type: "reasoning", summary: [{ type: "summary_text", text: "think " }, { type: "summary_text", text: "more" }] },
    { type: "web_search_call", id: "ws_1", status: "completed" },
    { type: "message", role: "assistant", content: [{ type: "output_text", text: "Hel" }, { type: "output_text", text: "lo" }] },
    { type: "function_call", call_id: "call_1", name: "lookup", arguments: "{\"q\":1}" },
  ],
  usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 40 }, output_tokens: 20, output_tokens_details: { reasoning_tokens: 5 } },
};

test("perplexity-agent is connectable through the Responses adapter; codex and grok-cli wait for OAuth", () => {
  assert.equal(pplx.protocol, "openai-responses");
  assert.equal(pplx.chatUrl, "https://api.perplexity.ai/v1/responses");
  assert.ok(createAdapter(pplx, fakeTransport()) instanceof OpenAIResponsesAdapter);
  assert.equal(builtinRegistry.providers.length, 52);
  assert.deepEqual(builtinRegistry.status("codex"), { connectable: false, reason: "Needs OAuth sign-in (SP16)" });
});

test("execute sends 9router's Responses request with stream false and reads the Responses object", async () => {
  const transport = fakeTransport(json(200, reply));
  const response = await new OpenAIResponsesAdapter(pplx, transport).execute({
    ...hello,
    system: [{ type: "text", text: "be brief" }, { type: "text", text: "use French" }],
    messages: [
      { role: "user", content: [{ type: "text", text: "look" }, { type: "image", source: { kind: "url", url: "https://x.example/a.png" } },
        { type: "audio", source: { kind: "base64", mediaType: "audio/wav", data: "UklG" } }] },
      { role: "assistant", content: [{ type: "text", text: "calling" }, { type: "tool_call", id: "c".repeat(70), name: "  lookup  ", arguments: "not json" },
        { type: "tool_call", id: "call_x", name: "   ", arguments: "{}" }] },
      { role: "tool", content: [{ type: "tool_result", toolCallId: "call_0", content: [{ type: "text", text: "4" }, { type: "text", text: "2" }] }] },
    ],
    tools: [{ name: "lookup", description: "find", parameters: { type: "object" } }, { name: "x".repeat(140), parameters: { type: "object", properties: { a: {} } }, strict: true }, { name: " ", parameters: {} }],
    toolChoice: "required", stop: ["END"], temperature: 0.3, topP: 0.8, maxOutputTokens: 500, reasoning: { effort: "high" },
    vendorExtensions: { openai: { response_format: { type: "json_object" }, service_tier: "flex", parallel_tool_calls: false } },
  }, credential, { signal: new AbortController().signal, requestId: "t" });
  const [call] = transport.calls;
  assert.equal(call.url, "https://api.perplexity.ai/v1/responses");
  assert.equal(call.headers.authorization, `Bearer ${SECRET}`);
  assert.equal(call.headers.accept, "application/json");
  const sent = JSON.parse(call.body);
  assert.equal(sent.stream, false, "the corrected non-streaming path");
  assert.equal(sent.store, false);
  assert.equal(sent.instructions, "be brief\nuse French");
  assert.deepEqual(sent.input[0].content.slice(0, 2), [{ type: "input_text", text: "look" }, { type: "input_image", image_url: "https://x.example/a.png", detail: "auto" }]);
  assert.deepEqual(JSON.parse(sent.input[0].content[2].text), { type: "input_audio", input_audio: { data: "UklG", format: "wav" } }, "audio travels as JSON text");
  assert.deepEqual(sent.input[1], { type: "message", role: "assistant", content: [{ type: "output_text", text: "calling" }] });
  assert.deepEqual(sent.input[2], { type: "function_call", call_id: "c".repeat(64), name: "lookup", arguments: "{}" }, "id cut to 64, name trimmed, bad arguments become {}");
  assert.equal(sent.input.length, 4, "the nameless call is skipped");
  assert.deepEqual(sent.input[3], { type: "function_call_output", call_id: "call_0", output: "42" });
  assert.deepEqual(sent.tools, [
    { type: "function", name: "lookup", description: "find", parameters: { type: "object", properties: {} } },
    { type: "function", name: "x".repeat(128), description: "", parameters: { type: "object", properties: { a: {} } }, strict: true },
  ]);
  assert.deepEqual([sent.temperature, sent.top_p, sent.max_output_tokens, sent.service_tier], [0.3, 0.8, 500, "flex"]);
  assert.deepEqual(sent.reasoning, { effort: "high", summary: "auto" });
  for (const dropped of ["tool_choice", "stop", "response_format", "parallel_tool_calls"]) assert.equal(sent[dropped], undefined, `${dropped} is dropped, as in 9router`);
  assert.deepEqual(response.content, [
    { type: "thinking", text: "think more" },
    { type: "text", text: "Hello" },
    { type: "tool_call", id: "call_1", name: "lookup", arguments: "{\"q\":1}" },
  ], "the web search item is ignored");
  assert.equal(response.stopReason, "tool_use");
  assert.deepEqual([response.id, response.model], ["resp_1", "openai/gpt-5.4"]);
  assert.deepEqual(response.usage, { inputTokens: 60, outputTokens: 20, cacheReadTokens: 40, reasoningTokens: 5 });
});

test("execute reports truncation, refusals, failures, and malformed answers", async () => {
  const run = (value) => new OpenAIResponsesAdapter(pplx, fakeTransport(json(200, value))).execute(hello, credential, ctx());
  const cut = await run({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [{ type: "message", content: [{ type: "output_text", text: "par" }] }] });
  assert.equal(cut.stopReason, "max_tokens");
  const refused = await run({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }] });
  assert.deepEqual([refused.stopReason, refused.vendorExtensions], ["content_filter", { openai: { refusal: "no" } }]);
  assert.equal((await run({ output: [] })).stopReason, "end_turn");
  await assert.rejects(run({ status: "failed", output: [], error: { message: `boom ${SECRET}` } }),
    (e) => e instanceof EngineError && e.code === "PROVIDER_UNAVAILABLE" && e.message.includes("boom ***"));
  await assert.rejects(run({ status: "completed" }), (e) => e.code === "PROVIDER_UNAVAILABLE" && /output array/.test(e.message));
  await assert.rejects(run({ output: [{ type: "function_call", name: "x" }] }), (e) => /call_id or name/.test(e.message));
});

test("the stream follows 9router: deltas, parallel calls by item id, usage and finish on completed", async () => {
  const transport = fakeTransport(sse([
    { type: "response.created", response: { id: "resp_9" } },
    { type: "response.reasoning_summary_text.delta", delta: "hmm" },
    { type: "response.output_text.delta", delta: "Hi" },
    { type: "response.output_item.added", item: { type: "function_call", id: "fc_a", call_id: "call_a", name: "one" } },
    { type: "response.output_item.added", item: { type: "function_call", id: "fc_b", call_id: "call_b", name: "two" } },
    { type: "response.function_call_arguments.delta", item_id: "fc_b", delta: "{\"b\":" },
    { type: "response.function_call_arguments.delta", item_id: "fc_a", delta: "{}" },
    { type: "response.function_call_arguments.delta", item_id: "fc_b", delta: "2}" },
    { type: "response.output_item.done", item: { type: "function_call", id: "fc_b", arguments: "{\"b\":2}" } },
    { type: "response.output_item.added", item: { type: "custom_tool_call", id: "ct_c", call_id: "call_c", name: "three" } },
    { type: "response.output_item.done", item: { type: "custom_tool_call", id: "ct_c", arguments: "raw" } },
    { type: "response.completed", response: { usage: { input_tokens: 10, input_tokens_details: { cached_tokens: 4 }, output_tokens: 3 } } },
    { type: "response.output_text.delta", delta: "after the end" },
  ]));
  const chunks = await collect(new OpenAIResponsesAdapter(pplx, transport).stream({ ...hello, stream: true }, credential, ctx()));
  const sent = JSON.parse(transport.calls[0].body);
  assert.equal(sent.stream, true);
  assert.equal(transport.calls[0].headers.accept, "text/event-stream");
  assert.deepEqual(chunks, [
    { type: "start", id: "", model: "openai/gpt-5.4" },
    { type: "thinking_delta", index: 0, text: "hmm" },
    { type: "text_delta", index: 0, text: "Hi" },
    { type: "tool_call_delta", index: 0, id: "call_a", name: "one", argumentsDelta: "" },
    { type: "tool_call_delta", index: 1, id: "call_b", name: "two", argumentsDelta: "" },
    { type: "tool_call_delta", index: 1, argumentsDelta: "{\"b\":" },
    { type: "tool_call_delta", index: 0, argumentsDelta: "{}" },
    { type: "tool_call_delta", index: 1, argumentsDelta: "2}" },
    { type: "tool_call_delta", index: 2, id: "call_c", name: "three", argumentsDelta: "" },
    { type: "tool_call_delta", index: 2, argumentsDelta: "raw" },
    { type: "usage", usage: { inputTokens: 6, outputTokens: 3, cacheReadTokens: 4 } },
    { type: "stop", stopReason: "tool_use" },
  ], "done arguments are sent once only when no delta came; nothing after completed");
});

test("the stream keeps 9router's failure handling: error text, cut-off and incomplete answers end normally", async () => {
  const run = async (events) => collect(new OpenAIResponsesAdapter(pplx, fakeTransport(sse(events))).stream({ ...hello, stream: true }, credential, ctx()));
  assert.deepEqual(await run([{ type: "response.output_text.delta", delta: "par" }, { type: "response.failed", response: { error: { message: `quota ${SECRET}` } } }]), [
    { type: "start", id: "", model: "openai/gpt-5.4" },
    { type: "text_delta", index: 0, text: "par" },
    { type: "text_delta", index: 0, text: "[Error] quota ***" },
    { type: "stop", stopReason: "end_turn" },
  ]);
  assert.deepEqual((await run([{ type: "error", error: { code: "x" } }])).at(-2), { type: "text_delta", index: 0, text: "[Error] {\"code\":\"x\"}" });
  const cut = await run([{ type: "response.output_text.delta", delta: "par" }, { type: "response.incomplete", response: { incomplete_details: { reason: "max_output_tokens" } } }, "not json"]);
  assert.deepEqual(cut.at(-1), { type: "stop", stopReason: "end_turn" }, "no completed: still a normal end");
  assert.deepEqual(await run([]), [{ type: "start", id: "", model: "openai/gpt-5.4" }, { type: "stop", stopReason: "end_turn" }]);
  await assert.rejects(collect(new OpenAIResponsesAdapter(pplx, fakeTransport(json(200, reply))).stream({ ...hello, stream: true }, credential, ctx())),
    (e) => /non-SSE/.test(e.message));
});

test("the model list and the connection test are the OpenAI ones at <modelsUrl>", async () => {
  const transport = fakeTransport(json(200, { data: [{ id: "openai/gpt-5.4" }] }), json(401, { error: { message: "bad" } }));
  const adapter = new OpenAIResponsesAdapter(pplx, transport);
  assert.deepEqual((await adapter.getModels(credential, ctx())).map((m) => m.id), ["openai/gpt-5.4"]);
  assert.equal((await adapter.validateCredential(credential, ctx())).code, "AUTH_ERROR");
  assert.deepEqual(transport.calls.map((c) => [c.method, c.url]), [["GET", "https://api.perplexity.ai/v1/models"], ["GET", "https://api.perplexity.ai/v1/models"]]);
});
