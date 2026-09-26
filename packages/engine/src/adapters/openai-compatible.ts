import { UnsupportedFeatureError, type CanonicalRequest, type CanonicalResponse, type ContentPart, type MediaSource, type StopReason, type StreamChunk, type TokenUsage } from "../cip.js";
import { EngineError } from "../errors.js";
import { DEFAULT_MAX_BODY_BYTES, readBoundedText } from "../http.js";
import { isRecord, list, parseJson, record, text, type Json } from "../json.js";
import type { AIProviderPort, Credential, CredentialStatus, ExecCtx, HttpRequest, ListedModel } from "../ports.js";
import { MODEL_ID } from "../registry.js";
import { readSseData } from "../sse.js";
import { classifyStatus, count, HttpProviderAdapter, METADATA_TIMEOUT_MS, RETRY } from "./http-adapter.js";

// AIProviderPort for the openai-compatible family (docs/contracts/provider-openai.md).

const TARGET = "openai-compatible";
const CHAT_TIMEOUT_MS = 300_000;
// ponytail: the transport deadline bounds the whole stream until the SP12 idle timeout exists.
const STREAM_TIMEOUT_MS = 600_000;
const MAX_LISTED_MODELS = 1_000;
const MAX_TOOL_CALLS = 128;
const AUDIO_FORMATS = new Map([["audio/wav", "wav"], ["audio/x-wav", "wav"], ["audio/mpeg", "mp3"], ["audio/mp3", "mp3"]]);
const STOP_REASONS = new Map<string, StopReason>([
  ["stop", "end_turn"], ["length", "max_tokens"], ["tool_calls", "tool_use"], ["function_call", "tool_use"], ["content_filter", "content_filter"],
]);

// provider.codebuddy-request-quirks, kept as 9router has it (user decision 2026-09-26).
const NEUTRAL_PROMPT = "You are a helpful AI assistant that helps with software engineering tasks.";
const MAX_SYSTEM_PROMPT = 2000;
const AGENT_PATTERN = /you are claude code|claude.?code.+official.+cli|anthropic.+official.+cli|anxthxropic.+official.+cli|you are (?:cursor|windsurf|cline|aider|continue|copilot|cody)|you are an? (?:ai )?(?:coding |code )?agent|cc_entrypoint\s*=\s*(?:cli|vscode|jetbrains|gui)|claude.?code.+issues|give feedback.+claude.?code|you are .{0,30}(?:powerful )?ai agent|orchestration capabilities|OhMyOpenCode|<agent-identity>|<Role>|<Behavior_Instructions>/i;

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

// Replaces a system message that is long or reads like a coding agent, keeping its string or block shape.
function neutralAgentPrompt(message: Json): Json {
  if (message.role !== "system") return message;
  const content = message.content;
  const prompt = typeof content === "string" ? content : list(content).map((block) => text(record(block).text) ?? "").join("\n");
  if (prompt === "" || (prompt.length <= MAX_SYSTEM_PROMPT && !AGENT_PATTERN.test(prompt))) return message;
  return { ...message, content: typeof content === "string" ? NEUTRAL_PROMPT : [{ type: "text", text: NEUTRAL_PROMPT }] };
}

// What the 9router CodeBuddy executors change in the finished body.
function applyQuirks(body: Json, quirks: readonly string[]): void {
  if (quirks.includes("reasoningSummary")) {
    const effort = body.reasoning_effort;
    if (effort === "none" || effort === "off") delete body.reasoning_effort;
    else if (effort) body.reasoning_summary = "auto";
  }
  if (quirks.includes("neutralAgentPrompt")) body.messages = list(body.messages).map((message) => neutralAgentPrompt(record(message)));
}

function toBody(request: CanonicalRequest, stream: boolean, quirks: readonly string[] = []): Json {
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
  applyQuirks(body, quirks);
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

export class OpenAICompatibleAdapter extends HttpProviderAdapter implements AIProviderPort {
  async execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<CanonicalResponse> {
    const streamOnly = this.provider.streamOnly === true;
    const response = await this.send(this.chat(request, credential, streamOnly), credential, ctx, RETRY.maxAttempts);
    // routing.forced-stream-json-collapse: 9router buffers a stream-only answer without a size limit (user decision
    // 2026-09-26); only the transport deadline bounds it. Every other JSON answer keeps the 4 MiB cap.
    const raw = await readBoundedText(response.body, streamOnly ? Number.MAX_SAFE_INTEGER : DEFAULT_MAX_BODY_BYTES);
    if (streamOnly && (response.headers["content-type"] ?? "").includes("text/event-stream")) return this.collapse(raw, request, credential);
    const root = parseJson(raw);
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
      body: JSON.stringify(toBody(request, stream, this.provider.quirks)),
    };
  }

  // routing.forced-stream-json-collapse, kept as 9router has it (user decision 2026-09-26): unparsable lines are
  // skipped, a stream cut off before its end is a complete answer, and reasoning is dropped when there is content.
  private collapse(raw: string, request: CanonicalRequest, credential: Credential): CanonicalResponse {
    const chunks: Json[] = [];
    let failure: unknown;
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "" || payload === "[DONE]") continue;
      const chunk = parseJson(payload);
      if (!isRecord(chunk)) continue;
      if (chunk.error) failure = chunk.error;
      else chunks.push(chunk);
    }
    if (failure !== undefined) throw this.collapsedError(failure, credential);
    const first = chunks[0];
    if (first === undefined) throw this.invalid("an SSE response without data to a non-streaming request");
    let content = "";
    let reasoning = "";
    let finishReason: unknown;
    let usage: unknown;
    const calls = new Map<number, { id: string; name: string; arguments: string }>();
    for (const chunk of chunks) {
      const choice = record(list(chunk.choices)[0]);
      const delta = record(choice.delta);
      content += text(delta.content) ?? "";
      reasoning += text(delta.reasoning_content) ?? "";
      if (choice.finish_reason) finishReason = choice.finish_reason;
      if (isRecord(chunk.usage)) usage = chunk.usage;
      for (const entry of list(delta.tool_calls)) {
        const call = record(entry);
        const fn = record(call.function);
        const index = typeof call.index === "number" ? call.index : 0;
        const merged = calls.get(index) ?? { id: "", name: "", arguments: "" };
        calls.set(index, { id: text(call.id) || merged.id, name: merged.name + (text(fn.name) ?? ""), arguments: merged.arguments + (text(fn.arguments) ?? "") });
      }
    }
    const parts: ContentPart[] = [];
    if (reasoning && !content) parts.push({ type: "thinking", text: reasoning });
    if (content) parts.push({ type: "text", text: content });
    for (const [, call] of [...calls].sort((a, b) => a[0] - b[0])) parts.push({ type: "tool_call", ...call });
    return {
      id: text(first.id) ?? "",
      model: text(first.model) || request.model,
      content: parts,
      stopReason: stopReasonOf(finishReason, calls.size > 0),
      usage: usageOf(usage),
    };
  }

  // An error event keeps the upstream status when it is 400..599, as 9router does; the message is bounded and redacted.
  private collapsedError(value: unknown, credential: Credential): EngineError {
    const error = record(value);
    const status = Number(error.status);
    const known = Number.isInteger(status) && status >= 400 && status <= 599;
    const message = this.clean(text(error.message) || "Upstream SSE stream failed", credential);
    return new EngineError(known ? classifyStatus(status, text(error.code) ?? text(error.type)) : "PROVIDER_UNAVAILABLE",
      `${this.provider.name} sent an error in the stream: ${message}`, { provider: this.provider.id, ...(known ? { status } : {}) });
  }
}
