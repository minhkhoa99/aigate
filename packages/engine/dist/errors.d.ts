export declare const ERROR_CODES: readonly ["AUTH_ERROR", "RATE_LIMIT", "QUOTA_EXHAUSTED", "PROVIDER_UNAVAILABLE", "TIMEOUT", "INVALID_REQUEST", "MODEL_UNAVAILABLE", "INTERNAL_ERROR"];
export type ErrorCode = (typeof ERROR_CODES)[number];
export declare const FALLBACK_POLICY: Readonly<Record<ErrorCode, "next-account" | "next-candidate" | "stop">>;
export declare function isRecoverable(code: ErrorCode): boolean;
export declare class EngineError extends Error {
    readonly code: ErrorCode;
    readonly details: Readonly<Record<string, unknown>>;
    constructor(code: ErrorCode, message: string, details?: Readonly<Record<string, unknown>>, options?: {
        cause?: unknown;
    });
}
