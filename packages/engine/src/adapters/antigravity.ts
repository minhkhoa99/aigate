import { EngineError } from "../errors.js";
import { readBoundedText } from "../http.js";
import { isRecord, list, parseJson, record, text, type Json } from "../json.js";
import type { CanonicalRequest } from "../cip.js";
import type { Credential, CredentialStatus, ExecCtx, HttpRequest, ListedModel } from "../ports.js";
import type { ProviderDescriptor } from "../registry.js";
import { lookupProject, probeCodeAssist, randomProjectId } from "./cloud-code.js";
import { cleanGeminiSchema } from "./gemini-schema.js";
import { GeminiAdapter } from "./gemini.js";
import { METADATA_TIMEOUT_MS, RETRY } from "./http-adapter.js";
import { ANTIGRAVITY_IDE_BASE_URL, ANTIGRAVITY_IDE_USER_AGENT, ANTIGRAVITY_MODELS_URL } from "./antigravity-config.js";

export { ANTIGRAVITY_IDE_BASE_URL, ANTIGRAVITY_IDE_USER_AGENT, ANTIGRAVITY_MODELS_URL } from "./antigravity-config.js";

const MAX_OUTPUT_TOKENS = 64_000;
const MAX_RETRY_AFTER_MS = 10_000;
const MAX_SESSIONS = 1_000;
const sessions = new Map<string, string>();
const PROMPT_REWRITES: readonly { from: string | RegExp; to: string | ((match: string) => string) }[] = [
  { from: "You are a Claude agent, built on Anthropic's Claude Agent SDK.", to: "" },
  { from: /You are Hermes Agent,\s*(an intelligent AI assistant)(?: created by Nous Research)?\./gi, to: "You are Hermes Agent. You are $1." },
  { from: /^x-anthropic-billing-header:[^\n]*(?:\r?\n)*/gim, to: "" },
  { from: /opencode/gi, to: (match) => match === "OpenCode" ? "Antigravity" : match === "OPENCODE" ? "ANTIGRAVITY" : "antigravity" },
];

function sessionId(key: string): string {
  const existing = sessions.get(key);
  if (existing) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const value = BigInt.asIntN(63, BigInt(`0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`)).toString();
  sessions.set(key, value);
  while (sessions.size > MAX_SESSIONS) sessions.delete(sessions.keys().next().value ?? key);
  return value;
}

function imageModel(model: string): boolean { return /image|imagen|image-generation/i.test(model); }

function imageAspect(model: string): string {
  const match = /(\d+)x(\d+)$/.exec(model);
  if (!match) return "1:1";
  const width = Number(match[1]);
  const height = Number(match[2]);
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

function sanitize(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9_.:-]/g, "_");
  return (/^[a-zA-Z_]/.test(safe) ? safe : `_${safe}`).slice(0, 64) || "_unknown";
}

function rewrite(value: Json): void {
  for (const part of list(value.parts).map(record)) {
    if (typeof part.text !== "string") continue;
    part.text = PROMPT_REWRITES.reduce((current, rule) => typeof rule.to === "function"
      ? current.replace(rule.from, rule.to) : current.replaceAll(rule.from, rule.to), part.text);
  }
}

function normalizeContents(contents: readonly unknown[]): Json[] {
  const out: Json[] = [];
  for (const raw of contents) {
    const current = record(raw);
    const parts = list(current.parts).filter((part) => {
      const value = record(part);
      return Object.keys(value).length > 0 && !(value.thought && !value.functionCall) && !(value.thoughtSignature && !value.functionCall && !value.text);
    }).map(record);
    if (parts.some((part) => part.functionResponse)) current.role = "user";
    if (parts.length === 0) continue;
    const previous = out.at(-1);
    if (previous && previous.role === current.role) previous.parts = [...list(previous.parts), ...parts];
    else out.push({ ...current, parts });
  }
  if (out.length > 0 && out[0]?.role !== "user") out.unshift({ role: "user", parts: [{ text: "..." }] });
  return out;
}

function toolsOf(value: unknown): Json[] | undefined {
  const declarations: Json[] = [];
  const seen = new Set<string>();
  for (const group of list(value).map(record)) for (const raw of list(group.functionDeclarations)) {
    const fn = record(raw);
    const name = sanitize(text(fn.name) ?? "");
    if (seen.has(name)) continue;
    seen.add(name);
    const parameters = cleanGeminiSchema(isRecord(fn.parameters) ? fn.parameters : undefined)
      ?? { type: "object", properties: { reason: { type: "string", description: "Brief explanation" } }, required: ["reason"] };
    declarations.push({ ...fn, name, parameters });
  }
  return declarations.length > 0 ? [{ functionDeclarations: declarations }] : undefined;
}

export class AntigravityAdapter extends GeminiAdapter {
  constructor(provider: ProviderDescriptor, transport: ConstructorParameters<typeof GeminiAdapter>[1]) { super(provider, transport); }

  override async execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<ReturnType<GeminiAdapter["execute"]> extends Promise<infer T> ? T : never> {
    return super.execute(request, await this.withProject(credential), ctx);
  }

  override async *stream(request: CanonicalRequest, credential: Credential, ctx: ExecCtx) {
    yield* super.stream(request, await this.withProject(credential), ctx);
  }

  override async getModels(credential: Credential, ctx: ExecCtx): Promise<readonly ListedModel[]> {
    const request = this.request("POST", ANTIGRAVITY_MODELS_URL, credential, METADATA_TIMEOUT_MS);
    const response = await this.send({ ...request, body: "{}", headers: { ...request.headers, "content-type": "application/json" } }, credential, ctx, RETRY.maxAttempts);
    const models = list(record(parseJson(await readBoundedText(response.body))).models).map(record);
    return models.slice(0, 1_000).flatMap((model) => {
      const id = text(model.id) ?? text(model.model) ?? text(model.name);
      return id && /^[\x21-\x7e]{1,200}$/.test(id) ? [{ id, ...(this.known.get(id) ? { descriptor: this.known.get(id) } : {}) }] : [];
    });
  }

  override validateCredential(credential: Credential, ctx: ExecCtx): Promise<CredentialStatus> {
    return probeCodeAssist(credential.apiKey, "google-api-nodejs-client/9.15.1 vscode-antigravity/1.107.0", this.transport, ctx);
  }

  protected override shouldRetry(error: unknown): boolean {
    if (!(error instanceof EngineError)) return false;
    const status = error.details.status;
    const retryAfter = error.details.retryAfterMs;
    return (status === 429 || (typeof status === "number" && status >= 500 && status < 600))
      && (typeof retryAfter !== "number" || retryAfter <= MAX_RETRY_AFTER_MS);
  }

  protected override retryDelayMs(error: unknown, attempt: number): number {
    const retryAfter = error instanceof EngineError ? error.details.retryAfterMs : undefined;
    return typeof retryAfter === "number" ? retryAfter : Math.min(MAX_RETRY_AFTER_MS, 2_000 * 2 ** (attempt - 1));
  }

  protected override generateUrl(request: CanonicalRequest, _credential: Credential, stream: boolean): string {
    const image = imageModel(request.model);
    return `${ANTIGRAVITY_IDE_BASE_URL}/v1internal:${stream && !image ? "streamGenerateContent?alt=sse" : "generateContent"}`;
  }

  protected override wrap(gemini: Json, request: CanonicalRequest, credential: Credential): Json {
    const model = this.known.get(request.model);
    const upstreamWithLevel = model?.upstreamModelId ?? request.model;
    const level = /\((low|medium|high)\)$/.exec(upstreamWithLevel)?.[1];
    const upstream = upstreamWithLevel.replace(/\((low|medium|high)\)$/, "");
    const key = credential.sessionId ?? "anonymous";
    const currentSession = sessionId(key);
    const requestContents = normalizeContents(list(gemini.contents));
    const step = Math.max(1, requestContents.length * 2 - 1);
    const requestId = `agent/${crypto.randomUUID()}/${Date.now()}/${crypto.randomUUID()}/${step}`;
    if (imageModel(request.model)) {
      const contents = requestContents.map((content) => ({ ...content, parts: list(content.parts).map(record).filter((part) => typeof part.text === "string").map((part) => ({ text: part.text })) }));
      return { project: credential.projectId ?? randomProjectId(), model: upstream.replace(/-\d+x\d+$/, ""), userAgent: "antigravity", requestType: "image_gen", requestId,
        request: { contents, generationConfig: { temperature: 1, topP: 0.95, topK: 40, maxOutputTokens: 8192, imageConfig: { aspectRatio: imageAspect(request.model) } }, sessionId: currentSession } };
    }
    const body: Json = { ...gemini };
    delete body.model;
    delete body.safetySettings;
    const rawTools = body.tools;
    delete body.tools;
    delete body.toolConfig;
    const contents = normalizeContents(requestContents);
    const generationConfig = isRecord(body.generationConfig) ? { ...body.generationConfig } : {};
    if (typeof generationConfig.maxOutputTokens === "number") generationConfig.maxOutputTokens = Math.min(generationConfig.maxOutputTokens, MAX_OUTPUT_TOKENS);
    if (level) generationConfig.thinkingConfig = { thinkingLevel: level, includeThoughts: level !== "low" };
    if (request.model.toLowerCase().includes("claude") && generationConfig.temperature === 0) generationConfig.temperature = 1;
    if (isRecord(body.systemInstruction)) rewrite(body.systemInstruction);
    const tools = toolsOf(rawTools);
    const inner: Json = { ...body, contents, generationConfig, sessionId: currentSession, ...(tools ? { tools, toolConfig: { functionCallingConfig: { mode: "VALIDATED" } } } : {}) };
    return { project: credential.projectId ?? randomProjectId(), model: upstream, userAgent: "antigravity", requestId, request: inner };
  }

  protected override generate(request: CanonicalRequest, credential: Credential, stream: boolean): HttpRequest {
    const base = super.generate(request, credential, stream);
    return { ...base, headers: { ...base.headers, "user-agent": ANTIGRAVITY_IDE_USER_AGENT } };
  }

  private async withProject(credential: Credential): Promise<Credential> {
    if (credential.projectId || !credential.sessionId) return credential;
    const project = await lookupProject(credential.sessionId, credential.apiKey, { "content-type": "application/json", "user-agent": ANTIGRAVITY_IDE_USER_AGENT }, this.transport);
    return project ? { ...credential, projectId: project } : credential;
  }
}
