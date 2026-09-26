// Contract: docs/contracts/provider-anthropic.md — the Anthropic Messages adapter against a fake HttpTransportPort.
import { test } from "node:test";
import assert from "node:assert/strict";
import { AnthropicAdapter, builtinRegistry, CATALOG, createAdapter, EngineError, OpenAICompatibleAdapter, toDescriptor, UnsupportedFeatureError } from "../dist/index.js";

const SECRET = "sk-ant-test-secret-value";
const credential = { kind: "api-key", apiKey: SECRET };
const anthropic = builtinRegistry.provider("anthropic");
const minimax = builtinRegistry.provider("minimax");
const encoder = new TextEncoder();
const ctx = (signal = new AbortController().signal) => ({ signal, requestId: "test" });

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
// Anthropic SSE: an event line and a data line per event, split into small pieces.
const sse = (events, size = 7) => ({
  status: 200, headers: { "content-type": "text/event-stream" },
  body: body(events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(""), size),
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

const reply = {
  id: "msg_1", type: "message", model: "claude-sonnet-4-20250514", stop_reason: "tool_use",
  content: [
    { type: "thinking", thinking: "plan", signature: "sig-1" },
    { type: "text", text: "Looking it up" },
    { type: "tool_use", id: "toolu_1", name: "lookup", input: { q: 1 } },
  ],
  usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 30, cache_creation_input_tokens: 7 },
};
const hello = { model: "claude-sonnet-4-20250514", stream: false, messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }] };

test("createAdapter picks the adapter by protocol family", () => {
  assert.ok(createAdapter(anthropic, fakeTransport()) instanceof AnthropicAdapter);
  assert.ok(createAdapter(builtinRegistry.provider("openai"), fakeTransport()) instanceof OpenAICompatibleAdapter);
  assert.deepEqual(["anthropic", "glm", "kimi", "minimax", "minimax-cn"].map((id) => builtinRegistry.provider(id)?.protocol), Array(5).fill("anthropic"));
  assert.equal(builtinRegistry.providers.length, 49);
  assert.deepEqual(builtinRegistry.status("claude"), { connectable: false, reason: "Needs OAuth sign-in (SP16)" });
});

test("execute maps CIP to a Messages body, with the family headers, and the answer back", async () => {
  const transport = fakeTransport(json(200, reply));
  const response = await new AnthropicAdapter(anthropic, transport).execute({
    model: "claude-sonnet-4-20250514", stream: false,
    system: [{ type: "text", text: "be brief", cacheControl: "ephemeral" }],
    messages: [
      { role: "user", content: [{ type: "text", text: "look" }, { type: "image", source: { kind: "base64", mediaType: "image/png", data: "AAAA" } }] },
      { role: "user", content: [{ type: "image", source: { kind: "url", url: "https://x.example/a.png" } }, { type: "file", mediaType: "application/pdf", source: { kind: "base64", mediaType: "application/pdf", data: "JVBE" } }] },
      { role: "assistant", content: [{ type: "text", text: "calling" }, { type: "tool_call", id: "toolu_0", name: "lookup", arguments: "{\"q\":0}" }] },
      { role: "tool", content: [{ type: "tool_result", toolCallId: "toolu_0", content: [{ type: "text", text: "42" }], isError: true }] },
      { role: "user", content: [{ type: "text", text: "and?" }] },
    ],
    tools: [{ name: "lookup", description: "find", parameters: { type: "object" } }],
    toolChoice: "none", temperature: 0.2, topP: 0.9, stop: ["END"], reasoning: { effort: "medium" },
    vendorExtensions: { openai: { user: "u-1", parallel_tool_calls: false }, anthropic: { model: "must-not-win", top_k: 5 } },
  }, credential, ctx());

  const [call] = transport.calls;
  assert.equal(call.url, "https://api.anthropic.com/v1/messages");
  assert.equal(call.headers["x-api-key"], SECRET, "a raw key, never Bearer");
  assert.equal(call.headers.authorization, undefined);
  assert.equal(call.headers["anthropic-version"], "2023-06-01");
  assert.equal(call.headers["anthropic-beta"], "claude-code-20250219,interleaved-thinking-2025-05-14");
  assert.equal(call.headers.accept, "application/json");
  const sent = JSON.parse(call.body);
  assert.deepEqual(sent.system, [{ type: "text", text: "be brief", cache_control: { type: "ephemeral" } }], "the client's prompt as given, no identity line");
  assert.equal(sent.model, "claude-sonnet-4-20250514", "a modelled field wins over an extension");
  assert.equal(sent.top_k, 5);
  assert.deepEqual(sent.messages.map((m) => m.role), ["user", "assistant", "user"], "same-role turns merged, tool turn is a user turn");
  assert.deepEqual(sent.messages[0].content.map((b) => b.type), ["text", "image", "image", "document"]);
  assert.deepEqual(sent.messages[0].content[1].source, { type: "base64", media_type: "image/png", data: "AAAA" });
  assert.deepEqual(sent.messages[0].content[2].source, { type: "url", url: "https://x.example/a.png" });
  assert.deepEqual(sent.messages[1].content[1], { type: "tool_use", id: "toolu_0", name: "lookup", input: { q: 0 } });
  assert.deepEqual(sent.messages[2].content.map((b) => b.type), ["tool_result", "text"], "tool results first");
  assert.deepEqual(sent.messages[2].content[0], { type: "tool_result", tool_use_id: "toolu_0", content: [{ type: "text", text: "42" }], is_error: true });
  assert.deepEqual(sent.tools, [{ name: "lookup", description: "find", input_schema: { type: "object" } }]);
  assert.deepEqual(sent.tool_choice, { type: "none", disable_parallel_tool_use: true });
  assert.deepEqual([sent.temperature, sent.top_p, sent.stop_sequences], [0.2, 0.9, ["END"]]);
  assert.deepEqual(sent.thinking, { type: "enabled", budget_tokens: 8192 });
  assert.equal(sent.max_tokens, 64000, "the 9router default");
  assert.deepEqual(sent.metadata, { user_id: "u-1" });
  assert.equal(sent.stream, false);

  assert.deepEqual(response.content, [
    { type: "thinking", text: "plan", signature: "sig-1" },
    { type: "text", text: "Looking it up" },
    { type: "tool_call", id: "toolu_1", name: "lookup", arguments: "{\"q\":1}" },
  ]);
  assert.equal(response.stopReason, "tool_use");
  assert.deepEqual(response.usage, { inputTokens: 10, outputTokens: 5, cacheReadTokens: 30, cacheWriteTokens: 7 });
});

test("max_tokens follows the 9router rules: default, tools floor, thinking headroom, model ceiling", async () => {
  const bodyOf = async (provider, request) => {
    const transport = fakeTransport(json(200, { ...reply, content: [] }));
    await new AnthropicAdapter(provider, transport).execute({ ...hello, ...request }, credential, ctx());
    return JSON.parse(transport.calls[0].body);
  };
  assert.equal((await bodyOf(anthropic, { maxOutputTokens: 100 })).max_tokens, 100);
  assert.equal((await bodyOf(anthropic, { maxOutputTokens: 100, tools: [{ name: "t", parameters: {} }] })).max_tokens, 32000);
  const thinking = await bodyOf(anthropic, { maxOutputTokens: 1000, reasoning: { effort: "high" } });
  assert.deepEqual([thinking.max_tokens, thinking.thinking.budget_tokens], [24576 + 1024, 24576]);
  const small = { ...anthropic, models: [{ ...anthropic.models[0], id: "tiny", maxOutputTokens: 8192 }] };
  const capped = await bodyOf(small, { model: "tiny", reasoning: { budgetTokens: 10000 } });
  assert.deepEqual([capped.max_tokens, capped.thinking.budget_tokens], [8192, 8192 - 1024], "the budget stays below the ceiling");
  const custom = await bodyOf(minimax, { model: "MiniMax-M3", tools: [{ name: "t", parameters: {} }] });
  assert.equal(custom.tools[0].type, "custom", "the requireClaudeToolType quirk");
  assert.equal(custom.output_config, undefined);
  assert.deepEqual((await bodyOf(anthropic, { toolChoice: "required" })).tool_choice, { type: "any" });
  assert.deepEqual((await bodyOf(anthropic, { toolChoice: { name: "t" } })).tool_choice, { type: "tool", name: "t" });
  assert.deepEqual((await bodyOf(anthropic, { toolChoice: "auto" })).tool_choice, { type: "auto" });
});

test("a catalog entry without a version header still sends 2023-06-01; tool results move ahead of text", async () => {
  const entry = CATALOG.find((p) => p.id === "anthropic");
  const bare = toDescriptor({ ...entry, headers: {} }, entry.chatUrl);
  assert.deepEqual(bare.headers, { "anthropic-version": "2023-06-01" });
  assert.deepEqual(bare.auth, { kind: "api-key", header: "x-api-key", scheme: "raw" });
  const transport = fakeTransport(json(200, { ...reply, content: [] }));
  await new AnthropicAdapter(bare, transport).execute({ ...hello, messages: [
    { role: "assistant", content: [{ type: "tool_call", id: "t1", name: "f", arguments: "{}" }] },
    { role: "user", content: [{ type: "text", text: "note" }, { type: "tool_result", toolCallId: "t1", content: [{ type: "text", text: "r" }] }] },
  ] }, credential, ctx());
  const sent = JSON.parse(transport.calls[0].body);
  assert.deepEqual(sent.messages[1].content.map((b) => b.type), ["tool_result", "text"]);
  assert.equal(transport.calls[0].headers["anthropic-version"], "2023-06-01");
});

test("a feature Messages cannot carry is refused before any I/O, never dropped", async () => {
  const cases = [
    { ...hello, vendorExtensions: { openai: { seed: 1 } } },
    { ...hello, vendorExtensions: { gemini: { x: 1 } } },
    { ...hello, messages: [{ role: "user", content: [{ type: "audio", source: { kind: "base64", mediaType: "audio/wav", data: "x" } }] }] },
    { ...hello, messages: [{ role: "user", content: [{ type: "image", detail: "high", source: { kind: "url", url: "https://x.example/a.png" } }] }] },
    { ...hello, messages: [{ role: "user", content: [{ type: "file", mediaType: "text/csv", source: { kind: "base64", mediaType: "text/csv", data: "x" } }] }] },
    { ...hello, messages: [{ role: "assistant", content: [{ type: "thinking", text: "t" }] }] },
    { ...hello, messages: [...hello.messages, { role: "assistant", content: [{ type: "text", text: "Sure" }] }], reasoning: { effort: "low" } },
    { ...hello, tools: [{ name: "t", parameters: {}, strict: true }] },
  ];
  for (const request of cases) {
    const transport = fakeTransport();
    await assert.rejects(new AnthropicAdapter(anthropic, transport).execute(request, credential, ctx()), UnsupportedFeatureError, JSON.stringify(request).slice(0, 120));
    assert.equal(transport.calls.length, 0);
  }
  const bad = { ...hello, messages: [{ role: "assistant", content: [{ type: "tool_call", id: "a", name: "t", arguments: "[1]" }] }, ...hello.messages] };
  await assert.rejects(new AnthropicAdapter(anthropic, fakeTransport()).execute(bad, credential, ctx()), (e) => e instanceof EngineError && e.code === "INVALID_REQUEST");
});

test("stop reasons map the same way as streaming; redacted thinking is kept", async () => {
  for (const [raw, mapped] of [["end_turn", "end_turn"], ["max_tokens", "max_tokens"], ["stop_sequence", "stop_sequence"], ["refusal", "content_filter"], ["model_context_window_exceeded", "max_tokens"], ["pause_turn", "end_turn"]]) {
    const out = await new AnthropicAdapter(anthropic, fakeTransport(json(200, { ...reply, stop_reason: raw, content: [{ type: "text", text: "x" }] }))).execute(hello, credential, ctx());
    assert.equal(out.stopReason, mapped, raw);
  }
  const redacted = await new AnthropicAdapter(anthropic, fakeTransport(json(200, { ...reply, content: [{ type: "redacted_thinking", data: "enc" }] }))).execute(hello, credential, ctx());
  assert.deepEqual(redacted.content, [{ type: "thinking", text: "enc", redacted: true }]);
  await assert.rejects(new AnthropicAdapter(anthropic, fakeTransport(json(200, { ...reply, content: [{ type: "server_tool_use" }] }))).execute(hello, credential, ctx()),
    (e) => e instanceof EngineError && e.code === "PROVIDER_UNAVAILABLE" && /server_tool_use/.test(e.message));
});

test("a stream relays text, thinking, signatures, and tool calls, then usage and the stop reason", async () => {
  const transport = fakeTransport(sse([
    { type: "message_start", message: { id: "msg_s", model: "claude-sonnet-4-20250514", usage: { input_tokens: 12, cache_read_input_tokens: 3, output_tokens: 1 } } },
    { type: "ping" },
    { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "hmm" } },
    { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "sig" } },
    { type: "content_block_stop", index: 0 },
    { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "Hel" } },
    { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "lo ✓" } },
    { type: "content_block_start", index: 2, content_block: { type: "tool_use", id: "toolu_s", name: "lookup", input: {} } },
    { type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: "{\"q\":" } },
    { type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: "2}" } },
    { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 20 } },
    { type: "message_stop" },
  ]));
  const chunks = await collect(new AnthropicAdapter(anthropic, transport).stream({ ...hello, stream: true }, credential, ctx()));
  assert.equal(transport.calls[0].headers.accept, "text/event-stream");
  assert.equal(JSON.parse(transport.calls[0].body).stream, true);
  assert.deepEqual(chunks, [
    { type: "start", id: "msg_s", model: "claude-sonnet-4-20250514" },
    { type: "thinking_delta", index: 0, text: "hmm" },
    { type: "thinking_delta", index: 0, text: "", signature: "sig" },
    { type: "text_delta", index: 0, text: "Hel" },
    { type: "text_delta", index: 0, text: "lo ✓" },
    { type: "tool_call_delta", index: 0, id: "toolu_s", name: "lookup", argumentsDelta: "" },
    { type: "tool_call_delta", index: 0, argumentsDelta: "{\"q\":" },
    { type: "tool_call_delta", index: 0, argumentsDelta: "2}" },
    { type: "usage", usage: { inputTokens: 12, outputTokens: 20, cacheReadTokens: 3 } },
    { type: "stop", stopReason: "tool_use" },
  ]);
});

test("a mid-stream error event, a cut stream, and an unknown block all fail the stream", async () => {
  const start = { type: "message_start", message: { id: "m", model: "x", usage: {} } };
  const text = { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "partial" } };
  const run = (events) => collect(new AnthropicAdapter(anthropic, fakeTransport(sse(events))).stream({ ...hello, stream: true }, credential, ctx()));
  await assert.rejects(run([start, { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }, text,
    { type: "error", error: { type: "overloaded_error", message: `Overloaded for ${SECRET}` } }]), (e) =>
    e instanceof EngineError && e.code === "PROVIDER_UNAVAILABLE" && e.details.partial === true && /Overloaded/.test(e.message) && !e.message.includes(SECRET));
  await assert.rejects(run([start, text]), (e) => e instanceof EngineError && /ended the stream before it finished/.test(e.message) && e.details.partial === true);
  await assert.rejects(run([start, { type: "content_block_start", index: 0, content_block: { type: "server_tool_use", id: "s" } }]), (e) => e instanceof EngineError && /server_tool_use/.test(e.message));
  const notSse = fakeTransport(json(200, reply));
  await assert.rejects(collect(new AnthropicAdapter(anthropic, notSse).stream({ ...hello, stream: true }, credential, ctx())), /non-SSE/);
});

test("upstream errors keep their status meaning; 529 is not retried; the key never leaks", async () => {
  const error = (status, type, message) => json(status, { type: "error", error: { type, message } });
  for (const [status, type, code] of [[401, "authentication_error", "AUTH_ERROR"], [403, "permission_error", "AUTH_ERROR"], [429, "rate_limit_error", "RATE_LIMIT"], [404, "not_found_error", "MODEL_UNAVAILABLE"], [400, "invalid_request_error", "INVALID_REQUEST"], [529, "overloaded_error", "PROVIDER_UNAVAILABLE"]]) {
    const transport = fakeTransport(error(status, type, `bad key ${SECRET}`));
    await assert.rejects(new AnthropicAdapter(anthropic, transport).execute(hello, credential, ctx()), (e) =>
      e instanceof EngineError && e.code === code && e.details.upstreamCode === type && e.message.includes("bad key ***") && !e.message.includes(SECRET));
    assert.equal(transport.calls.length, 1, `${status} is not retried`);
  }
  const recovers = fakeTransport(error(503, "api_error", "later"), json(200, { ...reply, content: [{ type: "text", text: "ok" }] }));
  assert.equal((await new AnthropicAdapter(anthropic, recovers).execute(hello, credential, ctx())).content[0].text, "ok");
});

test("the connection test uses the free model list, then a 1-token message where there is none", async () => {
  const listed = fakeTransport(json(200, { data: [{ id: "claude-sonnet-4-20250514" }] }));
  assert.deepEqual(await new AnthropicAdapter(anthropic, listed).validateCredential(credential, ctx()), { valid: true });
  assert.equal(listed.calls[0].url, "https://api.anthropic.com/v1/models");
  assert.equal(listed.calls[0].method, "GET");
  const probe = fakeTransport(json(404, { type: "error", error: { type: "not_found_error", message: "no" } }), json(200, reply));
  const glm = builtinRegistry.provider("glm");
  assert.deepEqual(await new AnthropicAdapter(glm, probe).validateCredential(credential, ctx()), { valid: true });
  assert.equal(probe.calls[1].url, "https://api.z.ai/api/anthropic/v1/messages");
  assert.deepEqual(JSON.parse(probe.calls[1].body), { model: glm.models.find((m) => m.kind === "chat").id, max_tokens: 1, messages: [{ role: "user", content: "hi" }] });
  const refused = await new AnthropicAdapter(anthropic, fakeTransport(json(403, { type: "error", error: { type: "permission_error", message: "nope" } }))).validateCredential(credential, ctx());
  assert.deepEqual([refused.valid, refused.code], [false, "AUTH_ERROR"], "403 is an invalid key");
  await assert.rejects(new AnthropicAdapter(anthropic, fakeTransport(json(500, {}))).validateCredential(credential, ctx()), (e) => e.code === "PROVIDER_UNAVAILABLE");
  const models = await new AnthropicAdapter(anthropic, fakeTransport(json(200, { data: [{ id: "claude-sonnet-4-20250514" }, { id: "bad id" }, { id: "new" }] }))).getModels(credential, ctx());
  assert.deepEqual(models.map((m) => [m.id, Boolean(m.descriptor)]), [["claude-sonnet-4-20250514", true], ["new", false]]);
});

// ---- SP14b: Anthropic-compatible custom providers (connection.anthropic-compatible-node), kept as 9router has them ----

const node = (base, official) => ({
  id: "anthropic-compatible-abc", name: "Gateway", protocol: "anthropic", chatUrl: `${base}/messages`, modelsUrl: `${base}/models`,
  headers: { "anthropic-version": "2023-06-01" }, aliases: [], models: [], auth: { kind: "api-key", header: "x-api-key", scheme: "raw" },
  anthropicNode: { official },
});
const officialNode = node("https://api.anthropic.com/v1", true);
const gateway = node("https://gw.example/anthropic/v1", false);
const CLAUDE_CODE_BETAS = "oauth-2025-04-20,interleaved-thinking-2025-05-14,context-management-2025-06-27,prompt-caching-scope-2026-01-05,"
  + "structured-outputs-2025-12-15,fast-mode-2026-02-01,redact-thinking-2026-02-12,token-efficient-tools-2026-03-28";

test("an Anthropic node sends x-api-key, the Claude Code betas for claude-* models, and Bearer to a third-party host", async () => {
  const headersFor = async (provider, model) => {
    const transport = fakeTransport(json(200, reply));
    await new AnthropicAdapter(provider, transport).execute({ ...hello, model }, credential, ctx());
    return transport.calls[0];
  };
  const sonnet = await headersFor(officialNode, "claude-sonnet-4-5");
  assert.equal(sonnet.url, "https://api.anthropic.com/v1/messages");
  assert.equal(sonnet.headers["x-api-key"], SECRET);
  assert.equal(sonnet.headers.authorization, undefined, "no Bearer for the official host");
  assert.equal(sonnet.headers["anthropic-version"], "2023-06-01");
  assert.equal(sonnet.headers["anthropic-beta"], `claude-code-20250219,${CLAUDE_CODE_BETAS},advanced-tool-use-2025-11-20,effort-2025-11-24`);
  const haiku = await headersFor(gateway, "claude-haiku-4-5");
  assert.equal(haiku.url, "https://gw.example/anthropic/v1/messages");
  assert.equal(haiku.headers.authorization, `Bearer ${SECRET}`, "9router adds Bearer for any other host");
  assert.equal(haiku.headers["x-api-key"], SECRET);
  assert.equal(haiku.headers["anthropic-beta"], CLAUDE_CODE_BETAS, "no claude-code flag off Anthropic, no heavy-agent flags for haiku");
  // thinking.display summarized can only come from vendorExtensions.anthropic (no OpenAI client field maps to it).
  const summarizedTransport = fakeTransport(json(200, reply));
  await new AnthropicAdapter(gateway, summarizedTransport).execute({ ...hello, model: "claude-haiku-4-5", vendorExtensions: { anthropic: { thinking: { type: "enabled", budget_tokens: 2048, display: "summarized" } } } }, credential, ctx());
  assert.equal(summarizedTransport.calls[0].headers["anthropic-beta"], CLAUDE_CODE_BETAS.replace(",redact-thinking-2026-02-12", ""), "summaries asked: no redact-thinking");
  const glm = await headersFor(gateway, "glm-4.6");
  assert.equal(glm.headers["anthropic-beta"], undefined, "a non-Claude model gets no beta header");
  const catalogAnthropic = await headersFor(anthropic, "claude-sonnet-4-20250514");
  assert.equal(catalogAnthropic.headers["anthropic-beta"], "claude-code-20250219,interleaved-thinking-2025-05-14", "the catalog provider is unchanged");
});

test("an Anthropic node connection test is 9router's: <base>/v1/messages, and only 401/403 are invalid", async () => {
  const check = async (answer, provider = officialNode) => {
    const transport = fakeTransport(answer);
    return { result: await new AnthropicAdapter(provider, transport).validateCredential(credential, ctx()), call: transport.calls[0] };
  };
  const notFound = await check(json(404, { error: { message: "no such route" } }));
  assert.deepEqual(notFound.result, { valid: true }, "the doubled /v1 answers 404, which 9router counts as valid");
  assert.equal(notFound.call.url, "https://api.anthropic.com/v1/v1/messages");
  assert.equal(notFound.call.method, "POST");
  assert.equal(notFound.call.headers.authorization, `Bearer ${SECRET}`, "the test always sends Bearer too");
  assert.equal(notFound.call.headers["x-api-key"], SECRET);
  assert.deepEqual(JSON.parse(notFound.call.body), { model: "claude-3-haiku-20240307", max_tokens: 1, messages: [{ role: "user", content: "test" }] });
  assert.deepEqual((await check(json(500, {}), gateway)).result, { valid: true });
  for (const status of [401, 403]) {
    const refused = (await check(json(status, {}))).result;
    assert.deepEqual([refused.valid, refused.code], [false, "AUTH_ERROR"]);
    assert.ok(!refused.message.includes(SECRET));
  }
  await assert.rejects(new AnthropicAdapter(officialNode, fakeTransport(new EngineError("PROVIDER_UNAVAILABLE", "down"))).validateCredential(credential, ctx()),
    (e) => e.code === "PROVIDER_UNAVAILABLE", "a network failure is not an answer about the key");
});
