import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { lookup } from "node:dns/promises";
import { once } from "node:events";
import type { ServerResponse } from "node:http";
import { isIP } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import {
  anthropicClientGetsMessage, anthropicRequestFor, AnthropicStreamEncoder, assertModelSupports, builtinRegistry, createAdapter, detectRequiredCapabilities, EngineError, mediaService, readBoundedText,
  estimateAnthropicInputTokens, geminiModelList, GeminiStreamEncoder, geminiTtsRequest, isGeminiTtsRequest, OpenAIChatStreamEncoder,
  parseAnthropicMessagesRequest, parseGeminiGenerateRequest, parseGeminiPath, parseOpenAIChatRequest, parseOpenAIResponsesRequest,
  responsesClientGetsObject, responsesRequestFor, ResponsesStreamEncoder, toAnthropicMessage, toGeminiResponse, toOpenAIChatCompletion, toOpenAIError,
  splitThinkingSuffix, toResponsesObject, UnsupportedFeatureError, withClaudeCodePrompt, withConnection, withThinking, type AIProviderPort, type CanonicalRequest, type CanonicalResponse, type Capability, type Credential,
  type ExecCtx, type GeminiRoute, type HttpTransportPort, type OpenAIError, type ProviderDescriptor, type ProxyConfig, type StreamChunk,
} from "@aigate/engine";
import { SecretUnreadableError } from "../../../secret-cipher.js";
import type { Settings } from "../../settings/domain/settings.js";
import { extractApiKey } from "../../apikeys/domain/api-key.js";
import { CustomModelsRepository } from "../../catalog/infrastructure/custom-models.repo.js";
import { ProviderThinkingRepository } from "../../catalog/infrastructure/provider-thinking.repo.js";
import { ApiKeysRepository } from "../../apikeys/infrastructure/api-keys.repo.js";
import { ConnectionsRepository, type StoredCredential } from "../../connections/infrastructure/connections.repo.js";
import { TokenRefresher } from "../../connections/infrastructure/token-refresher.js";
import { isReservedPrefix, nodeDescriptor, ProviderNodesRepository } from "../../connections/infrastructure/provider-nodes.repo.js";
import { isLocalRequest } from "../../identity/domain/local-request.js";
import { SettingsRepository } from "../../settings/infrastructure/settings.repo.js";
import { HTTP_TRANSPORT } from "../../transport/transport.token.js";
import { ProxyPoolsRepository } from "../../transport/infrastructure/proxy-pools.repo.js";
import { modelFit, needsMedia, reorderByCapabilities, trimHistory, widen, type Widening } from "../domain/capacity.js";
import { applyTokenSaver, headroomInput } from "../domain/token-saver.js";
import { collectPanel, judgeRequest, MAX_COMBO_DEPTH, memberFailover, panelRequest, type Combo } from "../domain/combo.js";
import { CapacityPoolsRepository } from "./capacity-pools.repo.js";
import { CombosRepository } from "./combos.repo.js";
import { PxpipeService } from "./pxpipe.service.js";

// The /v1 chat lane (docs/contracts/chat-lane.md): key gate, parse, resolve, adapter, stream.

export const CHAT_LIMITS = Symbol("CHAT_LIMITS");
export interface ChatLimits {
  // Longest silence allowed between two upstream stream chunks (AIGATE_STREAM_IDLE_TIMEOUT_MS).
  readonly streamIdleTimeoutMs: number;
  // The pause unit between the reactive refresh attempts after a 401/403 (oauth.refresh-lifecycle: 1 s, then 2 s).
  readonly refreshRetryDelayMs: number;
  // The first wait before a custom provider's stream is retried (retryStreamErrors).
  readonly streamRetryDelayMs: number;
}
export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000;
export const DEFAULT_REFRESH_RETRY_DELAY_MS = 1_000;
export const REQUEST_BUDGET_MS = 600_000;
// catalog.model-connectivity-test: 9router's 15 s per probe.
const PROBE_TIMEOUT_MS = 15_000;

// POST /api/models/test (docs/contracts/custom-models.md).
export interface ModelProbe {
  ok: boolean;
  latencyMs: number;
  status: number;
  error: string | null;
  note?: string;
}

// A failure AIGate itself decides, already in OpenAI terms.
export class GatewayError extends Error {
  readonly status: number;
  readonly type: string;
  readonly code: string;

  constructor(status: number, type: string, code: string, message: string, readonly retryAfter?: number) {
    super(message);
    this.status = status;
    this.type = type;
    this.code = code;
  }
}

export class ClientGone extends Error {
  constructor() {
    super("The client closed the connection");
  }
}

export function errorOf(error: unknown): OpenAIError {
  if (error instanceof GatewayError) {
    return { status: error.status, body: { error: { message: error.message, type: error.type, code: error.code, param: null } } };
  }
  if (error instanceof SecretUnreadableError) {
    return errorOf(new GatewayError(500, "server_error", "credential_unreadable",
      "The saved provider key cannot be decrypted, because the AIGate secret key changed. Enter the key again in the dashboard: Providers → Connections."));
  }
  return toOpenAIError(error);
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

// The body stays opaque for forwarding. Only the small model field is read, before any binary file part.
function multipartField(body: Uint8Array, name: string): string | undefined {
  const source = Buffer.from(body).toString("latin1");
  const part = source.indexOf(`name="${name}"`);
  if (part < 0) return undefined;
  const separator = source.indexOf("\r\n\r\n", part);
  const start = separator < 0 ? source.indexOf("\n\n", part) : separator;
  if (start < 0) return undefined;
  const valueStart = start + (separator < 0 ? 2 : 4);
  const end = source.indexOf(separator < 0 ? "\n--" : "\r\n--", valueStart);
  return (end < 0 ? source.slice(valueStart) : source.slice(valueStart, end)).trim();
}

const privateAddress = (address: string): boolean => {
  const normalized = address.toLowerCase();
  if (isIP(normalized) === 6) return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:") || normalized.startsWith("::ffff:127.");
  if (isIP(normalized) !== 4) return true;
  const [a, b] = normalized.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a >= 224;
};

async function publicFetchUrl(raw: string, signal: AbortSignal): Promise<string> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new GatewayError(400, "invalid_request_error", "invalid_url", "Fetch requires a valid public http(s) URL."); }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password || url.hostname === "localhost") {
    throw new GatewayError(400, "invalid_request_error", "invalid_url", "Fetch requires a public http(s) URL without credentials.");
  }
  const direct = isIP(url.hostname);
  const addresses = direct ? [{ address: url.hostname }] : await Promise.race([
    lookup(url.hostname, { all: true, verbatim: true }),
    delay(2_000, undefined, { signal }).then(() => { throw new GatewayError(400, "invalid_request_error", "url_resolution_timeout", "Could not resolve the fetch URL in time."); }),
  ]);
  signal.throwIfAborted();
  if (addresses.length === 0 || addresses.some((entry) => privateAddress(entry.address))) {
    throw new GatewayError(400, "invalid_request_error", "private_url", "Fetch requires a public URL.");
  }
  return url.toString();
}

const text = (value: unknown): string => typeof value === "string" ? value : "";
const records = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter(isObject) : [];

// An abort after `ms` whose reason is a TIMEOUT the client can read, not a bare DOMException.
export function deadline(ms: number, message: string): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new EngineError("TIMEOUT", message, { timeoutMs: ms })), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

// Backpressure: a full socket buffer pauses the lane (and so the upstream read) until it drains.
async function write(raw: ServerResponse, text: string, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  if (text === "" || raw.write(text)) return;
  await once(raw, "drain", { signal });
}

interface Target {
  provider: ProviderDescriptor;
  request: CanonicalRequest;
  credential: Credential;
  // The connection the credential came from (SP16: its oauth token can be refreshed).
  connection: StoredCredential;
  proxy?: ProxyConfig;
}

// The provider answered 401 or 403 (not a key AIGate refused before sending).
const upstreamAuthFailure = (error: unknown): boolean =>
  error instanceof EngineError && error.code === "AUTH_ERROR" && (error.details.status === 401 || error.details.status === 403);

export const mediaCooldown = (status: number): number | undefined =>
  status === 429 ? 2_000 : status === 401 || status === 403 ? 120_000 : status >= 500 ? 30_000 : undefined;

// One client request on its way through the lane, shared by every combo member it reaches.
interface Call {
  readonly parsed: ParsedClientRequest;
  readonly protocol: ClientProtocol;
  readonly reply: FastifyReply;
  readonly requestId: string;
  // Client disconnect and request budget; a fusion panel adds its own close.
  readonly signal: AbortSignal;
  // A fusion panel or judge request: the combo lane changed it, so the client's raw body no longer describes it.
  readonly rewritten: boolean;
  readonly pxpipe: { enabled: boolean; minChars: number; timeoutMs: number };
}

// What the lane does with a resolved target: answer the client, or (a fusion panel member) return the answer.
type Deliver<T> = (target: Target, adapter: AIProviderPort, credential: Credential, call: Call) => Promise<T>;

const answerOf: Deliver<CanonicalResponse> = (target, adapter, credential, call) =>
  adapter.execute(target.request, credential, { signal: call.signal, requestId: call.requestId, proxy: target.proxy });

// combo.mode-fallback, combo.aggregate-status-first-failure (corrected): every member failed, so the last member's error is
// the answer, with the earliest Retry-After any member gave; no active connection anywhere is 503, as 9router's rule.
export function exhausted(last: unknown, retryAfter: number | undefined): Error {
  const { status, body } = errorOf(last);
  const noConnection = last instanceof GatewayError && last.code === "no_active_connection";
  if (!noConnection && retryAfter === undefined && last instanceof Error) return last;
  return noConnection
    ? new GatewayError(503, "api_error", "provider_unavailable", body.error.message, retryAfter)
    : new GatewayError(status, body.error.type, body.error.code, body.error.message, retryAfter);
}

// Only errors caused by an upstream account get another account. Client validation errors are terminal.
export function fallbackCooldown(error: unknown): number | undefined {
  if (!(error instanceof EngineError)) return undefined;
  if (error.code === "AUTH_ERROR") return 120_000;
  if (error.code === "RATE_LIMIT") return 2_000;
  if (error.code === "TIMEOUT" || error.code === "PROVIDER_UNAVAILABLE") return 30_000;
  const status = error.details.status;
  return typeof status === "number" && status >= 500 ? 30_000 : undefined;
}

interface Ids {
  created: number;
  fallbackId: string;
  requestId: string;
}

interface StreamEncoder {
  encode(chunk: StreamChunk): string;
  end(): string;
  fail(error: unknown): string;
}

// A client protocol on the lane: how its body becomes CIP, and how the answer goes back. Errors stay OpenAI-shaped
// for every protocol (9router, kept by user decision 2026-09-27).
interface ClientProtocol {
  parse(body: unknown, accept: string | undefined): ParsedClientRequest;
}

interface ParsedClientRequest {
  readonly request: CanonicalRequest;
  // The request the resolved provider receives (the model already resolved). `rewritten`: see Call.
  prepare(request: CanonicalRequest, provider: ProviderDescriptor, rewritten: boolean): CanonicalRequest;
  respond(response: CanonicalResponse, provider: ProviderDescriptor, ids: Ids): unknown;
  encoder(provider: ProviderDescriptor, ids: Ids & { model: string }): StreamEncoder;
}

// docs/contracts/protocol-openai.md
const OPENAI_CHAT: ClientProtocol = {
  parse(body) {
    const { request, includeUsage } = parseOpenAIChatRequest(body);
    return {
      request,
      prepare: (upstream) => upstream,
      respond: (response, _provider, ids) => toOpenAIChatCompletion(response, ids),
      encoder: (_provider, ids) => new OpenAIChatStreamEncoder({ ...ids, includeUsage }),
    };
  },
};

// docs/contracts/protocol-anthropic.md
const ANTHROPIC_MESSAGES: ClientProtocol = {
  parse(body, accept) {
    const parsed = parseAnthropicMessagesRequest(body, accept);
    const messageId = (ids: Ids) => `msg_${ids.requestId.replaceAll("-", "")}`;
    return {
      request: parsed.request,
      prepare: (upstream, provider) => anthropicRequestFor({ request: upstream, anthropicOnly: parsed.anthropicOnly }, provider),
      respond: (response, provider, ids) => (anthropicClientGetsMessage(provider) ? toAnthropicMessage(response, messageId(ids)) : toOpenAIChatCompletion(response, ids)),
      encoder: (_provider, ids) => new AnthropicStreamEncoder({ fallbackId: messageId(ids), model: ids.model }),
    };
  },
};

// docs/contracts/protocol-responses.md
const OPENAI_RESPONSES: ClientProtocol = {
  parse(body, accept) {
    const parsed = parseOpenAIResponsesRequest(body, accept);
    return {
      request: parsed.request,
      // A combo-rewritten request (fusion panel, judge) no longer matches the client's body, so a Responses provider gets
      // it converted from CIP instead of the body passed through.
      prepare: (upstream, provider, rewritten) => (rewritten && provider.protocol === "openai-responses" ? upstream : responsesRequestFor(parsed, upstream, provider)),
      respond: (response, provider, ids) => (responsesClientGetsObject(provider) ? toResponsesObject(response, ids, parsed.customTools) : toOpenAIChatCompletion(response, ids)),
      encoder: (provider, ids) => new ResponsesStreamEncoder({ ...ids, customTools: parsed.customTools, deferCompleted: provider.protocol === "openai-compatible" }),
    };
  },
};

// docs/contracts/protocol-gemini.md: the model and the stream decision come from the URL, the rest of the chat path is the
// OpenAI one (9router hands the converted body to handleChat).
const geminiGenerate = (route: GeminiRoute): ClientProtocol => ({
  parse(body) {
    return {
      request: parseGeminiGenerateRequest(body, route),
      prepare: (upstream) => upstream,
      respond: (response, _provider, ids) => toGeminiResponse(response, ids, route.model),
      encoder: (provider, ids) => new GeminiStreamEncoder({ model: ids.model, usageOnFinish: provider.protocol !== "openai-compatible" }),
    };
  },
});

// A Gemini client's own key convention, read only on the TTS passthrough (9router).
export type GeminiRequest = FastifyRequest<{ Params: { "*": string }; Querystring: Record<string, string | string[] | undefined> }>;
function googleKey(request: GeminiRequest): string | undefined {
  const header = request.headers["x-goog-api-key"];
  const query = request.query.key;
  return (typeof header === "string" && header) || (typeof query === "string" && query) || undefined;
}

const claudeCodePrompt = (request: CanonicalRequest, provider: ProviderDescriptor): CanonicalRequest =>
  (provider.quirks?.includes("claudeCode") ? withClaudeCodePrompt(request) : request);

const MISSING_KEY = "Missing API key. Send Authorization: Bearer <key>, using a key from AIGate: Gateway → Endpoint & Keys.";

// routing.responses-compact-lane: the same lane with _compact set in the body, which only a Responses provider or a
// chat body carries upstream (9router, kept).
const OPENAI_RESPONSES_COMPACT: ClientProtocol = {
  parse: (body, accept) => OPENAI_RESPONSES.parse(typeof body === "object" && body !== null && !Array.isArray(body) ? { ...body, _compact: true } : body, accept),
};

@Injectable()
export class ChatLane {
  private readonly logger = new Logger("ChatLane");

  constructor(
    private readonly settings: SettingsRepository,
    private readonly keys: ApiKeysRepository,
    private readonly connections: ConnectionsRepository,
    private readonly nodes: ProviderNodesRepository,
    private readonly customModels: CustomModelsRepository,
    private readonly thinking: ProviderThinkingRepository,
    private readonly pools: ProxyPoolsRepository,
    private readonly refresher: TokenRefresher,
    private readonly combos: CombosRepository,
    private readonly capacity: CapacityPoolsRepository,
    private readonly pxpipe: PxpipeService,
    @Inject(HTTP_TRANSPORT) private readonly transport: HttpTransportPort,
    @Inject(CHAT_LIMITS) private readonly limits: ChatLimits,
  ) {}

  // onRequest hook: runs before the body is read, so an unauthenticated caller costs one lookup at most.
  async authorize(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | undefined> {
    const { requireApiKey } = await this.settings.get();
    const failure = requireApiKey ? await this.checkKey(extractApiKey(request.headers)) : this.checkLocal(request);
    return failure ? this.fail(reply, failure) : undefined;
  }

  chat(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    return this.serve(request, reply, OPENAI_CHAT);
  }

  // POST /v1/messages: Anthropic clients (Claude Code, the Anthropic SDK).
  messages(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    return this.serve(request, reply, ANTHROPIC_MESSAGES);
  }

  // POST /v1/responses (and /responses, /codex/*): Responses clients (Codex CLI, the OpenAI SDK).
  responses(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    return this.serve(request, reply, OPENAI_RESPONSES);
  }

  responsesCompact(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    return this.serve(request, reply, OPENAI_RESPONSES_COMPACT);
  }

  // onRequest for POST /v1beta/models/*: which key counts depends on the body (the TTS passthrough also reads
  // x-goog-api-key and ?key=), so here only a request with no key at all is refused; the handler checks the key.
  async authorizeGemini(request: GeminiRequest, reply: FastifyReply): Promise<FastifyReply | undefined> {
    const { requireApiKey } = await this.settings.get();
    if (!requireApiKey) {
      const failure = this.checkLocal(request);
      return failure ? this.fail(reply, failure) : undefined;
    }
    if (extractApiKey(request.headers) || googleKey(request)) return undefined;
    return this.fail(reply, new GatewayError(401, "invalid_request_error", "missing_api_key", MISSING_KEY));
  }

  // GET /v1beta/models (catalog.v1beta-models-listing): the whole catalog, without a key, as in 9router.
  geminiModels(reply: FastifyReply): FastifyReply {
    return reply.header("cache-control", "no-store").send(geminiModelList());
  }

  // POST /v1beta/models/{model}:generateContent | :streamGenerateContent (docs/contracts/protocol-gemini.md).
  async gemini(request: GeminiRequest, reply: FastifyReply): Promise<void> {
    const route = parseGeminiPath(request.params["*"]);
    const { requireApiKey } = await this.settings.get();
    if (isGeminiTtsRequest(route, request.body)) return this.geminiTts(request, reply, route, requireApiKey);
    // The chat path reads the key as every /v1 lane does (Authorization, then x-api-key).
    const failure = requireApiKey ? await this.checkKey(extractApiKey(request.headers)) : undefined;
    if (failure) {
      this.fail(reply, failure);
      return;
    }
    return this.serve(request, reply, geminiGenerate(route));
  }

  // POST /v1/messages/count_tokens (routing.count-tokens-estimate): a local estimate, no provider is called.
  countTokens(request: FastifyRequest, reply: FastifyReply): FastifyReply {
    return reply.header("cache-control", "no-store").send({ input_tokens: estimateAnthropicInputTokens(request.body) });
  }

  // SP22: OpenAI-compatible embedding providers share the chat connection, proxy, and credential lifecycle.
  async embeddings(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const requestId = randomUUID();
    const client = new AbortController();
    reply.raw.once("close", () => { if (!reply.raw.writableFinished) client.abort(new ClientGone()); });
    const budget = deadline(REQUEST_BUDGET_MS, `The request did not finish within ${REQUEST_BUDGET_MS / 1000} s`);
    const signal = AbortSignal.any([client.signal, budget.signal]);
    try {
      if (!(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
        throw new GatewayError(415, "invalid_request_error", "unsupported_media_type", "Send the body as JSON with Content-Type: application/json.");
      }
      const body = request.body;
      if (!isObject(body) || typeof body.model !== "string"
        || !(typeof body.input === "string" || (Array.isArray(body.input) && body.input.every((item) => typeof item === "string")))) {
        throw new GatewayError(400, "invalid_request_error", "invalid_embedding_request", "Embeddings require a model and string or string-array input.");
      }
      const input: Record<string, unknown> = { model: body.model, input: body.input };
      for (const key of ["encoding_format", "dimensions", "user"] as const) if (body[key] !== undefined) input[key] = body[key];
      const target = await this.resolve({ model: body.model, messages: [], stream: false }, new Set(), "embedding");
      const model = builtinRegistry.model(target.provider.id, target.request.model);
      if (target.provider.auth.kind !== "api-key") throw new GatewayError(400, "invalid_request_error", "embedding_provider_unsupported", `${target.provider.name} has no supported embedding authentication.`);
      let endpoint: string;
      let payload: Record<string, unknown>;
      if (target.provider.protocol === "openai-compatible") {
        endpoint = target.provider.chatUrl.replace(/\/chat\/completions(?:\?.*)?$/, "/embeddings");
        if (endpoint === target.provider.chatUrl) throw new GatewayError(400, "invalid_request_error", "embedding_provider_unsupported", `${target.provider.name} has no configured embeddings endpoint.`);
        payload = { ...input, model: model?.upstreamModelId ?? target.request.model };
      } else if (target.provider.protocol === "gemini") {
        const modelId = model?.upstreamModelId ?? target.request.model;
        const geminiModel = modelId.startsWith("models/") ? modelId : `models/${modelId}`;
        endpoint = `${target.provider.chatUrl.replace(/\/models$/, "")}/${geminiModel}:${Array.isArray(body.input) ? "batchEmbedContents" : "embedContent"}`;
        const dimensions = typeof body.dimensions === "number" && Number.isFinite(body.dimensions) && body.dimensions > 0 ? { outputDimensionality: body.dimensions } : {};
        payload = Array.isArray(body.input)
          ? { requests: body.input.map((text) => ({ model: geminiModel, content: { parts: [{ text }] }, ...dimensions })) }
          : { model: geminiModel, content: { parts: [{ text: body.input }] }, ...dimensions };
      } else throw new GatewayError(400, "invalid_request_error", "embedding_provider_unsupported", `${target.provider.name} has no supported embeddings endpoint.`);
      const headers = { ...target.provider.headers, "content-type": "application/json", [target.provider.auth.header]: target.provider.auth.scheme === "raw" ? target.credential.apiKey : `Bearer ${target.credential.apiKey}` };
      const upstream = await this.transport.send({ method: "POST", url: endpoint, headers, body: JSON.stringify(payload), timeoutMs: REQUEST_BUDGET_MS }, {
        signal, requestId, proxy: target.proxy,
      });
      const text = await readBoundedText(upstream.body, 16 * 1024 * 1024);
      if (upstream.status >= 200 && upstream.status < 300 && target.provider.protocol === "gemini") {
        const result: unknown = JSON.parse(text);
        const rows = isObject(result) && Array.isArray(result.embeddings) ? result.embeddings.filter(isObject)
          : isObject(result) && isObject(result.embedding) ? [result.embedding] : [];
        return void reply.code(upstream.status).header("cache-control", "no-store").send({
          object: "list", model: target.request.model,
          data: rows.map((row, index) => ({ object: "embedding", index, embedding: Array.isArray(row.values) ? row.values : [] })),
          usage: { prompt_tokens: 0, total_tokens: 0 },
        });
      }
      reply.code(upstream.status).header("cache-control", "no-store").header("content-type", upstream.headers["content-type"] ?? "application/json").send(text);
    } catch (error) {
      if (client.signal.aborted) { reply.hijack(); reply.raw.destroy(); return; }
      this.logUnexpected(error, requestId);
      const { status, body } = errorOf(error);
      reply.code(status).header("cache-control", "no-store").send(body);
    } finally {
      budget.clear();
    }
  }

  // SP22: OpenAI-compatible image generation, with the same bounded connection lifecycle as embeddings.
  async imageGeneration(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const requestId = randomUUID();
    const client = new AbortController();
    reply.raw.once("close", () => { if (!reply.raw.writableFinished) client.abort(new ClientGone()); });
    const budget = deadline(REQUEST_BUDGET_MS, `The request did not finish within ${REQUEST_BUDGET_MS / 1000} s`);
    const signal = AbortSignal.any([client.signal, budget.signal]);
    try {
      const body = request.body;
      if (!(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
        throw new GatewayError(415, "invalid_request_error", "unsupported_media_type", "Send the body as JSON with Content-Type: application/json.");
      }
      if (!isObject(body) || typeof body.model !== "string" || typeof body.prompt !== "string" || body.prompt.trim() === "") {
        throw new GatewayError(400, "invalid_request_error", "invalid_image_request", "Image generation requires a model and non-empty prompt.");
      }
      const target = await this.resolve({ model: body.model, messages: [], stream: false }, new Set(), "image");
      if (target.provider.protocol !== "openai-compatible" || target.provider.auth.kind !== "api-key") {
        throw new GatewayError(400, "invalid_request_error", "image_provider_unsupported", `${target.provider.name} does not have an OpenAI-compatible image endpoint.`);
      }
      const endpoint = target.provider.chatUrl.replace(/\/chat\/completions(?:\?.*)?$/, "/images/generations");
      if (endpoint === target.provider.chatUrl) throw new GatewayError(400, "invalid_request_error", "image_provider_unsupported", `${target.provider.name} has no configured image endpoint.`);
      const descriptor = builtinRegistry.model(target.provider.id, target.request.model);
      const upstreamBody: Record<string, unknown> = { model: descriptor?.upstreamModelId ?? target.request.model, prompt: body.prompt };
      for (const key of ["n", "size", "quality", "style", "response_format"] as const) if (body[key] !== undefined) upstreamBody[key] = body[key];
      const headers = { ...target.provider.headers, "content-type": "application/json", [target.provider.auth.header]: target.provider.auth.scheme === "raw" ? target.credential.apiKey : `Bearer ${target.credential.apiKey}` };
      const upstream = await this.transport.send({ method: "POST", url: endpoint, headers, body: JSON.stringify(upstreamBody), timeoutMs: REQUEST_BUDGET_MS }, {
        signal, requestId, proxy: target.proxy,
      });
      const text = await readBoundedText(upstream.body, 16 * 1024 * 1024);
      reply.code(upstream.status).header("cache-control", "no-store").header("content-type", upstream.headers["content-type"] ?? "application/json").send(text);
    } catch (error) {
      if (client.signal.aborted) { reply.hijack(); reply.raw.destroy(); return; }
      this.logUnexpected(error, requestId);
      const { status, body } = errorOf(error);
      reply.code(status).header("cache-control", "no-store").send(body);
    } finally {
      budget.clear();
    }
  }

  // SP22: multipart stays byte-for-byte intact for Whisper-compatible upstreams; Fastify caps it at the route boundary.
  async transcription(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const contentType = request.headers["content-type"];
    const body = request.body;
    if (typeof contentType !== "string" || !contentType.toLowerCase().startsWith("multipart/form-data") || !Buffer.isBuffer(body)) {
      return void this.fail(reply, new GatewayError(415, "invalid_request_error", "unsupported_media_type", "Send transcription as multipart/form-data."));
    }
    const model = multipartField(body, "model");
    if (!model || !multipartField(body, "file")) return void this.fail(reply, new GatewayError(400, "invalid_request_error", "invalid_transcription_request", "Transcription requires model and file multipart fields."));
    const requestId = randomUUID();
    const client = new AbortController();
    reply.raw.once("close", () => { if (!reply.raw.writableFinished) client.abort(new ClientGone()); });
    const budget = deadline(REQUEST_BUDGET_MS, `The request did not finish within ${REQUEST_BUDGET_MS / 1000} s`);
    try {
      const target = await this.resolve({ model, messages: [], stream: false }, new Set(), "stt");
      if (target.provider.protocol !== "openai-compatible" || target.provider.auth.kind !== "api-key") {
        throw new GatewayError(400, "invalid_request_error", "stt_provider_unsupported", `${target.provider.name} does not have an OpenAI-compatible transcription endpoint.`);
      }
      const endpoint = target.provider.chatUrl.replace(/\/chat\/completions(?:\?.*)?$/, "/audio/transcriptions");
      if (endpoint === target.provider.chatUrl) throw new GatewayError(400, "invalid_request_error", "stt_provider_unsupported", `${target.provider.name} has no configured transcription endpoint.`);
      const headers = { ...target.provider.headers, "content-type": contentType, [target.provider.auth.header]: target.provider.auth.scheme === "raw" ? target.credential.apiKey : `Bearer ${target.credential.apiKey}` };
      const upstream = await this.transport.send({ method: "POST", url: endpoint, headers, body, timeoutMs: REQUEST_BUDGET_MS }, {
        signal: AbortSignal.any([client.signal, budget.signal]), requestId, proxy: target.proxy,
      });
      const text = await readBoundedText(upstream.body, 16 * 1024 * 1024);
      reply.code(upstream.status).header("cache-control", "no-store").header("content-type", upstream.headers["content-type"] ?? "application/json").send(text);
    } catch (error) {
      if (client.signal.aborted) { reply.hijack(); reply.raw.destroy(); return; }
      this.logUnexpected(error, requestId);
      const { status, body: response } = errorOf(error);
      reply.code(status).header("cache-control", "no-store").send(response);
    } finally {
      budget.clear();
    }
  }

  // SP22: dedicated search APIs normalize their varied payloads into one bounded result envelope.
  async search(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = request.body;
    if (!isObject(body) || typeof body.query !== "string" || body.query.trim() === "" || body.query.length > 8_192) {
      return void this.fail(reply, new GatewayError(400, "invalid_request_error", "invalid_search_request", "Search requires a query up to 8192 characters."));
    }
    const providerId = typeof body.provider === "string" ? body.provider : typeof body.model === "string" ? body.model : "";
    const service = mediaService(providerId);
    if (!service?.search) return void this.fail(reply, new GatewayError(400, "invalid_request_error", "search_provider_unsupported", `Provider "${providerId}" does not support dedicated web search.`));
    const maxResults = typeof body.max_results === "number" && Number.isInteger(body.max_results) ? body.max_results : 5;
    if (maxResults < 1 || maxResults > 20) return void this.fail(reply, new GatewayError(400, "invalid_request_error", "invalid_search_request", "max_results must be an integer from 1 to 20."));
    const requestId = randomUUID();
    const started = Date.now();
    const client = new AbortController();
    reply.raw.once("close", () => { if (!reply.raw.writableFinished) client.abort(new ClientGone()); });
    const budget = deadline(15_000, "The search provider did not respond within 15 s");
    const signal = AbortSignal.any([client.signal, budget.signal]);
    try {
      const query = body.query.normalize("NFKC").trim().replace(/\s+/g, " ");
      if (!query) throw new GatewayError(400, "invalid_request_error", "invalid_search_request", "Query is empty after normalization.");
      const type = body.search_type === "news" ? "news" : "web";
      let url = service.search.url;
      let payload: Record<string, unknown> | undefined;
      if (service.search.format === "brave") {
        const params = new URLSearchParams({ q: query, count: String(maxResults) });
        url += `${type === "news" ? "/news/search" : "/web/search"}?${params}`;
      } else if (service.search.format === "serper") { url += type === "news" ? "/news" : "/search"; payload = { q: query, num: maxResults }; }
      else if (service.search.format === "linkup") payload = { q: query, depth: "standard", outputType: "searchResults", maxResults };
      else if (service.search.format === "searchapi") url += `?${new URLSearchParams({ engine: type === "news" ? "google_news" : "google", q: query, api_key: "__key__" })}`;
      else if (service.search.format === "youcom") url += `?${new URLSearchParams({ query, count: String(maxResults) })}`;
      else if (service.search.format === "xquik") url += `?${new URLSearchParams({ q: query, limit: String(maxResults) })}`;
      else if (service.search.format === "glm") payload = { jsonrpc: "2.0", id: requestId, method: "tools/call", params: { name: "web_search_prime", arguments: { search_query: query, count: maxResults } } };
      else if (service.search.format === "tavily") payload = { query, max_results: maxResults, topic: type === "news" ? "news" : "general" };
      else if (service.search.format === "exa") payload = { query, numResults: maxResults, type: "auto", text: true, highlights: true, ...(type === "news" ? { category: "news" } : {}) };
      else payload = { query, max_results: maxResults };
      const { status, raw } = await this.mediaResponse(service.id, `websearch:${service.id}`, requestId, signal, (target) => {
        const key = target.credential.apiKey;
        const auth: Record<string, string> = service.authHeader === "authorization" ? { authorization: `Bearer ${key}` } : { [service.authHeader]: key };
        const searchUrl = service.search!.format === "searchapi" ? url.replace("__key__", encodeURIComponent(key)) : url;
        return this.transport.send({ method: ["brave", "searchapi", "youcom", "xquik"].includes(service.search!.format) ? "GET" : "POST", url: searchUrl,
          headers: { accept: "application/json", ...auth, ...(payload ? { "content-type": "application/json" } : {}) }, ...(payload ? { body: JSON.stringify(payload) } : {}), timeoutMs: 15_000 }, { signal, requestId, proxy: target.proxy });
      });
      if (status < 200 || status >= 300) return void reply.code(status).header("cache-control", "no-store").send(raw);
      const parsed: unknown = JSON.parse(raw);
      const root = isObject(parsed) ? parsed : {};
      let normalized = root;
      if (service.search.format === "glm") {
        const content = isObject(root.result) ? records(root.result.content)[0] : undefined;
        try {
          const parsedContent: unknown = typeof content?.text === "string" ? JSON.parse(content.text) : root;
          normalized = isObject(parsedContent) ? parsedContent : {};
        } catch { normalized = {}; }
      }
      const source = service.search.format === "brave" ? records(isObject(root[type]) ? root[type].results : undefined)
        : service.search.format === "serper" ? records(root[type === "news" ? "news" : "organic"])
        : service.search.format === "searchapi" ? records(root[type === "news" ? "top_stories" : "organic_results"])
        : service.search.format === "youcom" ? records(isObject(root.results) ? root.results[type === "news" ? "news" : "web"] : undefined)
        : service.search.format === "xquik" ? records(root.tweets)
        : records(normalized.results).length > 0 ? records(normalized.results) : records(normalized.news);
      const results = source.slice(0, maxResults).map((item, index) => ({
        title: service.search?.format === "xquik" ? `${text(isObject(item.author) ? item.author.username : undefined) || "X"} on X` : text(item.title) || text(item.name),
        url: service.search?.format === "xquik" ? `https://x.com/${encodeURIComponent(text(isObject(item.author) ? item.author.username : ""))}/status/${encodeURIComponent(text(item.id))}` : text(item.url) || text(item.link),
        snippet: service.search?.format === "brave" ? text(item.description) : text(item.content) || text(item.snippet) || text(item.description) || text(Array.isArray(item.highlights) ? item.highlights[0] : undefined) || text(item.text),
        position: index + 1, score: typeof item.score === "number" ? Math.max(0, Math.min(1, item.score)) : null,
      }));
      reply.header("cache-control", "no-store").send({ provider: service.id, query, results, answer: null, usage: { queries_used: 1 }, metrics: { response_time_ms: Date.now() - started, total_results_available: results.length }, errors: [] });
    } catch (error) {
      if (client.signal.aborted) { reply.hijack(); reply.raw.destroy(); return; }
      this.logUnexpected(error, requestId);
      const { status, body: response } = errorOf(error);
      reply.code(status).header("cache-control", "no-store").send(response);
    } finally { budget.clear(); }
  }

  // SP22: the requested page is checked before a remote extraction provider is asked to fetch it.
  async webFetch(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = request.body;
    const providerId = isObject(body) ? (typeof body.provider === "string" ? body.provider : typeof body.model === "string" ? body.model : "") : "";
    const service = mediaService(providerId);
    if (!isObject(body) || typeof body.url !== "string" || !service?.fetch) return void this.fail(reply, new GatewayError(400, "invalid_request_error", "invalid_fetch_request", "Fetch requires a supported provider and URL."));
    const maxCharacters = typeof body.max_characters === "number" && Number.isInteger(body.max_characters) ? body.max_characters : 100_000;
    if (maxCharacters < 1 || maxCharacters > 200_000) return void this.fail(reply, new GatewayError(400, "invalid_request_error", "invalid_fetch_request", "max_characters must be an integer from 1 to 200000."));
    const requestId = randomUUID();
    const started = Date.now();
    const client = new AbortController();
    reply.raw.once("close", () => { if (!reply.raw.writableFinished) client.abort(new ClientGone()); });
    const budget = deadline(30_000, "The fetch provider did not respond within 30 s");
    const signal = AbortSignal.any([client.signal, budget.signal]);
    try {
      const url = await publicFetchUrl(body.url, signal);
      const format = body.format === "html" || body.format === "text" ? body.format : "markdown";
      const payload = service.fetch.format === "firecrawl" ? { url, formats: [format] }
        : service.fetch.format === "jina" ? { url }
        : service.fetch.format === "tavily" ? { urls: [url], extract_depth: "basic" }
        : service.fetch.format === "exa" ? { ids: [url], text: true }
        : { url, format };
      const { status, raw } = await this.mediaResponse(service.id, `webfetch:${service.id}`, requestId, signal, (target) => {
        const key = target.credential.apiKey;
        const auth: Record<string, string> = service.authHeader === "authorization" ? { authorization: `Bearer ${key}` } : { [service.authHeader]: key };
        return this.transport.send({ method: "POST", url: service.fetch!.url, headers: { "content-type": "application/json", ...auth }, body: JSON.stringify(payload), timeoutMs: 30_000 }, { signal, requestId, proxy: target.proxy });
      });
      if (status < 200 || status >= 300) return void reply.code(status).header("cache-control", "no-store").send(raw);
      const parsed: unknown = service.fetch.format === "jina" ? raw : JSON.parse(raw);
      const root = isObject(parsed) ? parsed : {};
      const textBody = service.fetch.format === "jina" ? raw : service.fetch.format === "firecrawl" ? text(isObject(root.data) ? root.data.markdown : undefined) || text(isObject(root.data) ? root.data.html : undefined)
        : service.fetch.format === "tavily" ? text(isObject(records(root.results)[0]) ? records(root.results)[0].raw_content : undefined)
        : service.fetch.format === "exa" ? text(records(root.results)[0]?.text) : text(root.content);
      reply.header("cache-control", "no-store").send({ provider: service.id, url, title: null, content: { format, text: textBody.slice(0, maxCharacters), length: Math.min(textBody.length, maxCharacters) }, links: [], metrics: { response_time_ms: Date.now() - started } });
    } catch (error) {
      if (client.signal.aborted) { reply.hijack(); reply.raw.destroy(); return; }
      this.logUnexpected(error, requestId);
      const { status, body: response } = errorOf(error);
      reply.code(status).header("cache-control", "no-store").send(response);
    } finally { budget.clear(); }
  }

  // SP22: xAI's asynchronous video jobs. Other catalog video entries lack a usable video endpoint (matrix records that bug).
  async videoCreate(request: FastifyRequest<{ Params: { action: string } }>, reply: FastifyReply): Promise<void> {
    const action = request.params.action;
    const body = request.body;
    if (!["generations", "edits", "extensions"].includes(action)) return void this.fail(reply, new GatewayError(404, "invalid_request_error", "not_found", "Unknown video action."));
    if (!(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json") || !isObject(body) || typeof body.model !== "string") {
      return void this.fail(reply, new GatewayError(400, "invalid_request_error", "invalid_video_request", "Video generation requires a JSON body with a model."));
    }
    const requestId = randomUUID();
    const client = new AbortController();
    reply.raw.once("close", () => { if (!reply.raw.writableFinished) client.abort(new ClientGone()); });
    const budget = deadline(120_000, "The video upstream did not respond within 120 s");
    const signal = AbortSignal.any([client.signal, budget.signal]);
    try {
      const target = await this.resolve({ model: body.model, messages: [], stream: false }, new Set(), "video");
      if (target.provider.id !== "xai" || target.provider.auth.kind !== "api-key") {
        throw new GatewayError(400, "invalid_request_error", "video_provider_unsupported", `${target.provider.name} does not have a supported video endpoint.`);
      }
      const headers = {
        ...target.provider.headers, "content-type": "application/json", [target.provider.auth.header]: target.provider.auth.scheme === "raw" ? target.credential.apiKey : `Bearer ${target.credential.apiKey}`,
        ...(typeof request.headers["idempotency-key"] === "string" ? { "idempotency-key": request.headers["idempotency-key"] } : {}),
      };
      const upstream = await this.transport.send({ method: "POST", url: target.provider.chatUrl.replace(/\/chat\/completions(?:\?.*)?$/, `/videos/${action}`), headers,
        body: JSON.stringify({ ...body, model: target.request.model }), timeoutMs: 120_000 }, { signal, requestId, proxy: target.proxy });
      const text = await readBoundedText(upstream.body, 16 * 1024 * 1024);
      reply.code(upstream.status).header("cache-control", "no-store").header("content-type", upstream.headers["content-type"] ?? "application/json")
        .header("x-aigate-connection-id", target.connection.id).send(text);
    } catch (error) {
      if (client.signal.aborted) { reply.hijack(); reply.raw.destroy(); return; }
      this.logUnexpected(error, requestId);
      const { status, body: response } = errorOf(error);
      reply.code(status).header("cache-control", "no-store").send(response);
    } finally {
      budget.clear();
    }
  }

  async videoGet(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const id = request.params.id;
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) return void this.fail(reply, new GatewayError(400, "invalid_request_error", "invalid_video_id", "Invalid video request id."));
    const requestId = randomUUID();
    const client = new AbortController();
    reply.raw.once("close", () => { if (!reply.raw.writableFinished) client.abort(new ClientGone()); });
    const budget = deadline(120_000, "The video upstream did not respond within 120 s");
    const signal = AbortSignal.any([client.signal, budget.signal]);
    try {
      const pinned = request.headers["x-aigate-connection-id"];
      const stored = typeof pinned === "string" ? await this.connections.activeCredentialById("xai", pinned) : await this.connections.activeCredential("xai");
      if (!stored) throw new GatewayError(404, "not_found_error", "no_active_connection", "xAI has no active connection for video polling.");
      const base = builtinRegistry.provider("xai");
      if (!base || base.auth.kind !== "api-key") throw new GatewayError(500, "server_error", "video_provider_unavailable", "xAI video is not configured.");
      const auth = base.auth;
      const fresh = await this.refresher.fresh("xai", stored);
      const provider = withConnection(base, fresh);
      const headers = { ...provider.headers, [auth.header]: auth.scheme === "raw" ? fresh.apiKey : `Bearer ${fresh.apiKey}` };
      const upstream = await this.transport.send({ method: "GET", url: provider.chatUrl.replace(/\/chat\/completions(?:\?.*)?$/, `/videos/${encodeURIComponent(id)}`), headers, timeoutMs: 120_000 }, {
        signal, requestId, proxy: await this.pools.resolve(fresh.proxyPoolId),
      });
      const text = await readBoundedText(upstream.body, 16 * 1024 * 1024);
      reply.code(upstream.status).header("cache-control", "no-store").header("content-type", upstream.headers["content-type"] ?? "application/json")
        .header("x-aigate-connection-id", fresh.id).send(text);
    } catch (error) {
      if (client.signal.aborted) { reply.hijack(); reply.raw.destroy(); return; }
      this.logUnexpected(error, requestId);
      const { status, body } = errorOf(error);
      reply.code(status).header("cache-control", "no-store").send(body);
    } finally {
      budget.clear();
    }
  }

  private async serve(request: FastifyRequest, reply: FastifyReply, protocol: ClientProtocol): Promise<void> {
    const requestId = randomUUID();
    const client = new AbortController();
    reply.raw.once("close", () => {
      if (!reply.raw.writableFinished) client.abort(new ClientGone());
    });
    reply.header("x-request-id", requestId);
    const budget = deadline(REQUEST_BUDGET_MS, `The request did not finish within ${REQUEST_BUDGET_MS / 1000} s`);
    try {
      // Checked here too: Fastify also parses text/plain, and only JSON may reach the lane.
      if (!(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
        throw new GatewayError(415, "invalid_request_error", "unsupported_media_type", "Send the body as JSON with Content-Type: application/json.");
      }
      const accept = request.headers.accept;
      const parsed = protocol.parse(request.body, typeof accept === "string" ? accept : undefined);
      const settings = await this.settings.get();
      const tokenHeader = request.headers["x-aigate-token-saver"];
      const tokenSaverOptOut = typeof tokenHeader === "string" && tokenHeader.toLowerCase() === "off";
      const savedRequest = await applyTokenSaver(
        parsed.request, settings, tokenSaverOptOut,
        (body, config, signal) => this.headroom(body, config, signal, requestId), AbortSignal.any([client.signal, budget.signal]),
      );
      const ids = { created: Math.floor(Date.now() / 1000), fallbackId: `chatcmpl-${requestId.replaceAll("-", "")}`, requestId };
      const call: Call = {
        parsed, protocol, reply, requestId, signal: AbortSignal.any([client.signal, budget.signal]), rewritten: savedRequest !== parsed.request,
        pxpipe: { enabled: settings.tokenSaverEnabled && settings.pxpipeEnabled && !tokenSaverOptOut, minChars: settings.pxpipeMinChars, timeoutMs: settings.pxpipeTimeoutMs },
      };
      await this.route(call, savedRequest, async (target, adapter, credential) => {
        if (!target.request.stream) {
          const response = await answerOf(target, adapter, credential, call);
          reply.code(200).header("cache-control", "no-store").send(parsed.respond(response, target.provider, ids));
          return;
        }
        await this.stream(reply, adapter, { ...target, credential }, parsed.encoder(target.provider, { ...ids, model: target.request.model }), ids.requestId, client, budget.signal);
      });
    } catch (error) {
      if (client.signal.aborted) {
        // Nobody is left to answer; the upstream call was already cancelled through the shared signal.
        reply.hijack();
        reply.raw.destroy();
        return;
      }
      this.logUnexpected(error, requestId);
      const { status, body } = errorOf(error);
      if (error instanceof GatewayError && error.retryAfter) reply.header("retry-after", Math.max(1, Math.ceil(error.retryAfter / 1000)));
      reply.code(status).header("cache-control", "no-store").send(body);
    } finally {
      budget.clear();
    }
  }

  // docs/contracts/combos.md (routing.combo-dispatch): a bare name that is a combo runs through its members, each of them
  // routed again (a member may be a combo too); anything else is one model.
  private async route<T>(call: Call, request: CanonicalRequest, deliver: Deliver<T>, depth = 0): Promise<T> {
    const combo = request.model.includes("/") ? undefined : await this.combos.byName(request.model);
    // routing.capacity-adapter-solo: only the client's own model widens; a combo member widens with its combo.
    if (!combo) return depth === 0 ? this.adapted(call, request, deliver) : this.single(call, request, deliver);
    if (depth >= MAX_COMBO_DEPTH) {
      throw new GatewayError(400, "invalid_request_error", "combo_too_deep",
        `Combo "${combo.name}" nests combos more than ${MAX_COMBO_DEPTH} deep or reaches itself. Change its members in AIGate: Gateway → Routing.`);
    }
    if (combo.strategy === "fusion") return this.fuse(call, request, combo, deliver, depth + 1);
    const rotated = combo.strategy === "round-robin" ? this.combos.order(combo, (await this.settings.get()).comboStickyLimit) : combo.models;
    // combo.reorder-by-capabilities-tiers after capacity.augment-models-priority-prepend (docs/contracts/capacity-adapter.md).
    const required = detectRequiredCapabilities(request);
    const widened = await this.widening(combo.models, required);
    const members = reorderByCapabilities([...(widened?.pool ?? []), ...rotated], required);
    return this.firstAnswer(call, members, (model) => this.member(call, request, model, widened, deliver, depth + 1));
  }

  // The client's own model cannot read the media: capable pool models first, the model itself last.
  private async adapted<T>(call: Call, request: CanonicalRequest, deliver: Deliver<T>): Promise<T> {
    const widened = await this.widening([request.model], detectRequiredCapabilities(request));
    if (!widened) return this.single(call, request, deliver);
    const pool = widened.rotate ? this.capacity.order(widened.rotate, widened.pool) : widened.pool;
    return this.firstAnswer(call, [...pool, request.model], (model) => this.member(call, request, model, widened, deliver, 1));
  }

  // Most requests carry no media, so the pools are read only when one could apply.
  private async widening(originals: readonly string[], required: ReadonlySet<Capability>): Promise<Widening | undefined> {
    return needsMedia(required) ? widen(originals, required, await this.capacity.list()) : undefined;
  }

  // capacity.wrap-stripping-per-model: a pool model gets the history trimmed to its own window; a trimmed request no
  // longer matches the client's body (see Call.rewritten).
  private member<T>(call: Call, request: CanonicalRequest, model: string, widened: Widening | undefined, deliver: Deliver<T>, depth: number): Promise<T> {
    if (!widened?.pool.includes(model)) return this.route(call, { ...request, model }, deliver, depth);
    const trimmed = trimHistory(request, modelFit(model).contextWindow);
    return this.route(trimmed === request ? call : { ...call, rewritten: true }, { ...trimmed, model }, deliver, depth);
  }

  // combo.mode-fallback: members in order until one answers. A client error is the answer at once; so is anything after
  // the response started.
  private async firstAnswer<T>(call: Call, members: readonly string[], run: (model: string) => Promise<T>): Promise<T> {
    let last: unknown;
    let retryAfter: number | undefined;
    // eslint-disable-next-line aigate/retry-through-helper -- each attempt is another member, not an in-place retry.
    for (const [index, model] of members.entries()) {
      try {
        return await run(model);
      } catch (error) {
        if (call.signal.aborted || call.reply.sent) throw error;
        this.logUnexpected(error, call.requestId);
        const { status, body } = errorOf(error);
        const waitMs = memberFailover(status, body.error.message);
        if (waitMs === undefined) throw error;
        last = error;
        const memberRetryAfter = error instanceof GatewayError ? error.retryAfter
          : error instanceof EngineError && typeof error.details.retryAfterMs === "number" ? error.details.retryAfterMs : undefined;
        if (memberRetryAfter !== undefined) retryAfter = Math.min(retryAfter ?? memberRetryAfter, memberRetryAfter);
        // A briefly overloaded member gets its short cooldown before the next one (9router), within the request's signal.
        if (waitMs > 0 && index < members.length - 1) await delay(waitMs, undefined, { signal: call.signal }).catch(() => call.signal.throwIfAborted());
      }
    }
    throw exhausted(last, retryAfter);
  }

  // combo.mode-fusion-*: the panel answers without streaming or tools, then the judge writes the answer the client gets,
  // streamed and with tools as the client asked. Fewer than two answers degrade to a plain call or 503.
  private async fuse<T>(call: Call, request: CanonicalRequest, combo: Combo, deliver: Deliver<T>, depth: number): Promise<T> {
    const [first] = combo.models;
    if (combo.models.length === 1) return this.route(call, { ...request, model: first }, deliver, depth);
    const panel = panelRequest(request);
    const answers = await collectPanel(combo.models, combo, call.signal,
      (model, signal) => this.route({ ...call, signal, rewritten: true }, { ...panel, model }, answerOf, depth));
    call.signal.throwIfAborted();
    if (answers.length === 0) throw new GatewayError(503, "api_error", "provider_unavailable", `All fusion panel models of "${combo.name}" failed.`);
    // The only answer came without streaming or tools, so that member answers the client's own request again (9router).
    if (answers.length === 1) return this.route(call, { ...request, model: answers[0].model }, deliver, depth);
    return this.route({ ...call, rewritten: true }, { ...judgeRequest(request, answers), model: combo.judgeModel ?? first }, deliver, depth);
  }

  // SP17 (docs/contracts/multi-account.md): the model's provider tries each eligible account until one answers.
  private async single<T>(call: Call, request: CanonicalRequest, deliver: Deliver<T>): Promise<T> {
    const excluded = new Set<string>();
    // ponytail: the repository caps a provider at 100 accounts; raise both bounds together.
    // eslint-disable-next-line aigate/retry-through-helper -- candidates change account; this is not an in-place retry.
    for (let attempts = 0; attempts < 100; attempts += 1) {
      const resolved = await this.resolve(request, excluded);
      const prepared = await this.thought(call.parsed.prepare(resolved.request, resolved.provider, call.rewritten), resolved.provider);
      // provider.claude-oauth (kept from 9router): a non-Claude client's request to claude gets the Claude Code prompt.
      const target = { ...resolved, request: call.protocol === ANTHROPIC_MESSAGES ? prepared : claudeCodePrompt(prepared, resolved.provider) };
      let transport = this.transport;
      if (call.pxpipe.enabled && call.protocol === ANTHROPIC_MESSAGES && target.provider.protocol === "anthropic") {
        const base = this.transport;
        transport = {
          send: async (http, ctx) => {
            if (http.method !== "POST" || typeof http.body !== "string") return base.send(http, ctx);
            let body: string;
            try {
              const parsedBody: unknown = JSON.parse(http.body);
              const model = typeof parsedBody === "object" && parsedBody !== null && "model" in parsedBody && typeof parsedBody.model === "string"
                ? parsedBody.model : target.request.model;
              body = await this.pxpipe.apply(http.body, model, call.pxpipe.minChars, call.pxpipe.timeoutMs);
            } catch {
              body = http.body;
            }
            return base.send(body === http.body ? http : { ...http, body }, ctx);
          },
        };
      }
      const adapter = createAdapter(target.provider, transport);
      try {
        const result = await this.withRefresh(target, (credential) => deliver(target, adapter, credential, call), () => !call.reply.sent && !call.signal.aborted);
        await this.connections.clearLock(target.connection.id, splitThinkingSuffix(target.request.model).model);
        return result;
      } catch (error) {
        const cooldownMs = fallbackCooldown(error);
        if (!cooldownMs || call.signal.aborted || call.reply.sent || (await this.connections.activeCount(target.provider.id)) < 2) throw error;
        await this.connections.lock(target.connection.id, splitThinkingSuffix(target.request.model).model, new Date(Date.now() + cooldownMs));
        excluded.add(target.connection.id);
      }
    }
    throw new GatewayError(503, "api_error", "provider_unavailable", "No eligible provider account remained.");
  }

  // Combos first (9router), then each provider with an active connection: its catalog chat models, then its custom models
  // (docs/contracts/custom-models.md); a custom provider lists its custom models under its prefix.
  async models(reply: FastifyReply): Promise<FastifyReply> {
    const combos = (await this.combos.list()).map((combo) => ({ id: combo.name, object: "model", created: 0, owned_by: "combo" }));
    const active = await this.activeProviders();
    const builtins = builtinRegistry.providers.filter((p) => active.has(p.id));
    const nodes = (await this.nodes.list()).filter((node) => active.has(node.id) && !isReservedPrefix(node.prefix));
    const custom = await this.customModels.byProvider([...builtins.map((p) => p.id), ...nodes.map((node) => node.id)]);
    const entry = (owner: string, id: string) => ({ id: `${owner}/${id}`, object: "model", created: 0, owned_by: owner });
    const data = [
      ...combos,
      ...builtins.flatMap((p) => [
        ...p.models.filter((m) => m.kind === "chat").map((m) => m.id),
        ...(custom.get(p.id) ?? []).filter((id) => builtinRegistry.model(p.id, id) === undefined),
      ].map((id) => entry(p.id, id))),
      ...nodes.flatMap((node) => (custom.get(node.id) ?? []).map((id) => entry(node.prefix, id))),
    ];
    return reply.header("cache-control", "no-store").send({ object: "list", data });
  }

  // catalog.model-connectivity-test (docs/contracts/custom-models.md): one real chat request through the /v1 resolution and
  // adapter, without the key gate (the dashboard session stands in for it; 9router calls its own /v1 with a key).
  async probe(model: string): Promise<ModelProbe> {
    const started = Date.now();
    const requestId = randomUUID();
    const budget = deadline(PROBE_TIMEOUT_MS, `The model did not answer within ${PROBE_TIMEOUT_MS / 1000} s`);
    try {
      // max_tokens 1024: reasoning models spend the budget thinking before they answer (9router #3010).
      const { request } = parseOpenAIChatRequest({ model, max_tokens: 1024, stream: false, messages: [{ role: "user", content: "hi" }] });
      const resolved = await this.resolve(request);
      const target = { ...resolved, request: claudeCodePrompt(await this.thought(resolved.request, resolved.provider), resolved.provider) };
      const adapter = createAdapter(target.provider, this.transport);
      const response = await this.withRefresh(target, (credential) => adapter.execute(target.request, credential, { signal: budget.signal, requestId, proxy: target.proxy }), () => true);
      const answered = response.content.some((part) => part.type === "text" && part.text.trim() !== "");
      const reasoned = response.content.some((part) => part.type === "thinking" && part.text !== "");
      const note = response.stopReason === "max_tokens" && !answered && reasoned ? { note: "reasoning-only response (length-limited)" } : {};
      return { ok: true, latencyMs: Date.now() - started, status: 200, error: null, ...note };
    } catch (error) {
      if (!(error instanceof GatewayError || error instanceof EngineError || error instanceof SecretUnreadableError)) this.logUnexpected(error, requestId);
      const { status, body } = errorOf(error);
      const { message } = body.error;
      return { ok: false, latencyMs: Date.now() - started, status, error: `HTTP ${status}: ${message.slice(0, 500)}` };
    } finally {
      budget.clear();
    }
  }

  // routing.provider-thinking-default: the provider's stored level (a custom provider carries its own), for a request that
  // carries no thinking of its own.
  private async thought(request: CanonicalRequest, provider: ProviderDescriptor): Promise<CanonicalRequest> {
    const level = provider.defaultThinking ?? await this.thinking.get(provider.id);
    return withThinking(request, provider, level);
  }

  private async headroom(request: CanonicalRequest, settings: Settings, signal: AbortSignal, requestId: string): Promise<unknown> {
    const { headroomUrl, headroomTimeoutMs, headroomCompressUserMessages } = settings;
    const input = headroomInput(request, headroomCompressUserMessages);
    if (!input) return undefined;
    const response = await this.transport.send({
      method: "POST", url: `${headroomUrl}/v1/compress`, headers: { "content-type": "application/json" },
      body: JSON.stringify(input), timeoutMs: headroomTimeoutMs,
    }, { signal, requestId });
    if (response.status < 200 || response.status >= 300) return undefined;
    const body = await readBoundedText(response.body, 16 * 1024 * 1024);
    return JSON.parse(body);
  }

  // oauth.refresh-lifecycle (9router, kept): a 401/403 before the first byte refreshes the connection's token, for every
  // provider, and the request is sent once more with the new token.
  private async withRefresh<T>(target: Target, run: (credential: Credential) => Promise<T>, canRetry: () => boolean): Promise<T> {
    if (target.connection.id === "noauth") return run(target.credential);
    try {
      return await run(target.credential);
    } catch (error) {
      if (!upstreamAuthFailure(error) || !canRetry()) throw error;
      const token = await this.refresher.reactive(target.provider.id, target.connection, this.limits.refreshRetryDelayMs);
      if (!token) throw error;
      return run({ ...target.credential, apiKey: token });
    }
  }

  // Route error handler: body parsing failures, in the OpenAI shape.
  bodyError(error: FastifyError, reply: FastifyReply): FastifyReply {
    const status = error.statusCode ?? 500;
    if (status === 413) return this.fail(reply, new GatewayError(413, "invalid_request_error", "request_too_large", "The request body is larger than 16 MiB."));
    if (status === 415) return this.fail(reply, new GatewayError(415, "invalid_request_error", "unsupported_media_type", "Send the body as JSON with Content-Type: application/json."));
    if (status >= 400 && status < 500) return this.fail(reply, new GatewayError(status, "invalid_request_error", "invalid_json", "The request body is not valid JSON."));
    this.logUnexpected(error, "-");
    return this.fail(reply, new GatewayError(500, "server_error", "internal_error", "Internal error"));
  }

  // catalog.v1beta-generate-content-dispatch: the TTS body goes to Google unchanged with the gemini connection's key, and
  // Google's answer (status, body, content type) comes back as it is.
  private async geminiTts(request: GeminiRequest, reply: FastifyReply, route: GeminiRoute, requireApiKey: boolean): Promise<void> {
    const requestId = randomUUID();
    const client = new AbortController();
    reply.raw.once("close", () => {
      if (!reply.raw.writableFinished) client.abort(new ClientGone());
    });
    try {
      if (requireApiKey) {
        // 9router's TTS path reads Authorization: Bearer, then x-goog-api-key, then ?key= (not x-api-key).
        const auth = request.headers.authorization;
        const failure = await this.checkKey((typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : "") || googleKey(request));
        if (failure) throw failure;
      }
      const stored = await this.connections.activeCredential("gemini");
      if (stored === undefined) {
        throw new GatewayError(503, "api_error", "no_active_connection", "Gemini has no active connection for audio output. Add or enable one in AIGate: Providers → Connections.");
      }
      const upstream = await this.transport.send(geminiTtsRequest(route, request.query, request.body, stored.apiKey), { signal: client.signal, requestId, proxy: await this.pools.resolve(stored.proxyPoolId) });
      reply.hijack();
      // Only the content type is forwarded: other upstream headers (cookies) must not land on the dashboard's origin.
      reply.raw.writeHead(upstream.status, { "content-type": upstream.headers["content-type"] ?? "application/json", "x-request-id": requestId });
      if (upstream.body) {
        for await (const piece of upstream.body) {
          if (!reply.raw.write(piece)) await once(reply.raw, "drain", { signal: client.signal });
        }
      }
      reply.raw.end();
    } catch (error) {
      if (client.signal.aborted || reply.sent) {
        reply.raw.destroy();
        return;
      }
      this.logUnexpected(error, requestId);
      const { status, body } = errorOf(error);
      reply.code(status).header("cache-control", "no-store").header("x-request-id", requestId).send(body);
    }
  }

  private async checkKey(key: string | undefined): Promise<GatewayError | undefined> {
    if (!key) return new GatewayError(401, "invalid_request_error", "missing_api_key", MISSING_KEY);
    if (!(await this.keys.isValid(key))) {
      return new GatewayError(401, "invalid_request_error", "invalid_api_key", "The API key is not valid or was disabled. Check it in AIGate: Gateway → Endpoint & Keys.");
    }
    return undefined;
  }

  // Keyless mode serves this machine only, so a DNS-rebinding page or a LAN host cannot spend the provider key.
  private checkLocal(request: FastifyRequest): GatewayError | undefined {
    const origin = request.headers.origin;
    if (isLocalRequest({ ip: request.ip, host: request.headers.host, origin: typeof origin === "string" ? origin : undefined })) return undefined;
    return new GatewayError(403, "permission_error", "api_key_required",
      "Require API key is off, so AIGate only accepts requests from this machine. Turn it on in AIGate: Gateway → Endpoint & Keys, then send a key.");
  }

  // docs/contracts/catalog-providers.md "Resolving a model": "<provider or alias>/<model>" names the provider;
  // a bare id goes to the first catalog provider that declares it and has an active connection.
  private async resolve(request: CanonicalRequest, excluded = new Set<string>(), expectedKind: "chat" | "embedding" | "image" | "tts" | "stt" | "video" = "chat"): Promise<Target> {
    const ref = request.model;
    const slash = ref.indexOf("/");
    const prefix = slash > 0 ? ref.slice(0, slash) : undefined;
    let prefixed = prefix === undefined ? undefined : builtinRegistry.provider(prefix);
    if (prefix !== undefined && !prefixed) {
      const status = builtinRegistry.status(prefix);
      if (status && !status.connectable) {
        throw new GatewayError(400, "invalid_request_error", "provider_not_supported", `${prefix} cannot be connected yet: ${status.reason}.`);
      }
      // A custom provider prefix (docs/contracts/custom-providers.md); catalog ids and aliases always win, as in 9router.
      const node = isReservedPrefix(prefix) ? undefined : await this.nodes.byPrefix(prefix);
      if (node) prefixed = nodeDescriptor(node);
    }
    const modelId = prefixed ? ref.slice(slash + 1) : ref;
    if (modelId === "") throw this.modelNotFound(ref);
    const catalogModelId = splitThinkingSuffix(modelId).model;
    const active = await this.activeProviders();
    let provider = prefixed;
    if (!provider) {
      // Model ids may contain "/" (openrouter's "meta-llama/…"), so an unknown prefix is part of the id.
      const declaring = builtinRegistry.providers.filter((p) => builtinRegistry.model(p.id, catalogModelId) !== undefined);
      if (declaring.length === 0) throw this.modelNotFound(ref);
      provider = declaring.find((p) => active.has(p.id));
      if (!provider) {
        const names = declaring.slice(0, 3).map((p) => p.name).join(", ");
        throw new GatewayError(404, "not_found_error", "no_active_connection",
          `No active connection serves "${ref}". Add or enable one for ${names}${declaring.length > 3 ? ", …" : ""} in AIGate: Providers → Connections.`);
      }
    }
    const upstream: CanonicalRequest = { ...request, model: modelId };
    const descriptor = builtinRegistry.model(provider.id, catalogModelId);
    if (expectedKind !== "chat") {
      if (descriptor?.kind !== expectedKind) throw new GatewayError(400, "invalid_request_error", "model_not_found", `${provider.id}/${catalogModelId} is not a known ${expectedKind} model.`);
    } else assertModelSupports({ ...upstream, model: catalogModelId }, provider.id, descriptor, catalogModelId);
    if (provider.auth.kind === "none") {
      const connection: StoredCredential = { id: "noauth", apiKey: "", proxyPoolId: null, baseUrl: null, deployment: null, apiVersion: null, organization: null, accountId: null };
      return { provider, request: upstream, connection, credential: { kind: "api-key", apiKey: "" }, proxy: await this.pools.resolveNoAuth(provider.id) };
    }
    const strategy = (await this.settings.get()).fallbackStrategy;
    const selected = await this.connections.selectActive(provider.id, catalogModelId, excluded, strategy);
    if (!selected.credential) {
      if (selected.retryAt) throw new GatewayError(503, "api_error", "provider_unavailable", `${provider.name} is temporarily unavailable for ${catalogModelId}.`, selected.retryAt.getTime() - Date.now());
      throw new GatewayError(404, "not_found_error", "no_active_connection", `${provider.name} has no active connection. Add or enable one in AIGate: Providers → Connections.`);
    }
    // oauth.refresh-lifecycle: an oauth token about to expire is refreshed first.
    const stored = await this.refresher.fresh(provider.id, selected.credential);
    // connection.ollama-local-host: a connection may point the provider at its own host.
    // The connection id is the session id claude and codex send (9router derives one per connection); gemini-cli names
    // the project its sign-in found.
    const credential: Credential = { kind: "api-key", apiKey: stored.apiKey, sessionId: stored.id, ...(stored.projectId ? { projectId: stored.projectId } : {}), ...(stored.providerData ? { providerData: stored.providerData } : {}) };
    const connected = withConnection(provider, stored);
    const retrying = connected.retryStreamErrors ? { ...connected, streamRetryDelayMs: this.limits.streamRetryDelayMs } : connected;
    return { provider: retrying, request: upstream, credential, connection: stored, proxy: await this.pools.resolve(stored.proxyPoolId) };
  }

  private async mediaCredential(serviceId: string, lockKey: string, excluded: ReadonlySet<string> = new Set()): Promise<{ credential: StoredCredential; proxy?: ProxyConfig }> {
    const service = mediaService(serviceId);
    if (!service) throw new GatewayError(400, "invalid_request_error", "media_provider_unsupported", `Provider "${serviceId}" is not a supported media service.`);
    const providerId = service.credentialProviderId ?? service.id;
    const selected = await this.connections.selectActive(providerId, lockKey, excluded, (await this.settings.get()).fallbackStrategy);
    if (!selected.credential) {
      if (selected.retryAt) throw new GatewayError(503, "api_error", "provider_unavailable", `${service.name} is temporarily unavailable.`, selected.retryAt.getTime() - Date.now());
      throw new GatewayError(404, "not_found_error", "no_active_connection", `${service.name} has no active connection. Add or enable one in AIGate: Providers → Connections.`);
    }
    const credential = await this.refresher.fresh(providerId, selected.credential);
    return { credential, proxy: await this.pools.resolve(credential.proxyPoolId) };
  }

  // Search and fetch share their normal account rotation, but lock only the lane-specific key.
  private async mediaResponse(
    serviceId: string, lockKey: string, requestId: string, signal: AbortSignal,
    send: (target: { credential: StoredCredential; proxy?: ProxyConfig }) => ReturnType<HttpTransportPort["send"]>,
  ): Promise<{ status: number; raw: string }> {
    const service = mediaService(serviceId)!;
    const credentialProviderId = service.credentialProviderId ?? service.id;
    const excluded = new Set<string>();
    // eslint-disable-next-line aigate/retry-through-helper -- candidates change account; this is not an in-place retry.
    for (;;) {
      const target = await this.mediaCredential(serviceId, lockKey, excluded);
      try {
        const response = await send(target);
        const raw = await readBoundedText(response.body, 16 * 1024 * 1024);
        const cooldown = mediaCooldown(response.status);
        if (!cooldown || (await this.connections.activeCount(credentialProviderId)) < 2) {
          if (response.status >= 200 && response.status < 300) await this.connections.clearLock(target.credential.id, lockKey);
          return { status: response.status, raw };
        }
        await this.connections.lock(target.credential.id, lockKey, new Date(Date.now() + cooldown));
        excluded.add(target.credential.id);
      } catch (error) {
        const cooldown = fallbackCooldown(error);
        if (!cooldown || signal.aborted || (await this.connections.activeCount(credentialProviderId)) < 2) throw error;
        await this.connections.lock(target.credential.id, lockKey, new Date(Date.now() + cooldown));
        excluded.add(target.credential.id);
      }
    }
  }

  private modelNotFound(ref: string): GatewayError {
    return new GatewayError(404, "not_found_error", "model_not_found",
      `The model "${ref}" is not in the catalog. Use "<provider>/<model>" such as "openai/gpt-4.1"; GET /v1/models lists the models of your connected providers.`);
  }

  private async activeProviders(): Promise<Set<string>> {
    const active = await this.connections.activeProviders();
    for (const provider of builtinRegistry.providers) if (provider.auth.kind === "none") active.add(provider.id);
    return active;
  }

  // Headers are sent only after the first chunk, so a failure before it is a normal JSON error.
  private async stream(
    reply: FastifyReply, adapter: AIProviderPort, target: Target, encoder: StreamEncoder, requestId: string, client: AbortController, budget: AbortSignal,
  ): Promise<void> {
    const idle = new AbortController();
    const ctx: ExecCtx = { signal: AbortSignal.any([client.signal, budget, idle.signal]), requestId, proxy: target.proxy };
    const iterator = adapter.stream(target.request, target.credential, ctx)[Symbol.asyncIterator]();
    const next = () => this.nextWithin(iterator, idle, target.provider.name);
    let step = await next();
    reply.hijack();
    const raw = reply.raw;
    raw.on("error", () => client.abort(new ClientGone()));
    raw.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache", "x-accel-buffering": "no", "x-request-id": requestId });
    try {
      for (; !step.done; step = await next()) await write(raw, encoder.encode(step.value), client.signal);
      await write(raw, encoder.end(), client.signal);
    } catch (error) {
      if (!client.signal.aborted) {
        this.logUnexpected(error, requestId);
        // Mid-stream failure: one error event and no [DONE] (fallback.partial-stream-failure).
        await write(raw, encoder.fail(error), client.signal).catch(() => undefined);
      }
    } finally {
      // Cancels the upstream body if the loop stopped early.
      await iterator.return?.(undefined).catch(() => undefined);
      raw.end();
    }
  }

  private async nextWithin(iterator: AsyncIterator<StreamChunk>, idle: AbortController, provider: string): Promise<IteratorResult<StreamChunk>> {
    const ms = this.limits.streamIdleTimeoutMs;
    const timer = setTimeout(() => idle.abort(new EngineError("TIMEOUT", `${provider} sent no data for ${ms / 1000} s`, { idleTimeoutMs: ms })), ms);
    try {
      return await iterator.next();
    } finally {
      clearTimeout(timer);
    }
  }

  private fail(reply: FastifyReply, error: GatewayError): FastifyReply {
    const { status, body } = errorOf(error);
    return reply.code(status).header("cache-control", "no-store").send(body);
  }

  // Expected failures are answers; anything else is a bug worth a log line (never the body or a key).
  private logUnexpected(error: unknown, requestId: string): void {
    if (error instanceof EngineError || error instanceof GatewayError || error instanceof UnsupportedFeatureError || error instanceof SecretUnreadableError) return;
    this.logger.error(`request ${requestId} failed`, error instanceof Error ? error.stack : String(error));
  }
}
