import { EngineError, type ErrorCode } from "../errors.js";
import { readBoundedText } from "../http.js";
import { parseJson, record, text } from "../json.js";
import type { Credential, ExecCtx, HttpRequest, HttpResponse, HttpTransportPort } from "../ports.js";
import type { ModelDescriptor, ProviderDescriptor } from "../registry.js";
import { withRetry } from "../retry.js";

// The HTTP side every provider family shares (docs/contracts/provider-openai.md, provider-anthropic.md):
// auth headers, bounded retries before the first byte, upstream error classification, and redaction.

export const METADATA_TIMEOUT_MS = 15_000;
export const RETRY = { maxAttempts: 3, baseDelayMs: 500, maxDelayMs: 1_000 };
const RETRY_STATUSES = new Set([502, 503, 504]);
const ERROR_BODY_BYTES = 64 * 1024;
const MAX_MESSAGE_CHARS = 300;
// Printable ASCII only: a key can never break out of its header.
const API_KEY = /^[\x21-\x7e]{1,4096}$/;

export const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

// By status and the upstream code only, never by message text.
export function classifyStatus(status: number, upstreamCode: string | undefined): ErrorCode {
  if (status === 401 || status === 403) return "AUTH_ERROR";
  if (status === 402 || (status === 429 && upstreamCode === "insufficient_quota")) return "QUOTA_EXHAUSTED";
  if (status === 429) return "RATE_LIMIT";
  if (status === 404 || upstreamCode === "model_not_found") return "MODEL_UNAVAILABLE";
  if (status === 408) return "TIMEOUT";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  return "INVALID_REQUEST";
}

// Retry only what a second try can fix: 502/503/504, or a transport failure with no status.
// A redirect carries a 3xx status and a timeout has its own code, so neither is retried.
export function isTransient(error: unknown): boolean {
  if (!(error instanceof EngineError) || error.code !== "PROVIDER_UNAVAILABLE") return false;
  const status = error.details.status;
  return status === undefined || (typeof status === "number" && RETRY_STATUSES.has(status));
}

export abstract class HttpProviderAdapter {
  protected readonly provider: ProviderDescriptor;
  protected readonly transport: HttpTransportPort;
  protected readonly known: ReadonlyMap<string, ModelDescriptor>;

  constructor(provider: ProviderDescriptor, transport: HttpTransportPort) {
    this.provider = provider;
    this.transport = transport;
    this.known = new Map(provider.models.map((model) => [model.id, model]));
  }

  // Catalog headers first, the key last: a static header can never replace the credential.
  protected request(method: HttpRequest["method"], url: string, credential: Credential, timeoutMs: number): HttpRequest {
    // connection.ollama-local-host: a keyless connection sends no auth header at all.
    if (credential.apiKey === "" && this.provider.auth.optional) return { method, url, headers: { ...this.provider.headers }, timeoutMs };
    if (!API_KEY.test(credential.apiKey)) {
      throw new EngineError("AUTH_ERROR", `The ${this.provider.name} API key is empty, too long, or has spaces or control characters`, { provider: this.provider.id });
    }
    const { header, scheme } = this.provider.auth;
    const headers = { ...this.provider.headers, [header]: scheme === "bearer" ? `Bearer ${credential.apiKey}` : credential.apiKey };
    // connection.anthropic-compatible-node: 9router also sends the key as Bearer to any gateway but api.anthropic.com.
    if (this.provider.anthropicNode?.official === false) headers.authorization = `Bearer ${credential.apiKey}`;
    return { method, url, headers, timeoutMs };
  }

  // The only place an adapter retries, and only before any byte of a stream was used.
  protected send(request: HttpRequest, credential: Credential, ctx: ExecCtx, maxAttempts: number): Promise<HttpResponse> {
    return withRetry(async () => {
      const response = await this.transport.send(request, ctx);
      if (response.status >= 200 && response.status < 300) return response;
      throw await this.upstreamError(response, credential, ctx);
    }, { ...RETRY, maxAttempts, signal: ctx.signal, shouldRetry: isTransient });
  }

  // OpenAI { error: { message, code, type } } and Anthropic { type: "error", error: { type, message } } share this shape.
  private async upstreamError(response: HttpResponse, credential: Credential, ctx: ExecCtx): Promise<EngineError> {
    // The status alone still classifies the failure if the body cannot be read; a caller abort cannot be swallowed.
    const raw = await readBoundedText(response.body, ERROR_BODY_BYTES).catch((error: unknown) => {
      if (ctx.signal.aborted) throw error;
      return "";
    });
    const root = record(parseJson(raw));
    const error = record(root.error);
    const upstreamCode = text(error.code) ?? text(error.type);
    const code = classifyStatus(response.status, upstreamCode);
    const message = this.clean(text(error.message) ?? text(root.error), credential);
    return new EngineError(code, `${this.provider.name} answered ${response.status}${message ? `: ${message}` : ""}`, {
      provider: this.provider.id, status: response.status, ...(upstreamCode ? { upstreamCode } : {}),
    });
  }

  protected streamError(value: unknown, credential: Credential, partial: boolean): EngineError {
    const error = record(value);
    const message = this.clean(text(error.message) ?? text(value), credential);
    return new EngineError("PROVIDER_UNAVAILABLE", `${this.provider.name} sent an error in the stream${message ? `: ${message}` : ""}`, {
      provider: this.provider.id, partial,
    });
  }

  // Upstream text is shown to users: bounded, and never the credential, even if a provider echoes it.
  protected clean(message: string | undefined, credential: Credential): string {
    // A keyless connection (ollama-local) has nothing to redact; splitting on "" would break every character apart.
    const clean = credential.apiKey === "" ? (message ?? "") : (message ?? "").split(credential.apiKey).join("***");
    return clean.slice(0, MAX_MESSAGE_CHARS);
  }

  protected invalid(what: string, partial = false): EngineError {
    return new EngineError("PROVIDER_UNAVAILABLE", `${this.provider.name} sent ${what}`, { provider: this.provider.id, ...(partial ? { partial } : {}) });
  }
}
