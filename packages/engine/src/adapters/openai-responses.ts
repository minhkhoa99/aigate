import { UnsupportedFeatureError, type CanonicalRequest, type CanonicalResponse, type ContentPart, type StopReason, type StreamChunk, type TokenUsage, type ToolDefinition } from "../cip.js";
import { EngineError } from "../errors.js";
import { readBoundedText } from "../http.js";
import { isRecord, list, parseJson, record, text, type Json } from "../json.js";
import type { AIProviderPort, Credential, ExecCtx, HttpRequest } from "../ports.js";
import { readSseData } from "../sse.js";
import { count, RETRY } from "./http-adapter.js";
import { mediaUrl, OpenAICompatibleAdapter, userPart } from "./openai-compatible.js";

// AIProviderPort for the openai-responses family (docs/contracts/provider-openai-responses.md). The request and
// the stream are 9router's, including its silent drops (user decision 2026-09-26: translator.openai-to-responses-request,
// translator.responses-to-openai-stream). The non-streaming answer is read correctly (routing.responses-non-stream-answer).
// The model list and the connection test are the OpenAI ones (GET <modelsUrl>).

const TARGET = "openai-responses";
const CHAT_TIMEOUT_MS = 300_000;
const STREAM_TIMEOUT_MS = 600_000;
const MAX_TOOL_NAME = 128;
const MAX_CALL_ID = 64;
const MAX_TOOL_CALLS = 128;
// The only vendor fields 9router copies; every other one (tool_choice, stop, response_format, …) is dropped.
const COPIED = ["reasoning", "service_tier", "prompt_cache_key"] as const;
const TOOL_ITEMS = new Set(["function_call", "custom_tool_call"]);

const unsupported = (feature: string) => new UnsupportedFeatureError(feature, TARGET);

// ---- CIP -> Responses (9router rules) ----

let callSeq = 0;
// A call id longer than 64 characters is cut; an empty one gets a generated id.
const callId = (id: string): string => (id === "" ? `call_${Date.now()}_${(callSeq += 1)}` : id.slice(0, MAX_CALL_ID));
// Arguments that do not parse as JSON become "{}".
const toolArguments = (args: string): string => (args === "" || parseJson(args) === undefined ? "{}" : args);
// A part with no Responses form travels as the JSON text of its OpenAI chat part.
const asText = (part: ContentPart): string => JSON.stringify(userPart(part));

function userContent(part: ContentPart): Json {
  if (part.type === "text") return { type: "input_text", text: part.text };
  if (part.type === "image") return { type: "input_image", image_url: mediaUrl(part.source), detail: part.detail ?? "auto" };
  return { type: "input_text", text: asText(part) };
}

function toInput(request: CanonicalRequest): Json[] {
  const input: Json[] = [];
  for (const message of request.messages) {
    const content: Json[] = [];
    const calls: Json[] = [];
    for (const part of message.content) {
      if (part.type === "tool_result") {
        input.push({ type: "function_call_output", call_id: callId(part.toolCallId), output: part.content.map((inner) => (inner.type === "text" ? inner.text : asText(inner))).join("") });
      } else if (part.type === "tool_call") {
        const name = part.name.trim();
        if (name) calls.push({ type: "function_call", call_id: callId(part.id), name: name.slice(0, MAX_TOOL_NAME), arguments: toolArguments(part.arguments) });
      } else if (message.role === "assistant") {
        if (part.type !== "text") throw unsupported(`${part.type} in an assistant message`);
        content.push({ type: "output_text", text: part.text });
      } else {
        content.push(userContent(part));
      }
    }
    if (content.length > 0) input.push({ type: "message", role: message.role === "assistant" ? "assistant" : "user", content });
    input.push(...calls);
  }
  return input;
}

function toTools(tools: readonly ToolDefinition[]): Json[] {
  return tools.flatMap((tool) => {
    const name = tool.name.trim();
    if (!name) return [];
    const parameters = tool.parameters.type === "object" && tool.parameters.properties === undefined ? { ...tool.parameters, properties: {} } : tool.parameters;
    return [{ type: "function", name: name.slice(0, MAX_TOOL_NAME), description: tool.description ?? "", parameters, ...(tool.strict !== undefined ? { strict: tool.strict } : {}) }];
  });
}

function toBody(request: CanonicalRequest, stream: boolean): Json {
  if (request.reasoning?.budgetTokens !== undefined) throw unsupported("reasoning.budgetTokens");
  const extensions = request.vendorExtensions ?? {};
  for (const namespace of Object.keys(extensions)) if (namespace !== "openai") throw unsupported(`vendorExtensions.${namespace}`);
  const openai = extensions.openai ?? {};
  // CIP keeps the leading system messages as one prompt, so all of them become instructions (9router keeps the first).
  const instructions = (request.system ?? []).map((part) => (part.type === "text" ? part.text : "")).filter(Boolean).join("\n");
  const body: Json = { model: request.model, input: toInput(request), stream, store: false, instructions };
  if (request.tools) body.tools = toTools(request.tools);
  if (request.temperature !== undefined) body.temperature = request.temperature;
  const maxOutput = openai.max_output_tokens ?? request.maxOutputTokens;
  if (maxOutput !== undefined) body.max_output_tokens = maxOutput;
  if (request.topP !== undefined) body.top_p = request.topP;
  for (const key of COPIED) if (openai[key] !== undefined) body[key] = openai[key];
  const effort = request.reasoning?.effort ?? openai.reasoning_effort;
  if (effort !== undefined) body.reasoning = { effort, summary: "auto" };
  return body;
}

// ---- Responses -> CIP ----

// Responses input_tokens includes cached tokens; CIP inputTokens does not.
function usageOf(value: unknown): TokenUsage {
  const usage = record(value);
  const input = count(usage.input_tokens) || count(usage.prompt_tokens);
  const cached = count(record(usage.input_tokens_details).cached_tokens) || count(usage.cache_read_input_tokens);
  const reasoning = count(record(usage.output_tokens_details).reasoning_tokens);
  return {
    inputTokens: Math.max(0, input - cached),
    outputTokens: count(usage.output_tokens) || count(usage.completion_tokens),
    ...(cached > 0 ? { cacheReadTokens: cached } : {}),
    ...(reasoning > 0 ? { reasoningTokens: reasoning } : {}),
  };
}

const INCOMPLETE = new Map<string, StopReason>([["max_output_tokens", "max_tokens"], ["content_filter", "content_filter"]]);

export class OpenAIResponsesAdapter extends OpenAICompatibleAdapter implements AIProviderPort {
  // Correct, unlike 9router (routing.responses-non-stream-answer): stream false, and the Responses object is read.
  override async execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<CanonicalResponse> {
    const response = await this.send(this.responses(request, credential, false), credential, ctx, RETRY.maxAttempts);
    const root = parseJson(await readBoundedText(response.body));
    if (!isRecord(root) || !Array.isArray(root.output)) throw this.invalid("a response without an output array");
    if (root.status === "failed") {
      const message = this.clean(text(record(root.error).message), credential);
      throw new EngineError("PROVIDER_UNAVAILABLE", `${this.provider.name} reported a failed response${message ? `: ${message}` : ""}`, { provider: this.provider.id });
    }
    let reasoning = "";
    let answer = "";
    let refusal = "";
    const calls: ContentPart[] = [];
    for (const entry of root.output) {
      const item = record(entry);
      if (item.type === "reasoning") {
        reasoning += list(item.summary).map((s) => text(record(s).text) ?? "").join("");
      } else if (item.type === "message") {
        for (const part of list(item.content).map(record)) {
          if (part.type === "output_text") answer += text(part.text) ?? "";
          else if (part.type === "refusal") refusal += text(part.refusal) ?? "";
        }
      } else if (TOOL_ITEMS.has(text(item.type) ?? "")) {
        const id = text(item.call_id);
        const name = text(item.name);
        if (!id || !name) throw this.invalid("a tool call without a call_id or name");
        calls.push({ type: "tool_call", id, name, arguments: text(item.arguments) ?? text(item.input) ?? "" });
      }
      // Server-side items (web search, file search, …) carry nothing a chat client can show.
    }
    const content: ContentPart[] = [...(reasoning ? [{ type: "thinking" as const, text: reasoning }] : []), ...(answer ? [{ type: "text" as const, text: answer }] : []), ...calls];
    const incomplete = root.status === "incomplete" ? INCOMPLETE.get(text(record(root.incomplete_details).reason) ?? "") : undefined;
    const stopReason: StopReason = calls.length > 0 ? "tool_use" : incomplete ?? (refusal && !answer ? "content_filter" : "end_turn");
    return {
      id: text(root.id) ?? "",
      model: text(root.model) ?? request.model,
      content,
      stopReason,
      usage: usageOf(root.usage),
      ...(refusal ? { vendorExtensions: { openai: { refusal } } } : {}),
    };
  }

  // translator.responses-to-openai-stream, kept as 9router has it: an error event becomes "[Error] …" text, a stream
  // that stops early still ends normally, and incomplete answers and refusals are not reported.
  override async *stream(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): AsyncGenerator<StreamChunk> {
    const response = await this.send(this.responses(request, credential, true), credential, ctx, RETRY.maxAttempts);
    if (!response.body || !(response.headers["content-type"] ?? "").includes("text/event-stream")) {
      await response.body?.cancel();
      throw this.invalid("a non-SSE response to a streaming request");
    }
    let started = false;
    let usage: TokenUsage | undefined;
    let toolCount = 0;
    // The item id of each tool call → its chat index, so interleaved parallel calls stay apart.
    const tools = new Map<string, number>();
    const argumentsSent = new Set<number>();
    const lastTool = () => Math.max(0, toolCount - 1);
    const end = (): StreamChunk => ({ type: "stop", stopReason: toolCount > 0 ? "tool_use" : "end_turn" });
    for await (const data of readSseData(response.body)) {
      const event = record(parseJson(data));
      const type = text(event.type) ?? text(event.event);
      const payload = isRecord(event.data) ? event.data : event;
      if (!started) {
        started = true;
        yield { type: "start", id: "", model: request.model };
      }
      if (type === "response.output_text.delta") {
        const delta = text(payload.delta);
        if (delta) yield { type: "text_delta", index: 0, text: delta };
      } else if (type === "response.reasoning_summary_text.delta") {
        const delta = text(payload.delta);
        if (delta) yield { type: "thinking_delta", index: 0, text: delta };
      } else if (type === "response.output_item.added" && TOOL_ITEMS.has(text(record(payload.item).type) ?? "")) {
        const item = record(payload.item);
        const id = text(item.call_id) || callId("");
        const key = text(item.id) || text(payload.item_id) || id;
        let index = tools.get(key);
        if (index === undefined) {
          if (toolCount >= MAX_TOOL_CALLS) throw this.invalid(`more than ${MAX_TOOL_CALLS} tool calls`, true);
          index = toolCount++;
          tools.set(key, index);
        }
        yield { type: "tool_call_delta", index, id, name: text(item.name) ?? "", argumentsDelta: "" };
      } else if (type === "response.function_call_arguments.delta" || type === "response.custom_tool_call_input.delta") {
        const delta = text(payload.delta);
        if (!delta) continue;
        const index = tools.get(text(payload.item_id) ?? "") ?? lastTool();
        argumentsSent.add(index);
        yield { type: "tool_call_delta", index, argumentsDelta: delta };
      } else if (type === "response.output_item.done" && TOOL_ITEMS.has(text(record(payload.item).type) ?? "")) {
        const item = record(payload.item);
        const index = tools.get(text(item.id) || text(payload.item_id) || "") ?? lastTool();
        const full = text(item.arguments);
        if (full && !argumentsSent.has(index)) {
          argumentsSent.add(index);
          yield { type: "tool_call_delta", index, argumentsDelta: full };
        }
      } else if (type === "response.completed" || type === "response.done") {
        const raw = record(payload.response).usage;
        if (isRecord(raw)) usage = usageOf(raw);
        if (usage) yield { type: "usage", usage };
        yield end();
        return;
      } else if (type === "error" || type === "response.failed") {
        const error = payload.error ?? record(payload.response).error;
        if (error === undefined || error === null) continue;
        const message = text(record(error).message) || JSON.stringify(error);
        yield { type: "text_delta", index: 0, text: `[Error] ${this.clean(message, credential)}` };
        yield { type: "stop", stopReason: "end_turn" };
        return;
      }
      // Every other event (response.incomplete, refusals, server-side tools, …) is ignored, as in 9router.
    }
    if (!started) yield { type: "start", id: "", model: request.model };
    yield end();
  }

  private responses(request: CanonicalRequest, credential: Credential, stream: boolean): HttpRequest {
    const base = this.request("POST", this.provider.chatUrl, credential, stream ? STREAM_TIMEOUT_MS : CHAT_TIMEOUT_MS);
    return {
      ...base,
      headers: { ...base.headers, "content-type": "application/json", accept: stream ? "text/event-stream" : "application/json" },
      body: JSON.stringify(toBody(request, stream)),
    };
  }
}
