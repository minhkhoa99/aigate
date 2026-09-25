export interface RetryOptions {
    readonly signal: AbortSignal;
    readonly maxAttempts: number;
    readonly baseDelayMs: number;
    readonly maxDelayMs: number;
    readonly shouldRetry: (error: unknown) => boolean;
}
export declare const MAX_ATTEMPTS_LIMIT = 10;
export declare function withRetry<T>(operation: (attempt: number, signal: AbortSignal) => Promise<T>, options: RetryOptions): Promise<T>;
