import { type CanonicalRequest, type CanonicalResponse, type ContentPart, type StopReason, type StreamChunk, type TokenUsage } from "../cip.js";
import { EngineError } from "../errors.js";
import { readBoundedText } from "../http.js";
import { isRecord, parseJson, record, text } from "../json.js";
import type { AIProviderPort, Credential, CredentialStatus, ExecCtx, HttpResponse, ListedModel } from "../ports.js";
import type { ProviderDescriptor } from "../registry.js";

const META_TIMEOUT_MS = 15_000;
const CHAT_TIMEOUT_MS = 300_000;
const MAX_FRAME_BYTES = 4 * 1024 * 1024;
const MAX_STREAM_BYTES = 64 * 1024 * 1024;
const MAX_MODELS = 1_000;
const CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHES = 100;
const EVENT_TYPES = new Set(["assistantResponseEvent", "reasoningContentEvent", "codeEvent", "toolUseEvent", "messageStopEvent", "metadataEvent", "contextUsageEvent"]);
const cache = new Map<string, { expires: number; models: readonly ListedModel[] }>();
const decoder = new TextDecoder();
const encoder = new TextEncoder();
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  return crc >>> 0;
});
const clean = (value: unknown): Record<string, unknown> => isRecord(value) ? value : {};
const errorFor = (status: number, provider: string, message: string): EngineError => new EngineError(
  status === 401 || status === 403 ? "AUTH_ERROR" : status === 429 ? "RATE_LIMIT" : status === 404 ? "MODEL_UNAVAILABLE" : status >= 500 ? "PROVIDER_UNAVAILABLE" : "INVALID_REQUEST",
  `${provider} answered ${status}${message ? `: ${message.slice(0, 300)}` : ""}`, { provider, status },
);
const catText = (parts: readonly ContentPart[]): string => parts.filter((part): part is Extract<ContentPart, { type: "text" }> => part.type === "text").map((part) => part.text).join("\n");
const asBase64 = (value: string): string => value.replace(/-/g, "+").replace(/_/g, "/");
const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
const joinBytes = (left: Uint8Array, right: Uint8Array): Uint8Array => {
  const joined = new Uint8Array(left.byteLength + right.byteLength);
  joined.set(left); joined.set(right, left.byteLength);
  return joined;
};

function eventHeaders(bytes: Uint8Array, end: number): Record<string, string> {
  const result: Record<string, string> = {};
  let at = 0;
  while (at < end) {
    const n = bytes[at++];
    if (at + n + 1 > end) throw new Error("truncated Kiro EventStream header");
    const name = decoder.decode(bytes.subarray(at, at + n)); at += n;
    const type = bytes[at++];
    if (type === 7) {
      if (at + 2 > end) throw new Error("truncated Kiro EventStream string length");
      const size = (bytes[at] << 8) | bytes[at + 1]; at += 2;
      if (at + size > end) throw new Error("truncated Kiro EventStream string");
      result[name] = decoder.decode(bytes.subarray(at, at + size)); at += size;
    } else if (type === 6) {
      if (at + 2 > end) throw new Error("truncated Kiro EventStream bytes length");
      const size = (bytes[at] << 8) | bytes[at + 1]; at += 2 + size;
      if (at > end) throw new Error("truncated Kiro EventStream bytes");
    } else if (type === 2) at += 1;
    else if (type === 3) at += 2;
    else if (type === 4) at += 4;
    else if (type === 5 || type === 8) at += 8;
    else if (type === 9) at += 16;
    else if (type === 0 || type === 1) { /* boolean has no value bytes */ }
    else throw new Error("unknown Kiro EventStream header type");
    if (at > end) throw new Error("truncated Kiro EventStream header value");
  }
  return result;
}

async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<{ headers: Record<string, string>; payload: Record<string, unknown> }> {
  const reader = body.getReader();
  let pending: Uint8Array<ArrayBufferLike> = new Uint8Array();
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (value) {
        total += value.byteLength;
        if (total > MAX_STREAM_BYTES || value.byteLength > MAX_FRAME_BYTES) throw new Error("Kiro EventStream exceeded its byte bound");
        pending = joinBytes(pending, value);
      }
      let consumed = 0;
      while (pending.byteLength - consumed >= 12) {
        const view = new DataView(pending.buffer, pending.byteOffset + consumed, pending.byteLength - consumed);
        const frameLength = view.getUint32(0);
        const headerLength = view.getUint32(4);
        if (frameLength < headerLength + 16 || frameLength > MAX_FRAME_BYTES) throw new Error("invalid or oversized Kiro EventStream frame");
        if (pending.byteLength - consumed < frameLength) break;
        const frame = pending.subarray(consumed, consumed + frameLength);
        if (crc32(frame.subarray(0, 8)) !== new DataView(frame.buffer, frame.byteOffset + 8, 4).getUint32(0) || crc32(frame.subarray(0, frameLength - 4)) !== new DataView(frame.buffer, frame.byteOffset + frameLength - 4, 4).getUint32(0)) throw new Error("Kiro EventStream CRC check failed");
        const headers = eventHeaders(frame.subarray(12, 12 + headerLength), headerLength);
        const payload = record(parseJson(decoder.decode(frame.subarray(12 + headerLength, frameLength - 4))));
        yield { headers, payload };
        consumed += frameLength;
      }
      if (consumed) pending = pending.slice(consumed);
      if (pending.byteLength > MAX_FRAME_BYTES) throw new Error("incomplete Kiro EventStream frame exceeded its bound");
      if (done) {
        if (pending.byteLength) throw new Error("Kiro EventStream ended with an incomplete frame");
        return;
      }
    }
  } finally { await reader.cancel().catch(() => undefined); }
}

function requestBody(request: CanonicalRequest, credential: Credential): Record<string, unknown> {
  const model = request.model.replace(/-thinking(?=-agentic$|$)/, "").replace(/-agentic$/, "");
  const agentic = request.model.endsWith("-agentic") || request.model.endsWith("-thinking-agentic");
  const effort = request.reasoning?.effort;
  const budget = request.reasoning?.budgetTokens ?? (effort ? ({ low: 1024, medium: 8192, high: 24576 } as const)[effort] : undefined);
  const thinking = request.model.includes("-thinking") || (budget ?? 0) > 0;
  const thinkingBudget = Math.max(1, Math.min(32000, budget ?? 16000));
  const system = [catText(request.system ?? []), ...(thinking ? [`<thinking_mode>enabled</thinking_mode>\n<max_thinking_length>${thinkingBudget}</max_thinking_length>`] : []), ...(agentic ? ["You are an agent. Make file changes in small, verified steps and keep each operation focused."] : [])].filter(Boolean).join("\n\n");
  const messages: { role: string; content: string; images?: unknown[]; context?: Record<string, unknown>; tools?: unknown[] }[] = [];
  for (const message of request.messages) {
    const role = message.role === "assistant" ? "assistant" : "user";
    const parts = message.content;
    const content = parts.filter((part) => part.type === "text").map((part) => part.type === "text" ? part.text : "").join("\n");
    const previous = messages.at(-1);
    if (role === "user" && previous?.role === "user") previous.content += `\n\n${content}`;
    else if (role === "assistant" && previous?.role === "assistant") previous.content += `\n\n${content}`;
    else messages.push({ role, content });
    const target = messages.at(-1)!;
    for (const part of parts) {
      if (part.type === "image") {
        if (part.source.kind !== "base64") throw new EngineError("INVALID_REQUEST", "Kiro accepts images as base64 only", { provider: "kiro" });
        (target.images ??= []).push({ format: part.source.mediaType.split("/")[1] || "png", source: { bytes: asBase64(part.source.data) } });
      } else if (part.type === "tool_result") {
        const context = target.context ??= {};
        const results = Array.isArray(context.toolResults) ? context.toolResults : [];
        results.push({ toolUseId: part.toolCallId, status: part.isError ? "error" : "success", content: [{ text: catText(part.content) }] });
        context.toolResults = results;
      } else if (part.type === "tool_call") {
        let input: unknown = {};
        try { input = JSON.parse(part.arguments || "{}"); } catch { /* reference treats malformed arguments as an empty object */ }
        const context = target.context ??= {};
        const toolUses = Array.isArray(context.toolUses) ? context.toolUses : [];
        toolUses.push({ toolUseId: part.id, name: part.name, input });
        context.toolUses = toolUses;
      }
    }
  }
  const currentIndex = messages.findLastIndex((message) => message.role === "user");
  if (currentIndex < 0) messages.push({ role: "user", content: "" });
  const index = currentIndex < 0 ? messages.length - 1 : currentIndex;
  const [current] = messages.splice(index, 1);
  const history = messages.map((message) => message.role === "assistant"
    ? { assistantResponseMessage: { content: message.content || "...", ...(message.context?.toolUses ? { toolUses: message.context.toolUses } : {}) } }
    : { userInputMessage: { content: `${message.content}${system && messages[0] === message ? `<instructions>\n${system}\n</instructions>` : ""}`, modelId: model, origin: "AI_EDITOR", ...(message.images ? { images: message.images } : {}), ...(message.context ? { userInputMessageContext: message.context } : {}) } });
  const tools = (request.tools ?? []).slice(0, 128).map((tool) => ({ toolSpecification: { name: tool.name.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64), description: tool.description ?? "", inputSchema: { json: tool.parameters } } }));
  const profileArn = credential.providerData?.profileArn;
  return {
    conversationState: { chatTriggerType: "MANUAL", conversationId: credential.sessionId ?? crypto.randomUUID(), currentMessage: { userInputMessage: { content: `${current.content}${system ? `<instructions>\n${system}\n</instructions>` : ""}`, modelId: model, origin: "AI_EDITOR", ...(current.images ? { images: current.images } : {}), ...((current.context || tools.length) ? { userInputMessageContext: { ...current.context, ...(tools.length ? { tools } : {}) } } : {}) } }, history },
    ...(profileArn ? { profileArn } : {}),
    inferenceConfig: { maxTokens: Math.min(request.maxOutputTokens ?? 32000, 32000), ...(request.temperature !== undefined ? { temperature: request.temperature } : {}), ...(request.topP !== undefined ? { topP: request.topP } : {}) },
  };
}

function stopReason(value: unknown): StopReason {
  return value === "max_tokens" ? "max_tokens" : value === "content_filtered" ? "content_filter" : value === "tool_use" ? "tool_use" : "end_turn";
}

export class KiroAdapter implements AIProviderPort {
  constructor(private readonly provider: ProviderDescriptor, private readonly transport: import("../ports.js").HttpTransportPort) {}

  private headers(credential: Credential, url: string): Record<string, string> {
    if (!credential.apiKey || /[\r\n]/.test(credential.apiKey)) throw new EngineError("AUTH_ERROR", "Kiro access token is missing or invalid", { provider: "kiro" });
    const method = credential.providerData?.authMethod;
    return {
      ...this.provider.headers,
      ...(url.includes("codewhisperer.") ? { "x-amz-target": "AmazonCodeWhispererStreamingService.GenerateAssistantResponse" } : {}),
      "amz-sdk-request": "attempt=1; max=3", "amz-sdk-invocation-id": crypto.randomUUID(),
      authorization: `Bearer ${credential.apiKey}`,
      ...(method === "api_key" ? { tokentype: "API_KEY" } : method === "external_idp" ? { tokentype: "EXTERNAL_IDP" } : {}),
      "x-amz-sso-bearer": credential.apiKey,
      "x-amzn-kiro-agent-mode": "spec", "x-amzn-codewhisperer-machine-id": "kiro-desktop",
      ...(credential.providerData?.profileArn ? { "x-amzn-codewhisperer-profile-arn": credential.providerData.profileArn } : {}),
    };
  }

  private urls(credential: Credential): string[] {
    const region = credential.providerData?.region || "us-east-1";
    if (!/^[a-z]{2}-[a-z]+-\d{1,2}$/.test(region)) throw new EngineError("INVALID_REQUEST", "Invalid AWS region", { provider: "kiro" });
    return [`https://q.${region}.amazonaws.com/generateAssistantResponse`, `https://codewhisperer.${region}.amazonaws.com/generateAssistantResponse`, "https://runtime.us-east-1.kiro.dev/generateAssistantResponse"];
  }

  private async send(url: string, body: string | undefined, credential: Credential, ctx: ExecCtx, method: "GET" | "POST" = "POST"): Promise<HttpResponse> {
    return this.transport.send({ method, url, headers: this.headers(credential, url), ...(body === undefined ? {} : { body }), timeoutMs: method === "GET" ? META_TIMEOUT_MS : CHAT_TIMEOUT_MS }, ctx);
  }

  private async open(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<HttpResponse> {
    const body = JSON.stringify(requestBody(request, credential));
    let last: EngineError | undefined;
    for (const url of this.urls(credential)) {
      const response = await this.send(url, body, credential, ctx);
      if (response.status >= 200 && response.status < 300) return response;
      const raw = await readBoundedText(response.body, 64 * 1024).catch(() => "");
      const root = record(parseJson(raw));
      last = errorFor(response.status, this.provider.name, text(record(root.error).message) ?? text(root.message) ?? raw);
      if (![401, 403, 404].includes(response.status)) throw last;
    }
    throw last ?? new EngineError("PROVIDER_UNAVAILABLE", "Kiro has no available endpoint", { provider: "kiro" });
  }

  async *stream(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): AsyncGenerator<StreamChunk> {
    const response = await this.open(request, credential, ctx);
    if (!response.body) throw new EngineError("PROVIDER_UNAVAILABLE", "Kiro returned no EventStream body", { provider: "kiro" });
    yield { type: "start", id: crypto.randomUUID(), model: request.model };
    const tools = new Map<string, { index: number; name: string; args: string }>();
    let index = 0;
    let stopped: StopReason = "end_turn";
    for await (const event of readEvents(response.body)) {
      if (event.headers[":message-type"] === "error" || event.headers[":message-type"] === "exception") throw new EngineError("PROVIDER_UNAVAILABLE", text(event.payload.message) ?? "Kiro sent an EventStream error", { provider: "kiro", partial: index > 0 });
      const type = event.headers[":event-type"] ?? "";
      if (!EVENT_TYPES.has(type)) continue;
      if (type === "assistantResponseEvent" && typeof event.payload.content === "string") {
        const content = event.payload.content.replace(/<thinking>[\s\S]*?<\/thinking>/g, "");
        if (content) { yield { type: "text_delta", index: index++, text: content }; }
      } else if (type === "reasoningContentEvent") {
        const data = clean(event.payload.reasoningContentEvent ?? event.payload);
        const value = typeof event.payload.reasoningContentEvent === "string" ? event.payload.reasoningContentEvent : text(data.text) ?? text(data.content);
        if (value) yield { type: "thinking_delta", index: index++, text: value };
      } else if (type === "codeEvent" && typeof event.payload.content === "string") {
        yield { type: "text_delta", index: index++, text: event.payload.content };
      } else if (type === "toolUseEvent") {
        const values = Array.isArray(event.payload) ? event.payload : [event.payload];
        for (const raw of values) {
          const part = clean(raw); const id = text(part.toolUseId) ?? `call_${tools.size + 1}`; const name = text(part.name);
          if (!name) continue;
          const tool = tools.get(id) ?? { index: tools.size, name, args: "" };
          const argument = typeof part.input === "string" ? part.input : part.input === undefined ? "" : JSON.stringify(part.input);
          const first = !tools.has(id); tool.args += argument; tools.set(id, tool);
          yield { type: "tool_call_delta", index: tool.index, ...(first ? { id, name } : {}), argumentsDelta: argument };
        }
      } else if (type === "messageStopEvent" || type === "metadataEvent") {
        const reason = text(event.payload.stopReason) ?? text(clean(event.payload.metadataEvent).stopReason);
        stopped = stopReason(reason);
      } else if (type === "contextUsageEvent") {
        const usage = clean(event.payload.contextUsageEvent ?? event.payload);
        yield { type: "usage", usage: { inputTokens: typeof usage.inputTokens === "number" ? usage.inputTokens : 0, outputTokens: typeof usage.outputTokens === "number" ? usage.outputTokens : 0 } };
      }
    }
    yield { type: "stop", stopReason: tools.size ? "tool_use" : stopped };
  }

  async execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<CanonicalResponse> {
    const content: ContentPart[] = []; const calls = new Map<number, { id: string; name: string; arguments: string }>();
    let id = ""; let model = request.model; let stop: StopReason = "end_turn"; let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
    for await (const chunk of this.stream(request, credential, ctx)) {
      if (chunk.type === "start") { id = chunk.id; model = chunk.model; }
      else if (chunk.type === "text_delta") { const last = content.at(-1); if (last?.type === "text") content[content.length - 1] = { ...last, text: last.text + chunk.text }; else content.push({ type: "text", text: chunk.text }); }
      else if (chunk.type === "thinking_delta") content.push({ type: "thinking", text: chunk.text });
      else if (chunk.type === "tool_call_delta") { const call = calls.get(chunk.index) ?? { id: "", name: "", arguments: "" }; calls.set(chunk.index, { id: chunk.id ?? call.id, name: chunk.name ?? call.name, arguments: call.arguments + chunk.argumentsDelta }); }
      else if (chunk.type === "usage") usage = chunk.usage;
      else if (chunk.type === "stop") stop = chunk.stopReason;
    }
    for (const call of calls.values()) content.push({ type: "tool_call", ...call });
    return { id, model, content, stopReason: calls.size ? "tool_use" : stop, usage };
  }

  async getModels(credential: Credential, ctx: ExecCtx): Promise<readonly ListedModel[]> {
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(credential.apiKey));
    const key = credential.sessionId ?? credential.providerData?.profileArn ?? Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.models;
    const region = credential.providerData?.region || "us-east-1";
    const params = new URLSearchParams({ origin: "AI_EDITOR" });
    if (credential.providerData?.profileArn) params.set("profileArn", credential.providerData.profileArn);
    const url = `https://q.${region}.amazonaws.com/ListAvailableModels?${params}`;
    const response = await this.send(url, undefined, credential, ctx, "GET");
    if (response.status < 200 || response.status >= 300) {
      await readBoundedText(response.body, 64 * 1024).catch(() => "");
      return this.provider.models.map((descriptor) => ({ id: descriptor.id, descriptor }));
    }
    const root = record(parseJson(await readBoundedText(response.body, 1024 * 1024)));
    const models: ListedModel[] = [];
    for (const item of (Array.isArray(root.models) ? root.models : []).slice(0, MAX_MODELS)) {
      const model = clean(item); const id = text(model.modelId) ?? text(model.id);
      if (!id) continue;
      for (const suffix of id === "auto" ? ["", "-thinking"] : ["", "-thinking", "-agentic", "-thinking-agentic"]) models.push({ id: `${id}${suffix}`, ...(this.provider.models.find((entry) => entry.id === id) ? { descriptor: this.provider.models.find((entry) => entry.id === id) } : {}) });
    }
    if (!models.length) return this.provider.models.map((descriptor) => ({ id: descriptor.id, descriptor }));
    if (cache.size >= MAX_CACHES) cache.delete(cache.keys().next().value!);
    cache.set(key, { expires: Date.now() + CACHE_TTL_MS, models });
    return models;
  }

  async validateCredential(credential: Credential, ctx: ExecCtx): Promise<CredentialStatus> {
    const region = credential.providerData?.region || "us-east-1";
    if (!/^[a-z]{2}-[a-z]+-\d{1,2}$/.test(region)) return { valid: false, code: "INVALID_REQUEST", message: "Invalid AWS region" };
    const url = `https://q.${region}.amazonaws.com/ListAvailableModels?origin=AI_EDITOR`;
    try {
      const response = await this.send(url, undefined, credential, ctx, "GET");
      const raw = await readBoundedText(response.body, 1024 * 1024).catch(() => "");
      if (response.status < 200 || response.status >= 300) return { valid: false, code: errorFor(response.status, this.provider.name, raw).code, message: "Kiro API key validation failed" };
      const models = record(parseJson(raw)).models;
      return Array.isArray(models) && models.length > 0
        ? { valid: true }
        : { valid: false, code: "AUTH_ERROR", message: "Kiro returned no available models" };
    } catch (error) {
      if (error instanceof EngineError) return { valid: false, code: error.code, message: "Kiro API key validation failed" };
      throw error;
    }
  }
}
