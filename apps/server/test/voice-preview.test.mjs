import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { body, fakeUpstream, ready } from "./lane-helpers.mjs";

test("SP23 voice catalog validates model and voice; dashboard preview uses the saved key", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(
      (_request, ctx) => ({ status: 200, headers: { "content-type": "audio/mpeg" }, body: body("mp3-sample", ctx) }),
      () => ({ status: 200, headers: { "content-type": "audio/mpeg" }, body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1024 * 1024 + 1)); controller.close(); } }) }),
    );
    const { app, call, dash, connection } = await ready(file, upstream);
    const denied = await call({ url: "/api/providers/openai/voices?model=tts-1" });
    assert.equal(denied.statusCode, 401);
    const list = await dash({ url: "/api/providers/openai/voices?model=tts-1" });
    assert.equal(list.statusCode, 200, list.body);
    assert.equal(list.json().voices.length, 9);
    assert.equal((await dash({ url: "/api/providers/openai/voices?model=gpt-4o-mini-tts" })).json().voices.length, 13);
    const invalid = await dash({ method: "POST", url: "/api/providers/openai/voice-preview", body: { model: "tts-1", voice: "ballad" } });
    assert.deepEqual([invalid.statusCode, invalid.json().code, upstream.calls.length], [400, "INVALID_REQUEST", 0]);
    const preview = await dash({ method: "POST", url: "/api/providers/openai/voice-preview", body: { model: "tts-1", voice: "alloy" } });
    assert.equal(preview.statusCode, 200, preview.body);
    assert.match(preview.headers["content-type"], /audio\/mpeg/);
    assert.equal(preview.body, "mp3-sample");
    assert.equal(upstream.calls[0].request.url, "https://api.openai.com/v1/audio/speech");
    assert.equal(upstream.calls[0].request.headers.authorization, "Bearer sk-upstream-secret-4242");
    assert.deepEqual(JSON.parse(upstream.calls[0].request.body), { model: "tts-1", voice: "alloy", input: "Hello, this is an AIGate voice preview.", response_format: "mp3" });
    const oversized = await dash({ method: "POST", url: "/api/providers/openai/voice-preview", body: { model: "tts-1", voice: "alloy" } });
    assert.deepEqual([oversized.statusCode, oversized.json().code], [502, "VOICE_PREVIEW_FAILED"]);
    await dash({ method: "PATCH", url: `/api/connections/${connection.id}`, body: { isActive: false } });
    const disconnected = await dash({ method: "POST", url: "/api/providers/openai/voice-preview", body: { model: "tts-1", voice: "alloy" } });
    assert.deepEqual([disconnected.statusCode, disconnected.json().code, upstream.calls.length], [400, "NO_ACTIVE_CONNECTION", 2]);
    await app.close();
  }));
