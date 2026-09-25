import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { ServerResponse } from "node:http";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import {
  assertModelSupports, builtinRegistry, EngineError, OpenAIChatStreamEncoder, OpenAICompatibleAdapter, parseOpenAIChatRequest, toOpenAIChatCompletion,
  toOpenAIError, UnsupportedFeatureError, type CanonicalRequest, type Credential, type ExecCtx, type HttpTransportPort, type ProviderDescriptor,
  type StreamChunk,
} from "@aigate/engine";
import { SecretUnreadableError } from "../../../secret-cipher.js";
import { extractApiKey } from "../../apikeys/domain/api-key.js";
import { ApiKeysRepository } from "../../apikeys/infrastructure/api-keys.repo.js";
import { ConnectionsRepository } from "../../connections/infrastructure/connections.repo.js";
import { nodeDescriptor, ProviderNodesRepository } from "../../connections/infrastructure/provider-nodes.repo.js";
import { isLocalRequest } from "../../identity/domain/local-request.js";
import { SettingsRepository } from "../../settings/infrastructure/settings.repo.js";
import { HTTP_TRANSPORT } from "../../transport/transport.module.js";

// The /v1 chat lane (docs/contracts/chat-lane.md): key gate, parse, resolve, adapter, stream.

export const CHAT_LIMITS = Symbol("CHAT_LIMITS");
export interface ChatLimits {
  // Longest silence allowed between two upstream stream chunks (AIGATE_STREAM_IDLE_TIMEOUT_MS).
  readonly streamIdleTimeoutMs: number;
}
export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000;
const REQUEST_BUDGET_MS = 600_000;

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

function errorOf(error: unknown): { status: number; body: unknown } {
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
}

@Injectable()
export class ChatLane {
  private readonly logger = new Logger("ChatLane");

  constructor(
    private readonly settings: SettingsRepository,
    private readonly keys: ApiKeysRepository,
    private readonly connections: ConnectionsRepository,
    private readonly nodes: ProviderNodesRepository,
    @Inject(HTTP_TRANSPORT) private readonly transport: HttpTransportPort,
    @Inject(CHAT_LIMITS) private readonly limits: ChatLimits,
  ) {}

  // onRequest hook: runs before the body is read, so an unauthenticated caller costs one lookup at most.
  async authorize(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | undefined> {
    const { requireApiKey } = await this.settings.get();
    const failure = requireApiKey ? await this.checkKey(request) : this.checkLocal(request);
    return failure ? this.fail(reply, failure) : undefined;
  }

  async chat(request: FastifyRequest, reply: FastifyReply): Promise<void> {
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
      const { request: parsed, includeUsage } = parseOpenAIChatRequest(request.body);
      const target = await this.resolve(parsed);
      const adapter = new OpenAICompatibleAdapter(target.provider, this.transport);
      const ids = { created: Math.floor(Date.now() / 1000), fallbackId: `chatcmpl-${requestId.replaceAll("-", "")}`, requestId };
      if (!parsed.stream) {
        const ctx: ExecCtx = { signal: AbortSignal.any([client.signal, budget.signal]), requestId };
        const response = await adapter.execute(target.request, target.credential, ctx);
        reply.code(200).header("cache-control", "no-store").send(toOpenAIChatCompletion(response, ids));
        return;
      }
      await this.stream(reply, adapter, target, { ...ids, includeUsage }, client, budget.signal);
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

  async models(reply: FastifyReply): Promise<FastifyReply> {
    const active = await this.connections.activeProviders();
    const data = builtinRegistry.providers.filter((p) => active.has(p.id)).flatMap((p) =>
      p.models.filter((m) => m.kind === "chat").map((m) => ({ id: `${p.id}/${m.id}`, object: "model", created: 0, owned_by: p.id })));
    return reply.header("cache-control", "no-store").send({ object: "list", data });
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

  private async checkKey(request: FastifyRequest): Promise<GatewayError | undefined> {
    const key = extractApiKey(request.headers);
    if (!key) {
      return new GatewayError(401, "invalid_request_error", "missing_api_key",
        "Missing API key. Send Authorization: Bearer <key>, using a key from AIGate: Gateway → Endpoint & Keys.");
    }
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
      // A custom provider prefix (docs/contracts/custom-providers.md); otherwise the "/" is part of a model id.
      const node = await this.nodes.byPrefix(prefix);
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
    const apiKey = await this.connections.activeKey(provider.id);
    if (apiKey === undefined) {
      throw new GatewayError(404, "not_found_error", "no_active_connection", `${provider.name} has no active connection. Add or enable one in AIGate: Providers → Connections.`);
    }
    const upstream: CanonicalRequest = { ...request, model: modelId };
    assertModelSupports(upstream, provider.id, builtinRegistry.model(provider.id, modelId), modelId);
    return { provider, request: upstream, credential: { kind: "api-key", apiKey } };
  }

  private modelNotFound(ref: string): GatewayError {
    return new GatewayError(404, "not_found_error", "model_not_found",
      `The model "${ref}" is not in the catalog. Use "<provider>/<model>" such as "openai/gpt-4.1"; GET /v1/models lists the models of your connected providers.`);
  }

  // Headers are sent only after the first chunk, so a failure before it is a normal JSON error.
  private async stream(
    reply: FastifyReply, adapter: OpenAICompatibleAdapter, target: Target,
    ids: { created: number; fallbackId: string; requestId: string; includeUsage: boolean }, client: AbortController, budget: AbortSignal,
  ): Promise<void> {
    const idle = new AbortController();
    const ctx: ExecCtx = { signal: AbortSignal.any([client.signal, budget, idle.signal]), requestId: ids.requestId };
    const iterator = adapter.stream(target.request, target.credential, ctx)[Symbol.asyncIterator]();
    const next = () => this.nextWithin(iterator, idle, target.provider.name);
    let step = await next();
    reply.hijack();
    const raw = reply.raw;
    raw.on("error", () => client.abort(new ClientGone()));
    raw.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache", "x-accel-buffering": "no", "x-request-id": ids.requestId });
    const encoder = new OpenAIChatStreamEncoder({ ...ids, model: target.request.model });
    try {
      for (; !step.done; step = await next()) await write(raw, encoder.encode(step.value), client.signal);
      await write(raw, encoder.end(), client.signal);
    } catch (error) {
      if (!client.signal.aborted) {
        this.logUnexpected(error, ids.requestId);
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
