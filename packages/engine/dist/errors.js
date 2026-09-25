// Error taxonomy and fallback policy (spec §5; .agents/skills/porting-behavior-not-code/error-taxonomy.md).
export const ERROR_CODES = [
    "AUTH_ERROR", "RATE_LIMIT", "QUOTA_EXHAUSTED", "PROVIDER_UNAVAILABLE",
    "TIMEOUT", "INVALID_REQUEST", "MODEL_UNAVAILABLE", "INTERNAL_ERROR",
];
// Which failures may move on to the next candidate. Data, not scattered status checks (spec §5).
// Streaming adds one more rule the caller enforces: never fall back after the first chunk.
export const FALLBACK_POLICY = {
    AUTH_ERROR: "next-account",
    RATE_LIMIT: "next-candidate",
    QUOTA_EXHAUSTED: "next-candidate",
    PROVIDER_UNAVAILABLE: "next-candidate",
    TIMEOUT: "next-candidate",
    MODEL_UNAVAILABLE: "next-candidate",
    INVALID_REQUEST: "stop",
    INTERNAL_ERROR: "stop",
};
export function isRecoverable(code) {
    return FALLBACK_POLICY[code] !== "stop";
}
export class EngineError extends Error {
    code;
    details;
    constructor(code, message, details = {}, options) {
        super(message, options);
        this.name = "EngineError";
        this.code = code;
        this.details = details;
    }
}
//# sourceMappingURL=errors.js.map