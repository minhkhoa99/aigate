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
  readonly body?: string | Uint8Array;
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

// A bounded binary HTTP/2 response (Cursor ConnectRPC). The engine owns the protocol bytes; the server owns Node's
// HTTP/2 implementation, so the engine stays framework- and runtime-library-free.
export interface HttpBytesResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array;
}

export interface HttpDuplex {
  readonly response: Promise<{ readonly status: number; readonly headers: Readonly<Record<string, string>> }>;
  write(body: Uint8Array): void;
  end(): void;
  close(): void;
  read(): Promise<{ readonly done: boolean; readonly value?: Uint8Array }>;
}

// Rejects with EngineError TIMEOUT, PROVIDER_UNAVAILABLE (network failure or redirect), or
// INVALID_REQUEST (URL not allowed). A ctx abort rejects with ctx.signal.reason unchanged.
export interface HttpTransportPort {
  send(request: HttpRequest, ctx: ExecCtx): Promise<HttpResponse>;
  // Optional because fetch-only test transports and non-Node deployments can still serve every other adapter.
  sendHttp2?(request: HttpRequest, ctx: ExecCtx, maxBytes: number): Promise<HttpBytesResponse>;
  openHttp2?(request: HttpRequest, ctx: ExecCtx): HttpDuplex;
}

// An API key or an OAuth access token (SP16 keeps both as "api-key").
export interface Credential {
  readonly kind: "api-key";
  readonly apiKey: string;
  // A session id stable per connection (SP16b: claude's metadata.user_id, codex's session_id and prompt_cache_key).
  readonly sessionId?: string;
  // SP16c: the Google Cloud Code project the connection signed in with (gemini-cli, antigravity).
  readonly projectId?: string;
  // Provider-specific OAuth data needed after sign-in (Kimi device id, etc.).
  readonly providerData?: Readonly<Record<string, string>>;
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
