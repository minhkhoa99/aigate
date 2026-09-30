import { CATALOG } from "./catalog/providers.generated.js";
import { EngineError } from "./errors.js";
import { list, record } from "./json.js";
import type { HttpRequest } from "./ports.js";
import type { ProviderDescriptor } from "./registry.js";
import type { TtsVoice } from "./tts-voices.js";

// docs/contracts/speech.md: one request builder and one answer shape per upstream TTS format (media.tts-lane).

export type TtsFormat = "openai-speech" | "openrouter-chat" | "mimo-chat" | "nvidia" | "gemini" | "minimax" | "elevenlabs" | "inworld" | "fish-audio";
// binary: audio bytes, streamed; sse: OpenRouter's delta.audio chunks; json: an encoded payload in a JSON body.
export type TtsAnswer = "binary" | "sse" | "json";
type Auth = "provider" | { readonly header: string; readonly scheme: "bearer" | "raw" | "basic" };
export interface TtsModel { readonly id: string; readonly name: string }

export interface TtsRoute {
  readonly provider: string;
  readonly format: TtsFormat;
  readonly answer: TtsAnswer;
  readonly auth: Auth;
  // A fixed upstream; without one the URL comes from the connected provider's chatUrl.
  readonly url?: string;
  readonly defaultModel: string;
  // "" means the request must name a voice (ElevenLabs puts it in the path) or sends none (Fish Audio).
  readonly defaultVoice: string;
  readonly voiceRequired?: boolean;
  // Media services have no catalog models; everyone else reads the catalog's TTS models.
  readonly models?: readonly TtsModel[];
}

const bearer: Auth = { header: "authorization", scheme: "bearer" };
const ROUTES: readonly TtsRoute[] = [
  { provider: "openai", format: "openai-speech", answer: "binary", auth: "provider", defaultModel: "gpt-4o-mini-tts", defaultVoice: "alloy" },
  { provider: "openrouter", format: "openrouter-chat", answer: "sse", auth: "provider", defaultModel: "openai/gpt-4o-mini-tts", defaultVoice: "alloy" },
  { provider: "xiaomi-mimo", format: "mimo-chat", answer: "json", auth: "provider", defaultModel: "mimo-v2.5-tts", defaultVoice: "mimo_default" },
  { provider: "nvidia", format: "nvidia", answer: "binary", auth: "provider", defaultModel: "fastpitch", defaultVoice: "default" },
  { provider: "gemini", format: "gemini", answer: "json", auth: "provider", defaultModel: "gemini-3.1-flash-tts-preview", defaultVoice: "Kore" },
  { provider: "minimax", format: "minimax", answer: "json", auth: bearer, url: "https://api.minimax.io/v1/t2a_v2", defaultModel: "speech-2.8-hd", defaultVoice: "English_expressive_narrator" },
  { provider: "minimax-cn", format: "minimax", answer: "json", auth: bearer, url: "https://api.minimaxi.com/v1/t2a_v2", defaultModel: "speech-2.8-hd", defaultVoice: "English_expressive_narrator" },
  {
    provider: "elevenlabs", format: "elevenlabs", answer: "binary", auth: { header: "xi-api-key", scheme: "raw" }, url: "https://api.elevenlabs.io/v1/text-to-speech",
    defaultModel: "eleven_flash_v2_5", defaultVoice: "", voiceRequired: true,
    models: [
      { id: "eleven_flash_v2_5", name: "Flash v2.5 (Fastest)" }, { id: "eleven_turbo_v2_5", name: "Turbo v2.5 (Fast)" },
      { id: "eleven_multilingual_v2", name: "Multilingual v2 (Quality)" }, { id: "eleven_monolingual_v1", name: "Monolingual v1 (English)" },
    ],
  },
  {
    provider: "inworld", format: "inworld", answer: "json", auth: { header: "authorization", scheme: "basic" }, url: "https://api.inworld.ai/tts/v1/voice",
    defaultModel: "inworld-tts-1.5-mini", defaultVoice: "Alex",
    models: [{ id: "inworld-tts-1.5-mini", name: "Inworld TTS 1.5 Mini" }, { id: "inworld-tts-1.5-max", name: "Inworld TTS 1.5 Max" }],
  },
  {
    provider: "fish-audio", format: "fish-audio", answer: "binary", auth: bearer, url: "https://api.fish.audio/v1/tts", defaultModel: "s2.1-pro-free", defaultVoice: "",
    models: [{ id: "s2.1-pro-free", name: "S2.1 Pro Free" }, { id: "s2.1-pro", name: "S2.1 Pro" }, { id: "s2-pro", name: "S2 Pro" }, { id: "s1", name: "S1" }],
  },
];

export const ttsRoute = (provider: string): TtsRoute | undefined => ROUTES.find((route) => route.provider === provider);
export const ttsProviders: readonly string[] = ROUTES.map((route) => route.provider);

export function ttsModels(provider: string): readonly TtsModel[] {
  const route = ttsRoute(provider);
  if (route?.models) return route.models;
  return (CATALOG.find((entry) => entry.id === provider)?.models ?? []).filter((model) => model.kind === "tts").map((model) => ({ id: model.id, name: model.name }));
}

// _base.js parseModelVoice: the longest known model that prefixes the string wins, the rest is the voice. A string that
// names no model is a voice for the default model (known: false), so a bare id cannot be mistaken for this provider's.
export function splitTtsModel(provider: string, rest: string): { model: string; voice: string; known: boolean } {
  const route = ttsRoute(provider);
  const ids = ttsModels(provider).map((model) => model.id).sort((a, b) => b.length - a.length);
  for (const id of ids) {
    if (rest === id) return { model: id, voice: "", known: true };
    if (rest.startsWith(`${id}/`)) return { model: id, voice: rest.slice(id.length + 1), known: true };
  }
  return { model: route?.defaultModel ?? "", voice: rest, known: false };
}

export interface TtsCall {
  readonly upstreamModel: string;
  readonly voice: string;
  readonly input: string;
  readonly language?: string;
  readonly style?: string;
  // OpenAI speech options, passed only to openai-speech upstreams.
  readonly options: Readonly<Record<string, unknown>>;
}

const CHAT_PATH = /\/chat\/completions(?:\?.*)?$/;

function authHeaders(route: TtsRoute, provider: ProviderDescriptor | undefined, apiKey: string): Record<string, string> {
  if (route.auth !== "provider") {
    const value = route.auth.scheme === "raw" ? apiKey : `${route.auth.scheme === "basic" ? "Basic" : "Bearer"} ${apiKey}`;
    return { [route.auth.header]: value };
  }
  if (!provider) throw new EngineError("INVALID_REQUEST", `${route.provider} has no connected descriptor`);
  if (provider.auth.kind === "none") return { ...provider.headers };
  return { ...provider.headers, [provider.auth.header]: provider.auth.scheme === "raw" ? apiKey : `Bearer ${apiKey}` };
}

function connectedUrl(route: TtsRoute, provider: ProviderDescriptor | undefined, path?: string): string {
  if (!provider) throw new EngineError("INVALID_REQUEST", `${route.provider} has no connected descriptor`);
  if (path === undefined) return provider.chatUrl;
  const url = provider.chatUrl.replace(CHAT_PATH, path);
  if (url === provider.chatUrl) throw new EngineError("INVALID_REQUEST", `${provider.name} has no speech endpoint`);
  return url;
}

// gemini.js buildPrompt: "Say:" keeps the model in speech mode, unless the text already carries an instruction.
const geminiPrompt = (text: string, language?: string): string => (/:\s/.test(text) ? text : language ? `Say in ${language}: ${text}` : `Say: ${text}`);

export function ttsRequest(route: TtsRoute, provider: ProviderDescriptor | undefined, apiKey: string, call: TtsCall, timeoutMs: number): HttpRequest {
  const headers: Record<string, string> = { ...authHeaders(route, provider, apiKey), "content-type": "application/json" };
  const { upstreamModel: model, voice, input } = call;
  const send = (url: string, body: unknown, extra: Record<string, string> = {}): HttpRequest =>
    ({ method: "POST", url, headers: { ...headers, ...extra }, body: JSON.stringify(body), timeoutMs });
  switch (route.format) {
    case "openai-speech":
      return send(connectedUrl(route, provider, "/audio/speech"), { ...call.options, model, input, voice });
    case "nvidia":
      return send(connectedUrl(route, provider, "/audio/speech"), { input: { text: input }, voice, model });
    case "openrouter-chat":
      return send(connectedUrl(route, provider), { model, modalities: ["text", "audio"], audio: { voice, format: "wav" }, stream: true, messages: [{ role: "user", content: input }] }, { accept: "text/event-stream" });
    case "mimo-chat": {
      const hints = [call.language ? `Speak in ${call.language}.` : "", call.style ?? ""].filter(Boolean).join(" ");
      const messages = [...(hints ? [{ role: "user", content: hints }] : []), { role: "assistant", content: input }];
      return send(connectedUrl(route, provider), { model, stream: false, messages, audio: { format: "wav", voice } });
    }
    case "gemini":
      return send(`${connectedUrl(route, provider)}/${encodeURIComponent(model)}:generateContent`, {
        contents: [{ parts: [{ text: geminiPrompt(input, call.language) }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
      });
    case "minimax":
      return send(route.url!, {
        model, text: input, stream: false, language_boost: "auto", output_format: "hex",
        voice_setting: { voice_id: voice, speed: 1, vol: 1, pitch: 0 }, audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 },
      });
    case "elevenlabs":
      return send(`${route.url}/${encodeURIComponent(voice)}`, { text: input, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }, { accept: "audio/mpeg" });
    case "inworld":
      return send(route.url!, { text: input, voiceId: voice, modelId: model, audioConfig: { audioEncoding: "MP3" } });
    case "fish-audio":
      return send(route.url!, { text: input, format: "mp3", ...(voice ? { reference_id: voice } : {}) }, { model });
  }
}

const first = (value: unknown): Record<string, unknown> => record(Array.isArray(value) ? value[0] : undefined);
const text = (value: unknown): string => (typeof value === "string" ? value : "");
const noAudio = (provider: string, why = "returned no audio"): EngineError => new EngineError("PROVIDER_UNAVAILABLE", `${provider} ${why}`);

// The audio a JSON answer carries, still encoded (the server owns the byte decoding). pcmRate: raw PCM16 mono to wrap as WAV.
export interface TtsPayload { readonly encoding: "base64" | "hex"; readonly data: string; readonly format: string; readonly pcmRate?: number }

export function ttsJsonAudio(route: TtsRoute, body: unknown): TtsPayload {
  const root = record(body);
  if (route.format === "mimo-chat") {
    const audio = record(record(first(root.choices).message).audio);
    if (!text(audio.data)) throw noAudio(route.provider);
    return { encoding: "base64", data: text(audio.data), format: text(audio.format) || "wav" };
  }
  if (route.format === "gemini") {
    const parts = record(first(root.candidates).content).parts;
    const inline = (Array.isArray(parts) ? parts.map((part) => record(record(part).inlineData)) : []).find((part) => text(part.data));
    if (!inline) throw noAudio(route.provider, `returned no audio (finishReason: ${text(first(root.candidates).finishReason) || "unknown"})`);
    const mime = text(inline.mimeType).toLowerCase();
    if (mime.includes("wav")) return { encoding: "base64", data: text(inline.data), format: "wav" };
    const rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24_000);
    return { encoding: "base64", data: text(inline.data), format: "wav", pcmRate: rate > 0 && rate <= 192_000 ? rate : 24_000 };
  }
  if (route.format === "minimax") {
    const status = record(root.base_resp ?? root.baseResp);
    const code = Number(status.status_code ?? status.statusCode ?? 0);
    if (code !== 0) throw new EngineError("PROVIDER_UNAVAILABLE", `${route.provider}: ${text(status.status_msg ?? status.statusMsg) || `error ${code}`}`);
    const hex = text(record(root.data).audio).trim();
    if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) throw noAudio(route.provider, "returned no valid audio");
    return { encoding: "hex", data: hex, format: text(record(root.extra_info ?? root.extraInfo).audio_format) || "mp3" };
  }
  if (route.format === "inworld") {
    if (!text(root.audioContent)) throw noAudio(route.provider);
    return { encoding: "base64", data: text(root.audioContent), format: "mp3" };
  }
  throw new EngineError("INVALID_REQUEST", `${route.provider} does not answer TTS in JSON`);
}

// One OpenRouter SSE event's audio, base64 (media.tts-openrouter-audio-chunks: each chunk is decoded on its own).
export function ttsStreamChunk(data: string): string | undefined {
  if (data === "[DONE]") return undefined;
  try {
    return text(record(record(first(record(JSON.parse(data)).choices).delta).audio).data) || undefined;
  } catch {
    return undefined;
  }
}

// A 44-byte RIFF header in front of raw 16-bit mono PCM (gemini.js pcmToWav).
export function pcmToWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const wav = new Uint8Array(44 + pcm.byteLength);
  const view = new DataView(wav.buffer);
  const ascii = (offset: number, value: string) => { for (let i = 0; i < value.length; i += 1) wav[offset + i] = value.charCodeAt(i); };
  ascii(0, "RIFF"); view.setUint32(4, 36 + pcm.byteLength, true); ascii(8, "WAVE"); ascii(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); ascii(36, "data");
  view.setUint32(40, pcm.byteLength, true);
  wav.set(pcm, 44);
  return wav;
}

// _base.js throwUpstreamError: the most specific message an error body has.
export function ttsErrorMessage(body: string, status: number): string {
  try {
    const root = record(JSON.parse(body));
    const detail = root.detail;
    const found = text(record(root.error).message) || text(root.message) || text(record(detail).message) || text(detail)
      || text(record(root.base_resp).status_msg) || (typeof root.error === "string" ? root.error : "");
    if (found) return found.slice(0, 500);
  } catch { /* not JSON */ }
  return body.trim().slice(0, 500) || `Upstream error (${status})`;
}

// ---- account voice lists (media.tts-voice-listing) ----

export interface TtsVoiceSource {
  readonly credentialProvider: string;
  request(apiKey: string, timeoutMs: number): HttpRequest;
  voices(body: unknown): TtsVoice[];
}

const MINIMAX_GROUPS = [["system_voice", ""], ["voice_cloning", "Cloned"], ["voice_generation", "Generated"], ["music_generation", "Music"]] as const;
const minimaxVoices = (provider: string, url: string): TtsVoiceSource => ({
  credentialProvider: provider,
  request: (apiKey, timeoutMs) => ({ method: "POST", url, headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ voice_type: "all" }), timeoutMs }),
  voices(body) {
    const root = record(body);
    const status = record(root.base_resp ?? root.baseResp);
    const code = Number(status.status_code ?? status.statusCode ?? 0);
    if (code !== 0) throw new EngineError("PROVIDER_UNAVAILABLE", text(status.status_msg ?? status.statusMsg) || `MiniMax voice API error ${code}`);
    return MINIMAX_GROUPS.flatMap(([key, label]) => list(root[key]).map(record).flatMap((item) => {
      const id = text(item.voice_id ?? item.voiceId);
      if (!id) return [];
      const name = text(item.voice_name ?? item.voiceName) || id;
      return [{ id, name: label ? `${name} · ${label}` : name, locale: "", gender: "" }];
    }));
  },
});

const SOURCES: Readonly<Record<string, TtsVoiceSource>> = {
  elevenlabs: {
    credentialProvider: "elevenlabs",
    request: (apiKey, timeoutMs) => ({ method: "GET", url: "https://api.elevenlabs.io/v1/voices", headers: { "xi-api-key": apiKey, accept: "application/json" }, timeoutMs }),
    voices: (body) => list(record(body).voices).map(record).flatMap((voice) => {
      const labels = record(voice.labels);
      const id = text(voice.voice_id);
      return id ? [{ id, name: text(voice.name) || id, locale: text(labels.language), gender: text(labels.gender) }] : [];
    }),
  },
  inworld: {
    credentialProvider: "inworld",
    request: (apiKey, timeoutMs) => ({ method: "GET", url: "https://api.inworld.ai/tts/v1/voices", headers: { authorization: `Basic ${apiKey}`, accept: "application/json" }, timeoutMs }),
    voices: (body) => list(record(body).voices).map(record).flatMap((voice) => {
      const id = text(voice.voiceId);
      const languages = Array.isArray(voice.languages) ? voice.languages : [];
      return id ? [{ id, name: text(voice.displayName) || id, locale: text(languages[0]), gender: text(voice.gender) }] : [];
    }),
  },
  minimax: minimaxVoices("minimax", "https://api.minimax.io/v1/get_voice"),
  "minimax-cn": minimaxVoices("minimax-cn", "https://api.minimaxi.com/v1/get_voice"),
};

export const ttsVoiceSource = (provider: string): TtsVoiceSource | undefined => SOURCES[provider];

// The connection test of a TTS-only service: a GET of its own list. 401/403 is a bad key (9router probeMediaProvider).
export function ttsProbe(service: string, apiKey: string, timeoutMs: number): HttpRequest | undefined {
  if (service === "fish-audio") return { method: "GET", url: "https://api.fish.audio/model?page_size=1", headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" }, timeoutMs };
  return service === "elevenlabs" || service === "inworld" ? SOURCES[service].request(apiKey, timeoutMs) : undefined;
}
