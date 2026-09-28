import { type CanonicalRequest, type CanonicalResponse } from "../cip.js";
import { EngineError } from "../errors.js";
import { record } from "../json.js";
import { type Credential, type ExecCtx, type HttpRequest, type HttpTransportPort } from "../ports.js";
import { type ProviderDescriptor } from "../registry.js";
import { collected } from "./collect.js";
import { OpenAIResponsesAdapter } from "./openai-responses.js";

const MAX_OUTPUT_TOKENS = 64_000;
const MAX_TURNS = 5_000;
const EFFORTS = new Set(["low", "medium", "high", "xhigh"]);
const sessions = new Map<string, { turn: number; used: number }>();
const requestState = new WeakMap<Credential, { model: string; turn: number; requestId: string; agentId?: string }>();

const effortOf = (model: string): string | undefined => {
  const suffix = model.match(/-(low|medium|high|xhigh)$/)?.[1];
  return suffix === "max" ? "xhigh" : suffix;
};

export class GrokCliAdapter extends OpenAIResponsesAdapter {
  constructor(provider: ProviderDescriptor, transport: HttpTransportPort) { super(provider, transport); }

  override execute(request: CanonicalRequest, credential: Credential, ctx: ExecCtx): Promise<CanonicalResponse> {
    return collected(this.stream(request, credential, ctx), request.model);
  }

  protected override transformResponsesBody(body: Record<string, unknown>, request: CanonicalRequest, credential: Credential): void {
    const known = this.known.get(request.model);
    const model = known?.upstreamModelId ?? request.model.replace(/-(low|medium|high|xhigh)$/, "");
    const session = credential.sessionId ?? "default";
    const input = Array.isArray(body.input) ? body.input : [];
    const counted = Math.max(1, input.filter((item) => {
      const value = record(item);
      return value.role === "user" && (value.type === undefined || value.type === "message");
    }).length);
    const previous = sessions.get(session);
    const turn = Math.max(counted, previous ? previous.turn + 1 : 0);
    if (sessions.size >= MAX_TURNS && !sessions.has(session)) {
      const oldest = sessions.keys().next().value;
      if (typeof oldest === "string") sessions.delete(oldest);
    }
    sessions.set(session, { turn, used: Date.now() });
    requestState.set(credential, { model, turn, requestId: crypto.randomUUID(), ...(credential.providerData?.agentId ? { agentId: credential.providerData.agentId } : {}) });

    body.model = model;
    body.stream = true;
    body.store = false;
    if (typeof body.max_output_tokens === "number") body.max_output_tokens = Math.min(MAX_OUTPUT_TOKENS, body.max_output_tokens);
    else body.max_output_tokens = MAX_OUTPUT_TOKENS;
    const original = record(body.reasoning);
    const effort = effortOf(request.model);
    if (/^grok-4\.5(?:$|-)/.test(model)) {
      const requested = typeof original.effort === "string" ? original.effort : effort;
      original.effort = requested === "max" ? "xhigh" : EFFORTS.has(requested ?? "") ? requested : "high";
    } else delete original.effort;
    original.summary ??= "concise";
    body.reasoning = original;
    const include = Array.isArray(body.include) ? body.include : [];
    if (!include.includes("reasoning.encrypted_content")) include.push("reasoning.encrypted_content");
    body.include = include;
    for (const key of ["messages", "max_tokens", "max_completion_tokens", "n", "seed", "logprobs", "top_logprobs", "frequency_penalty", "presence_penalty", "logit_bias", "user", "stream_options", "previous_response_id"]) delete body[key];
  }

  protected override request(method: HttpRequest["method"], url: string, credential: Credential, timeoutMs: number): HttpRequest {
    const base = super.request(method, url, credential, timeoutMs);
    const state = requestState.get(credential);
    return state ? { ...base, headers: {
      ...base.headers, "x-grok-session-id": credential.sessionId ?? "default", "x-grok-conv-id": credential.sessionId ?? "default",
      "x-grok-req-id": state.requestId, "x-grok-turn-idx": String(state.turn), "x-grok-model-override": state.model,
      ...(state.agentId ? { "x-grok-agent-id": state.agentId } : {}), ...(credential.providerData?.email ? { "x-email": credential.providerData.email } : {}),
      ...(credential.providerData?.userId ? { "x-userid": credential.providerData.userId } : {}),
    } } : base;
  }

  protected override shouldRetry(error: unknown): boolean {
    if (!(error instanceof EngineError)) return false;
    const status = error.details.status;
    return typeof status === "number" && (status === 429 || status >= 500);
  }

  protected override retryDelayMs(error: unknown, attempt: number): number {
    const retryAfter = error instanceof EngineError ? error.details.retryAfterMs : undefined;
    return typeof retryAfter === "number" ? Math.min(10_000, retryAfter) : Math.min(10_000, 500 * 2 ** (attempt - 1));
  }
}
