// Contract: docs/contracts/provider-gemini.md — an OpenAI client on /v1 served by Gemini, and its connection test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { fakeUpstream, frames, hello, json, ready, sse } from "./lane-helpers.mjs";

const KEY = "gemini-lane-key-1234";
const answer = { responseId: "g1", modelVersion: "gemini-2.5-flash-001", candidates: [{ content: { parts: [{ text: "Hello from Gemini" }] }, finishReason: "MAX_TOKENS" }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2, thoughtsTokenCount: 1 } };

test("a Gemini connection is tested with x-goog-api-key and serves /v1 with 9router's mapping", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(
      json(400, { error: { code: 400, message: "API key not valid", status: "INVALID_ARGUMENT" } }),
      json(200, answer),
      sse([{ responseId: "g2", candidates: [{ content: { parts: [{ text: "Hi" }] } }] }, { candidates: [{ content: { parts: [] }, finishReason: "STOP" }] }]),
    );
    const { app, dash, chat } = await ready(file, upstream);
    const created = (await dash({ method: "POST", url: "/api/connections", body: { provider: "gemini", apiKey: KEY } })).json();
    const tested = (await dash({ method: "POST", url: `/api/connections/${created.id}/test` })).json();
    assert.equal(tested.testStatus, "invalid", "Google answers a bad key with 400");
    assert.equal(upstream.calls[0].request.headers["x-goog-api-key"], KEY);
    assert.ok(!upstream.calls[0].request.url.includes(KEY));
    const res = await chat({ ...hello, model: "gemini/gemini-2.5-flash" });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(upstream.calls[1].request.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
    assert.equal(body.choices[0].message.content, "Hello from Gemini");
    assert.equal(body.choices[0].finish_reason, "max_tokens", "the raw Gemini reason, as 9router sends it");
    assert.deepEqual([body.usage.prompt_tokens, body.usage.completion_tokens], [6, 2], "thoughts counted as prompt tokens, as in 9router");
    assert.equal(body.model, "gemini-2.5-flash-001");
    const streamed = await chat({ ...hello, model: "gemini/gemini-2.5-flash", stream: true });
    const events = frames(streamed.body);
    assert.equal(upstream.calls[2].request.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse");
    assert.equal(events.find((e) => e.choices?.[0]?.delta?.content)?.choices[0].delta.content, "Hi");
    assert.equal(events.at(-2).choices[0].finish_reason, "stop", "the stream uses the mapped reason");
    assert.equal(events.at(-1), "[DONE]");
    await app.close();
  }));
