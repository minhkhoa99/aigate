// Same-origin JSON client for the AIGate management API; the session cookie travels automatically.
// Every failure becomes an ApiError with a stable code, so screens and toasts never guess
// (messages: shared/errors.ts). ponytail: responses are trusted as typed; add runtime schemas
// when packages/contracts exists.
const REQUEST_TIMEOUT_MS = 10_000;

// Fired when a protected call finds the session gone; the shell sends the user to sign in.
export const SESSION_ENDED_EVENT = "aigate:session-ended";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: Record<string, unknown>;

  constructor(status: number, code: string, message: string, body: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

async function send(path: string, method: string, body: unknown, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ApiError(0, "TIMEOUT", `AIGate did not answer within ${timeoutMs / 1000} seconds.`, { timeoutSeconds: timeoutMs / 1000 });
    }
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach AIGate.");
  }
  if (response.ok) return response;
  const payload: unknown = await response.json().catch(() => ({}));
  const record = typeof payload === "object" && payload !== null ? Object.fromEntries(Object.entries(payload)) : {};
  const code = typeof record.code === "string" ? record.code : `HTTP_${response.status}`;
  const message = typeof record.message === "string" ? record.message : response.statusText || "Request failed";
  if (code === "UNAUTHENTICATED" && typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
  throw new ApiError(response.status, code, message, record);
}

// timeoutMs: only for calls the server itself bounds longer, such as a connection test.
export async function api<T>(path: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const response = await send(path, init.method ?? "GET", init.body, init.timeoutMs);
  try {
    const data: T = await response.json();
    return data;
  } catch {
    throw new ApiError(response.status, "BAD_RESPONSE", "AIGate returned a response the dashboard could not read.");
  }
}

// For 204 No Content responses.
export async function apiVoid(path: string, method: string): Promise<void> {
  await send(path, method, undefined);
}

export const isApiError = (error: unknown, code?: string): error is ApiError =>
  error instanceof ApiError && (code === undefined || error.code === code);
