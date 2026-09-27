import type { CanonicalMessage, CanonicalRequest, CanonicalResponse, StreamChunk, TokenUsage } from "../cip.js";
import { EngineError } from "../errors.js";
import { CATALOG } from "../catalog/providers.generated.js";
import { isRecord, list, record, text, type Json } from "../json.js";
import type { HttpRequest } from "../ports.js";
import { toOpenAIChatCompletion, type CompletionMeta } from "./openai-chat.js";

// Client-facing Gemini protocol, POST /v1beta/models/{model}:generateContent | :streamGenerateContent and
// GET /v1beta/models (docs/contracts/protocol-gemini.md). User decisions (2026-09-27): kept as 9router has it — the
// body becomes a text-only chat request, tool calls and trailing usage are dropped from the answer, a mid-stream error
// ends the stream silently, the path keeps two segments, and the model list is the whole catalog. A TTS request is
// forwarded to Google unchanged (ported now).

const MAX_CONTENTS = 10_000;
const MODEL = /^[\x21-\x7e]{1,256}$/;
const STREAM = ":streamGenerateContent";
const GENERATE = ":generateContent";
const FINISH = new Map([["stop", "STOP"], ["length", "MAX_TOKENS"], ["tool_calls", "STOP"], ["content_filter", "SAFETY"]]);
const TTS_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
// Gemini model id charset; blocks path traversal in the upstream URL.
const TTS_MODEL = /^[a-zA-Z0-9_.:-]+$/;
export const GEMINI_TTS_TIMEOUT_MS = 45_000;
const TTS_MODELS = new Set(CATALOG.find((provider) => provider.id === "gemini")?.models.filter((model) => model.kind === "tts").map((model) => model.id));

const invalid = (param: string, message: string) => new EngineError("INVALID_REQUEST", `${param} ${message}`, { param });

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

// ---- the path ----

export interface GeminiRoute {
  // "<provider>/<model>" or "<model>", as 9router builds it.
  readonly model: string;
  readonly stream: boolean;
  readonly action: typeof STREAM | typeof GENERATE;
}

// Two or more segments: the first is the provider and the second the model (later ones are ignored); one segment is
// the model. Only :streamGenerateContent streams; any other action stays in the model name.
export function parseGeminiPath(path: string): GeminiRoute {
  const segments = path.split("/");
  const modelAction = (segments.length >= 2 ? segments[1] : segments[0]) ?? "";
  const action = modelAction.includes(STREAM) ? STREAM : GENERATE;
  const name = modelAction.replace(STREAM, "").replace(GENERATE, "");
  return { model: segments.length >= 2 ? `${segments[0] ?? ""}/${name}` : name, stream: action === STREAM, action };
}

// ---- request: 9router's convertGeminiToInternal ----

// A part without text contributes an empty string.
const partsText = (parts: unknown): string => list(parts).map((part) => text(record(part).text) ?? "").join("\n");

export function parseGeminiGenerateRequest(input: unknown, route: GeminiRoute): CanonicalRequest {
  if (!isRecord(input)) throw invalid("body", "must be a JSON object");
  if (!MODEL.test(route.model)) throw invalid("model", "must be a model id");
  const contents = input.contents === undefined || input.contents === null ? [] : list(input.contents);
  if (contents.length > MAX_CONTENTS) throw invalid("contents", `may have at most ${MAX_CONTENTS} items`);
  const messages = contents.map((raw, i): CanonicalMessage => {
    if (!isRecord(raw)) throw invalid(`contents[${i}]`, "must be an object");
    return { role: raw.role === "model" ? "assistant" : "user", content: [{ type: "text", text: partsText(raw.parts) }] };
  });
  const system = isRecord(input.systemInstruction) ? partsText(input.systemInstruction.parts) : "";
  const config = record(input.generationConfig);
  const maxOutputTokens = optionalPositiveInteger(config.maxOutputTokens, "generationConfig.maxOutputTokens");
  const temperature = optionalNumber(config.temperature, "generationConfig.temperature", 0, 2);
  const topP = optionalNumber(config.topP, "generationConfig.topP", 0, 1);
  return {
    model: route.model,
    messages,
    stream: route.stream,
    ...(system ? { system: [{ type: "text", text: system }] } : {}),
    ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(topP !== undefined ? { topP } : {}),
  };
}

// ---- answers ----

function usageMetadata(usage: TokenUsage): Json {
  const prompt = usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0);
  return {
    promptTokenCount: prompt,
    candidatesTokenCount: usage.outputTokens,
    totalTokenCount: prompt + usage.outputTokens,
    ...(usage.reasoningTokens ? { thoughtsTokenCount: usage.reasoningTokens } : {}),
  };
}

// convertOpenAIResponseToGemini: the chat.completion the answer would be, reshaped; tool calls are dropped.
export function toGeminiResponse(response: CanonicalResponse, meta: CompletionMeta, model: string): Json {
  const completion = toOpenAIChatCompletion(response, meta);
  const choice = record(list(completion.choices)[0]);
  const message = record(choice.message);
  const reasoning = text(message.reasoning_content);
  const parts = [...(reasoning ? [{ text: reasoning, thought: true }] : []), { text: text(message.content) ?? "" }];
  return {
    candidates: [{ content: { role: "model", parts }, finishReason: FINISH.get(text(choice.finish_reason) ?? "") ?? "STOP", index: 0 }],
    modelVersion: text(completion.model) || model,
    usageMetadata: usageMetadata(response.usage),
  };
}

const FINISH_OF: Readonly<Record<string, string>> = { end_turn: "STOP", stop_sequence: "STOP", tool_use: "STOP", max_tokens: "MAX_TOKENS", content_filter: "SAFETY" };

export interface GeminiStreamMeta {
  // The upstream model id, used when the stream has no start chunk.
  readonly model: string;
  // 9router attaches usage only when the finish chunk itself carries it; an OpenAI-compatible provider sends usage in a
  // trailing chunk, which is dropped.
  readonly usageOnFinish: boolean;
}

// transformOpenAISSEToGeminiSSE: "data: <json>\r\n\r\n" frames, no [DONE].
export class GeminiStreamEncoder {
  private readonly meta: GeminiStreamMeta;
  private model: string;
  private usage: TokenUsage | undefined;
  private closed = false;

  constructor(meta: GeminiStreamMeta) {
    this.meta = meta;
    this.model = meta.model;
  }

  encode(chunk: StreamChunk): string {
    this.assertOpen();
    switch (chunk.type) {
      case "start":
        this.model = chunk.model || this.meta.model;
        return "";
      case "thinking_delta": return chunk.text ? this.frame([{ text: chunk.text, thought: true }]) : "";
      case "text_delta": return chunk.text ? this.frame([{ text: chunk.text }]) : "";
      case "usage":
        this.usage = chunk.usage;
        return "";
      case "stop": {
        const usage = this.meta.usageOnFinish && this.usage ? { usageMetadata: usageMetadata(this.usage), modelVersion: this.model } : {};
        return this.frame([{ text: "" }], FINISH_OF[chunk.stopReason] ?? "STOP", usage);
      }
      // Tool calls and generated images are dropped (9router, kept).
      case "tool_call_delta":
      case "image_delta":
        return "";
    }
  }

  end(): string {
    this.assertOpen();
    this.closed = true;
    return "";
  }

  // 9router drops an error frame, so the stream just ends (kept).
  fail(): string {
    return this.end();
  }

  private frame(parts: readonly Json[], finishReason?: string, extra: Json = {}): string {
    const candidate = { content: { role: "model", parts }, index: 0, ...(finishReason ? { finishReason } : {}) };
    return `data: ${JSON.stringify({ candidates: [candidate], ...extra })}\r\n\r\n`;
  }

  private assertOpen(): void {
    if (this.closed) throw new Error("GeminiStreamEncoder is closed: end() or fail() was already called");
  }
}

// ---- GET /v1beta/models (catalog.v1beta-models-listing) ----

// Every catalog model as models/<alias or id>/<model>, and the gemini models again as models/<model>; the limits are
// 9router's constants.
export function geminiModelList(): Json {
  const models: Json[] = [];
  const seen = new Set<string>();
  const add = (name: string, displayName: string, description: string, methods: readonly string[] = ["generateContent"]) => {
    if (seen.has(name)) return;
    seen.add(name);
    models.push({ name, displayName, description, supportedGenerationMethods: methods, inputTokenLimit: 128_000, outputTokenLimit: 8_192 });
  };
  for (const provider of CATALOG) {
    const key = provider.aliases[0] ?? provider.id;
    for (const model of provider.models) {
      const label = model.name || model.id;
      add(`models/${key}/${model.id}`, label, `${key} model: ${label}`);
      if (key === "gemini") add(`models/${model.id}`, label, `Gemini model: ${label}`, ["generateContent", "streamGenerateContent"]);
    }
  }
  return { models };
}

// ---- the TTS passthrough (catalog.v1beta-generate-content-dispatch) ----

const ttsModelId = (model: string): string => model.replace(/^models\//, "").replace(/^gemini\//, "");

// Audio output requested, or a Gemini TTS model; a model under another provider prefix never is.
export function isGeminiTtsRequest(route: GeminiRoute, body: unknown): boolean {
  if (route.model.includes("/") && !route.model.startsWith("gemini/") && !route.model.startsWith("models/")) return false;
  const modalities = list(record(record(body).generationConfig).responseModalities);
  return modalities.some((modality) => String(modality).toUpperCase() === "AUDIO") || TTS_MODELS.has(ttsModelId(route.model));
}

// The request Google receives: the body unchanged, the client's query without its key, the connection's key in a header.
export function geminiTtsRequest(route: GeminiRoute, query: Readonly<Record<string, unknown>>, body: unknown, apiKey: string): HttpRequest {
  const modelId = ttsModelId(route.model);
  if (!TTS_MODEL.test(modelId)) throw invalid("model", "must be a Gemini model id (letters, digits, _ . : -)");
  const url = new URL(`${TTS_BASE_URL}/${modelId}${route.action}`);
  for (const [key, value] of Object.entries(query)) {
    if (key === "key") continue;
    for (const one of Array.isArray(value) ? value : [value]) if (typeof one === "string") url.searchParams.append(key, one);
  }
  return { method: "POST", url: url.toString(), headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify(body), timeoutMs: GEMINI_TTS_TIMEOUT_MS };
}
