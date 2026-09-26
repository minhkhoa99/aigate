// Contract: docs/contracts/provider-anthropic.md — an OpenAI client on /v1 served by an Anthropic Messages provider.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { fakeUpstream, frames, json, ready, sse } from "./lane-helpers.mjs";

const KEY = "sk-ant-lane-key-1234";
const MODEL = "claude-sonnet-4-20250514";
const ask = { model: `anthropic/${MODEL}`, messages: [{ role: "system", content: "terse" }, { role: "user", content: "hi" }], max_tokens: 50, stop: ["X"] };
const message = {
  id: "msg_lane", type: "message", model: MODEL, stop_reason: "end_turn",
  content: [{ type: "text", text: "Hello from Claude" }], usage: { input_tokens: 9, output_tokens: 4, cache_read_input_tokens: 2 },
};

async function withAnthropic(file, upstream) {
  const session = await ready(file, upstream);
  const created = await session.dash({ method: "POST", url: "/api/connections", body: { provider: "anthropic", apiKey: KEY } });
  assert.equal(created.statusCode, 201);
  return { ...session, connection: created.json() };
}

test("a JSON answer: the request goes to /v1/messages with x-api-key, the reply comes back in OpenAI shape", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(json(200, message));
    const { app, chat } = await withAnthropic(file, upstream);
    const res = await chat(ask);
    assert.equal(res.statusCode, 200);
    const [call] = upstream.calls;
    assert.equal(call.request.url, "https://api.anthropic.com/v1/messages");
    assert.equal(call.request.headers["x-api-key"], KEY);
    assert.equal(call.request.headers["anthropic-version"], "2023-06-01");
    const sent = JSON.parse(call.request.body);
    assert.deepEqual([sent.model, sent.max_tokens, sent.stop_sequences, sent.system[0].text], [MODEL, 50, ["X"], "terse"]);
    const body = res.json();
    assert.equal(body.object, "chat.completion");
    assert.equal(body.choices[0].message.content, "Hello from Claude");
    assert.equal(body.choices[0].finish_reason, "stop");
    assert.deepEqual([body.usage.prompt_tokens, body.usage.completion_tokens, body.usage.prompt_tokens_details.cached_tokens], [11, 4, 2]);
    await app.close();
  }));

test("a stream: Anthropic events become OpenAI chunks ending with [DONE]; a bare model id finds the provider", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(sse([
      { type: "message_start", message: { id: "msg_s", model: MODEL, usage: { input_tokens: 5, output_tokens: 1 } } },
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hel" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "lo" } },
      { type: "message_delta", delta: { stop_reason: "max_tokens" }, usage: { output_tokens: 7 } },
      { type: "message_stop" },
    ]));
    const { app, chat } = await withAnthropic(file, upstream);
    const res = await chat({ model: MODEL, messages: [{ role: "user", content: "hi" }], stream: true, stream_options: { include_usage: true } });
    assert.equal(res.statusCode, 200);
    const out = frames(res.body);
    assert.equal(out.at(-1), "[DONE]");
    const events = out.slice(0, -1);
    assert.equal(events.map((e) => e.choices[0]?.delta?.content ?? "").join(""), "Hello");
    assert.equal(events.find((e) => e.choices[0]?.finish_reason)?.choices[0].finish_reason, "length", "max_tokens maps to length");
    assert.deepEqual([events.at(-1).usage.prompt_tokens, events.at(-1).usage.completion_tokens], [5, 7]);
    await app.close();
  }));

test("a mid-stream error ends with an error event and no [DONE]; a field Anthropic cannot carry is a 400 before any call", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(sse([
      { type: "message_start", message: { id: "m", model: MODEL, usage: {} } },
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "part" } },
      { type: "error", error: { type: "overloaded_error", message: "Overloaded" } },
    ]));
    const { app, chat } = await withAnthropic(file, upstream);
    const res = await chat({ ...ask, stream: true });
    const out = frames(res.body);
    assert.ok(!out.includes("[DONE]"), "no [DONE] after a failure");
    assert.match(out.at(-1).error.message, /Overloaded/);
    const refused = await chat({ ...ask, seed: 7 });
    assert.deepEqual([refused.statusCode, refused.json().error.code], [400, "unsupported_feature"]);
    assert.match(refused.json().error.message, /vendorExtensions\.openai\.seed/);
    assert.equal(upstream.calls.length, 1, "the refused request never left AIGate");
    await app.close();
  }));

test("the connection test for an Anthropic key reads the model list with x-api-key", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(json(200, { data: [{ id: MODEL }] }), json(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }));
    const { app, dash, connection } = await withAnthropic(file, upstream);
    const ok = (await dash({ method: "POST", url: `/api/connections/${connection.id}/test` })).json();
    assert.equal(ok.testStatus, "active");
    assert.deepEqual([upstream.calls[0].request.url, upstream.calls[0].request.headers["x-api-key"]], ["https://api.anthropic.com/v1/models", KEY]);
    const bad = (await dash({ method: "POST", url: `/api/connections/${connection.id}/test` })).json();
    assert.deepEqual([bad.testStatus, bad.lastErrorCode], ["invalid", "AUTH_ERROR"]);
    assert.match(bad.lastError, /invalid x-api-key/);
    await app.close();
  }));
