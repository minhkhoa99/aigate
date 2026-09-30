import { EngineError, readBoundedText, UnsupportedFeatureError, type AIProviderPort, type CanonicalRequest, type CanonicalResponse, type ExecCtx, type HttpRequest, type HttpResponse, type HttpTransportPort, type StreamChunk, type TokenUsage } from "@aigate/engine";
import { estimateTokens } from "../../usage/domain/usage.js";
import type { UsageCall, UsageRecorder } from "../../usage/infrastructure/usage-recorder.js";

// docs/contracts/usage.md "What is recorded": one usage event per upstream call, whatever the client protocol, combo
// member, or fusion role. The meter wraps the adapter, so a success, a failure, and a stream the client left all pass
// through it (routing.usage-recording-timing: the aborted stream is recorded here, from the iterator's finally).

const NONE: TokenUsage = { inputTokens: 0, outputTokens: 0 };

const codeOf = (error: unknown): string =>
  error instanceof EngineError ? error.code : error instanceof UnsupportedFeatureError ? "UNSUPPORTED_FEATURE" : error instanceof Error ? error.name : "UNKNOWN";

// A cancelled call ends with whatever the body threw; the signal's reason says why (a deadline, or the client left).
const abortCode = (signal: AbortSignal): string | undefined =>
  (!signal.aborted ? undefined : signal.reason instanceof EngineError ? signal.reason.code : "CLIENT_CLOSED");

// The request's text, for the estimate when the upstream reports no usage (9router estimates from the body).
const requestChars = (request: CanonicalRequest): number => JSON.stringify({ system: request.system, messages: request.messages, tools: request.tools }).length;

function answerChars(response: CanonicalResponse): number {
  let chars = 0;
  for (const part of response.content) {
    if (part.type === "text" || part.type === "thinking") chars += part.text.length;
    else if (part.type === "tool_call") chars += JSON.stringify(part.arguments ?? {}).length + part.name.length;
  }
  return chars;
}

const reported = (usage: TokenUsage | undefined): usage is TokenUsage => usage !== undefined && (usage.inputTokens > 0 || usage.outputTokens > 0);

export function meter(adapter: AIProviderPort, call: UsageCall, recorder: UsageRecorder): AIProviderPort {
  return {
    getModels: (credential, ctx) => adapter.getModels(credential, ctx),
    validateCredential: (credential, ctx) => adapter.validateCredential(credential, ctx),

    async execute(request, credential, ctx) {
      const started = Date.now();
      const end = recorder.begin(call);
      try {
        const response = await adapter.execute(request, credential, ctx);
        const estimated = !reported(response.usage);
        const usage = estimated ? { inputTokens: estimateTokens(requestChars(request)), outputTokens: estimateTokens(answerChars(response)) } : response.usage;
        recorder.record(call, { status: "success", errorCode: null, usage, estimated, latencyMs: Date.now() - started, ttftMs: null });
        return response;
      } catch (error) {
        recorder.record(call, { status: "error", errorCode: codeOf(error), usage: NONE, estimated: false, latencyMs: Date.now() - started, ttftMs: null });
        throw error;
      } finally {
        end();
      }
    },

    async *stream(request, credential, ctx): AsyncGenerator<StreamChunk> {
      const started = Date.now();
      const end = recorder.begin(call);
      let ttftMs: number | null = null;
      let usage: TokenUsage | undefined;
      let chars = 0;
      let finished = false;
      let failure: unknown;
      try {
        for await (const chunk of adapter.stream(request, credential, ctx)) {
          ttftMs ??= Date.now() - started;
          if (chunk.type === "usage") usage = chunk.usage;
          else if (chunk.type === "text_delta" || chunk.type === "thinking_delta") chars += chunk.text.length;
          else if (chunk.type === "tool_call_delta") chars += chunk.argumentsDelta.length + (chunk.name?.length ?? 0);
          yield chunk;
        }
        finished = true;
      } catch (error) {
        failure = error;
        throw error;
      } finally {
        end();
        // Failed before any byte: an error with nothing billed. Stopped after bytes (error, stall, or the client left):
        // aborted, with the usage seen so far or an estimate of it.
        const status = finished ? "success" : ttftMs === null && failure !== undefined ? "error" : "aborted";
        const estimated = status !== "error" && !reported(usage);
        recorder.record(call, {
          status, errorCode: finished ? null : abortCode(ctx.signal) ?? (failure === undefined ? "CLIENT_CLOSED" : codeOf(failure)),
          usage: status === "error" ? NONE : estimated ? { inputTokens: estimateTokens(requestChars(request)), outputTokens: estimateTokens(chars) } : usage ?? NONE,
          estimated, latencyMs: Date.now() - started, ttftMs,
        });
      }
    },
  };
}

// SP24b media lanes: the usage block an OpenAI-style answer carries (embeddings, some image APIs), else nothing.
export function usageOfBody(text: string): TokenUsage {
  try {
    const root: unknown = JSON.parse(text);
    const usage = typeof root === "object" && root !== null && "usage" in root ? root.usage : undefined;
    if (typeof usage !== "object" || usage === null) return NONE;
    const count = (key: string): number => {
      const value: unknown = key in usage ? Reflect.get(usage, key) : undefined;
      return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    };
    return { inputTokens: count("prompt_tokens") || count("input_tokens"), outputTokens: count("completion_tokens") || count("output_tokens") };
  } catch {
    return NONE;
  }
}

const MAX_MEDIA_TEXT = 16 * 1024 * 1024;

// One media call: sent, read (bounded), and recorded as a usage event whatever its outcome.
export async function meteredSend(transport: HttpTransportPort, recorder: UsageRecorder, call: UsageCall, http: HttpRequest, ctx: ExecCtx): Promise<{ response: HttpResponse; text: string }> {
  const started = Date.now();
  const end = recorder.begin(call);
  try {
    const response = await transport.send(http, ctx);
    const text = await readBoundedText(response.body, MAX_MEDIA_TEXT);
    const ok = response.status >= 200 && response.status < 300;
    recorder.record(call, { status: ok ? "success" : "error", errorCode: ok ? null : `HTTP_${response.status}`, usage: ok ? usageOfBody(text) : NONE, estimated: false, latencyMs: Date.now() - started, ttftMs: null });
    return { response, text };
  } catch (error) {
    recorder.record(call, { status: "error", errorCode: abortCode(ctx.signal) ?? codeOf(error), usage: NONE, estimated: false, latencyMs: Date.now() - started, ttftMs: null });
    throw error;
  } finally {
    end();
  }
}
