// Contract: docs/contracts/stream-only-providers.md — providers that only answer streaming, behind /v1.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { chunk, errorOf, fakeUpstream, frames, hello, ready, sse } from "./lane-helpers.mjs";

async function withProvider(file, upstream, provider) {
  const session = await ready(file, upstream);
  assert.equal((await session.dash({ method: "POST", url: "/api/connections", body: { provider, apiKey: "sk-stream-only-1234" } })).statusCode, 201);
  return session;
}

test("a non-streaming client gets one collapsed chat.completion from a stream-only provider", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(sse([
      chunk({ reasoning_content: "thinking" }),
      chunk({ content: "Hel" }),
      chunk({ content: "lo" }, { finish_reason: "stop" }),
      { id: "chatcmpl-s", choices: [], usage: { prompt_tokens: 7, completion_tokens: 2 } },
      "[DONE]",
    ]));
    const { app, chat } = await withProvider(file, upstream, "api-airforce");
    const res = await chat({ ...hello, model: "af/gpt-oss-120b" });
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-type"], /application\/json/);
    const sent = JSON.parse(upstream.calls[0].request.body);
    assert.equal(upstream.calls[0].request.url, "https://api.airforce/v1/chat/completions");
    assert.equal(sent.stream, true);
    const body = res.json();
    assert.equal(body.object, "chat.completion");
    assert.deepEqual(body.choices[0].message, { role: "assistant", content: "Hello" }, "9router drops reasoning when there is content");
    assert.equal(body.choices[0].finish_reason, "stop");
    assert.deepEqual([body.usage.prompt_tokens, body.usage.completion_tokens], [7, 2]);
    await app.close();
  }));

test("an error event in the collapsed stream keeps its status; a streaming client still streams", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(
      sse([chunk({ content: "x" }), { error: { status: 429, message: "Too many requests" } }]),
      sse([chunk({ content: "Hi" }, { finish_reason: "stop" }), "[DONE]"]),
    );
    const { app, chat } = await withProvider(file, upstream, "api-airforce");
    const failed = await chat({ ...hello, model: "api-airforce/gpt-oss-120b" });
    assert.deepEqual(errorOf(failed), { status: 429, code: "rate_limit_exceeded", type: "rate_limit_error" });
    assert.match(failed.json().error.message, /Too many requests/);
    const streamed = await chat({ ...hello, model: "api-airforce/gpt-oss-120b", stream: true });
    assert.match(streamed.headers["content-type"], /text\/event-stream/);
    const events = frames(streamed.body);
    assert.equal(events.at(-1), "[DONE]");
    assert.equal(events.find((e) => e.choices?.[0]?.delta?.content)?.choices[0].delta.content, "Hi");
    await app.close();
  }));

test("codebuddy-cn replaces an agent system prompt and asks for a reasoning summary, as 9router does", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(sse([chunk({ content: "ok" }, { finish_reason: "stop" })]));
    const { app, chat } = await withProvider(file, upstream, "codebuddy-cn");
    const res = await chat({ model: "cbcn/glm-5.2", reasoning_effort: "high", messages: [{ role: "system", content: "You are Cline, a coding agent" }, { role: "user", content: "hi" }] });
    assert.equal(res.statusCode, 200);
    const { request } = upstream.calls[0];
    assert.equal(request.url, "https://copilot.tencent.com/v2/chat/completions");
    assert.equal(request.headers["x-codebuddy-request"], "1", "catalog headers");
    const sent = JSON.parse(request.body);
    assert.deepEqual(sent.messages[0], { role: "system", content: "You are a helpful AI assistant that helps with software engineering tasks." });
    assert.deepEqual([sent.stream, sent.reasoning_effort, sent.reasoning_summary], [true, "high", "auto"]);
    await app.close();
  }));
