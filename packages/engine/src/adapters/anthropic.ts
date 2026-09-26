import { UnsupportedFeatureError, type CanonicalRequest, type CanonicalResponse, type ContentPart, type MediaSource, type StopReason, type StreamChunk, type TokenUsage } from "../cip.js";
import { EngineError } from "../errors.js";
import { readBoundedText } from "../http.js";
import { isRecord, parseJson, record, text, type Json } from "../json.js";
import type { AIProviderPort, Credential, CredentialStatus, ExecCtx, HttpRequest, ListedModel } from "../ports.js";
import { MODEL_ID } from "../registry.js";
import { readSseData } from "../sse.js";
import { count, HttpProviderAdapter, METADATA_TIMEOUT_MS, RETRY } from "./http-adapter.js";

// AIProviderPort for the Anthropic Messages family (docs/contracts/provider-anthropic.md).

const TARGET = "anthropic";
const CHAT_TIMEOUT_MS = 300_000;
const STREAM_TIMEOUT_MS = 600_000;
const MAX_LISTED_MODELS = 1_000;
const MAX_TOOL_CALLS = 128;
// translator.openai-to-claude-request: the 9router output budget rules.
const DEFAULT_MAX_TOKENS = 64_000;
const MIN_MAX_TOKENS_WITH_TOOLS = 32_000;
const THINKING_HEADROOM = 1_024;
const MIN_THINKING_BUDGET = 1_024;
const THINKING_BUDGETS = { low: 1_024, medium: 8_192, high: 24_576 } as const;
const STOP_REASONS = new Map<string, StopReason>([
  ["end_turn", "end_turn"], ["stop_sequence", "stop_sequence"], ["max_tokens", "max_tokens"], ["tool_use", "tool_use"],
  ["refusal", "content_filter"], ["model_context_window_exceeded", "max_tokens"],
]);
const CONTENT_BLOCKS = new Set(["text", "thinking", "redacted_thinking", "tool_use"]);
// connection.anthropic-compatible-node, kept as 9router has it (user decision 2026-09-26): claude-* models on a
// custom Anthropic node get the Claude Code beta list, and the connection test is 9router's.
const CLAUDE_CODE_BETA = "claude-code-20250219";
const REDACT_THINKING_BETA = "redact-thinking-2026-02-12";
const NODE_BETAS = [
  CLAUDE_CODE_BETA, "oauth-2025-04-20", "interleaved-thinking-2025-05-14", "context-management-2025-06-27", "prompt-caching-scope-2026-01-05",
  "structured-outputs-2025-12-15", "fast-mode-2026-02-01", REDACT_THINKING_BETA, "token-efficient-tools-2026-03-28",
];
const HEAVY_AGENT_BETAS = ["advanced-tool-use-2025-11-20", "effort-2025-11-24"];
const NODE_TEST_MODEL = "claude-3-haiku-20240307";

function nodeBetas(body: Json, official: boolean): string | undefined {
  const model = text(body.model) ?? "";
  if (!model.startsWith("claude-")) return undefined;
  const summarized = record(body.thinking).display === "summarized";
  const flags = NODE_BETAS.filter((flag) => (official || flag !== CLAUDE_CODE_BETA) && !(summarized && flag === REDACT_THINKING_BETA));
  if (/^claude-(opus|sonnet)/.test(model)) flags.push(...HEAVY_AGENT_BETAS);
  return flags.join(",");
}

const unsupported = (feature: string) => new UnsupportedFeatureError(feature, TARGET);

// ---- CIP -> Messages ----

function source(value: MediaSource): Json {
  return value.kind === "url" ? { type: "url", url: value.url } : { type: "base64", media_type: value.mediaType, data: value.data };
}

function textBlock(part: { text: string; cacheControl?: "ephemeral" }): Json {
  return { type: "text", text: part.text, ...(part.cacheControl ? { cache_control: { type: "ephemeral" } } : {}) };
}

function imageBlock(part: Extract<ContentPart, { type: "image" }>): Json {
  if (part.detail !== undefined && part.detail !== "auto") throw unsupported(`image detail "${part.detail}"`);
  return { type: "image", source: source(part.source) };
}

// A previous turn's arguments must be a JSON object: Messages carries tool input as an object, not a string.
function toolInput(args: string): Json {
  if (args.trim() === "") return {};
  const value = parseJson(args);
  if (!isRecord(value)) throw new EngineError("INVALID_REQUEST", "A tool call's arguments are not a JSON object, so they cannot be sent to Anthropic", {});
  return value;
}

function userBlock(part: ContentPart): Json {
  switch (part.type) {
    case "text": return textBlock(part);
    case "image": return imageBlock(part);
    case "file":
      if (part.mediaType !== "application/pdf") throw unsupported(`a ${part.mediaType} file (only PDF documents)`);
      return { type: "document", source: source(part.source) };
    case "tool_result":
      return {
        type: "tool_result", tool_use_id: part.toolCallId,
        content: part.content.map((inner) => {
          if (inner.type === "text") return textBlock(inner);
          if (inner.type === "image") return imageBlock(inner);
          throw unsupported(`${inner.type} in a tool result`);
        }),
        ...(part.isError ? { is_error: true } : {}),
      };
    default: throw unsupported(`${part.type} in a user message`);
  }
}

function assistantBlock(part: ContentPart): Json {
  switch (part.type) {
    case "text": return textBlock(part);
    case "tool_call": return { type: "tool_use", id: part.id, name: part.name, input: toolInput(part.arguments) };
    case "thinking":
      if (part.redacted) return { type: "redacted_thinking", data: part.text };
      if (part.signature === undefined) throw unsupported("thinking without a signature");
      return { type: "thinking", thinking: part.text, signature: part.signature };
    default: throw unsupported(`${part.type} in an assistant message`);
  }
}

// user and tool turns are user turns; same-role turns merge, and a user turn lists its tool results first.
function toMessages(request: CanonicalRequest): Json[] {
  const turns: { role: "user" | "assistant"; content: Json[] }[] = [];
  for (const message of request.messages) {
    if (message.content.length === 0) continue;
    const role = message.role === "assistant" ? "assistant" : "user";
    const blocks = message.content.map((part) => (role === "assistant" ? assistantBlock(part) : userBlock(part)));
    const last = turns.at(-1);
    if (last?.role === role) last.content.push(...blocks);
    else turns.push({ role, content: blocks });
  }
  return turns.map(({ role, content }) => ({
    role,
    content: role === "user" ? [...content.filter((b) => b.type === "tool_result"), ...content.filter((b) => b.type !== "tool_result")] : content,
  }));
}

function toolChoice(request: CanonicalRequest, disableParallel: boolean): Json | undefined {
  const choice = request.toolChoice;
  const base: Json | undefined = choice === undefined ? undefined
    : choice === "auto" ? { type: "auto" }
    : choice === "none" ? { type: "none" }
    : choice === "required" ? { type: "any" }
    : { type: "tool", name: choice.name };
  if (!disableParallel) return base;
  return { ...(base ?? { type: "auto" }), disable_parallel_tool_use: true };
}

// Only the OpenAI fields Messages can express; any other one is refused, never dropped.
function openaiExtensions(fields: Readonly<Record<string, unknown>>): { metadata?: Json; disableParallel: boolean } {
  let metadata: Json | undefined;
  let disableParallel = false;
  for (const [key, value] of Object.entries(fields)) {
    if (key === "user" && typeof value === "string") metadata = { user_id: value };
    else if (key === "parallel_tool_calls" && typeof value === "boolean") disableParallel = !value;
    else throw unsupported(`vendorExtensions.openai.${key}`);
  }
  return { ...(metadata ? { metadata } : {}), disableParallel };
}

// ---- Messages -> CIP ----

// Anthropic input_tokens already excludes cache reads and writes, which is the CIP convention.
function usageOf(usage: Record<string, unknown>): TokenUsage {
  const cacheRead = count(usage.cache_read_input_tokens);
  const cacheWrite = count(usage.cache_creation_input_tokens);
  return {
    inputTokens: count(usage.input_tokens),
    outputTokens: count(usage.output_tokens),
    ...(cacheRead > 0 ? { cacheReadTokens: cacheRead } : {}),
    ...(cacheWrite > 0 ? { cacheWriteTokens: cacheWrite } : {}),
  };
}

function stopReasonOf(reason: unknown, sawToolCall: boolean): StopReason {
  if (sawToolCall) return "tool_use";
  return STOP_REASONS.get(typeof reason === "string" ? reason : "") ?? "end_turn";
}

export class AnthropicAdapter extends HttpProviderAdapter implements AIProviderPort {
  async execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<CanonicalResponse> {
    const response = await this.send(this.chat(request, credential, false), credential, ctx, RETRY.maxAttempts);
    const root = parseJson(await readBoundedText(response.body));
    if (!isRecord(root) || !Array.isArray(root.content)) throw this.invalid("a message without a content array");
    const content = root.content.map((entry) => this.part(record(entry)));
    return {
      id: text(root.id) ?? "",
      model: text(root.model) ?? request.model,
      content,
      stopReason: stopReasonOf(root.stop_reason, content.some((part) => part.type === "tool_call")),
      usage: usageOf(record(root.usage)),
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
    let stopReason: unknown;
    let usage: Record<string, unknown> = {};
    // Messages numbers every content block; OpenAI numbers tool calls only.
    const toolIndex = new Map<number, number>();
    for await (const data of readSseData(response.body)) {
      const event = record(parseJson(data));
      const type = text(event.type);
      if (type === undefined) throw this.invalid("a stream event without a type", started);
      if (type === "ping") continue;
      if (type === "error") throw this.streamError(event.error, credential, started);
      if (type === "message_stop") {
        finished = true;
        break;
      }
      if (!started) {
        started = true;
        const message = record(event.message);
        yield { type: "start", id: text(message.id) ?? "", model: text(message.model) ?? request.model };
      }
      if (type === "message_start") usage = { ...record(record(event.message).usage) };
      else if (type === "message_delta") {
        usage = { ...usage, ...record(event.usage) };
        const reason = record(event.delta).stop_reason;
        if (reason !== undefined && reason !== null) stopReason = reason;
      } else if (type === "content_block_start" || type === "content_block_delta") {
        yield* this.blockEvent(type, event, toolIndex);
      }
      // content_block_stop and event types added later carry nothing to forward.
    }
    // A stream that just stops is a failure, never a normal end (fallback.partial-stream-failure).
    if (!finished) {
      throw new EngineError("PROVIDER_UNAVAILABLE", `${this.provider.name} ended the stream before it finished`, { provider: this.provider.id, partial: started });
    }
    if (!started) yield { type: "start", id: "", model: request.model };
    yield { type: "usage", usage: usageOf(usage) };
    yield { type: "stop", stopReason: stopReasonOf(stopReason, toolIndex.size > 0) };
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

  // One call, no retry: the free model list, or a 1-token message where a compatible host has no list.
  // Only an answer about the key itself is returned; anything else says nothing about the key, so it is thrown.
  async validateCredential(credential: Credential, ctx: ExecCtx): Promise<CredentialStatus> {
    if (this.provider.anthropicNode) return this.nodeTest(credential, ctx);
    try {
      const response = await this.send(this.request("GET", this.provider.modelsUrl, credential, METADATA_TIMEOUT_MS), credential, ctx, 1)
        .catch((error: unknown) => {
          const probe = this.provider.models.find((m) => m.kind === "chat")?.id;
          if (!(error instanceof EngineError) || error.code !== "MODEL_UNAVAILABLE" || probe === undefined) throw error;
          const body = { model: probe, max_tokens: 1, messages: [{ role: "user", content: "hi" }] };
          return this.send(this.post(body, credential, METADATA_TIMEOUT_MS, false), credential, ctx, 1);
        });
      await response.body?.cancel();
      return { valid: true };
    } catch (error) {
      if (error instanceof EngineError && (error.code === "AUTH_ERROR" || error.code === "QUOTA_EXHAUSTED")) {
        return { valid: false, code: error.code, message: error.message };
      }
      throw error;
    }
  }

  private *blockEvent(type: string, event: Record<string, unknown>, toolIndex: Map<number, number>): Generator<StreamChunk> {
    const index = event.index;
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0) throw this.invalid("a content block without an index", true);
    if (type === "content_block_start") {
      const block = record(event.content_block);
      const kind = text(block.type) ?? "";
      if (!CONTENT_BLOCKS.has(kind)) throw this.invalid(`an unsupported content block "${kind}"`, true);
      if (kind === "tool_use") {
        if (toolIndex.size >= MAX_TOOL_CALLS) throw this.invalid(`more than ${MAX_TOOL_CALLS} tool calls`, true);
        const id = text(block.id);
        const name = text(block.name);
        if (!id || !name) throw this.invalid("a tool call without an id or name", true);
        toolIndex.set(index, toolIndex.size);
        yield { type: "tool_call_delta", index: toolIndex.size - 1, id, name, argumentsDelta: "" };
      }
      const initial = text(block.text);
      if (kind === "text" && initial) yield { type: "text_delta", index: 0, text: initial };
      return;
    }
    const delta = record(event.delta);
    switch (text(delta.type)) {
      case "text_delta": {
        const value = text(delta.text);
        if (value) yield { type: "text_delta", index: 0, text: value };
        return;
      }
      case "thinking_delta": {
        const value = text(delta.thinking);
        if (value) yield { type: "thinking_delta", index: 0, text: value };
        return;
      }
      case "signature_delta": {
        const signature = text(delta.signature);
        if (signature) yield { type: "thinking_delta", index: 0, text: "", signature };
        return;
      }
      case "input_json_delta": {
        const tool = toolIndex.get(index);
        if (tool === undefined) throw this.invalid("tool arguments for a block that is not a tool call", true);
        yield { type: "tool_call_delta", index: tool, argumentsDelta: text(delta.partial_json) ?? "" };
        return;
      }
      default: return;
    }
  }

  private part(block: Record<string, unknown>): ContentPart {
    switch (block.type) {
      case "text": return { type: "text", text: text(block.text) ?? "" };
      case "thinking": {
        const signature = text(block.signature);
        return { type: "thinking", text: text(block.thinking) ?? "", ...(signature ? { signature } : {}) };
      }
      case "redacted_thinking": return { type: "thinking", text: text(block.data) ?? "", redacted: true };
      case "tool_use": {
        const id = text(block.id);
        const name = text(block.name);
        if (!id || !name) throw this.invalid("a tool call without an id or name");
        return { type: "tool_call", id, name, arguments: JSON.stringify(block.input ?? {}) };
      }
      default: throw this.invalid(`an unsupported content block "${text(block.type) ?? ""}"`);
    }
  }

  private body(request: CanonicalRequest, stream: boolean): Json {
    const extensions = request.vendorExtensions ?? {};
    for (const namespace of Object.keys(extensions)) if (namespace !== "anthropic" && namespace !== "openai") throw unsupported(`vendorExtensions.${namespace}`);
    const openai = openaiExtensions(extensions.openai ?? {});
    const tools = request.tools ?? [];
    const last = request.messages.at(-1);
    let budget = request.reasoning?.budgetTokens ?? (request.reasoning?.effort ? THINKING_BUDGETS[request.reasoning.effort] : undefined);
    // Anthropic refuses thinking after an assistant prefill; the request is refused rather than changed.
    if (budget !== undefined && last?.role === "assistant") throw unsupported("reasoning when the last message is from the assistant");
    let maxTokens = request.maxOutputTokens ?? DEFAULT_MAX_TOKENS;
    if (tools.length > 0) maxTokens = Math.max(maxTokens, MIN_MAX_TOKENS_WITH_TOOLS);
    if (budget !== undefined && maxTokens <= budget) maxTokens = budget + THINKING_HEADROOM;
    const ceiling = this.known.get(request.model)?.maxOutputTokens ?? null;
    if (ceiling !== null && maxTokens > ceiling) {
      maxTokens = ceiling;
      if (budget !== undefined && budget >= maxTokens) budget = Math.max(MIN_THINKING_BUDGET, maxTokens - THINKING_HEADROOM);
    }
    const typed = this.provider.quirks?.includes("requireClaudeToolType") ?? false;
    const choice = toolChoice(request, openai.disableParallel);
    // Extensions go first, so a modelled field always wins over a passthrough one.
    return {
      ...extensions.anthropic,
      model: request.model,
      max_tokens: maxTokens,
      messages: toMessages(request),
      stream,
      ...(request.system && request.system.length > 0 ? {
        system: request.system.map((part) => {
          if (part.type !== "text") throw unsupported(`${part.type} in the system prompt`);
          return textBlock(part);
        }),
      } : {}),
      ...(tools.length > 0 ? {
        tools: tools.map((tool) => {
          if (tool.strict === true) throw unsupported("strict tool schemas");
          return { ...(typed ? { type: "custom" } : {}), name: tool.name, ...(tool.description !== undefined ? { description: tool.description } : {}), input_schema: tool.parameters };
        }),
      } : {}),
      ...(choice ? { tool_choice: choice } : {}),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      ...(request.topP !== undefined ? { top_p: request.topP } : {}),
      ...(request.stop !== undefined ? { stop_sequences: request.stop } : {}),
      ...(budget !== undefined ? { thinking: { type: "enabled", budget_tokens: budget } } : {}),
      ...(openai.metadata ? { metadata: openai.metadata } : {}),
    };
  }

  private chat(request: CanonicalRequest, credential: Credential, stream: boolean): HttpRequest {
    return this.post(this.body(request, stream), credential, stream ? STREAM_TIMEOUT_MS : CHAT_TIMEOUT_MS, stream);
  }

  private post(body: Json, credential: Credential, timeoutMs: number, stream: boolean): HttpRequest {
    const base = this.request("POST", this.provider.chatUrl, credential, timeoutMs);
    const node = this.provider.anthropicNode;
    const beta = node ? nodeBetas(body, node.official) : undefined;
    return {
      ...base,
      headers: { ...base.headers, "content-type": "application/json", accept: stream ? "text/event-stream" : "application/json", ...(beta ? { "anthropic-beta": beta } : {}) },
      body: JSON.stringify(body),
    };
  }

  // 9router: <base>/v1/messages (so /v1/v1/messages with the default base), a retired model, and every status but
  // 401/403 counts as a valid key. A network failure is still thrown, so the dashboard shows it as unreachable.
  private async nodeTest(credential: Credential, ctx: ExecCtx): Promise<CredentialStatus> {
    const base = this.request("POST", this.provider.chatUrl.replace(/\/messages$/, "/v1/messages"), credential, METADATA_TIMEOUT_MS);
    const response = await this.transport.send({
      ...base,
      headers: { ...base.headers, "content-type": "application/json", authorization: `Bearer ${credential.apiKey}` },
      body: JSON.stringify({ model: NODE_TEST_MODEL, max_tokens: 1, messages: [{ role: "user", content: "test" }] }),
    }, ctx);
    await response.body?.cancel();
    if (response.status !== 401 && response.status !== 403) return { valid: true };
    return { valid: false, code: "AUTH_ERROR", message: `${this.provider.name} answered ${response.status}: invalid API key or base URL` };
  }
}
