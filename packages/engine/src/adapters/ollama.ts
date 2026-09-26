import { UnsupportedFeatureError, type CanonicalRequest, type CanonicalResponse, type ContentPart, type StopReason, type StreamChunk, type TokenUsage } from "../cip.js";
import { EngineError } from "../errors.js";
import { readBoundedText } from "../http.js";
import { isRecord, list, parseJson, record, text, type Json } from "../json.js";
import type { AIProviderPort, Credential, ExecCtx, HttpRequest, ListedModel } from "../ports.js";
import { MODEL_ID } from "../registry.js";
import { readJsonLines } from "../sse.js";
import { count, METADATA_TIMEOUT_MS, RETRY } from "./http-adapter.js";
import { OpenAICompatibleAdapter } from "./openai-compatible.js";

// AIProviderPort for the ollama family, POST <host>/api/chat (docs/contracts/provider-ollama.md). User decision
// (2026-09-26): the request and the stream are corrected where 9router drops fields, attachments, errors, or a
// cut-off (translator.openai-to-ollama-request, translator.ollama-to-openai-response). The connection test is the
// OpenAI one (GET <modelsUrl>, here /api/tags).

const TARGET = "ollama";
const CHAT_TIMEOUT_MS = 300_000;
const STREAM_TIMEOUT_MS = 600_000;
const MAX_LISTED_MODELS = 1_000;
const MAX_TOOL_CALLS = 128;

const unsupported = (feature: string) => new UnsupportedFeatureError(feature, TARGET);

// ---- CIP -> /api/chat ----

// Ollama takes tool arguments as an object.
function toolArguments(args: string): Json {
  if (args.trim() === "") return {};
  const value = parseJson(args);
  if (!isRecord(value)) throw new EngineError("INVALID_REQUEST", "A tool call's arguments are not a JSON object, so they cannot be sent to Ollama", {});
  return value;
}

function textOf(parts: readonly ContentPart[], where: string): string {
  return parts.map((part) => {
    if (part.type !== "text") throw unsupported(`${part.type} in ${where}`);
    return part.text;
  }).join("\n");
}

function toMessages(request: CanonicalRequest): Json[] {
  // tool_name comes from the assistant call with the same id (9router), else unknown_tool.
  const names = new Map<string, string>();
  for (const message of request.messages) for (const part of message.content) if (part.type === "tool_call") names.set(part.id, part.name);
  const out: Json[] = [];
  if (request.system && request.system.length > 0) out.push({ role: "system", content: textOf(request.system, "the system prompt") });
  for (const message of request.messages) {
    const texts: string[] = [];
    const images: string[] = [];
    const calls: Json[] = [];
    for (const part of message.content) {
      switch (part.type) {
        case "tool_result":
          // An empty result is kept, unlike 9router, so the call keeps its answer.
          out.push({ role: "tool", tool_name: names.get(part.toolCallId) ?? "unknown_tool", content: textOf(part.content, "a tool result") });
          break;
        case "text":
          texts.push(part.text);
          break;
        case "image":
          if (message.role === "assistant") throw unsupported("an image in an assistant message");
          if (part.source.kind !== "base64") throw unsupported("an image by url (Ollama takes base64 images only)");
          if (part.detail !== undefined && part.detail !== "auto") throw unsupported(`image detail "${part.detail}"`);
          images.push(part.source.data);
          break;
        case "tool_call":
          if (message.role !== "assistant") throw unsupported("a tool call outside an assistant message");
          calls.push({ type: "function", function: { name: part.name, arguments: toolArguments(part.arguments) } });
          break;
        default:
          throw unsupported(`${part.type} in a ${message.role} message`);
      }
    }
    if (message.role === "assistant") {
      if (texts.length > 0 || calls.length > 0) out.push({ role: "assistant", content: texts.join("\n"), ...(calls.length > 0 ? { tool_calls: calls } : {}) });
    } else if (texts.length > 0 || images.length > 0) {
      // An image-only turn is kept, unlike 9router.
      out.push({ role: "user", content: texts.join("\n"), ...(images.length > 0 ? { images } : {}) });
    }
  }
  return out;
}

// response_format → Ollama's format: "json", or the JSON schema itself.
function format(value: unknown): unknown {
  const spec = record(value);
  if (spec.type === "text") return undefined;
  if (spec.type === "json_object") return "json";
  const schema = record(spec.json_schema).schema;
  if (spec.type === "json_schema" && isRecord(schema)) return schema;
  throw unsupported("vendorExtensions.openai.response_format of that type");
}

function toBody(request: CanonicalRequest, stream: boolean): Json {
  if (request.reasoning?.budgetTokens !== undefined) throw unsupported("reasoning.budgetTokens");
  const extensions = request.vendorExtensions ?? {};
  for (const namespace of Object.keys(extensions)) if (namespace !== "openai") throw unsupported(`vendorExtensions.${namespace}`);
  const options: Json = {};
  let jsonFormat: unknown;
  let think: unknown = request.reasoning?.effort;
  for (const [key, value] of Object.entries(extensions.openai ?? {})) {
    if (key === "seed" || key === "presence_penalty" || key === "frequency_penalty") options[key] = value;
    else if (key === "response_format") jsonFormat = format(value);
    else if (key === "reasoning_effort" && value === "none") think = false;
    else throw unsupported(`vendorExtensions.openai.${key}${key === "reasoning_effort" ? ` "${String(value)}"` : ""}`);
  }
  if (request.temperature !== undefined) options.temperature = request.temperature;
  if (request.topP !== undefined) options.top_p = request.topP;
  if (request.maxOutputTokens !== undefined) options.num_predict = request.maxOutputTokens;
  if (request.stop !== undefined) options.stop = request.stop;
  return {
    model: request.model,
    messages: toMessages(request),
    stream,
    ...(request.tools && request.tools.length > 0 ? {
      tools: request.tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } })),
    } : {}),
    // 9router passes tool_choice through in the OpenAI shape.
    ...(request.toolChoice !== undefined ? { tool_choice: typeof request.toolChoice === "string" ? request.toolChoice : { type: "function", function: { name: request.toolChoice.name } } } : {}),
    ...(Object.keys(options).length > 0 ? { options } : {}),
    ...(jsonFormat !== undefined ? { format: jsonFormat } : {}),
    ...(think !== undefined ? { think } : {}),
  };
}

// ---- /api/chat -> CIP ----

const usageOf = (root: Json): TokenUsage => ({ inputTokens: count(root.prompt_eval_count), outputTokens: count(root.eval_count) });
const LENGTH = new Set(["length", "max_tokens"]);

export class OllamaAdapter extends OpenAICompatibleAdapter implements AIProviderPort {
  override async execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<CanonicalResponse> {
    const response = await this.send(this.chatRequest(request, credential, false), credential, ctx, RETRY.maxAttempts);
    const root = parseJson(await readBoundedText(response.body));
    if (!isRecord(root)) throw this.invalid("an answer that is not a JSON object");
    if (root.error !== undefined) throw this.streamError(root.error, credential, false);
    const message = record(root.message);
    const calls = this.toolCalls(list(message.tool_calls), 0, false);
    const thinking = text(message.thinking);
    const answer = text(message.content);
    const content: ContentPart[] = [
      ...(thinking ? [{ type: "thinking" as const, text: thinking }] : []),
      ...(answer ? [{ type: "text" as const, text: answer }] : []),
      ...calls.map((call) => ({ type: "tool_call" as const, id: call.id, name: call.name, arguments: call.arguments })),
    ];
    return { id: "", model: text(root.model) ?? request.model, content, stopReason: this.stopReason(root, calls.length > 0), usage: usageOf(root) };
  }

  // A line with an error fails the answer, and a stream that stops before its done line is a failure (corrected).
  override async *stream(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): AsyncGenerator<StreamChunk> {
    const response = await this.send(this.chatRequest(request, credential, true), credential, ctx, RETRY.maxAttempts);
    if (!response.body) throw this.invalid("an empty answer to a streaming request");
    let started = false;
    let toolCount = 0;
    for await (const line of readJsonLines(response.body)) {
      const event = parseJson(line);
      if (!isRecord(event)) throw this.invalid("a stream line that is not a JSON object", started);
      if (event.error !== undefined) throw this.streamError(event.error, credential, started);
      if (!started) {
        started = true;
        yield { type: "start", id: "", model: text(event.model) ?? request.model };
      }
      const message = record(event.message);
      const thinking = text(message.thinking);
      if (thinking) yield { type: "thinking_delta", index: 0, text: thinking };
      const content = text(message.content);
      if (content) yield { type: "text_delta", index: 0, text: content };
      // Ollama sends each tool call whole, once; each gets the next index.
      for (const call of this.toolCalls(list(message.tool_calls), toolCount, true)) {
        yield { type: "tool_call_delta", index: toolCount++, id: call.id, name: call.name, argumentsDelta: call.arguments };
      }
      if (event.done === true) {
        yield { type: "usage", usage: usageOf(event) };
        yield { type: "stop", stopReason: this.stopReason(event, toolCount > 0) };
        return;
      }
    }
    throw new EngineError("PROVIDER_UNAVAILABLE", `${this.provider.name} ended the stream before it finished`, { provider: this.provider.id, partial: started });
  }

  // /api/tags lists { models: [{ name, model }] }.
  override async getModels(credential: Credential, ctx: ExecCtx): Promise<readonly ListedModel[]> {
    const response = await this.send(this.request("GET", this.provider.modelsUrl, credential, METADATA_TIMEOUT_MS), credential, ctx, RETRY.maxAttempts);
    const models = record(parseJson(await readBoundedText(response.body))).models;
    if (!Array.isArray(models)) throw this.invalid("a model list without a models array");
    const listed: ListedModel[] = [];
    for (const entry of models.slice(0, MAX_LISTED_MODELS)) {
      const id = text(record(entry).model) ?? text(record(entry).name);
      if (id === undefined || !MODEL_ID.test(id)) continue;
      const descriptor = this.known.get(id);
      listed.push(descriptor ? { id, descriptor } : { id });
    }
    return listed;
  }

  private toolCalls(entries: readonly unknown[], already: number, partial: boolean): { id: string; name: string; arguments: string }[] {
    if (already + entries.length > MAX_TOOL_CALLS) throw this.invalid(`more than ${MAX_TOOL_CALLS} tool calls`, partial);
    return entries.map((entry, i) => {
      const call = record(entry);
      const fn = record(call.function);
      const name = text(fn.name);
      if (!name) throw this.invalid("a tool call without a name", partial);
      const args = fn.arguments;
      return { id: text(call.id) || `call_${already + i}_${Date.now()}`, name, arguments: typeof args === "string" ? args : JSON.stringify(args ?? {}) };
    });
  }

  private stopReason(root: Json, sawToolCall: boolean): StopReason {
    if (sawToolCall) return "tool_use";
    return LENGTH.has(text(root.done_reason) ?? "") ? "max_tokens" : "end_turn";
  }

  private chatRequest(request: CanonicalRequest, credential: Credential, stream: boolean): HttpRequest {
    const base = this.request("POST", this.provider.chatUrl, credential, stream ? STREAM_TIMEOUT_MS : CHAT_TIMEOUT_MS);
    return {
      ...base,
      headers: { ...base.headers, "content-type": "application/json", accept: stream ? "application/x-ndjson" : "application/json" },
      body: JSON.stringify(toBody(request, stream)),
    };
  }
}
