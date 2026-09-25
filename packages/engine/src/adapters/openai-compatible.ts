import { UnsupportedFeatureError, type CanonicalRequest, type CanonicalResponse, type ContentPart, type MediaSource, type StopReason, type StreamChunk, type TokenUsage } from "../cip.js";
import { EngineError, type ErrorCode } from "../errors.js";
import { readBoundedText } from "../http.js";
import { isRecord, list, parseJson, record, text, type Json } from "../json.js";
import type { AIProviderPort, Credential, CredentialStatus, ExecCtx, HttpRequest, HttpResponse, HttpTransportPort, ListedModel } from "../ports.js";
import { MODEL_ID, type ModelDescriptor, type ProviderDescriptor } from "../registry.js";
import { withRetry } from "../retry.js";
import { readSseData } from "../sse.js";

// AIProviderPort for the openai-compatible family (docs/contracts/provider-openai.md).

const TARGET = "openai-compatible";
const CHAT_TIMEOUT_MS = 300_000;
// ponytail: the transport deadline bounds the whole stream until the SP12 idle timeout exists.
const STREAM_TIMEOUT_MS = 600_000;
const METADATA_TIMEOUT_MS = 15_000;
const RETRY = { maxAttempts: 3, baseDelayMs: 500, maxDelayMs: 1_000 };
const RETRY_STATUSES = new Set([502, 503, 504]);
const ERROR_BODY_BYTES = 64 * 1024;
const MAX_MESSAGE_CHARS = 300;
const MAX_LISTED_MODELS = 1_000;
const MAX_TOOL_CALLS = 128;
// Printable ASCII only: a key can never break out of its header.
const API_KEY = /^[\x21-\x7e]{1,4096}$/;
const AUDIO_FORMATS = new Map([["audio/wav", "wav"], ["audio/x-wav", "wav"], ["audio/mpeg", "mp3"], ["audio/mp3", "mp3"]]);
const STOP_REASONS = new Map<string, StopReason>([
  ["stop", "end_turn"], ["length", "max_tokens"], ["tool_calls", "tool_use"], ["function_call", "tool_use"], ["content_filter", "content_filter"],
]);

const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);
const unsupported = (feature: string) => new UnsupportedFeatureError(feature, TARGET);

// ---- CIP -> chat completions ----

function mediaUrl(source: MediaSource): string {
  return source.kind === "url" ? source.url : `data:${source.mediaType};base64,${source.data}`;
}

// A single text part goes as a plain string, which every compatible server accepts.
function compact(parts: readonly Json[]): string | readonly Json[] {
  const only = parts.length === 1 ? parts[0] : undefined;
  return only?.type === "text" && typeof only.text === "string" ? only.text : parts;
}

// Text is the only content a system prompt or tool result can carry here; cacheControl is a hint
// OpenAI does not need (it caches prefixes itself), so it is the one field left out.
function textParts(parts: readonly ContentPart[], where: string): Json[] {
  return parts.map((part) => {
    if (part.type !== "text") throw unsupported(`${part.type} in ${where}`);
    return { type: "text", text: part.text };
  });
}

function userPart(part: ContentPart): Json {
  switch (part.type) {
    case "text": return { type: "text", text: part.text };
    case "image": return { type: "image_url", image_url: { url: mediaUrl(part.source), ...(part.detail ? { detail: part.detail } : {}) } };
    case "audio": {
      const format = part.source.kind === "base64" ? AUDIO_FORMATS.get(part.source.mediaType) : undefined;
      if (part.source.kind !== "base64" || format === undefined) throw unsupported("audio other than base64 wav or mp3");
      return { type: "input_audio", input_audio: { data: part.source.data, format } };
    }
    case "file":
      if (part.source.kind !== "base64") throw unsupported("a file by url");
      return { type: "file", file: { filename: part.name ?? "file", file_data: mediaUrl(part.source) } };
    default: throw unsupported(`${part.type} in a user message`);
  }
}

function assistantMessage(parts: readonly ContentPart[]): Json {
  const texts: Json[] = [];
  const toolCalls: Json[] = [];
  for (const part of parts) {
    if (part.type === "text") texts.push({ type: "text", text: part.text });
    else if (part.type === "tool_call") toolCalls.push({ id: part.id, type: "function", function: { name: part.name, arguments: part.arguments } });
    else throw unsupported(`${part.type} in an assistant message`);
  }
  return { role: "assistant", content: texts.length > 0 ? compact(texts) : null, ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}) };
}

function toMessages(request: CanonicalRequest): Json[] {
  const out: Json[] = [];
  if (request.system && request.system.length > 0) out.push({ role: "system", content: compact(textParts(request.system, "the system prompt")) });
  for (const message of request.messages) {
    const rest: ContentPart[] = [];
    // A tool result becomes its own `tool` message, wherever the client put it.
    for (const part of message.content) {
      if (part.type !== "tool_result") {
        rest.push(part);
        continue;
      }
      if (part.isError) throw unsupported("a tool_result with isError");
      out.push({ role: "tool", tool_call_id: part.toolCallId, content: compact(textParts(part.content, "a tool result")) });
    }
    if (rest.length === 0) continue;
    if (message.role === "assistant") out.push(assistantMessage(rest));
    else if (message.role === "user") out.push({ role: "user", content: compact(rest.map(userPart)) });
    else throw unsupported("content other than tool_result in a tool message");
  }
  return out;
}

function toBody(request: CanonicalRequest, stream: boolean): Json {
  if (request.reasoning?.budgetTokens !== undefined) throw unsupported("reasoning.budgetTokens");
  const extensions = request.vendorExtensions ?? {};
  for (const namespace of Object.keys(extensions)) if (namespace !== "openai") throw unsupported(`vendorExtensions.${namespace}`);
  // Extensions go first, so a modelled field always wins over a passthrough one.
  const body: Json = { ...extensions.openai, model: request.model, messages: toMessages(request), stream };
  if (stream) body.stream_options = { include_usage: true };
  if (request.tools && request.tools.length > 0) {
    body.tools = request.tools.map((tool) => ({
      type: "function",
      function: { name: tool.name, description: tool.description, parameters: tool.parameters, ...(tool.strict !== undefined ? { strict: tool.strict } : {}) },
    }));
  }
  if (request.toolChoice !== undefined) {
    body.tool_choice = typeof request.toolChoice === "string" ? request.toolChoice : { type: "function", function: { name: request.toolChoice.name } };
  }
  // ponytail: max_completion_tokens only (OpenAI rejects max_tokens on reasoning models); add a
  // descriptor flag when a provider accepts only max_tokens.
  if (request.maxOutputTokens !== undefined) body.max_completion_tokens = request.maxOutputTokens;
  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (request.topP !== undefined) body.top_p = request.topP;
  if (request.stop !== undefined) body.stop = request.stop;
  if (request.reasoning?.effort !== undefined) body.reasoning_effort = request.reasoning.effort;
  return body;
}

// ---- chat completions -> CIP ----

function usageOf(value: unknown): TokenUsage {
  const usage = record(value);
  const cached = count(record(usage.prompt_tokens_details).cached_tokens);
  const reasoning = count(record(usage.completion_tokens_details).reasoning_tokens);
  return {
    inputTokens: Math.max(0, count(usage.prompt_tokens) - cached),
    outputTokens: count(usage.completion_tokens),
    ...(cached > 0 ? { cacheReadTokens: cached } : {}),
    ...(reasoning > 0 ? { reasoningTokens: reasoning } : {}),
  };
}

function stopReasonOf(finishReason: unknown, sawToolCall: boolean): StopReason {
  if (sawToolCall) return "tool_use";
  return STOP_REASONS.get(text(finishReason) ?? "") ?? "end_turn";
}

// ---- errors ----

function classifyStatus(status: number, upstreamCode: string | undefined): ErrorCode {
  if (status === 401 || status === 403) return "AUTH_ERROR";
  if (status === 402 || (status === 429 && upstreamCode === "insufficient_quota")) return "QUOTA_EXHAUSTED";
  if (status === 429) return "RATE_LIMIT";
  if (status === 404 || upstreamCode === "model_not_found") return "MODEL_UNAVAILABLE";
  if (status === 408) return "TIMEOUT";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  return "INVALID_REQUEST";
}

// Retry only what a second try can fix: 502/503/504, or a transport failure with no status.
// A redirect carries a 3xx status and a timeout has its own code, so neither is retried.
function isTransient(error: unknown): boolean {
  if (!(error instanceof EngineError) || error.code !== "PROVIDER_UNAVAILABLE") return false;
  const status = error.details.status;
  return status === undefined || (typeof status === "number" && RETRY_STATUSES.has(status));
}

export class OpenAICompatibleAdapter implements AIProviderPort {
  private readonly provider: ProviderDescriptor;
  private readonly transport: HttpTransportPort;
  private readonly known: ReadonlyMap<string, ModelDescriptor>;

  constructor(provider: ProviderDescriptor, transport: HttpTransportPort) {
    this.provider = provider;
    this.transport = transport;
    this.known = new Map(provider.models.map((model) => [model.id, model]));
  }

  async execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<CanonicalResponse> {
    const response = await this.send(this.chat(request, credential, false), credential, ctx, RETRY.maxAttempts);
    const root = parseJson(await readBoundedText(response.body));
    const choice = record(list(record(root).choices)[0]);
    if (!isRecord(root) || !isRecord(choice.message)) throw this.invalid("a chat response without choices[0].message");
    const message = choice.message;
    const content: ContentPart[] = [];
    const reasoning = text(message.reasoning_content);
    if (reasoning) content.push({ type: "thinking", text: reasoning });
    const body = text(message.content);
    if (body) content.push({ type: "text", text: body });
    for (const entry of list(message.tool_calls)) {
      const call = record(entry);
      const fn = record(call.function);
      const id = text(call.id);
      const name = text(fn.name);
      if (!id || !name) throw this.invalid("a tool call without an id or name");
      content.push({ type: "tool_call", id, name, arguments: text(fn.arguments) ?? "" });
    }
    const refusal = text(message.refusal);
    return {
      id: text(root.id) ?? "",
      model: text(root.model) ?? request.model,
      content,
      stopReason: stopReasonOf(choice.finish_reason, content.some((part) => part.type === "tool_call")),
      usage: usageOf(root.usage),
      ...(refusal ? { vendorExtensions: { openai: { refusal } } } : {}),
    };
  }

  // Errors before the first chunk are thrown from the first next(); the caller may fall back only then.
  async *stream(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): AsyncGenerator<StreamChunk> {
    const response = await this.send(this.chat(request, credential, true), credential, ctx, RETRY.maxAttempts);
    if (!response.body || !(response.headers["content-type"] ?? "").includes("text/event-stream")) {
      await response.body?.cancel();
      throw this.invalid("a non-SSE response to a streaming request");
    }
    let started = false;
    let finished = false;
    let sawToolCall = false;
    let stopReason: StopReason | undefined;
    let usage: TokenUsage | undefined;
    for await (const data of readSseData(response.body)) {
      if (data === "[DONE]") {
        finished = true;
        break;
      }
      const event = record(parseJson(data));
      if (Object.keys(event).length === 0) throw this.invalid("a stream event that is not a JSON object", started);
      if (isRecord(event.error) || typeof event.error === "string") throw this.streamError(event.error, credential, started);
      if (!started) {
        started = true;
        yield { type: "start", id: text(event.id) ?? "", model: text(event.model) ?? request.model };
      }
      if (isRecord(event.usage)) usage = usageOf(event.usage);
      const choice = record(list(event.choices)[0]);
      const delta = record(choice.delta);
      const reasoning = text(delta.reasoning_content);
      if (reasoning) yield { type: "thinking_delta", index: 0, text: reasoning };
      const content = text(delta.content);
      if (content) yield { type: "text_delta", index: 0, text: content };
      for (const entry of list(delta.tool_calls)) {
        const call = record(entry);
        const fn = record(call.function);
        const index = call.index;
        if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= MAX_TOOL_CALLS) {
          throw this.invalid(`a tool call index outside 0..${MAX_TOOL_CALLS - 1}`, true);
        }
        sawToolCall = true;
        const id = text(call.id);
        const name = text(fn.name);
        yield { type: "tool_call_delta", index, ...(id ? { id } : {}), ...(name ? { name } : {}), argumentsDelta: text(fn.arguments) ?? "" };
      }
      if (choice.finish_reason !== undefined && choice.finish_reason !== null) stopReason = stopReasonOf(choice.finish_reason, sawToolCall);
    }
    // A stream that just stops is a failure, never a normal end (fallback.partial-stream-failure).
    if (!finished && stopReason === undefined) {
      throw new EngineError("PROVIDER_UNAVAILABLE", `${this.provider.name} ended the stream before it finished`, { provider: this.provider.id, partial: started });
    }
    if (!started) yield { type: "start", id: "", model: request.model };
    if (usage) yield { type: "usage", usage };
    yield { type: "stop", stopReason: stopReason ?? (sawToolCall ? "tool_use" : "end_turn") };
  }

  async getModels(credential: Credential, ctx: ExecCtx): Promise<readonly ListedModel[]> {
    const response = await this.send(this.request("GET", this.provider.modelsUrl, credential, METADATA_TIMEOUT_MS), credential, ctx, RETRY.maxAttempts);
    const data = record(parseJson(await readBoundedText(response.body))).data;
    if (!Array.isArray(data)) throw this.invalid("a model list without a data array");
    const listed: ListedModel[] = [];
    for (const entry of data.slice(0, MAX_LISTED_MODELS)) {
      const id = text(record(entry).id);
      if (id === undefined || !MODEL_ID.test(id)) continue;
      const descriptor = this.known.get(id);
      listed.push(descriptor ? { id, descriptor } : { id });
    }
    return listed;
  }

  // One call, no retry. Only an answer about the key itself is returned; a network failure or a
  // 5xx says nothing about the key, so it is thrown.
  async validateCredential(credential: Credential, ctx: ExecCtx): Promise<CredentialStatus> {
    try {
      const response = await this.send(this.request("GET", this.provider.modelsUrl, credential, METADATA_TIMEOUT_MS), credential, ctx, 1);
      await response.body?.cancel();
      return { valid: true };
    } catch (error) {
      if (error instanceof EngineError && (error.code === "AUTH_ERROR" || error.code === "QUOTA_EXHAUSTED")) {
        return { valid: false, code: error.code, message: error.message };
      }
      throw error;
    }
  }

  private chat(request: CanonicalRequest, credential: Credential, stream: boolean): HttpRequest {
    const base = this.request("POST", this.provider.chatUrl, credential, stream ? STREAM_TIMEOUT_MS : CHAT_TIMEOUT_MS);
    return {
      ...base,
      headers: { ...base.headers, "content-type": "application/json", accept: stream ? "text/event-stream" : "application/json" },
      body: JSON.stringify(toBody(request, stream)),
    };
  }

  // Catalog headers first, the key last: a static header can never replace the credential.
  private request(method: HttpRequest["method"], url: string, credential: Credential, timeoutMs: number): HttpRequest {
    if (!API_KEY.test(credential.apiKey)) {
      throw new EngineError("AUTH_ERROR", `The ${this.provider.name} API key is empty, too long, or has spaces or control characters`, { provider: this.provider.id });
    }
    const { header, scheme } = this.provider.auth;
    const headers = { ...this.provider.headers, [header]: scheme === "bearer" ? `Bearer ${credential.apiKey}` : credential.apiKey };
    return { method, url, headers, timeoutMs };
  }

  // The only place the adapter retries, and only before any byte of a stream was used.
  private send(request: HttpRequest, credential: Credential, ctx: ExecCtx, maxAttempts: number): Promise<HttpResponse> {
    return withRetry(async () => {
      const response = await this.transport.send(request, ctx);
      if (response.status >= 200 && response.status < 300) return response;
      throw await this.upstreamError(response, credential, ctx);
    }, { ...RETRY, maxAttempts, signal: ctx.signal, shouldRetry: isTransient });
  }

  private async upstreamError(response: HttpResponse, credential: Credential, ctx: ExecCtx): Promise<EngineError> {
    // The status alone still classifies the failure if the body cannot be read; a caller abort cannot be swallowed.
    const raw = await readBoundedText(response.body, ERROR_BODY_BYTES).catch((error: unknown) => {
      if (ctx.signal.aborted) throw error;
      return "";
    });
    const root = record(parseJson(raw));
    const error = record(root.error);
    const upstreamCode = text(error.code) ?? text(error.type);
    const code = classifyStatus(response.status, upstreamCode);
    const message = this.clean(text(error.message) ?? text(root.error), credential);
    return new EngineError(code, `${this.provider.name} answered ${response.status}${message ? `: ${message}` : ""}`, {
      provider: this.provider.id, status: response.status, ...(upstreamCode ? { upstreamCode } : {}),
    });
  }

  private streamError(value: unknown, credential: Credential, partial: boolean): EngineError {
    const error = record(value);
    const message = this.clean(text(error.message) ?? text(value), credential);
    return new EngineError("PROVIDER_UNAVAILABLE", `${this.provider.name} sent an error in the stream${message ? `: ${message}` : ""}`, {
      provider: this.provider.id, partial,
    });
  }

  // Upstream text is shown to users: bounded, and never the credential, even if a provider echoes it.
  private clean(message: string | undefined, credential: Credential): string {
    return (message ?? "").split(credential.apiKey).join("***").slice(0, MAX_MESSAGE_CHARS);
  }

  private invalid(what: string, partial = false): EngineError {
    return new EngineError("PROVIDER_UNAVAILABLE", `${this.provider.name} sent ${what}`, { provider: this.provider.id, ...(partial ? { partial } : {}) });
  }
}
