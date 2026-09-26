// Contract: docs/contracts/protocol-anthropic.md — Anthropic clients on POST /v1/messages and /v1/messages/count_tokens.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { chunk, completion, fakeUpstream, json, ready, SECRET, sse } from "./lane-helpers.mjs";

const events = (text) => text.trim().split("\n\n").map((frame) => {
  const [head, data] = frame.split("\n");
  return { event: head.slice(7), data: JSON.parse(data.slice(6)) };
});
const geminiAnswer = { responseId: "g1", modelVersion: "gemini-2.5-flash", candidates: [{ content: { parts: [{ text: "from Gemini" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 } };

test("an Anthropic client is served through CIP: x-api-key, message objects, Anthropic SSE, OpenAI-shaped errors, count_tokens", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(
      json(200, completion),
      sse([chunk({ role: "assistant", content: "Hel" }), chunk({ content: "lo" }), chunk({}, { finish_reason: "stop" }), { id: "chatcmpl-s", model: "gpt-4.1", choices: [], usage: { prompt_tokens: 9, completion_tokens: 2 } }, "[DONE]"]),
      json(200, geminiAnswer),
      json(200, completion),
    );
    const { app, call, dash, key } = await ready(file, upstream);
    const post = (url, body, headers = {}) => call({ method: "POST", url, body, headers: { "x-api-key": key, ...headers } });
    const body = { model: "openai/gpt-4.1", max_tokens: 100, system: "x-anthropic-billing-header: cc\nbe brief", messages: [{ role: "user", content: [{ type: "text", text: "hi", cache_control: { type: "ephemeral" } }] }] };

    const message = await post("/v1/messages", { ...body, stream: false });
    assert.equal(message.statusCode, 200);
    assert.deepEqual(message.json(), {
      id: "up", type: "message", role: "assistant", model: "gpt-4.1", content: [{ type: "text", text: "Hello!" }], stop_reason: "end_turn", stop_sequence: null,
      usage: { input_tokens: 3, output_tokens: 2 },
    }, "real usage: no 2000-token buffer");
    const sent = JSON.parse(upstream.calls[0].request.body);
    assert.equal(upstream.calls[0].request.headers.authorization, `Bearer ${SECRET}`);
    assert.deepEqual(sent.messages, [{ role: "system", content: "be brief" }, { role: "user", content: "hi" }], "the claude→openai pivot: billing header stripped, cache_control dropped");
    assert.equal(sent.max_completion_tokens, 100);

    const streamed = await post("/v1/messages", body);
    assert.equal(streamed.headers["content-type"], "text/event-stream; charset=utf-8", "an omitted stream streams (9router)");
    const frames = events(streamed.body);
    assert.deepEqual(frames.map((f) => f.event), ["message_start", "content_block_start", "content_block_delta", "content_block_delta", "content_block_stop", "message_delta", "message_stop"]);
    assert.equal(frames.filter((f) => f.data.delta?.type === "text_delta").map((f) => f.data.delta.text).join(""), "Hello");
    assert.deepEqual(frames[5].data.usage, { input_tokens: 9, output_tokens: 2 }, "the usage chunk after the finish is used");
    assert.ok(!streamed.body.includes("[DONE]"));

    await dash({ method: "POST", url: "/api/connections", body: { provider: "gemini", apiKey: "gemini-lane-key-5555" } });
    const viaGemini = await post("/v1/messages", { ...body, model: "gemini/gemini-2.5-flash", stream: false });
    assert.equal(viaGemini.json().object, "chat.completion", "9router answers a non-streaming Claude client with chat.completion for other providers (kept)");
    assert.equal(viaGemini.json().choices[0].message.content, "from Gemini");

    const jsonOnly = await post("/v1/messages", body, { accept: "application/json" });
    assert.equal(jsonOnly.json().type, "message", "an omitted stream with Accept: application/json is a JSON answer");
    const bad = await post("/v1/messages", { messages: [] });
    assert.deepEqual([bad.statusCode, bad.json().error.type, bad.json().error.message], [400, "invalid_request_error", "model must be a model id"], "errors stay OpenAI-shaped");
    const noKey = await call({ method: "POST", url: "/v1/messages", body });
    assert.equal(noKey.statusCode, 401);

    const count = await post("/v1/messages/count_tokens", { model: "x", messages: [{ role: "user", content: "hello world!" }] });
    assert.deepEqual([count.statusCode, count.json()], [200, { input_tokens: 3 }]);
    assert.equal(upstream.calls.length, 4, "count_tokens calls no provider");
    await app.close();
  }));
