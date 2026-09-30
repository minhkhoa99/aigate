// Contract: docs/contracts/speech.md — per-provider TTS requests and answer decoding.
import { test } from "node:test";
import assert from "node:assert/strict";
import { builtinRegistry, pcmToWav, splitTtsModel, ttsErrorMessage, ttsJsonAudio, ttsModels, ttsProbe, ttsRequest, ttsRoute, ttsStreamChunk } from "../dist/index.js";

const call = (extra = {}) => ({ upstreamModel: "m", voice: "v", input: "hello", options: {}, ...extra });

test("splitTtsModel: longest known model wins, the rest is the voice, unknown is a default-model voice", () => {
  assert.ok(ttsModels("openai").some((model) => model.id === "gpt-4o-mini-tts"));
  assert.deepEqual(splitTtsModel("openai", "gpt-4o-mini-tts/nova"), { model: "gpt-4o-mini-tts", voice: "nova", known: true });
  assert.deepEqual(splitTtsModel("openai", "gpt-4o-mini-tts"), { model: "gpt-4o-mini-tts", voice: "", known: true });
  assert.deepEqual(splitTtsModel("elevenlabs", "eleven_turbo_v2_5/abc/def"), { model: "eleven_turbo_v2_5", voice: "abc/def", known: true });
  assert.deepEqual(splitTtsModel("inworld", "Dennis"), { model: "inworld-tts-1.5-mini", voice: "Dennis", known: false });
});

test("ttsRequest builds each upstream format", () => {
  const openai = ttsRequest(ttsRoute("openai"), builtinRegistry.provider("openai"), "sk", call({ options: { speed: 1.5 } }), 1000);
  assert.equal(openai.url, "https://api.openai.com/v1/audio/speech");
  assert.equal(openai.headers.authorization, "Bearer sk");
  assert.deepEqual(JSON.parse(openai.body), { speed: 1.5, model: "m", input: "hello", voice: "v" });

  const nvidia = ttsRequest(ttsRoute("nvidia"), builtinRegistry.provider("nvidia"), "k", call(), 1000);
  assert.equal(nvidia.url, "https://integrate.api.nvidia.com/v1/audio/speech");
  assert.deepEqual(JSON.parse(nvidia.body), { input: { text: "hello" }, voice: "v", model: "m" });

  const router = JSON.parse(ttsRequest(ttsRoute("openrouter"), builtinRegistry.provider("openrouter"), "k", call(), 1000).body);
  assert.deepEqual([router.stream, router.audio, router.modalities], [true, { voice: "v", format: "wav" }, ["text", "audio"]]);

  const mimo = JSON.parse(ttsRequest(ttsRoute("xiaomi-mimo"), builtinRegistry.provider("xiaomi-mimo"), "k", call({ language: "English", style: "calm" }), 1000).body);
  assert.deepEqual(mimo.messages, [{ role: "user", content: "Speak in English. calm" }, { role: "assistant", content: "hello" }]);

  const gemini = ttsRequest(ttsRoute("gemini"), builtinRegistry.provider("gemini"), "g", call(), 1000);
  assert.equal(gemini.url, "https://generativelanguage.googleapis.com/v1beta/models/m:generateContent");
  assert.equal(gemini.headers["x-goog-api-key"], "g");
  assert.equal(JSON.parse(gemini.body).contents[0].parts[0].text, "Say: hello");
  assert.equal(JSON.parse(ttsRequest(ttsRoute("gemini"), builtinRegistry.provider("gemini"), "g", call({ input: "Narrator: hi" }), 1000).body).contents[0].parts[0].text, "Narrator: hi");

  const minimax = ttsRequest(ttsRoute("minimax-cn"), undefined, "k", call(), 1000);
  assert.equal(minimax.url, "https://api.minimaxi.com/v1/t2a_v2");
  assert.equal(JSON.parse(minimax.body).voice_setting.voice_id, "v");

  const eleven = ttsRequest(ttsRoute("elevenlabs"), undefined, "xi", call({ voice: "a b" }), 1000);
  assert.equal(eleven.url, "https://api.elevenlabs.io/v1/text-to-speech/a%20b");
  assert.equal(eleven.headers["xi-api-key"], "xi");

  assert.equal(ttsRequest(ttsRoute("inworld"), undefined, "b64", call(), 1000).headers.authorization, "Basic b64");
  const fish = ttsRequest(ttsRoute("fish-audio"), undefined, "k", call({ voice: "" }), 1000);
  assert.equal(fish.headers.model, "m");
  assert.equal("reference_id" in JSON.parse(fish.body), false);
});

test("ttsJsonAudio decodes each JSON answer and refuses a missing or failed one", () => {
  assert.deepEqual(ttsJsonAudio(ttsRoute("xiaomi-mimo"), { choices: [{ message: { audio: { data: "QQ==" } } }] }), { encoding: "base64", data: "QQ==", format: "wav" });
  assert.deepEqual(
    ttsJsonAudio(ttsRoute("gemini"), { candidates: [{ content: { parts: [{ text: "x" }, { inlineData: { mimeType: "audio/L16;codec=pcm;rate=16000", data: "AA==" } }] } }] }),
    { encoding: "base64", data: "AA==", format: "wav", pcmRate: 16000 },
  );
  assert.throws(() => ttsJsonAudio(ttsRoute("gemini"), { candidates: [{ finishReason: "SAFETY" }] }), /SAFETY/);
  assert.deepEqual(ttsJsonAudio(ttsRoute("minimax"), { base_resp: { status_code: 0 }, data: { audio: "ff00" } }), { encoding: "hex", data: "ff00", format: "mp3" });
  assert.throws(() => ttsJsonAudio(ttsRoute("minimax"), { base_resp: { status_code: 1004, status_msg: "auth failed" } }), /auth failed/);
  assert.throws(() => ttsJsonAudio(ttsRoute("minimax"), { data: { audio: "abc" } }), /no valid audio/);
  assert.throws(() => ttsJsonAudio(ttsRoute("inworld"), {}), /no audio/);
});

test("stream chunks, WAV header, error messages, probes", () => {
  assert.equal(ttsStreamChunk(JSON.stringify({ choices: [{ delta: { audio: { data: "QUJD" } } }] })), "QUJD");
  assert.equal(ttsStreamChunk("[DONE]"), undefined);
  assert.equal(ttsStreamChunk("not json"), undefined);

  const wav = pcmToWav(new Uint8Array([1, 2, 3, 4]), 24000);
  const view = new DataView(wav.buffer);
  assert.equal(new TextDecoder().decode(wav.subarray(0, 4)), "RIFF");
  assert.deepEqual([wav.byteLength, view.getUint32(24, true), view.getUint32(40, true), wav[44]], [48, 24000, 4, 1]);

  assert.equal(ttsErrorMessage(JSON.stringify({ detail: { message: "quota" } }), 429), "quota");
  assert.equal(ttsErrorMessage("", 500), "Upstream error (500)");
  assert.equal(ttsProbe("fish-audio", "k", 1000).method, "GET");
  assert.equal(ttsProbe("elevenlabs", "k", 1000).url, "https://api.elevenlabs.io/v1/voices");
  assert.equal(ttsProbe("openai", "k", 1000), undefined);
});
