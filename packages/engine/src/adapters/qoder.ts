import { UnsupportedFeatureError, type CanonicalRequest, type CanonicalResponse, type ContentPart, type StopReason, type StreamChunk, type TokenUsage } from "../cip.js";
import { EngineError } from "../errors.js";
import { isRecord, parseJson, record, type Json } from "../json.js";
import type { AIProviderPort, Credential, CredentialStatus, ExecCtx, HttpResponse, ListedModel } from "../ports.js";
import { MODEL_ID } from "../registry.js";
import { qoderBusinessFailure, qoderDecode, qoderError, qoderIdentity, qoderIOError, qoderJson, qoderReadBody, qoderScope, qoderSend, qoderUpstreamError, requireQoderAccessToken } from "../qoder.js";
import { collected } from "./collect.js";
import { HttpProviderAdapter } from "./http-adapter.js";

export const QODER_CHAT_URL = "https://api2-v2.qoder.sh/model/v1/chat/completions";
export const QODER_MODELS_URL = "https://api3.qoder.sh/algo/api/v2/model/list";
const MAX_RECORD = 1024 * 1024;
const MAX_TOTAL = 8 * MAX_RECORD;
const MAX_EVENTS = 32_768;
const MAX_ARGUMENTS = 256 * 1024;
const MAX_CALLS = 64;
const CHAT_TIMEOUT_MS = 300_000;
const encoder = new TextEncoder();
const NAME = /^[a-zA-Z0-9_-]{1,64}$/;
const CALL_ID = /^[\x21-\x7e]{1,256}$/;
const STOPS = new Map<string, StopReason>([["stop", "end_turn"], ["length", "max_tokens"], ["tool_calls", "tool_use"], ["content_filter", "content_filter"]]);
const protocol = () => qoderError("PROVIDER_UNAVAILABLE", "QODER_PROTOCOL_ERROR");
const unsupported = (feature: string) => new UnsupportedFeatureError(feature, "qoder");

function plain(parts: readonly ContentPart[]): string {
  return parts.map((part) => {
    if (part.type !== "text") throw unsupported(part.type);
    return part.text;
  }).join("");
}

// The shared OpenAI toBody is private. Keep this conversion text/tool-only rather than inherit its media/quirk paths.
function toBody(request: CanonicalRequest): string {
  if (!MODEL_ID.test(request.model)) throw qoderError("INVALID_REQUEST", "QODER_INVALID_MODEL");
  if (request.messages.length > 10_000 || (request.tools?.length ?? 0) > MAX_CALLS) throw qoderError("INVALID_REQUEST", "QODER_REQUEST_LIMIT");
  if (request.reasoning?.budgetTokens !== undefined) throw unsupported("reasoning.budgetTokens");
  for (const namespace of Object.keys(request.vendorExtensions ?? {})) if (namespace !== "openai") throw unsupported(`vendorExtensions.${namespace}`);
  const messages: Json[] = [];
  if (request.system?.length) messages.push({ role: "system", content: plain(request.system) });
  for (const message of request.messages) {
    if (message.content.length > 512) throw qoderError("INVALID_REQUEST", "QODER_REQUEST_LIMIT");
    const rest: ContentPart[] = [];
    for (const part of message.content) {
      if (part.type !== "tool_result") { rest.push(part); continue; }
      if (part.isError) throw unsupported("tool_result.isError");
      messages.push({ role: "tool", tool_call_id: part.toolCallId, content: plain(part.content) });
    }
    if (rest.length === 0) continue;
    if (message.role === "user") messages.push({ role: "user", content: plain(rest) });
    else if (message.role === "assistant") {
      const calls = rest.filter((part) => part.type === "tool_call");
      const content = plain(rest.filter((part) => part.type !== "tool_call"));
      messages.push({ role: "assistant", content: content || null, ...(calls.length ? { tool_calls: calls.map((part) => ({ id: part.id, type: "function", function: { name: part.name, arguments: part.arguments } })) } : {}) });
    } else throw unsupported("non-result tool content");
  }
  const body: Json = { ...request.vendorExtensions?.openai, model: request.model, messages, stream: true, stream_options: { include_usage: true } };
  // Never let an extension restore media or multiple choices, or override a canonical field.
  for (const field of ["tools", "tool_choice", "max_tokens", "max_completion_tokens", "temperature", "top_p", "stop", "reasoning_effort"]) delete body[field];
  if (body.n !== undefined && body.n !== 1) throw unsupported("n != 1");
  for (const field of ["modalities", "audio", "functions", "function_call"]) if (body[field] !== undefined) throw unsupported(field);
  if (request.tools?.length) body.tools = request.tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters, ...(tool.strict === undefined ? {} : { strict: tool.strict }) } }));
  if (request.toolChoice !== undefined) body.tool_choice = typeof request.toolChoice === "string" ? request.toolChoice : { type: "function", function: { name: request.toolChoice.name } };
  if (request.maxOutputTokens !== undefined) body.max_tokens = request.maxOutputTokens;
  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (request.topP !== undefined) body.top_p = request.topP;
  if (request.stop !== undefined) body.stop = request.stop;
  if (request.reasoning?.effort !== undefined) body.reasoning_effort = request.reasoning.effort;
  let serialized: string;
  try { serialized = JSON.stringify(body); } catch { throw qoderError("INVALID_REQUEST", "QODER_INVALID_REQUEST"); }
  if (encoder.encode(serialized).byteLength > MAX_TOTAL) throw qoderError("INVALID_REQUEST", "QODER_REQUEST_LIMIT");
  return serialized;
}

type Scope = ReturnType<typeof qoderScope>;
type SseRecord = { data: string; event: string };

async function* records(body: ReadableStream<Uint8Array>, scope: Scope): AsyncGenerator<SseRecord> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0;
  let recordBytes = 0;
  let count = 0;
  let pending = "";
  let pendingBytes = 0;
  let skipLF = false;
  let data: string[] = [];
  let event = "";
  try {
    for (;;) {
      const next = await scope.wait(reader.read());
      total += next.value?.byteLength ?? 0;
      if (total > MAX_TOTAL) throw qoderError("PROVIDER_UNAVAILABLE", "QODER_STREAM_LIMIT");
      let decoded = qoderDecode(decoder, next.done ? undefined : next.value);
      if (skipLF && decoded.startsWith("\n")) decoded = decoded.slice(1);
      if (decoded) skipLF = decoded.endsWith("\r");
      const lines = decoded.split(/\r\n|\r|\n/);
      const continued = lines.length === 1;
      lines[0] = pending + lines[0];
      pending = lines.pop() ?? "";
      // Only measure fresh fragments, not the growing pending line on every one-byte read.
      pendingBytes = continued ? pendingBytes + encoder.encode(decoded).byteLength : encoder.encode(pending).byteLength;
      for (const line of lines) {
        // Conservatively include CRLF framing, even for upstreams that use one-byte line endings.
        recordBytes += encoder.encode(line).byteLength + 2;
        if (recordBytes > MAX_RECORD) throw qoderError("PROVIDER_UNAVAILABLE", "QODER_RECORD_LIMIT");
        if (line === "") {
          if (++count > MAX_EVENTS) throw qoderError("PROVIDER_UNAVAILABLE", "QODER_EVENT_LIMIT");
          if (data.length || event === "error") yield { data: data.join("\n"), event };
          data = [];
          event = "";
          recordBytes = 0;
        } else if (line.startsWith("data:")) data.push(line.slice(line.startsWith("data: ") ? 6 : 5));
        else if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (!line.startsWith(":")) {
          // Unknown SSE fields are metadata, not assistant text.
          continue;
        }
      }
      if (pendingBytes + recordBytes > MAX_RECORD) throw qoderError("PROVIDER_UNAVAILABLE", "QODER_RECORD_LIMIT");
      if (next.done) {
        if (pending || data.length || event) throw protocol();
        return;
      }
    }
  } finally {
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function usageOf(value: unknown): TokenUsage {
  if (!isRecord(value)) throw protocol();
  const number = (item: unknown): number => {
    if (item === undefined) return 0;
    if (typeof item !== "number" || !Number.isSafeInteger(item) || item < 0) throw protocol();
    return item;
  };
  const cached = number(record(value.prompt_tokens_details).cached_tokens);
  const reasoning = number(record(value.completion_tokens_details).reasoning_tokens);
  const input = number(value.prompt_tokens);
  const output = number(value.completion_tokens);
  if (cached > input || reasoning > output) throw protocol();
  return { inputTokens: input - cached, outputTokens: output, ...(cached ? { cacheReadTokens: cached } : {}), ...(reasoning ? { reasoningTokens: reasoning } : {}) };
}

type ToolCall = { id: string; name: string; arguments: string; bytes: number };

function toolDelta(value: unknown, calls: Map<number, ToolCall>): StreamChunk {
  if (!isRecord(value) || !Number.isInteger(value.index) || typeof value.index !== "number" || value.index < 0 || value.index >= MAX_CALLS || value.type !== undefined && value.type !== "function") throw protocol();
  const index = value.index;
  const call = calls.get(index) ?? { id: "", name: "", arguments: "", bytes: 0 };
  const fn = value.function === undefined ? {} : value.function;
  if (!isRecord(fn)) throw protocol();
  if (value.id !== undefined) {
    if (typeof value.id !== "string" || !CALL_ID.test(value.id) || call.id && call.id !== value.id) throw protocol();
    call.id = value.id;
  }
  if (fn.name !== undefined) {
    if (typeof fn.name !== "string") throw protocol();
    if (call.name !== fn.name) call.name += fn.name;
    if (!NAME.test(call.name)) throw protocol();
  }
  const fragment = fn.arguments ?? "";
  if (typeof fragment !== "string") throw protocol();
  call.bytes += encoder.encode(fragment).byteLength;
  if (call.bytes > MAX_ARGUMENTS) throw qoderError("PROVIDER_UNAVAILABLE", "QODER_TOOL_ARGUMENT_LIMIT");
  call.arguments += fragment;
  calls.set(index, call);
  return { type: "tool_call_delta", index, ...(call.id ? { id: call.id } : {}), ...(call.name ? { name: call.name } : {}), argumentsDelta: fragment };
}

function validateCalls(calls: Map<number, ToolCall>): void {
  const ids = new Set<string>();
  for (const call of calls.values()) {
    if (!CALL_ID.test(call.id) || !NAME.test(call.name) || ids.has(call.id) || !isRecord(parseJson(call.arguments))) throw qoderError("PROVIDER_UNAVAILABLE", "QODER_INVALID_TOOL_CALL");
    ids.add(call.id);
  }
}

async function chatResponse(response: HttpResponse, scope: Scope): Promise<ReadableStream<Uint8Array>> {
  if (response.status !== 200 || !response.body || !(response.headers["content-type"] ?? "").toLowerCase().includes("text/event-stream")) {
    const raw = response.body ? await qoderReadBody(response, scope, 64 * 1024) : "";
    const root = parseJson(raw);
    if (response.status !== 200 || isRecord(root) && qoderBusinessFailure(root)) throw qoderUpstreamError(response.status, root, response.headers);
    throw protocol();
  }
  return response.body;
}

export class QoderAdapter extends HttpProviderAdapter implements AIProviderPort {
  async execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<CanonicalResponse> {
    return collected(this.stream(request, credential, ctx), request.model);
  }

  async *stream(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): AsyncGenerator<StreamChunk> {
    requireQoderAccessToken(credential.apiKey);
    const body = toBody(request);
    const scope = qoderScope(ctx, CHAT_TIMEOUT_MS);
    let submitted = false;
    let started = false;
    try {
      scope.ctx.signal.throwIfAborted();
      submitted = true;
      // No inherited send(): even a failure before response headers may have executed upstream.
      const response = await qoderSend({ transport: this.transport, ctx }, { method: "POST", url: QODER_CHAT_URL, headers: { authorization: `Bearer ${credential.apiKey}`, "content-type": "application/json", accept: "text/event-stream" }, body, timeoutMs: CHAT_TIMEOUT_MS, noReplay: true }, scope);
      const stream = await chatResponse(response, scope);
      const calls = new Map<number, ToolCall>();
      let stop: StopReason | undefined;
      let done = false;
      let usage: TokenUsage | undefined;
      for await (const frame of records(stream, scope)) {
        const data = frame.data.trim();
        if (frame.event !== "error" && (data.startsWith("notification:") || data.startsWith("[NOTIFICATION]"))) continue;
        if (data === "[DONE]") {
          if (frame.event === "error" || done || !started || stop === undefined) throw protocol();
          validateCalls(calls);
          if (stop === "tool_use" && calls.size === 0) throw protocol();
          done = true;
          continue;
        }
        const root = parseJson(data);
        if (!isRecord(root)) throw protocol();
        if (frame.event === "error" || root.type === "error" || qoderBusinessFailure(root)) throw qoderUpstreamError(200, root, response.headers);
        if (frame.event === "notification" || root.type === "notification") continue;
        if (done) throw protocol();
        if (!Array.isArray(root.choices) || root.choices.length > 1) throw protocol();
        if (root.usage !== undefined && root.usage !== null) usage = usageOf(root.usage);
        if (root.choices.length === 0) {
          if (root.usage === undefined || root.usage === null) throw protocol();
          continue;
        }
        const choice = root.choices[0];
        if (!isRecord(choice) || choice.index !== undefined && choice.index !== 0 || !isRecord(choice.delta) || stop !== undefined) throw protocol();
        const delta = choice.delta;
        if (delta.role !== undefined && delta.role !== "assistant") throw protocol();
        if (!started) {
          if (root.id !== undefined && (typeof root.id !== "string" || !CALL_ID.test(root.id)) || root.model !== undefined && (typeof root.model !== "string" || !MODEL_ID.test(root.model))) throw protocol();
          started = true;
          yield { type: "start", id: typeof root.id === "string" ? root.id : "", model: typeof root.model === "string" ? root.model : request.model };
        }
        if (delta.function_call !== undefined || delta.images !== undefined || delta.audio !== undefined || delta.refusal !== undefined && delta.refusal !== null) throw protocol();
        for (const field of ["content", "reasoning_content"]) {
          const text = delta[field];
          if (text !== undefined && text !== null && typeof text !== "string") throw protocol();
          if (typeof text === "string" && text) yield { type: field === "content" ? "text_delta" : "thinking_delta", index: 0, text };
        }
        if (delta.tool_calls !== undefined) {
          if (!Array.isArray(delta.tool_calls) || delta.tool_calls.length > MAX_CALLS) throw protocol();
          for (const call of delta.tool_calls) yield toolDelta(call, calls);
        }
        if (choice.finish_reason !== undefined && choice.finish_reason !== null) {
          if (typeof choice.finish_reason !== "string") throw protocol();
          stop = STOPS.get(choice.finish_reason);
          if (stop === undefined) throw protocol();
        }
      }
      if (!done || !started || stop === undefined) throw protocol();
      // Wait through EOF: errors/reader failures after finish_reason or [DONE] must not become success.
      scope.ctx.signal.throwIfAborted();
      if (usage) yield { type: "usage", usage };
      scope.ctx.signal.throwIfAborted();
      yield { type: "stop", stopReason: stop };
    } catch (error) {
      const failure = qoderIOError(error, scope.ctx);
      throw new EngineError(failure.code, failure.message, { ...failure.details, partial: started, ...(submitted ? { noReplay: true } : {}) });
    } finally { scope.close(); }
  }

  async getModels(credential: Credential, ctx: ExecCtx): Promise<readonly ListedModel[]> {
    requireQoderAccessToken(credential.apiKey);
    const { root } = await qoderJson({ transport: this.transport, ctx }, { method: "GET", url: QODER_MODELS_URL, headers: { accept: "application/json", authorization: `Bearer ${credential.apiKey}` } });
    const data = isRecord(root.data) ? root.data : root;
    if (qoderBusinessFailure(data)) throw qoderUpstreamError(200, data);
    const models = Array.isArray(root.data) ? root.data : data.models;
    if (!Array.isArray(models) || models.length > 1000) throw qoderError("PROVIDER_UNAVAILABLE", "QODER_MODEL_LIST_PROTOCOL_ERROR");
    const listed: ListedModel[] = [];
    const seen = new Set<string>();
    for (const entry of models) {
      const item = record(entry);
      const id = item.id ?? item.model_id ?? item.modelId;
      if (typeof id !== "string" || !MODEL_ID.test(id)) throw qoderError("PROVIDER_UNAVAILABLE", "QODER_MODEL_LIST_PROTOCOL_ERROR");
      if (seen.has(id)) continue;
      seen.add(id);
      const descriptor = this.known.get(id);
      listed.push(descriptor ? { id, descriptor } : { id });
    }
    return listed;
  }

  async validateCredential(credential: Credential, ctx: ExecCtx): Promise<CredentialStatus> {
    try {
      await qoderIdentity(credential.apiKey, { transport: this.transport, ctx });
      return { valid: true };
    } catch (error) {
      if (ctx.signal.aborted) throw error;
      const failure = qoderIOError(error, ctx);
      if (failure.code !== "AUTH_ERROR" && failure.code !== "QUOTA_EXHAUSTED") throw failure;
      return { valid: false, code: failure.code, message: failure.message };
    }
  }
}
