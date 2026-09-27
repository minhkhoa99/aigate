# OAuth sign-in contract (M2 SP16, SP16b)

Scope, per spec §9 (SP16, OAuth providers): the OAuth core (sign-in flow, token storage, refresh) and the providers the existing adapters can serve: **cline, clinepass, gitlab, kilocode, kimchi**; SP16b adds **claude** and **codex**. Next: SP16b2 github; SP16c gemini-cli, antigravity; SP16d grok-cli, kimi, codebuddy, iflow; later cursor, kiro, trae; qoder is not ported (SP14f).

**User decisions (2026-09-27).** Scope as above. Keep 9router's official-client headers for OAuth providers (the user accepts the terms-of-service risk); cline's headers name AIGate, as ClinePass's do since SP14g, because 9router names itself there. A fixed-port callback (codex, later) is finished by pasting the callback URL, with no extra listener. Kept from 9router, on the second ask: state and the PKCE verifier live in the browser and are sent back unchecked (gitlab's secret travels in the authorize query); refresh as 9router (proactive single-flight, reactive three attempts without the lock, even for connections that cannot refresh, and the 5-minute background loop), which overrides the spec's "single-flight on every path"; ClinePass offers the Cline sign-in although its API rejects those tokens (#2333); GitLab Duo is ported with its OpenAI-body chat to gitlab.com and no refresh.

**User decisions for SP16b (2026-09-27).** claude and codex now, github next (SP16b2). claude keeps 9router's full cloaking for OAuth tokens (billing header, invented user id, tool renaming with decoys, the Claude Code prompt for non-Claude clients). Kept from 9router on every suspected bug: the claude model list sends the OAuth token as x-api-key, the claude test only reads the expiry, a failed claude refresh is just refused, no claude email, 9router's cache marks replace the client's for claude; codex's compaction URL follows the previous request, a failed refresh during the codex test behaves as 9router's (a 401 from the old token), the account id and plan are not reread after a refresh, and the codex model list names client version 0.144.6 without the account id.

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
| `provider.claude-oauth` | `REFERENCE_BEHAVIOR`, `SUSPECTED_BUG` kept | See "claude". |
| `translator.claude-oauth-cloaking` | `REFERENCE_BEHAVIOR` | See "claude". |
| `provider.codex-oauth` | `REFERENCE_BEHAVIOR`, `SUSPECTED_BUG` kept | See "codex". |

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

- **Proactive**: before a chat request and before a connection test, a token that expires within the provider's lead (5 minutes; claude 4 hours; codex 5 days) is refreshed, and so is a codex token whose last refresh (or sign-in) is more than 8 days old; refreshes of one connection share one in-flight promise; a failed refresh keeps the old token.
- **Reactive**: an upstream 401 or 403 before the first byte refreshes the connection (three attempts, 1 s then 2 s apart, through `withRetry`, without the lock), and the request is sent once more with the new token; otherwise the 401/403 reaches the client. As in 9router this runs for every connection, so a connection that cannot refresh (an API key, kilocode, kimchi, gitlab) waits the two pauses before the error. Other failures are not refreshed.
- **Background**: every 5 minutes, each active oauth connection with a refresh token that expires within 30 minutes is refreshed, one at a time (at most 100).
- A refresh stores the new access token, the new refresh token when one came back, the new expiry when one came back (else the old one stays), and `last_refresh_at`.

## Providers

- **cline / clinepass** (`authorization_code`): `https://api.cline.bot/api/v1/auth/authorize?client_type=extension&callback_url=<redirect>&redirect_uri=<redirect>`. The returned code is base64 JSON `{ accessToken, refreshToken, email, firstName, lastName, expiresAt }` (text after the last `}` ignored); otherwise `POST …/auth/token { grant_type: authorization_code, code, client_type: extension, redirect_uri }`. Expiry from `expiresAt`, else an hour. Refresh `POST …/auth/refresh { refreshToken, grantType: refresh_token, clientType: extension }`, the new token prefixed `workos:`. Requests send `Bearer workos:<jwt>` for a JWT token (a ClinePass API key as is) and the Cline headers naming AIGate. ClinePass OAuth tokens are rejected by its API (#2333, kept).
- **gitlab** (`authorization_code_pkce`): the operator's own GitLab application (`clientId`, optional `clientSecret`, `baseUrl` default https://gitlab.com), scope `api read_user`; exchange at `<baseUrl>/oauth/token`, user info from `/api/v4/user` (username, email, name in the data). No refresh. Chat is 9router's OpenAI body to `https://gitlab.com/api/v4/chat/completions`, whatever the instance (kept; 9router hides the provider, AIGate lists it).
- **kilocode** (`device_code`): `POST https://api.kilo.ai/api/device-auth/codes` (429 → `OAUTH_FAILED` "Too many pending authorization requests"); poll `GET …/codes/<code>` (403 denied, 410 expired, another non-2xx poll_failed, approved with a token → signed in, anything else pending); the organization from `/api/profile` (`organizations[0].id`, a failure ignored). No refresh.
- **kimchi** (`browser_token`): `https://app.kimchi.dev/cli-auth?callback=<redirect>&state=<state>` returns `?token=`; the token is checked with `GET https://api.cast.ai/v1/llm/openai/supported-providers` and named from `https://app.kimchi.dev/api/v1/me` (email, else `kimchi-user-<id>`). No refresh. Every Kimchi request (either sign-in) gets 9router's KimchiExecutor adjustments: a top-level `system` merged into the system message, Anthropic-only fields dropped, `cache_control`/`signature` removed, reasoning history longer than 8 characters removed, and for Claude models `reasoning_effort`/`reasoning` dropped (the model is matched by name only; 9router's model metadata cache is not ported).

## claude (SP16b)

- **Sign-in** (`authorization_code_pkce`): `https://claude.ai/oauth/authorize?code=true&client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e&response_type=code&redirect_uri&scope=org:create_api_key user:profile user:inference&code_challenge&code_challenge_method=S256&state` (URLSearchParams). The pasted code may be `code#state`; the state after `#` wins over the one the dashboard sends back. Exchange `POST https://api.anthropic.com/v1/oauth/token` JSON `{ code, state, grant_type, client_id, redirect_uri, code_verifier }`. Only the tokens and scope are kept, so the connection is named "Claude Code". Refresh JSON `{ grant_type: refresh_token, refresh_token, client_id }`; any failure is a refused refresh (the old refresh token stays when none comes back).
- **Requests** (quirk `claudeCode`): `POST <chatUrl>?beta=true`, `Authorization: Bearer`, the catalog's Claude Code headers (claude-cli/2.1.280, X-App cli, X-Stainless-*), `anthropic-beta` = the Claude Code list with advanced-tool-use and effort for opus/sonnet (redact-thinking dropped for `thinking.display: summarized`). A request from a non-Claude client (OpenAI, Responses, Gemini, the model test) gets `You are Claude Code, Anthropic's official CLI for Claude.` in front and its own system parts joined after it. Then 9router's prepareClaudeRequest: max_tokens capped at the model's output limit (64000 when none), the thinking budget reconciled below it; the client's cache marks removed, 1 h on the last system block and on the last tool that is not `defer_loading`, 5 min on the last assistant block; empty turns dropped (not a final assistant turn); an assistant turn with a tool call keeps its thinking, its calls and the text before the first call; same-role turns merge with tool results first; only thinking with a valid Claude signature survives, and a tool turn gets a placeholder thinking block when thinking is on and the last turn is the user's.
- **Cloaking** (a token containing `sk-ant-oat`): a first system block `x-anthropic-billing-header: cc_version=2.1.280.<3 hex>; cc_entrypoint=sdk-cli; cch=<sha256 of the body so far, 5 hex>;`; `metadata.user_id` (unless the client sent one) `{"device_id":sha256("device:"+token),"account_uuid":<uuid from "account:"+token>,"session_id":<connection id>}`; client tools (not typed server tools) renamed with `_ide`, 20 decoy Claude Code tools appended ("This tool is currently unavailable."), the history and a forced tool choice renamed to match, and the names given back in the answer and the stream.
- **Model list**: `GET https://api.anthropic.com/v1/models` with only `anthropic-version` and `x-api-key: <OAuth token>` (kept; Anthropic may refuse it). **Test**: no request; valid unless the token is within 4 hours of expiry and the refresh fails ("Token expired and refresh failed", or "Token expired" without a refresh token).
- Deviations: the session id is the connection id (9router reads a client session id, else derives one); `ttl` from the client is not modelled.

## codex (SP16b)

- **Sign-in** (`authorization_code_pkce`, fixed redirect `http://localhost:1455/auth/callback` whatever the dashboard asks): `https://auth.openai.com/oauth/authorize` with response_type, client_id `app_EMoamEEZ73f0CkXaXp7hrann`, redirect_uri, scope `openid profile email offline_access`, S256 challenge, `id_token_add_organizations=true`, `codex_cli_simplified_flow=true`, `originator=codex_cli_rs`, state (encodeURIComponent, spaces as %20). 9router listens on port 1455; AIGate does not (SP16 decision): the page that cannot load is pasted back. Exchange form-urlencoded; the id_token gives the email (else the access token's email, preferred_username or sub), `chatgpt_account_id` (stored in the connection's `account_id`) and the plan type. Refresh JSON `{ client_id, grant_type: refresh_token, refresh_token }`; the refreshed id_token is not read.
- **Requests** (quirk `codex`, stream-only): `POST https://chatgpt.com/backend-api/codex/responses`, or `.../compact` when the previous codex request asked for compaction (kept), with Bearer, originator `codex_cli_rs`, User-Agent `codex_cli_rs/0.154.0`, `session_id` (the connection id, else `default`) and `ChatGPT-Account-ID`. 9router's body: string or empty input made a message ("..." when empty), system items become developer, stored ids (rs_, fc_, resp_, msg_) and item references removed, function tools flattened (128-character names, `\p{...}` patterns removed), hosted tools kept, custom tools passed, others dropped, a tool_choice naming an unknown function dropped; stream true, store false, the Codex CLI instructions when none, `prompt_cache_key` = the session; a `-review` model sent as its base, an effort suffix read from the model name, reasoning `{ effort (default low; max/ultra -> xhigh), summary: auto }`, `include: [reasoning.encrypted_content]` unless the effort is none; sampling, token limits, user, metadata and previous_response_id removed; `service_tier` fast -> priority, others dropped; then only the allowlisted fields. A non-streaming client gets the stream collapsed.
- **Model list**: `GET https://chatgpt.com/backend-api/codex/models?client_version=0.144.6` with originator (no user agent, no account id); each chat model also listed as `<id>-review`. **Test**: `POST .../codex/responses { model: gpt-5.3-codex, input: [], stream: false, store: false }`; only 401 is invalid (the probe also carries the account header).
- Not ported yet: 9router's remote image inlining, its SSE peek for overloaded errors and its usage-limit reset parsing.

## Dashboard

- The Add connection dialog shows the sign-in for a provider with `signIn` (GitLab's application fields for gitlab only; for a provider whose callback is elsewhere, codex, it says to paste the address of the page that cannot load): a popup to the provider (the dashboard's `/callback` hands the code back by `postMessage` to this origin, or a `BroadcastChannel` when there is no opener), with a field to paste the callback URL or code when the popup cannot return (a remote dashboard); GitLab asks for its application first; a device flow shows the code, opens the approval page, and polls at the provider's interval until approved, refused or expired. A provider that also takes a key shows the key form below.
- Connections shows "Signed in as <email> · token until <time>" and a **Sign in again** action for oauth rows; errors reach the user through `shared/errors.ts` (`OAUTH_FAILED`, `ALREADY_CONNECTED` with the server's message).

## Other deviations

- `/api/oauth` errors use the dashboard shape `{ code, message }` with the codes above (9router answers `{ error }` with 400/500).
- The device code is URL-encoded in the poll path; a Kilo Code profile or Kimchi user read that fails is ignored, as in 9router.
