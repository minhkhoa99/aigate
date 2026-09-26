import {
  UnsupportedFeatureError, type CanonicalMessage, type CanonicalRequest, type CanonicalResponse, type ContentPart, type StopReason,
  type StreamChunk, type TokenUsage, type ToolChoice, type ToolDefinition,
} from "../cip.js";
import { EngineError } from "../errors.js";
import { isRecord, parseJson, text, type Json } from "../json.js";
import type { ProviderDescriptor } from "../registry.js";
import { budgetToLevel } from "../adapters/gemini.js";
import { toOpenAIError } from "./openai-chat.js";

// Client-facing Anthropic Messages protocol, POST /v1/messages (docs/contracts/protocol-anthropic.md).
// User decisions (2026-09-27): the request keeps 9router's rules (near passthrough to an Anthropic provider; the
// claude→openai drops and adjustments for any other one), errors stay OpenAI-shaped, and a non-streaming client gets
// chat.completion unless the provider is openai-compatible or Anthropic. Corrected: real usage, tool arguments
// streamed as they come, and signature_delta.

const MAX_MESSAGES = 10_000;
const MAX_BLOCKS = 512;
const MAX_TOOLS = 128;
const MAX_STOP = 64;
const MAX_EXTENSIONS = 64;
const MODEL = /^[\x21-\x7e]{1,256}$/;
const NO_PARAMETERS = { type: "object", properties: {} };
// Fields the parser turns into CIP; any other top-level field goes to an Anthropic provider unchanged.
const MODELLED = new Set(["model", "messages", "system", "max_tokens", "stream", "temperature", "top_p", "stop_sequences", "tools", "tool_choice", "thinking"]);
// adjustMaxTokens (translator/formats/maxTokens.js) for a non-Anthropic provider.
const DEFAULT_MAX_TOKENS = 64_000;
const MIN_TOKENS_WITH_TOOLS = 32_000;
const THINKING_HEADROOM = 1_024;
const BILLING_HEADER = /^x-anthropic-billing-header:[^\n]*(?:\r?\n)?/i;
// Providers whose adapters read a thinking budget; the others get a reasoning effort.
const BUDGET_PROTOCOLS = new Set(["gemini", "vertex", "commandcode"]);
const EFFORTS = new Set(["low", "medium", "high"]);
const STOP_REASONS: Readonly<Record<StopReason, string>> = {
  end_turn: "end_turn", stop_sequence: "stop_sequence", max_tokens: "max_tokens", tool_use: "tool_use", content_filter: "refusal",
};

const invalid = (param: string, message: string) => new EngineError("INVALID_REQUEST", `${param} ${message}`, { param });
const unsupported = (feature: string) => new UnsupportedFeatureError(feature, "AIGate");

function list(value: unknown, param: string, max: number): readonly unknown[] {
  if (!Array.isArray(value)) throw invalid(param, "must be an array");
  if (value.length > max) throw invalid(param, `may have at most ${max} items`);
  return value;
}

function optionalNumber(value: unknown, param: string, min: number, max: number): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw invalid(param, `must be a number from ${min} to ${max}`);
  return value;
}

function optionalPositiveInteger(value: unknown, param: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) throw invalid(param, "must be a positive integer");
  return value;
}

// ---- request: the Anthropic body, faithfully in CIP ----

export interface AnthropicClientRequest {
  readonly request: CanonicalRequest;
  // Blocks and tools only an Anthropic provider can take (9router passes them through, and drops them elsewhere).
  readonly anthropicOnly: readonly string[];
}

// Content given as one block is a one-block array (9router normalizes it the same way).
const blocksOf = (content: unknown): readonly unknown[] => (typeof content === "string" ? [{ type: "text", text: content }] : Array.isArray(content) ? content : isRecord(content) ? [content] : []);

const blockText = (content: unknown): string => blocksOf(content).map((block) => (isRecord(block) && block.type === "text" ? text(block.text) ?? "" : "")).filter(Boolean).join("\n");

function mediaPart(block: Json, anthropicOnly: string[]): ContentPart | undefined {
  const source = isRecord(block.source) ? block.source : {};
  const mediaType = text(source.media_type);
  if (block.type === "image") {
    if (source.type === "base64" && mediaType && typeof source.data === "string") return { type: "image", source: { kind: "base64", mediaType, data: source.data } };
    if (source.type === "url" && typeof source.url === "string") return { type: "image", source: { kind: "url", url: source.url } };
  } else {
    const name = text(block.title);
    if (source.type === "base64" && typeof source.data === "string") return { type: "file", mediaType: mediaType ?? "application/pdf", source: { kind: "base64", mediaType: mediaType ?? "application/pdf", data: source.data }, ...(name ? { name } : {}) };
    if (source.type === "url" && typeof source.url === "string") return { type: "file", mediaType: "application/pdf", source: { kind: "url", url: source.url }, ...(name ? { name } : {}) };
    if (source.type === "text" && typeof source.data === "string") return { type: "text", text: source.data };
  }
  anthropicOnly.push(`${text(block.type) ?? "media"} with a ${text(source.type) ?? "missing"} source`);
  return undefined;
}

function toolResultContent(content: unknown): ContentPart[] {
  if (typeof content === "string") return [{ type: "text", text: content }];
  if (!Array.isArray(content)) return content === undefined || content === null ? [] : [{ type: "text", text: JSON.stringify(content) }];
  return content.map((inner): ContentPart => {
    if (isRecord(inner) && inner.type === "text") return { type: "text", text: text(inner.text) ?? "" };
    if (isRecord(inner) && inner.type === "image") {
      const source = isRecord(inner.source) ? inner.source : {};
      if (source.type === "base64" && typeof source.media_type === "string" && typeof source.data === "string") {
        return { type: "image", source: { kind: "base64", mediaType: source.media_type, data: source.data } };
      }
    }
    return { type: "text", text: JSON.stringify(inner) };
  });
}

function parts(content: unknown, param: string, anthropicOnly: string[]): ContentPart[] {
  const out: ContentPart[] = [];
  const blocks = list(blocksOf(content), param, MAX_BLOCKS);
  blocks.forEach((raw, i) => {
    if (!isRecord(raw)) throw invalid(`${param}[${i}]`, "must be an object");
    switch (raw.type) {
      case "text": out.push({ type: "text", text: text(raw.text) ?? "", ...(isRecord(raw.cache_control) ? { cacheControl: "ephemeral" as const } : {}) }); break;
      case "image":
      case "document": {
        const part = mediaPart(raw, anthropicOnly);
        if (part) out.push(part);
        break;
      }
      case "tool_use": out.push({ type: "tool_call", id: text(raw.id) ?? "", name: text(raw.name) ?? "", arguments: JSON.stringify(raw.input ?? {}) }); break;
      case "tool_result":
        out.push({ type: "tool_result", toolCallId: text(raw.tool_use_id) ?? "", content: toolResultContent(raw.content), ...(raw.is_error === true ? { isError: true } : {}) });
        break;
      case "thinking": out.push({ type: "thinking", text: text(raw.thinking) ?? "", ...(typeof raw.signature === "string" ? { signature: raw.signature } : {}) }); break;
      case "redacted_thinking": out.push({ type: "thinking", text: text(raw.data) ?? "", redacted: true }); break;
      default:
        if (typeof raw.type !== "string") throw invalid(`${param}[${i}].type`, "must be a string");
        anthropicOnly.push(`${raw.type} blocks`);
    }
  });
  return out;
}

// 9router: a tool call without a result right after it gets "[No response received]" (every target).
function fillMissingResults(messages: CanonicalMessage[]): CanonicalMessage[] {
  const out: CanonicalMessage[] = [];
  messages.forEach((message, i) => {
    out.push(message);
    if (message.role !== "assistant") return;
    const calls = message.content.filter((part) => part.type === "tool_call").map((part) => part.id);
    if (calls.length === 0) return;
    const next = messages[i + 1];
    const answered = new Set(next?.role === "user" ? next.content.flatMap((part) => (part.type === "tool_result" ? [part.toolCallId] : [])) : []);
    const missing = calls.filter((id) => !answered.has(id)).map((id): ContentPart => ({ type: "tool_result", toolCallId: id, content: [{ type: "text", text: "[No response received]" }] }));
    if (missing.length === 0) return;
    if (next?.role === "user") messages[i + 1] = { role: "user", content: [...missing, ...next.content] };
    else out.push({ role: "user", content: missing });
  });
  return out;
}

function toTools(value: unknown, anthropicOnly: string[]): ToolDefinition[] {
  return list(value, "tools", MAX_TOOLS).map((raw, i) => {
    if (!isRecord(raw)) throw invalid(`tools[${i}]`, "must be an object");
    const type = text(raw.type);
    // A server tool (web_search_…) has a type and no schema; 9router sends it to other providers as an empty function.
    if (type && type !== "custom" && raw.input_schema === undefined) anthropicOnly.push(`the ${type} server tool`);
    const name = text(raw.name) ?? type ?? "";
    const description = text(raw.description);
    return { name, ...(description !== undefined ? { description } : {}), parameters: isRecord(raw.input_schema) ? raw.input_schema : NO_PARAMETERS };
  });
}

function toToolChoice(value: unknown): { choice?: ToolChoice; serialTools: boolean } {
  if (!isRecord(value)) return { serialTools: false };
  const serialTools = value.disable_parallel_tool_use === true;
  switch (value.type) {
    case "auto": return { choice: "auto", serialTools };
    case "any": return { choice: "required", serialTools };
    case "none": return { choice: "none", serialTools };
    case "tool": return { choice: { name: text(value.name) ?? "" }, serialTools };
    default: return { serialTools };
  }
}

// An omitted stream streams, unless the client only accepts JSON (9router chatCore, kept).
function streams(flag: unknown, accept: string | undefined): boolean {
  const jsonOnly = accept !== undefined && accept.includes("application/json") && !accept.includes("text/event-stream");
  return flag === true || (flag !== false && !jsonOnly);
}

export function parseAnthropicMessagesRequest(input: unknown, accept?: string): AnthropicClientRequest {
  if (!isRecord(input)) throw invalid("body", "must be a JSON object");
  const model = input.model;
  if (typeof model !== "string" || !MODEL.test(model)) throw invalid("model", "must be a model id");
  const anthropicOnly: string[] = [];
  const messages: CanonicalMessage[] = [];
  list(input.messages, "messages", MAX_MESSAGES).forEach((raw, i) => {
    const param = `messages[${i}]`;
    if (!isRecord(raw)) throw invalid(param, "must be an object");
    // 9router: a system turn inside the conversation becomes user instructions.
    if (raw.role === "system") {
      const instructions = blockText(raw.content);
      if (instructions.trim()) messages.push({ role: "user", content: [{ type: "text", text: `<instructions>\n${instructions}\n</instructions>` }] });
      return;
    }
    const role = raw.role === "user" || raw.role === "tool" ? "user" : "assistant";
    const content = parts(raw.content, `${param}.content`, anthropicOnly);
    messages.push({ role, content: content.length > 0 ? content : [{ type: "text", text: "" }] });
  });
  const system = input.system === undefined ? [] : typeof input.system === "string"
    ? [{ type: "text" as const, text: input.system }]
    : parts(input.system, "system", anthropicOnly).filter((part) => part.type === "text");
  const tools = input.tools === undefined ? [] : toTools(input.tools, anthropicOnly);
  const { choice, serialTools } = toToolChoice(input.tool_choice);
  const stop = input.stop_sequences === undefined ? undefined : list(input.stop_sequences, "stop_sequences", MAX_STOP).map((value, i) => {
    if (typeof value !== "string") throw invalid(`stop_sequences[${i}]`, "must be a string");
    return value;
  });
  // normalizeThinkingConfig: thinking only counts when the last message is from the user.
  const thinking = isRecord(input.thinking) && messages.at(-1)?.role === "user" ? input.thinking : undefined;
  const budget = thinking?.type === "enabled" ? optionalPositiveInteger(thinking.budget_tokens, "thinking.budget_tokens") : undefined;
  const passthrough = Object.entries(input).filter(([key]) => !MODELLED.has(key));
  if (passthrough.length > MAX_EXTENSIONS) throw invalid("body", `may have at most ${MAX_EXTENSIONS} fields AIGate does not model`);
  const anthropic: Json = Object.fromEntries(passthrough);
  // Adaptive or disabled thinking has no CIP form; an Anthropic provider receives it as sent.
  if (thinking && budget === undefined) anthropic.thinking = thinking;
  const maxOutputTokens = optionalPositiveInteger(input.max_tokens, "max_tokens");
  const temperature = optionalNumber(input.temperature, "temperature", 0, 2);
  const topP = optionalNumber(input.top_p, "top_p", 0, 1);
  const extensions = {
    ...(Object.keys(anthropic).length > 0 ? { anthropic } : {}),
    ...(serialTools ? { openai: { parallel_tool_calls: false } } : {}),
  };
  const request: CanonicalRequest = {
    model,
    messages: fillMissingResults(messages),
    stream: streams(input.stream, accept),
    ...(system.length > 0 ? { system } : {}),
    ...(tools.length > 0 ? { tools } : {}),
    ...(choice ? { toolChoice: choice } : {}),
    ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(topP !== undefined ? { topP } : {}),
    ...(stop !== undefined ? { stop } : {}),
    ...(budget !== undefined ? { reasoning: { budgetTokens: budget } } : {}),
    ...(Object.keys(extensions).length > 0 ? { vendorExtensions: extensions } : {}),
  };
  return { request, anthropicOnly };
}

// ---- the request a provider receives (translator.claude-client-request) ----

// A user turn after 9router's claude→openai drops; undefined when nothing is left of a non-empty turn.
function pivotUser(content: readonly ContentPart[]): ContentPart[] | undefined {
  const out: ContentPart[] = [];
  for (const part of content) {
    if (part.type === "text") out.push({ type: "text", text: part.text });
    else if (part.type === "image" && part.source.kind === "base64") out.push(part);
    else if (part.type === "tool_result") {
      const images = part.content.filter((inner) => inner.type === "image" && inner.source.kind === "base64");
      const texts = part.content.flatMap((inner) => (inner.type === "text" ? [inner.text] : [])).join("\n");
      out.push({ type: "tool_result", toolCallId: part.toolCallId, content: [{ type: "text", text: texts }] });
      // The OpenAI tool role is text-only, so a tool's images follow in the user turn, tagged with the call.
      if (images.length > 0) out.push({ type: "text", text: `[Image from tool result ${part.toolCallId}]` }, ...images);
    }
    // URL images, files (documents), and thinking are dropped, as in 9router.
  }
  return out.length > 0 ? out : undefined;
}

function pivotAssistant(content: readonly ContentPart[]): ContentPart[] | undefined {
  const out = content.flatMap((part): ContentPart[] => (part.type === "text" ? [{ type: "text", text: part.text }] : part.type === "tool_call" ? [part] : []));
  return out.length > 0 ? out : undefined;
}

function adjustMaxTokens(request: CanonicalRequest): number | undefined {
  if (request.maxOutputTokens === undefined) return undefined;
  let max = request.maxOutputTokens;
  if ((request.tools?.length ?? 0) > 0 && max < MIN_TOKENS_WITH_TOOLS) max = MIN_TOKENS_WITH_TOOLS;
  const budget = request.reasoning?.budgetTokens;
  if (budget !== undefined && max <= budget) max = budget + THINKING_HEADROOM;
  return Math.min(max, DEFAULT_MAX_TOKENS);
}

// The effort an OpenAI-style provider gets from a thinking budget (9router applyThinking, budget → level).
function effortFor(request: CanonicalRequest, provider: ProviderDescriptor): Pick<CanonicalRequest, "reasoning" | "vendorExtensions"> {
  const budget = request.reasoning?.budgetTokens;
  if (budget === undefined) return {};
  if (BUDGET_PROTOCOLS.has(provider.protocol)) return { reasoning: { budgetTokens: budget } };
  const level = budgetToLevel(budget);
  if (level === undefined) return {};
  return EFFORTS.has(level) ? { reasoning: { effort: level === "low" ? "low" : level === "medium" ? "medium" : "high" } } : { vendorExtensions: { openai: { reasoning_effort: level } } };
}

export function anthropicRequestFor(parsed: AnthropicClientRequest, provider: ProviderDescriptor): CanonicalRequest {
  const { request } = parsed;
  // Claude target: 9router skips the conversion; only what CIP cannot hold is refused.
  if (provider.protocol === "anthropic") {
    const first = parsed.anthropicOnly[0];
    if (first !== undefined) throw unsupported(`${first} on this path`);
    return request;
  }
  const messages = request.messages.flatMap((message): CanonicalMessage[] => {
    const content = message.role === "assistant" ? pivotAssistant(message.content) : pivotUser(message.content);
    return content ? [{ role: message.role, content }] : [];
  });
  const system = (request.system ?? []).flatMap((part) => (part.type === "text" ? [part.text.replace(BILLING_HEADER, "")] : [])).filter(Boolean).join("\n");
  const maxOutputTokens = adjustMaxTokens(request);
  return {
    model: request.model,
    messages,
    stream: request.stream,
    ...(system ? { system: [{ type: "text", text: system }] } : {}),
    ...(request.tools ? { tools: request.tools.map((tool) => ({ name: tool.name, description: tool.description ?? "", parameters: tool.parameters })) } : {}),
    // 9router maps every choice but auto, any and tool to auto.
    ...(request.toolChoice !== undefined ? { toolChoice: request.toolChoice === "none" ? "auto" : request.toolChoice } : {}),
    ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...effortFor(request, provider),
  };
}

// 9router answers a non-streaming Claude client with a message object only for an openai target that is not forced to
// stream, or a Claude target; every other provider's answer stays a chat.completion (kept).
export const anthropicClientGetsMessage = (provider: ProviderDescriptor): boolean =>
  provider.protocol === "anthropic" || (provider.protocol === "openai-compatible" && provider.streamOnly !== true);

// ---- responses ----

function usageJson(usage: TokenUsage): Json {
  return {
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    ...(usage.cacheReadTokens ? { cache_read_input_tokens: usage.cacheReadTokens } : {}),
    ...(usage.cacheWriteTokens ? { cache_creation_input_tokens: usage.cacheWriteTokens } : {}),
  };
}

const messageId = (id: string, fallback: string) => (id ? id.replace(/^chatcmpl-/, "") : fallback);

const toolInput = (raw: string): unknown => {
  const parsed = parseJson(raw);
  return isRecord(parsed) ? parsed : {};
};

export function toAnthropicMessage(response: CanonicalResponse, fallbackId: string): Json {
  const content = response.content.flatMap((part): Json[] => {
    if (part.type === "thinking") return [part.redacted ? { type: "redacted_thinking", data: part.text } : { type: "thinking", thinking: part.text, ...(part.signature ? { signature: part.signature } : {}) }];
    if (part.type === "text") return [{ type: "text", text: part.text }];
    if (part.type === "tool_call") return [{ type: "tool_use", id: part.id, name: part.name, input: toolInput(part.arguments) }];
    return [];
  });
  return {
    id: messageId(response.id, fallbackId),
    type: "message",
    role: "assistant",
    model: response.model,
    content: content.length > 0 ? content : [{ type: "text", text: "" }],
    stop_reason: STOP_REASONS[response.stopReason],
    stop_sequence: null,
    usage: usageJson(response.usage),
  };
}

// count_tokens (routing.count-tokens-estimate): characters / 4, keys included, as 9router counts them.
function countChars(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "string") return value.length;
  if (typeof value === "number" || typeof value === "boolean") return String(value).length;
  if (Array.isArray(value)) return value.reduce((total: number, item) => total + countChars(item), 0);
  if (isRecord(value)) return Object.entries(value).reduce((total, [key, item]) => total + key.length + countChars(item), 0);
  return 0;
}

function countBlock(block: unknown): number {
  if (typeof block === "string") return block.length;
  if (!isRecord(block)) return countChars(block);
  switch (block.type) {
    case "text": return countChars(block.text);
    case "tool_use": return countChars(block.name) + countChars(block.input);
    case "tool_result": return countChars(block.content);
    case "thinking": return countChars(block.thinking);
    default: return countChars(block);
  }
}

export function estimateAnthropicInputTokens(body: unknown): number {
  const input = isRecord(body) ? body : {};
  const messages = Array.isArray(input.messages) ? input.messages : [];
  let total = countChars(input.system) + countChars(input.tools);
  for (const message of messages) {
    if (!isRecord(message)) continue;
    const content = message.content;
    total += typeof content === "string" ? content.length : Array.isArray(content) ? content.reduce((sum: number, block) => sum + countBlock(block), 0) : countChars(content);
  }
  return Math.ceil(total / 4);
}

// ---- streaming (translator.openai-to-claude-client-response) ----

// 9router fixes the arguments a non-Anthropic model gives Claude Code's Read tool (limit, offset, pages).
function sanitizeRead(raw: string): string {
  const args = parseJson(raw);
  if (!isRecord(args)) return raw;
  if (typeof args.limit === "string" && /^\d+$/.test(args.limit)) args.limit = Number(args.limit);
  if (typeof args.offset === "string" && /^-?\d+$/.test(args.offset)) args.offset = Number(args.offset);
  const limit = args.limit;
  if (typeof limit === "number" && limit > 2000) args.limit = 2000;
  else if (typeof limit === "number" && limit < 1) delete args.limit;
  if (typeof args.offset === "number" && args.offset < 0) args.offset = 0;
  const path = text(args.file_path);
  if ("pages" in args && !(path?.toLowerCase().endsWith(".pdf") && typeof args.pages === "string" && /^\d+(?:-\d+)?$/.test(args.pages))) delete args.pages;
  return JSON.stringify(args);
}

const event = (type: string, value: Json) => `event: ${type}\ndata: ${JSON.stringify({ type, ...value })}\n\n`;

type Tool = { index: number; read: boolean; buffered: string };

export class AnthropicStreamEncoder {
  private readonly fallbackId: string;
  private readonly fallbackModel: string;
  private started = false;
  private closed = false;
  private next = 0;
  private current: { kind: "text" | "thinking"; index: number } | undefined;
  private readonly tools = new Map<number, Tool>();
  private usage: TokenUsage | undefined;

  constructor(meta: { readonly fallbackId: string; readonly model: string }) {
    this.fallbackId = meta.fallbackId;
    this.fallbackModel = meta.model;
  }

  encode(chunk: StreamChunk): string {
    this.assertOpen();
    if (chunk.type === "start") return this.started ? "" : this.open(chunk.id, chunk.model);
    const head = this.started ? "" : this.open("", "");
    switch (chunk.type) {
      case "text_delta": return head + this.block("text") + event("content_block_delta", { index: this.index(), delta: { type: "text_delta", text: chunk.text } });
      case "thinking_delta": {
        let out = head + this.block("thinking");
        if (chunk.text) out += event("content_block_delta", { index: this.index(), delta: { type: "thinking_delta", thinking: chunk.text } });
        if (chunk.signature) out += event("content_block_delta", { index: this.index(), delta: { type: "signature_delta", signature: chunk.signature } });
        return out;
      }
      case "tool_call_delta": return head + this.tool(chunk);
      case "usage":
        this.usage = chunk.usage;
        return head;
      case "stop": {
        let out = head + this.closeCurrent();
        for (const tool of [...this.tools.values()].sort((a, b) => a.index - b.index)) {
          if (tool.read && tool.buffered) out += event("content_block_delta", { index: tool.index, delta: { type: "input_json_delta", partial_json: sanitizeRead(tool.buffered) } });
          out += event("content_block_stop", { index: tool.index });
        }
        this.tools.clear();
        const usage = this.usage ?? { inputTokens: 0, outputTokens: 0 };
        out += event("message_delta", { delta: { stop_reason: STOP_REASONS[chunk.stopReason], stop_sequence: null }, usage: usageJson(usage) });
        return out + event("message_stop", {});
      }
      case "image_delta": return head;
    }
  }

  // message_stop already ended the stream; Anthropic streams have no [DONE].
  end(): string {
    this.assertOpen();
    this.closed = true;
    return "";
  }

  // 9router's Claude error event, with the OpenAI-shaped error inside (kept).
  fail(error: unknown): string {
    this.assertOpen();
    this.closed = true;
    return `event: error\ndata: ${JSON.stringify({ type: "error", error: toOpenAIError(error).body.error })}\n\n`;
  }

  private open(id: string, model: string): string {
    this.started = true;
    const message = {
      id: messageId(id, this.fallbackId), type: "message", role: "assistant", model: model || this.fallbackModel, content: [], stop_reason: null, stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    };
    return event("message_start", { message });
  }

  private index(): number {
    return this.current?.index ?? 0;
  }

  // Text and thinking blocks follow each other; a new kind closes the open one.
  private block(kind: "text" | "thinking"): string {
    if (this.current?.kind === kind) return "";
    const out = this.closeCurrent();
    this.current = { kind, index: this.next++ };
    return out + event("content_block_start", { index: this.current.index, content_block: kind === "text" ? { type: "text", text: "" } : { type: "thinking", thinking: "" } });
  }

  private closeCurrent(): string {
    if (!this.current) return "";
    const out = event("content_block_stop", { index: this.current.index });
    this.current = undefined;
    return out;
  }

  // Tool blocks stay open until the stop (deltas carry their index), so interleaved calls keep every argument.
  private tool(chunk: Extract<StreamChunk, { type: "tool_call_delta" }>): string {
    let out = "";
    let tool = this.tools.get(chunk.index);
    if (!tool) {
      out += this.closeCurrent();
      const name = chunk.name ?? "";
      tool = { index: this.next++, read: name.replace(/^proxy_/, "") === "Read", buffered: "" };
      this.tools.set(chunk.index, tool);
      out += event("content_block_start", { index: tool.index, content_block: { type: "tool_use", id: chunk.id ?? `call_${chunk.index}_${Date.now()}`, name, input: {} } });
    }
    if (!chunk.argumentsDelta) return out;
    if (tool.read) tool.buffered += chunk.argumentsDelta;
    else out += event("content_block_delta", { index: tool.index, delta: { type: "input_json_delta", partial_json: chunk.argumentsDelta } });
    return out;
  }

  private assertOpen(): void {
    if (this.closed) throw new Error("AnthropicStreamEncoder is closed: end() or fail() was already called");
  }
}
