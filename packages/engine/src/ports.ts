import type { CanonicalRequest, CanonicalResponse, StreamChunk } from "./cip.js";
import type { ErrorCode } from "./errors.js";
import type { ModelDescriptor } from "./registry.js";

// Spec §4.2. One signal (client cancel combined with the request deadline) flows through routing,
// retries, adapters, and body reads; adapters never start a timeout of their own past it.
export interface ExecCtx {
  readonly signal: AbortSignal;
  readonly requestId: string;
}

// Outbound HTTP (spec §4.2 HttpTransportPort). SP8 implements the direct branch; relay, proxy, and
// MITM-bypass DNS are later branches behind the same port (SP18).
export interface HttpRequest {
  readonly method: "GET" | "POST";
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
  // Bounds the whole exchange (headers and body), inside the ctx deadline. Required, so every call
  // site states its budget; 1..600000 ms.
  readonly timeoutMs: number;
}

export interface HttpResponse {
  readonly status: number;
  // Lower-case names.
  readonly headers: Readonly<Record<string, string>>;
  // Aborts with the same signal as the request; read it with readBoundedText() unless streaming.
  readonly body: ReadableStream<Uint8Array> | null;
}

// Rejects with EngineError TIMEOUT, PROVIDER_UNAVAILABLE (network failure or redirect), or
// INVALID_REQUEST (URL not allowed). A ctx abort rejects with ctx.signal.reason unchanged.
export interface HttpTransportPort {
  send(request: HttpRequest, ctx: ExecCtx): Promise<HttpResponse>;
}

// M1 credentials are API keys only (SP11: one api-key account). OAuth arrives in SP16.
export interface Credential {
  readonly kind: "api-key";
  readonly apiKey: string;
}

// One id from an upstream model list. `descriptor` is the registry entry when the id is known; an
// unknown id carries no invented limits (docs/contracts/provider-openai.md).
export interface ListedModel {
  readonly id: string;
  readonly descriptor?: ModelDescriptor;
}

export type CredentialStatus = { readonly valid: true } | { readonly valid: false; readonly code: ErrorCode; readonly message: string };

// Implemented per protocol family (SP9: openai-compatible). Every call takes the context, so even
// model listing and credential checks stay inside the request deadline; the spec signature is
// widened here for that reason.
export interface AIProviderPort {
  execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<CanonicalResponse>;
  stream(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): AsyncIterable<StreamChunk>;
  getModels(credential: Credential, ctx: ExecCtx): Promise<readonly ListedModel[]>;
  validateCredential(credential: Credential, ctx: ExecCtx): Promise<CredentialStatus>;
}
