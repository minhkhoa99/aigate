// Contract: docs/contracts/protocol-gemini.md — Gemini clients on /v1beta/models.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { chunk, completion, fakeUpstream, json, ready, SECRET, sse } from "./lane-helpers.mjs";

const GEMINI_KEY = "gemini-lane-key-5555";
const audio = { candidates: [{ content: { role: "model", parts: [{ inlineData: { mimeType: "audio/L16;rate=24000", data: "AAAA" } }] } }] };

test("a Gemini client is served through 9router's text-only conversion, and TTS is forwarded to Google unchanged", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(
      json(200, { ...completion, model: "", choices: [{ message: { content: "Hello!", tool_calls: [{ id: "c", type: "function", function: { name: "f", arguments: "{}" } }] }, finish_reason: "tool_calls" }] }),
      sse([chunk({ role: "assistant", content: "Hel" }), chunk({ content: "lo" }), chunk({}, { finish_reason: "stop" }), { id: "chatcmpl-s", model: "gpt-4.1", choices: [], usage: { prompt_tokens: 9, completion_tokens: 2 } }, "[DONE]"]),
      json(200, audio),
      json(400, { error: { code: 400, message: "bad voice", status: "INVALID_ARGUMENT" } }),
      json(200, audio),
    );
    const { app, call, dash, key } = await ready(file, upstream);
    const post = (url, body, headers = { authorization: `Bearer ${key}` }) => call({ method: "POST", url, body, headers });
    const body = {
      systemInstruction: { parts: [{ text: "be brief" }] },
      contents: [{ role: "user", parts: [{ text: "hi" }, { inlineData: { mimeType: "image/png", data: "AA" } }] }],
      tools: [{ functionDeclarations: [{ name: "f" }] }],
      generationConfig: { maxOutputTokens: 64, stopSequences: ["x"] },
    };

    const answer = await post("/v1beta/models/openai/gpt-4.1:generateContent", body);
    assert.equal(answer.statusCode, 200);
    assert.deepEqual(answer.json(), {
      candidates: [{ content: { role: "model", parts: [{ text: "Hello!" }] }, finishReason: "STOP", index: 0 }],
      modelVersion: "openai/gpt-4.1", usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2, totalTokenCount: 5 },
    }, "the tool call is dropped (9router)");
    const sent = JSON.parse(upstream.calls[0].request.body);
    assert.equal(upstream.calls[0].request.headers.authorization, `Bearer ${SECRET}`);
    assert.deepEqual([sent.messages, sent.max_completion_tokens, sent.tools, sent.stop, sent.stream],
      [[{ role: "system", content: "be brief" }, { role: "user", content: "hi\n" }], 64, undefined, undefined, false], "text only, three settings");

    const streamed = await post("/v1beta/models/openai/gpt-4.1:streamGenerateContent?alt=sse", body);
    assert.equal(streamed.headers["content-type"], "text/event-stream; charset=utf-8");
    const frames = streamed.body.split("\r\n\r\n").filter(Boolean).map((frame) => JSON.parse(frame.slice(6)));
    assert.deepEqual(frames.map((f) => f.candidates[0].content.parts[0].text), ["Hel", "lo", ""]);
    assert.deepEqual(frames.at(-1), { candidates: [{ content: { role: "model", parts: [{ text: "" }] }, index: 0, finishReason: "STOP" }] }, "OpenAI's trailing usage is dropped");
    assert.ok(!streamed.body.includes("[DONE]"));

    const googleStyle = await post("/v1beta/models/openai/gpt-4.1:generateContent", body, { "x-goog-api-key": key });
    assert.deepEqual([googleStyle.statusCode, googleStyle.json().error.code], [401, "missing_api_key"], "the chat path reads Authorization and x-api-key only (9router)");
    assert.equal((await post("/v1beta/models/openai/gpt-4.1:generateContent", body, {})).statusCode, 401);

    const ttsBody = { contents: [{ parts: [{ text: "Say hi" }] }], generationConfig: { responseModalities: ["AUDIO"] } };
    const tts = (headers, url = "/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?alt=json&key=ignored") => post(url, ttsBody, headers);
    const noConnection = await tts({ "x-goog-api-key": key });
    assert.deepEqual([noConnection.statusCode, noConnection.json().error.code], [503, "no_active_connection"]);
    await dash({ method: "POST", url: "/api/connections", body: { provider: "gemini", apiKey: GEMINI_KEY } });
    const spoken = await tts({ "x-goog-api-key": key });
    assert.deepEqual([spoken.statusCode, spoken.headers["content-type"], spoken.json()], [200, "application/json", audio]);
    const forwarded = upstream.calls[2].request;
    assert.deepEqual([forwarded.url, forwarded.headers["x-goog-api-key"], JSON.parse(forwarded.body)],
      ["https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?alt=json", GEMINI_KEY, ttsBody]);
    const refused = await tts({ authorization: `Bearer ${key}` });
    assert.deepEqual([refused.statusCode, refused.json()], [400, { error: { code: 400, message: "bad voice", status: "INVALID_ARGUMENT" } }], "Google's error comes back as it is");
    const byQuery = await tts({}, `/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${key}`);
    assert.deepEqual([byQuery.statusCode, upstream.calls[4].request.url], [200, "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent"], "?key= works on the TTS path");
    assert.deepEqual([(await tts({ "x-api-key": key })).statusCode, (await tts({ "x-goog-api-key": "wrong" })).json().error.code], [401, "invalid_api_key"],
      "the TTS path does not read x-api-key");
    assert.equal((await tts({ "x-goog-api-key": key }, "/v1beta/models/gemini/a%24b:generateContent")).json().error.param, "model");

    const list = await call({ method: "GET", url: "/v1beta/models" });
    assert.equal(list.statusCode, 200, "the listing needs no key (9router)");
    assert.ok(list.json().models.some((m) => m.name === "models/gemini-2.5-flash"));
    assert.equal(upstream.calls.length, 5);
    await dash({ method: "PATCH", url: "/api/settings", body: { requireApiKey: false } });
    const remote = await call({ method: "POST", url: "/v1beta/models/openai/gpt-4.1:generateContent", body, remoteAddress: "10.0.0.7" });
    assert.deepEqual([remote.statusCode, remote.json().error.code], [403, "api_key_required"], "keyless mode serves this machine only");
    await app.close();
  }));
