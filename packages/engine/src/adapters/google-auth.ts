import { EngineError } from "../errors.js";
import { readBoundedText } from "../http.js";
import { isRecord, parseJson, record, text } from "../json.js";
import type { ExecCtx, HttpTransportPort } from "../ports.js";
import { count, METADATA_TIMEOUT_MS } from "./http-adapter.js";

// provider.vertex-google-auth (docs/contracts/provider-vertex.md): the one apiKey field holds a service-account JSON,
// an authorized_user JSON, or an API key. Corrected by user decision (2026-09-26): tokens are cached per credential,
// until expiry for both JSON kinds, and a caller can force a new one after a 401.

export type GoogleCredential =
  | { readonly kind: "service-account"; readonly clientEmail: string; readonly privateKey: string; readonly projectId: string }
  | { readonly kind: "authorized-user"; readonly clientId: string; readonly clientSecret: string; readonly refreshToken: string; readonly projectId: string }
  | { readonly kind: "api-key"; readonly key: string };

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const JWT_GRANT = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const TOKEN_LIFETIME_S = 3_600;
// 9router reuses a token while more than 5 minutes remain.
const EARLY_REFRESH_MS = 5 * 60_000;
const MAX_TOKENS = 256;
const TOKEN_BODY_BYTES = 64 * 1024;
const MAX_REASON_CHARS = 300;

// A JSON credential is recognised by its type; anything that is not JSON is an API key.
export function parseGoogleCredential(raw: string): GoogleCredential | { readonly error: string } {
  if (!raw.startsWith("{")) return { kind: "api-key", key: raw };
  const json = parseJson(raw);
  if (!isRecord(json)) return { error: "it starts with { but is not a JSON object" };
  const field = (name: string) => text(json[name]);
  if (json.type === "service_account") {
    const [clientEmail, privateKey, projectId] = [field("client_email"), field("private_key"), field("project_id")];
    if (!clientEmail || !privateKey || !projectId) return { error: "a service_account JSON needs client_email, private_key, and project_id" };
    return { kind: "service-account", clientEmail, privateKey, projectId };
  }
  if (json.type === "authorized_user") {
    const [clientId, clientSecret, refreshToken, projectId] = [field("client_id"), field("client_secret"), field("refresh_token"), field("quota_project_id")];
    if (!clientId || !clientSecret || !refreshToken || !projectId) {
      return { error: "an authorized_user JSON needs client_id, client_secret, refresh_token, and quota_project_id" };
    }
    return { kind: "authorized-user", clientId, clientSecret, refreshToken, projectId };
  }
  return { error: "the JSON type must be service_account or authorized_user" };
}

const b64url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const jsonPart = (value: unknown): string => b64url(new TextEncoder().encode(JSON.stringify(value)));

async function signedAssertion(credential: Extract<GoogleCredential, { kind: "service-account" }>, providerId: string): Promise<string> {
  // 9router: a pasted key may carry literal \n sequences instead of line breaks.
  const pem = credential.privateKey.replace(/\\n/g, "\n").replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  let key: CryptoKey;
  try {
    const der = Uint8Array.from(atob(pem), (char) => char.charCodeAt(0));
    key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  } catch {
    throw new EngineError("AUTH_ERROR", "The service-account private_key is not a PKCS#8 RSA private key", { provider: providerId });
  }
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${jsonPart({ alg: "RS256", typ: "JWT" })}.${jsonPart({ iss: credential.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + TOKEN_LIFETIME_S })}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64url(new Uint8Array(signature))}`;
}

// ponytail: no in-flight dedup, as in 9router; concurrent first requests may each mint a token. Share the promise if
// the token endpoint ever rate-limits AIGate.
const tokens = new Map<string, { token: string; expiresAt: number }>();

async function cacheKey(raw: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function remember(key: string, token: string, expiresAt: number): void {
  const now = Date.now();
  for (const [other, entry] of tokens) if (entry.expiresAt <= now) tokens.delete(other);
  tokens.set(key, { token, expiresAt });
  while (tokens.size > MAX_TOKENS) {
    const oldest = tokens.keys().next().value;
    if (oldest === undefined) break;
    tokens.delete(oldest);
  }
}

// An access token for a JSON credential; `fresh` drops the cached one first (after an upstream 401, or a connection test).
export async function googleAccessToken(
  credential: Exclude<GoogleCredential, { kind: "api-key" }>, raw: string, transport: HttpTransportPort, ctx: ExecCtx, providerId: string, fresh = false,
): Promise<string> {
  const key = await cacheKey(raw);
  const cached = tokens.get(key);
  if (!fresh && cached && cached.expiresAt - Date.now() > EARLY_REFRESH_MS) return cached.token;
  tokens.delete(key);
  const form = credential.kind === "service-account"
    ? new URLSearchParams({ grant_type: JWT_GRANT, assertion: await signedAssertion(credential, providerId) })
    : new URLSearchParams({ grant_type: "refresh_token", client_id: credential.clientId, client_secret: credential.clientSecret, refresh_token: credential.refreshToken });
  const response = await transport.send({
    method: "POST", url: TOKEN_URL, headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body: form.toString(), timeoutMs: METADATA_TIMEOUT_MS,
  }, ctx);
  const body = record(parseJson(await readBoundedText(response.body, TOKEN_BODY_BYTES)));
  const token = text(body.access_token);
  if (response.status >= 200 && response.status < 300 && token) {
    remember(key, token, Date.now() + (count(body.expires_in) || TOKEN_LIFETIME_S) * 1000);
    return token;
  }
  const reason = [text(body.error), text(body.error_description)].filter(Boolean).join(": ").slice(0, MAX_REASON_CHARS);
  const what = credential.kind === "service-account" ? "service-account key" : "authorized_user credential";
  const message = `Google's token endpoint answered ${response.status} for the ${what}${reason ? `: ${reason}` : ""}`;
  // 400 invalid_grant / invalid_client and 401 are answers about the credential; anything else is Google being unavailable.
  const code = response.status === 400 || response.status === 401 || response.status === 403 ? "AUTH_ERROR" : "PROVIDER_UNAVAILABLE";
  throw new EngineError(code, message, { provider: providerId, status: response.status });
}
