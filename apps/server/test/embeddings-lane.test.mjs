// Contract: docs/discovery/feature-matrix/09-media-providers.yaml — SP22 OpenAI-compatible embedding lane.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { body, ready } from "./lane-helpers.mjs";

test("SP22 media lanes reuse connection auth and proxy while rejecting wrong-kind models", () =>
  withTempDb(async (file) => {
    const calls = [];
    const fake = { async send(request, ctx) {
      calls.push(request);
      if (request.url.endsWith("/audio/speech")) return { status: 200, headers: { "content-type": "audio/wav", "content-length": "5" }, body: body("audio", ctx) };
      if (request.url === "https://api.tavily.com/search" && request.headers.authorization === "Bearer tvly-rate-limited") return { status: 429, headers: { "content-type": "application/json" }, body: body('{"error":"rate limited"}', ctx) };
      if (request.url === "https://api.tavily.com/search") return { status: 200, headers: { "content-type": "application/json" }, body: body('{"results":[{"title":"Result","url":"https://example.com","content":"Found it","score":0.9}]}', ctx) };
      if (request.url === "https://api.tavily.com/extract") return { status: 200, headers: { "content-type": "application/json" }, body: body('{"results":[{"raw_content":"Extracted page"}]}', ctx) };
      const response = request.url.includes("generativelanguage.googleapis.com")
        ? '{"embeddings":[{"values":[0.1,0.2]},{"values":[0.3,0.4] }]}'
        : '{"object":"list","data":[],"model":"text-embedding-3-small"}';
      return { status: 200, headers: { "content-type": "application/json" }, body: body(response, ctx) };
    } };
    const { app, dash, key } = await ready(file, fake);
    const invoke = (payload) => app.getHttpAdapter().getInstance().inject({ method: "POST", url: "/v1/embeddings", payload: JSON.stringify(payload), headers: { "content-type": "application/json", authorization: `Bearer ${key}` } });
    const ok = await invoke({ model: "openai/text-embedding-3-small", input: ["a", "b"], dimensions: 256 });
    assert.equal(ok.statusCode, 200, ok.body);
    assert.equal(calls[0].url, "https://api.openai.com/v1/embeddings");
    assert.equal(calls[0].headers.authorization, "Bearer sk-upstream-secret-4242");
    assert.deepEqual(JSON.parse(calls[0].body), { model: "text-embedding-3-small", input: ["a", "b"], dimensions: 256 });
    const chatModel = await invoke({ model: "openai/gpt-4o-mini", input: "hello" });
    assert.equal(chatModel.statusCode, 400);
    assert.equal(calls.length, 1);
    const image = await app.getHttpAdapter().getInstance().inject({ method: "POST", url: "/v1/images/generations", payload: JSON.stringify({ model: "openai/dall-e-3", prompt: "a small red kite", size: "1024x1024" }), headers: { "content-type": "application/json", authorization: `Bearer ${key}` } });
    assert.equal(image.statusCode, 200, image.body);
    assert.equal(calls[1].url, "https://api.openai.com/v1/images/generations");
    assert.deepEqual(JSON.parse(calls[1].body), { model: "dall-e-3", prompt: "a small red kite", size: "1024x1024" });
    await dash({ method: "POST", url: "/api/connections", body: { provider: "gemini", apiKey: "AIza-example-key" } });
    const gemini = await invoke({ model: "gemini/gemini-embedding-001", input: ["alpha", "beta"], dimensions: 2 });
    assert.equal(gemini.statusCode, 200, gemini.body);
    assert.equal(calls[2].url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents");
    assert.deepEqual(JSON.parse(calls[2].body), { requests: [
      { model: "models/gemini-embedding-001", content: { parts: [{ text: "alpha" }] }, outputDimensionality: 2 },
      { model: "models/gemini-embedding-001", content: { parts: [{ text: "beta" }] }, outputDimensionality: 2 },
    ] });
    assert.deepEqual(gemini.json().data.map((row) => row.embedding), [[0.1, 0.2], [0.3, 0.4]]);
    const speech = await app.getHttpAdapter().getInstance().inject({ method: "POST", url: "/v1/audio/speech", payload: JSON.stringify({ model: "openai/tts-1", input: "Hello", voice: "alloy", response_format: "wav" }), headers: { "content-type": "application/json", authorization: `Bearer ${key}` } });
    assert.equal(speech.statusCode, 200, speech.body);
    assert.equal(speech.headers["content-type"], "audio/wav");
    assert.equal(speech.body, "audio");
    assert.equal(calls[3].url, "https://api.openai.com/v1/audio/speech");
    assert.deepEqual(JSON.parse(calls[3].body), { model: "tts-1", input: "Hello", voice: "alloy", response_format: "wav" });
    await dash({ method: "POST", url: "/api/connections", body: { provider: "xai", apiKey: "xai-test-key-123456" } });
    const video = await app.getHttpAdapter().getInstance().inject({ method: "POST", url: "/v1/videos/generations", payload: JSON.stringify({ model: "xai/grok-imagine-video", prompt: "a kite in the wind" }), headers: { "content-type": "application/json", authorization: `Bearer ${key}`, "idempotency-key": "job-1" } });
    assert.equal(video.statusCode, 200, video.body);
    assert.equal(calls[4].url, "https://api.x.ai/v1/videos/generations");
    assert.deepEqual(JSON.parse(calls[4].body), { model: "grok-imagine-video", prompt: "a kite in the wind" });
    const poll = await app.getHttpAdapter().getInstance().inject({ method: "GET", url: "/v1/videos/job_123", headers: { authorization: `Bearer ${key}`, "x-aigate-connection-id": video.headers["x-aigate-connection-id"] } });
    assert.equal(poll.statusCode, 200, poll.body);
    assert.equal(calls[5].url, "https://api.x.ai/v1/videos/job_123");
    const boundary = "aigate-test-boundary";
    const multipart = `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="clip.wav"\r\nContent-Type: audio/wav\r\n\r\naudio-bytes\r\n--${boundary}--\r\n`;
    const transcription = await app.getHttpAdapter().getInstance().inject({ method: "POST", url: "/v1/audio/transcriptions", payload: Buffer.from(multipart), headers: { "content-type": `multipart/form-data; boundary=${boundary}`, authorization: `Bearer ${key}` } });
    assert.equal(transcription.statusCode, 200, transcription.body);
    assert.equal(calls[6].url, "https://api.openai.com/v1/audio/transcriptions");
    assert.equal(Buffer.from(calls[6].body).toString(), multipart, "multipart body keeps its original boundary and bytes");
    await dash({ method: "POST", url: "/api/connections", body: { provider: "tavily", apiKey: "tvly-rate-limited" } });
    await dash({ method: "POST", url: "/api/connections", body: { provider: "tavily", apiKey: "tvly-test-key-123456" } });
    const search = await app.getHttpAdapter().getInstance().inject({ method: "POST", url: "/v1/search", payload: JSON.stringify({ provider: "tavily", query: "AIGate", max_results: 2 }), headers: { "content-type": "application/json", authorization: `Bearer ${key}` } });
    assert.equal(search.statusCode, 200, search.body);
    assert.equal(calls[7].headers.authorization, "Bearer tvly-rate-limited");
    assert.deepEqual(JSON.parse(calls[8].body), { query: "AIGate", max_results: 2, topic: "general" });
    assert.equal(search.json().results[0].snippet, "Found it");
    const fetched = await app.getHttpAdapter().getInstance().inject({ method: "POST", url: "/v1/web/fetch", payload: JSON.stringify({ provider: "tavily", url: "https://1.1.1.1/page", max_characters: 100 }), headers: { "content-type": "application/json", authorization: `Bearer ${key}` } });
    assert.equal(fetched.statusCode, 200, fetched.body);
    assert.equal(calls[9].headers.authorization, "Bearer tvly-rate-limited", "websearch lock must not disable the shared key for webfetch");
    assert.deepEqual(JSON.parse(calls[9].body), { urls: ["https://1.1.1.1/page"], extract_depth: "basic" });
    assert.equal(fetched.json().content.text, "Extracted page");
    await app.close();
  }));
