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
| `GET /api/providers` | `contracts/catalog-providers.md` | `/providers` → `LlmProviders` (cards by category, Connected / Coming later pills); `Connections` → Add connection modal (the connectable list) | `features/providers/api.ts` `useProviders` | Wired: loading, error with Retry; a `?provider=` that cannot be connected shows its reason |
| `GET /api/providers/:id` | same | `/providers/detail?provider=…` → `ProviderDetail` (type, Connection panel or reason, Models table) | `useProvider` | Wired: 404 `NOT_FOUND` shows "Provider not found" |
| `GET /api/connections` | `contracts/connections.md` | `/providers/connections` → `Connections`; `/providers/detail` → `ProviderDetail` (Connection panel); `/providers` → `LlmProviders` (Connected pill) | `useConnections` | Wired |
| `POST /api/connections` | same | `Connections` → Add connection modal (the connectable providers, 52 since SP14d, 53 since SP14e, 55 since SP14f, 58 since SP14g, 59 since SP14h; per-provider connection fields (Azure endpoint, deployment, API version, organization; Cloudflare account ID); a service-account JSON or API key field for Vertex; a Host field and optional key for Ollama Local; a query `?provider=` preselects or shows the reason); `PROVIDER_NOT_SUPPORTED` toasts the server's reason | `useCreateConnection` | Wired: save, then test at once |
| `PATCH /api/connections/:id` | same | `Connections` → Replace key modal (Edit with a Host field for Ollama Local, SP14d), Disable/Enable | `useUpdateConnection` | Wired: a new key resets to Not tested, then is tested |
| `DELETE /api/connections/:id` | same | `Connections` → Delete (type-to-confirm) | `useDeleteConnection` | Wired |
| `POST /api/connections/:id/test` | same | `Connections` → Test; runs after every save | `useTestConnection` (25 s client timeout) | Wired: one toast per result (`features/providers/test-result.ts`); upstream 401 shows its redacted reason, while AIGate's own 401 from a self-referential custom Base URL becomes `unreachable` / `INVALID_REQUEST` with an Edit Base URL message |
| `POST /v1/chat/completions`, `GET /v1/models` | `contracts/chat-lane.md` | API clients (SDKs, IDEs), not the dashboard. `/gateway/endpoint` → `EndpointKeys` shows readiness: "Ready", "Connect a provider", or "Check connection" | `features/gateway/api.ts` `useChatReadiness` (the `["connections"]` query) | Wired: readiness pill, a curl test request, and a note that keyless mode is local-only |
| `GET /api/provider-nodes` | `contracts/custom-providers.md` | `/providers` → `LlmProviders`, Custom providers section (cards with Connect, Edit, Delete); `/providers/new?id=` edit form; `Connections` → Add connection modal (custom providers listed after the built-in ones) | `features/providers/api.ts` `useProviderNodes` | Wired: loading, error with Retry, empty state; an Unreachable pill names why `/v1` cannot reach a card (reserved, duplicate, or `/` prefix; OpenAI-compatible prefixes win over Anthropic ones; kept as in 9router, `node-rules.ts`) |
| `POST /api/provider-nodes` | same | `/providers/new` → `ProviderDetail isNew` (`features/providers/custom.tsx` `CustomProviderForm`); `/providers/new?type=anthropic-compatible` from the `+ Anthropic compatible` button (SP14b) | `useCreateNode` (sends `type`) | Wired: protocol select (OpenAI or Anthropic compatible), API select for OpenAI compatible (Chat completions or Responses, SP14c), base URL hint per protocol; save, then go to `/providers/connections?provider=<id>` to add the key. A bad `type` is an `INVALID_REQUEST` toast |
| `PATCH /api/provider-nodes/:id` | same | `/providers/new?id=<id>` edit form (protocol shown, not editable; API editable) | `useUpdateNode` | Wired; the server refuses a `type` change or a bad `apiType` with an `INVALID_REQUEST` message |
| `DELETE /api/provider-nodes/:id` | same | Custom provider card → Delete (type-to-confirm; says the connection and key go too) | `useDeleteNode` | Wired: refreshes custom providers and connections |
| `GET /health` | — | none (probe) | — | No UI |

## Waiting for backend

Each screen keeps its fixture data until the SP in the second column lands. When it does, move the row to "Wired".

| Screen (route → component) | Backend SP | Notes |
|---|---|---|
| `/` → `Overview` | SP12 routing, usage SPs | Live requests, needs attention |
| `/settings/general` → `SettingsGeneral` | adds its settings keys by migration | Instance name, language, default model, observability |
| `/settings/auth` OIDC and SAML tabs | M2 (OIDC/SAML) | Visual only |
| `/providers/quota` → `Quota` | SP24 (`usage`: quota) | Quota numbers are fixture data |
| OAuth on `Connections` (AuthFlow modal) | SP16 | SP11 has API-key connections only |
| Multi-account, priority, strategies on `Connections` | SP17 | SP11 has one API-key account per provider |
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
| SP8 `transport` (`HttpTransportPort`, direct branch plus timeout) | No UI. Outbound HTTP only; its error codes (`TIMEOUT`, `PROVIDER_UNAVAILABLE`, `INVALID_REQUEST`) reach users through `/v1` in SP12. |
| SP9 `OpenAICompatibleAdapter` (CIP ↔ chat completions, error classification, bounded SSE) | No UI. `validateCredential` will back "Test connection" on `/providers` (SP11): `AUTH_ERROR` / `QUOTA_EXHAUSTED` are answers about the key, anything else is a connection problem. Chat errors reach users through `/v1` (SP12). |
| SP14a `AnthropicAdapter` (Messages API; `createAdapter` picks the adapter by protocol) | No new screen. Five more providers (anthropic, glm, kimi, minimax, minimax-cn) become connectable on `/providers`, `ProviderDetail`, and the Add connection modal through `connectable` in `GET /api/providers`. Its errors reach users through `/v1` (`unsupported_feature` names the field Anthropic cannot carry) and the connection test (`invalid` for 401/403). `contracts/provider-anthropic.md`. |
| SP14b stream-only providers (`streamOnly`; the collapsed stream for non-streaming clients) | No new screen. codebuddy-cn, codebuddy-intl, and api-airforce become connectable (49) through `connectable` in `GET /api/providers`. An error event in a collapsed stream keeps its 4xx/5xx status on `/v1` (for example 429 `rate_limit_exceeded`). `contracts/stream-only-providers.md`. |
| SP14c `OpenAIResponsesAdapter` (Responses API) | No new screen for perplexity-agent: it becomes connectable (50) through `connectable` in `GET /api/providers`. Custom OpenAI-compatible providers get an API select (Chat completions or Responses) on `/providers/new`; the card says "· Responses". As in 9router, a Responses stream error reaches `/v1` clients as `[Error] …` text, not an error code. `contracts/provider-openai-responses.md`. |
| SP14d `OllamaAdapter` (/api/chat, NDJSON) and ollama-local connections | ollama and ollama-local become connectable (52); assemblyai and deepgram move to "Coming later" with the media reason. Connections: the Add modal shows a Host field and an optional key for Ollama Local (`HOSTED` in `features/providers/screens.tsx`); its row shows the host and "Edit" instead of "Replace key". A bad host or a missing key elsewhere is an `INVALID_REQUEST` toast with the server message; a keyless key hint reads "no key". An Ollama error line reaches `/v1` as `provider_unavailable`. `contracts/provider-ollama.md`, `contracts/connections.md`. |
| SP14e `GeminiAdapter` (generateContent / streamGenerateContent, tool-schema cleaner) | No new screen. gemini becomes connectable (53) on `/providers`, `ProviderDetail`, and the Add connection modal through `connectable` in `GET /api/providers`; vertex keeps its reason. Google answers a bad key with 400, which the connection test shows as "Key rejected" (the `AUTH_ERROR` toast "Gemini rejected the key…"). As in 9router, `/v1` non-streaming answers carry Gemini's raw lower-cased `finish_reason`, and error chunks in a stream are skipped. `contracts/provider-gemini.md`. |
| SP14f `VertexAdapter`, `VertexPartnerAdapter` (Google Cloud credentials) | vertex and vertex-partner become connectable (55). Connections: for these two the Add and Replace key modals label the key field "API key" with the hint "Paste the service-account JSON key file from Google Cloud IAM, or a Vertex AI API key" and accept up to 16384 characters (`GOOGLE_CLOUD` in `features/providers/screens.tsx`); the row shows the service account's `client_email` instead of `••••abcd`. An incomplete JSON is an `INVALID_REQUEST` toast naming the missing fields; a JSON key for another provider is the usual `apiKey` toast. The connection test mints a token (a refused key shows "Key rejected" with Google's reason) or probes an API key. qoder/qoder-cn show "Coming later" with "Not supported: needs Qoder CLI impersonation". `contracts/provider-vertex.md`, `contracts/connections.md`. |
| SP14g per-connection data (azure, cloudflare-ai) and clinepass | azure, cloudflare-ai, and clinepass become connectable (58). Connections: the Add modal shows the provider's fields (`CONNECTION_FIELDS` in `features/providers/screens.tsx`: Azure endpoint, deployment name, API version prefilled with 2024-10-01-preview, organization "Required for billing"; Cloudflare account ID); their rows show the endpoint, deployment, or "account <id>" and an Edit button whose modal changes the fields and keeps the key unless a new one is typed. A missing, misplaced, or malformed field is an `INVALID_REQUEST` toast with the server message ("baseUrl is required for a Azure OpenAI connection", "accountId must be 1-64 letters, digits, or dashes"). An image sent to Cloudflare reaches `/v1` as `unsupported_feature`. The Azure test passes every status but 401/403 (kept from 9router). `contracts/provider-connection-data.md`, `contracts/connections.md`. |
| SP14h `CommandCodeAdapter` (/alpha/generate, NDJSON AI SDK v5 events) | No new screen. commandcode becomes connectable (59) on `/providers`, `ProviderDetail`, and the Add connection modal through `connectable` in `GET /api/providers`. Its connection test is a one-token ping: a refused key shows "Key rejected" with Command Code's message ("Invalid 'Authorization' header or token."), a billing error shows the no-quota state. As in 9router, a mid-stream error reaches `/v1` streaming clients as `provider_unavailable` "upstream connection lost". `contracts/provider-commandcode.md`. |
| M0 SP4 `tools/extract` + `CATALOG` | Served by SP13 `GET /api/providers` to `/providers` (`LlmProviders`, `ProviderDetail` models). The static `features/providers/catalog.ts` keeps only the media lists (SP23). |
| M0 SP3 parity harness (`tools/parity`) | No UI. Dev-only; it checks the `/v1` responses API clients see against 9router tapes. |
| SP10 OpenAI Chat protocol (`parseOpenAIChatRequest`, `toOpenAIChatCompletion`, `OpenAIChatStreamEncoder`, `toOpenAIError`) | No UI. SP12 mounts it on `/v1/chat/completions`; SP12 did that; the endpoint screen shows readiness. API clients (not the dashboard) read its errors as `{error:{message,type,code,param}}`, with an upstream `AUTH_ERROR` as 502 `upstream_auth_error`. |

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
| `NOT_FOUND` (404) | a key or connection deleted in another tab | Toast, then the list refetches (`onSettled`) |
| `PROVIDER_NOT_SUPPORTED` (400) | connecting a catalog provider that is not connectable yet, or an id not in the catalog | Toast with the server message, which gives the catalog reason (for example "Needs OAuth sign-in (SP16)") |
| `ALREADY_CONNECTED` (409) | a second connection for the same provider | Toast: use Replace key on its row |
| `CREDENTIAL_UNREADABLE` (409) | a test after `secret.key` or `AIGATE_SECRET_KEY` changed | Toast: enter the key again with Replace key |
| `NODE_LIMIT` (409) | a 101st custom provider | Toast: delete one you no longer use |
| Test result `invalid` / `no_quota` / `unreachable` (200, not an error) | `POST /api/connections/:id/test` | Status pill plus a toast: "rejected the key", "no quota or credit", or "could not check the key … not judged" with the provider's message and `lastErrorCode` |
| `INVALID_REQUEST` (400) | a validation failure | The server message is shown as it is, because it names the field |
| `HTTP_5xx` | an unexpected server error or proxy page | Toast with the HTTP status and "check the server log" |
| any other code | — | The server message, or "Request failed (HTTP n)" |

Failed mutations re-read the server: key mutations refetch on settle, and settings toggles refetch on error. The UI never shows a value that was not saved. Submit buttons are disabled while their request is pending, so a double click cannot send twice.
