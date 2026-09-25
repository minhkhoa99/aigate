import {
  UnsupportedFeatureError, type CanonicalMessage, type CanonicalRequest, type CanonicalResponse, type ContentPart, type MediaSource,
  type StopReason, type StreamChunk, type TokenUsage, type ToolChoice, type ToolDefinition,
} from "../cip.js";
import { EngineError, type ErrorCode } from "../errors.js";
import { isRecord, type Json } from "../json.js";

// Client-facing OpenAI Chat Completions protocol (docs/contracts/protocol-openai.md).

const MAX_MESSAGES = 10_000;
const MAX_PARTS = 512;
const MAX_TOOLS = 128;
const MAX_TOOL_CALLS = 128;
const MAX_STOP = 4;
const MAX_EXTENSIONS = 64;
const MAX_DATA_URL_HEADER = 256;
const MODEL = /^[\x21-\x7e]{1,256}$/;
const TOOL_NAME = /^[a-zA-Z0-9_-]{1,64}$/;
const MEDIA_TYPE = /^[a-z0-9][a-z0-9.+-]{0,63}\/[a-z0-9][a-z0-9.+-]{0,63}$/i;
const UPSTREAM_CODE = /^[a-z0-9_.-]{1,64}$/i;
const AUDIO_MEDIA_TYPES = new Map([["wav", "audio/wav"], ["mp3", "audio/mpeg"]]);
// OpenAI documents an omitted parameters schema as a function with no arguments.
const NO_PARAMETERS = { type: "object", properties: {} };
const MODELLED = new Set([
  "model", "messages", "tools", "tool_choice", "stream", "stream_options", "max_tokens", "max_completion_tokens",
  "temperature", "top_p", "stop", "reasoning_effort", "n",
]);
const FINISH_REASONS: Readonly<Record<StopReason, string>> = {
  end_turn: "stop", stop_sequence: "stop", max_tokens: "length", tool_use: "tool_calls", content_filter: "content_filter",
};

// ---- validation helpers: every failure names the field ----

const invalid = (param: string, message: string) => new EngineError("INVALID_REQUEST", `${param} ${message}`, { param });
const unsupported = (feature: string) => new UnsupportedFeatureError(feature, "AIGate");
// OpenAI clients send null for "not set"; treat it like an absent field.
const present = (value: unknown): boolean => value !== undefined && value !== null;

function object(value: unknown, param: string): Json {
  if (!isRecord(value)) throw invalid(param, "must be an object");
  return value;
}

function onlyKeys(value: Json, allowed: readonly string[], param: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw invalid(`${param}.${key}`, "is not a known field");
}

function string(value: unknown, param: string): string {
  if (typeof value !== "string") throw invalid(param, "must be a string");
  return value;
}

function array(value: unknown, param: string, max: number): readonly unknown[] {
  if (!Array.isArray(value)) throw invalid(param, "must be an array");
  if (value.length > max) throw invalid(param, `may have at most ${max} items`);
  return value;
}

function optionalBoolean(value: unknown, param: string): boolean | undefined {
  if (!present(value)) return undefined;
  if (typeof value !== "boolean") throw invalid(param, "must be a boolean");
  return value;
}

function optionalNumber(value: unknown, param: string, min: number, max: number): number | undefined {
  if (!present(value)) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw invalid(param, `must be a number from ${min} to ${max}`);
  return value;
}

function optionalPositiveInteger(value: unknown, param: string): number | undefined {
  if (!present(value)) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) throw invalid(param, "must be a positive integer");
  return value;
}

// An unknown part or tool type is valid OpenAI that CIP cannot carry; a non-string type is a malformed body.
function unknownType(type: unknown, param: string, what: string): Error {
  return typeof type === "string" ? unsupported(`${type} ${what}`) : invalid(`${param}.type`, "must be a string");
}

// ---- inbound ----

// Split at the first comma; the payload itself is never scanned.
function mediaSource(url: string, param: string): MediaSource {
  if (url.startsWith("data:")) {
    const comma = url.indexOf(",");
    const header = comma > 0 && comma <= MAX_DATA_URL_HEADER ? url.slice(5, comma) : "";
    const mediaType = header.endsWith(";base64") ? header.slice(0, -7) : "";
    if (!MEDIA_TYPE.test(mediaType)) throw invalid(param, "must be a data:<media type>;base64 URL");
    return { kind: "base64", mediaType, data: url.slice(comma + 1) };
  }
  if (/^https?:\/\//i.test(url)) return { kind: "url", url };
  throw invalid(param, "must be an http(s) URL or a base64 data: URL");
}

function textParts(value: unknown, param: string, role: string): ContentPart[] {
  if (typeof value === "string") return [{ type: "text", text: value }];
  return array(value, param, MAX_PARTS).map((entry, i) => {
    const part = object(entry, `${param}[${i}]`);
    if (part.type !== "text") throw unknownType(part.type, `${param}[${i}]`, `parts in ${role} messages`);
    onlyKeys(part, ["type", "text"], `${param}[${i}]`);
    return { type: "text", text: string(part.text, `${param}[${i}].text`) };
  });
}

function userPart(entry: unknown, param: string): ContentPart {
  const part = object(entry, param);
  switch (part.type) {
    case "text":
      onlyKeys(part, ["type", "text"], param);
      return { type: "text", text: string(part.text, `${param}.text`) };
    case "image_url": {
      onlyKeys(part, ["type", "image_url"], param);
      const image = object(part.image_url, `${param}.image_url`);
      onlyKeys(image, ["url", "detail"], `${param}.image_url`);
      const source = mediaSource(string(image.url, `${param}.image_url.url`), `${param}.image_url.url`);
      const detail = image.detail;
      if (!present(detail)) return { type: "image", source };
      if (detail !== "low" && detail !== "high" && detail !== "auto") throw invalid(`${param}.image_url.detail`, "must be low, high, or auto");
      return { type: "image", source, detail };
    }
    case "input_audio": {
      onlyKeys(part, ["type", "input_audio"], param);
      const audio = object(part.input_audio, `${param}.input_audio`);
      const mediaType = AUDIO_MEDIA_TYPES.get(string(audio.format, `${param}.input_audio.format`));
      if (mediaType === undefined) throw invalid(`${param}.input_audio.format`, "must be wav or mp3");
      return { type: "audio", source: { kind: "base64", mediaType, data: string(audio.data, `${param}.input_audio.data`) } };
    }
    case "file": {
      onlyKeys(part, ["type", "file"], param);
      const file = object(part.file, `${param}.file`);
      if (present(file.file_id)) throw unsupported("a file_id reference (send file_data instead)");
      const source = mediaSource(string(file.file_data, `${param}.file.file_data`), `${param}.file.file_data`);
      if (source.kind !== "base64") throw invalid(`${param}.file.file_data`, "must be a base64 data: URL");
      const name = present(file.filename) ? string(file.filename, `${param}.file.filename`) : undefined;
      return { type: "file", mediaType: source.mediaType, source, ...(name !== undefined ? { name } : {}) };
    }
    default: throw unknownType(part.type, param, "content parts");
  }
}

function toolCalls(value: unknown, param: string): ContentPart[] {
  return array(value, param, MAX_TOOL_CALLS).map((entry, i) => {
    const at = `${param}[${i}]`;
    const call = object(entry, at);
    if (call.type !== "function") throw unknownType(call.type, at, "tool calls");
    onlyKeys(call, ["id", "type", "function"], at);
    const fn = object(call.function, `${at}.function`);
    const id = string(call.id, `${at}.id`);
    if (id === "") throw invalid(`${at}.id`, "must not be empty");
    return { type: "tool_call", id, name: string(fn.name, `${at}.function.name`), arguments: string(fn.arguments, `${at}.function.arguments`) };
  });
}

function toMessages(value: unknown): { system: ContentPart[]; messages: CanonicalMessage[] } {
  const raw = array(value, "messages", MAX_MESSAGES);
  if (raw.length === 0) throw invalid("messages", "must not be empty");
  const system: ContentPart[] = [];
  const messages: CanonicalMessage[] = [];
  for (let i = 0; i < raw.length; i++) {
    const param = `messages[${i}]`;
    const message = object(raw[i], param);
    if (present(message.name)) throw unsupported("the message name field");
    switch (message.role) {
      case "system":
      case "developer":
        onlyKeys(message, ["role", "content", "name"], param);
        // CIP has one system prompt in front; a later one has no position to keep.
        if (messages.length > 0) throw unsupported("a system message after the conversation started");
        system.push(...textParts(message.content, `${param}.content`, "system"));
        break;
      case "user": {
        onlyKeys(message, ["role", "content", "name"], param);
        const content = message.content;
        const parts = typeof content === "string"
          ? [{ type: "text" as const, text: content }]
          : array(content, `${param}.content`, MAX_PARTS).map((part, j) => userPart(part, `${param}.content[${j}]`));
        messages.push({ role: "user", content: parts });
        break;
      }
      case "assistant": {
        onlyKeys(message, ["role", "content", "tool_calls", "refusal", "name", "audio", "function_call"], param);
        if (present(message.refusal)) throw unsupported("an assistant refusal");
        if (present(message.audio)) throw unsupported("assistant audio");
        if (present(message.function_call)) throw unsupported("the legacy function_call field (use tool_calls)");
        const parts = [
          ...(present(message.content) ? textParts(message.content, `${param}.content`, "assistant") : []),
          ...(present(message.tool_calls) ? toolCalls(message.tool_calls, `${param}.tool_calls`) : []),
        ];
        if (parts.length === 0) throw invalid(param, "needs content or tool_calls");
        messages.push({ role: "assistant", content: parts });
        break;
      }
      case "tool": {
        onlyKeys(message, ["role", "content", "tool_call_id"], param);
        const toolCallId = string(message.tool_call_id, `${param}.tool_call_id`);
        messages.push({ role: "tool", content: [{ type: "tool_result", toolCallId, content: textParts(message.content, `${param}.content`, "tool") }] });
        break;
      }
      case "function": throw unsupported("the legacy function role (use tool)");
      default: throw invalid(`${param}.role`, "must be system, developer, user, assistant, or tool");
    }
  }
  return { system, messages };
}

function toolName(value: unknown, param: string): string {
  const name = string(value, param);
  if (!TOOL_NAME.test(name)) throw invalid(param, "must be 1 to 64 letters, digits, _ or -");
  return name;
}

function toTools(value: unknown): ToolDefinition[] {
  return array(value, "tools", MAX_TOOLS).map((entry, i) => {
    const param = `tools[${i}]`;
    const tool = object(entry, param);
    if (tool.type !== "function") throw unknownType(tool.type, param, "tools");
    onlyKeys(tool, ["type", "function"], param);
    const fn = object(tool.function, `${param}.function`);
    onlyKeys(fn, ["name", "description", "parameters", "strict"], `${param}.function`);
    const description = present(fn.description) ? string(fn.description, `${param}.function.description`) : undefined;
    const strict = optionalBoolean(fn.strict, `${param}.function.strict`);
    return {
      name: toolName(fn.name, `${param}.function.name`),
      ...(description !== undefined ? { description } : {}),
      parameters: present(fn.parameters) ? object(fn.parameters, `${param}.function.parameters`) : NO_PARAMETERS,
      ...(strict !== undefined ? { strict } : {}),
    };
  });
}

function toToolChoice(value: unknown): ToolChoice {
  if (value === "auto" || value === "none" || value === "required") return value;
  if (!isRecord(value)) throw invalid("tool_choice", "must be auto, none, required, or a function choice");
  if (value.type !== "function") throw unknownType(value.type, "tool_choice", "tool_choice");
  return { name: toolName(object(value.function, "tool_choice.function").name, "tool_choice.function.name") };
}

function toStop(value: unknown): readonly string[] {
  if (typeof value === "string") return [value];
  return array(value, "stop", MAX_STOP).map((entry, i) => string(entry, `stop[${i}]`));
}

export interface OpenAIChatInput {
  readonly request: CanonicalRequest;
  // stream_options.include_usage: the encoder sends a usage chunk only when the client asked for one.
  readonly includeUsage: boolean;
}

export function parseOpenAIChatRequest(body: unknown): OpenAIChatInput {
  const input = object(body, "body");
  const model = string(input.model, "model");
  if (!MODEL.test(model)) throw invalid("model", "must be 1 to 256 printable characters");
  const { system, messages } = toMessages(input.messages);
  // An omitted flag is non-streaming, as in the OpenAI API (routing.stream-mode-decision).
  const stream = optionalBoolean(input.stream, "stream") ?? false;
  const streamOptions = present(input.stream_options) ? object(input.stream_options, "stream_options") : {};
  const includeUsage = optionalBoolean(streamOptions.include_usage, "stream_options.include_usage") ?? false;
  if (present(input.n) && input.n !== 1) throw invalid("n", "must be 1: AIGate returns one choice");
  const maxCompletion = optionalPositiveInteger(input.max_completion_tokens, "max_completion_tokens");
  const maxTokens = optionalPositiveInteger(input.max_tokens, "max_tokens");
  if (maxCompletion !== undefined && maxTokens !== undefined && maxCompletion !== maxTokens) {
    throw invalid("max_tokens", "conflicts with max_completion_tokens; send one of them");
  }
  const maxOutputTokens = maxCompletion ?? maxTokens;
  const temperature = optionalNumber(input.temperature, "temperature", 0, 2);
  const topP = optionalNumber(input.top_p, "top_p", 0, 1);
  const effort = input.reasoning_effort;
  const knownEffort = effort === "low" || effort === "medium" || effort === "high" ? effort : undefined;

  // Everything not modelled travels untouched (CIP rule 1); a non-standard effort such as "minimal" too.
  const extensionKeys = Object.keys(input).filter((key) => !MODELLED.has(key));
  if (extensionKeys.length > MAX_EXTENSIONS) throw invalid("body", `may have at most ${MAX_EXTENSIONS} fields AIGate does not model`);
  const openai: Json = Object.fromEntries(extensionKeys.map((key) => [key, input[key]]));
  if (present(effort) && knownEffort === undefined) openai.reasoning_effort = string(effort, "reasoning_effort");

  return {
    includeUsage,
    request: {
      model,
      messages,
      stream,
      ...(system.length > 0 ? { system } : {}),
      ...(present(input.tools) ? { tools: toTools(input.tools) } : {}),
      ...(present(input.tool_choice) ? { toolChoice: toToolChoice(input.tool_choice) } : {}),
      ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
      ...(temperature !== undefined ? { temperature } : {}),
      ...(topP !== undefined ? { topP } : {}),
      ...(present(input.stop) ? { stop: toStop(input.stop) } : {}),
      ...(knownEffort !== undefined ? { reasoning: { effort: knownEffort } } : {}),
      ...(Object.keys(openai).length > 0 ? { vendorExtensions: { openai } } : {}),
    },
  };
}

// ---- outbound ----

function usageJson(usage: TokenUsage): Json {
  const cached = usage.cacheReadTokens ?? 0;
  const prompt = usage.inputTokens + cached + (usage.cacheWriteTokens ?? 0);
  return {
    prompt_tokens: prompt,
    completion_tokens: usage.outputTokens,
    total_tokens: prompt + usage.outputTokens,
    ...(usage.cacheReadTokens !== undefined ? { prompt_tokens_details: { cached_tokens: cached } } : {}),
    ...(usage.reasoningTokens !== undefined ? { completion_tokens_details: { reasoning_tokens: usage.reasoningTokens } } : {}),
  };
}

export interface CompletionMeta {
  // Unix seconds; passed in so output is deterministic.
  readonly created: number;
  // Used when the provider sent no id.
  readonly fallbackId: string;
}

export function toOpenAIChatCompletion(response: CanonicalResponse, meta: CompletionMeta): Json {
  const texts: string[] = [];
  const reasoning: string[] = [];
  const calls: Json[] = [];
  for (const part of response.content) {
    if (part.type === "text") texts.push(part.text);
    else if (part.type === "thinking") reasoning.push(part.text);
    else if (part.type === "tool_call") calls.push({ id: part.id, type: "function", function: { name: part.name, arguments: part.arguments } });
    else throw new UnsupportedFeatureError(`${part.type} in a response`, "OpenAI Chat Completions");
  }
  const refusal = response.vendorExtensions?.openai?.refusal;
  const message: Json = {
    role: "assistant",
    content: texts.length > 0 ? texts.join("") : null,
    ...(reasoning.length > 0 ? { reasoning_content: reasoning.join("") } : {}),
    ...(calls.length > 0 ? { tool_calls: calls } : {}),
    ...(typeof refusal === "string" ? { refusal } : {}),
  };
  return {
    id: response.id || meta.fallbackId,
    object: "chat.completion",
    created: meta.created,
    model: response.model,
    choices: [{ index: 0, message, logprobs: null, finish_reason: FINISH_REASONS[response.stopReason] }],
    usage: usageJson(response.usage),
  };
}

// ---- errors ----

const ERROR_SHAPES: Readonly<Record<ErrorCode, { status: number; type: string; code: string }>> = {
  INVALID_REQUEST: { status: 400, type: "invalid_request_error", code: "invalid_request" },
  MODEL_UNAVAILABLE: { status: 404, type: "not_found_error", code: "model_not_found" },
  RATE_LIMIT: { status: 429, type: "rate_limit_error", code: "rate_limit_exceeded" },
  QUOTA_EXHAUSTED: { status: 429, type: "insufficient_quota", code: "insufficient_quota" },
  // The client's own key is checked by apikeys; an upstream rejection is AIGate's configuration problem.
  AUTH_ERROR: { status: 502, type: "upstream_auth_error", code: "upstream_auth_error" },
  PROVIDER_UNAVAILABLE: { status: 502, type: "api_error", code: "provider_unavailable" },
  TIMEOUT: { status: 504, type: "timeout_error", code: "timeout" },
  INTERNAL_ERROR: { status: 500, type: "server_error", code: "internal_error" },
};

export interface OpenAIError {
  readonly status: number;
  readonly body: { readonly error: { readonly message: string; readonly type: string; readonly code: string; readonly param: string | null } };
}

const errorBody = (status: number, type: string, code: string, message: string, param: string | null): OpenAIError =>
  ({ status, body: { error: { message, type, code, param } } });

export function toOpenAIError(error: unknown): OpenAIError {
  if (error instanceof UnsupportedFeatureError) return errorBody(400, "invalid_request_error", "unsupported_feature", error.message, null);
  // Anything unexpected keeps its message (paths, stack) out of the client response.
  if (!(error instanceof EngineError) || error.code === "INTERNAL_ERROR") return errorBody(500, "server_error", "internal_error", "Internal error", null);
  const shape = ERROR_SHAPES[error.code];
  const upstream = error.details.upstreamCode;
  // Agents act on specific upstream codes (context_length_exceeded trims context), so a sane one is kept.
  const keepUpstream = (error.code === "INVALID_REQUEST" || error.code === "MODEL_UNAVAILABLE") && typeof upstream === "string" && UPSTREAM_CODE.test(upstream);
  const param = typeof error.details.param === "string" ? error.details.param : null;
  return errorBody(shape.status, shape.type, keepUpstream ? upstream : shape.code, error.message, param);
}

// ---- streaming ----

export interface StreamMeta extends CompletionMeta {
  // Used when the stream has no start chunk.
  readonly model: string;
  readonly includeUsage: boolean;
}

const frame = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;

// Turns StreamChunks into OpenAI SSE text. The caller writes each returned string as it comes.
export class OpenAIChatStreamEncoder {
  private readonly meta: StreamMeta;
  private id: string;
  private model: string;
  private started = false;
  private closed = false;
  private usage: TokenUsage | undefined;

  constructor(meta: StreamMeta) {
    this.meta = meta;
    this.id = meta.fallbackId;
    this.model = meta.model;
  }

  encode(chunk: StreamChunk): string {
    this.assertOpen();
    if (chunk.type === "start") return this.started ? "" : this.open(chunk.id, chunk.model);
    const head = this.started ? "" : this.open("", "");
    switch (chunk.type) {
      case "text_delta": return head + this.delta({ content: chunk.text });
      case "thinking_delta": return head + this.delta({ reasoning_content: chunk.text });
      case "tool_call_delta": {
        const fn = { ...(chunk.name ? { name: chunk.name } : {}), arguments: chunk.argumentsDelta };
        return head + this.delta({ tool_calls: [{ index: chunk.index, ...(chunk.id ? { id: chunk.id, type: "function" } : {}), function: fn }] });
      }
      case "usage":
        // OpenAI sends usage after the finish chunk, so it waits for stop.
        this.usage = chunk.usage;
        return head;
      case "stop": {
        const finish = this.chunk([{ index: 0, delta: {}, logprobs: null, finish_reason: FINISH_REASONS[chunk.stopReason] }]);
        const usage = this.meta.includeUsage && this.usage ? frame({ ...this.chunk([]), usage: usageJson(this.usage) }) : "";
        return head + frame(finish) + usage;
      }
    }
  }

  end(): string {
    this.assertOpen();
    this.closed = true;
    return "data: [DONE]\n\n";
  }

  // A failed stream ends with an error event and no [DONE], so a client can tell it from a finished one.
  fail(error: unknown): string {
    this.assertOpen();
    this.closed = true;
    return frame(toOpenAIError(error).body);
  }

  private open(id: string, model: string): string {
    this.started = true;
    this.id = id || this.meta.fallbackId;
    this.model = model || this.meta.model;
    return this.delta({ role: "assistant", content: "" });
  }

  private delta(delta: Json): string {
    return frame(this.chunk([{ index: 0, delta, logprobs: null, finish_reason: null }]));
  }

  private chunk(choices: readonly Json[]): Json {
    return { id: this.id, object: "chat.completion.chunk", created: this.meta.created, model: this.model, choices };
  }

  private assertOpen(): void {
    if (this.closed) throw new Error("OpenAIChatStreamEncoder is closed: end() or fail() was already called");
  }
}
