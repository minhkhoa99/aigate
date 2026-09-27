// Contract: docs/contracts/protocol-responses.md — the client-facing OpenAI Responses protocol.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  builtinRegistry, EngineError, parseOpenAIResponsesRequest, responsesClientGetsObject, responsesRequestFor, ResponsesStreamEncoder, toResponsesObject,
  UnsupportedFeatureError,
} from "../dist/index.js";

const openai = builtinRegistry.provider("openai");
const anthropic = builtinRegistry.provider("anthropic");
const gemini = builtinRegistry.provider("gemini");
const perplexity = builtinRegistry.provider("perplexity-agent");
const codebuddy = builtinRegistry.provider("codebuddy-cn");
const base = { model: "gpt-5", input: "hi" };
const events = (text) => text.split("\n\n").filter(Boolean).map((frame) => {
  const [head, data] = frame.split("\n");
  return { event: head.slice(7), ...JSON.parse(data.slice(6)) };
});

test("the Responses body goes through 9router's pivot: items, reasoning, tool calls, tools, and the copied fields", () => {
  const { request, customTools } = parseOpenAIResponsesRequest({
    model: "gpt-5",
    instructions: "be brief",
    input: [
      { type: "message", role: "developer", content: [{ type: "input_text", text: "rules" }] },
      { role: "user", content: [{ type: "input_text", text: "look" }, { type: "input_image", image_url: "data:image/png;base64,AAAA", detail: "high" }] },
      { type: "reasoning", summary: [{ type: "summary_text", text: "plan" }, { type: "summary_text", text: "more" }], encrypted_content: "ENC" },
      { type: "function_call", call_id: "c1", name: "shell", arguments: "{\"cmd\":\"ls\"}" },
      { type: "function_call", call_id: "c0", name: " " },
      { type: "custom_tool_call", call_id: "c2", name: "apply_patch", input: "*** Begin" },
      { type: "function_call_output", call_id: "c1", output: { ok: true } },
      { type: "custom_tool_call_output", call_id: "c2", output: "done" },
      { type: "reasoning", content: [{ type: "reasoning_text", text: "dropped by the user turn" }] },
      { type: "message", role: "user", content: "next" },
      { type: "item_reference", id: "x" },
      { type: "additional_tools", tools: [{ type: "function", name: "extra" }] },
      { type: "message", role: "assistant", content: [{ type: "output_text", text: "ok" }] },
    ],
    tools: [
      { type: "function", name: "shell", description: "run", parameters: { type: "object" }, strict: true },
      { type: "custom", name: "apply_patch", description: "patch", format: { type: "grammar", syntax: "lark", definition: "start: x" } },
      { type: "web_search" },
      { type: "function", function: { name: "chat_shaped", parameters: { type: "object", properties: { a: {} } } } },
    ],
    tool_choice: { type: "function", name: "shell" },
    reasoning: { effort: "minimal", summary: "auto" },
    max_output_tokens: 500,
    text: { verbosity: "low" }, previous_response_id: "resp_1", include: ["reasoning.encrypted_content"], store: false, prompt_cache_key: "k", client_metadata: { a: 1 },
  });
  assert.deepEqual(request.system, [{ type: "text", text: "be brief" }, { type: "text", text: "rules" }], "instructions, then developer messages");
  assert.deepEqual(request.messages, [
    { role: "user", content: [{ type: "text", text: "look" }, { type: "image", source: { kind: "base64", mediaType: "image/png", data: "AAAA" }, detail: "high" }] },
    { role: "assistant", content: [
      { type: "thinking", text: "plan\nmore", signature: "ENC" },
      { type: "tool_call", id: "c1", name: "shell", arguments: "{\"cmd\":\"ls\"}" },
      { type: "tool_call", id: "c2", name: "apply_patch", arguments: "{\"input\":\"*** Begin\"}" },
    ] },
    { role: "tool", content: [{ type: "tool_result", toolCallId: "c1", content: [{ type: "text", text: "{\"ok\":true}" }] }] },
    { role: "tool", content: [{ type: "tool_result", toolCallId: "c2", content: [{ type: "text", text: "done" }] }] },
    { role: "user", content: [{ type: "text", text: "next" }] },
    { role: "assistant", content: [{ type: "text", text: "ok" }] },
  ]);
  assert.deepEqual(request.tools, [
    { name: "shell", description: "run", parameters: { type: "object", properties: {} }, strict: true },
    { name: "apply_patch", description: "patch\n\nlark\nstart: x", parameters: { type: "object", properties: { input: { type: "string", description: "Raw freeform input for this custom tool" } }, required: ["input"], additionalProperties: false } },
    { name: "chat_shaped", description: "", parameters: { type: "object", properties: { a: {} } } },
    { name: "extra", description: "", parameters: { type: "object", properties: {} } },
  ], "hosted tools are dropped");
  assert.deepEqual([...customTools], ["apply_patch"]);
  assert.deepEqual([request.maxOutputTokens, request.toolChoice, request.reasoning, request.stream], [500, undefined, undefined, true]);
  assert.deepEqual(request.vendorExtensions, {
    openai: { text: { verbosity: "low" }, previous_response_id: "resp_1", tool_choice: { type: "function", name: "shell" }, reasoning_effort: "minimal" },
  }, "copied as 9router does; include, store, prompt_cache_key and client_metadata are deleted");
});

test("input, stream, choice and effort edges", () => {
  const blank = (input) => parseOpenAIResponsesRequest({ ...base, input }).request.messages;
  assert.deepEqual(blank("  "), [{ role: "user", content: [{ type: "text", text: "..." }] }]);
  assert.deepEqual(blank([]), [{ role: "user", content: [{ type: "text", text: "..." }] }]);
  assert.deepEqual(blank("hi"), [{ role: "user", content: [{ type: "text", text: "hi" }] }]);
  for (const input of ["", undefined, 5]) assert.throws(() => parseOpenAIResponsesRequest({ ...base, input }), (e) => e instanceof EngineError && e.details.param === "input");
  assert.throws(() => parseOpenAIResponsesRequest({ ...base, input: [{ role: "user", content: [{ type: "input_file", file_id: "f" }] }] }), (e) => e instanceof UnsupportedFeatureError && /input_file content/.test(e.message));
  assert.throws(() => parseOpenAIResponsesRequest({ ...base, input: [{ role: "tool", content: "x" }] }), /input\[0\]\.role/);
  assert.throws(() => parseOpenAIResponsesRequest({ model: "", input: "hi" }), /model/);
  assert.equal(parseOpenAIResponsesRequest(base).request.stream, true, "an omitted stream streams (9router)");
  assert.equal(parseOpenAIResponsesRequest(base, "application/json").request.stream, false);
  assert.equal(parseOpenAIResponsesRequest({ ...base, stream: false }).request.stream, false);
  const plain = parseOpenAIResponsesRequest({ ...base, tool_choice: "required", reasoning: { effort: "high" }, max_tokens: 9, max_output_tokens: 7, temperature: 1, top_p: 0.5 }).request;
  assert.deepEqual([plain.toolChoice, plain.reasoning, plain.maxOutputTokens, plain.temperature, plain.topP, plain.vendorExtensions], ["required", { effort: "high" }, 9, 1, 0.5, undefined]);
  const history = parseOpenAIResponsesRequest({ ...base, input: [
    { type: "reasoning", content: [{ type: "reasoning_text", text: "x" }] }, { type: "reasoning", summary: [{ text: "y" }] },
    { type: "custom_tool_call", call_id: "k", name: "p2", input: { a: 1 } },
  ] });
  assert.deepEqual(history.request.messages, [{ role: "assistant", content: [{ type: "thinking", text: "x\ny" }, { type: "tool_call", id: "k", name: "p2", arguments: "{\"input\":\"{\\\"a\\\":1}\"}" }] }]);
  assert.deepEqual([...history.customTools], ["p2"], "a custom call in the history marks the tool custom");
  const system = parseOpenAIResponsesRequest({ ...base, input: [{ role: "system", content: "s" }, { role: "user", content: "u" }] }).request;
  assert.deepEqual([system.system, system.messages.length], [[{ type: "text", text: "s" }], 1]);
});

test("the provider decides the request: passthrough for Responses, the pivot for openai, modelled fields only elsewhere", () => {
  const parsed = parseOpenAIResponsesRequest({
    model: "x/gpt", input: [{ type: "reasoning", summary: [{ text: "why" }] }, { type: "function_call", call_id: "a", name: "f", arguments: "{}" }, { type: "reasoning", summary: [{ text: "only" }] }, { role: "assistant", content: [] }],
    text: { format: { type: "json_object" } }, tools: [{ type: "web_search" }],
  });
  const upstream = { ...parsed.request, model: "gpt" };
  assert.deepEqual(responsesRequestFor(parsed, upstream, perplexity), { model: "gpt", messages: [], stream: true, vendorExtensions: { responses: parsed.body } });
  assert.equal(responsesRequestFor(parsed, upstream, openai), upstream);
  const claude = responsesRequestFor(parsed, upstream, anthropic);
  assert.deepEqual(claude.messages, [{ role: "assistant", content: [{ type: "tool_call", id: "a", name: "f", arguments: "{}" }] }], "reasoning dropped, the empty turn removed");
  assert.equal(claude.vendorExtensions, undefined);
  const viaGemini = responsesRequestFor(parsed, upstream, gemini);
  assert.deepEqual([viaGemini.messages.length, viaGemini.messages[1].content, viaGemini.vendorExtensions], [2, [{ type: "thinking", text: "only" }], undefined]);
  assert.deepEqual([openai, codebuddy, perplexity, anthropic, gemini].map(responsesClientGetsObject), [true, true, true, false, false]);
});

test("the non-streaming answer is 9router's response object, status the finish reason", () => {
  const meta = { created: 7, fallbackId: "chatcmpl-fb" };
  const answer = toResponsesObject({
    id: "chatcmpl-abc", model: "gpt-5", stopReason: "tool_use",
    content: [{ type: "thinking", text: "hm" }, { type: "text", text: "Hi" }, { type: "tool_call", id: "c1", name: "shell", arguments: "{\"a\":1}" }, { type: "tool_call", id: "c2", name: "apply_patch", arguments: "{\"input\":\"P\"}" }],
    usage: { inputTokens: 3, outputTokens: 2, cacheReadTokens: 1 },
  }, meta, new Set(["apply_patch"]));
  assert.deepEqual(answer, {
    id: "resp_abc", object: "response", created_at: 7, model: "gpt-5", status: "completed", background: false, error: null,
    output: [
      { type: "reasoning", summary: [{ type: "summary_text", text: "hm" }] },
      { type: "message", role: "assistant", content: [{ type: "output_text", text: "Hi", annotations: [] }] },
      { type: "function_call", id: "fc_c1", call_id: "c1", name: "shell", arguments: "{\"a\":1}" },
      { type: "custom_tool_call", id: "ctc_c2", call_id: "c2", name: "apply_patch", input: "P" },
    ],
    usage: { input_tokens: 4, output_tokens: 2, total_tokens: 6 },
  });
  const cut = toResponsesObject({ id: "", model: "", stopReason: "max_tokens", content: [], usage: { inputTokens: 1, outputTokens: 1 } }, meta, new Set());
  assert.deepEqual([cut.id, cut.model, cut.status, cut.output], ["resp_fb", "unknown", "length", []]);
  const idOf = (id) => toResponsesObject({ id, model: "m", stopReason: "end_turn", content: [], usage: { inputTokens: 0, outputTokens: 0 } }, meta, new Set()).id;
  assert.deepEqual([idOf("x"), idOf("resp_up")], ["resp_x", "resp_up"]);
});

test("the stream is 9router's event sequence; response.completed waits for trailing usage on a direct openai route", () => {
  const encoder = new ResponsesStreamEncoder({ created: 7, fallbackId: "chatcmpl-fb", customTools: new Set(["apply_patch"]), deferCompleted: true });
  let text = encoder.encode({ type: "start", id: "chatcmpl-s", model: "gpt-5" }) + encoder.encode({ type: "start", id: "again", model: "x" });
  text += encoder.encode({ type: "thinking_delta", index: 0, text: "hm" }) + encoder.encode({ type: "thinking_delta", index: 0, text: "", signature: "S" });
  text += encoder.encode({ type: "text_delta", index: 0, text: "Hi" }) + encoder.encode({ type: "text_delta", index: 0, text: "" });
  text += encoder.encode({ type: "tool_call_delta", index: 0, id: "c1", argumentsDelta: "" });
  text += encoder.encode({ type: "tool_call_delta", index: 0, name: "shell", argumentsDelta: "{\"a\"" }) + encoder.encode({ type: "tool_call_delta", index: 0, argumentsDelta: ":1}" });
  text += encoder.encode({ type: "tool_call_delta", index: 1, id: "c2", name: "apply_patch", argumentsDelta: "{\"input\":\"P\"}" });
  text += encoder.encode({ type: "tool_call_delta", index: 2, name: "nameless", argumentsDelta: "{}" });
  text += encoder.encode({ type: "image_delta", mediaType: "image/png", data: "AA" });
  text += encoder.encode({ type: "stop", stopReason: "tool_use" });
  text += encoder.encode({ type: "usage", usage: { inputTokens: 5, outputTokens: 2, cacheReadTokens: 1, reasoningTokens: 1 } });
  text += encoder.end();
  const list = events(text);
  assert.deepEqual(list.map((e) => e.sequence_number), list.map((_, i) => i + 1));
  assert.ok(list.every((e) => e.event === e.type));
  assert.deepEqual(list.map((e) => `${e.type}@${e.output_index ?? ""}`), [
    "response.created@", "response.in_progress@",
    "response.output_item.added@0", "response.reasoning_summary_part.added@0", "response.reasoning_summary_text.delta@0",
    "response.output_item.added@0", "response.content_part.added@0", "response.output_text.delta@0",
    "response.output_text.done@0", "response.content_part.done@0", "response.output_item.done@0",
    "response.output_item.added@0", "response.function_call_arguments.delta@0", "response.function_call_arguments.delta@0",
    "response.output_item.added@1",
    "response.reasoning_summary_text.done@0", "response.reasoning_summary_part.done@0", "response.output_item.done@0",
    "response.function_call_arguments.done@0", "response.output_item.done@0",
    "response.custom_tool_call_input.delta@1", "response.custom_tool_call_input.done@1", "response.output_item.done@1",
    "response.completed@",
  ], "shared output_index 0 and a message closed by the tool call, as in 9router");
  assert.deepEqual(list[0].response, { id: "resp_chatcmpl-s", object: "response", created_at: 7, status: "in_progress", background: false, error: null, output: [] });
  assert.deepEqual(list[1].response, { id: "resp_chatcmpl-s", object: "response", created_at: 7, status: "in_progress" });
  assert.deepEqual(list[2].item, { id: "rs_resp_chatcmpl-s_0", type: "reasoning", summary: [] });
  assert.deepEqual(list[5].item, { id: "msg_resp_chatcmpl-s_0", type: "message", content: [], role: "assistant" });
  assert.deepEqual(list[10].item.content, [{ type: "output_text", annotations: [], logprobs: [], text: "Hi" }]);
  assert.deepEqual(list[11].item, { id: "fc_c1", type: "function_call", arguments: "", call_id: "c1", name: "shell" });
  assert.deepEqual(list[14].item, { id: "ctc_c2", type: "custom_tool_call", input: "", call_id: "c2", name: "apply_patch" });
  assert.equal(list[15].text, "hm");
  assert.deepEqual([list[18].arguments, list[21].input, list[22].item.input], ["{\"a\":1}", "P", "P"]);
  assert.deepEqual(list.at(-1).response, {
    id: "resp_chatcmpl-s", object: "response", created_at: 7, status: "completed", background: false, error: null,
    usage: { input_tokens: 6, output_tokens: 2, total_tokens: 8, input_tokens_details: { cached_tokens: 1 }, output_tokens_details: { reasoning_tokens: 1 } },
  });
  assert.ok(!text.includes("[DONE]"));
  assert.throws(() => encoder.encode({ type: "stop", stopReason: "end_turn" }), /closed/);
});

test("on a pivot response.completed goes out at the stop; <think> tags, the fail frame, and an empty stream", () => {
  const pivot = new ResponsesStreamEncoder({ created: 1, fallbackId: "chatcmpl-fb", customTools: new Set(), deferCompleted: false });
  let text = pivot.encode({ type: "thinking_delta", index: 0, text: "x" });
  text += pivot.encode({ type: "text_delta", index: 0, text: "<think>ab" }) + pivot.encode({ type: "text_delta", index: 0, text: "c</think>Hi" });
  text += pivot.encode({ type: "tool_call_delta", index: 0, id: "t", name: "f", argumentsDelta: "" });
  text += pivot.encode({ type: "stop", stopReason: "max_tokens" }) + pivot.encode({ type: "usage", usage: { inputTokens: 9, outputTokens: 9 } }) + pivot.end();
  const list = events(text);
  assert.deepEqual(list.map((e) => e.type.replace("response.", "")), [
    "created", "in_progress", "output_item.added", "reasoning_summary_part.added", "reasoning_summary_text.delta", "reasoning_summary_text.delta", "reasoning_summary_text.delta",
    "reasoning_summary_text.done", "reasoning_summary_part.done", "output_item.done", "output_item.added", "content_part.added", "output_text.delta",
    "output_text.done", "content_part.done", "output_item.done", "output_item.added", "function_call_arguments.done", "output_item.done", "completed",
  ], "one reasoning item, closed at </think>");
  assert.equal(list.find((e) => e.type === "response.function_call_arguments.done").arguments, "{}");
  assert.deepEqual(list.filter((e) => e.type === "response.reasoning_summary_text.delta").map((e) => e.delta), ["x", "ab", "c"]);
  assert.deepEqual(list.filter((e) => e.type === "response.output_text.delta").map((e) => e.delta), ["Hi"]);
  assert.equal(list[0].response.id, "resp_chatcmpl-fb");
  assert.deepEqual(list.at(-1).response, { id: "resp_chatcmpl-fb", object: "response", created_at: 1, status: "completed", background: false, error: null }, "later usage is lost on a pivot");
  assert.equal(list.filter((e) => e.type === "response.completed").length, 1);

  const failing = new ResponsesStreamEncoder({ created: 1, fallbackId: "f", customTools: new Set(), deferCompleted: true });
  assert.equal(failing.fail(new EngineError("TIMEOUT", "slow")), "data: {\"error\":{\"message\":\"slow\",\"type\":\"timeout_error\",\"code\":\"timeout\",\"param\":null}}\n\ndata: [DONE]\n\n");
  assert.throws(() => failing.end(), /closed/);

  const empty = new ResponsesStreamEncoder({ created: 1, fallbackId: "f", customTools: new Set(), deferCompleted: true });
  assert.deepEqual(events(empty.end()).map((e) => e.type), ["response.completed"], "9router's flush completes even an empty stream");
  const quiet = new ResponsesStreamEncoder({ created: 1, fallbackId: "f", customTools: new Set(), deferCompleted: false });
  assert.equal(quiet.encode({ type: "usage", usage: { inputTokens: 1, outputTokens: 1 } }) + quiet.end(), "");
});
