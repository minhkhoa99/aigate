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

test("SP23 live voice lists, previews through the speech lane, TTS service probes, and catalog routes", () =>
  withTempDb(async (file) => {
    let voicesStatus = 200;
    const calls = [];
    const upstream = { async send(request, ctx) {
      calls.push(request);
      const reply = (status, text, type = "application/json") => ({ status, headers: { "content-type": type }, body: body(text, ctx) });
      if (request.url === "https://api.elevenlabs.io/v1/voices") {
        return request.headers["xi-api-key"] === "xi-bad-key-123456" ? reply(401, "{}") : reply(voicesStatus, JSON.stringify({ voices: [{ voice_id: "v1", name: "Rachel", labels: { language: "en", gender: "female" } }] }));
      }
      if (request.url === "https://api.elevenlabs.io/v1/text-to-speech/v1") return reply(200, "eleven-mp3", "audio/mpeg");
      if (request.url === "https://api.minimax.io/v1/get_voice") return reply(200, JSON.stringify({ base_resp: { status_code: 0 }, system_voice: [{ voice_id: "Narrator_1", voice_name: "Narrator" }] }));
      if (request.url === "https://api.minimax.io/v1/t2a_v2") return reply(200, JSON.stringify({ base_resp: { status_code: 0 }, data: { audio: "4142" } }));
      throw new Error(`unexpected ${request.url}`);
    } };
    const { dash } = await ready(file, upstream);

    const catalog = (await dash({ url: "/api/providers" })).json();
    const kinds = (id) => catalog.find((provider) => provider.id === id);
    assert.deepEqual([kinds("elevenlabs").connectable, kinds("elevenlabs").routeKinds.includes("tts"), kinds("minimax").routeKinds.includes("tts"), kinds("fish-audio").connectable], [true, true, true, true]);
    assert.deepEqual((await dash({ url: "/api/providers/elevenlabs" })).json().models.map((model) => [model.id, model.kind])[0], ["eleven_flash_v2_5", "tts"]);

    const unconnected = await dash({ url: "/api/providers/elevenlabs/voices?model=eleven_flash_v2_5" });
    assert.deepEqual([unconnected.statusCode, unconnected.json().code], [400, "NO_ACTIVE_CONNECTION"]);
    assert.equal((await dash({ url: "/api/providers/nope/voices" })).statusCode, 404);

    const bad = (await dash({ method: "POST", url: "/api/connections", body: { provider: "elevenlabs", apiKey: "xi-bad-key-123456" } })).json();
    const tested = await dash({ method: "POST", url: `/api/connections/${bad.id}/test` });
    assert.deepEqual([tested.json().testStatus, calls.at(-1).method, calls.at(-1).url], ["invalid", "GET", "https://api.elevenlabs.io/v1/voices"]);
    await dash({ method: "DELETE", url: `/api/connections/${bad.id}` });
    const good = (await dash({ method: "POST", url: "/api/connections", body: { provider: "elevenlabs", apiKey: "xi-good-key-123456" } })).json();
    assert.equal((await dash({ method: "POST", url: `/api/connections/${good.id}/test` })).json().testStatus, "active");

    voicesStatus = 500;
    const failed = await dash({ url: "/api/providers/elevenlabs/voices" });
    assert.deepEqual([failed.statusCode, failed.json().code], [502, "VOICES_FETCH_FAILED"]);
    voicesStatus = 200;
    const live = await dash({ url: "/api/providers/elevenlabs/voices" });
    assert.deepEqual(live.json(), { voices: [{ id: "v1", name: "Rachel", locale: "en", gender: "female" }], live: true });
    assert.equal((await dash({ url: "/api/providers/openai/voices?model=tts-1" })).json().live, false);

    const wrongVoice = await dash({ method: "POST", url: "/api/providers/elevenlabs/voice-preview", body: { model: "eleven_flash_v2_5", voice: "v9" } });
    assert.deepEqual([wrongVoice.statusCode, wrongVoice.json().code], [400, "INVALID_REQUEST"]);
    const eleven = await dash({ method: "POST", url: "/api/providers/elevenlabs/voice-preview", body: { model: "eleven_flash_v2_5", voice: "v1" } });
    assert.deepEqual([eleven.statusCode, eleven.body], [200, "eleven-mp3"]);

    await dash({ method: "POST", url: "/api/connections", body: { provider: "minimax", apiKey: "mm-test-key-123456" } });
    const minimax = await dash({ method: "POST", url: "/api/providers/minimax/voice-preview", body: { model: "speech-02-hd", voice: "Narrator_1" } });
    assert.deepEqual([minimax.statusCode, minimax.headers["content-type"], minimax.body], [200, "audio/mpeg", "AB"]);
    assert.deepEqual(calls.slice(-2).map((request) => request.url), ["https://api.minimax.io/v1/get_voice", "https://api.minimax.io/v1/t2a_v2"]);
  }));
