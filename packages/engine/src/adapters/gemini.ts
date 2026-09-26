import { UnsupportedFeatureError, type CanonicalRequest, type CanonicalResponse, type ContentPart, type StopReason, type StreamChunk, type TokenUsage } from "../cip.js";
import { EngineError } from "../errors.js";
import { readBoundedText } from "../http.js";
import { isRecord, list, parseJson, record, text, type Json } from "../json.js";
import type { AIProviderPort, Credential, CredentialStatus, ExecCtx, HttpRequest, ListedModel } from "../ports.js";
import { MODEL_ID } from "../registry.js";
import { readSseData } from "../sse.js";
import { cleanGeminiSchema } from "./gemini-schema.js";
import { BORROWED_THOUGHT_SIGNATURE } from "./gemini-signature.js";
import { count, METADATA_TIMEOUT_MS, RETRY } from "./http-adapter.js";
import { OpenAICompatibleAdapter } from "./openai-compatible.js";

// AIProviderPort for the gemini family, POST <base>/<model>:generateContent (docs/contracts/provider-gemini.md).
// User decision (2026-09-26): the request and the answer keep 9router's behavior, including its silent drops
// (translator.openai-to-gemini-request, translator.gemini-to-openai-response); only the tool-schema cleaner is
// corrected (gemini-schema.ts).

const TARGET = "gemini";
const CHAT_TIMEOUT_MS = 300_000;
const STREAM_TIMEOUT_MS = 600_000;
const MAX_LISTED_MODELS = 1_000;
const MAX_TOOL_CALLS = 128;
const MAX_FUNCTION_NAME = 64;
// 9router sends every request with the safety filters off.
const SAFETY_SETTINGS = ["HARM_CATEGORY_HATE_SPEECH", "HARM_CATEGORY_DANGEROUS_CONTENT", "HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_CIVIC_INTEGRITY"]
  .map((category) => ({ category, threshold: "OFF" }));
const FINISH = new Map<string, StopReason>([
  ["STOP", "end_turn"], ["MAX_TOKENS", "max_tokens"], ["SAFETY", "content_filter"], ["RECITATION", "content_filter"],
  ["BLOCKLIST", "content_filter"], ["PROHIBITED_CONTENT", "content_filter"],
]);
// 9router thinking tables (translator/concerns/thinking.js, thinkingUnified.js).
const LEVEL_TO_BUDGET: Readonly<Record<string, number>> = { none: 0, minimal: 512, low: 1024, medium: 8192, high: 24576, xhigh: 32768, max: 128000 };
const LEVEL_FLOOR: Readonly<Record<string, number>> = { minimal: 4096, low: 8192, medium: 16384, high: 65535 };
const MAX_BUDGET = 24576;

const unsupported = (feature: string) => new UnsupportedFeatureError(feature, TARGET);

// ---- thought signatures (9router thoughtSignatureStore, the in-memory part the Gemini path reads) ----

const SIGNATURE_TTL_MS = 60 * 60_000;
const MAX_SIGNATURES = 2_000;
const signatures = new Map<string, { signature: string; family: string; expiresAt: number }>();

// A signature only replays to the model family that made it.
const familyOf = (model: string): string => (model.toLowerCase().includes("claude") ? "claude" : model.toLowerCase().includes("gemini") ? "gemini" : model.toLowerCase());

function pruneSignatures(): void {
  const now = Date.now();
  for (const [key, entry] of signatures) if (entry.expiresAt <= now) signatures.delete(key);
  while (signatures.size > MAX_SIGNATURES) {
    const oldest = signatures.keys().next().value;
    if (oldest === undefined) break;
    signatures.delete(oldest);
  }
}

function rememberSignature(callId: string, signature: string, model: string): void {
  pruneSignatures();
  signatures.set(callId, { signature, family: familyOf(model), expiresAt: Date.now() + SIGNATURE_TTL_MS });
}

function cachedSignature(callId: string, model: string): string | undefined {
  pruneSignatures();
  const entry = signatures.get(callId);
  return entry && entry.family === familyOf(model) ? entry.signature : undefined;
}

// ---- CIP -> generateContent (9router rules) ----

// [a-zA-Z0-9_.:-], starting with a letter or "_", at most 64; the answer keeps the sanitized name.
function sanitizeName(name: string): string {
  if (!name) return "_unknown";
  const safe = name.replace(/[^a-zA-Z0-9_.:-]/g, "_");
  return (/^[a-zA-Z_]/.test(safe) ? safe : `_${safe}`).slice(0, MAX_FUNCTION_NAME);
}

// 9router tryParseJSON: the parsed value, or null.
const tryParse = (raw: string): unknown => {
  const value = parseJson(raw);
  return value === undefined ? null : value;
};

function userParts(parts: readonly ContentPart[]): Json[] {
  const out: Json[] = [];
  for (const part of parts) {
    if (part.type === "text") out.push({ text: part.text });
    else if ((part.type === "image" || part.type === "audio" || part.type === "file") && part.source.kind === "base64") {
      out.push({ inlineData: { mime_type: part.source.mediaType, data: part.source.data } });
    } else if (part.type === "image" && part.source.kind === "url" && /^https?:\/\//.test(part.source.url)) {
      out.push({ fileData: { fileUri: part.source.url, mimeType: "image/*" } });
    }
    // Any other part (a file or audio by URL, video, …) is dropped, as in 9router.
  }
  return out;
}

// What differs between the Gemini API and Vertex (translator.openai-to-vertex-request).
export interface BodyOptions {
  // The signature for the first call of a model turn that has no cached one.
  readonly borrowed: string;
  // Vertex rejects id on functionCall and functionResponse.
  readonly callIds: boolean;
}

function functionResponse(id: string, name: string, answer: string, options: BodyOptions): Json {
  const parsed = tryParse(answer);
  const result = parsed === null ? { result: answer } : typeof parsed === "object" ? parsed : { result: parsed };
  return { functionResponse: { ...(options.callIds ? { id } : {}), name: sanitizeName(name), response: { result } } };
}

type Turn = { role: "user" | "model"; parts: Json[] };

// Same-role turns merged, and a "..." user turn first when the model speaks first. toContents never builds an empty
// turn or part, so 9router's empty-part filter has nothing to do here.
function normalize(contents: readonly Turn[]): Turn[] {
  const out: Turn[] = [];
  for (const content of contents) {
    const last = out.at(-1);
    if (last && last.role === content.role) last.parts.push(...content.parts);
    else out.push({ role: content.role, parts: [...content.parts] });
  }
  if (out.length > 0 && out[0]?.role !== "user") out.unshift({ role: "user", parts: [{ text: "..." }] });
  return out;
}

function toContents(request: CanonicalRequest, options: BodyOptions): Turn[] {
  const answers = new Map<string, string>();
  for (const message of request.messages) {
    for (const part of message.content) {
      if (part.type === "tool_result") answers.set(part.toolCallId, part.content.map((inner) => (inner.type === "text" ? inner.text : "")).join(""));
    }
  }
  const contents: Turn[] = [];
  request.messages.forEach((message, i) => {
    if (message.role === "user") {
      const parts = userParts(message.content);
      if (parts.length > 0) contents.push({ role: "user", parts });
      return;
    }
    if (message.role !== "assistant") return; // tool answers follow their model turn
    const parts: Json[] = [];
    const answer = message.content.map((part) => (part.type === "text" ? part.text : "")).join("");
    if (answer) parts.push({ text: answer });
    const calls = message.content.filter((part) => part.type === "tool_call");
    if (calls.length === 0) {
      if (parts.length > 0) contents.push({ role: "model", parts });
      return;
    }
    calls.forEach((call, j) => {
      const signature = cachedSignature(call.id, request.model) ?? (j === 0 ? options.borrowed : undefined);
      const functionCall = { ...(options.callIds ? { id: call.id } : {}), name: sanitizeName(call.name), args: tryParse(call.arguments || "{}") };
      parts.push({ functionCall, ...(signature ? { thoughtSignature: signature } : {}) });
    });
    contents.push({ role: "model", parts });
    const intermediate = i < request.messages.length - 1;
    if (intermediate || calls.some((call) => answers.has(call.id))) {
      contents.push({ role: "user", parts: calls.map((call) => functionResponse(call.id, call.name, answers.get(call.id) ?? "", options)) });
    }
  });
  return contents;
}

type Intent = { mode: "none" } | { mode: "auto" } | { mode: "level"; level: string } | { mode: "budget"; budget: number };

function intentOf(request: CanonicalRequest): Intent | undefined {
  if (request.reasoning?.budgetTokens !== undefined) return { mode: "budget", budget: request.reasoning.budgetTokens };
  const effort = request.reasoning?.effort ?? text(request.vendorExtensions?.openai?.reasoning_effort);
  if (!effort) return undefined;
  const level = effort.toLowerCase();
  if (level === "none" || level === "off") return { mode: "none" };
  return level === "auto" ? { mode: "auto" } : { mode: "level", level };
}

// 9router's budget-to-level table (translator/concerns/thinking.js), shared with the commandcode adapter.
export function budgetToLevel(budget: number): string | undefined {
  if (budget <= 0) return undefined;
  if (budget <= 768) return "minimal";
  if (budget <= 4096) return "low";
  if (budget <= 16384) return "medium";
  if (budget <= 28672) return "high";
  return budget <= 80384 ? "xhigh" : "max";
}

function budgetFloor(budget: number): number {
  if (budget === -1 || !Number.isFinite(budget)) return 32768;
  if (budget <= 1024) return 8192;
  if (budget <= 8192) return 16384;
  return budget <= 24576 ? 32768 : 65535;
}

// 9router capability patterns: gemini-3 models take a thinking level, gemini-2.5 a budget; others cannot reason.
// ponytail: 9router also caps the floor at the model's output limit (65535 or 65536); every floor is at most 65535, so
// the cap never applies. Add it back with a model whose limit is lower.
function thinkingFormat(model: string): "level" | "budget" | undefined {
  if (/gemini.*image/.test(model)) return undefined;
  if (/gemini-3/.test(model)) return "level";
  return /gemini-2\.5/.test(model) ? "budget" : undefined;
}

// thinkingConfig, and maxOutputTokens raised to the floor of the level or budget.
function applyThinking(config: Json, request: CanonicalRequest): void {
  const intent = intentOf(request);
  const format = thinkingFormat(request.model);
  if (!intent || !format) return;
  const raise = (floor: number) => {
    const current = config.maxOutputTokens;
    if (typeof current !== "number" || current < floor) config.maxOutputTokens = floor;
  };
  if (format === "level") {
    // Gemini 3 cannot switch thinking off; none becomes minimal.
    const raw = intent.mode === "none" ? "minimal" : intent.mode === "auto" ? "high"
      : intent.mode === "budget" ? (budgetToLevel(intent.budget) ?? "medium") : intent.level;
    const level = raw === "off" ? "minimal" : raw === "xhigh" || raw === "max" ? "high" : raw;
    config.thinkingConfig = { thinkingLevel: level, includeThoughts: level !== "minimal" };
    raise(LEVEL_FLOOR[level] ?? LEVEL_FLOOR.high ?? 65535);
    return;
  }
  if (intent.mode === "none") {
    config.thinkingConfig = { thinkingBudget: 0, includeThoughts: false };
    return;
  }
  const chosen = intent.mode === "auto" ? -1 : intent.mode === "budget" ? intent.budget : LEVEL_TO_BUDGET[intent.level];
  const budget = chosen === undefined || chosen === -1 ? chosen : Math.min(Math.max(chosen, 0), MAX_BUDGET);
  config.thinkingConfig = { thinkingBudget: budget ?? -1, includeThoughts: true };
  raise(budgetFloor(budget ?? -1));
}

function toBody(request: CanonicalRequest, options: BodyOptions): Json {
  const extensions = request.vendorExtensions ?? {};
  for (const namespace of Object.keys(extensions)) if (namespace !== "openai") throw unsupported(`vendorExtensions.${namespace}`);
  const config: Json = {};
  if (request.temperature !== undefined) config.temperature = request.temperature;
  if (request.topP !== undefined) config.topP = request.topP;
  const topK = extensions.openai?.top_k;
  if (topK !== undefined) config.topK = topK;
  if (request.maxOutputTokens !== undefined) config.maxOutputTokens = request.maxOutputTokens;
  applyThinking(config, request);
  // 9router keeps one system text; CIP holds the leading system messages as one prompt, joined here.
  const system = request.system?.map((part) => (part.type === "text" ? part.text : "")).join("");
  const contents = toContents(request, options);
  if (system !== undefined && request.messages.length === 0) contents.push({ role: "user", parts: [{ text: system }] });
  const declarations = (request.tools ?? []).map((tool) => {
    const parameters = cleanGeminiSchema(tool.parameters);
    return { name: sanitizeName(tool.name), description: tool.description ?? "", ...(parameters ? { parameters } : {}) };
  });
  return {
    model: request.model,
    contents: normalize(contents),
    generationConfig: config,
    safetySettings: SAFETY_SETTINGS,
    ...(system !== undefined && request.messages.length > 0 ? { systemInstruction: { role: "user", parts: [{ text: system }] } } : {}),
    ...(declarations.length > 0 ? { tools: [{ functionDeclarations: declarations }] } : {}),
  };
}

// ---- generateContent -> CIP ----

function streamUsage(value: unknown): TokenUsage | undefined {
  if (!isRecord(value)) return undefined;
  const prompt = count(value.promptTokenCount);
  const cached = count(value.cachedContentTokenCount);
  const thoughts = count(value.thoughtsTokenCount);
  const total = count(value.totalTokenCount);
  let candidates = count(value.candidatesTokenCount);
  if (candidates === 0 && total > 0) candidates = Math.max(0, total - prompt - thoughts);
  return {
    inputTokens: Math.max(0, prompt - cached),
    outputTokens: candidates + thoughts,
    ...(cached > 0 ? { cacheReadTokens: cached } : {}),
    ...(thoughts > 0 ? { reasoningTokens: thoughts } : {}),
  };
}

export class GeminiAdapter extends OpenAICompatibleAdapter implements AIProviderPort {
  protected readonly bodyOptions: BodyOptions = { borrowed: BORROWED_THOUGHT_SIGNATURE, callIds: true };

  // <base>/<model>:generateContent; Vertex builds the base from the credential, the Gemini API uses the catalog URL.
  protected modelsBase?(credential: Credential): string;

  // 9router's non-streaming mapping, kept: raw lower-cased finish_reason, thoughts counted as prompt tokens,
  // generated images as markdown in the text.
  override async execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<CanonicalResponse> {
    const response = await this.send(this.generate(request, credential, false), credential, ctx, RETRY.maxAttempts);
    const root = record(parseJson(await readBoundedText(response.body)));
    const body = isRecord(root.response) ? root.response : root;
    const candidate = list(body.candidates)[0];
    const model = text(body.modelVersion) ?? "gemini";
    // 9router returns such a body as is; CIP has no raw form, so it is an empty answer.
    if (!isRecord(candidate)) return { id: "", model, content: [], stopReason: "end_turn", usage: { inputTokens: 0, outputTokens: 0 } };
    let answer = "";
    let reasoning = "";
    const calls: ContentPart[] = [];
    for (const part of list(record(candidate.content).parts).map(record)) {
      if (part.thought === true && text(part.text)) reasoning += text(part.text) ?? "";
      else if (part.text !== undefined) answer += text(part.text) ?? "";
      if (isRecord(part.functionCall)) {
        const name = text(part.functionCall.name) ?? "";
        calls.push({ type: "tool_call", id: `call_${name}_${Date.now()}_${calls.length}`, name, arguments: JSON.stringify(part.functionCall.args ?? {}) });
      }
      const inline = record(part.inlineData ?? part.inline_data);
      const data = text(inline.data);
      if (data) answer += `\n![image](data:${text(inline.mimeType) ?? text(inline.mime_type) ?? "image/png"};base64,${data})\n`;
    }
    const raw = (text(candidate.finishReason) ?? "stop").toLowerCase();
    const finish = raw === "stop" && calls.length > 0 ? "tool_calls" : raw;
    const usage = record(body.usageMetadata ?? root.usageMetadata);
    const thoughts = count(usage.thoughtsTokenCount);
    return {
      id: `chatcmpl-${text(body.responseId) ?? Date.now()}`,
      model,
      content: [...(reasoning ? [{ type: "thinking" as const, text: reasoning }] : []), ...(answer ? [{ type: "text" as const, text: answer }] : []), ...calls],
      stopReason: calls.length > 0 ? "tool_use" : FINISH.get(raw.toUpperCase()) ?? "end_turn",
      usage: { inputTokens: count(usage.promptTokenCount) + thoughts, outputTokens: count(usage.candidatesTokenCount), ...(thoughts > 0 ? { reasoningTokens: thoughts } : {}) },
      vendorExtensions: { openai: { finish_reason: finish } },
    };
  }

  // 9router's stream mapping, kept: chunks without candidates (errors, blocked prompts) yield nothing, and a stream
  // without finishReason still ends normally.
  override async *stream(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): AsyncGenerator<StreamChunk> {
    const response = await this.send(this.generate(request, credential, true), credential, ctx, RETRY.maxAttempts);
    if (!response.body || !(response.headers["content-type"] ?? "").includes("text/event-stream")) {
      await response.body?.cancel();
      throw this.invalid("a non-SSE response to a streaming request");
    }
    let started = false;
    let calls = 0;
    let pending: string | undefined;
    let usage: TokenUsage | undefined;
    const call = (fn: Json, signature: string | undefined): StreamChunk => {
      if (calls >= MAX_TOOL_CALLS) throw this.invalid(`more than ${MAX_TOOL_CALLS} tool calls`, true);
      const index = calls++;
      const name = text(fn.name) ?? "";
      const id = text(fn.id) || `${name}-${Date.now()}-${index}`;
      if (signature) rememberSignature(id, signature, request.model);
      return { type: "tool_call_delta", index, id, name, argumentsDelta: JSON.stringify(fn.args ?? {}) };
    };
    for await (const data of readSseData(response.body)) {
      const chunk = record(parseJson(data));
      const body = isRecord(chunk.response) ? chunk.response : chunk;
      const candidate = list(body.candidates)[0];
      if (!isRecord(candidate)) continue;
      if (!started) {
        started = true;
        yield { type: "start", id: `chatcmpl-${text(body.responseId) ?? `msg_${Date.now()}`}`, model: text(body.modelVersion) ?? request.model };
      }
      for (const part of list(record(candidate.content).parts).map(record)) {
        const signature = text(part.thoughtSignature) ?? text(part.thought_signature);
        if (signature) pending = signature;
        const said = typeof part.text === "string" && part.text !== "" ? part.text : undefined;
        const fn = isRecord(part.functionCall) ? part.functionCall : undefined;
        if (said) yield part.thought === true ? { type: "thinking_delta", index: 0, text: said } : { type: "text_delta", index: 0, text: said };
        if (fn) {
          yield call(fn, signature ?? pending);
          pending = undefined;
        }
        // A part that carries a signature has no other content for the client.
        if (signature) continue;
        const inline = record(part.inlineData ?? part.inline_data);
        const image = text(inline.data);
        if (image) yield { type: "image_delta", mediaType: text(inline.mimeType) ?? text(inline.mime_type) ?? "image/png", data: image };
      }
      usage = streamUsage(body.usageMetadata ?? chunk.usageMetadata) ?? usage;
      const reason = text(candidate.finishReason);
      if (reason) {
        const mapped = FINISH.get(reason.toUpperCase()) ?? "end_turn";
        if (usage) yield { type: "usage", usage };
        yield { type: "stop", stopReason: mapped === "end_turn" && calls > 0 ? "tool_use" : mapped };
        return;
      }
    }
    if (!started) yield { type: "start", id: "", model: request.model };
    if (usage) yield { type: "usage", usage };
    yield { type: "stop", stopReason: calls > 0 ? "tool_use" : "end_turn" };
  }

  // GET <base> lists { models: [{ name: "models/<id>" }] }.
  override async getModels(credential: Credential, ctx: ExecCtx): Promise<readonly ListedModel[]> {
    const response = await this.send(this.request("GET", `${this.provider.modelsUrl}?pageSize=1000`, credential, METADATA_TIMEOUT_MS), credential, ctx, RETRY.maxAttempts);
    const models = record(parseJson(await readBoundedText(response.body))).models;
    if (!Array.isArray(models)) throw this.invalid("a model list without a models array");
    const listed: ListedModel[] = [];
    for (const entry of models.slice(0, MAX_LISTED_MODELS)) {
      const id = text(record(entry).name)?.replace(/^models\//, "");
      if (id === undefined || !MODEL_ID.test(id)) continue;
      const descriptor = this.known.get(id);
      listed.push(descriptor ? { id, descriptor } : { id });
    }
    return listed;
  }

  // Google answers a bad key on the model list with 400 (API_KEY_INVALID), which is an answer about the key.
  override async validateCredential(credential: Credential, ctx: ExecCtx): Promise<CredentialStatus> {
    try {
      return await super.validateCredential(credential, ctx);
    } catch (error) {
      if (error instanceof EngineError && error.code === "INVALID_REQUEST" && error.details.status === 400) {
        return { valid: false, code: "AUTH_ERROR", message: error.message };
      }
      throw error;
    }
  }

  private generate(request: CanonicalRequest, credential: Credential, stream: boolean): HttpRequest {
    const url = `${this.modelsBase?.(credential) ?? this.provider.chatUrl}/${request.model}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`;
    const base = this.request("POST", url, credential, stream ? STREAM_TIMEOUT_MS : CHAT_TIMEOUT_MS);
    return {
      ...base,
      headers: { ...base.headers, "content-type": "application/json", accept: stream ? "text/event-stream" : "application/json" },
      body: JSON.stringify(toBody(request, this.bodyOptions)),
    };
  }
}
