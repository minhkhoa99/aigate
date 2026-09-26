// Contract: docs/contracts/provider-gemini.md — the gemini adapter against a fake HttpTransportPort.
import { test } from "node:test";
import assert from "node:assert/strict";
import { builtinRegistry, cleanGeminiSchema, createAdapter, GeminiAdapter, OpenAIChatStreamEncoder, toOpenAIChatCompletion } from "../dist/index.js";

const SECRET = "gemini-test-secret-value";
const credential = { kind: "api-key", apiKey: SECRET };
const gemini = builtinRegistry.provider("gemini");
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
const sse = (events, size = 9) => ({ status: 200, headers: { "content-type": "text/event-stream" }, body: body(events.map((e) => `data: ${JSON.stringify(e)}\r\n\r\n`).join(""), size) });
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
const hello = { model: "gemini-2.5-pro", stream: false, messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }] };
const reply = (parts, extra = {}) => ({ responseId: "r1", modelVersion: "gemini-2.5-pro-001", candidates: [{ content: { role: "model", parts }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4, thoughtsTokenCount: 3, totalTokenCount: 17 }, ...extra });
const sentBody = (transport, i = 0) => JSON.parse(transport.calls[i].body);

test("gemini is connectable with x-goog-api-key at <base>/<model>:generateContent", async () => {
  assert.equal(builtinRegistry.providers.length, 55);
  assert.ok(createAdapter(gemini, fakeTransport()) instanceof GeminiAdapter);
  assert.deepEqual(gemini.auth, { kind: "api-key", header: "x-goog-api-key", scheme: "raw" });
  const transport = fakeTransport(json(200, reply([{ text: "ok" }])));
  await new GeminiAdapter(gemini, transport).execute(hello, credential, ctx());
  const [call] = transport.calls;
  assert.equal(call.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent");
  assert.equal(call.headers["x-goog-api-key"], SECRET);
  assert.equal(call.headers.authorization, undefined);
});

test("the request follows 9router: safety off, dropped fields, sanitized names, borrowed signature, tool answers", async () => {
  const transport = fakeTransport(json(200, reply([{ text: "ok" }])));
  await new GeminiAdapter(gemini, transport).execute({
    ...hello,
    system: [{ type: "text", text: "be " }, { type: "text", text: "brief" }],
    messages: [
      { role: "user", content: [{ type: "text", text: "look" }, { type: "image", source: { kind: "base64", mediaType: "image/png", data: "AAAA" } },
        { type: "image", source: { kind: "url", url: "https://x.example/a.png" } }, { type: "audio", source: { kind: "base64", mediaType: "audio/mpeg", data: "SUQz" } },
        { type: "file", mediaType: "application/pdf", source: { kind: "url", url: "https://x.example/a.pdf" } }] },
      { role: "assistant", content: [{ type: "text", text: "calling" }, { type: "tool_call", id: "call_a", name: "my tool", arguments: "{\"q\":1}" },
        { type: "tool_call", id: "call_b", name: "9lives", arguments: "not json" }, { type: "tool_call", id: "call_c", name: "c", arguments: "" }] },
      { role: "tool", content: [{ type: "tool_result", toolCallId: "call_a", content: [{ type: "text", text: "{\"ok\":true}" }] }] },
      { role: "tool", content: [{ type: "tool_result", toolCallId: "call_b", content: [{ type: "text", text: "42" }] }] },
      { role: "user", content: [{ type: "text", text: "next" }] },
    ],
    tools: [
      { name: "my tool", description: "d", parameters: { type: "object", properties: { title: { type: "string", format: "uri", title: "T" }, n: { const: 3 } }, required: ["title", "gone"], additionalProperties: false } },
      { name: "empty", parameters: { type: "object", properties: {} } },
      { name: "y".repeat(70), parameters: { type: "object", properties: { a: { type: "string" } } } },
    ],
    toolChoice: "required", stop: ["END"], temperature: 0.2, topP: 0.9, maxOutputTokens: 100,
    vendorExtensions: { openai: { top_k: 5, response_format: { type: "json_object" }, seed: 3 } },
  }, credential, ctx());
  const sent = sentBody(transport);
  assert.equal(sent.model, "gemini-2.5-pro");
  assert.deepEqual(sent.safetySettings.map((s) => [s.category, s.threshold]), [
    ["HARM_CATEGORY_HATE_SPEECH", "OFF"], ["HARM_CATEGORY_DANGEROUS_CONTENT", "OFF"], ["HARM_CATEGORY_SEXUALLY_EXPLICIT", "OFF"], ["HARM_CATEGORY_HARASSMENT", "OFF"], ["HARM_CATEGORY_CIVIC_INTEGRITY", "OFF"],
  ]);
  assert.deepEqual(sent.generationConfig, { temperature: 0.2, topP: 0.9, topK: 5, maxOutputTokens: 100 });
  assert.deepEqual(sent.systemInstruction, { role: "user", parts: [{ text: "be brief" }] });
  for (const dropped of ["stopSequences", "toolConfig", "responseMimeType", "seed"]) assert.equal(sent[dropped] ?? sent.generationConfig[dropped], undefined, dropped);
  assert.deepEqual(sent.contents[0], { role: "user", parts: [
    { text: "look" }, { inlineData: { mime_type: "image/png", data: "AAAA" } }, { fileData: { fileUri: "https://x.example/a.png", mimeType: "image/*" } },
    { inlineData: { mime_type: "audio/mpeg", data: "SUQz" } },
  ] }, "a file by URL is dropped");
  const model = sent.contents[1];
  assert.equal(model.role, "model");
  assert.deepEqual(model.parts[0], { text: "calling" });
  assert.deepEqual(model.parts[1].functionCall, { id: "call_a", name: "my_tool", args: { q: 1 } });
  assert.equal(model.parts[1].thoughtSignature.length, 1172, "the first call carries the borrowed signature");
  assert.deepEqual(model.parts[2], { functionCall: { id: "call_b", name: "_9lives", args: null } }, "no signature for later calls; bad arguments are null");
  assert.deepEqual(model.parts[3].functionCall.args, {});
  assert.deepEqual(sent.contents[2], { role: "user", parts: [
    { functionResponse: { id: "call_a", name: "my_tool", response: { result: { ok: true } } } },
    { functionResponse: { id: "call_b", name: "_9lives", response: { result: { result: 42 } } } },
    { functionResponse: { id: "call_c", name: "c", response: { result: { result: "" } } } },
    { text: "next" },
  ] }, "tool answers follow the model turn and merge with the next user turn");
  assert.equal(sent.contents.length, 3);
  const [declared, empty, long] = sent.tools[0].functionDeclarations;
  assert.equal(long.name, "y".repeat(64), "names are cut to 64");
  assert.deepEqual(declared, { name: "my_tool", description: "d", parameters: { type: "object", properties: { title: { type: "string" }, n: { enum: ["3"], type: "string" } }, required: ["title"] } }, "a parameter named title is kept (corrected cleaner)");
  assert.deepEqual(empty, { name: "empty", description: "" }, "no invented reason parameter");
});

test("contents start with a user turn, and a lone system message is user content", async () => {
  const transport = fakeTransport(json(200, reply([{ text: "a" }])), json(200, reply([{ text: "b" }])));
  const adapter = new GeminiAdapter(gemini, transport);
  await adapter.execute({ ...hello, messages: [{ role: "assistant", content: [{ type: "text", text: "earlier" }] }, { role: "user", content: [{ type: "text", text: "q" }] }] }, credential, ctx());
  assert.deepEqual(sentBody(transport).contents.map((c) => [c.role, c.parts[0].text]), [["user", "..."], ["model", "earlier"], ["user", "q"]]);
  await adapter.execute({ ...hello, system: [{ type: "text", text: "only" }], messages: [] }, credential, ctx());
  const lone = sentBody(transport, 1);
  assert.deepEqual([lone.contents, lone.systemInstruction], [[{ role: "user", parts: [{ text: "only" }] }], undefined]);
});

test("an unanswered call before a later message still gets an empty functionResponse; other namespaces are refused", async () => {
  const transport = fakeTransport(json(200, reply([{ text: "a" }])));
  const adapter = new GeminiAdapter(gemini, transport);
  await adapter.execute({ ...hello, messages: [
    { role: "user", content: [{ type: "text", text: "q" }] },
    { role: "assistant", content: [{ type: "tool_call", id: "call_x", name: "x", arguments: "{}" }] },
    { role: "user", content: [{ type: "text", text: "go on" }] },
  ] }, credential, ctx());
  assert.deepEqual(sentBody(transport).contents[2], { role: "user", parts: [{ functionResponse: { id: "call_x", name: "x", response: { result: { result: "" } } } }, { text: "go on" }] });
  await assert.rejects(adapter.execute({ ...hello, vendorExtensions: { anthropic: { top_k: 1 } } }, credential, ctx()), (e) => e.name === "UnsupportedFeatureError");
});

test("thinking follows the model: a budget for gemini-2.5, a level for gemini-3, nothing for others", async () => {
  const run = async (model, effort, max) => {
    const transport = fakeTransport(json(200, reply([{ text: "ok" }])));
    const standard = effort === "high" || effort === "low" || effort === "medium";
    await new GeminiAdapter(gemini, transport).execute({ ...hello, model, ...(max ? { maxOutputTokens: max } : {}), ...(standard ? { reasoning: { effort } } : { vendorExtensions: { openai: { reasoning_effort: effort } } }) }, credential, ctx());
    return sentBody(transport).generationConfig;
  };
  assert.deepEqual(await run("gemini-2.5-pro", "high", 100), { maxOutputTokens: 32768, thinkingConfig: { thinkingBudget: 24576, includeThoughts: true } });
  assert.deepEqual(await run("gemini-2.5-flash", "none"), { thinkingConfig: { thinkingBudget: 0, includeThoughts: false } });
  assert.deepEqual(await run("gemini-2.5-flash", "xhigh", 50000), { maxOutputTokens: 50000, thinkingConfig: { thinkingBudget: 24576, includeThoughts: true } }, "clamped; a larger client limit stays");
  assert.deepEqual(await run("gemini-3-flash-preview", "low"), { maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: "low", includeThoughts: true } });
  assert.deepEqual(await run("gemini-3.1-pro-preview", "none"), { maxOutputTokens: 4096, thinkingConfig: { thinkingLevel: "minimal", includeThoughts: false } });
  assert.deepEqual(await run("gemini-3.1-pro-preview", "max"), { maxOutputTokens: 65535, thinkingConfig: { thinkingLevel: "high", includeThoughts: true } });
  assert.deepEqual(await run("gemma-4-31b-it", "high"), {}, "a model without thinking gets none, as in 9router");
  assert.deepEqual(await run("gemini-3-pro-image-preview", "high"), {}, "image models get none");
  const transport = fakeTransport(json(200, reply([{ text: "ok" }])));
  await new GeminiAdapter(gemini, transport).execute({ ...hello, model: "gemini-3-flash-preview", reasoning: { budgetTokens: 500 } }, credential, ctx());
  assert.deepEqual(sentBody(transport).generationConfig.thinkingConfig, { thinkingLevel: "minimal", includeThoughts: false }, "a budget becomes a level");
});

test("the non-streaming answer keeps 9router's mapping: raw finish, thoughts as prompt tokens, images as markdown", async () => {
  const run = async (value) => new GeminiAdapter(gemini, fakeTransport(json(200, value))).execute(hello, credential, ctx());
  const parts = [{ text: "plan", thought: true }, { text: "Hi" }, { inlineData: { mimeType: "image/jpeg", data: "IMG" } }];
  const answer = await run({ ...reply(parts), candidates: [{ content: { parts }, finishReason: "MAX_TOKENS" }] });
  assert.deepEqual(answer.content, [{ type: "thinking", text: "plan" }, { type: "text", text: "Hi\n![image](data:image/jpeg;base64,IMG)\n" }]);
  assert.equal(answer.stopReason, "max_tokens");
  assert.deepEqual(answer.vendorExtensions, { openai: { finish_reason: "max_tokens" } });
  assert.deepEqual(answer.usage, { inputTokens: 13, outputTokens: 4, reasoningTokens: 3 });
  assert.deepEqual([answer.id, answer.model], ["chatcmpl-r1", "gemini-2.5-pro-001"]);
  const rendered = toOpenAIChatCompletion(answer, { created: 1, fallbackId: "x" });
  assert.equal(rendered.choices[0].finish_reason, "max_tokens", "the raw reason reaches the client");
  assert.deepEqual([rendered.usage.prompt_tokens, rendered.usage.completion_tokens], [13, 4]);
  const tools = await run(reply([{ functionCall: { name: "lookup", args: { q: 1 } } }]));
  assert.match(tools.content[0].id, /^call_lookup_\d+_0$/);
  assert.deepEqual([tools.stopReason, tools.vendorExtensions.openai.finish_reason], ["tool_use", "tool_calls"]);
  const blocked = await run({ promptFeedback: { blockReason: "SAFETY" } });
  assert.deepEqual([blocked.content, blocked.model, blocked.stopReason], [[], "gemini", "end_turn"], "a body without candidates is an empty answer");
});

test("the stream keeps 9router's mapping, caches thought signatures, and replays them", async () => {
  const transport = fakeTransport(sse([
    { error: { code: 500, message: "ignored" } },
    { responseId: "r9", modelVersion: "gemini-2.5-pro-002", candidates: [{ content: { parts: [{ text: "hmm", thought: true }] } }] },
    { candidates: [{ content: { parts: [{ text: "Hi" }, { thoughtSignature: "SIG-REAL" }, { functionCall: { id: "fc_1", name: "lookup", args: { q: 1 } } }] } }] },
    { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "PNG" } }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 8, cachedContentTokenCount: 2, candidatesTokenCount: 3, thoughtsTokenCount: 1 } },
  ]), json(200, reply([{ text: "ok" }])));
  const adapter = new GeminiAdapter(gemini, transport);
  const chunks = await collect(adapter.stream({ ...hello, stream: true }, credential, ctx()));
  assert.equal(transport.calls[0].url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse");
  assert.deepEqual(chunks, [
    { type: "start", id: "chatcmpl-r9", model: "gemini-2.5-pro-002" },
    { type: "thinking_delta", index: 0, text: "hmm" },
    { type: "text_delta", index: 0, text: "Hi" },
    { type: "tool_call_delta", index: 0, id: "fc_1", name: "lookup", argumentsDelta: "{\"q\":1}" },
    { type: "image_delta", mediaType: "image/png", data: "PNG" },
    { type: "usage", usage: { inputTokens: 6, outputTokens: 4, cacheReadTokens: 2, reasoningTokens: 1 } },
    { type: "stop", stopReason: "tool_use" },
  ]);
  await adapter.execute({ ...hello, messages: [{ role: "user", content: [{ type: "text", text: "q" }] }, { role: "assistant", content: [{ type: "tool_call", id: "fc_1", name: "lookup", arguments: "{}" }] }] }, credential, ctx());
  assert.equal(sentBody(transport, 1).contents[1].parts[0].thoughtSignature, "SIG-REAL", "the real signature replaces the borrowed one");
  assert.equal(sentBody(transport, 1).contents.length, 2, "a last model turn without answers gets no functionResponse turn");
  const other = fakeTransport(json(200, reply([{ text: "ok" }])));
  await new GeminiAdapter(gemini, other).execute({ ...hello, model: "gemma-4-31b-it", messages: [{ role: "user", content: [{ type: "text", text: "q" }] }, { role: "assistant", content: [{ type: "tool_call", id: "fc_1", name: "lookup", arguments: "{}" }] }] }, credential, ctx());
  assert.equal(sentBody(other).contents[1].parts[0].thoughtSignature.length, 1172, "a signature only replays to its own model family");
  const encoded = new OpenAIChatStreamEncoder({ created: 1, fallbackId: "x", requestId: "r", model: "m", includeUsage: false });
  assert.match(encoded.encode({ type: "image_delta", mediaType: "image/png", data: "PNG" }), /"images":\[\{"type":"image_url","image_url":\{"url":"data:image\/png;base64,PNG"\}\}\]/);
});

test("the stream ends normally without finishReason, and a stream of only errors is an empty answer (9router)", async () => {
  const run = (events) => collect(new GeminiAdapter(gemini, fakeTransport(sse(events))).stream({ ...hello, stream: true }, credential, ctx()));
  const cut = await run([{ candidates: [{ content: { parts: [{ text: "par" }] } }] }]);
  assert.deepEqual(cut.at(-1), { type: "stop", stopReason: "end_turn" });
  assert.deepEqual(await run([{ error: { message: "quota" } }, { promptFeedback: { blockReason: "SAFETY" } }]), [{ type: "start", id: "", model: "gemini-2.5-pro" }, { type: "stop", stopReason: "end_turn" }]);
  const safety = await run([{ candidates: [{ content: { parts: [{ text: "x" }] }, finishReason: "SAFETY" }] }]);
  assert.deepEqual(safety.at(-1), { type: "stop", stopReason: "content_filter" });
  const signed = await run([{ candidates: [{ content: { parts: [{ thoughtSignature: "S", inlineData: { mimeType: "image/png", data: "X" } }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 5, thoughtsTokenCount: 2, totalTokenCount: 10 } }]);
  assert.ok(!signed.some((c) => c.type === "image_delta"), "a part with a signature shows nothing else");
  assert.deepEqual(signed.find((c) => c.type === "usage").usage, { inputTokens: 5, outputTokens: 5, reasoningTokens: 2 }, "candidates from the total");
});

test("the model list strips models/; a 400 on the key check is an invalid key", async () => {
  const transport = fakeTransport(json(200, { models: [{ name: "models/gemini-2.5-pro" }, { name: "models/new-one" }] }), json(400, { error: { code: 400, message: "API key not valid", status: "INVALID_ARGUMENT" } }), json(500, {}));
  const adapter = new GeminiAdapter(gemini, transport);
  assert.deepEqual((await adapter.getModels(credential, ctx())).map((m) => [m.id, Boolean(m.descriptor)]), [["gemini-2.5-pro", true], ["new-one", false]]);
  assert.equal(transport.calls[0].url, "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000");
  const refused = await adapter.validateCredential(credential, ctx());
  assert.deepEqual([refused.valid, refused.code], [false, "AUTH_ERROR"]);
  assert.ok(!transport.calls[1].url.includes(SECRET), "the key never goes in the URL");
  await assert.rejects(adapter.validateCredential(credential, ctx()), (e) => e.code === "PROVIDER_UNAVAILABLE");
});

test("the corrected schema cleaner keeps parameters named like keywords and flattens what Gemini cannot express", () => {
  assert.deepEqual(cleanGeminiSchema({
    type: "object",
    properties: {
      const: { type: "string" }, default: { anyOf: [{ type: "null" }, { type: "string" }, { type: "object", properties: { a: { type: "integer" } } }] },
      list: { type: "array" }, kind: { type: ["null", "number"], "x-ui": 1 }, both: { allOf: [{ properties: { x: { type: "string" } }, required: ["x"] }, { properties: { y: { type: "string" } } }] },
      tuple: { type: "array", prefixItems: [{ type: "string" }] }, nested: { type: "object" }, choice: { enum: [1, 2] },
    },
    required: ["const", "missing"], $schema: "x",
  }), {
    type: "object",
    properties: {
      const: { type: "string" }, default: { type: "object", properties: { a: { type: "integer" } } },
      list: { type: "array", items: { type: "string" } }, kind: { type: "number" }, both: { type: "object", properties: { x: { type: "string" }, y: { type: "string" } }, required: ["x"] },
      tuple: { type: "array", items: { type: "string" } }, nested: { type: "object" }, choice: { enum: ["1", "2"], type: "string" },
    },
    required: ["const"],
  });
  assert.equal(cleanGeminiSchema({ type: "object" }), undefined);
  assert.equal(cleanGeminiSchema(undefined), undefined);
  const input = { type: "object", properties: { a: { type: "string", title: "A" } } };
  cleanGeminiSchema(input);
  assert.equal(input.properties.a.title, "A", "the client's schema is not mutated");
  assert.deepEqual(cleanGeminiSchema({ type: "array", items: { properties: { b: { const: 1 } } } }), { type: "array", items: { type: "object", properties: { b: { enum: ["1"], type: "string" } } } }, "items are walked");
  let deep = { type: "string", title: "bottom" };
  for (let i = 0; i < 70; i++) deep = { type: "object", properties: { p: deep } };
  assert.ok(JSON.stringify(cleanGeminiSchema(deep)).includes("bottom"), "the walk stops at depth 64");
});
