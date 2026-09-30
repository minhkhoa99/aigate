// Contract: docs/contracts/speech.md — POST /v1/audio/speech and GET /v1/audio/voices.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { body, ready, SECRET } from "./lane-helpers.mjs";

const bytes = (value, ctx, status = 200, type = "audio/mpeg") => ({ status, headers: { "content-type": type }, body: body(value, ctx) });
const jsonAnswer = (value, ctx, status = 200) => bytes(JSON.stringify(value), ctx, status, "application/json");

// Answers by URL prefix.
function upstream(routes) {
  const calls = [];
  return {
    calls,
    async send(request, ctx) {
      calls.push(request);
      const route = routes.find(([match]) => request.url.startsWith(match));
      if (!route) throw new Error(`unexpected upstream call ${request.url}`);
      return route[1](request, ctx);
    },
  };
}

async function setUp(file, routes) {
  const fake = upstream(routes);
  const lane = await ready(file, fake);
  const inject = (method, url, payload, headers = {}) => lane.app.getHttpAdapter().getInstance().inject({
    method, url, ...(payload === undefined ? {} : { payload: JSON.stringify(payload) }),
    headers: { ...(payload === undefined ? {} : { "content-type": "application/json" }), authorization: `Bearer ${lane.key}`, ...headers },
  });
  const speak = (payload, query = "") => inject("POST", `/v1/audio/speech${query}`, payload);
  const connect = (provider, apiKey, name) => lane.dash({ method: "POST", url: "/api/connections", body: { provider, apiKey, ...(name ? { name } : {}) } });
  return { ...lane, fake, inject, speak, connect };
}

const code = (res) => [res.statusCode, res.json().error.code];

test("speech: per-provider requests, decoding, voice precedence, json output", () =>
  withTempDb(async (file) => {
    const pcm = Buffer.from([1, 0, 2, 0]).toString("base64");
    const lane = await setUp(file, [
      ["https://api.openai.com/v1/audio/speech", (_r, ctx) => bytes("mp3-bytes", ctx)],
      ["https://api.elevenlabs.io/v1/text-to-speech/", (_r, ctx) => bytes("eleven", ctx)],
      ["https://api.minimax.io/v1/t2a_v2", (request, ctx) => jsonAnswer(JSON.parse(request.body).text === "fail"
        ? { base_resp: { status_code: 1004, status_msg: "login fail" } }
        : { base_resp: { status_code: 0 }, data: { audio: "4142" }, extra_info: { audio_format: "mp3" } }, ctx)],
      ["https://generativelanguage.googleapis.com/", (_r, ctx) => jsonAnswer({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/L16;rate=16000", data: pcm } }] } }] }, ctx)],
      ["https://openrouter.ai/api/v1/chat/completions", (_r, ctx) => bytes(
        ["QUJD", "REVG"].map((data) => `data: ${JSON.stringify({ choices: [{ delta: { audio: { data } } }] })}\n\n`).join("") + "data: [DONE]\n\n", ctx, 200, "text/event-stream")],
    ]);

    const openai = await lane.speak({ model: "openai/tts-1/nova", input: "  Hello  ", voice: "alloy", speed: 1.2 });
    assert.equal(openai.statusCode, 200, openai.body);
    assert.equal(openai.body, "mp3-bytes");
    assert.deepEqual(JSON.parse(lane.fake.calls[0].body), { speed: 1.2, model: "tts-1", input: "Hello", voice: "alloy" });
    assert.equal(lane.fake.calls[0].headers.authorization, `Bearer ${SECRET}`);

    const asJson = await lane.speak({ model: "openai/gpt-4o-mini-tts", input: "Hi" }, "?response_format=json");
    assert.deepEqual(asJson.json(), { audio: Buffer.from("mp3-bytes").toString("base64"), format: "mp3" });
    assert.equal(JSON.parse(lane.fake.calls[1].body).voice, "alloy");

    assert.deepEqual(code(await lane.speak({ model: "elevenlabs/eleven_flash_v2_5/v1", input: "Hi" })), [404, "no_active_connection"]);
    await lane.connect("elevenlabs", "xi-test-key-123456");
    assert.deepEqual(code(await lane.speak({ model: "elevenlabs/eleven_flash_v2_5", input: "Hi" })), [400, "invalid_tts_request"]);
    const eleven = await lane.speak({ model: "elevenlabs/eleven_turbo_v2_5/voice-9", input: "Hi" });
    assert.equal(eleven.body, "eleven");
    assert.equal(lane.fake.calls.at(-1).url, "https://api.elevenlabs.io/v1/text-to-speech/voice-9");
    assert.equal(lane.fake.calls.at(-1).headers["xi-api-key"], "xi-test-key-123456");

    await lane.connect("minimax", "mm-test-key-123456");
    const minimax = await lane.speak({ model: "minimax/speech-02-hd", input: "Hi" });
    assert.equal(minimax.headers["content-type"], "audio/mpeg");
    assert.equal(minimax.body, "AB");
    assert.equal(JSON.parse(lane.fake.calls.at(-1).body).voice_setting.voice_id, "English_expressive_narrator");
    assert.deepEqual(code(await lane.speak({ model: "minimax/speech-02-hd", input: "fail" })), [502, "tts_upstream_error"]);

    await lane.connect("gemini", "AIza-example-key");
    const gemini = await lane.speak({ model: "gemini/gemini-2.5-flash-preview-tts/Puck", input: "Hi" });
    assert.equal(gemini.headers["content-type"], "audio/wav");
    assert.equal(gemini.rawPayload.subarray(0, 4).toString(), "RIFF");
    assert.equal(gemini.rawPayload.readUInt32LE(24), 16000);
    assert.equal(gemini.rawPayload.byteLength, 48);

    await lane.connect("openrouter", "sk-or-test-key-123456");
    const router = await lane.speak({ model: "openrouter/openai/gpt-4o-mini-tts/echo", input: "Hi" });
    assert.equal(router.rawPayload.subarray(44).toString(), "ABCDEF");
    assert.deepEqual(JSON.parse(lane.fake.calls.at(-1).body).audio, { voice: "echo", format: "wav" });
  }));

test("speech: validation, resolution, account rotation, combos", () =>
  withTempDb(async (file) => {
    const lane = await setUp(file, [
      ["https://api.openai.com/v1/audio/speech", (request, ctx) => (request.headers.authorization === `Bearer ${SECRET}`
        ? jsonAnswer({ error: { message: "Rate limit reached" } }, ctx, 429) : bytes("backup", ctx))],
      ["https://api.inworld.ai/tts/v1/voice", (_r, ctx) => jsonAnswer({ error: { message: "upstream down" } }, ctx, 500)],
    ]);
    const raw = await lane.app.getHttpAdapter().getInstance().inject({ method: "POST", url: "/v1/audio/speech", payload: "x", headers: { "content-type": "text/plain", authorization: `Bearer ${lane.key}` } });
    assert.equal(raw.statusCode, 415);
    assert.deepEqual(code(await lane.speak({ model: "openai/tts-1", input: "   " })), [400, "invalid_tts_request"]);
    assert.deepEqual(code(await lane.speak({ model: "openai/tts-1", input: "x".repeat(10_001) })), [400, "invalid_tts_request"]);
    assert.deepEqual(code(await lane.speak({ model: "nope-tts", input: "Hi" })), [400, "model_not_found"]);
    assert.deepEqual(code(await lane.speak({ model: "deepseek/deepseek-chat", input: "Hi" })), [400, "tts_provider_unsupported"]);

    // One account: the 429 is the answer, as the upstream sent it.
    const limited = await lane.speak({ model: "tts-1", input: "Hi" });
    assert.deepEqual([limited.statusCode, limited.json().error.message], [429, "Rate limit reached"]);

    await lane.connect("openai", "sk-backup-key-99999", "Backup");
    const rotated = await lane.speak({ model: "tts-1", input: "Hi" });
    assert.equal(rotated.body, "backup");
    const before = lane.fake.calls.length;
    assert.equal((await lane.speak({ model: "openai/tts-1", input: "Hi" })).body, "backup");
    assert.equal(lane.fake.calls.length, before + 1, "the rate-limited account is locked for tts:tts-1");

    await lane.connect("inworld", "aW53b3JsZC1rZXk=");
    await lane.dash({ method: "POST", url: "/api/combos", body: { name: "voices", models: ["inworld/inworld-tts-1.5-max/Dennis", "openai/tts-1/alloy"] } });
    const combo = await lane.speak({ model: "voices", input: "Hi" });
    assert.equal(combo.body, "backup");
    assert.equal(lane.fake.calls.at(-2).url, "https://api.inworld.ai/tts/v1/voice");
    assert.equal(lane.fake.calls.at(-2).headers.authorization, "Basic aW53b3JsZC1rZXk=");

    await lane.dash({ method: "POST", url: "/api/combos", body: { name: "judged", models: ["openai/tts-1", "openai/tts-1-hd"], strategy: "fusion" } });
    assert.deepEqual(code(await lane.speak({ model: "judged", input: "Hi" })), [400, "combo_strategy_unsupported"]);
  }));

test("GET /v1/audio/voices: key gate, preset and live lists, cache, failures", () =>
  withTempDb(async (file) => {
    let fail = true;
    const lane = await setUp(file, [
      ["https://api.elevenlabs.io/v1/voices", (_r, ctx) => (fail
        ? jsonAnswer({ detail: { message: "invalid key" } }, ctx, 401)
        : jsonAnswer({ voices: [{ voice_id: "v1", name: "Rachel", labels: { language: "en-US", gender: "female" } }, { voice_id: "v2", name: "Hoa", labels: { language: "vi" } }] }, ctx))],
    ]);
    const noKey = await lane.app.getHttpAdapter().getInstance().inject({ method: "GET", url: "/v1/audio/voices?provider=openai" });
    assert.equal(noKey.statusCode, 401);

    const preset = await lane.inject("GET", "/v1/audio/voices?provider=openai&model=tts-1");
    assert.equal(preset.statusCode, 200, preset.body);
    assert.equal(preset.json().object, "list");
    assert.deepEqual(preset.json().data[0], { id: "alloy", name: "alloy", lang: "", gender: "", model: "openai/tts-1/alloy" });
    assert.deepEqual(code(await lane.inject("GET", "/v1/audio/voices?provider=nvidia")), [400, "invalid_request_error"]);
    assert.deepEqual(code(await lane.inject("GET", "/v1/audio/voices?provider=elevenlabs")), [404, "no_active_connection"]);

    await lane.connect("elevenlabs", "xi-test-key-123456");
    assert.deepEqual(code(await lane.inject("GET", "/v1/audio/voices?provider=elevenlabs")), [502, "voices_fetch_failed"]);
    fail = false;
    const live = await lane.inject("GET", "/v1/audio/voices?provider=elevenlabs&lang=vi");
    assert.deepEqual(live.json().data, [{ id: "v2", name: "Hoa", lang: "vi", gender: "", model: "elevenlabs/eleven_flash_v2_5/v2" }]);
    const calls = lane.fake.calls.length;
    assert.equal((await lane.inject("GET", "/v1/audio/voices?provider=elevenlabs")).json().data.length, 2);
    assert.equal(lane.fake.calls.length, calls, "the live list is cached");
  }));

test("speech: a refused OAuth token is refreshed once and resent; an API key is not", async () => {
  const { SpeechLane } = await import("../dist/modules/routing/infrastructure/speech-lane.js");
  const run = async (stored) => {
    const sent = [];
    const reactive = [];
    const transport = { async send(request, ctx) {
      sent.push(request.headers.authorization);
      return request.headers.authorization === "Bearer fresh" ? jsonAnswer({ choices: [{ message: { audio: { data: "QQ==" } } }] }, ctx) : jsonAnswer({ error: { message: "expired" } }, ctx, 401);
    } };
    const connections = { selectActive: async () => ({ credential: stored }), activeCount: async () => 1, clearLock: async () => {}, lock: async () => {} };
    const refresher = { fresh: async (_p, value) => value, reactive: async (...args) => { reactive.push(args[0]); return "fresh"; } };
    const lane = new SpeechLane({ get: async () => ({ fallbackStrategy: "fill-first" }) }, connections, refresher, { byName: async () => undefined },
      { resolve: async () => undefined }, transport, { refreshRetryDelayMs: 0 });
    const outcome = await lane.synthesize({ model: "xiaomi-mimo/mimo-v2.5-tts", input: "Hi", options: {} }, AbortSignal.timeout(5000), "r").then(() => "ok", (error) => error.status);
    return { outcome, sent, reactive };
  };
  const base = { id: "c1", apiKey: "old", proxyPoolId: null, baseUrl: null, deployment: null, apiVersion: null, organization: null, accountId: null };
  assert.deepEqual(await run({ ...base, oauth: { refreshToken: "r1" } }), { outcome: "ok", sent: ["Bearer old", "Bearer fresh"], reactive: ["xiaomi-mimo"] });
  assert.deepEqual(await run(base), { outcome: 401, sent: ["Bearer old"], reactive: [] });
});
