import type { CanonicalRequest, CanonicalResponse, StreamChunk } from "./cip.js";
import type { ErrorCode } from "./errors.js";
import type { ModelDescriptor } from "./registry.js";
export interface ExecCtx {
    readonly signal: AbortSignal;
    readonly requestId: string;
}
export interface Credential {
    readonly kind: "api-key";
    readonly apiKey: string;
}
export type CredentialStatus = {
    readonly valid: true;
} | {
    readonly valid: false;
    readonly code: ErrorCode;
    readonly message: string;
};
export interface AIProviderPort {
    execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<CanonicalResponse>;
    stream(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): AsyncIterable<StreamChunk>;
    getModels(credential: Credential, ctx: ExecCtx): Promise<readonly ModelDescriptor[]>;
    validateCredential(credential: Credential, ctx: ExecCtx): Promise<CredentialStatus>;
}
