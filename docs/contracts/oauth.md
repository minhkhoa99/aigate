# OAuth sign-in contract (M2 SP16)

Scope, per spec §9 (SP16, OAuth providers): the OAuth core (sign-in flow, token storage, refresh) and the providers the existing adapters can serve: **cline, clinepass, gitlab, kilocode, kimchi**. Next: SP16b claude, codex, github; SP16c gemini-cli, antigravity; SP16d grok-cli, kimi, codebuddy, iflow; later cursor, kiro, trae; qoder is not ported (SP14f).

**User decisions (2026-09-27).** Scope as above. Keep 9router's official-client headers for OAuth providers (the user accepts the terms-of-service risk); cline's headers name AIGate, as ClinePass's do since SP14g, because 9router names itself there. A fixed-port callback (codex, later) is finished by pasting the callback URL, with no extra listener. Kept from 9router, on the second ask: state and the PKCE verifier live in the browser and are sent back unchecked (gitlab's secret travels in the authorize query); refresh as 9router (proactive single-flight, reactive three attempts without the lock, even for connections that cannot refresh, and the 5-minute background loop), which overrides the spec's "single-flight on every path"; ClinePass offers the Cline sign-in although its API rejects those tokens (#2333); GitLab Duo is ported with its OpenAI-body chat to gitlab.com and no refresh.

## Matrix entries

| Entry | Label | AIGate |
|---|---|---|
| `oauth.dashboard-flow` | `REFERENCE_BEHAVIOR`, `SUSPECTED_BUG` kept | See "Sign-in API". |
| `oauth.token-storage` | `REFERENCE_BEHAVIOR` | See "Storage". |
| `oauth.refresh-lifecycle` | `REFERENCE_BEHAVIOR`, `SUSPECTED_BUG` kept | See "Refresh". |
| `account.concurrent-refresh-race` | `SUSPECTED_BUG` kept | Proactive refreshes are single-flight; reactive ones are not (as 9router). |
| `provider.cline-oauth` | `REFERENCE_BEHAVIOR`, `SUSPECTED_BUG` kept | See "Providers". |
| `provider.gitlab-duo-oauth` | `REFERENCE_BEHAVIOR`, `SUSPECTED_BUG` kept | See "Providers". |
| `provider.kilocode-device-auth` | `REFERENCE_BEHAVIOR` | See "Providers". |
| `provider.kimchi-browser-token` | `REFERENCE_BEHAVIOR` | See "Providers". |

## Sign-in API

Dashboard routes (session required, `Cache-Control: no-store`), errors `{ code, message }`:

- `GET /api/oauth/{provider}/authorize?redirect_uri=<url>[&meta…]` → `{ authUrl (null for a device flow), state, codeVerifier, codeChallenge, redirectUri (default http://localhost:8080/callback), flowType, callbackPath: "/callback" }`. A fresh PKCE pair (32 random bytes, S256) and a 32-byte state each time. Every other query parameter is provider meta (gitlab: `baseUrl`, `clientId`, `clientSecret`).
- `GET /api/oauth/{provider}/device-code` → the provider's `{ device_code, user_code, verification_uri, verification_uri_complete, expires_in, interval }` plus `codeVerifier`; 400 for a provider without a device flow.
- `POST /api/oauth/{provider}/exchange { code, redirectUri, codeVerifier, state, meta }` → `{ success: true, connection: { id, provider, email, displayName } }`. `code` and `redirectUri` are required, and `codeVerifier` except for cline, clinepass and kimchi. `state` is not checked (kept).
- `POST /api/oauth/{provider}/poll { deviceCode }` → `{ success: true, connection: { id, provider } }`, `{ success: false, error: "authorization_pending", pending: true }`, or `{ success: false, error, errorDescription, pending: false }` (access_denied, expired_token, poll_failed).
- Errors: 400 `PROVIDER_NOT_SUPPORTED` (no sign-in for that provider), 400 `INVALID_REQUEST` (missing fields, unknown step, a blank Kimchi token), 502 `OAUTH_FAILED` with the provider's words (at most 500 characters), 409 `ALREADY_CONNECTED`. Upstream calls go through the transport, 15 s each, 30 s per step.

`GET /api/providers` adds `signIn` (the flow, or null) and `signInOnly` (the catalog entry takes no API key).

## Storage

`provider_connections` (migration 0009, the first to rebuild the table; existing rows keep their values and become `api-key`):

- `auth_type` (`api-key` | `oauth`, default `api-key`), `refresh_token_sealed`, `expires_at`, `last_refresh_at`, `email`, `oauth_data` (the provider's sign-in data as a JSON object of strings, read and written whole).
- An oauth connection keeps its access token in `api_key_sealed`, sealed like a key (context `provider_connections:<id>:api_key`); the refresh token has its own context (`…:refresh_token`), so the two cannot be swapped. Views never return either; they add `authType`, `email`, `expiresAt`.
- A sign-in creates the provider's connection (name = display name, else email, else the provider name; test status `active`), or, when the provider already has an oauth connection for the same account (the same email, and the same username when either side has one), replaces its tokens. SP11 allows one connection per provider, so another account or an existing API-key connection is 409 `ALREADY_CONNECTED` (9router adds a second row; more accounts arrive in SP17).
- `POST /api/connections` with an API key is refused for a provider that takes none (cline, gitlab, kilocode): "… connects by signing in, not with an API key". `PATCH` with `apiKey` on an oauth connection is refused: sign in again instead.
- Kilo Code's organization is stored in `organization` and sent as `X-Kilocode-OrganizationID`.

## Refresh

- **Proactive**: before a chat request and before a connection test, a token that expires within 5 minutes is refreshed; refreshes of one connection share one in-flight promise; a failed refresh keeps the old token.
- **Reactive**: an upstream 401 or 403 before the first byte refreshes the connection (three attempts, 1 s then 2 s apart, through `withRetry`, without the lock), and the request is sent once more with the new token; otherwise the 401/403 reaches the client. As in 9router this runs for every connection, so a connection that cannot refresh (an API key, kilocode, kimchi, gitlab) waits the two pauses before the error. Other failures are not refreshed.
- **Background**: every 5 minutes, each active oauth connection with a refresh token that expires within 30 minutes is refreshed, one at a time (at most 100).
- A refresh stores the new access token, the new refresh token when one came back, the new expiry when one came back (else the old one stays), and `last_refresh_at`.

## Providers

- **cline / clinepass** (`authorization_code`): `https://api.cline.bot/api/v1/auth/authorize?client_type=extension&callback_url=<redirect>&redirect_uri=<redirect>`. The returned code is base64 JSON `{ accessToken, refreshToken, email, firstName, lastName, expiresAt }` (text after the last `}` ignored); otherwise `POST …/auth/token { grant_type: authorization_code, code, client_type: extension, redirect_uri }`. Expiry from `expiresAt`, else an hour. Refresh `POST …/auth/refresh { refreshToken, grantType: refresh_token, clientType: extension }`, the new token prefixed `workos:`. Requests send `Bearer workos:<jwt>` for a JWT token (a ClinePass API key as is) and the Cline headers naming AIGate. ClinePass OAuth tokens are rejected by its API (#2333, kept).
- **gitlab** (`authorization_code_pkce`): the operator's own GitLab application (`clientId`, optional `clientSecret`, `baseUrl` default https://gitlab.com), scope `api read_user`; exchange at `<baseUrl>/oauth/token`, user info from `/api/v4/user` (username, email, name in the data). No refresh. Chat is 9router's OpenAI body to `https://gitlab.com/api/v4/chat/completions`, whatever the instance (kept; 9router hides the provider, AIGate lists it).
- **kilocode** (`device_code`): `POST https://api.kilo.ai/api/device-auth/codes` (429 → `OAUTH_FAILED` "Too many pending authorization requests"); poll `GET …/codes/<code>` (403 denied, 410 expired, another non-2xx poll_failed, approved with a token → signed in, anything else pending); the organization from `/api/profile` (`organizations[0].id`, a failure ignored). No refresh.
- **kimchi** (`browser_token`): `https://app.kimchi.dev/cli-auth?callback=<redirect>&state=<state>` returns `?token=`; the token is checked with `GET https://api.cast.ai/v1/llm/openai/supported-providers` and named from `https://app.kimchi.dev/api/v1/me` (email, else `kimchi-user-<id>`). No refresh. Every Kimchi request (either sign-in) gets 9router's KimchiExecutor adjustments: a top-level `system` merged into the system message, Anthropic-only fields dropped, `cache_control`/`signature` removed, reasoning history longer than 8 characters removed, and for Claude models `reasoning_effort`/`reasoning` dropped (the model is matched by name only; 9router's model metadata cache is not ported).

## Dashboard

- The Add connection dialog shows the sign-in for a provider with `signIn`: a popup to the provider (the dashboard's `/callback` hands the code back by `postMessage` to this origin, or a `BroadcastChannel` when there is no opener), with a field to paste the callback URL or code when the popup cannot return (a remote dashboard); GitLab asks for its application first; a device flow shows the code, opens the approval page, and polls at the provider's interval until approved, refused or expired. A provider that also takes a key shows the key form below.
- Connections shows "Signed in as <email> · token until <time>" and a **Sign in again** action for oauth rows; errors reach the user through `shared/errors.ts` (`OAUTH_FAILED`, `ALREADY_CONNECTED` with the server's message).

## Other deviations

- `/api/oauth` errors use the dashboard shape `{ code, message }` with the codes above (9router answers `{ error }` with 400/500).
- The device code is URL-encoded in the poll path; a Kilo Code profile or Kimchi user read that fails is ignored, as in 9router.
