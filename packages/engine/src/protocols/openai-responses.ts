import {
  UnsupportedFeatureError, type CanonicalMessage, type CanonicalRequest, type CanonicalResponse, type ContentPart, type StreamChunk, type TokenUsage,
  type ToolDefinition,
} from "../cip.js";
import { EngineError } from "../errors.js";
import { isRecord, list, parseJson, record, text, type Json } from "../json.js";
import type { ProviderDescriptor } from "../registry.js";
import { streamRequested } from "./anthropic-messages.js";
import { mediaSource, toOpenAIChatCompletion, toOpenAIError, type CompletionMeta } from "./openai-chat.js";

// Client-facing OpenAI Responses protocol, POST /v1/responses (docs/contracts/protocol-responses.md).
// User decisions (2026-09-27): everything is kept as 9router has it — the body passes unchanged to a Responses provider;
// for any other provider the Responses → chat pivot with its drops and copied fields; the SSE events, the non-streaming
// answer (a response object only for an openai or Responses target), and an omitted stream streaming.

const MAX_ITEMS = 10_000;
const MAX_PARTS = 512;
const MAX_TOOLS = 128;
const MAX_EXTENSIONS = 64;
const MODEL = /^[\x21-\x7e]{1,256}$/;
const NO_PARAMETERS = { type: "object", properties: {} };
const CUSTOM_PARAMETERS = {
  type: "object",
  properties: { input: { type: "string", description: "Raw freeform input for this custom tool" } },
  required: ["input"],
  additionalProperties: false,
};
// Fields the pivot turns into CIP or deletes; 9router copies every other one into the chat body.
const MODELLED = new Set([
  "model", "input", "instructions", "tools", "tool_choice", "max_output_tokens", "max_tokens", "temperature", "top_p", "reasoning", "stream",
  "include", "prompt_cache_key", "store", "client_metadata",
]);
const EFFORTS = new Set(["low", "medium", "high"]);
const DETAILS = new Set(["low", "high", "auto"]);
// Protocols whose adapters refuse reasoning in the history; 9router's pivot to them drops reasoning_content.
const NO_REASONING_HISTORY = new Set(["anthropic", "ollama"]);

const invalid = (param: string, message: string) => new EngineError("INVALID_REQUEST", `${param} ${message}`, { param });
const unsupported = (feature: string) => new UnsupportedFeatureError(feature, "AIGate");

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

// ---- request: the Responses body through 9router's pivot, in CIP ----

export interface ResponsesClientRequest {
  readonly request: CanonicalRequest;
  // The body as sent: a Responses provider receives it unchanged.
  readonly body: Json;
  // Custom (freeform) tools: their calls go back as custom_tool_call items.
  readonly customTools: ReadonlySet<string>;
}

// normalizeResponsesInput: a blank string or an empty list is one user message "...".
function inputItems(input: unknown): readonly unknown[] {
  if (typeof input === "string" && input !== "") return [{ type: "message", role: "user", content: [{ type: "input_text", text: input.trim() === "" ? "..." : input }] }];
  if (!Array.isArray(input)) throw invalid("input", "must be a non-empty string or an array of items");
  if (input.length > MAX_ITEMS) throw invalid("input", `may have at most ${MAX_ITEMS} items`);
  return input.length > 0 ? input : [{ type: "message", role: "user", content: [{ type: "input_text", text: "..." }] }];
}

function messageParts(content: unknown, param: string): ContentPart[] {
  if (typeof content === "string") return [{ type: "text", text: content }];
  if (!Array.isArray(content)) return [];
  if (content.length > MAX_PARTS) throw invalid(param, `may have at most ${MAX_PARTS} parts`);
  return content.map((raw, i): ContentPart => {
    if (!isRecord(raw)) throw invalid(`${param}[${i}]`, "must be an object");
    if (raw.type === "input_text" || raw.type === "output_text") return { type: "text", text: text(raw.text) ?? "" };
    if (raw.type === "input_image") {
      const detail = text(raw.detail) || "auto";
      if (!DETAILS.has(detail)) throw invalid(`${param}[${i}].detail`, "must be low, high, or auto");
      return { type: "image", source: mediaSource(text(raw.image_url) || text(raw.file_id) || "", `${param}[${i}].image_url`), detail: detail === "low" ? "low" : detail === "high" ? "high" : "auto" };
    }
    // 9router copies any other part (input_file, refusal, …) into the chat body; CIP cannot carry it as it is.
    if (typeof raw.type !== "string") throw invalid(`${param}[${i}].type`, "must be a string");
    throw unsupported(`${raw.type} content`);
  });
}

interface Pivot {
  system: ContentPart[];
  messages: CanonicalMessage[];
  extraTools: unknown[];
  customTools: Set<string>;
}

function pivotItems(items: readonly unknown[]): Pivot {
  const pivot: Pivot = { system: [], messages: [], extraTools: [], customTools: new Set() };
  // Consecutive tool calls form one assistant turn; reasoning waits for the next assistant turn.
  let calls: ContentPart[] | undefined;
  let reasoning = "";
  let encrypted = "";
  const takeReasoning = (): ContentPart[] => {
    const part: ContentPart[] = reasoning || encrypted ? [{ type: "thinking", text: reasoning, ...(encrypted ? { signature: encrypted } : {}) }] : [];
    reasoning = "";
    encrypted = "";
    return part;
  };
  const flush = () => {
    if (calls) pivot.messages.push({ role: "assistant", content: calls });
    calls = undefined;
  };
  items.forEach((raw, i) => {
    const param = `input[${i}]`;
    if (!isRecord(raw)) throw invalid(param, "must be an object");
    // An item without a type but with a role is a message (Droid CLI).
    const type = raw.type ?? (raw.role !== undefined ? "message" : undefined);
    switch (type) {
      case "message": {
        flush();
        const content = messageParts(raw.content, `${param}.content`);
        if (raw.role === "assistant") pivot.messages.push({ role: "assistant", content: [...takeReasoning(), ...content] });
        else {
          takeReasoning();
          // CIP has one system prompt in front, so a system or developer message joins it wherever it stands.
          if (raw.role === "system" || raw.role === "developer") pivot.system.push(...content.filter((part) => part.type === "text"));
          else if (raw.role === "user") pivot.messages.push({ role: "user", content });
          else throw invalid(`${param}.role`, "must be user, assistant, system, or developer");
        }
        break;
      }
      case "function_call":
      case "custom_tool_call": {
        calls ??= takeReasoning();
        const name = text(raw.name);
        // A call without a name is skipped (upstreams reject nameless calls).
        if (!name?.trim()) break;
        let args: string;
        if (type === "custom_tool_call") {
          pivot.customTools.add(name);
          args = JSON.stringify({ input: typeof raw.input === "string" ? raw.input : JSON.stringify(raw.input ?? "") });
        } else args = typeof raw.arguments === "string" ? raw.arguments : JSON.stringify(raw.arguments ?? {});
        calls.push({ type: "tool_call", id: text(raw.call_id) ?? "", name, arguments: args });
        break;
      }
      case "function_call_output":
      case "custom_tool_call_output": {
        flush();
        const output = typeof raw.output === "string" ? raw.output : JSON.stringify(raw.output) ?? "";
        pivot.messages.push({ role: "tool", content: [{ type: "tool_result", toolCallId: text(raw.call_id) ?? "", content: [{ type: "text", text: output }] }] });
        break;
      }
      case "additional_tools":
        pivot.extraTools.push(...list(raw.tools));
        break;
      case "reasoning": {
        const summary = list(raw.summary).map((s) => text(record(s).text) ?? "").filter(Boolean).join("\n");
        const said = summary || list(raw.content).map((c) => text(record(c).text) ?? "").filter(Boolean).join("\n");
        if (said) reasoning = reasoning ? `${reasoning}\n${said}` : said;
        if (typeof raw.encrypted_content === "string" && raw.encrypted_content) encrypted = raw.encrypted_content;
        break;
      }
      default:
        if (type !== undefined && typeof type !== "string") throw invalid(`${param}.type`, "must be a string");
      // 9router drops item types it has no rule for (item_reference, web_search_call, …).
    }
  });
  flush();
  return pivot;
}

function parametersOf(value: unknown): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) return NO_PARAMETERS;
  return value.type === "object" && value.properties === undefined ? { ...value, properties: {} } : value;
}

// Chat-shaped tools pass; hosted tools (web_search, file_search, …) have no name and are dropped (9router).
function toTools(value: readonly unknown[], customTools: Set<string>): ToolDefinition[] {
  if (value.length > MAX_TOOLS) throw invalid("tools", `may have at most ${MAX_TOOLS} tools`);
  return value.flatMap((raw, i): ToolDefinition[] => {
    if (!isRecord(raw)) throw invalid(`tools[${i}]`, "must be an object");
    const chat = isRecord(raw.function) ? raw.function : undefined;
    const name = text(chat ? chat.name : raw.name);
    if (!name?.trim()) return [];
    const description = text(chat ? chat.description : raw.description) ?? "";
    const strict = chat ? chat.strict : raw.strict;
    if (!chat && raw.type === "custom") {
      customTools.add(name);
      const format = record(raw.format);
      const hint = [text(format.syntax), text(format.definition)].filter(Boolean).join("\n");
      return [{ name, description: [description, hint].filter(Boolean).join("\n\n"), parameters: CUSTOM_PARAMETERS }];
    }
    return [{ name, description, parameters: parametersOf(chat ? chat.parameters : raw.parameters), ...(typeof strict === "boolean" ? { strict } : {}) }];
  });
}

export function parseOpenAIResponsesRequest(input: unknown, accept?: string): ResponsesClientRequest {
  if (!isRecord(input)) throw invalid("body", "must be a JSON object");
  const model = input.model;
  if (typeof model !== "string" || !MODEL.test(model)) throw invalid("model", "must be a model id");
  const pivot = pivotItems(inputItems(input.input));
  const instructions = text(input.instructions);
  const system: ContentPart[] = [...(instructions ? [{ type: "text" as const, text: instructions }] : []), ...pivot.system];
  const tools = toTools([...(input.tools === undefined || input.tools === null ? [] : list(input.tools)), ...pivot.extraTools], pivot.customTools);
  const passthrough = Object.entries(input).filter(([key]) => !MODELLED.has(key));
  if (passthrough.length > MAX_EXTENSIONS) throw invalid("body", `may have at most ${MAX_EXTENSIONS} fields AIGate does not model`);
  const openai: Json = Object.fromEntries(passthrough);
  // tool_choice is copied as sent; only the plain values have a CIP form.
  const choice = input.tool_choice;
  const toolChoice = choice === "auto" || choice === "none" || choice === "required" ? choice : undefined;
  if (toolChoice === undefined && choice !== undefined && choice !== null) openai.tool_choice = choice;
  const effort = text(record(input.reasoning).effort);
  if (effort !== undefined && !EFFORTS.has(effort)) openai.reasoning_effort = effort;
  // max_output_tokens becomes max_tokens unless max_tokens is set.
  const maxOutputTokens = optionalPositiveInteger(input.max_tokens, "max_tokens") ?? optionalPositiveInteger(input.max_output_tokens, "max_output_tokens");
  const temperature = optionalNumber(input.temperature, "temperature", 0, 2);
  const topP = optionalNumber(input.top_p, "top_p", 0, 1);
  const request: CanonicalRequest = {
    model,
    messages: pivot.messages,
    stream: streamRequested(input.stream, accept),
    ...(system.length > 0 ? { system } : {}),
    ...(tools.length > 0 ? { tools } : {}),
    ...(toolChoice ? { toolChoice } : {}),
    ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(topP !== undefined ? { topP } : {}),
    ...(effort === "low" || effort === "medium" || effort === "high" ? { reasoning: { effort } } : {}),
    ...(Object.keys(openai).length > 0 ? { vendorExtensions: { openai } } : {}),
  };
  return { request, body: input, customTools: pivot.customTools };
}

// ---- the request a provider receives (translator.responses-client-request) ----

export function responsesRequestFor(parsed: ResponsesClientRequest, request: CanonicalRequest, provider: ProviderDescriptor): CanonicalRequest {
  // Same format: 9router skips the conversion.
  if (provider.protocol === "openai-responses") return { model: request.model, messages: [], stream: request.stream, vendorExtensions: { responses: parsed.body } };
  // An openai target receives the pivot with every copied field.
  if (provider.protocol === "openai-compatible") return request;
  // 9router's openai → <target> translators build a new body: copied fields are not carried, nor reasoning where the target takes none.
  const messages = NO_REASONING_HISTORY.has(provider.protocol)
    ? request.messages.flatMap((message) => {
      const content = message.content.filter((part) => part.type !== "thinking");
      return content.length > 0 ? [{ ...message, content }] : [];
    })
    : request.messages;
  return { ...request, messages, vendorExtensions: undefined };
}

// 9router answers a non-streaming Responses client with a response object for an openai target (forced to stream or
// not) and a Responses target; every other provider's answer stays a chat.completion (kept).
export const responsesClientGetsObject = (provider: ProviderDescriptor): boolean =>
  provider.protocol === "openai-compatible" || provider.protocol === "openai-responses";

// ---- responses ----

const num = (value: unknown): number => (typeof value === "number" ? value : 0);

// A custom tool's input travels as the chat arguments { input }; the raw input goes back.
function customInput(args: string): string {
  const parsed = parseJson(args);
  return isRecord(parsed) && typeof parsed.input === "string" ? parsed.input : args;
}

// openAICompletionToResponses: the chat.completion the answer would be, reshaped.
export function toResponsesObject(response: CanonicalResponse, meta: CompletionMeta, customTools: ReadonlySet<string>): Json {
  const completion = toOpenAIChatCompletion(response, meta);
  const choice = record(list(completion.choices)[0]);
  const message = record(choice.message);
  const output: Json[] = [];
  const reasoning = text(message.reasoning_content);
  if (reasoning) output.push({ type: "reasoning", summary: [{ type: "summary_text", text: reasoning }] });
  const answer = text(message.content);
  if (answer) output.push({ type: "message", role: "assistant", content: [{ type: "output_text", text: answer, annotations: [] }] });
  for (const call of list(message.tool_calls).map(record)) {
    const fn = record(call.function);
    const id = text(call.id) ?? "";
    const name = text(fn.name) ?? "";
    const args = text(fn.arguments) ?? "{}";
    output.push(customTools.has(name)
      ? { type: "custom_tool_call", id: `ctc_${id}`, call_id: id, name, input: customInput(args) }
      : { type: "function_call", id: `fc_${id}`, call_id: id, name, arguments: args });
  }
  const finish = text(choice.finish_reason);
  const usage = record(completion.usage);
  // A Responses provider's own id is kept (9router returns that object as it is).
  const id = text(completion.id) ?? "";
  return {
    id: id.startsWith("resp_") ? id : `resp_${id}`.replace(/^resp_chatcmpl-/, "resp_"),
    object: "response",
    created_at: meta.created,
    model: text(completion.model) || "unknown",
    // The chat finish reason itself when it is not stop or tool_calls (9router, kept).
    status: !finish || finish === "stop" || finish === "tool_calls" ? "completed" : finish,
    background: false,
    error: null,
    output,
    usage: { input_tokens: num(usage.prompt_tokens), output_tokens: num(usage.completion_tokens), total_tokens: num(usage.total_tokens) },
  };
}

// ---- streaming (translator.openai-to-responses-client-response) ----

function responsesUsage(usage: TokenUsage): Json {
  const input = usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0);
  return {
    input_tokens: input,
    output_tokens: usage.outputTokens,
    total_tokens: input + usage.outputTokens,
    ...(usage.cacheReadTokens !== undefined ? { input_tokens_details: { cached_tokens: usage.cacheReadTokens } } : {}),
    ...(usage.reasoningTokens !== undefined ? { output_tokens_details: { reasoning_tokens: usage.reasoningTokens } } : {}),
  };
}

export interface ResponsesStreamMeta extends CompletionMeta {
  readonly customTools: ReadonlySet<string>;
  // 9router waits for a usage chunk after the finish only on a direct openai route; on a pivot, response.completed goes
  // out at the finish.
  readonly deferCompleted: boolean;
}

type Tool = { id?: string; name?: string; added: boolean; done: boolean; args: string };

// 9router's event shapes are kept as they are: reasoning, text and the first tool call share output_index 0,
// response.completed carries no output, and its status is always completed.
export class ResponsesStreamEncoder {
  private readonly meta: ResponsesStreamMeta;
  private responseId: string;
  private seq = 0;
  private started = false;
  private closed = false;
  private completed = false;
  private usage: TokenUsage | undefined;
  private reasoningId = "";
  private reasoningIndex = -1;
  private reasoningText = "";
  private reasoningDone = false;
  private inThinking = false;
  private message: { text: string; done: boolean } | undefined;
  private readonly tools = new Map<number, Tool>();

  constructor(meta: ResponsesStreamMeta) {
    this.meta = meta;
    this.responseId = `resp_${meta.fallbackId}`;
  }

  encode(chunk: StreamChunk): string {
    this.assertOpen();
    if (chunk.type === "start") return this.started ? "" : this.open(chunk.id);
    // A usage chunk is kept before anything opens (the last OpenAI chunk carries usage and no choices).
    if (chunk.type === "usage") {
      this.usage = chunk.usage;
      return "";
    }
    const head = this.started ? "" : this.open("");
    switch (chunk.type) {
      case "thinking_delta": return head + (chunk.text ? this.startReasoning() + this.reasoningDelta(chunk.text) : "");
      case "text_delta": return head + (chunk.text ? this.content(chunk.text) : "");
      case "tool_call_delta": return head + this.closeMessage() + this.tool(chunk);
      case "image_delta": return head;
      case "stop": {
        const out = head + this.closeAll();
        return this.usage || !this.meta.deferCompleted ? out + this.complete() : out;
      }
    }
  }

  // No [DONE]: a Responses client stops at response.completed. On a direct openai route the end sends the deferred
  // response.completed.
  end(): string {
    this.assertOpen();
    this.closed = true;
    return this.meta.deferCompleted && !this.completed ? this.closeAll() + this.complete() : "";
  }

  // 9router's abort frame for a Responses client is the chat error frame and [DONE] (kept).
  fail(error: unknown): string {
    this.assertOpen();
    this.closed = true;
    return `data: ${JSON.stringify(toOpenAIError(error).body)}\n\ndata: [DONE]\n\n`;
  }

  private emit(type: string, data: Json): string {
    this.seq += 1;
    return `event: ${type}\ndata: ${JSON.stringify({ type, ...data, sequence_number: this.seq })}\n\n`;
  }

  private open(id: string): string {
    this.started = true;
    this.responseId = `resp_${id || this.meta.fallbackId}`;
    const base = { id: this.responseId, object: "response", created_at: this.meta.created, status: "in_progress" };
    return this.emit("response.created", { response: { ...base, background: false, error: null, output: [] } }) + this.emit("response.in_progress", { response: base });
  }

  // Text inside <think>…</think> is reasoning.
  private content(delta: string): string {
    let out = "";
    let rest = delta;
    if (rest.includes("<think>")) {
      this.inThinking = true;
      rest = rest.replace("<think>", "");
      out += this.startReasoning();
    }
    if (rest.includes("</think>")) {
      const [thought = "", ...after] = rest.split("</think>");
      if (thought) out += this.reasoningDelta(thought);
      out += this.closeReasoning();
      this.inThinking = false;
      rest = after.join("</think>");
    }
    if (this.inThinking) return rest ? out + this.reasoningDelta(rest) : out;
    return rest ? out + this.text(rest) : out;
  }

  private startReasoning(): string {
    if (this.reasoningId) return "";
    this.reasoningId = `rs_${this.responseId}_0`;
    this.reasoningIndex = 0;
    return this.emit("response.output_item.added", { output_index: 0, item: { id: this.reasoningId, type: "reasoning", summary: [] } })
      + this.emit("response.reasoning_summary_part.added", { item_id: this.reasoningId, output_index: 0, summary_index: 0, part: { type: "summary_text", text: "" } });
  }

  private reasoningDelta(delta: string): string {
    this.reasoningText += delta;
    return this.emit("response.reasoning_summary_text.delta", { item_id: this.reasoningId, output_index: this.reasoningIndex, summary_index: 0, delta });
  }

  private closeReasoning(): string {
    if (!this.reasoningId || this.reasoningDone) return "";
    this.reasoningDone = true;
    const at = { item_id: this.reasoningId, output_index: this.reasoningIndex, summary_index: 0 };
    const part = { type: "summary_text", text: this.reasoningText };
    return this.emit("response.reasoning_summary_text.done", { ...at, text: this.reasoningText })
      + this.emit("response.reasoning_summary_part.done", { ...at, part })
      + this.emit("response.output_item.done", { output_index: this.reasoningIndex, item: { id: this.reasoningId, type: "reasoning", summary: [part] } });
  }

  private messageId(): string {
    return `msg_${this.responseId}_0`;
  }

  private text(delta: string): string {
    let out = "";
    if (!this.message) {
      this.message = { text: "", done: false };
      out += this.emit("response.output_item.added", { output_index: 0, item: { id: this.messageId(), type: "message", content: [], role: "assistant" } })
        + this.emit("response.content_part.added", { item_id: this.messageId(), output_index: 0, content_index: 0, part: { type: "output_text", annotations: [], logprobs: [], text: "" } });
    }
    this.message.text += delta;
    return out + this.emit("response.output_text.delta", { item_id: this.messageId(), output_index: 0, content_index: 0, delta, logprobs: [] });
  }

  private closeMessage(): string {
    if (!this.message || this.message.done) return "";
    this.message.done = true;
    const part = { type: "output_text", annotations: [], logprobs: [], text: this.message.text };
    const at = { item_id: this.messageId(), output_index: 0, content_index: 0 };
    return this.emit("response.output_text.done", { ...at, text: this.message.text, logprobs: [] })
      + this.emit("response.content_part.done", { ...at, part })
      + this.emit("response.output_item.done", { output_index: 0, item: { id: this.messageId(), type: "message", content: [part], role: "assistant" } });
  }

  // The item opens once the call id and name are both known; a custom tool's input waits for the finish.
  private tool(chunk: Extract<StreamChunk, { type: "tool_call_delta" }>): string {
    let tool = this.tools.get(chunk.index);
    if (!tool) {
      tool = { added: false, done: false, args: "" };
      this.tools.set(chunk.index, tool);
    }
    if (chunk.name) tool.name = chunk.name;
    if (chunk.id) tool.id = chunk.id;
    let out = "";
    const custom = this.meta.customTools.has(tool.name ?? "");
    if (!tool.added && tool.id && tool.name) {
      tool.added = true;
      const item = custom ? { id: `ctc_${tool.id}`, type: "custom_tool_call", input: "" } : { id: `fc_${tool.id}`, type: "function_call", arguments: "" };
      out += this.emit("response.output_item.added", { output_index: chunk.index, item: { ...item, call_id: tool.id, name: tool.name } });
    }
    if (!chunk.argumentsDelta) return out;
    if (tool.added && tool.id && !custom) {
      out += this.emit("response.function_call_arguments.delta", { item_id: `fc_${tool.id}`, output_index: chunk.index, delta: chunk.argumentsDelta });
    }
    tool.args += chunk.argumentsDelta;
    return out;
  }

  private closeTool(index: number, tool: Tool): string {
    if (!tool.id || tool.done) return "";
    tool.done = true;
    const args = tool.args || "{}";
    const name = tool.name ?? "";
    if (this.meta.customTools.has(name)) {
      const input = customInput(args);
      const itemId = `ctc_${tool.id}`;
      return this.emit("response.custom_tool_call_input.delta", { item_id: itemId, output_index: index, delta: input })
        + this.emit("response.custom_tool_call_input.done", { item_id: itemId, output_index: index, input })
        + this.emit("response.output_item.done", { output_index: index, item: { id: itemId, type: "custom_tool_call", input, call_id: tool.id, name } });
    }
    const itemId = `fc_${tool.id}`;
    return this.emit("response.function_call_arguments.done", { item_id: itemId, output_index: index, arguments: args })
      + this.emit("response.output_item.done", { output_index: index, item: { id: itemId, type: "function_call", arguments: args, call_id: tool.id, name } });
  }

  private closeAll(): string {
    let out = this.closeMessage() + this.closeReasoning();
    for (const [index, tool] of [...this.tools].sort(([a], [b]) => a - b)) out += this.closeTool(index, tool);
    return out;
  }

  private complete(): string {
    if (this.completed) return "";
    this.completed = true;
    const response = {
      id: this.responseId, object: "response", created_at: this.meta.created, status: "completed", background: false, error: null,
      ...(this.usage ? { usage: responsesUsage(this.usage) } : {}),
    };
    return this.emit("response.completed", { response });
  }

  private assertOpen(): void {
    if (this.closed) throw new Error("ResponsesStreamEncoder is closed: end() or fail() was already called");
  }
}
