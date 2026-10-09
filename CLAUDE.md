# AIGate

Read `docs/PROGRESS_HANDOFF.md` before resuming work. M-1 discovery is complete against the read-only 9Router reference at `.reference/9router` commit `39e36d3d`. M0 SP0ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“SP4, M1 SP5ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“SP12, and M2 SP13ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“SP14h, SP15 (Anthropic Messages clients), SP15b (OpenAI Responses clients) and SP15c (Gemini clients), SP16 (OAuth sign-in core with cline, clinepass, gitlab, kilocode, kimchi), SP16a (model import: live /models, custom models, per-model test), SP16b (OAuth claude with 9router's cloaking, and codex), SP16b2 (OAuth github Copilot), SP16c (OAuth gemini-cli on Google Cloud Code), SP16c2 (OAuth antigravity), SP16d (OAuth grok-cli, kimi, CodeBuddy, iflow), Cursor IDE token import/HTTP2 transport, Kiro OAuth/provider family, and provider-thinking part 2 (`model(level)` routing and copy) are done; the M1 gate passed (`docs/parity/m1-gate-report.md`; tier 2 waits for an OpenAI key). M2 Trae OAuth/provider family is implemented locally; see the handoff for validation and commit status.

**REQUIRED SKILL:** `porting-behavior-not-code` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â before any feature taken from 9router. Read `.agents/skills/porting-behavior-not-code/SKILL.md`.
**REQUIRED SKILL:** `writing-lean-bounded-code` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â before writing any product code. Read `.agents/skills/writing-lean-bounded-code/SKILL.md`.
**REQUIRED:** an API is not done until its UI screen is wired in the same SP. Every error code it returns must reach the user as a precise message through `apps/web/src/shared/errors.ts`. Follow and update `docs/design/API_UI_MAP.md`, then refresh the graph (`/graphify docs --update`).

## Repository map

- `apps/server` is the NestJS 12 + Fastify backend (ESM, built with `tsc`). Bounded contexts live in `src/modules/<context>/{domain,infrastructure}`: `settings`, `identity`, `apikeys`, `catalog` (`GET /api/providers`, the catalog with each provider's connectable status and reason; since SP16a custom models at `/api/models/custom`, see `docs/contracts/custom-models.md`), `routing` (the `/v1` chat lane for OpenAI Chat clients and, since SP15, Anthropic clients at `/v1/messages` and `/v1/messages/count_tokens`, since SP15b Responses clients at `/v1/responses`, `/v1/responses/compact`, `/responses` and `/codex/*`, since SP15c Gemini clients at `/v1beta/models/*` and `GET /v1beta/models`, and since SP23 speech at `/v1/audio/speech` and `/v1/audio/voices` in `speech-lane.ts` (`SpeechLane`, shared with the dashboard's voices controller; `docs/contracts/speech.md`), registered on Fastify directly: key gate in `onRequest`, streaming with backpressure, idle timeout `AIGATE_STREAM_IDLE_TIMEOUT_MS`; `provider-or-alias/model`, or a bare id served by the first declaring provider with an active connection), `usage` (SP24a, `docs/contracts/usage.md`: `UsageRecorder` buffered writer fed by `routing/infrastructure/usage-meter.ts`, which wraps every adapter call in `ChatLane.single()`; summaries, chart, CSV, live SSE at `/api/usage/*`; pricing overrides at `/api/pricing`; SP24b request rows (`usage_requests`, metadata only) at `/api/requests` and usage for every media lane; SP24c vendor quotas at `/api/quotas` through `QuotaService`), `connections` (provider keys sealed with `SecretCipherPort` from `src/secret-cipher.ts`, and custom OpenAI- (chat or Responses API) or Anthropic-compatible providers at `/api/provider-nodes`, reached on `/v1` as `<prefix>/<model>`), and `transport` (the only place allowed to call `fetch`; a global `HTTP_TRANSPORT`, replaceable in tests through `createServer({ transport })`). Every route needs a dashboard session unless marked `@Public()`; see `docs/contracts/`. Only JSON bodies are parsed. In production the server serves `apps/web/dist` on the same port (default `20200`, bound to `127.0.0.1`). Settings come from the environment and the repository's `.env` (loaded first by `apps/server/src/env.ts`; every variable is in `.env.example`; never commit `.env` or a client secret).
- `packages/engine` is the framework-free provider engine: CIP types, error taxonomy, registry schema, the extracted `CATALOG` (121 providers) and `builtinRegistry` built from it (`builtin-registry.ts`: the 73 providers the adapters can serve, stream-only ones marked `streamOnly`, and a reason for every other one), capability resolution, `withRetry`, `AIProviderPort`, the adapters chosen by protocol through `createAdapter` (`OpenAICompatibleAdapter`, `AnthropicAdapter` for the Messages API, `OpenAIResponsesAdapter` for the Responses API, `OllamaAdapter` for /api/chat NDJSON, `GeminiAdapter` for generateContent with its tool-schema cleaner, `AntigravityAdapter` for the Antigravity IDE Cloud Code envelope, `CursorAdapter` for Cursor ConnectRPC over HTTP/2, `KiroAdapter` for Kiro OAuth and EventStream, `TraeAdapter` for Trae SOLO EventStream, `GrokCliAdapter`, `KimiAdapter`, `IFlowAdapter`, `VertexAdapter` / `VertexPartnerAdapter` with Google Cloud credentials in `adapters/google-auth.ts`, `CommandCodeAdapter` for NDJSON AI SDK events; shared HTTP handling in `adapters/http-adapter.ts`; bounded SSE in `sse.ts`; SP23 `tts.ts`: one TTS request builder and answer decoder per upstream format, and the account voice lists; SP24a `pricing.ts` with the built-in rates in `pricing-table.ts`, copied from 9router). No npm imports are allowed (dependency-cruiser `engine-framework-free`). It also holds the client-facing protocols: OpenAI Chat (`protocols/openai-chat.ts`: parse, render, SSE encoder, `toOpenAIError`) and Anthropic Messages (`protocols/anthropic-messages.ts`: parse, per-provider preparation, message, SSE encoder, count_tokens) and OpenAI Responses (`protocols/openai-responses.ts`: the Responses ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ chat pivot, passthrough to Responses providers, response object, SSE encoder) and Gemini (`protocols/gemini-generate.ts`: text-only request, GenerateContentResponse, SSE encoder, `/v1beta/models` list, TTS passthrough request). See `docs/contracts/engine.md`, `provider-openai.md`, `provider-anthropic.md`, `provider-openai-responses.md`, `provider-ollama.md`, `provider-gemini.md`, `provider-vertex.md`, `provider-connection-data.md`, `provider-commandcode.md`, `stream-only-providers.md`, `protocol-openai.md`, `protocol-anthropic.md`, `protocol-responses.md`, `protocol-gemini.md`, and `oauth.md` (SP16: `oauth.ts` holds the sign-in flows and refreshers; the server's `api/oauth` controller and `TokenRefresher` store and refresh the tokens; SP16b: `adapters/claude-code.ts` for the claude provider's preparation and cloaking, `adapters/codex.ts` for codex's body, URL and model list; SP16b2: `adapters/github.ts` routes Copilot models to /chat/completions, /responses or /v1/messages; SP16c: `adapters/cloud-code.ts` for the Cloud Code project lookup and test, `adapters/gemini-cli.ts` for the Cloud Code envelope around the Gemini adapter; SP16c2: `adapters/antigravity.ts` for the IDE OAuth, model-level thinking suffix, Gemini/Claude envelope, image requests and retry policy; SP16d: Grok CLI Responses normalization, Kimi device headers, and iFlow signed chat; Cursor: `adapters/cursor.ts` and the server-owned HTTP/2 transport).
- `packages/database` is the SQLite driver chain. All four drivers (bun:sqlite, better-sqlite3, node:sqlite, sql.js) go through one locked `sqlite-proxy` (see SPIKE-1). Tables are added per bounded context in the SP that implements it, following `packages/database/SCHEMA_CONVENTIONS.md`. Tables so far: `settings`, `dashboard_password`, `sessions`, `api_keys`, `custom_models` (SP16a), `provider_thinking` (migration 0012), `provider_connections` (per-connection `base_url` since SP14d, `deployment`, `api_version`, `organization`, `account_id` since SP14g, OAuth fields since migration 0009), `provider_nodes` (sealed `custom_headers_sealed`, `retry_stream_errors` since migration 0011, `thinking_level` since 0013), `proxy_pools` (relational pool and optional connection assignment, migration 0016), `provider_proxy_strategies` (persisted keyless-provider route strategy and optional pool pin, migration 0017), `combos` (SP19, migration 0018), `capacity_pools` (SP20, migration 0019), `usage_events`, `usage_daily`, `pricing_overrides` (SP24a, migration 0022), and `usage_requests` (SP24b, migration 0023). `test/fixture` holds the separate conformance schema. Never await network I/O inside a transaction, because the lock serializes all access. The server opens `$AIGATE_DATA_DIR/aigate.db` (default `~/.aigate`) and the secret key `secret.key` beside it, unless `AIGATE_SECRET_KEY` is set. Losing that key makes stored provider keys unreadable.
- `apps/web` is the Vite/React dashboard. Login, onboarding step 1, auth settings, API keys, the provider catalog (`/providers` and provider detail with models), custom providers, provider connections, the provider Models panel, Network → Proxy Pools (CRUD, probes, hosted relay deployment, keyless proxy strategies), and Gateway → Routing's Combo tab, combo form, and Capacity adapter tab are wired through `shared/api.ts` and per-feature `api.ts` hooks. Media Providers uses live catalog/connection state and the existing TTS voice browser (SP31; `docs/contracts/media-dashboard.md`). The keyless strategy panel currently has no eligible runtime chat provider. Browser OAuth opens its popup synchronously on the user click, then navigates it after authorize returns. Read `docs/design/UI_HANDOFF.md` before frontend work.
- `apps/server/src/modules/tooling` exposes CLI discovery and all SP25 reviewed config adapters, metadata-only request log/SSE, guarded Tailscale Funnel controls, a persisted MCP server registry/marketplace, and MITM certificate/trust/listener/hosts lifecycle at `/api/tooling/*`; see `docs/contracts/tooling.md`. Filesystem operations run on the AIGate host. MCP transport is deliberately not proxied or executed by AIGate.
- SP26 / M3 U8 wires `/` to `GET /api/overview/summary` in the usage context and the existing usage SSE (shared web hook `shared/live-usage.ts`). See `docs/contracts/overview.md`: client request totals, prior-24h comparisons, hourly sparklines, upstream-attempt health, account locks/expiry/test alerts and fresh cached quota only. No vendor polling on Overview; no new schema or dependency. The numbered M2 roadmap ends at SP25; SP26 is this M3 integration slice.
- SP26 completion fixes live-stream error classification in both Overview and Usage: `shared/usage-stream.ts` reads the same SSE endpoint through `apiStream`, preserves actual HTTP errors, bounds handshake/heartbeat/line size, supports finite consecutive-failure reconnect and manual Reconnect, and cancels readers/timers on unmount. Disconnected active counts are unknown; recent rows are last-received. The server closes live replies on shutdown; Overview status fields stay visible at mobile widths. Targeted server/web checks and isolated browser smoke passed after the user accepted the proposed verification; see the latest SP26 handoff.
- SP27 / M3 U2 wires Settings General runtime/theme and settings-only JSON export/import (`/api/settings/runtime`, `/export`, `/import/preview`, `/import`); Developer shows actual retention/writer counters and runtime download. `docs/contracts/settings.md` defines the 64 KiB v1 document, excluded service URLs/credentials, before/after review, confirmation and conditional SQL stale-import refusal. No new dependency or migration. Full i18n, OS startup, updates and complete installation backup remain separate tasks.
- SP27 completion makes both transfer POST successes explicitly HTTP 200 rather than Nest's default 201. Targeted settings/web checks passed 11/11 and isolated browser acceptance covers downloads, preview/confirmation/conflict recovery, invalid files, theme/developer persistence and runtime loading/Retry. Export has exactly 16 transferable keys; runtime labels/paths wrap on mobile. See the latest SP27 handoff; no dependency or full-backup scope was added.
- SP28 / M3 U1–U2 provides browser-local EN/VI for shell/navigation, Auth, General/Auth/Developer Settings, Overview and shared owned defaults/notices/errors. `shared/locale.tsx` is the single root context; two static JSON catalogs and native Intl require no new dependency. General stores only `aigate-language`, excluded from the 16-key server export. `docs/contracts/i18n.md` defines raw-message/identifier/USD/timezone/lifecycle boundaries. SP32 extends Media Providers and Voice Browser; SP33 extends Endpoint & Keys; SP34 extends Routing Combo and Capacity editors; SP35 extends Token Saver; SP36 extends Quota; SP37 extends Usage analytics and Pricing; SP38 extends Requests list/detail; SP39 extends Developer Console; SP40 extends Proxy Pools and Deploy Wizard. Other feature-specific copy remains English. Core acceptance is verified: 27 targeted checks and isolated browser state/timer/SSE/layout checks pass (2026-10-08), including denied storage and EN/VI at 1440/929/390px. See the completion handoff for mock boundaries/cleanup; do not equate this with whole-dashboard i18n or a full visual/accessibility/performance audit.
- `tools/parity` is the dev-only parity harness (`docs/contracts/parity.md`): `pnpm parity record` (tapes from a running 9router, temporary node cleaned up), `replay` (tier 1/3, also in `pnpm test`), `live` (tier 2, `OPENAI_API_KEY`), `gate`. Every difference from 9router must be a labeled deviation in `tools/parity/src/scenarios.mjs`.
- `packages/engine/src/catalog/providers.generated.ts` was written by the dev-only `tools/extract` (deleted in SP13b; `docs/contracts/registry-extract.md` says how to restore it from git to regenerate). Never hand-edit the generated file.
- `tools/discovery` holds the Feature Matrix tooling and parity gates. `docs/discovery/feature-matrix` records reference behavior; `docs/discovery/inventory.json`, `docs/discovery/coverage.md`, and `docs/capabilities.md` are generated outputs.
- `docs/superpowers/specs/2026-09-22-aigate-design.md` is the architecture and milestone spec. For M0, read sections 9 and 11. Follow `docs/governance/rules.md` for implementation.
- `.reference/9router` is a read-only reference, not the AIGate source tree. Its `CLAUDE.md` and commands do not describe this repository.

## Verify (PowerShell)

SP40 / M3 U9 localizes Proxy Pools and Deploy Wizard over existing SP18 APIs.
Pool/rotation IDs and credential payloads remain literal; EN/VI preserves
drafts and pending mutations without refetch or replay. See
`docs/contracts/proxy-pools-ui-i18n.md` and the latest handoff.

SP39 / M3 U11 localizes the existing Developer Console and closed gate. The
200-event log, eight-stream server bound, Pause/SSE lifecycle and explicit
Clear route remain unchanged; read and Clear errors expose code/diagnostic.
See `docs/contracts/console-ui-i18n.md` and the latest handoff.

SP38 / M3 U7 localizes the existing Requests list and detail pages. URL filters,
cursor paging (100/500), request metadata and API payloads are unchanged;
failed filter/page/detail reads expose code, diagnostic and Retry. See
`docs/contracts/requests-ui-i18n.md` and the latest handoff.

SP37 / M3 U7 localizes the existing Usage analytics page, its charts and
Pricing modal. Period IDs, server usage timezone, SSE connection and pricing
payloads are unchanged; incomplete custom dates cannot export CSV. See
`docs/contracts/usage-ui-i18n.md` and the latest handoff.

SP36 / M3 U7 localizes the existing Quota dashboard and treats missing vendor
balances as unknown. It moves the screen into `features/providers/quota.tsx`;
the 60-second polling and explicit refresh APIs are unchanged. See
`docs/contracts/quota-ui-i18n.md` and the latest handoff.

SP35 / M3 U6 localizes the existing Token Saver dashboard and distinguishes
PXPIPE status read errors from an absent package. It moves the screen into
`features/gateway/token-saver.tsx`; settings and install APIs are unchanged.
See `docs/contracts/token-saver-ui-i18n.md` and the latest handoff.

SP34 / M3 U6 localizes the existing Routing Combo list/create/edit and Capacity
adapter controls in EN/VI. It preserves names, payloads, tab and draft state,
existing bounds and explicit model Test behavior; it adds no API or dependency.
See `docs/contracts/routing-editor-i18n.md` and the latest handoff.

SP33 / M3 U3 makes Endpoint & Keys select among four existing client protocol
setups with route-matched URLs/requests and EN/VI owned copy. It does not add a
server API or place a saved key in any example. See `docs/contracts/endpoint-setup.md`.

SP32 / M3 U1 extends browser EN/VI over Media Providers and Voice Browser
using the existing locale catalog; IDs, names, diagnostics, endpoints and the
fixed speech preview sample remain literal. See `docs/contracts/i18n.md`.

SP31 / M3 U5 completes Media Providers dashboard state using the existing
catalog, connections and TTS voice APIs. See `docs/contracts/media-dashboard.md`:
catalog claim, working route and enabled-account configuration are separate;
invalid links and connection-read failures have explicit states. Targeted
native and isolated browser checks passed on 2026-10-09 with fake transport.

SP30 / M3 U6 replaces the Routing Overview and Fallback sample tabs with the
session-guarded, read-only `GET /api/routing/status` snapshot. See
`docs/contracts/routing-status.md` for bounded provider/account and active-lock
metadata, EN/VI UI, polling and countdown behavior. Targeted native and
isolated browser acceptance passed on 2026-10-09 with zero vendor calls;
this is configuration state, not a provider-health or model-eligibility probe.

SP29 / M3 U6 implements the existing Routing Simulator tab and session-guarded
`POST /api/routing/simulate`. See `docs/contracts/routing-simulator.md`: shared
pure model/account choices, metadata-only projections/rotation peeks, bounded
conditional tree, OpenAI Chat input only, no vendor/refresh/decryption/usage/
rotation execution. New tab copy uses existing EN/VI. Native implementation
and scoped acceptance were verified on
2026-10-09: targeted server/web/discovery checks, isolated browser acceptance,
build/lint, and independent review passed after the review finding was fixed.
See the latest handoff for exact counts and scope; do not redo completed SP29 work.

```powershell
pnpm install --frozen-lockfile
git clone --filter=blob:none https://github.com/decolua/9router.git .reference/9router
git -C .reference/9router checkout 39e36d3d0c849e0e01dfeacddf111edf892448fc
pnpm test
pnpm discovery validate
pnpm build
```

`pnpm dev` starts the server and Vite together. `pnpm build && pnpm start` runs the single-port production build.

Before stopping, update `docs/PROGRESS_HANDOFF.md` with work completed, checks run, current work, and the next concrete step. Do not equate a visual UI preview with live backend integration.
