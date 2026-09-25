# API ↔ UI map

This is the living map from each backend API to the UI screen that uses it. `docs/PROJECT_MAP.md` (generated) says which U-project owns a screen and which SP it waits for. This file says what is actually wired today.

## Rule: an API is done only when its screen is wired

When an SP adds or changes an API, the same SP must do all of the following:

1. Wire the mapped screen in `apps/web/src/features/<area>/`, following `docs/design/UI_HANDOFF.md`:
   - `api.ts` holds the TanStack Query hooks.
   - `screens.tsx` keeps the existing layout.
   - Features never import other features; share state through query keys.
2. Replace the fixture data behind that screen. Remove, or clearly label, any control the API does not back yet. Never keep a control that only looks like it works.
3. Handle every error code the contract lists (section "Error handling" below), and give each one a precise toast or inline message.
4. Update the row in this file and the "UI wiring" notes in `docs/PROGRESS_HANDOFF.md`.
5. Rebuild the knowledge graph: `/graphify docs --update`, then `python graphify-out/build_project_map.py`.

If an SP adds no HTTP API (for example `packages/engine`), write "no UI" in its row, so the next agent does not look for a screen.

## Wired

| API | Contract | Screen (route → component) | Hooks | Status |
|---|---|---|---|---|
| `GET /api/auth/status` | `contracts/identity-apikeys.md` | Shell gate (`app/shell.tsx`); `/login`, `/welcome` | `features/settings/api.ts` `useAuthStatus` | Wired: redirects to `/welcome` or `/login` |
| `POST /api/auth/setup` | same | `/welcome` → `Onboarding` (one step) | `useSetup` | Wired |
| `POST /api/auth/login` | same | `/login` → `Login` | `useLogin` | Wired |
| `POST /api/auth/logout` | same | `/settings/auth` → `SettingsAuth`, "Sign out" | `useLogout` | Wired |
| `POST /api/auth/password` | same | `/settings/auth` → `SettingsAuth`, "Password login" | `useChangePassword` | Wired |
| `GET/PATCH /api/settings` | `contracts/settings.md` | `/settings/auth`: "Require dashboard login" and "Require API key"; `/gateway/endpoint`: "Require API key" | `useSettings`, `usePatchSettings`; `features/gateway/api.ts` `useRequireApiKey` | Wired |
| `GET/POST /api/keys`, `PATCH/DELETE /api/keys/:id` | `contracts/identity-apikeys.md` | `/gateway/endpoint` → `EndpointKeys` | `useApiKeys`, `useCreateKey`, `useSetKeyActive`, `useDeleteKey` | Wired: key shown once; disable/enable; revoke with type-to-confirm |
| `GET /health` | — | none (probe) | — | No UI |

## Waiting for backend

Each screen keeps its fixture data until the SP in the second column lands. When it does, move the row to "Wired".

| Screen (route → component) | Backend SP | Notes |
|---|---|---|
| `/` → `Overview` | SP12 routing, usage SPs | Live requests, needs attention |
| `/settings/general` → `SettingsGeneral` | adds its settings keys by migration | Instance name, language, default model, observability |
| `/settings/auth` OIDC and SAML tabs | M2 (OIDC/SAML) | Visual only |
| `/gateway/endpoint` base URL pill | SP12 (`/v1`) | Shows "Chat API pending" until `/v1` exists |
| `/providers*` → `LlmProviders`, `ProviderDetail`, `Connections`, `Quota` | SP11, SP16, SP17 | The catalog is metadata only |
| `/providers/media*` → `MediaProviders` | SP23 | |
| `/gateway/routing*`, `/gateway/token-saver` → `Routing`, `ComboCreate`, `TokenSaver` | SP19, SP20 | Combo form is a local draft |
| `/traffic/usage`, `/traffic/requests*` → `Usage`, `Requests`, `RequestDetail` | usage SPs | |
| `/traffic/console` → `Console` | tooling | Developer mode only |
| `/network/*` → `ProxyPools`, `DeployWizard`, `Tunnel`, `Mitm` | SP18 | |
| `/integrations/*` → `CliTools`, `CliToolDetail`, `Skills`, `Mcp` | tooling | |

## Engine and non-HTTP work

| SP | UI |
|---|---|
| SP7 `packages/engine` (CIP core, registry, capability resolution, retry helper) | No UI. It has no HTTP API; `/v1` (SP12) is the first thing a screen can show. |

## Error handling

Every failure reaches the UI as an `ApiError` with a stable `code`:
- `apps/web/src/shared/api.ts` creates it.
- `apps/web/src/shared/errors.ts` (`toProblem`) holds the one table that turns a code into what the user reads.
- Unit tests are in `shared/errors.test.mjs`.

When you add a server code, add its row here and in `errors.ts`.

| Code | Raised by | What the UI does |
|---|---|---|
| `NETWORK_ERROR` | fetch failed; the server is down or the network is offline | Toast: "Could not reach AIGate…". Queries show the error state with Retry. |
| `TIMEOUT` | no response within 10 s | Toast: "did not answer within 10 seconds" |
| `BAD_RESPONSE` | 2xx with a body that is not JSON (for example the SPA page for a mistyped path) | Toast: "Refresh the page" |
| `UNAUTHENTICATED` (401) | a protected route after logout elsewhere, a password change, or the 24 h expiry | Toast: "Your session ended"; the shell re-checks status and redirects to `/login` |
| `INVALID_CREDENTIALS` (401) | wrong password at login or password change | Inline warning and toast, with the attempts left before lockout |
| `RATE_LIMITED` (429) | locked after 5 failures | Toast: "Try again in Ns", from `retryAfter` |
| `NOT_LOCAL` (403) | first-password setup from a non-local client | Tells the user to use the host machine or `AIGATE_INITIAL_PASSWORD` |
| `ALREADY_SET_UP` / `SETUP_REQUIRED` (409) | setup raced, or login before setup | Redirects to `/login` / `/welcome` |
| `LIMIT_REACHED` (409) | the 101st API key | Toast: revoke an unused key |
| `NOT_FOUND` (404) | a key deleted in another tab | Toast, then the list refetches (`onSettled`) |
| `INVALID_REQUEST` (400) | a validation failure | The server message is shown as it is, because it names the field |
| `HTTP_5xx` | an unexpected server error or proxy page | Toast with the HTTP status and "check the server log" |
| any other code | — | The server message, or "Request failed (HTTP n)" |

Failed mutations re-read the server: key mutations refetch on settle, and settings toggles refetch on error. The UI never shows a value that was not saved. Submit buttons are disabled while their request is pending, so a double click cannot send twice.
