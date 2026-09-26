// Contract: docs/contracts/protocol-anthropic.md — the client-facing Anthropic Messages protocol.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  anthropicClientGetsMessage, anthropicRequestFor, AnthropicStreamEncoder, builtinRegistry, EngineError, estimateAnthropicInputTokens, parseAnthropicMessagesRequest,
  toAnthropicMessage, UnsupportedFeatureError,
} from "../dist/index.js";

const openai = builtinRegistry.provider("openai");
const anthropic = builtinRegistry.provider("anthropic");
const gemini = builtinRegistry.provider("gemini");
const codebuddy = builtinRegistry.provider("codebuddy-cn");
const user = (content) => ({ role: "user", content });
const base = { model: "claude-sonnet-4-5", max_tokens: 1000, messages: [user("hi")] };

test("the Anthropic body is parsed faithfully: blocks, tools, choice, thinking, and fields CIP does not model", () => {
  const { request, anthropicOnly } = parseAnthropicMessagesRequest({
    ...base,
    system: [{ type: "text", text: "x-anthropic-billing-header: abc\nbe brief", cache_control: { type: "ephemeral" } }],
    messages: [
      user([{ type: "text", text: "look" }, { type: "image", source: { type: "base64", media_type: "image/png", data: "AAAA" } }, { type: "image", source: { type: "url", url: "https://x.example/a.png" } },
        { type: "document", title: "spec", source: { type: "base64", media_type: "application/pdf", data: "JVBE" } }, { type: "search_result", source: "s" }]),
      { role: "system", content: "follow the rules" },
      { role: "assistant", content: [{ type: "thinking", thinking: "plan", signature: "SIG" }, { type: "redacted_thinking", data: "R" }, { type: "text", text: "calling" }, { type: "tool_use", id: "toolu_1", name: "lookup", input: { q: 1 } }] },
      user([{ type: "tool_result", tool_use_id: "toolu_1", is_error: true, content: [{ type: "text", text: "oops" }, { type: "image", source: { type: "base64", media_type: "image/png", data: "BBBB" } }] }]),
    ],
    tools: [{ name: "lookup", description: "d", input_schema: { type: "object", properties: { q: { type: "number" } } } }, { type: "web_search_20250305", name: "web_search" }],
    tool_choice: { type: "none", disable_parallel_tool_use: true },
    stop_sequences: ["END"], temperature: 0.5, top_p: 0.9, top_k: 5, metadata: { user_id: "u1" },
    thinking: { type: "enabled", budget_tokens: 4000 },
  });
  assert.deepEqual(request.system, [{ type: "text", text: "x-anthropic-billing-header: abc\nbe brief", cacheControl: "ephemeral" }]);
  assert.deepEqual(request.messages[0].content, [
    { type: "text", text: "look" }, { type: "image", source: { kind: "base64", mediaType: "image/png", data: "AAAA" } }, { type: "image", source: { kind: "url", url: "https://x.example/a.png" } },
    { type: "file", mediaType: "application/pdf", source: { kind: "base64", mediaType: "application/pdf", data: "JVBE" }, name: "spec" },
  ]);
  assert.deepEqual(request.messages[1], user([{ type: "text", text: "<instructions>\nfollow the rules\n</instructions>" }]), "a mid-conversation system turn becomes user instructions");
  assert.deepEqual(request.messages[2].content, [
    { type: "thinking", text: "plan", signature: "SIG" }, { type: "thinking", text: "R", redacted: true }, { type: "text", text: "calling" }, { type: "tool_call", id: "toolu_1", name: "lookup", arguments: "{\"q\":1}" },
  ]);
  assert.deepEqual(request.messages[3].content, [{ type: "tool_result", toolCallId: "toolu_1", isError: true, content: [{ type: "text", text: "oops" }, { type: "image", source: { kind: "base64", mediaType: "image/png", data: "BBBB" } }] }]);
  assert.deepEqual(request.tools, [{ name: "lookup", description: "d", parameters: { type: "object", properties: { q: { type: "number" } } } }, { name: "web_search", parameters: { type: "object", properties: {} } }]);
  assert.deepEqual([request.toolChoice, request.stop, request.temperature, request.topP, request.maxOutputTokens, request.reasoning], ["none", ["END"], 0.5, 0.9, 1000, { budgetTokens: 4000 }]);
  assert.deepEqual(request.vendorExtensions, { anthropic: { top_k: 5, metadata: { user_id: "u1" } }, openai: { parallel_tool_calls: false } });
  assert.deepEqual(anthropicOnly, ["search_result blocks", "the web_search_20250305 server tool"]);
});

test("stream defaults to on unless the client only accepts JSON; thinking needs a user turn last; tool calls get missing results", () => {
  assert.equal(parseAnthropicMessagesRequest(base).request.stream, true, "an omitted stream streams (9router)");
  assert.equal(parseAnthropicMessagesRequest(base, "application/json").request.stream, false);
  assert.equal(parseAnthropicMessagesRequest({ ...base, stream: true }, "application/json").request.stream, true);
  assert.equal(parseAnthropicMessagesRequest({ ...base, stream: false }).request.stream, false);
  assert.equal(parseAnthropicMessagesRequest(base, "text/event-stream, application/json").request.stream, true);
  const prefill = parseAnthropicMessagesRequest({ ...base, messages: [user("q"), { role: "assistant", content: "Sure" }], thinking: { type: "enabled", budget_tokens: 2000 } }).request;
  assert.equal(prefill.reasoning, undefined, "normalizeThinkingConfig: no thinking after an assistant turn");
  const adaptive = parseAnthropicMessagesRequest({ ...base, thinking: { type: "adaptive" } }).request;
  assert.deepEqual([adaptive.reasoning, adaptive.vendorExtensions], [undefined, { anthropic: { thinking: { type: "adaptive" } } }]);
  const calls = parseAnthropicMessagesRequest({ ...base, messages: [user("q"), { role: "assistant", content: [{ type: "tool_use", id: "a", name: "f", input: {} }, { type: "tool_use", id: "b", name: "f", input: {} }] }, user([{ type: "tool_result", tool_use_id: "a", content: "ok" }])] }).request;
  assert.deepEqual(calls.messages[2].content.map((part) => [part.toolCallId, part.content[0].text]), [["b", "[No response received]"], ["a", "ok"]]);
  const toolRole = parseAnthropicMessagesRequest({ ...base, messages: [user("q"), { role: "assistant", content: [{ type: "tool_use", id: "t", name: "f", input: {} }] }, { role: "tool", content: [{ type: "tool_result", tool_use_id: "t", content: "ok" }] }] }).request;
  assert.deepEqual(toolRole.messages.slice(2), [user([{ type: "tool_result", toolCallId: "t", content: [{ type: "text", text: "ok" }] }])], "9router treats a tool turn as a user turn");
  const choiceOf = (tool_choice) => parseAnthropicMessagesRequest({ ...base, tool_choice }).request.toolChoice;
  assert.deepEqual([choiceOf({ type: "auto" }), choiceOf({ type: "any" }), choiceOf({ type: "tool", name: "f" }), choiceOf({ type: "other" })], ["auto", "required", { name: "f" }, undefined]);
  const dangling = parseAnthropicMessagesRequest({ ...base, messages: [user("q"), { role: "assistant", content: [{ type: "tool_use", id: "z", name: "f", input: {} }] }] }).request;
  assert.deepEqual(dangling.messages.at(-1), user([{ type: "tool_result", toolCallId: "z", content: [{ type: "text", text: "[No response received]" }] }]));
  assert.throws(() => parseAnthropicMessagesRequest({ messages: [] }), (e) => e instanceof EngineError && e.message === "model must be a model id");
  assert.throws(() => parseAnthropicMessagesRequest({ ...base, messages: "hi" }), (e) => e.message === "messages must be an array");
  assert.throws(() => parseAnthropicMessagesRequest({ ...base, max_tokens: 0 }), (e) => e.message === "max_tokens must be a positive integer");
});

test("an Anthropic provider gets the parsed request as is; blocks CIP cannot hold are refused there", () => {
  const parsed = parseAnthropicMessagesRequest({ ...base, top_k: 3, messages: [user([{ type: "text", text: "a", cache_control: { type: "ephemeral" } }])] });
  assert.equal(anthropicRequestFor(parsed, anthropic), parsed.request);
  const server = parseAnthropicMessagesRequest({ ...base, tools: [{ type: "web_search_20250305", name: "web_search" }] });
  assert.throws(() => anthropicRequestFor(server, anthropic), (e) => e instanceof UnsupportedFeatureError && e.message === "AIGate cannot carry the web_search_20250305 server tool on this path");
  assert.doesNotThrow(() => anthropicRequestFor(server, openai), "other providers get it as an empty function, as in 9router");
});

test("other providers get 9router's claude→openai request: drops, moved tool images, adjusted max_tokens, auto for none", () => {
  const parsed = parseAnthropicMessagesRequest({
    ...base, max_tokens: 100,
    system: [{ type: "text", text: "x-anthropic-billing-header: v=1\nbe brief", cache_control: { type: "ephemeral" } }, { type: "text", text: "and kind" }],
    messages: [
      user([{ type: "text", text: "look", cache_control: { type: "ephemeral" } }, { type: "image", source: { type: "url", url: "https://x.example/a.png" } }, { type: "document", source: { type: "base64", media_type: "application/pdf", data: "JVBE" } }]),
      { role: "assistant", content: [{ type: "thinking", thinking: "plan", signature: "S" }, { type: "tool_use", id: "t1", name: "f", input: {} }] },
      user([{ type: "tool_result", tool_use_id: "t1", is_error: true, content: [{ type: "text", text: "a" }, { type: "text", text: "b" }, { type: "image", source: { type: "base64", media_type: "image/png", data: "IMG" } }] }]),
      { role: "assistant", content: [{ type: "thinking", thinking: "only thinking", signature: "S2" }] },
      user([{ type: "image", source: { type: "url", url: "https://x.example/b.png" } }]),
      user("next"),
    ],
    tools: [{ name: "f", input_schema: { type: "object" } }],
    tool_choice: { type: "none" }, stop_sequences: ["x"], top_p: 0.5, top_k: 4,
    thinking: { type: "enabled", budget_tokens: 2000 },
  });
  const sent = anthropicRequestFor(parsed, openai);
  assert.deepEqual(sent.system, [{ type: "text", text: "be brief\nand kind" }]);
  assert.deepEqual(sent.messages, [
    user([{ type: "text", text: "look" }]),
    { role: "assistant", content: [{ type: "tool_call", id: "t1", name: "f", arguments: "{}" }] },
    user([{ type: "tool_result", toolCallId: "t1", content: [{ type: "text", text: "a\nb" }] }, { type: "text", text: "[Image from tool result t1]" }, { type: "image", source: { kind: "base64", mediaType: "image/png", data: "IMG" } }]),
    user([{ type: "text", text: "next" }]),
  ], "thinking, cache_control, URL images, documents, is_error dropped; emptied turns removed");
  assert.deepEqual(sent.tools, [{ name: "f", description: "", parameters: { type: "object" } }]);
  assert.deepEqual([sent.toolChoice, sent.stop, sent.topP, sent.vendorExtensions, sent.maxOutputTokens, sent.reasoning], ["auto", undefined, undefined, undefined, 32000, { effort: "low" }]);
  const budgetOf = (budget, provider) => anthropicRequestFor(parseAnthropicMessagesRequest({ ...base, max_tokens: 90000, thinking: { type: "enabled", budget_tokens: budget } }), provider);
  assert.deepEqual([budgetOf(10000, openai).reasoning, budgetOf(10000, openai).maxOutputTokens], [{ effort: "medium" }, 64000], "capped at 64000");
  assert.deepEqual(budgetOf(100000, openai).vendorExtensions, { openai: { reasoning_effort: "max" } });
  assert.deepEqual(budgetOf(600, openai).vendorExtensions, { openai: { reasoning_effort: "minimal" } });
  assert.deepEqual(budgetOf(10000, gemini).reasoning, { budgetTokens: 10000 }, "a Gemini provider keeps the budget");
  const small = anthropicRequestFor(parseAnthropicMessagesRequest({ ...base, max_tokens: 3000, thinking: { type: "enabled", budget_tokens: 5000 } }), openai);
  assert.equal(small.maxOutputTokens, 6024, "max_tokens above the budget");
});

test("a non-streaming Claude client gets a message object from openai-compatible and Anthropic providers only", () => {
  assert.deepEqual([anthropicClientGetsMessage(openai), anthropicClientGetsMessage(anthropic), anthropicClientGetsMessage(gemini), anthropicClientGetsMessage(codebuddy)], [true, true, false, false]);
  const message = toAnthropicMessage({
    id: "chatcmpl-abc", model: "m", stopReason: "content_filter",
    content: [{ type: "thinking", text: "hm", signature: "S" }, { type: "thinking", text: "R", redacted: true }, { type: "text", text: "Hi" }, { type: "tool_call", id: "c1", name: "f", arguments: "{\"a\":1}" }, { type: "tool_call", id: "c2", name: "g", arguments: "bad" }],
    usage: { inputTokens: 10, outputTokens: 4, cacheReadTokens: 3, cacheWriteTokens: 2 },
  }, "msg_fallback");
  assert.deepEqual(message, {
    id: "abc", type: "message", role: "assistant", model: "m",
    content: [{ type: "thinking", thinking: "hm", signature: "S" }, { type: "redacted_thinking", data: "R" }, { type: "text", text: "Hi" }, { type: "tool_use", id: "c1", name: "f", input: { a: 1 } }, { type: "tool_use", id: "c2", name: "g", input: {} }],
    stop_reason: "refusal", stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 4, cache_read_input_tokens: 3, cache_creation_input_tokens: 2 },
  });
  const empty = toAnthropicMessage({ id: "", model: "m", stopReason: "max_tokens", content: [], usage: { inputTokens: 1, outputTokens: 0 } }, "msg_fallback");
  assert.deepEqual([empty.id, empty.content, empty.stop_reason], ["msg_fallback", [{ type: "text", text: "" }], "max_tokens"]);
});

test("the stream encoder emits Anthropic events: signatures, live tool arguments, a sanitized Read call, real usage", () => {
  const encoder = new AnthropicStreamEncoder({ fallbackId: "msg_x", model: "fallback" });
  const text = [
    { type: "start", id: "chatcmpl-9", model: "m" },
    { type: "thinking_delta", index: 0, text: "hm" }, { type: "thinking_delta", index: 0, text: "", signature: "SIG" },
    { type: "text_delta", index: 0, text: "Hi" },
    { type: "tool_call_delta", index: 0, id: "c1", name: "lookup", argumentsDelta: "" }, { type: "tool_call_delta", index: 0, argumentsDelta: "{\"q\":" },
    { type: "tool_call_delta", index: 1, id: "c2", name: "Read", argumentsDelta: "{\"file_path\":\"a.ts\",\"limit\":\"5000\"," },
    { type: "tool_call_delta", index: 0, argumentsDelta: "1}" }, { type: "tool_call_delta", index: 1, argumentsDelta: "\"pages\":\"1-2\"}" },
    { type: "usage", usage: { inputTokens: 7, outputTokens: 3, cacheReadTokens: 2 } },
    { type: "stop", stopReason: "tool_use" },
  ].map((chunk) => encoder.encode(chunk)).join("") + encoder.end();
  const events = text.trim().split("\n\n").map((frame) => {
    const [head, data] = frame.split("\n");
    const value = JSON.parse(data.slice(6));
    assert.equal(head, `event: ${value.type}`);
    return value;
  });
  assert.deepEqual(events, [
    { type: "message_start", message: { id: "9", type: "message", role: "assistant", model: "m", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } } },
    { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "hm" } },
    { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "SIG" } },
    { type: "content_block_stop", index: 0 },
    { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "Hi" } },
    { type: "content_block_stop", index: 1 },
    { type: "content_block_start", index: 2, content_block: { type: "tool_use", id: "c1", name: "lookup", input: {} } },
    { type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: "{\"q\":" } },
    { type: "content_block_start", index: 3, content_block: { type: "tool_use", id: "c2", name: "Read", input: {} } },
    { type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: "1}" } },
    { type: "content_block_stop", index: 2 },
    { type: "content_block_delta", index: 3, delta: { type: "input_json_delta", partial_json: "{\"file_path\":\"a.ts\",\"limit\":2000}" } },
    { type: "content_block_stop", index: 3 },
    { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { input_tokens: 7, output_tokens: 3, cache_read_input_tokens: 2 } },
    { type: "message_stop" },
  ]);
  const failing = new AnthropicStreamEncoder({ fallbackId: "msg_y", model: "m" });
  failing.encode({ type: "text_delta", index: 0, text: "par" });
  assert.equal(failing.fail(new EngineError("PROVIDER_UNAVAILABLE", "cut", {})),
    "event: error\ndata: {\"type\":\"error\",\"error\":{\"message\":\"cut\",\"type\":\"api_error\",\"code\":\"provider_unavailable\",\"param\":null}}\n\n");
  assert.throws(() => failing.encode({ type: "stop", stopReason: "end_turn" }), /closed/);
});

test("count_tokens is 9router's local estimate: characters over four, keys included", () => {
  const body = {
    system: "sys",
    tools: [{ name: "f" }],
    messages: [{ role: "user", content: "hello" }, { role: "assistant", content: [{ type: "text", text: "ok" }, { type: "tool_use", name: "f", input: { a: "bb" } }, { type: "thinking", thinking: "t" }] },
      { role: "user", content: [{ type: "tool_result", content: "res" }, { type: "image", source: { data: "xy" } }] }],
  };
  // sys 3 + tools ("name"+"f" = 5) + hello 5 + ok 2 + (f 1 + a 1 + bb 2) + t 1 + res 3 + (type 4 + image 5 + source 6 + data 4 + xy 2)
  assert.equal(estimateAnthropicInputTokens(body), Math.ceil((3 + 5 + 5 + 2 + 4 + 1 + 3 + 21) / 4));
  assert.equal(estimateAnthropicInputTokens("not json"), 0);
});
