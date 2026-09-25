import type { CanonicalRequest, CanonicalResponse, StreamChunk } from "./cip.js";
import type { ErrorCode } from "./errors.js";
import type { ModelDescriptor } from "./registry.js";

// Spec §4.2. One signal (client cancel combined with the request deadline) flows through routing,
// retries, adapters, and body reads; adapters never start a timeout of their own past it.
export interface ExecCtx {
  readonly signal: AbortSignal;
  readonly requestId: string;
}

// M1 credentials are API keys only (SP11: one api-key account). OAuth arrives in SP16.
export interface Credential {
  readonly kind: "api-key";
  readonly apiKey: string;
}

export type CredentialStatus = { readonly valid: true } | { readonly valid: false; readonly code: ErrorCode; readonly message: string };

// Implemented per protocol family (SP9: openai-compatible). Every call takes the context, so even
// model listing and credential checks stay inside the request deadline; the spec signature is
// widened here for that reason.
export interface AIProviderPort {
  execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<CanonicalResponse>;
  stream(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): AsyncIterable<StreamChunk>;
  getModels(credential: Credential, ctx: ExecCtx): Promise<readonly ModelDescriptor[]>;
  validateCredential(credential: Credential, ctx: ExecCtx): Promise<CredentialStatus>;
}
