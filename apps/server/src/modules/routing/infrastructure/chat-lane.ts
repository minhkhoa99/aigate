import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { ServerResponse } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import {
  anthropicClientGetsMessage, anthropicRequestFor, AnthropicStreamEncoder, assertModelSupports, builtinRegistry, createAdapter, EngineError,
  estimateAnthropicInputTokens, geminiModelList, GeminiStreamEncoder, geminiTtsRequest, isGeminiTtsRequest, OpenAIChatStreamEncoder,
  parseAnthropicMessagesRequest, parseGeminiGenerateRequest, parseGeminiPath, parseOpenAIChatRequest, parseOpenAIResponsesRequest,
  responsesClientGetsObject, responsesRequestFor, ResponsesStreamEncoder, toAnthropicMessage, toGeminiResponse, toOpenAIChatCompletion, toOpenAIError,
  splitThinkingSuffix, toResponsesObject, UnsupportedFeatureError, withClaudeCodePrompt, withConnection, withThinking, type AIProviderPort, type CanonicalRequest, type CanonicalResponse, type Credential,
  type ExecCtx, type GeminiRoute, type HttpTransportPort, type OpenAIError, type ProviderDescriptor, type ProxyConfig, type StreamChunk,
} from "@aigate/engine";
import { SecretUnreadableError } from "../../../secret-cipher.js";
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
import { collectPanel, judgeRequest, MAX_COMBO_DEPTH, memberFailover, panelRequest, type Combo } from "../domain/combo.js";
import { CombosRepository } from "./combos.repo.js";

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

  constructor(status: number, type: string, code: string, message: string, readonly retryAfter?: number) {
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
  proxy?: ProxyConfig;
}

// The provider answered 401 or 403 (not a key AIGate refused before sending).
const upstreamAuthFailure = (error: unknown): boolean =>
  error instanceof EngineError && error.code === "AUTH_ERROR" && (error.details.status === 401 || error.details.status === 403);

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
}

// What the lane does with a resolved target: answer the client, or (a fusion panel member) return the answer.
type Deliver<T> = (target: Target, adapter: AIProviderPort, credential: Credential, call: Call) => Promise<T>;

const answerOf: Deliver<CanonicalResponse> = (target, adapter, credential, call) =>
  adapter.execute(target.request, credential, { signal: call.signal, requestId: call.requestId, proxy: target.proxy });

// combo.mode-fallback, combo.aggregate-status-first-failure (corrected): every member failed, so the last member's error is
// the answer, with the earliest Retry-After any member gave; no active connection anywhere is 503, as 9router's rule.
function exhausted(last: unknown, retryAfter: number | undefined): Error {
  const { status, body } = errorOf(last);
  const noConnection = last instanceof GatewayError && last.code === "no_active_connection";
  if (!noConnection && retryAfter === undefined && last instanceof Error) return last;
  return noConnection
    ? new GatewayError(503, "api_error", "provider_unavailable", body.error.message, retryAfter)
    : new GatewayError(status, body.error.type, body.error.code, body.error.message, retryAfter);
}

// Only errors caused by an upstream account get another account. Client validation errors are terminal.
function fallbackCooldown(error: unknown): number | undefined {
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
      const ids = { created: Math.floor(Date.now() / 1000), fallbackId: `chatcmpl-${requestId.replaceAll("-", "")}`, requestId };
      const call: Call = { parsed, protocol, reply, requestId, signal: AbortSignal.any([client.signal, budget.signal]), rewritten: false };
      await this.route(call, parsed.request, async (target, adapter, credential) => {
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
    if (!combo) return this.single(call, request, deliver);
    if (depth >= MAX_COMBO_DEPTH) {
      throw new GatewayError(400, "invalid_request_error", "combo_too_deep",
        `Combo "${combo.name}" nests combos more than ${MAX_COMBO_DEPTH} deep or reaches itself. Change its members in AIGate: Gateway → Routing.`);
    }
    if (combo.strategy === "fusion") return this.fuse(call, request, combo, deliver, depth + 1);
    const members = combo.strategy === "round-robin" ? this.combos.order(combo, (await this.settings.get()).comboStickyLimit) : combo.models;
    return this.firstAnswer(call, members, (model) => this.route(call, { ...request, model }, deliver, depth + 1));
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
      const adapter = createAdapter(target.provider, this.transport);
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
  private async resolve(request: CanonicalRequest, excluded = new Set<string>()): Promise<Target> {
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
    assertModelSupports({ ...upstream, model: catalogModelId }, provider.id, builtinRegistry.model(provider.id, catalogModelId), catalogModelId);
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
