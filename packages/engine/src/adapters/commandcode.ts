import { UnsupportedFeatureError, type CanonicalRequest, type CanonicalResponse, type ContentPart, type StopReason, type StreamChunk, type TokenUsage } from "../cip.js";
import { EngineError } from "../errors.js";
import { isRecord, parseJson, record, text, type Json } from "../json.js";
import type { AIProviderPort, Credential, CredentialStatus, ExecCtx, HttpRequest, ListedModel } from "../ports.js";
import { withRetry } from "../retry.js";
import { readJsonLines } from "../sse.js";
import { budgetToLevel } from "./gemini.js";
import { classifyStatus, count, HttpProviderAdapter, isTransient, METADATA_TIMEOUT_MS, RETRY } from "./http-adapter.js";

// AIProviderPort for the commandcode family: POST /alpha/generate, NDJSON AI SDK v5 events (docs/contracts/provider-commandcode.md).
// User decision (2026-09-27): the request and the stream keep 9router's behavior, drops and defaults included; only the
// executor's lost lines and missing [DONE] are not reproduced, and the connection test is real. Security: an image by
// URL is refused (9router fetches it server-side) and config.workingDir is "/" (9router sends the server directory).

const TARGET = "commandcode";
const STREAM_TIMEOUT_MS = 600_000;
const DEFAULT_MAX_TOKENS = 64_000;
const DEFAULT_TEMPERATURE = 0.3;
const MAX_TOOL_CALLS = 128;
// The events that end 9router's peek: anything client-visible or a finish.
const COMMIT_EVENTS = new Set(["text-delta", "reasoning-delta", "tool-input-start", "tool-call", "finish", "finish-step"]);
const FINISH = new Map<string, StopReason>([["stop", "end_turn"], ["length", "max_tokens"], ["tool-calls", "tool_use"], ["tool_use", "tool_use"], ["content-filter", "content_filter"]]);
// Status guesses for an in-band error without an HTTP status (9router parseCommandCodeError).
const GUESSES: readonly [RegExp, number][] = [
  [/rate limit|too many requests/, 429], [/unauthorized|invalid api key|authentication/, 401], [/payment required|billing/, 402],
  [/quota|forbidden|permission/, 403], [/not found/, 404],
];

const unsupported = (feature: string) => new UnsupportedFeatureError(feature, TARGET);

// ---- CIP -> /alpha/generate envelope (translator.openai-to-commandcode-request, kept) ----

const joinText = (parts: readonly ContentPart[]) => parts.map((part) => (part.type === "text" ? part.text : "")).filter(Boolean).join("\n");

// Bad JSON becomes {} as in 9router.
function toolInput(raw: string): unknown {
  if (!raw) return {};
  const parsed = parseJson(raw);
  return parsed === undefined ? {} : parsed;
}

function userBlocks(parts: readonly ContentPart[]): Json[] {
  const blocks: Json[] = [];
  for (const part of parts) {
    if (part.type === "text") blocks.push({ type: "text", text: part.text });
    else if (part.type === "image") {
      if (part.source.kind === "url") throw unsupported("an image by URL (send it as base64)");
      const mime = part.source.mediaType;
      blocks.push({ type: "image", image: `data:${mime};base64,${part.source.data}`, mimeType: mime, mediaType: mime });
    }
    // Audio, files, and other parts without text are dropped, as in 9router.
  }
  return blocks.length > 0 ? blocks : [{ type: "text", text: "" }];
}

function toMessages(request: CanonicalRequest): Json[] {
  const out: Json[] = [];
  for (const message of request.messages) {
    const rest: ContentPart[] = [];
    for (const part of message.content) {
      if (part.type !== "tool_result") {
        rest.push(part);
        continue;
      }
      // 9router reads toolName from the tool message's name, which OpenAI clients leave out.
      out.push({ role: "tool", content: [{ type: "tool-result", toolCallId: part.toolCallId, toolName: "", output: { type: "text", value: joinText(part.content) } }] });
    }
    if (rest.length === 0) continue;
    if (message.role !== "assistant") {
      out.push({ role: "user", content: userBlocks(rest) });
      continue;
    }
    const blocks: Json[] = [];
    const calls = rest.filter((part) => part.type === "tool_call");
    const reasoning = rest.map((part) => (part.type === "thinking" ? part.text : "")).join("");
    if (reasoning || calls.length > 0) blocks.push({ type: "reasoning", text: reasoning || " " });
    const answer = joinText(rest);
    if (answer) blocks.push({ type: "text", text: answer });
    for (const call of calls) blocks.push({ type: "tool-call", toolCallId: call.id, toolName: call.name, input: toolInput(call.arguments) });
    out.push({ role: "assistant", content: blocks.length > 0 ? blocks : [{ type: "text", text: "" }] });
  }
  return out;
}

// thinkingUnified commandcode: a level (budget → level, else medium; auto kept); none leaves the field out.
function reasoningEffort(request: CanonicalRequest): string | undefined {
  if (request.reasoning?.budgetTokens !== undefined) return budgetToLevel(request.reasoning.budgetTokens) ?? "medium";
  const effort = request.reasoning?.effort ?? text(request.vendorExtensions?.openai?.reasoning_effort);
  if (!effort || effort === "none" || effort === "off") return undefined;
  return effort;
}

function toEnvelope(request: CanonicalRequest): Json {
  for (const namespace of Object.keys(request.vendorExtensions ?? {})) if (namespace !== "openai") throw unsupported(`vendorExtensions.${namespace}`);
  const system = request.system?.map((part) => (part.type === "text" ? part.text : "")).filter(Boolean).join("\n\n");
  const effort = reasoningEffort(request);
  const params: Json = {
    model: request.model,
    messages: toMessages(request),
    stream: true,
    max_tokens: request.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
    temperature: request.temperature ?? DEFAULT_TEMPERATURE,
    ...(system ? { system } : {}),
    ...(request.tools && request.tools.length > 0
      ? { tools: request.tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters ?? { type: "object" } })) }
      : {}),
    ...(request.topP !== undefined ? { top_p: request.topP } : {}),
    ...(effort ? { reasoning_effort: effort } : {}),
  };
  return {
    threadId: crypto.randomUUID(),
    memory: "",
    config: {
      workingDir: "/", date: new Date().toISOString().slice(0, 10), environment: process.platform, structure: [], isGitRepo: false,
      currentBranch: "", mainBranch: "", gitStatus: "", recentCommits: [],
    },
    params,
    model: request.model,
    stream: true,
  };
}

// ---- NDJSON events -> CIP (translator.commandcode-to-openai-response, kept) ----

// One event per line; a "data:" prefix is tolerated, anything unparsable is skipped.
function eventOf(line: string): Json | undefined {
  const json = line.startsWith("data:") ? line.slice(5).trim() : line;
  if (json === "" || json === "[DONE]") return undefined;
  const event = parseJson(json);
  return isRecord(event) && typeof event.type === "string" ? event : undefined;
}

// A reason 9router passes through raw has no CIP form; it ends the turn.
const finishOf = (reason: unknown): StopReason => FINISH.get(text(reason) ?? "") ?? "end_turn";

const usageOf = (value: unknown): TokenUsage => {
  const usage = record(value);
  return { inputTokens: count(usage.inputTokens), outputTokens: count(usage.outputTokens) };
};

type Opened = { readonly first: readonly Json[]; readonly rest: AsyncGenerator<string> };
type Tally = { emitted: number };

export class CommandCodeAdapter extends HttpProviderAdapter implements AIProviderPort {
  // 9router collapses the forced stream for a non-streaming client.
  async execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<CanonicalResponse> {
    const tally: Tally = { emitted: 0 };
    let id = "";
    let model = request.model;
    let answer = "";
    let reasoning = "";
    let stopReason: StopReason = "end_turn";
    let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
    const calls = new Map<number, { id: string; name: string; arguments: string }>();
    try {
      for await (const chunk of this.events(request, credential, ctx, tally)) {
        if (chunk.type === "start") [id, model] = [chunk.id, chunk.model];
        else if (chunk.type === "text_delta") answer += chunk.text;
        else if (chunk.type === "thinking_delta") reasoning += chunk.text;
        else if (chunk.type === "tool_call_delta") {
          const call = calls.get(chunk.index) ?? { id: "", name: "", arguments: "" };
          calls.set(chunk.index, { id: chunk.id ?? call.id, name: chunk.name ?? call.name, arguments: call.arguments + chunk.argumentsDelta });
        } else if (chunk.type === "usage") usage = chunk.usage;
        else if (chunk.type === "stop") stopReason = chunk.stopReason;
      }
    } catch (error) {
      // 9router's non-streaming path loses a mid-stream error behind this text (kept).
      if (error instanceof EngineError && error.details.partial === true) throw this.invalid("a stream that failed: Failed to convert streaming response to JSON");
      throw error;
    }
    if (tally.emitted === 0) throw this.invalid("an empty stream: Invalid SSE response");
    const content: ContentPart[] = [];
    // routing.forced-stream-json-collapse: reasoning is dropped when there is content.
    if (reasoning && !answer) content.push({ type: "thinking", text: reasoning });
    if (answer) content.push({ type: "text", text: answer });
    for (const [, call] of [...calls].sort((a, b) => a[0] - b[0])) content.push({ type: "tool_call", ...call });
    return { id, model, content, stopReason: calls.size > 0 ? "tool_use" : stopReason, usage };
  }

  async *stream(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): AsyncGenerator<StreamChunk> {
    yield* this.events(request, credential, ctx, { emitted: 0 });
  }

  // The static catalog, as in 9router.
  async getModels(): Promise<readonly ListedModel[]> {
    return this.provider.models.map((descriptor) => ({ id: descriptor.id, descriptor }));
  }

  // connection.commandcode-key-test, corrected: a one-token 'ping'; a refused key (401/403, also as an event in a 200)
  // is invalid, a quota answer is no_quota, and the first content event means the key works.
  async validateCredential(credential: Credential, ctx: ExecCtx): Promise<CredentialStatus> {
    const ping: CanonicalRequest = { model: this.provider.models[0]?.id ?? "", stream: false, messages: [{ role: "user", content: [{ type: "text", text: "ping" }] }], maxOutputTokens: 1 };
    try {
      const opened = await this.open(ping, credential, ctx, 1, METADATA_TIMEOUT_MS);
      await opened.rest.return(undefined);
      return { valid: true };
    } catch (error) {
      if (error instanceof EngineError && (error.code === "AUTH_ERROR" || error.code === "QUOTA_EXHAUSTED")) return { valid: false, code: error.code, message: error.message };
      throw error;
    }
  }

  private generate(request: CanonicalRequest, credential: Credential, timeoutMs: number): HttpRequest {
    const base = this.request("POST", this.provider.chatUrl, credential, timeoutMs);
    return {
      ...base,
      headers: { ...base.headers, "content-type": "application/json", "x-session-id": crypto.randomUUID(), accept: "text/event-stream" },
      body: JSON.stringify(toEnvelope(request)),
    };
  }

  // 9router's peek: read up to the first content event; an error event before it is an HTTP-style error, retried when
  // it is 502/503/504 (the executor's in-band retry). Every line read is kept (9router loses the rest of the read).
  private open(request: CanonicalRequest, credential: Credential, ctx: ExecCtx, attempts = RETRY.maxAttempts, timeoutMs = STREAM_TIMEOUT_MS): Promise<Opened> {
    return withRetry(async () => {
      const response = await this.send(this.generate(request, credential, timeoutMs), credential, ctx, 1);
      if (!response.body) throw this.invalid("an empty body");
      const rest = readJsonLines(response.body);
      const first: Json[] = [];
      for (;;) {
        const next = await rest.next();
        if (next.done) break;
        const event = eventOf(next.value);
        if (!event) continue;
        if (event.type === "error") {
          await rest.return(undefined);
          throw this.inBandError(event, credential);
        }
        first.push(event);
        if (COMMIT_EVENTS.has(text(event.type) ?? "")) break;
      }
      return { first, rest };
    }, { ...RETRY, maxAttempts: attempts, signal: ctx.signal, shouldRetry: isTransient });
  }

  private inBandError(event: Json, credential: Credential): EngineError {
    const value = event.error ?? event.message ?? "unknown";
    const error = record(value);
    const message = typeof value === "string" ? value : text(error.message) ?? text(error.error) ?? JSON.stringify(value);
    const declared = Number(event.statusCode ?? error.statusCode ?? error.status);
    const lower = message.toLowerCase();
    const status = Number.isInteger(declared) && declared >= 400 && declared <= 599 ? declared : GUESSES.find(([pattern]) => pattern.test(lower))?.[1] ?? 503;
    return new EngineError(classifyStatus(status, undefined), `${this.provider.name} answered ${status}: [CommandCode error: ${this.clean(message, credential)}]`, { provider: this.provider.id, status });
  }

  private async *events(request: CanonicalRequest, credential: Credential, ctx: ExecCtx, tally: Tally): AsyncGenerator<StreamChunk> {
    const { first, rest } = await this.open(request, credential, ctx);
    yield { type: "start", id: `chatcmpl-${Date.now()}`, model: request.model };
    const indexById = new Map<string, number>();
    let stored: StopReason | undefined;
    let stepUsage: unknown;
    const lines = async function* (): AsyncGenerator<Json> {
      yield* first;
      for await (const line of rest) {
        const event = eventOf(line);
        if (event) yield event;
      }
    };
    const toolIndex = (id: string) => {
      const known = indexById.get(id);
      if (known !== undefined) return known;
      if (indexById.size >= MAX_TOOL_CALLS) throw this.invalid(`more than ${MAX_TOOL_CALLS} tool calls`, true);
      indexById.set(id, indexById.size);
      return indexById.size - 1;
    };
    for await (const event of lines()) {
      switch (event.type) {
        case "text-delta": {
          const said = text(event.text) || text(event.delta);
          if (said) {
            tally.emitted++;
            yield { type: "text_delta", index: 0, text: said };
          }
          break;
        }
        case "reasoning-delta": {
          const said = text(event.text);
          if (said) {
            tally.emitted++;
            yield { type: "thinking_delta", index: 0, text: said };
          }
          break;
        }
        case "tool-input-start": {
          const id = text(event.id) || text(event.toolCallId) || `call_${indexById.size}_${Date.now()}`;
          tally.emitted++;
          yield { type: "tool_call_delta", index: toolIndex(id), id, name: text(event.toolName) ?? "", argumentsDelta: "" };
          break;
        }
        case "tool-input-delta": {
          const index = indexById.get(text(event.id) ?? text(event.toolCallId) ?? "");
          if (index !== undefined) {
            tally.emitted++;
            yield { type: "tool_call_delta", index, argumentsDelta: text(event.delta) ?? text(event.inputTextDelta) ?? "" };
          }
          break;
        }
        case "tool-call": {
          const id = text(event.toolCallId) ?? "";
          if (indexById.has(id)) break;
          const input = typeof event.input === "string" ? event.input : JSON.stringify(event.input ?? {});
          tally.emitted++;
          yield { type: "tool_call_delta", index: toolIndex(id), id, name: text(event.toolName) ?? "", argumentsDelta: input };
          break;
        }
        case "finish-step":
          stored = finishOf(event.finishReason);
          if (event.usage !== undefined) stepUsage = event.usage;
          break;
        case "finish": {
          const usage = event.totalUsage ?? stepUsage;
          tally.emitted++;
          if (usage !== undefined) yield { type: "usage", usage: usageOf(usage) };
          yield { type: "stop", stopReason: stored ?? finishOf(event.finishReason ?? "stop") };
          await rest.return(undefined);
          return;
        }
        // 9router streams a mid-stream error as this fixed text (kept); the upstream message is not shown.
        case "error": throw new EngineError("PROVIDER_UNAVAILABLE", "upstream connection lost", { provider: this.provider.id, partial: true });
        default: break;
      }
    }
    // Kept: a stream that ends without finish still ends normally.
    yield { type: "stop", stopReason: "end_turn" };
  }
}
