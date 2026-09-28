import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { ServerResponse } from "node:http";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import {
  anthropicClientGetsMessage, anthropicRequestFor, AnthropicStreamEncoder, assertModelSupports, builtinRegistry, createAdapter, EngineError,
  estimateAnthropicInputTokens, geminiModelList, GeminiStreamEncoder, geminiTtsRequest, isGeminiTtsRequest, OpenAIChatStreamEncoder,
  parseAnthropicMessagesRequest, parseGeminiGenerateRequest, parseGeminiPath, parseOpenAIChatRequest, parseOpenAIResponsesRequest,
  responsesClientGetsObject, responsesRequestFor, ResponsesStreamEncoder, toAnthropicMessage, toGeminiResponse, toOpenAIChatCompletion, toOpenAIError,
  toResponsesObject, UnsupportedFeatureError, withClaudeCodePrompt, withConnection, type AIProviderPort, type CanonicalRequest, type CanonicalResponse, type Credential,
  type ExecCtx, type GeminiRoute, type HttpTransportPort, type OpenAIError, type ProviderDescriptor, type StreamChunk,
} from "@aigate/engine";
import { SecretUnreadableError } from "../../../secret-cipher.js";
import { extractApiKey } from "../../apikeys/domain/api-key.js";
import { CustomModelsRepository } from "../../catalog/infrastructure/custom-models.repo.js";
import { ApiKeysRepository } from "../../apikeys/infrastructure/api-keys.repo.js";
import { ConnectionsRepository, type StoredCredential } from "../../connections/infrastructure/connections.repo.js";
import { TokenRefresher } from "../../connections/infrastructure/token-refresher.js";
import { isReservedPrefix, nodeDescriptor, ProviderNodesRepository } from "../../connections/infrastructure/provider-nodes.repo.js";
import { isLocalRequest } from "../../identity/domain/local-request.js";
import { SettingsRepository } from "../../settings/infrastructure/settings.repo.js";
import { HTTP_TRANSPORT } from "../../transport/transport.module.js";

// The /v1 chat lane (docs/contracts/chat-lane.md): key gate, parse, resolve, adapter, stream.

export const CHAT_LIMITS = Symbol("CHAT_LIMITS");
export interface ChatLimits {
  // Longest silence allowed between two upstream stream chunks (AIGATE_STREAM_IDLE_TIMEOUT_MS).
  readonly streamIdleTimeoutMs: number;
  // The pause unit between the reactive refresh attempts after a 401/403 (oauth.refresh-lifecycle: 1 s, then 2 s).
  readonly refreshRetryDelayMs: number;
}
export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000;
export const DEFAULT_REFRESH_RETRY_DELAY_MS = 1_000;
const REQUEST_BUDGET_MS = 600_000;
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
class GatewayError extends Error {
  readonly status: number;
  readonly type: string;
  readonly code: string;

  constructor(status: number, type: string, code: string, message: string) {
    super(message);
    this.status = status;
    this.type = type;
    this.code = code;
  }
}

class ClientGone extends Error {
  constructor() {
    super("The client closed the connection");
  }
}

function errorOf(error: unknown): OpenAIError {
  if (error instanceof GatewayError) {
    return { status: error.status, body: { error: { message: error.message, type: error.type, code: error.code, param: null } } };
  }
  if (error instanceof SecretUnreadableError) {
    return errorOf(new GatewayError(500, "server_error", "credential_unreadable",
      "The saved provider key cannot be decrypted, because the AIGate secret key changed. Enter the key again in the dashboard: Providers → Connections."));
  }
  return toOpenAIError(error);
}

// An abort after `ms` whose reason is a TIMEOUT the client can read, not a bare DOMException.
function deadline(ms: number, message: string): { signal: AbortSignal; clear: () => void } {
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
}

// The provider answered 401 or 403 (not a key AIGate refused before sending).
const upstreamAuthFailure = (error: unknown): boolean =>
  error instanceof EngineError && error.code === "AUTH_ERROR" && (error.details.status === 401 || error.details.status === 403);

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
  // The request the resolved provider receives (the model already resolved).
  prepare(request: CanonicalRequest, provider: ProviderDescriptor): CanonicalRequest;
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
      prepare: (upstream, provider) => responsesRequestFor(parsed, upstream, provider),
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
    private readonly refresher: TokenRefresher,
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
      const resolved = await this.resolve(parsed.request);
      const prepared = parsed.prepare(resolved.request, resolved.provider);
      // provider.claude-oauth (kept from 9router): a non-Claude client's request to claude gets the Claude Code prompt.
      const target = { ...resolved, request: protocol === ANTHROPIC_MESSAGES ? prepared : claudeCodePrompt(prepared, resolved.provider) };
      const adapter = createAdapter(target.provider, this.transport);
      const ids = { created: Math.floor(Date.now() / 1000), fallbackId: `chatcmpl-${requestId.replaceAll("-", "")}`, requestId };
      const run = async (credential: Credential): Promise<void> => {
        if (!target.request.stream) {
          const ctx: ExecCtx = { signal: AbortSignal.any([client.signal, budget.signal]), requestId };
          const response = await adapter.execute(target.request, credential, ctx);
          reply.code(200).header("cache-control", "no-store").send(parsed.respond(response, target.provider, ids));
          return;
        }
        await this.stream(reply, adapter, { ...target, credential }, parsed.encoder(target.provider, { ...ids, model: target.request.model }), ids.requestId, client, budget.signal);
      };
      await this.withRefresh(target, run, () => !reply.sent && !client.signal.aborted);
    } catch (error) {
      if (client.signal.aborted) {
        // Nobody is left to answer; the upstream call was already cancelled through the shared signal.
        reply.hijack();
        reply.raw.destroy();
        return;
      }
      this.logUnexpected(error, requestId);
      const { status, body } = errorOf(error);
      reply.code(status).header("cache-control", "no-store").send(body);
    } finally {
      budget.clear();
    }
  }

  // Each provider with an active connection: its catalog chat models, then its custom models (docs/contracts/custom-models.md);
  // a custom provider lists its custom models under its prefix.
  async models(reply: FastifyReply): Promise<FastifyReply> {
    const active = await this.connections.activeProviders();
    const builtins = builtinRegistry.providers.filter((p) => active.has(p.id));
    const nodes = (await this.nodes.list()).filter((node) => active.has(node.id) && !isReservedPrefix(node.prefix));
    const custom = await this.customModels.byProvider([...builtins.map((p) => p.id), ...nodes.map((node) => node.id)]);
    const entry = (owner: string, id: string) => ({ id: `${owner}/${id}`, object: "model", created: 0, owned_by: owner });
    const data = [
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
      const target = { ...resolved, request: claudeCodePrompt(resolved.request, resolved.provider) };
      const adapter = createAdapter(target.provider, this.transport);
      const response = await this.withRefresh(target, (credential) => adapter.execute(target.request, credential, { signal: budget.signal, requestId }), () => true);
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

  // oauth.refresh-lifecycle (9router, kept): a 401/403 before the first byte refreshes the connection's token, for every
  // provider, and the request is sent once more with the new token.
  private async withRefresh<T>(target: Target, run: (credential: Credential) => Promise<T>, canRetry: () => boolean): Promise<T> {
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
      const upstream = await this.transport.send(geminiTtsRequest(route, request.query, request.body, stored.apiKey), { signal: client.signal, requestId });
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
  private async resolve(request: CanonicalRequest): Promise<Target> {
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
    const active = await this.connections.activeProviders();
    let provider = prefixed;
    if (!provider) {
      // Model ids may contain "/" (openrouter's "meta-llama/…"), so an unknown prefix is part of the id.
      const declaring = builtinRegistry.providers.filter((p) => builtinRegistry.model(p.id, ref) !== undefined);
      if (declaring.length === 0) throw this.modelNotFound(ref);
      provider = declaring.find((p) => active.has(p.id));
      if (!provider) {
        const names = declaring.slice(0, 3).map((p) => p.name).join(", ");
        throw new GatewayError(404, "not_found_error", "no_active_connection",
          `No active connection serves "${ref}". Add or enable one for ${names}${declaring.length > 3 ? ", …" : ""} in AIGate: Providers → Connections.`);
      }
    }
    const current = await this.connections.activeCredential(provider.id);
    if (current === undefined) {
      throw new GatewayError(404, "not_found_error", "no_active_connection", `${provider.name} has no active connection. Add or enable one in AIGate: Providers → Connections.`);
    }
    const upstream: CanonicalRequest = { ...request, model: modelId };
    assertModelSupports(upstream, provider.id, builtinRegistry.model(provider.id, modelId), modelId);
    // oauth.refresh-lifecycle: an oauth token about to expire is refreshed first.
    const stored = await this.refresher.fresh(provider.id, current);
    // connection.ollama-local-host: a connection may point the provider at its own host.
    // The connection id is the session id claude and codex send (9router derives one per connection); gemini-cli names
    // the project its sign-in found.
    const credential: Credential = { kind: "api-key", apiKey: stored.apiKey, sessionId: stored.id, ...(stored.projectId ? { projectId: stored.projectId } : {}) };
    return { provider: withConnection(provider, stored), request: upstream, credential, connection: stored };
  }

  private modelNotFound(ref: string): GatewayError {
    return new GatewayError(404, "not_found_error", "model_not_found",
      `The model "${ref}" is not in the catalog. Use "<provider>/<model>" such as "openai/gpt-4.1"; GET /v1/models lists the models of your connected providers.`);
  }

  // Headers are sent only after the first chunk, so a failure before it is a normal JSON error.
  private async stream(
    reply: FastifyReply, adapter: AIProviderPort, target: Target, encoder: StreamEncoder, requestId: string, client: AbortController, budget: AbortSignal,
  ): Promise<void> {
    const idle = new AbortController();
    const ctx: ExecCtx = { signal: AbortSignal.any([client.signal, budget, idle.signal]), requestId };
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
