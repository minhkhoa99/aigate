// Contract: docs/contracts/provider-ollama.md — the ollama adapter against a fake HttpTransportPort.
import { test } from "node:test";
import assert from "node:assert/strict";
import { builtinRegistry, createAdapter, EngineError, OllamaAdapter, UnsupportedFeatureError, withConnectionBaseUrl } from "../dist/index.js";

const SECRET = "ollama-test-secret-value";
const credential = { kind: "api-key", apiKey: SECRET };
const cloud = builtinRegistry.provider("ollama");
const local = builtinRegistry.provider("ollama-local");
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
const ndjson = (lines, size = 7) => ({ status: 200, headers: { "content-type": "application/x-ndjson" }, body: body(lines.map((l) => (typeof l === "string" ? l : JSON.stringify(l))).join("\n"), size) });
function fakeTransport(...answers) {
  const calls = [];
  return {
    calls,
    async send(request) {
      calls.push(request);
      const next = answers.shift();
      if (next === undefined) throw new Error("unexpected transport call");
      return next;
    },
  };
}
async function collect(iterable) {
  const chunks = [];
  for await (const chunk of iterable) chunks.push(chunk);
  return chunks;
}
const hello = { model: "glm-5", stream: false, messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }] };
const answer = { model: "glm-5", message: { role: "assistant", content: "Done", thinking: "think", tool_calls: [{ function: { name: "lookup", arguments: { q: 1 } } }] }, done: true, done_reason: "stop", prompt_eval_count: 12, eval_count: 5 };

test("ollama and ollama-local are connectable; speech-to-text services are media; ollama-local takes a host and no key", () => {
  assert.equal(builtinRegistry.providers.length, 55);
  assert.ok(createAdapter(cloud, fakeTransport()) instanceof OllamaAdapter);
  assert.deepEqual([cloud.chatUrl, cloud.modelsUrl], ["https://ollama.com/api/chat", "https://ollama.com/api/tags"]);
  for (const id of ["assemblyai", "deepgram"]) assert.deepEqual(builtinRegistry.status(id), { connectable: false, reason: "Media and search services come with SP22/SP23" });
  assert.deepEqual(builtinRegistry.status("nanobanana"), { connectable: true }, "image-only nanobanana is unchanged");
  assert.equal(local.auth.optional, true);
  assert.equal(cloud.auth.optional, undefined);
  assert.deepEqual([local.chatUrl, local.modelsUrl], ["http://localhost:11434/api/chat", "http://localhost:11434/api/tags"]);
  const moved = withConnectionBaseUrl(local, "https://gpu.example:11434/");
  assert.deepEqual([moved.chatUrl, moved.modelsUrl], ["https://gpu.example:11434/api/chat", "https://gpu.example:11434/api/tags"]);
  assert.equal(withConnectionBaseUrl(local, null), local);
  assert.equal(withConnectionBaseUrl(cloud, "https://x.example"), cloud, "only providers that declare it take a host");
});

test("execute maps CIP to /api/chat, with the corrected fields, and the answer back", async () => {
  const transport = fakeTransport(json(200, answer));
  const response = await new OllamaAdapter(cloud, transport).execute({
    ...hello,
    system: [{ type: "text", text: "be brief" }],
    messages: [
      { role: "user", content: [{ type: "text", text: "look" }, { type: "image", source: { kind: "base64", mediaType: "image/png", data: "AAAA" } }] },
      { role: "user", content: [{ type: "image", source: { kind: "base64", mediaType: "image/png", data: "BBBB" } }] },
      { role: "assistant", content: [{ type: "text", text: "calling" }, { type: "tool_call", id: "call_1", name: "lookup", arguments: "{\"q\":1}" }] },
      { role: "tool", content: [{ type: "tool_result", toolCallId: "call_1", content: [] }, { type: "tool_result", toolCallId: "other", content: [{ type: "text", text: "x" }] }] },
    ],
    tools: [{ name: "lookup", description: "find", parameters: { type: "object" } }],
    toolChoice: { name: "lookup" }, temperature: 0.2, topP: 0.9, maxOutputTokens: 100, stop: ["END"], reasoning: { effort: "high" },
    vendorExtensions: { openai: { seed: 7, presence_penalty: 0.1, frequency_penalty: 0.2, response_format: { type: "json_object" } } },
  }, credential, ctx());
  const [call] = transport.calls;
  assert.equal(call.url, "https://ollama.com/api/chat");
  assert.equal(call.headers.authorization, `Bearer ${SECRET}`);
  assert.equal(call.headers.accept, "application/json");
  const sent = JSON.parse(call.body);
  assert.equal(sent.stream, false);
  assert.deepEqual(sent.messages, [
    { role: "system", content: "be brief" },
    { role: "user", content: "look", images: ["AAAA"] },
    { role: "user", content: "", images: ["BBBB"] },
    { role: "assistant", content: "calling", tool_calls: [{ type: "function", function: { name: "lookup", arguments: { q: 1 } } }] },
    { role: "tool", tool_name: "lookup", content: "" },
    { role: "tool", tool_name: "unknown_tool", content: "x" },
  ], "the image-only turn and the empty tool result are kept");
  assert.deepEqual(sent.tools, [{ type: "function", function: { name: "lookup", description: "find", parameters: { type: "object" } } }]);
  assert.deepEqual(sent.tool_choice, { type: "function", function: { name: "lookup" } });
  assert.deepEqual(sent.options, { seed: 7, presence_penalty: 0.1, frequency_penalty: 0.2, temperature: 0.2, top_p: 0.9, num_predict: 100, stop: ["END"] });
  assert.deepEqual([sent.format, sent.think], ["json", "high"]);
  assert.deepEqual(response.content.map((p) => p.type), ["thinking", "text", "tool_call"]);
  assert.deepEqual(response.content[2].arguments, "{\"q\":1}");
  assert.match(response.content[2].id, /^call_0_\d+$/, "Ollama gives no id; one is made");
  assert.equal(response.stopReason, "tool_use");
  assert.deepEqual(response.usage, { inputTokens: 12, outputTokens: 5 });
  assert.equal(response.model, "glm-5");
});

test("execute refuses what Ollama cannot carry, and maps schemas, none, and length", async () => {
  const run = (request, reply = { ...answer, message: { content: "ok" } }) => new OllamaAdapter(cloud, fakeTransport(json(200, reply))).execute({ ...hello, ...request }, credential, ctx());
  await assert.rejects(run({ messages: [{ role: "user", content: [{ type: "image", source: { kind: "url", url: "https://x.example/a.png" } }] }] }), UnsupportedFeatureError);
  await assert.rejects(run({ messages: [{ role: "assistant", content: [{ type: "tool_call", id: "c", name: "x", arguments: "[1]" }] }] }), (e) => e instanceof EngineError && e.code === "INVALID_REQUEST");
  await assert.rejects(run({ vendorExtensions: { openai: { user: "u" } } }), (e) => e instanceof UnsupportedFeatureError && e.feature === "vendorExtensions.openai.user");
  await assert.rejects(run({ vendorExtensions: { openai: { reasoning_effort: "minimal" } } }), (e) => e.feature.includes("minimal"));
  const transport = fakeTransport(json(200, { ...answer, message: { content: "cut" }, done_reason: "length" }));
  const cut = await new OllamaAdapter(cloud, transport).execute({ ...hello, vendorExtensions: { openai: { reasoning_effort: "none", response_format: { type: "json_schema", json_schema: { schema: { type: "object" } } } } } }, credential, ctx());
  const sent = JSON.parse(transport.calls[0].body);
  assert.deepEqual([sent.think, sent.format], [false, { type: "object" }]);
  assert.equal(cut.stopReason, "max_tokens");
  await assert.rejects(run({}, { error: `model gone ${SECRET}` }), (e) => e.code === "PROVIDER_UNAVAILABLE" && e.message.includes("model gone ***"));
});

test("a keyless ollama-local connection sends no auth header; a keyless cloud connection is refused", async () => {
  const transport = fakeTransport(json(200, answer));
  await new OllamaAdapter(local, transport).execute(hello, { kind: "api-key", apiKey: "" }, ctx());
  assert.equal(transport.calls[0].headers.authorization, undefined);
  assert.equal(transport.calls[0].url, "http://localhost:11434/api/chat");
  await assert.rejects(new OllamaAdapter(cloud, fakeTransport()).execute(hello, { kind: "api-key", apiKey: "" }, ctx()), (e) => e.code === "AUTH_ERROR");
});

test("the NDJSON stream maps thinking, text, and whole tool calls, and ends on the done line", async () => {
  const transport = fakeTransport(ndjson([
    { model: "glm-5", message: { role: "assistant", thinking: "hmm" }, done: false },
    { model: "glm-5", message: { content: "Hi" }, done: false },
    "",
    { model: "glm-5", message: { tool_calls: [{ id: "t1", function: { name: "a", arguments: { x: 1 } } }] }, done: false },
    { model: "glm-5", message: { tool_calls: [{ function: { name: "b", arguments: "{}" } }] }, done: false },
    { model: "glm-5", message: { content: "" }, done: true, done_reason: "stop", prompt_eval_count: 3, eval_count: 2 },
  ]));
  const chunks = await collect(new OllamaAdapter(cloud, transport).stream({ ...hello, stream: true }, credential, ctx()));
  assert.equal(JSON.parse(transport.calls[0].body).stream, true);
  assert.equal(transport.calls[0].headers.accept, "application/x-ndjson");
  assert.deepEqual(chunks.slice(0, 4), [
    { type: "start", id: "", model: "glm-5" },
    { type: "thinking_delta", index: 0, text: "hmm" },
    { type: "text_delta", index: 0, text: "Hi" },
    { type: "tool_call_delta", index: 0, id: "t1", name: "a", argumentsDelta: "{\"x\":1}" },
  ]);
  assert.equal(chunks[4].index, 1, "a later tool call gets the next index");
  assert.equal(chunks[4].name, "b");
  assert.deepEqual(chunks.slice(5), [{ type: "usage", usage: { inputTokens: 3, outputTokens: 2 } }, { type: "stop", stopReason: "tool_use" }]);
});

test("the stream fails on an error line, a malformed line, or a cut-off (corrected)", async () => {
  const run = (lines) => collect(new OllamaAdapter(cloud, fakeTransport(ndjson(lines))).stream({ ...hello, stream: true }, credential, ctx()));
  await assert.rejects(run([{ message: { content: "par" } }, { error: "out of memory" }]), (e) => e.code === "PROVIDER_UNAVAILABLE" && e.details.partial === true && /out of memory/.test(e.message));
  await assert.rejects(run([{ error: "model not found" }]), (e) => e.details.partial === false);
  await assert.rejects(run([{ message: { content: "par" } }, "not json"]), (e) => /not a JSON object/.test(e.message));
  await assert.rejects(run([{ message: { content: "par" } }]), (e) => /before it finished/.test(e.message) && e.details.partial === true);
  const length = await run([{ message: { content: "a" } }, { done: true, done_reason: "length" }]);
  assert.deepEqual(length.at(-1), { type: "stop", stopReason: "max_tokens" });
});

test("the model list reads /api/tags; the connection test is GET /api/tags", async () => {
  const transport = fakeTransport(json(200, { models: [{ name: "glm-5", model: "glm-5" }, { name: "custom:7b" }, { name: "bad id" }] }), json(401, { error: "unauthorized" }));
  const adapter = new OllamaAdapter(cloud, transport);
  assert.deepEqual((await adapter.getModels(credential, ctx())).map((m) => [m.id, Boolean(m.descriptor)]), [["glm-5", true], ["custom:7b", false]]);
  assert.equal((await adapter.validateCredential(credential, ctx())).code, "AUTH_ERROR");
  assert.deepEqual(transport.calls.map((c) => c.url), ["https://ollama.com/api/tags", "https://ollama.com/api/tags"]);
});
