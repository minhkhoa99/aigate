import { EngineError } from "./errors.js";
import { readBoundedText } from "./http.js";
import { isRecord, parseJson, record, text } from "./json.js";
import type { ExecCtx, HttpTransportPort } from "./ports.js";

// OAuth sign-in and refresh for the SP16 and SP16b providers (docs/contracts/oauth.md). Kept as 9router has them (user decisions
// 2026-09-27): cline, clinepass (whose tokens the ClinePass API rejects, #2333), gitlab (PKCE with the operator's own
// app), kilocode (device code), kimchi (browser token). Every call goes through the transport port.

export type OAuthFlow = "authorization_code" | "authorization_code_pkce" | "device_code" | "browser_token";

export interface OAuthTokens {
  readonly accessToken: string;
  readonly refreshToken?: string;
  // Seconds from now; undefined when the provider gives no expiry.
  readonly expiresIn?: number;
  readonly email?: string;
  readonly displayName?: string;
  // The provider's own sign-in data (9router's providerSpecificData), strings only.
  readonly data: Readonly<Record<string, string>>;
}

export interface DeviceCode {
  readonly device_code: string;
  readonly user_code: string;
  readonly verification_uri: string;
  readonly verification_uri_complete: string;
  readonly expires_in: number;
  readonly interval: number;
}

export type PollResult =
  | { readonly status: "approved"; readonly tokens: OAuthTokens }
  | { readonly status: "pending" }
  | { readonly status: "error"; readonly error: string; readonly description?: string };

// Provider meta sent by the dashboard (gitlab: baseUrl, clientId, clientSecret).
export type OAuthMeta = Readonly<Record<string, string>>;

export interface OAuthIO {
  readonly transport: HttpTransportPort;
  readonly ctx: ExecCtx;
}

export interface OAuthProvider {
  readonly flow: OAuthFlow;
  authUrl?(redirectUri: string, state: string, codeChallenge: string, meta: OAuthMeta): string;
  exchange?(code: string, redirectUri: string, codeVerifier: string, meta: OAuthMeta, io: OAuthIO): Promise<OAuthTokens>;
  deviceCode?(io: OAuthIO): Promise<DeviceCode>;
  poll?(deviceCode: string, io: OAuthIO): Promise<PollResult>;
  // null when the provider refused the refresh.
  refresh?(refreshToken: string, io: OAuthIO): Promise<OAuthTokens | null>;
  // A callback the provider accepts only at this address (codex: its CLI's fixed port); the dashboard pastes it back.
  readonly fixedRedirect?: string;
  // How long before expiry a proactive refresh runs (5 minutes when unset), and the age of the last refresh that forces
  // one (9router's refreshLeadMs and maxRefreshAgeMs).
  readonly refreshLeadMs?: number;
  readonly maxRefreshAgeMs?: number;
}

const TIMEOUT_MS = 15_000;
const MAX_BODY = 64 * 1024;
const JSON_HEADERS = { "content-type": "application/json", accept: "application/json" };

const failed = (provider: string, message: string) => new EngineError("PROVIDER_UNAVAILABLE", message, { provider });

async function call(io: OAuthIO, method: "GET" | "POST", url: string, headers: Readonly<Record<string, string>>, body?: string): Promise<{ status: number; text: string; ok: boolean }> {
  const response = await io.transport.send({ method, url, headers, ...(body === undefined ? {} : { body }), timeoutMs: TIMEOUT_MS }, io.ctx);
  const raw = await readBoundedText(response.body, MAX_BODY);
  return { status: response.status, text: raw, ok: response.status >= 200 && response.status < 300 };
}

const strings = (value: Readonly<Record<string, unknown>>): Record<string, string> =>
  Object.fromEntries(Object.entries(value).flatMap(([key, item]) => (typeof item === "string" && item ? [[key, item]] : [])));

const secondsUntil = (iso: unknown): number | undefined => {
  const at = typeof iso === "string" || typeof iso === "number" ? new Date(iso).getTime() : NaN;
  return Number.isFinite(at) ? Math.floor((at - Date.now()) / 1000) : undefined;
};

const first = (value: unknown): unknown => (Array.isArray(value) ? value[0] : undefined);

// ---- PKCE (9router generatePKCE: 32 random bytes, S256, a 32-byte state) ----

const base64url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function generatePkce(): Promise<{ codeVerifier: string; codeChallenge: string; state: string }> {
  const codeVerifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier)));
  return { codeVerifier, codeChallenge: base64url(digest), state: base64url(crypto.getRandomValues(new Uint8Array(32))) };
}

// ---- cline and clinepass (provider.cline-oauth) ----

const CLINE_API = "https://api.cline.bot/api/v1/auth";

// The code is base64 JSON holding the tokens (atob accepts it unpadded); text after the last "}" is ignored.
function decodeClineCode(code: string): Record<string, unknown> | undefined {
  try {
    const binary = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
    const decoded = new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
    const parsed = parseJson(decoded.slice(0, decoded.lastIndexOf("}") + 1));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function clineTokens(value: Record<string, unknown>, email: unknown): OAuthTokens {
  const accessToken = text(value.accessToken);
  if (!accessToken) throw failed("cline", "Cline returned no access token");
  const refreshToken = text(value.refreshToken);
  const address = text(email);
  return {
    accessToken,
    ...(refreshToken ? { refreshToken } : {}),
    expiresIn: secondsUntil(value.expiresAt) ?? 3600,
    ...(address ? { email: address } : {}),
    data: strings({ firstName: value.firstName, lastName: value.lastName }),
  };
}

function cline(label: string): OAuthProvider {
  return {
    flow: "authorization_code",
    authUrl: (redirectUri) => `${CLINE_API}/authorize?${new URLSearchParams({ client_type: "extension", callback_url: redirectUri, redirect_uri: redirectUri }).toString()}`,
    async exchange(code, redirectUri, _verifier, _meta, io) {
      const decoded = decodeClineCode(code);
      if (decoded) return clineTokens(decoded, decoded.email);
      const answer = await call(io, "POST", `${CLINE_API}/token`, JSON_HEADERS,
        JSON.stringify({ grant_type: "authorization_code", code, client_type: "extension", redirect_uri: redirectUri }));
      if (!answer.ok) throw failed("cline", `${label} token exchange failed: ${answer.text}`);
      const root = record(parseJson(answer.text));
      const data = isRecord(root.data) ? root.data : {};
      return clineTokens({ accessToken: data.accessToken ?? root.accessToken, refreshToken: data.refreshToken ?? root.refreshToken, expiresAt: data.expiresAt ?? root.expiresAt },
        record(data.userInfo).email);
    },
    async refresh(refreshToken, io) {
      const answer = await call(io, "POST", `${CLINE_API}/refresh`, JSON_HEADERS, JSON.stringify({ refreshToken, grantType: "refresh_token", clientType: "extension" }));
      if (!answer.ok) return null;
      const payload = record(parseJson(answer.text));
      const data = isRecord(payload.data) ? payload.data : payload;
      const token = text(data.accessToken);
      if (!token) return null;
      const expiresIn = secondsUntil(data.expiresAt);
      return {
        accessToken: token.startsWith("workos:") ? token : `workos:${token}`,
        refreshToken: text(data.refreshToken) || refreshToken,
        ...(expiresIn !== undefined ? { expiresIn: Math.max(1, expiresIn) } : {}),
        data: {},
      };
    },
  };
}

// ---- gitlab (provider.gitlab-duo-oauth) ----

const gitlabBase = (meta: OAuthMeta) => meta.baseUrl || "https://gitlab.com";

const gitlab: OAuthProvider = {
  flow: "authorization_code_pkce",
  authUrl: (redirectUri, state, codeChallenge, meta) => `${gitlabBase(meta)}/oauth/authorize?${new URLSearchParams({
    client_id: meta.clientId ?? "", redirect_uri: redirectUri, response_type: "code", state, scope: "api read_user", code_challenge: codeChallenge, code_challenge_method: "S256",
  }).toString()}`,
  async exchange(code, redirectUri, codeVerifier, meta, io) {
    const base = gitlabBase(meta);
    const form = new URLSearchParams({ client_id: meta.clientId ?? "", grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: codeVerifier });
    if (meta.clientSecret) form.set("client_secret", meta.clientSecret);
    const answer = await call(io, "POST", `${base}/oauth/token`, { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, form.toString());
    if (!answer.ok) throw failed("gitlab", `GitLab token exchange failed: ${answer.text}`);
    const tokens = record(parseJson(answer.text));
    const accessToken = text(tokens.access_token);
    if (!accessToken) throw failed("gitlab", "GitLab returned no access token");
    const user = await call(io, "GET", `${base}/api/v4/user`, { authorization: `Bearer ${accessToken}` });
    const profile = user.ok ? record(parseJson(user.text)) : {};
    const refreshToken = text(tokens.refresh_token);
    const expiresIn = typeof tokens.expires_in === "number" ? tokens.expires_in : undefined;
    return {
      accessToken,
      ...(refreshToken ? { refreshToken } : {}),
      ...(expiresIn !== undefined ? { expiresIn } : {}),
      data: strings({
        username: profile.username, email: text(profile.email) || profile.public_email, name: profile.name, baseUrl: base, clientId: meta.clientId, authKind: "oauth", scope: tokens.scope,
      }),
    };
  },
  // 9router has no GitLab refresher (kept).
};

// ---- kilocode (provider.kilocode-device-auth) ----

const KILO = "https://api.kilo.ai";

const kilocode: OAuthProvider = {
  flow: "device_code",
  async deviceCode(io) {
    const answer = await call(io, "POST", `${KILO}/api/device-auth/codes`, { "content-type": "application/json" });
    if (answer.status === 429) throw new EngineError("RATE_LIMIT", "Too many pending authorization requests. Please try again later.", { provider: "kilocode" });
    if (!answer.ok) throw failed("kilocode", `Device auth initiation failed: ${answer.text}`);
    const data = record(parseJson(answer.text));
    const code = text(data.code);
    const url = text(data.verificationUrl);
    if (!code || !url) throw failed("kilocode", "Kilo Code returned no device code");
    return { device_code: code, user_code: code, verification_uri: url, verification_uri_complete: url, expires_in: typeof data.expiresIn === "number" ? data.expiresIn : 300, interval: 3 };
  },
  async poll(deviceCode, io) {
    const answer = await call(io, "GET", `${KILO}/api/device-auth/codes/${encodeURIComponent(deviceCode)}`, {});
    if (answer.status === 403) return { status: "error", error: "access_denied", description: "Authorization denied by user" };
    if (answer.status === 410) return { status: "error", error: "expired_token", description: "Authorization code expired" };
    // 202 (still pending) has no approved token either.
    if (!answer.ok) return { status: "error", error: "poll_failed", description: `Poll failed: ${answer.status}` };
    const data = record(parseJson(answer.text));
    const token = text(data.token);
    if (data.status !== "approved" || !token) return { status: "pending" };
    // The organization for X-Kilocode-OrganizationID; a failed profile read is ignored.
    let orgId: string | undefined;
    try {
      const profile = await call(io, "GET", `${KILO}/api/profile`, { authorization: `Bearer ${token}` });
      if (profile.ok) orgId = text(record(first(record(parseJson(profile.text)).organizations)).id);
    } catch {
      orgId = undefined;
    }
    const email = text(data.userEmail);
    return { status: "approved", tokens: { accessToken: token, ...(email ? { email } : {}), data: strings({ orgId }) } };
  },
};

// ---- kimchi (provider.kimchi-browser-token) ----

const kimchi: OAuthProvider = {
  flow: "browser_token",
  authUrl: (redirectUri, state) => `https://app.kimchi.dev/cli-auth?${new URLSearchParams({ callback: redirectUri, state }).toString()}`,
  async exchange(code, _redirectUri, _verifier, _meta, io) {
    const accessToken = code.trim();
    if (!accessToken) throw new EngineError("INVALID_REQUEST", "Missing Kimchi token", { param: "code" });
    const auth = { accept: "application/json", authorization: `Bearer ${accessToken}` };
    const check = await call(io, "GET", "https://api.cast.ai/v1/llm/openai/supported-providers", auth);
    if (!check.ok) throw new EngineError("AUTH_ERROR", `Kimchi token validation failed: ${check.status}`, { provider: "kimchi" });
    let user: Record<string, unknown> = {};
    try {
      const answer = await call(io, "GET", "https://app.kimchi.dev/api/v1/me", auth);
      if (answer.ok) user = record(parseJson(answer.text));
    } catch {
      user = {};
    }
    const userId = typeof user.id === "string" || typeof user.id === "number" ? String(user.id) : "";
    const username = text(user.username) ?? "";
    const email = text(user.email) || (userId ? `kimchi-user-${userId}` : undefined);
    const displayName = text(user.name) || username || undefined;
    return { accessToken, ...(email ? { email } : {}), ...(displayName ? { displayName } : {}), data: strings({ authMethod: "browser_token", userId, username }) };
  },
};

// ---- claude (provider.claude-oauth), kept as 9router has it (user decision 2026-09-27) ----

const CLAUDE_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const CLAUDE_TOKEN_URL = "https://api.anthropic.com/v1/oauth/token";
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

// The token response kept: no profile call, so no email (kept).
function claudeTokens(root: Record<string, unknown>, previousRefresh?: string): OAuthTokens | undefined {
  const accessToken = text(root.access_token);
  if (!accessToken) return undefined;
  const refreshToken = text(root.refresh_token) || previousRefresh;
  return {
    accessToken,
    ...(refreshToken ? { refreshToken } : {}),
    ...(typeof root.expires_in === "number" ? { expiresIn: root.expires_in } : {}),
    data: strings({ scope: root.scope }),
  };
}

const claude: OAuthProvider = {
  flow: "authorization_code_pkce",
  refreshLeadMs: 4 * HOUR_MS,
  authUrl: (redirectUri, state, codeChallenge) => `https://claude.ai/oauth/authorize?${new URLSearchParams({
    code: "true", client_id: CLAUDE_CLIENT_ID, response_type: "code", redirect_uri: redirectUri, scope: "org:create_api_key user:profile user:inference",
    code_challenge: codeChallenge, code_challenge_method: "S256", state,
  }).toString()}`,
  async exchange(code, redirectUri, codeVerifier, meta, io) {
    // The page shows "code#state"; the state after "#" wins over the one the dashboard sends back.
    const [authCode = "", codeState = ""] = code.split("#");
    const answer = await call(io, "POST", CLAUDE_TOKEN_URL, JSON_HEADERS, JSON.stringify({
      code: authCode, state: codeState || meta.state || "", grant_type: "authorization_code", client_id: CLAUDE_CLIENT_ID, redirect_uri: redirectUri, code_verifier: codeVerifier,
    }));
    if (!answer.ok) throw failed("claude", `Token exchange failed: ${answer.text}`);
    const tokens = claudeTokens(record(parseJson(answer.text)));
    if (!tokens) throw failed("claude", "Claude returned no access token");
    return tokens;
  },
  // Any failure is a refused refresh (null), as 9router has it (kept).
  async refresh(refreshToken, io) {
    const answer = await call(io, "POST", CLAUDE_TOKEN_URL, JSON_HEADERS, JSON.stringify({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: CLAUDE_CLIENT_ID }));
    return answer.ok ? claudeTokens(record(parseJson(answer.text)), refreshToken) ?? null : null;
  },
};

// ---- codex (provider.codex-oauth), kept as 9router has it (user decision 2026-09-27) ----

const CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const CODEX_TOKEN_URL = "https://auth.openai.com/oauth/token";
export const CODEX_REDIRECT = "http://localhost:1455/auth/callback";

// A JWT's payload, or an empty record (9router decodeJwtPayload).
function jwtPayload(token: unknown): Record<string, unknown> {
  const part = typeof token === "string" ? token.split(".")[1] : undefined;
  if (!part) return {};
  try {
    const binary = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return record(parseJson(new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))));
  } catch {
    return {};
  }
}

const codex: OAuthProvider = {
  flow: "authorization_code_pkce",
  fixedRedirect: CODEX_REDIRECT,
  refreshLeadMs: 5 * DAY_MS,
  maxRefreshAgeMs: 8 * DAY_MS,
  // encodeURIComponent, so the scope's spaces are %20.
  authUrl: (redirectUri, state, codeChallenge) => `https://auth.openai.com/oauth/authorize?${Object.entries({
    response_type: "code", client_id: CODEX_CLIENT_ID, redirect_uri: redirectUri, scope: "openid profile email offline_access", code_challenge: codeChallenge,
    code_challenge_method: "S256", id_token_add_organizations: "true", codex_cli_simplified_flow: "true", originator: "codex_cli_rs", state,
  }).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&")}`,
  async exchange(code, redirectUri, codeVerifier, _meta, io) {
    const form = new URLSearchParams({ grant_type: "authorization_code", client_id: CODEX_CLIENT_ID, code, redirect_uri: redirectUri, code_verifier: codeVerifier });
    const answer = await call(io, "POST", CODEX_TOKEN_URL, { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, form.toString());
    if (!answer.ok) throw failed("codex", `Token exchange failed: ${answer.text}`);
    const root = record(parseJson(answer.text));
    const accessToken = text(root.access_token);
    if (!accessToken) throw failed("codex", "Codex returned no access token");
    const id = jwtPayload(root.id_token);
    const auth = record(id["https://api.openai.com/auth"]);
    const access = jwtPayload(accessToken);
    const email = text(id.email) || text(access.email) || text(access.preferred_username) || text(access.sub);
    const refreshToken = text(root.refresh_token);
    return {
      accessToken,
      ...(refreshToken ? { refreshToken } : {}),
      ...(typeof root.expires_in === "number" ? { expiresIn: root.expires_in } : {}),
      ...(email ? { email } : {}),
      data: strings({ chatgptAccountId: text(auth.chatgpt_account_id) || id.account_id, chatgptPlanType: text(auth.chatgpt_plan_type) || id.plan_type }),
    };
  },
  // The refreshed id_token is not read, so the account id and plan stay as signed in (kept).
  async refresh(refreshToken, io) {
    const answer = await call(io, "POST", CODEX_TOKEN_URL, JSON_HEADERS, JSON.stringify({ client_id: CODEX_CLIENT_ID, grant_type: "refresh_token", refresh_token: refreshToken }));
    if (!answer.ok) return null;
    const root = record(parseJson(answer.text));
    const accessToken = text(root.access_token);
    if (!accessToken) return null;
    return {
      accessToken,
      refreshToken: text(root.refresh_token) || refreshToken,
      ...(typeof root.expires_in === "number" ? { expiresIn: root.expires_in } : {}),
      data: {},
    };
  },
};

export const OAUTH_PROVIDERS: Readonly<Record<string, OAuthProvider>> = { cline: cline("Cline"), clinepass: cline("ClinePass"), gitlab, kilocode, kimchi, claude, codex };

// Cline OAuth access tokens are WorkOS JWTs sent as "workos:<jwt>"; a ClinePass API key (not a JWT) goes as is.
// A token already prefixed does not start with "eyJ", so it passes as is.
export const clineAccessToken = (token: string): string => (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(token) ? `workos:${token}` : token);
