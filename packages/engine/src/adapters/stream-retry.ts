import type { CanonicalRequest, CanonicalResponse, StreamChunk } from "../cip.js";
import { EngineError } from "../errors.js";
import type { AIProviderPort, Credential, CredentialStatus, ExecCtx, ListedModel } from "../ports.js";
import { withRetry } from "../retry.js";

// A custom provider with retryStreamErrors (docs/contracts/custom-providers.md; an AIGate option, not in 9router): a
// request that fails before its first content is sent again, twice at most, 0.5 s then 1 s later. Only a 429 that is not
// a spent quota, or an error the stream sent before any event (partial: false), counts; the HTTP layer already retries
// 502/503/504 and network failures on its own.
const RETRY = { maxAttempts: 3, baseDelayMs: 500, maxDelayMs: 1_000 };

const transient = (error: unknown): boolean =>
  error instanceof EngineError && (error.code === "RATE_LIMIT" || (error.code === "PROVIDER_UNAVAILABLE" && error.details.partial === false));

type Opened = { readonly head: readonly StreamChunk[]; readonly rest?: AsyncIterator<StreamChunk> };

export class StreamRetryAdapter implements AIProviderPort {
  constructor(private readonly inner: AIProviderPort) {}

  execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<CanonicalResponse> {
    return withRetry(() => this.inner.execute(request, credential, ctx), { ...RETRY, signal: ctx.signal, shouldRetry: transient });
  }

  // The start chunk is held back until the first content chunk, so a retried attempt never reaches the client.
  async *stream(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): AsyncGenerator<StreamChunk> {
    const opened = await withRetry(() => this.open(request, credential, ctx), { ...RETRY, signal: ctx.signal, shouldRetry: transient });
    yield* opened.head;
    if (!opened.rest) return;
    try {
      for (let step = await opened.rest.next(); !step.done; step = await opened.rest.next()) yield step.value;
    } finally {
      await opened.rest.return?.(undefined);
    }
  }

  getModels(credential: Credential, ctx: ExecCtx): Promise<readonly ListedModel[]> {
    return this.inner.getModels(credential, ctx);
  }

  validateCredential(credential: Credential, ctx: ExecCtx): Promise<CredentialStatus> {
    return this.inner.validateCredential(credential, ctx);
  }

  // Reads up to the first chunk that is not "start"; a stream that ends before one is returned whole.
  private async open(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<Opened> {
    const iterator = this.inner.stream(request, credential, ctx)[Symbol.asyncIterator]();
    const head: StreamChunk[] = [];
    try {
      for (let step = await iterator.next(); !step.done; step = await iterator.next()) {
        head.push(step.value);
        if (step.value.type !== "start") return { head, rest: iterator };
      }
      return { head };
    } catch (error) {
      await iterator.return?.(undefined);
      throw error;
    }
  }
}
