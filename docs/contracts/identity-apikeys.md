# Identity and API keys contract (M1 SP6)

Scope, per spec §9: dashboard password login and API key issuing and validation. OIDC and SAML come later. The source is the Feature Matrix entries below in `docs/discovery/feature-matrix/01-endpoint-apikey-settings.yaml`. AIGate does not reproduce any rule labeled `SUSPECTED_BUG` or `IMPLEMENTATION_ACCIDENT`.

The user settled four decisions on 2026-09-25:
1. API keys are random and stored as a hash.
2. The first password is set from the local machine; there is no default password.
3. Sessions are stored in the database, not in a JWT.
4. `requireLogin = false` exempts local clients only.

## Rules from the reference

| Entry | Rule in 9router | Label | AIGate |
|---|---|---|---|
| `identity.session-cookie-lifecycle` | Login issues an httpOnly, `SameSite=Lax` cookie that lasts 24 h. | `REFERENCE_BEHAVIOR` | Keep. The cookie is `aigate_session`, with the same flags and lifetime. |
| `identity.session-cookie-lifecycle` | The cookie is a JWT signed with a file secret, so logout cannot revoke an issued token. | `IMPLEMENTATION_ACCIDENT` | Replace with a random 32-byte token. The database stores only its SHA-256 and expiry, so logout and password changes revoke sessions at once (decision 3). |
| `identity.session-cookie-lifecycle` | Logout is unconditional and needs no session. | `REFERENCE_BEHAVIOR` | Keep. |
| `identity.session-cookie-lifecycle`, `settings.require-login-public-status` | `requireLogin = false` treats every caller as signed in, even remote ones. | `SUSPECTED_BUG` | Only a local client is exempt (decision 4). |
| `identity.password-login-lockout` | 5 consecutive failures lock the client for 30 s, then 2 min, 10 min, and 30 min. The count resets 1 h after the last failure, or on success. A locked client gets 429 and `Retry-After`; other failures get 401 with the attempts left. | `REFERENCE_BEHAVIOR` | Keep. The client key is the socket address; forwarded headers are not trusted. |
| `identity.password-login-lockout` | The lockout map has no size bound. | `IMPLEMENTATION_ACCIDENT` | Cap it at 10,000 clients and drop the oldest entry first (lean-bounded skill). |
| `settings.patch-password-change` | With a password set, changing it needs the current password. | `REFERENCE_BEHAVIOR` | Keep. It moves to `POST /api/auth/password`; the settings `PATCH` rejects password keys. |
| `settings.patch-password-change` | First-time setup compares against a hardcoded `'123456'`. | `SUSPECTED_BUG` | There is no default password. The first password is set by `POST /api/auth/setup` from the local machine, or from `AIGATE_INITIAL_PASSWORD` at boot (decision 2). |
| `settings.patch-password-change` | Passwords are hashed with bcrypt. | `IMPLEMENTATION_ACCIDENT` (library choice) | Use scrypt from `node:crypto` (N = 2^15), with a constant-time comparison. |
| `identity.reset-password-local-only` | A local request can clear the password, gated by a CLI token or a signed-in local browser. | `REFERENCE_BEHAVIOR` (local recovery) | Recovery is `AIGATE_RESET_PASSWORD=true` at boot. It clears the password and every session; the next local visit sets a new one. There is no HTTP route, because a loopback address alone does not prove the owner on a shared machine, and the CLI token does not exist yet. |
| `identity.auth-status-disclosure` | A public status route lets the login page choose a form without revealing who is signed in. | `REFERENCE_BEHAVIOR` | Keep: `GET /api/auth/status`. The SSO fields wait for OIDC and SAML. |
| `identity.auth-status-disclosure`, `settings.require-login-public-status` | A settings read failure is swallowed into a hardcoded fallback body. | `IMPLEMENTATION_ACCIDENT` | Return the error instead. The guard fails closed anyway. |
| `settings.require-login-public-status` | A separate public route returns `requireLogin`. | `IMPLEMENTATION_ACCIDENT` (duplicate of status) | Merge it into `GET /api/auth/status`. |
| `apikey.generate-key` | The key is shown once, `isActive` defaults to true, and `machineId` never comes from the client. | `REFERENCE_BEHAVIOR` | Keep. |
| `apikey.generate-key` | The format is `sk-{machineId}-{keyId}-{crc8}`, with the CRC keyed by a hardcoded default secret. | `IMPLEMENTATION_ACCIDENT` | Replace with `aigate_` + 32 random bytes in base64url (decision 1). Store the SHA-256 and the last 4 characters. |
| `apikey.list-keys` | The list returns every plaintext key. | `SUSPECTED_BUG` | The list returns a masked key only. The plaintext is never stored. |
| `apikey.list-keys` | `SELECT *` with no limit. | `IMPLEMENTATION_ACCIDENT` | Name the columns, allow at most 100 keys, and list at most 100. |
| `apikey.legacy-format-unenforced` | Legacy keys and an unchecked CRC are accepted. | `SUSPECTED_BUG` | Not applicable: there are no legacy keys, and a key is valid only if its hash exists. |
| `apikey.update-key-status` | Toggle `isActive`. | `REFERENCE_BEHAVIOR` | Keep: `PATCH /api/keys/:id { isActive }`. |
| `apikey.delete-key` | Delete permanently. | `REFERENCE_BEHAVIOR` | Keep: `DELETE /api/keys/:id`. |
| `apikey.validate-lookup` | A key is valid when its row exists and is active. | `REFERENCE_BEHAVIOR` | Keep, with a unique-index lookup by hash. |
| `endpoint.extract-header-order` | Read `Authorization: Bearer <key>` first, then `x-api-key`; any other scheme is ignored. | `REFERENCE_BEHAVIOR` | Keep: `extractApiKey()`. |
| `endpoint.enforce-require-api-key` | `requireApiKey` gates chat requests. | `REFERENCE_BEHAVIOR` | SP6 ships `extractApiKey` and `ApiKeysRepository.isValid`. The `/v1` gate lands with routing in SP12. |

Out of scope: OIDC and SAML (six entries), `identity.machine-id-derivation` (not needed without machine-bound keys; revisit for the CLI token), and `endpoint.rewrite-lanes` (routing).

## Who counts as local

A request is local only when all of these hold:
- The socket address is loopback.
- The `Host` header names `localhost`, `127.0.0.1`, or `[::1]`.
- Any `Origin` header is also one of those.

The host and origin checks stop DNS rebinding, where a malicious web page resolves its own domain to 127.0.0.1.

## Shared machines (decided 2026-09-25: option A)

On a fresh install, whichever local client calls `POST /api/auth/setup` first sets the password. On a machine with other OS accounts, another user can win that race, because loopback is shared by every account on the host.

The user chose to rely on `AIGATE_INITIAL_PASSWORD`. On a shared machine, set it before the first start, so a password exists before the server accepts requests. A one-time setup code (a 0600 file plus a link printed at boot) was considered and deferred until `apps/cli` or server deployments need it.

## Access to `/api/*`

- **Public:**
  - `GET /api/auth/status`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `POST /api/auth/setup`, which itself requires a local client and no password yet
- **Everything else** needs a valid session cookie, or `requireLogin = false` together with a local client. Otherwise it returns 401 `{ code: "UNAUTHENTICATED" }`.
- Any new controller is protected unless it is marked public, so access is deny by default.

## HTTP contract

Error bodies are `{ code, message }`.

**Auth**

| Route | Request | Success | Errors |
|---|---|---|---|
| `GET /api/auth/status` | — | `200 { setupRequired, authenticated, requireLogin }`, no-store | — |
| `POST /api/auth/setup` | `{ password }`, 8–256 chars | `200` plus the session cookie | `403 NOT_LOCAL`, `409 ALREADY_SET_UP`, `400 INVALID_REQUEST` |
| `POST /api/auth/login` | `{ password }` | `200` plus the session cookie | `409 SETUP_REQUIRED`, `401 INVALID_CREDENTIALS { remainingBeforeLock }`, `429 RATE_LIMITED { retryAfter }` with `Retry-After`, `400 INVALID_REQUEST` |
| `POST /api/auth/logout` | — | `200`; deletes this session and clears the cookie | — |
| `POST /api/auth/password` | `{ currentPassword, newPassword }` | `200` plus a fresh cookie; every other session is revoked | `401 INVALID_CREDENTIALS`, `400 INVALID_REQUEST` |

**API keys** (all no-store)

| Route | Request | Success | Errors |
|---|---|---|---|
| `GET /api/keys` | — | `200 [{ id, name, maskedKey, isActive, createdAt }]`, newest first | — |
| `POST /api/keys` | `{ name }`, 1–64 chars after trimming | `201 { …same fields, key }`. `key` appears only here. | `400 INVALID_REQUEST`, `409 LIMIT_REACHED` at 100 keys |
| `PATCH /api/keys/:id` | `{ isActive: boolean }` | `200` with the key | `400`, `404 NOT_FOUND` |
| `DELETE /api/keys/:id` | — | `204` | `404 NOT_FOUND` |

**Storage** (conventions §1–§4, §9–§10):
- `dashboard_password`: a single row holding the scrypt hash and `updated_at`.
- `sessions`: `token_hash` (unique), `created_at`, `expires_at`. Expired sessions are deleted on every login, and at most 20 are kept, newest first.
- `api_keys`: `id`, `name`, `key_hash` (unique), `last_four`, `is_active`, `created_at`.
- All instants are UTC epoch milliseconds.
