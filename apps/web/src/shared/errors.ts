import { ApiError } from "./api.ts";

// One table from error code to what the user should read and do (docs/design/API_UI_MAP.md,
// "Error handling"). Server codes come from docs/contracts/*.md; transport codes from shared/api.ts.
export type Problem = { code: string; message: string };

const MESSAGES: Record<string, string | ((body: Record<string, unknown>) => string | undefined)> = {
  NETWORK_ERROR: "Could not reach AIGate. Check that the server is running, then try again.",
  TIMEOUT: (body) => `AIGate did not answer within ${typeof body.timeoutSeconds === "number" ? body.timeoutSeconds : 10} seconds. Try again.`,
  BAD_RESPONSE: "AIGate returned a response the dashboard could not read. Refresh the page.",
  UNAUTHENTICATED: "Your session ended. Sign in again.",
  INVALID_CREDENTIALS: (body) => typeof body.remainingBeforeLock === "number"
    ? `The password did not match. ${body.remainingBeforeLock} attempt(s) left before a temporary lock.`
    : "The password did not match.",
  RATE_LIMITED: (body) => typeof body.retryAfter === "number"
    ? `Too many failed attempts. Try again in ${body.retryAfter}s.`
    : "Too many failed attempts. Wait a moment and try again.",
  NOT_LOCAL: "Set the first password on the machine running AIGate, or start AIGate with AIGATE_INITIAL_PASSWORD.",
  ALREADY_SET_UP: "A dashboard password already exists. Sign in instead.",
  SETUP_REQUIRED: "Set a dashboard password first.",
  LIMIT_REACHED: "You have reached the maximum of 100 API keys. Revoke one you no longer use.",
  NOT_FOUND: "That item no longer exists. The list was refreshed.",
  // docs/contracts/connections.md. The server message gives the catalog reason.
  PROVIDER_NOT_SUPPORTED: (body) => typeof body.message === "string" ? body.message : "This provider cannot be connected yet.",
  ALREADY_CONNECTED: "This provider is already connected. Use Replace key on its row instead.",
  CREDENTIAL_UNREADABLE: "The saved key can no longer be decrypted, because the secret key file changed. Use Replace key to enter it again.",
  // docs/contracts/custom-providers.md. The server message names the prefix.
  PREFIX_RESERVED: (body) => typeof body.message === "string" ? body.message : "That prefix belongs to a built-in provider. Choose another prefix.",
  PREFIX_TAKEN: (body) => typeof body.message === "string" ? body.message : "Another custom provider already uses that prefix.",
  NODE_LIMIT: "You have reached the maximum of 100 custom providers. Delete one you no longer use.",
};

export function toProblem(error: unknown): Problem {
  if (!(error instanceof ApiError)) return { code: "UNEXPECTED", message: "Something went wrong in the dashboard. Refresh the page." };
  const entry = MESSAGES[error.code];
  const message = typeof entry === "function" ? entry(error.body) : entry;
  if (message) return { code: error.code, message };
  // Validation messages from the server name the exact field, so they are shown as they are.
  if (error.code === "INVALID_REQUEST") return { code: error.code, message: error.message };
  if (error.status >= 500) return { code: error.code, message: `AIGate hit an unexpected error (HTTP ${error.status}). Try again; if it keeps happening, check the server log.` };
  return { code: error.code, message: error.message || `Request failed (HTTP ${error.status}).` };
}
