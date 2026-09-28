import { EngineError } from "./errors.js";
import { readBoundedText } from "./http.js";
import { isRecord, parseJson, record, text } from "./json.js";
import type { CredentialStatus, ExecCtx, HttpTransportPort } from "./ports.js";
import { cloudCodeCall, codeAssistMetadata, defaultTier, projectOf } from "./adapters/cloud-code.js";
import { withRetry } from "./retry.js";

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
  | { readonly status: "pending"; readonly slowDown?: boolean }
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
  // false: the 5-minute background loop leaves this provider alone (github: the Copilot token is short-lived).
  readonly background?: boolean;
  // A provider-specific connection test on the refresh token (github: GET /user with the GitHub token).
  test?(refreshToken: string, io: OAuthIO): Promise<CredentialStatus>;
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

// ---- github (provider.github-copilot-oauth), kept as 9router has it (user decision 2026-09-27: keep 9router) ----

const GITHUB_CLIENT_ID = "Iv1.b507a08c87ecfe98";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const COPILOT_TOKEN_URL = "https://api.github.com/copilot_internal/v2/token";
const FORM_HEADERS = { "content-type": "application/x-www-form-urlencoded", accept: "application/json" };
// The sign-in reads the Copilot token and the user as 9router's postExchange; later refreshes use its executor's headers.
const SIGN_IN_HEADERS = { accept: "application/json", "x-github-api-version": "2022-11-28", "user-agent": "GitHubCopilotChat/0.26.7" };
const REFRESH_HEADERS = {
  "user-agent": "GitHubCopilotChat/0.38.0", "editor-version": "vscode/1.110.0", "editor-plugin-version": "copilot-chat/0.38.0", accept: "application/json", "x-github-api-version": "2025-04-01",
};

// AIGate seals the Copilot token as the connection's access token and the GitHub token (with GitHub's own refresh token,
// when it sends one) as its refresh token, so every token stays encrypted (9router keeps them in plain connection data).
const packGithub = (github: string, refresh?: string): string => JSON.stringify({ github, ...(refresh ? { refresh } : {}) });
function unpackGithub(value: string): { github: string; refresh?: string } {
  const parsed = record(parseJson(value));
  const github = text(parsed.github);
  const refresh = text(parsed.refresh);
  return github ? { github, ...(refresh ? { refresh } : {}) } : { github: value };
}

// Copilot's expires_at is unix seconds (milliseconds and ISO strings are read too, as 9router does).
function secondsFrom(expiresAt: unknown): number | undefined {
  if (typeof expiresAt === "number") return Math.floor(((expiresAt < 1e12 ? expiresAt * 1000 : expiresAt) - Date.now()) / 1000);
  return secondsUntil(expiresAt);
}

async function copilotToken(io: OAuthIO, headers: Readonly<Record<string, string>>): Promise<{ token: string; expiresIn?: number } | undefined> {
  const answer = await call(io, "GET", COPILOT_TOKEN_URL, headers);
  if (!answer.ok) return undefined;
  const data = record(parseJson(answer.text));
  const token = text(data.token);
  const expiresIn = secondsFrom(data.expires_at);
  return token ? { token, ...(expiresIn !== undefined ? { expiresIn } : {}) } : undefined;
}

// 9router's postExchange: a failed Copilot or user read is ignored, so the GitHub token itself becomes the access token.
async function githubTokens(root: Record<string, unknown>, github: string, io: OAuthIO): Promise<OAuthTokens> {
  const read = async (url: string) => {
    try {
      const answer = await call(io, "GET", url, { ...SIGN_IN_HEADERS, authorization: `Bearer ${github}` });
      return answer.ok ? record(parseJson(answer.text)) : {};
    } catch {
      return {};
    }
  };
  const copilot = await read(COPILOT_TOKEN_URL);
  const user = await read("https://api.github.com/user");
  const token = text(copilot.token);
  const expiresIn = token ? secondsFrom(copilot.expires_at) : typeof root.expires_in === "number" ? root.expires_in : undefined;
  const email = text(user.email);
  const displayName = text(user.login) || text(user.name);
  return {
    accessToken: token ?? github,
    refreshToken: packGithub(github, text(root.refresh_token)),
    ...(expiresIn !== undefined ? { expiresIn } : {}),
    ...(email ? { email } : {}),
    ...(displayName ? { displayName } : {}),
    data: strings({ githubUserId: user.id === undefined ? undefined : String(user.id), githubLogin: user.login, githubName: user.name, githubEmail: user.email }),
  };
}

const github: OAuthProvider = {
  flow: "device_code",
  // The Copilot token lives about 30 minutes; the background loop leaves it to the proactive and reactive refreshes.
  background: false,
  async deviceCode(io) {
    const answer = await call(io, "POST", "https://github.com/login/device/code", FORM_HEADERS, new URLSearchParams({ client_id: GITHUB_CLIENT_ID, scope: "read:user" }).toString());
    if (!answer.ok) throw failed("github", `Device code request failed: ${answer.text}`);
    const data = record(parseJson(answer.text));
    const deviceCode = text(data.device_code);
    const userCode = text(data.user_code);
    const uri = text(data.verification_uri);
    if (!deviceCode || !userCode || !uri) throw failed("github", "GitHub returned no device code");
    return {
      device_code: deviceCode, user_code: userCode, verification_uri: uri, verification_uri_complete: text(data.verification_uri_complete) ?? uri,
      expires_in: typeof data.expires_in === "number" ? data.expires_in : 900, interval: typeof data.interval === "number" ? data.interval : 5,
    };
  },
  async poll(deviceCode, io) {
    const answer = await call(io, "POST", GITHUB_TOKEN_URL, FORM_HEADERS,
      new URLSearchParams({ client_id: GITHUB_CLIENT_ID, device_code: deviceCode, grant_type: "urn:ietf:params:oauth:grant-type:device_code" }).toString());
    const root = parseJson(answer.text);
    if (!isRecord(root)) throw failed("github", `GitHub answered ${answer.status}: ${answer.text.slice(0, 200)}`);
    const token = text(root.access_token);
    if (token) return { status: "approved", tokens: await githubTokens(root, token, io) };
    const error = text(root.error) ?? "poll_failed";
    if (error === "authorization_pending") return { status: "pending" };
    if (error === "slow_down") return { status: "pending", slowDown: true };
    const description = text(root.error_description);
    return { status: "error", error, ...(description ? { description } : {}) };
  },
  // 9router refreshCredentials: a new Copilot token from the GitHub token; when that fails, GitHub's refresh token (if
  // any) renews the GitHub token first.
  async refresh(packed, io) {
    const { github: token, refresh } = unpackGithub(packed);
    const copilot = await copilotToken(io, { ...REFRESH_HEADERS, authorization: `token ${token}` });
    if (copilot) return { accessToken: copilot.token, refreshToken: packed, ...(copilot.expiresIn !== undefined ? { expiresIn: copilot.expiresIn } : {}), data: {} };
    if (!refresh) return null;
    const answer = await call(io, "POST", GITHUB_TOKEN_URL, FORM_HEADERS, new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh, client_id: GITHUB_CLIENT_ID }).toString());
    const renewed = answer.ok ? record(parseJson(answer.text)) : {};
    const next = text(renewed.access_token);
    if (!next) return null;
    const repacked = packGithub(next, text(renewed.refresh_token) || refresh);
    const fresh = await copilotToken(io, { ...REFRESH_HEADERS, authorization: `token ${next}` });
    if (fresh) return { accessToken: fresh.token, refreshToken: repacked, ...(fresh.expiresIn !== undefined ? { expiresIn: fresh.expiresIn } : {}), data: {} };
    // No Copilot token: the renewed GitHub token is sent as the bearer, as 9router falls back to it.
    return { accessToken: next, refreshToken: repacked, ...(typeof renewed.expires_in === "number" ? { expiresIn: renewed.expires_in } : {}), data: {} };
  },
  // 9router's test: GET /user with the GitHub token (its User-Agent names 9Router; AIGate names itself).
  async test(packed, io) {
    const answer = await call(io, "GET", "https://api.github.com/user", { authorization: `Bearer ${unpackGithub(packed).github}`, "user-agent": "AIGate", accept: "application/vnd.github+json" });
    if (answer.ok) return { valid: true };
    const message = answer.status === 401 ? "Token invalid or revoked" : answer.status === 403 ? "Access denied" : `API returned ${answer.status}`;
    return { valid: false, code: answer.status === 401 || answer.status === 403 ? "AUTH_ERROR" : "PROVIDER_UNAVAILABLE", message };
  },
};

// ---- Google Cloud Code sign-ins (provider.gemini-cli-oauth), kept as 9router has them (user decision 2026-09-27) ----

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v1/userinfo?alt=json";
const GOOGLE_SCOPES = ["cloud-platform", "userinfo.email", "userinfo.profile"].map((scope) => `https://www.googleapis.com/auth/${scope}`);
const ANTIGRAVITY_SCOPES = [...GOOGLE_SCOPES, "https://www.googleapis.com/auth/cclog", "https://www.googleapis.com/auth/experimentsandconfigs"];

// The public OAuth client of the CLI or IDE AIGate signs in as. 9router ships both in its source; AIGate reads them from
// the environment (.env, see .env.example) so that no client secret is in the repository, and checks them on each use.
interface GoogleClient { readonly id: string; readonly secret: string; readonly scopes: readonly string[] }
export const GOOGLE_CLIENT_ENV: Readonly<Record<string, { readonly id: string; readonly secret: string }>> = {
  "gemini-cli": { id: "AIGATE_GEMINI_CLI_OAUTH_CLIENT_ID", secret: "AIGATE_GEMINI_CLI_OAUTH_CLIENT_SECRET" },
  antigravity: { id: "AIGATE_ANTIGRAVITY_OAUTH_CLIENT_ID", secret: "AIGATE_ANTIGRAVITY_OAUTH_CLIENT_SECRET" },
};
// After the exchange: the account's email and its Cloud Code project, both optional.
type GoogleAccount = (accessToken: string, io: OAuthIO) => Promise<{ email?: string; projectId?: string }>;

function googleClient(provider: string, label: string, scopes: readonly string[]): GoogleClient {
  const names = GOOGLE_CLIENT_ENV[provider];
  const id = names ? process.env[names.id]?.trim() : undefined;
  const secret = names ? process.env[names.secret]?.trim() : undefined;
  if (!names || !id || !secret) {
    throw new EngineError("INVALID_REQUEST", `${label} sign-in needs ${names?.id ?? "its client id"} and ${names?.secret ?? "its client secret"} in AIGate's .env (see .env.example), then a restart`, { provider });
  }
  return { id, secret, scopes };
}

function googleSignIn(provider: string, label: string, scopes: readonly string[], account: GoogleAccount): OAuthProvider {
  const current = () => googleClient(provider, label, scopes);
  return {
    flow: "authorization_code",
    authUrl: (redirectUri, state) => {
      const client = current();
      return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: client.id, response_type: "code", redirect_uri: redirectUri, scope: client.scopes.join(" "), state, access_type: "offline", prompt: "consent",
      }).toString()}`;
    },
    async exchange(code, redirectUri, _verifier, _meta, io) {
      const client = current();
      const answer = await call(io, "POST", GOOGLE_TOKEN_URL, FORM_HEADERS,
        new URLSearchParams({ grant_type: "authorization_code", client_id: client.id, client_secret: client.secret, code, redirect_uri: redirectUri }).toString());
      if (!answer.ok) throw failed(provider, `Token exchange failed: ${answer.text}`);
      const root = record(parseJson(answer.text));
      const accessToken = text(root.access_token);
      if (!accessToken) throw failed(provider, `${label} returned no access token`);
      // The connection is saved even when no project was found (kept); requests then look it up again.
      const { email, projectId } = await account(accessToken, io);
      const refreshToken = text(root.refresh_token);
      return {
        accessToken,
        ...(refreshToken ? { refreshToken } : {}),
        ...(typeof root.expires_in === "number" ? { expiresIn: root.expires_in } : {}),
        ...(email ? { email } : {}),
        data: strings({ scope: root.scope, projectId }),
      };
    },
    // The project stays as signed in; any failure is a refused refresh.
    async refresh(refreshToken, io) {
      const client = current();
      const answer = await call(io, "POST", GOOGLE_TOKEN_URL, FORM_HEADERS,
        new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: client.id, client_secret: client.secret }).toString());
      if (!answer.ok) return null;
      const root = record(parseJson(answer.text));
      const accessToken = text(root.access_token);
      if (!accessToken) return null;
      return { accessToken, refreshToken: text(root.refresh_token) || refreshToken, ...(typeof root.expires_in === "number" ? { expiresIn: root.expires_in } : {}), data: {} };
    },
  };
}

// gemini-cli's postExchange: userinfo, then loadCodeAssist { metadata, mode: 1 } with no client headers; a failed
// lookup leaves the project empty.
const geminiCliAccount: GoogleAccount = async (token, io) => {
  const user = await call(io, "GET", GOOGLE_USERINFO_URL, { authorization: `Bearer ${token}` });
  const email = user.ok ? text(record(parseJson(user.text)).email) : undefined;
  let projectId: string | undefined;
  try {
    const answer = await cloudCodeCall(io.transport, io.ctx, "loadCodeAssist", { authorization: `Bearer ${token}`, "content-type": "application/json" }, { metadata: codeAssistMetadata(), mode: 1 });
    projectId = answer.ok ? projectOf(parseJson(answer.raw)) : undefined;
  } catch {
    projectId = undefined;
  }
  return { ...(email ? { email } : {}), ...(projectId ? { projectId } : {}) };
};

const geminiCli = googleSignIn("gemini-cli", "Gemini CLI", GOOGLE_SCOPES, geminiCliAccount);
const antigravity = googleSignIn("antigravity", "Antigravity", ANTIGRAVITY_SCOPES, async (token, io) => {
  const user = await call(io, "GET", GOOGLE_USERINFO_URL, { authorization: `Bearer ${token}`, "x-request-source": "local" });
  const email = user.ok ? text(record(parseJson(user.text)).email) : undefined;
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json", "user-agent": "antigravity/ide/2.11.0 darwin/arm64", "x-request-source": "local" };
  let projectId: string | undefined;
  let tierId = "legacy-tier";
  try {
    const answer = await cloudCodeCall(io.transport, io.ctx, "loadCodeAssist", headers, { metadata: codeAssistMetadata() });
    if (answer.ok) {
      const value = parseJson(answer.raw);
      projectId = projectOf(value);
      tierId = defaultTier(value);
    }
  } catch {
    projectId = undefined;
  }
  if (projectId) void onboardAntigravity(token, tierId, io.transport);
  return { ...(email ? { email } : {}), ...(projectId ? { projectId } : {}) };
});

async function onboardAntigravity(token: string, tierId: string, transport: HttpTransportPort): Promise<void> {
  const ctx = { signal: AbortSignal.timeout(60_000), requestId: crypto.randomUUID() };
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json", "user-agent": "antigravity/ide/2.11.0 darwin/arm64", "x-request-source": "local" };
  await withRetry(async () => {
    const answer = await cloudCodeCall(transport, ctx, "onboardUser", headers, { tierId, metadata: codeAssistMetadata() });
    if (!answer.ok || record(parseJson(answer.raw)).done !== true) throw new Error("onboardUser is not done");
  }, { signal: ctx.signal, maxAttempts: 10, baseDelayMs: 5_000, maxDelayMs: 5_000, shouldRetry: () => true }).catch(() => undefined);
}

export const OAUTH_PROVIDERS: Readonly<Record<string, OAuthProvider>> = {
  cline: cline("Cline"), clinepass: cline("ClinePass"), gitlab, kilocode, kimchi, claude, codex, github, "gemini-cli": geminiCli, antigravity,
};

// Cline OAuth access tokens are WorkOS JWTs sent as "workos:<jwt>"; a ClinePass API key (not a JWT) goes as is.
// A token already prefixed does not start with "eyJ", so it passes as is.
export const clineAccessToken = (token: string): string => (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(token) ? `workos:${token}` : token);
