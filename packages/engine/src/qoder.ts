import { EngineError, type ErrorCode } from "./errors.js";
import { isRecord, parseJson, record, type Json } from "./json.js";
import type { OAuthIO, OAuthProvider, OAuthTokens, PollResult } from "./oauth.js";
import type { ExecCtx, HttpRequest, HttpResponse } from "./ports.js";

const OPENAPI = "https://openapi.qoder.sh/api/v1";
const KiB = 1024;
const encoder = new TextEncoder();
const IDENTIFIER = /^[\x21-\x7e]{1,256}$/;
const TOKEN = /^[\x21-\x7e]{1,16384}$/;
const SUCCESS = new Set<unknown>([undefined, 0, "0", 200, "200", "success", "SUCCESS"]);
const HTTP_CODES = new Set(["101", "400", "401", "402", "403", "404", "408", "422", "429", "500", "502", "503", "504"]);
const BUSINESS_CODES = new Set(["invalid_token", "token_expired", "unauthorized", "access_denied", "insufficient_quota", "quota_exceeded", "usage_limit_reached", "rate_limit_exceeded", "rate_limit", "model_not_found", "timeout", "signature_invalid"]);

export type QoderDeviceAttempt = { nonce: string; codeVerifier: string; machineId: string; authUrl: string; clientId?: string };

class NativeQoderError extends EngineError {}

// Shared with the adapter: upstream messages, URLs and transport causes may contain secrets and are never exposed.
export function qoderError(code: ErrorCode, diagnostic: string, details: Readonly<Record<string, unknown>> = {}): EngineError {
  return new NativeQoderError(code, `Qoder: ${diagnostic}`, { ...details, provider: "qoder", code: diagnostic });
}

export function requireQoderAccessToken(token: string): void {
  if (token.startsWith("pt-")) throw qoderError("AUTH_ERROR", "QODER_PAT_UNSUPPORTED");
  if (!TOKEN.test(token)) throw qoderError("AUTH_ERROR", "QODER_AUTH_FAILED");
}

export function qoderUpstreamError(status: number, value: unknown, headers: Readonly<Record<string, string>> = {}): EngineError {
  const root = record(value);
  const error = isRecord(root.error) ? root.error : root;
  const suppliedCode = error.code ?? error.type ?? root.code;
  const rawCode = typeof suppliedCode === "number" && Number.isSafeInteger(suppliedCode) ? String(suppliedCode) : suppliedCode;
  const upstreamCode = typeof rawCode === "string" && (HTTP_CODES.has(rawCode) || BUSINESS_CODES.has(rawCode)) ? rawCode : undefined;
  const frameStatus = error.status ?? error.status_code ?? root.status ?? root.status_code;
  const numericStatus = typeof frameStatus === "string" && /^\d{3}$/.test(frameStatus) ? Number(frameStatus) : frameStatus;
  const actual = status === 200 && typeof numericStatus === "number" && Number.isInteger(numericStatus) && numericStatus >= 400 && numericStatus <= 599 ? numericStatus : status;
  let code: ErrorCode = "PROVIDER_UNAVAILABLE";
  let diagnostic = "QODER_PROTOCOL_ERROR";
  if (upstreamCode === "101" || upstreamCode === "signature_invalid") diagnostic = "QODER_SIGNATURE_REQUIRED";
  else if (["insufficient_quota", "quota_exceeded", "usage_limit_reached", "402"].includes(upstreamCode ?? "") || actual === 402) { code = "QUOTA_EXHAUSTED"; diagnostic = "QODER_QUOTA_EXHAUSTED"; }
  else if (actual === 401 || actual === 403 || ["invalid_token", "token_expired", "unauthorized", "access_denied", "401", "403"].includes(upstreamCode ?? "")) { code = "AUTH_ERROR"; diagnostic = "QODER_AUTH_FAILED"; }
  else if (actual === 429 || ["rate_limit_exceeded", "rate_limit", "429"].includes(upstreamCode ?? "")) { code = "RATE_LIMIT"; diagnostic = "QODER_RATE_LIMIT"; }
  else if (actual === 408 || actual === 504 || ["timeout", "408", "504"].includes(upstreamCode ?? "")) { code = "TIMEOUT"; diagnostic = "QODER_TIMEOUT"; }
  else if (actual === 404 || upstreamCode === "model_not_found" || upstreamCode === "404") { code = "MODEL_UNAVAILABLE"; diagnostic = "QODER_MODEL_UNAVAILABLE"; }
  else if (actual === 400 || actual === 422) { code = "INVALID_REQUEST"; diagnostic = "QODER_INVALID_REQUEST"; }
  const retry = headers["retry-after"];
  const retryAfterMs = retry && /^\d{1,6}(?:\.\d{1,3})?$/.test(retry) ? Number(retry) * 1000 : retry && retry.length <= 64 ? Date.parse(retry) - Date.now() : NaN;
  return qoderError(code, diagnostic, { status: actual, ...(upstreamCode ? { upstreamCode } : {}), ...(Number.isFinite(retryAfterMs) && retryAfterMs > 0 && retryAfterMs <= 86_400_000 ? { retryAfterMs } : {}) });
}

export function qoderBusinessFailure(root: Json): boolean {
  return root.error !== undefined && root.error !== null || root.success === false || !SUCCESS.has(root.code);
}

// The port's timeout covers real transport I/O; this scope also bounds body consumption and non-cooperative test ports.
export function qoderScope(ctx: ExecCtx, timeoutMs: number): { ctx: ExecCtx; wait<T>(work: Promise<T>): Promise<T>; close(): void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(qoderError("TIMEOUT", "QODER_TIMEOUT")), timeoutMs);
  const signal = AbortSignal.any([ctx.signal, controller.signal]);
  return {
    ctx: { ...ctx, signal },
    wait<T>(work: Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const abort = () => reject(signal.reason);
        if (signal.aborted) {
          void work.catch(() => undefined);
          abort();
          return;
        }
        signal.addEventListener("abort", abort, { once: true });
        work.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
      });
    },
    close() { clearTimeout(timer); controller.abort(); },
  };
}

export function qoderIOError(error: unknown, ctx: ExecCtx): EngineError {
  if (ctx.signal.aborted && !(ctx.signal.reason instanceof EngineError && ctx.signal.reason.code === "TIMEOUT")) return qoderError("INVALID_REQUEST", "QODER_CANCELLED");
  if (error instanceof NativeQoderError) return error;
  if (error instanceof EngineError && error.code === "TIMEOUT" || error instanceof Error && error.name === "TimeoutError") return qoderError("TIMEOUT", "QODER_TIMEOUT");
  return qoderError("PROVIDER_UNAVAILABLE", "QODER_TRANSPORT_ERROR");
}

export async function qoderReadBody(response: HttpResponse, scope: ReturnType<typeof qoderScope>, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let result = "";
  try {
    for (;;) {
      const next = await scope.wait(reader.read());
      if (next.done) return result + qoderDecode(decoder);
      size += next.value.byteLength;
      if (size > maxBytes) throw qoderError("PROVIDER_UNAVAILABLE", "QODER_BODY_LIMIT");
      result += qoderDecode(decoder, next.value);
    }
  } finally {
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function qoderSend(io: OAuthIO, request: HttpRequest, scope: ReturnType<typeof qoderScope>): Promise<HttpResponse> {
  return scope.wait(io.transport.send(request, scope.ctx).then((response) => {
    if (scope.ctx.signal.aborted) {
      void response.body?.cancel().catch(() => undefined);
      scope.ctx.signal.throwIfAborted();
    }
    return response;
  }));
}

export async function qoderJson(io: OAuthIO, request: Omit<HttpRequest, "timeoutMs">, maxBytes = 64 * KiB, pending = false): Promise<{ status: number; root: Json }> {
  const scope = qoderScope(io.ctx, 15_000);
  try {
    scope.ctx.signal.throwIfAborted();
    const response = await qoderSend(io, { ...request, timeoutMs: 15_000 }, scope);
    // Pending responses need no JSON body; always release it, including 404/202 HTML responses.
    if (pending && (response.status === 202 || response.status === 404)) {
      void response.body?.cancel().catch(() => undefined);
      return { status: response.status, root: {} };
    }
    const raw = await qoderReadBody(response, scope, maxBytes);
    const value = parseJson(raw);
    if (response.status !== 200) throw qoderUpstreamError(response.status, value, response.headers);
    if (!isRecord(value)) throw qoderError("PROVIDER_UNAVAILABLE", "QODER_PROTOCOL_ERROR", { status: response.status });
    if (qoderBusinessFailure(value)) throw qoderUpstreamError(response.status, value, response.headers);
    return { status: response.status, root: value };
  } catch (error) {
    throw qoderIOError(error, scope.ctx);
  } finally { scope.close(); }
}

export function qoderDecode(decoder: TextDecoder, value?: Uint8Array): string {
  try { return value === undefined ? decoder.decode() : decoder.decode(value, { stream: true }); }
  catch { throw qoderError("PROVIDER_UNAVAILABLE", "QODER_PROTOCOL_ERROR"); }
}

const base64url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function createQoderDeviceAttempt(clientId?: string): Promise<QoderDeviceAttempt> {
  if (clientId !== undefined && !IDENTIFIER.test(clientId)) throw qoderError("INVALID_REQUEST", "QODER_INVALID_CLIENT_ID");
  const codeVerifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(codeVerifier))));
  const nonce = crypto.randomUUID();
  const machineId = crypto.randomUUID();
  const url = new URL("https://qoder.com/device/selectAccounts");
  url.search = new URLSearchParams({ challenge, challenge_method: "S256", nonce, machine_id: machineId, ...(clientId ? { client_id: clientId } : {}) }).toString();
  return { nonce, codeVerifier, machineId, authUrl: url.href, ...(clientId ? { clientId } : {}) };
}

function identityId(value: Json): string | undefined {
  const supplied = value.user_id ?? value.userId ?? value.id ?? value.uid;
  if (supplied === undefined) return undefined;
  const id = typeof supplied === "number" && Number.isSafeInteger(supplied) ? String(supplied) : supplied;
  if (typeof id !== "string" || !IDENTIFIER.test(id)) throw qoderError("PROVIDER_UNAVAILABLE", "QODER_PROTOCOL_ERROR");
  return id;
}

const payload = (root: Json): Json => isRecord(root.data) ? root.data : root;
const profileText = (value: unknown, max: number): string | undefined => typeof value === "string" && value.trim() && value.length <= max && !/[\x00-\x1f\x7f]/.test(value) ? value : undefined;

export async function qoderIdentity(accessToken: string, io: OAuthIO): Promise<{ id: string; name?: string; email?: string }> {
  requireQoderAccessToken(accessToken);
  const { root } = await qoderJson(io, { method: "GET", url: `${OPENAPI}/userinfo`, headers: { accept: "application/json", authorization: `Bearer ${accessToken}` } }, 1024 * KiB);
  const user = payload(root);
  if (qoderBusinessFailure(user)) throw qoderUpstreamError(200, user);
  const id = identityId(user);
  if (!id) throw qoderError("PROVIDER_UNAVAILABLE", "QODER_PROTOCOL_ERROR");
  const rootId = identityId(root);
  if (rootId && rootId !== id) throw qoderError("AUTH_ERROR", "QODER_ACCOUNT_MISMATCH");
  const name = profileText(user.name ?? user.display_name ?? user.displayName ?? user.nickname, 256);
  const email = profileText(user.email, 320);
  return { id, ...(name ? { name } : {}), ...(email ? { email } : {}) };
}

function expiry(data: Json): number | undefined {
  const values: number[] = [];
  for (const key of ["expires_at", "expiresAt"]) {
    if (data[key] === undefined) continue;
    const value = data[key];
    const iso = typeof value === "string" ? /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value) : null;
    const at = iso ? Date.parse(String(value)) : NaN;
    const day = iso ? Date.parse(`${iso[1]}T00:00:00Z`) : NaN;
    if (!iso || !Number.isFinite(at) || !Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== iso[1]) throw qoderError("PROVIDER_UNAVAILABLE", "QODER_INVALID_EXPIRY");
    values.push((at - Date.now()) / 1000);
  }
  for (const key of ["expires_in", "expiresIn"]) {
    if (data[key] === undefined) continue;
    const value = data[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value * 1000 + Date.now() > 8.64e15) throw qoderError("PROVIDER_UNAVAILABLE", "QODER_INVALID_EXPIRY");
    values.push(value);
  }
  if (values.length === 0) return undefined;
  const seconds = Math.floor(Math.min(...values));
  if (seconds <= 0) throw qoderError("AUTH_ERROR", "QODER_AUTH_FAILED");
  return seconds;
}

function tokens(data: Json, stored: Record<string, string>, priorRefresh?: string): OAuthTokens {
  const accessToken = data.device_token ?? data.token ?? data.access_token ?? data.accessToken;
  if (typeof accessToken !== "string") throw qoderError("PROVIDER_UNAVAILABLE", "QODER_PROTOCOL_ERROR");
  requireQoderAccessToken(accessToken);
  const refreshToken = data.refresh_token ?? data.refreshToken ?? priorRefresh;
  if (refreshToken !== undefined && (typeof refreshToken !== "string" || !TOKEN.test(refreshToken))) throw qoderError("PROVIDER_UNAVAILABLE", "QODER_PROTOCOL_ERROR");
  const expiresIn = expiry(data);
  return { accessToken, ...(typeof refreshToken === "string" ? { refreshToken } : {}), ...(expiresIn === undefined ? {} : { expiresIn }), data: stored };
}

export async function pollQoderDevice(attempt: QoderDeviceAttempt, io: OAuthIO): Promise<PollResult> {
  if (!IDENTIFIER.test(attempt.nonce) || !IDENTIFIER.test(attempt.machineId) || !/^[a-zA-Z0-9_-]{43}$/.test(attempt.codeVerifier) || attempt.clientId !== undefined && !IDENTIFIER.test(attempt.clientId)) throw qoderError("INVALID_REQUEST", "QODER_INVALID_ATTEMPT");
  const url = new URL(`${OPENAPI}/deviceToken/poll`);
  url.search = new URLSearchParams({ nonce: attempt.nonce, verifier: attempt.codeVerifier, challenge_method: "S256" }).toString();
  const answer = await qoderJson(io, { method: "GET", url: url.href, headers: { accept: "application/json" } }, 64 * KiB, true);
  if (answer.status !== 200) return { status: "pending" };
  const data = payload(answer.root);
  if (qoderBusinessFailure(data)) throw qoderUpstreamError(200, data);
  const candidate = tokens(data, { machineId: attempt.machineId, ...(attempt.clientId ? { clientId: attempt.clientId } : {}) });
  const receivedAt = Date.now();
  const account = await qoderIdentity(candidate.accessToken, io);
  const claimedIds = [identityId(data), identityId(answer.root)];
  if (claimedIds.some((id) => id !== undefined && id !== account.id)) throw qoderError("AUTH_ERROR", "QODER_ACCOUNT_MISMATCH");
  const expiresIn = candidate.expiresIn === undefined ? undefined : candidate.expiresIn - (Date.now() - receivedAt) / 1000;
  if (expiresIn !== undefined && expiresIn <= 0) throw qoderError("AUTH_ERROR", "QODER_AUTH_FAILED");
  return { status: "approved", tokens: { ...candidate, ...(expiresIn === undefined ? {} : { expiresIn }), ...(account.name ? { displayName: account.name } : {}), ...(account.email ? { email: account.email } : {}), data: { ...candidate.data, userId: account.id } } };
}

export const qoderOAuth: OAuthProvider = {
  flow: "device_code",
  background: false,
  async refresh(refreshToken, io, _currentApiKey, data = {}) {
    if (!TOKEN.test(refreshToken) || !IDENTIFIER.test(data.machineId ?? "") || !IDENTIFIER.test(data.userId ?? "") || data.clientId !== undefined && !IDENTIFIER.test(data.clientId)) throw qoderError("AUTH_ERROR", "QODER_AUTH_FAILED");
    const { root } = await qoderJson(io, { method: "POST", url: `${OPENAPI}/deviceToken/refresh`, headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify({ refresh_token: refreshToken, machine_id: data.machineId }), noReplay: true });
    const fresh = payload(root);
    if (qoderBusinessFailure(fresh)) throw qoderUpstreamError(200, fresh);
    const claimedIds = [identityId(fresh), identityId(root)];
    if (claimedIds.some((id) => id !== undefined && id !== data.userId)) throw qoderError("AUTH_ERROR", "QODER_ACCOUNT_MISMATCH");
    return tokens(fresh, { userId: data.userId, machineId: data.machineId, ...(data.clientId ? { clientId: data.clientId } : {}) }, refreshToken);
  },
};
