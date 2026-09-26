import type { CanonicalRequest, CanonicalResponse, StreamChunk } from "../cip.js";
import { EngineError } from "../errors.js";
import { readBoundedText } from "../http.js";
import { parseJson, record, text } from "../json.js";
import type { AIProviderPort, Credential, CredentialStatus, ExecCtx, HttpRequest, HttpTransportPort, ListedModel } from "../ports.js";
import type { ProviderDescriptor } from "../registry.js";
import { GeminiAdapter } from "./gemini.js";
import { googleAccessToken, parseGoogleCredential } from "./google-auth.js";
import { METADATA_TIMEOUT_MS } from "./http-adapter.js";
import { OpenAICompatibleAdapter } from "./openai-compatible.js";
import { VERTEX_THOUGHT_SIGNATURE } from "./vertex-signature.js";

// vertex (Gemini generateContent on Vertex AI) and vertex-partner (Vertex's OpenAI-compatible endpoint), over the Gemini
// and OpenAI adapters (docs/contracts/provider-vertex.md). User decisions (2026-09-26): location global; the API key goes
// in x-goog-api-key, never the URL; a 401 re-mints the token once; the connection test is real.

// How one call authenticates, attached to the credential object handed to the Gemini / OpenAI code.
type Access = { readonly bearer: boolean; readonly project?: string };
const access = new WeakMap<Credential, Access>();

// routing.vertex-endpoints, kept with a bounded cache: a raw key's project is read from Google's answer to a probe.
const PROJECT_TTL_MS = 60 * 60_000;
const MAX_PROJECTS = 256;
const projects = new Map<string, { project: string; expiresAt: number }>();
// A valid body for a model that does not exist: a 400 can only be about the key, a 404 names the key's project.
const PROBE_BODY = JSON.stringify({ contents: [{ role: "user", parts: [{ text: "ping" }] }] });
const PROBE_BODY_BYTES = 64 * 1024;
const PROJECT_IN_MESSAGE = /projects\/([^/]+)\//;
const MAX_MESSAGE_CHARS = 300;

type Probe = { readonly status: number; readonly message: string; readonly project?: string };

const isKeyAnswer = (status: number) => status === 400 || status === 401 || status === 403;

function rememberProject(key: string, project: string): void {
  projects.delete(key);
  projects.set(key, { project, expiresAt: Date.now() + PROJECT_TTL_MS });
  while (projects.size > MAX_PROJECTS) {
    const oldest = projects.keys().next().value;
    if (oldest === undefined) break;
    projects.delete(oldest);
  }
}

// A token credential sends Authorization: Bearer; an API key keeps the descriptor's x-goog-api-key.
function authorize(base: HttpRequest, credential: Credential): HttpRequest {
  if (!access.get(credential)?.bearer) return base;
  const headers: Record<string, string> = { ...base.headers, authorization: `Bearer ${credential.apiKey}` };
  delete headers["x-goog-api-key"];
  return { ...base, headers };
}

// Only a token Google refused (401) is worth a new one; a key or a 403 stays refused.
const staleToken = (error: unknown, resolved: Credential) =>
  access.get(resolved)?.bearer === true && error instanceof EngineError && error.code === "AUTH_ERROR" && error.details.status === 401;

class GoogleCloud {
  constructor(private readonly provider: ProviderDescriptor, private readonly transport: HttpTransportPort, private readonly needsProject: boolean) {}

  private parse(credential: Credential) {
    const parsed = parseGoogleCredential(credential.apiKey);
    if ("error" in parsed) throw new EngineError("AUTH_ERROR", `The ${this.provider.name} credential is not usable: ${parsed.error}`, { provider: this.provider.id });
    return parsed;
  }

  // The credential the shared code sends: an access token, or the API key.
  private async resolve(credential: Credential, ctx: ExecCtx, fresh: boolean): Promise<Credential> {
    const parsed = this.parse(credential);
    if (parsed.kind === "api-key") {
      const resolved: Credential = { kind: "api-key", apiKey: parsed.key };
      const project = this.needsProject ? await this.projectOf(parsed.key, ctx) : undefined;
      access.set(resolved, { bearer: false, ...(project ? { project } : {}) });
      return resolved;
    }
    const resolved: Credential = { kind: "api-key", apiKey: await googleAccessToken(parsed, credential.apiKey, this.transport, ctx, this.provider.id, fresh) };
    access.set(resolved, { bearer: true, project: parsed.projectId });
    return resolved;
  }

  async call<T>(credential: Credential, ctx: ExecCtx, run: (resolved: Credential) => Promise<T>): Promise<T> {
    const resolved = await this.resolve(credential, ctx, false);
    try {
      return await run(resolved);
    } catch (error) {
      if (!staleToken(error, resolved)) throw error;
    }
    return run(await this.resolve(credential, ctx, true));
  }

  // A new token is only tried before the first chunk reached the client.
  async *stream(credential: Credential, ctx: ExecCtx, open: (resolved: Credential) => AsyncIterable<StreamChunk>): AsyncGenerator<StreamChunk> {
    const resolved = await this.resolve(credential, ctx, false);
    let started = false;
    try {
      for await (const chunk of open(resolved)) {
        started = true;
        yield chunk;
      }
      return;
    } catch (error) {
      if (started || !staleToken(error, resolved)) throw error;
    }
    yield* open(await this.resolve(credential, ctx, true));
  }

  private async probe(key: string, ctx: ExecCtx): Promise<Probe> {
    const response = await this.transport.send({
      method: "POST", url: `${this.provider.chatUrl}/v1/publishers/google/models/__probe__:generateContent`,
      headers: { "x-goog-api-key": key, "content-type": "application/json" }, body: PROBE_BODY, timeoutMs: METADATA_TIMEOUT_MS,
    }, ctx);
    const json = parseJson(await readBoundedText(response.body, PROBE_BODY_BYTES));
    const error = record(record(Array.isArray(json) ? json[0] : json).error);
    const message = (text(error.message) ?? "").split(key).join("***").slice(0, MAX_MESSAGE_CHARS);
    const project = PROJECT_IN_MESSAGE.exec(message)?.[1];
    return { status: response.status, message, ...(project ? { project } : {}) };
  }

  private refusal(probe: Probe): string {
    return isKeyAnswer(probe.status)
      ? `Google rejected the ${this.provider.name} API key (${probe.status})${probe.message ? `: ${probe.message}` : ""}`
      : `Google did not name the project of this ${this.provider.name} API key; connect with a service-account JSON instead`;
  }

  private async projectOf(key: string, ctx: ExecCtx): Promise<string> {
    const cached = projects.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.project;
    const probe = await this.probe(key, ctx);
    if (!probe.project) throw new EngineError("AUTH_ERROR", this.refusal(probe), { provider: this.provider.id, status: probe.status });
    rememberProject(key, probe.project);
    return probe.project;
  }

  // connection.vertex-credential-test, corrected: a JSON credential must yield a token; a key must pass the probe.
  async validate(credential: Credential, ctx: ExecCtx): Promise<CredentialStatus> {
    try {
      const parsed = this.parse(credential);
      if (parsed.kind !== "api-key") {
        await googleAccessToken(parsed, credential.apiKey, this.transport, ctx, this.provider.id, true);
        return { valid: true };
      }
      const probe = await this.probe(parsed.key, ctx);
      if (probe.project && !isKeyAnswer(probe.status)) {
        rememberProject(parsed.key, probe.project);
        return { valid: true };
      }
      if (isKeyAnswer(probe.status) || this.needsProject) return { valid: false, code: "AUTH_ERROR", message: this.refusal(probe) };
      if (probe.status === 404) return { valid: true };
      throw new EngineError("PROVIDER_UNAVAILABLE", `${this.provider.name} answered ${probe.status} to the key check`, { provider: this.provider.id, status: probe.status });
    } catch (error) {
      if (error instanceof EngineError && error.code === "AUTH_ERROR") return { valid: false, code: "AUTH_ERROR", message: error.message };
      throw error;
    }
  }
}

// Neither Vertex path lists models upstream: the catalog models are the list.
const catalogModels = (provider: ProviderDescriptor): readonly ListedModel[] => provider.models.map((descriptor) => ({ id: descriptor.id, descriptor }));

export class VertexAdapter extends GeminiAdapter implements AIProviderPort {
  // translator.openai-to-vertex-request: Vertex's borrowed signature, and no call ids.
  protected override readonly bodyOptions = { borrowed: VERTEX_THOUGHT_SIGNATURE, callIds: false };
  private readonly cloud: GoogleCloud;

  constructor(provider: ProviderDescriptor, transport: HttpTransportPort) {
    super(provider, transport);
    this.cloud = new GoogleCloud(provider, transport, false);
  }

  protected override request(method: HttpRequest["method"], url: string, credential: Credential, timeoutMs: number): HttpRequest {
    return authorize(super.request(method, url, credential, timeoutMs), credential);
  }

  // A token reaches the project's global location; a key (which carries no project here) uses the express endpoint.
  protected override modelsBase(credential: Credential): string {
    const project = access.get(credential)?.project;
    if (project) return `${this.provider.chatUrl}/v1/projects/${encodeURIComponent(project)}/locations/global/publishers/google/models`;
    return `${this.provider.chatUrl}/v1/publishers/google/models`;
  }

  override execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<CanonicalResponse> {
    return this.cloud.call(credential, ctx, (resolved) => super.execute(request, resolved, ctx));
  }

  override stream(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): AsyncGenerator<StreamChunk> {
    return this.cloud.stream(credential, ctx, (resolved) => super.stream(request, resolved, ctx));
  }

  override async getModels(): Promise<readonly ListedModel[]> {
    return catalogModels(this.provider);
  }

  override validateCredential(credential: Credential, ctx: ExecCtx): Promise<CredentialStatus> {
    return this.cloud.validate(credential, ctx);
  }
}

export class VertexPartnerAdapter extends OpenAICompatibleAdapter implements AIProviderPort {
  private readonly cloud: GoogleCloud;

  constructor(provider: ProviderDescriptor, transport: HttpTransportPort) {
    super(provider, transport);
    this.cloud = new GoogleCloud(provider, transport, true);
  }

  protected override request(method: HttpRequest["method"], url: string, credential: Credential, timeoutMs: number): HttpRequest {
    return authorize(super.request(method, url, credential, timeoutMs), credential);
  }

  protected override chatUrl(credential: Credential): string {
    const project = access.get(credential)?.project;
    if (!project) throw new EngineError("AUTH_ERROR", `The ${this.provider.name} credential has no project`, { provider: this.provider.id });
    return `${this.provider.chatUrl}/v1/projects/${encodeURIComponent(project)}/locations/global/endpoints/openapi/chat/completions`;
  }

  override execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<CanonicalResponse> {
    return this.cloud.call(credential, ctx, (resolved) => super.execute(request, resolved, ctx));
  }

  override stream(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): AsyncGenerator<StreamChunk> {
    return this.cloud.stream(credential, ctx, (resolved) => super.stream(request, resolved, ctx));
  }

  override async getModels(): Promise<readonly ListedModel[]> {
    return catalogModels(this.provider);
  }

  override validateCredential(credential: Credential, ctx: ExecCtx): Promise<CredentialStatus> {
    return this.cloud.validate(credential, ctx);
  }
}
