import { randomUUID } from "node:crypto";
import { BadGatewayException, BadRequestException, Body, Controller, Get, Header, HttpCode, HttpException, NotFoundException, Param, Post, Query, Res, StreamableFile } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { CATALOG, ttsRoute, ttsVoices, type TtsVoice } from "@aigate/engine";
import { GatewayError } from "./chat-lane.js";
import { audioType, readAudio, SpeechLane } from "./speech-lane.js";

// docs/contracts/speech.md "Dashboard API": the voice browser's list and preview, behind the dashboard session.

const SAMPLE = "Hello, this is an AIGate voice preview.";
const VOICES_MS = 15_000;
// The browser waits 20 s, so the server gives up first and its message reaches the user.
const PREVIEW_MS = 15_000;
const MAX_PREVIEW_BYTES = 1024 * 1024;

type Failure = "VOICES_FETCH_FAILED" | "VOICE_PREVIEW_FAILED";

// Lane errors in the dashboard's codes (apps/web/src/shared/errors.ts).
function dashboardError(error: unknown, failure: Failure, fallback: string): HttpException {
  if (error instanceof HttpException) return error;
  if (error instanceof GatewayError) {
    if (error.code === "no_active_connection") return new BadRequestException({ code: "NO_ACTIVE_CONNECTION", message: error.message });
    // An upstream 400 is the provider's failure, not a bad dashboard request.
    if (error.status === 400 && error.code !== "tts_upstream_error") return new BadRequestException({ code: "INVALID_REQUEST", message: error.message });
    return new BadGatewayException({ code: failure, message: error.message });
  }
  return new BadGatewayException({ code: failure, message: fallback });
}

const fieldsOf = (body: unknown): Record<string, unknown> => (body && typeof body === "object" && !Array.isArray(body) ? Object.fromEntries(Object.entries(body)) : {});

@Controller("api/providers")
export class VoicesController {
  constructor(private readonly speech: SpeechLane) {}

  // GET /api/providers/:id/voices?model= → { voices, live }
  @Get(":id/voices")
  @Header("Cache-Control", "no-store")
  async voices(@Param("id") id: string, @Query("model") model = ""): Promise<{ voices: readonly TtsVoice[]; live: boolean }> {
    const catalog = CATALOG.find((item) => item.id === id);
    if (!catalog) throw new NotFoundException({ code: "NOT_FOUND", message: `No provider "${id}" in the catalog` });
    const route = ttsRoute(id);
    if (!route) {
      // Browser-only catalogs (edge-tts, local-device): no route, only the preset list.
      if (!catalog.serviceKinds.includes("tts") || (model && !catalog.models.some((entry) => entry.kind === "tts" && entry.id === model))) {
        throw new BadRequestException({ code: "INVALID_REQUEST", message: "Choose a TTS model from this provider." });
      }
      return { voices: ttsVoices(id, model), live: false };
    }
    try {
      return await this.speech.voices(id, model || route.defaultModel, AbortSignal.timeout(VOICES_MS));
    } catch (error) {
      throw dashboardError(error, "VOICES_FETCH_FAILED", `Could not load the ${catalog.name} voices.`);
    }
  }

  // POST /api/providers/:id/voice-preview { model, voice } → audio, the same synthesis as /v1/audio/speech.
  @Post(":id/voice-preview")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  async preview(@Param("id") id: string, @Body() body: unknown, @Res({ passthrough: true }) reply: FastifyReply): Promise<StreamableFile> {
    const { model, voice } = fieldsOf(body);
    const route = ttsRoute(id);
    if (!route || typeof model !== "string" || typeof voice !== "string" || voice === "") {
      throw new BadRequestException({ code: "INVALID_REQUEST", message: "Choose a previewable TTS model and voice from this provider." });
    }
    const client = new AbortController();
    const onClose = () => client.abort();
    reply.raw.once("close", onClose);
    const signal = AbortSignal.any([client.signal, AbortSignal.timeout(PREVIEW_MS)]);
    const tooLarge = () => new BadGatewayException({ code: "VOICE_PREVIEW_FAILED", message: "The voice preview exceeded 1 MiB." });
    try {
      const { voices } = await this.speech.voices(id, model, signal);
      if (!voices.some((item) => item.id === voice)) throw new BadRequestException({ code: "INVALID_REQUEST", message: `"${voice}" is not a voice of ${id}/${model}.` });
      const options = route.format === "openai-speech" ? { response_format: "mp3" } : {};
      const audio = await this.speech.synthesize({ model: `${id}/${model}`, input: SAMPLE, voice, options }, signal, randomUUID());
      const bytes = audio.kind === "bytes" ? audio.bytes : await readAudio(audio.body, MAX_PREVIEW_BYTES, tooLarge);
      if (bytes.byteLength > MAX_PREVIEW_BYTES) throw tooLarge();
      if (bytes.byteLength === 0) throw new BadGatewayException({ code: "VOICE_PREVIEW_FAILED", message: `${id} returned no audio.` });
      return new StreamableFile(Buffer.from(bytes), { type: audio.kind === "bytes" ? audioType(audio.format) : audio.contentType, disposition: "inline" });
    } catch (error) {
      throw dashboardError(error, "VOICE_PREVIEW_FAILED", signal.aborted ? "The voice preview timed out or was cancelled." : "The voice preview could not be generated.");
    } finally {
      reply.raw.off("close", onClose);
    }
  }
}
