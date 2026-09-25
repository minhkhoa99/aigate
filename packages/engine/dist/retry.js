// The one retry helper (spec §4.2). Adapters retry only through this, so every retry loop has a
// finite attempt count, capped backoff, and stops the moment the shared request signal aborts.
// Only operations that are safe to repeat may use it; never retry a stream after its first chunk.
// A hard ceiling, so a misconfigured caller cannot turn one request into a retry storm.
export const MAX_ATTEMPTS_LIMIT = 10;
function validate({ maxAttempts, baseDelayMs, maxDelayMs }) {
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > MAX_ATTEMPTS_LIMIT) {
        throw new RangeError(`maxAttempts must be an integer from 1 to ${MAX_ATTEMPTS_LIMIT}`);
    }
    if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0)
        throw new RangeError("baseDelayMs must be a finite number >= 0");
    if (!Number.isFinite(maxDelayMs) || maxDelayMs < baseDelayMs)
        throw new RangeError("maxDelayMs must be finite and >= baseDelayMs");
}
function abortReason(signal) {
    return signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}
// A wait that ends early, with the abort reason, when the signal fires.
function delay(ms, signal) {
    if (signal.aborted)
        return Promise.reject(abortReason(signal));
    return new Promise((resolve, reject) => {
        const onAbort = () => {
            clearTimeout(timer);
            reject(abortReason(signal));
        };
        const timer = setTimeout(() => {
            signal.removeEventListener("abort", onAbort);
            resolve();
        }, ms);
        signal.addEventListener("abort", onAbort, { once: true });
    });
}
export async function withRetry(operation, options) {
    validate(options);
    const { signal, maxAttempts, baseDelayMs, maxDelayMs, shouldRetry } = options;
    for (let attempt = 1;; attempt++) {
        if (signal.aborted)
            throw abortReason(signal);
        try {
            return await operation(attempt, signal);
        }
        catch (error) {
            // An abort is never retried: the client left or the request budget is spent.
            if (signal.aborted || attempt >= maxAttempts || !shouldRetry(error))
                throw error;
            await delay(Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1)), signal);
        }
    }
}
//# sourceMappingURL=retry.js.map