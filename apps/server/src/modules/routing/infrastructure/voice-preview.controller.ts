import { randomUUID } from "node:crypto";
import { BadGatewayException, BadRequestException, Body, Controller, Header, HttpCode, HttpException, Inject, Param, Post, Res, StreamableFile } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { builtinRegistry, CATALOG, ttsVoices, type HttpTransportPort } from "@aigate/engine";
import { ConnectionsRepository } from "../../connections/infrastructure/connections.repo.js";
import { ProxyPoolsRepository } from "../../transport/infrastructure/proxy-pools.repo.js";
import { HTTP_TRANSPORT } from "../../transport/transport.token.js";

const PREVIEW_MS = 15_000;
const MAX_AUDIO_BYTES = 1024 * 1024;

@Controller("api/providers")
export class VoicePreviewController {
  constructor(
    private readonly connections: ConnectionsRepository,
    private readonly pools: ProxyPoolsRepository,
    @Inject(HTTP_TRANSPORT) private readonly transport: HttpTransportPort,
  ) {}

  @Post(":id/voice-preview")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  async preview(@Param("id") id: string, @Body() body: unknown, @Res({ passthrough: true }) reply: FastifyReply): Promise<StreamableFile> {
    const fields = body && typeof body === "object" && !Array.isArray(body) ? Object.fromEntries(Object.entries(body)) : {};
    const model = fields.model;
    const voice = fields.voice;
    const catalog = CATALOG.find((item) => item.id === id);
    if ((id !== "openai" && id !== "openrouter") || typeof model !== "string" || typeof voice !== "string"
      || !catalog?.models.some((item) => item.kind === "tts" && item.id === model)
      || !ttsVoices(id, model).some((item) => item.id === voice)) {
      throw new BadRequestException({ code: "INVALID_REQUEST", message: "Choose a previewable TTS model and voice from this provider." });
    }
    const provider = builtinRegistry.provider(id);
    const endpoint = provider?.chatUrl.replace(/\/chat\/completions(?:\?.*)?$/, "/audio/speech");
    if (!provider || provider.auth.kind !== "api-key" || !endpoint || endpoint === provider.chatUrl) throw new BadRequestException({ code: "INVALID_REQUEST", message: "This provider has no speech endpoint." });
    const credential = await this.connections.activeCredential(id);
    if (!credential) throw new BadRequestException({ code: "NO_ACTIVE_CONNECTION", message: `Add or enable a ${provider.name} connection to hear this voice.` });

    const client = new AbortController();
    const onClose = () => client.abort();
    reply.raw.once("close", onClose);
    const signal = AbortSignal.any([client.signal, AbortSignal.timeout(PREVIEW_MS)]);
    try {
      const upstream = await this.transport.send({
        method: "POST", url: endpoint,
        headers: { ...provider.headers, "content-type": "application/json", [provider.auth.header]: provider.auth.scheme === "raw" ? credential.apiKey : `Bearer ${credential.apiKey}` },
        body: JSON.stringify({ model, voice, input: "Hello, this is an AIGate voice preview.", response_format: "mp3" }), timeoutMs: PREVIEW_MS,
      }, { signal, requestId: randomUUID(), proxy: await this.pools.resolve(credential.proxyPoolId) });
      if (upstream.status < 200 || upstream.status >= 300) {
        await upstream.body?.cancel();
        throw new BadGatewayException({ code: "VOICE_PREVIEW_FAILED", message: `${provider.name} did not generate a preview (HTTP ${upstream.status}).` });
      }
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (upstream.body) for await (const chunk of upstream.body) {
        size += chunk.byteLength;
        if (size > MAX_AUDIO_BYTES) throw new BadGatewayException({ code: "VOICE_PREVIEW_FAILED", message: "The voice preview exceeded 1 MiB." });
        chunks.push(chunk);
      }
      if (size === 0) throw new BadGatewayException({ code: "VOICE_PREVIEW_FAILED", message: `${provider.name} returned no audio.` });
      return new StreamableFile(Buffer.concat(chunks), { type: "audio/mpeg", disposition: "inline" });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadGatewayException({ code: "VOICE_PREVIEW_FAILED", message: signal.aborted ? "The voice preview timed out or was cancelled." : "The voice preview could not be generated." });
    } finally {
      reply.raw.off("close", onClose);
    }
  }
}
