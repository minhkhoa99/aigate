import { createHash, randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import {
  builtinRegistry, EngineError, pcmToWav, readBoundedText, readSseData, splitTtsModel, ttsErrorMessage, ttsJsonAudio, ttsModels, ttsProviders, ttsRequest, ttsRoute,
  ttsStreamChunk, ttsVoices, ttsVoiceSource, withConnection, type HttpTransportPort, type TtsCall, type TtsPayload, type TtsRoute, type TtsVoice,
} from "@aigate/engine";
import { ConnectionsRepository } from "../../connections/infrastructure/connections.repo.js";
import { TokenRefresher } from "../../connections/infrastructure/token-refresher.js";
import { SettingsRepository } from "../../settings/infrastructure/settings.repo.js";
import { HTTP_TRANSPORT } from "../../transport/transport.token.js";
import { ProxyPoolsRepository } from "../../transport/infrastructure/proxy-pools.repo.js";
import { MAX_COMBO_DEPTH, memberFailover } from "../domain/combo.js";
import { CHAT_LIMITS, ClientGone, deadline, errorOf, exhausted, fallbackCooldown, GatewayError, mediaCooldown, REQUEST_BUDGET_MS, type ChatLimits } from "./chat-lane.js";
import { UsageRecorder } from "../../usage/infrastructure/usage-recorder.js";
import { CombosRepository } from "./combos.repo.js";

// docs/contracts/speech.md: POST /v1/audio/speech, GET /v1/audio/voices, and the synthesis the dashboard preview shares.

const MAX_INPUT_CHARS = 10_000;
const MAX_AUDIO_BYTES = 16 * 1024 * 1024;
const MAX_ERROR_BYTES = 64 * 1024;
const VOICES_TIMEOUT_MS = 15_000;
const MAX_VOICES_JSON = 4 * 1024 * 1024;
const MAX_VOICES = 2_000;
const VOICES_TTL_MS = 10 * 60_000;
const MAX_CACHED_LISTS = 64;

export interface SpeechSpec {
  readonly model: string;
  readonly input: string;
  readonly voice?: string;
  readonly language?: string;
  readonly style?: string;
  readonly options: Readonly<Record<string, unknown>>;
  // SP24b: the route and key usage is attributed to; the dashboard preview sends none and is not recorded.
  readonly attribution?: { readonly endpoint: string; readonly apiKeyId: string | null };
}

// Streamed bytes as the upstream sent them, or decoded audio already in memory.
export type SpeechAudio =
  | { readonly kind: "stream"; readonly body: ReadableStream<Uint8Array> | null; readonly contentType: string; readonly length?: string }
  | { readonly kind: "bytes"; readonly bytes: Uint8Array; readonly format: string };

// An upstream refusal on the last connection: its status and body go back as they are.
class UpstreamReply extends GatewayError {
  constructor(status: number, readonly raw: string, readonly contentType: string) {
    super(status, "api_error", "tts_upstream_error", ttsErrorMessage(raw, status));
  }
}

const badRequest = (code: string, message: string) => new GatewayError(400, "invalid_request_error", code, message);
const decodeFailure = (message: string) => new GatewayError(502, "api_error", "tts_upstream_error", message);
const tooLarge = () => decodeFailure(`The audio is larger than ${MAX_AUDIO_BYTES / 1024 / 1024} MiB.`);

export const audioType = (format: string): string => (format === "mp3" ? "audio/mpeg" : format === "wav" ? "audio/wav" : `audio/${format}`);
const formatOf = (contentType: string): string => {
  const sub = contentType.split(";")[0].trim().toLowerCase().split("/")[1] ?? "";
  return sub === "mpeg" || sub === "mp3" ? "mp3" : sub === "x-wav" || sub === "wave" || sub === "vnd.wave" ? "wav" : sub || "mp3";
};

export async function readAudio(body: ReadableStream<Uint8Array> | null, max: number, onTooLarge: () => Error = tooLarge): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (body) for await (const chunk of body) {
    size += chunk.byteLength;
    if (size > max) throw onTooLarge();
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const optionalText = (value: unknown): string | undefined => (typeof value === "string" && value.trim() !== "" ? value : undefined);

// The client's body: model, trimmed input up to 10 000 characters, and the optional hints.
export function parseSpeech(body: unknown): SpeechSpec {
  if (!isObject(body) || typeof body.model !== "string" || body.model.trim() === "" || typeof body.input !== "string") {
    throw badRequest("invalid_tts_request", "Speech requires a model and non-empty input.");
  }
  const input = body.input.trim();
  if (input === "" || input.length > MAX_INPUT_CHARS) throw badRequest("invalid_tts_request", `Speech input must be 1 to ${MAX_INPUT_CHARS} characters.`);
  const options: Record<string, unknown> = {};
  for (const key of ["speed", "instructions", "response_format"] as const) if (body[key] !== undefined) options[key] = body[key];
  return { model: body.model.trim(), input, voice: optionalText(body.voice), language: optionalText(body.language), style: optionalText(body.style), options };
}

interface Resolved {
  readonly route: TtsRoute;
  readonly model: string;
  readonly voice: string;
}

type SpeechRequest = FastifyRequest<{ Querystring: Record<string, string | string[] | undefined> }>;

@Injectable()
export class SpeechLane {
  private readonly logger = new Logger("SpeechLane");
  // Live voice lists per connection and key; a failure is never stored.
  private readonly voiceCache = new Map<string, { at: number; voices: TtsVoice[] }>();

  constructor(
    private readonly settings: SettingsRepository,
    private readonly connections: ConnectionsRepository,
    private readonly refresher: TokenRefresher,
    private readonly combos: CombosRepository,
    private readonly pools: ProxyPoolsRepository,
    @Inject(HTTP_TRANSPORT) private readonly transport: HttpTransportPort,
    @Inject(CHAT_LIMITS) private readonly limits: ChatLimits,
    private readonly usage: UsageRecorder,
  ) {}

  async speech(request: SpeechRequest, reply: FastifyReply): Promise<void> {
    const requestId = randomUUID();
    const startedAt = Date.now();
    const attribution = { endpoint: request.routeOptions.url ?? request.url.split("?", 1)[0], apiKeyId: this.usage.keyOf(request) };
    let errorCode: string | null = null;
    const client = new AbortController();
    reply.raw.once("close", () => { if (!reply.raw.writableFinished) client.abort(new ClientGone()); });
    const budget = deadline(REQUEST_BUDGET_MS, `The request did not finish within ${REQUEST_BUDGET_MS / 1000} s`);
    const signal = AbortSignal.any([client.signal, budget.signal]);
    try {
      if (!(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
        throw new GatewayError(415, "invalid_request_error", "unsupported_media_type", "Send the body as JSON with Content-Type: application/json.");
      }
      const audio = await this.synthesize({ ...parseSpeech(request.body), attribution }, signal, requestId);
      const asJson = request.query.response_format === "json";
      if (asJson || audio.kind === "bytes") {
        const bytes = audio.kind === "bytes" ? audio.bytes : await readAudio(audio.body, MAX_AUDIO_BYTES);
        const format = audio.kind === "bytes" ? audio.format : formatOf(audio.contentType);
        reply.header("cache-control", "no-store").header("x-request-id", requestId);
        return void (asJson
          ? reply.send({ audio: Buffer.from(bytes).toString("base64"), format })
          : reply.header("content-type", audioType(format)).send(Buffer.from(bytes)));
      }
      reply.hijack();
      reply.raw.writeHead(200, {
        "cache-control": "no-store", "content-type": audio.contentType, "x-request-id": requestId, ...(audio.length ? { "content-length": audio.length } : {}),
      });
      if (audio.body) for await (const chunk of audio.body) if (!reply.raw.write(chunk)) await once(reply.raw, "drain", { signal });
      reply.raw.end();
    } catch (error) {
      if (client.signal.aborted || reply.sent) { reply.hijack(); reply.raw.destroy(); return; }
      this.logUnexpected(error, requestId);
      const { status, body } = errorOf(error);
      errorCode = body.error.code;
      if (error instanceof UpstreamReply) {
        return void reply.code(error.status).header("cache-control", "no-store").header("content-type", error.contentType).send(error.raw);
      }
      if (error instanceof GatewayError && error.retryAfter) reply.header("retry-after", Math.max(1, Math.ceil(error.retryAfter / 1000)));
      reply.code(status).header("cache-control", "no-store").send(body);
    } finally {
      budget.clear();
      const clientGone = client.signal.aborted;
      const requestedModel = typeof request.body === "object" && request.body !== null && "model" in request.body && typeof request.body.model === "string" ? request.body.model : null;
      this.usage.finish({ requestId, startedAt, ...attribution, requestedModel, stream: false, httpStatus: clientGone ? 499 : reply.raw.statusCode, errorCode, clientGone });
    }
  }

  // GET /v1/audio/voices?provider=&model=&lang=
  async voiceList(request: SpeechRequest, reply: FastifyReply): Promise<void> {
    const { provider, model, lang } = request.query;
    try {
      const route = typeof provider === "string" ? ttsRoute(provider) : undefined;
      if (!route) throw badRequest("invalid_request_error", `provider must be one of: ${ttsProviders.join(", ")}.`);
      const modelId = typeof model === "string" && model ? model : route.defaultModel;
      const { voices } = await this.voices(route.provider, modelId, AbortSignal.timeout(VOICES_TIMEOUT_MS));
      const wanted = typeof lang === "string" ? lang.toLowerCase() : "";
      const data = voices
        .filter((voice) => !wanted || voice.locale.toLowerCase().split(/[-_]/)[0] === wanted)
        .map((voice) => ({ id: voice.id, name: voice.name, lang: voice.locale, gender: voice.gender, model: `${route.provider}/${modelId}/${voice.id}` }));
      reply.header("cache-control", "no-store").send({ object: "list", data });
    } catch (error) {
      this.logUnexpected(error, "-");
      const { status, body } = errorOf(error);
      reply.code(status).header("cache-control", "no-store").send(body);
    }
  }

  // A provider's voices for one model: its preset catalog, or the account's live list (media.tts-voice-listing).
  async voices(provider: string, model: string, signal: AbortSignal): Promise<{ voices: readonly TtsVoice[]; live: boolean }> {
    if (!ttsModels(provider).some((entry) => entry.id === model)) throw badRequest("invalid_request_error", `${provider}/${model} is not a TTS model.`);
    const source = ttsVoiceSource(provider);
    if (!source) {
      const preset = ttsVoices(provider, model);
      if (preset.length === 0) throw badRequest("invalid_request_error", `${provider}/${model} has no voice catalog.`);
      return { voices: preset, live: false };
    }
    const stored = await this.connections.activeCredential(source.credentialProvider);
    if (!stored) throw new GatewayError(404, "not_found_error", "no_active_connection", `${provider} has no active connection. Add or enable one in AIGate: Providers → Connections.`);
    const key = `${stored.id}:${createHash("sha256").update(stored.apiKey).digest("hex").slice(0, 16)}`;
    const cached = this.voiceCache.get(key);
    if (cached && Date.now() - cached.at < VOICES_TTL_MS) return { voices: cached.voices, live: true };
    const failed = (why: string) => new GatewayError(502, "api_error", "voices_fetch_failed", `Could not load the ${provider} voices: ${why}.`);
    let voices: TtsVoice[];
    try {
      const response = await this.transport.send(source.request(stored.apiKey, VOICES_TIMEOUT_MS), { signal, requestId: randomUUID(), proxy: await this.pools.resolve(stored.proxyPoolId) });
      const raw = await readBoundedText(response.body, MAX_VOICES_JSON);
      if (response.status < 200 || response.status >= 300) throw failed(`HTTP ${response.status}, ${ttsErrorMessage(raw, response.status)}`);
      voices = source.voices(JSON.parse(raw)).slice(0, MAX_VOICES);
    } catch (error) {
      if (error instanceof GatewayError) throw error;
      throw failed(error instanceof EngineError || error instanceof SyntaxError ? error.message : "the request failed");
    }
    this.voiceCache.delete(key);
    this.voiceCache.set(key, { at: Date.now(), voices });
    // ponytail: insertion-order eviction; the oldest list goes first once 64 accounts are cached.
    for (const old of this.voiceCache.keys()) {
      if (this.voiceCache.size <= MAX_CACHED_LISTS) break;
      this.voiceCache.delete(old);
    }
    return { voices, live: true };
  }

  // The model string or combo, through its members and each provider's connections, to audio.
  async synthesize(spec: SpeechSpec, signal: AbortSignal, requestId: string, depth = 0): Promise<SpeechAudio> {
    const combo = spec.model.includes("/") ? undefined : await this.combos.byName(spec.model);
    if (!combo) return this.single(spec, await this.resolve(spec.model, spec.voice), signal, requestId);
    if (depth >= MAX_COMBO_DEPTH) {
      throw badRequest("combo_too_deep", `Combo "${combo.name}" nests combos more than ${MAX_COMBO_DEPTH} deep or reaches itself. Change its members in AIGate: Gateway → Routing.`);
    }
    if (combo.strategy === "fusion") throw badRequest("combo_strategy_unsupported", `Combo "${combo.name}" uses fusion, which cannot judge audio. Use fallback or round-robin for speech.`);
    const members = combo.strategy === "round-robin" ? this.combos.order(combo, (await this.settings.get()).comboStickyLimit) : combo.models;
    let last: unknown;
    let retryAfter: number | undefined;
    // eslint-disable-next-line aigate/retry-through-helper -- each attempt is another member, not an in-place retry.
    for (const [index, model] of members.entries()) {
      try {
        return await this.synthesize({ ...spec, model }, signal, requestId, depth + 1);
      } catch (error) {
        if (signal.aborted) throw error;
        const { status, body } = errorOf(error);
        const waitMs = memberFailover(status, body.error.message);
        if (waitMs === undefined) throw error;
        last = error;
        if (error instanceof GatewayError && error.retryAfter !== undefined) retryAfter = Math.min(retryAfter ?? error.retryAfter, error.retryAfter);
        if (waitMs > 0 && index < members.length - 1) await delay(waitMs, undefined, { signal }).catch(() => signal.throwIfAborted());
      }
    }
    throw exhausted(last, retryAfter);
  }

  // "<provider>/<model>[/<voice>]", or a bare model id the first provider with an active connection declares.
  private async resolve(ref: string, bodyVoice: string | undefined): Promise<Resolved> {
    const slash = ref.indexOf("/");
    const prefix = slash > 0 ? ref.slice(0, slash) : "";
    const providerId = builtinRegistry.provider(prefix)?.id ?? prefix;
    let found: { provider: string; model: string; voice: string };
    if (ttsRoute(providerId)) {
      found = { provider: providerId, ...splitTtsModel(providerId, ref.slice(slash + 1)) };
    } else if (prefix && (builtinRegistry.provider(prefix) || builtinRegistry.status(prefix))) {
      throw badRequest("tts_provider_unsupported", `${prefix} has no text-to-speech route in AIGate.`);
    } else {
      const declaring = ttsProviders.filter((provider) => ttsModels(provider).some((model) => model.id === ref));
      if (declaring.length === 0) throw badRequest("model_not_found", `"${ref}" is not a known TTS model. Use "<provider>/<model>[/<voice>]" such as "openai/gpt-4o-mini-tts/alloy".`);
      const active = await this.connections.activeProviders();
      const provider = declaring.find((id) => active.has(id));
      if (!provider) throw new GatewayError(404, "not_found_error", "no_active_connection", `No active connection serves "${ref}". Add or enable one for ${declaring.join(", ")} in AIGate: Providers → Connections.`);
      found = { provider, model: ref, voice: "" };
    }
    const route = ttsRoute(found.provider)!;
    const voice = bodyVoice ?? (found.voice || route.defaultVoice);
    if (!voice && route.voiceRequired) {
      throw badRequest("invalid_tts_request", `${found.provider} needs a voice: "${found.provider}/${found.model}/<voice id>" or the voice field. GET /v1/audio/voices?provider=${found.provider} lists them.`);
    }
    return { route, model: found.model, voice };
  }

  // Each active connection of the provider in turn, locking tts:<model> on the one that failed (media cooldowns).
  private async single(spec: SpeechSpec, target: Resolved, signal: AbortSignal, requestId: string): Promise<SpeechAudio> {
    const { route } = target;
    const lockKey = `tts:${target.model}`;
    const base = route.auth === "provider" || !route.url ? builtinRegistry.provider(route.provider) : undefined;
    const upstreamModel = builtinRegistry.model(route.provider, target.model)?.upstreamModelId ?? target.model;
    const call: TtsCall = { upstreamModel, voice: target.voice, input: spec.input, language: spec.language, style: spec.style, options: spec.options };
    const excluded = new Set<string>();
    // ponytail: the repository caps a provider at 100 accounts; raise both bounds together.
    // eslint-disable-next-line aigate/retry-through-helper -- candidates change account; this is not an in-place retry.
    for (let attempts = 0; attempts < 100; attempts += 1) {
      const selected = await this.connections.selectActive(route.provider, lockKey, excluded, (await this.settings.get()).fallbackStrategy);
      if (!selected.credential) {
        if (selected.retryAt) throw new GatewayError(503, "api_error", "provider_unavailable", `${route.provider} is temporarily unavailable for ${target.model}.`, selected.retryAt.getTime() - Date.now());
        throw new GatewayError(404, "not_found_error", "no_active_connection", `${route.provider} has no active connection. Add or enable one in AIGate: Providers → Connections.`);
      }
      const stored = await this.refresher.fresh(route.provider, selected.credential);
      const provider = base ? withConnection(base, stored) : undefined;
      const nextAccount = async (cooldown: number | undefined): Promise<boolean> => {
        if (!cooldown || signal.aborted || (await this.connections.activeCount(route.provider)) < 2) return false;
        await this.connections.lock(stored.id, lockKey, new Date(Date.now() + cooldown));
        excluded.add(stored.id);
        return true;
      };
      // docs/contracts/usage.md "Requests": each connection tried is a usage event (no token count for audio).
      const started = Date.now();
      let recorded = false;
      const recordAttempt = (status: "success" | "error", code: string | null) => {
        if (recorded || !spec.attribution) return;
        recorded = true;
        this.usage.record({ requestId, provider: route.provider, model: target.model, connectionId: stored.id, ...spec.attribution },
          { status, errorCode: code, usage: { inputTokens: 0, outputTokens: 0 }, estimated: false, latencyMs: Date.now() - started, ttftMs: null });
      };
      try {
        const proxy = await this.pools.resolve(stored.proxyPoolId);
        const send = (apiKey: string) => this.transport.send(ttsRequest(route, provider, apiKey, call, REQUEST_BUDGET_MS), { signal, requestId, proxy });
        let response = await send(stored.apiKey);
        // media.tts-lane (AIGate, user decision 2026-09-30): an OAuth token the upstream refuses is refreshed once and the
        // request sent again, as on the chat lane. API-key connections have nothing to refresh and skip the retry waits.
        if ((response.status === 401 || response.status === 403) && stored.oauth?.refreshToken && !signal.aborted) {
          await response.body?.cancel().catch(() => undefined);
          const token = await this.refresher.reactive(route.provider, stored, this.limits.refreshRetryDelayMs);
          if (token) response = await send(token);
        }
        if (response.status < 200 || response.status >= 300) {
          const raw = await readBoundedText(response.body, MAX_ERROR_BYTES).catch(() => "");
          recordAttempt("error", `HTTP_${response.status}`);
          if (await nextAccount(mediaCooldown(response.status))) continue;
          throw new UpstreamReply(response.status, raw, response.headers["content-type"] ?? "application/json");
        }
        const audio = await this.decode(route, response, spec.options);
        recordAttempt("success", null);
        await this.connections.clearLock(stored.id, lockKey);
        return audio;
      } catch (error) {
        recordAttempt("error", error instanceof GatewayError ? error.code : error instanceof EngineError ? error.code : "UNKNOWN");
        if (error instanceof GatewayError || !(await nextAccount(fallbackCooldown(error)))) throw error;
      }
    }
    throw new GatewayError(503, "api_error", "provider_unavailable", "No eligible provider account remained.");
  }

  private async decode(route: TtsRoute, response: Awaited<ReturnType<HttpTransportPort["send"]>>, options: SpeechSpec["options"]): Promise<SpeechAudio> {
    const { body, headers } = response;
    if (route.answer === "binary") {
      const requested = route.format === "openai-speech" && typeof options.response_format === "string" ? options.response_format : "mp3";
      return { kind: "stream", body, contentType: headers["content-type"] ?? audioType(requested), length: headers["content-length"] };
    }
    if (route.answer === "sse") {
      // media.tts-openrouter-audio-chunks: each event's base64 is decoded on its own, then the bytes are joined.
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (body) for await (const data of readSseData(body)) {
        const piece = ttsStreamChunk(data);
        if (!piece) continue;
        const bytes = Buffer.from(piece, "base64");
        size += bytes.byteLength;
        if (size > MAX_AUDIO_BYTES) throw tooLarge();
        chunks.push(bytes);
      }
      const audio = Buffer.concat(chunks);
      if (audio.byteLength === 0) throw decodeFailure(`${route.provider} returned no audio.`);
      return { kind: "bytes", bytes: audio.subarray(0, 4).toString("latin1") === "RIFF" ? audio : pcmToWav(audio, 24_000), format: "wav" };
    }
    // base64 is 4/3 of the audio it carries (hex is 2x, so MiniMax's bound is lower), plus the JSON around it.
    const raw = await readBoundedText(body, Math.ceil(MAX_AUDIO_BYTES * 4 / 3) + MAX_ERROR_BYTES);
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw decodeFailure(`${route.provider} answered with invalid JSON.`); }
    let payload: TtsPayload;
    try { payload = ttsJsonAudio(route, parsed); } catch (error) { throw decodeFailure(error instanceof Error ? error.message : `${route.provider} returned no audio.`); }
    const bytes = Buffer.from(payload.data, payload.encoding);
    if (bytes.byteLength > MAX_AUDIO_BYTES) throw tooLarge();
    return { kind: "bytes", bytes: payload.pcmRate ? pcmToWav(bytes, payload.pcmRate) : bytes, format: payload.format };
  }

  private logUnexpected(error: unknown, requestId: string): void {
    if (error instanceof EngineError || error instanceof GatewayError) return;
    this.logger.error(`request ${requestId} failed`, error instanceof Error ? error.stack : String(error));
  }
}
