// Same-origin JSON client for the AIGate management API; the session cookie travels automatically.
// ponytail: responses are trusted as typed; add runtime schemas when packages/contracts exists.
const REQUEST_TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: Record<string, unknown>,
  ) {
    super(message);
  }
}

async function send(path: string, method: string, body: unknown): Promise<Response> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.ok) return response;
  const payload: unknown = await response.json().catch(() => ({}));
  const record = typeof payload === "object" && payload !== null ? Object.fromEntries(Object.entries(payload)) : {};
  const code = typeof record.code === "string" ? record.code : `HTTP_${response.status}`;
  const message = typeof record.message === "string" ? record.message : response.statusText || "Request failed";
  throw new ApiError(response.status, code, message, record);
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await send(path, init.method ?? "GET", init.body);
  const data: T = await response.json();
  return data;
}

// For 204 No Content responses.
export async function apiVoid(path: string, method: string): Promise<void> {
  await send(path, method, undefined);
}

export const isApiError = (error: unknown, code?: string): error is ApiError =>
  error instanceof ApiError && (code === undefined || error.code === code);
