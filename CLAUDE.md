# CLAUDE.md

## UI ownership handoff

Read `docs/design/UI_HANDOFF.md` before changing frontend files. The visual UI
from `feat/ui-first` is already integrated in this branch under `apps/web`.
Do not redesign or duplicate screens marked `UI_READY`; work on contracts,
backend logic, and API integration. The handoff lists the routes and wiring work.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project map — read this before planning any AIGate work

`docs/PROJECT_MAP.md` answers, in one table lookup: which UI sub-project (U0–U11) owns a
screen, which bounded context feeds it, which backend SP must land first, which 9router
feature group it ports, which design-system components it uses, and what the Stitch audit
flagged on it. Use it instead of re-reading the spec.

- It is **generated** — do not hand-edit. Source of truth stays the docs; the spec wins on conflict.
- Refresh after editing docs: `/graphify docs --update`, then
  `python graphify-out/supplement_spec_edges.py && python graphify-out/build_project_map.py`.
- Deeper questions: `/graphify query "..."`, `/graphify path "U4" "SP16"`; visual graph at `graphify-out/graph.html`.

## What this is

9Router (`9router-app`) — a local AI routing gateway + Next.js dashboard. It exposes one OpenAI-compatible endpoint (`/v1/*`) and routes traffic across 40+ upstream providers with format translation, model-combo fallback, multi-account fallback, OAuth/API-key credential management, token refresh, quota/usage tracking, and optional cloud sync.

Two published artifacts live in this one repo:
- The **dashboard + gateway** (root `package.json`, `9router-app`) — the Next.js server that does the actual routing.
- The **CLI launcher** (`cli/`, published to npm as `9router`) — a separate package that installs/starts the server and manages the tray. It has its own `package.json`, version, and build.

The code lives in `src/` (Next.js app + dashboard/compat APIs), `open-sse/` (the provider-agnostic routing/translation engine), `cli/` (the launcher package), and `tests/`.

## Commands

Dashboard/gateway (run from repo root):
```bash
cp .env.example .env
npm install
PORT=20128 NEXT_PUBLIC_BASE_URL=http://localhost:20128 npm run dev   # dev — Turbopack (Next 16 default)
npm run dev:webpack                                                  # same, on webpack
npm run build && PORT=20128 HOSTNAME=0.0.0.0 npm run start           # production (`build` is pinned to webpack)
```
- Bun variants: `npm run dev:bun` / `build:bun` / `start:bun` (all webpack).
- Every npm script pins `--port 20127`; `.env.example`, `Dockerfile`, `docker-compose.yml` and all README examples use **20128**. Dashboard at `/dashboard`, API at `/v1`.
- `npm start` runs `custom-server.js`, which `require`s the standalone `server.js` when present and otherwise re-execs `next start` in-process — the header-sanitising wrapper applies either way.
- Docker: `docker compose up -d` (see `DOCKER.md`); `captain-definition` is for CapRover.
- Lint: `npx eslint .` (config `eslint.config.mjs`, extends `eslint-config-next`).

CLI package (`cli/`):
```bash
npm run cli:pack       # build + npm pack from root
cd cli && npm run dev  # nodemon watch
```

Tests (vitest, in `tests/`, an **independent** ESM package — not wired into root `npm test`):
```bash
npm install                             # ROOT deps first — tests import from src/ which needs `open`, `undici`, etc.
cd tests && npm install                 # then tests' own deps (vitest) → tests/node_modules (allowed by tests/.gitignore)
npx vitest run                          # all tests; auto-discovers tests/vitest.config.js
npx vitest run unit/capabilities.test.js   # single file (path relative to tests/)
```
> The committed `tests/package.json` `test` script hardcodes Unix paths (`NODE_PATH=/tmp/node_modules …`) — a shared-install workaround from upstream. On Windows (or anywhere), ignore it and use the `npx vitest` form above; `vitest.config.js` resolves the `open-sse`/`@/` aliases from the repo root regardless of where vitest lives.
>
> **The suite is NOT expected to be all-green on a plain checkout.** The committed baseline (`tests/__baseline__/baseline-results.json`) records **674 tests / 209 suites: 628 pass, 26 fail, 20 skipped**. Judge regressions with `tests/__baseline__/verify-no-regression.mjs`, not a raw run. Expected red:
> - 24 catalogued in `tests/__baseline__/known-fails.txt` (rtk, oauth-cursor-auto-import, translator-request-normalization, claude-header-forwarding, openai-to-claude).
> - `unit/embeddings.cloud.test.js` imports `cloud/src/handlers/embeddings.js` — the `cloud/` worker dir is **not in this repo**, so it always fails here.
> - `unit/xai-oauth-service.test.js` times out (5s) when the xAI endpoint-discovery fetch isn't reachable/mocked.
> - `real/*.real.test.js` make live provider calls — need credentials, skip otherwise.
- `*.real.test.js` under `tests/translator/real/` make live provider calls — skip unless credentials are set.
- Regression baselines: `tests/__baseline__/verify-*.mjs` compare against committed snapshots (providers, aliases, OAuth URLs). Run these after touching provider registry / alias logic.

## Architecture

Two authoritative docs already exist — read them before working in these areas rather than re-deriving:
- `docs/ARCHITECTURE.md` — full system: request lifecycle, combo/account fallback, OAuth + token refresh, cloud sync, data model.
- `open-sse/AGENTS.md` — the routing/translation engine's own conventions and "how to add a provider/executor/translator". **Read this before editing anything under `open-sse/`.**

### Request flow (the thing to understand first)
`src/app/api/v1/*` route (Next rewrite maps `/v1/*` → `/api/v1/*` in `next.config.mjs`)
→ `src/sse/handlers/chat.js` (parse, combo expansion, account-selection loop)
→ `open-sse/handlers/chatCore.js` (detect source format, translate request, dispatch to executor, retry/refresh, stream setup)
→ `open-sse/executors/*` (per-provider upstream call; `default.js` handles any OpenAI-compatible provider)
→ `open-sse/translator/*` (client format ↔ provider format)
→ SSE back to client.

`src/sse/` is the app-side entry glue; `open-sse/` is the provider-agnostic engine (also usable standalone). Cross that boundary consciously.

Chat is only the best-known lane. Every modality repeats the same shape — one `src/sse/handlers/*.js` entry paired with one `open-sse/handlers/*Core.js`: `embeddings`, `imageGeneration`, `tts`, `stt`, `videoGeneration`, `search`, `fetch`. Fix account-selection/fallback bugs in the shared services, not in one lane.

`next.config.mjs` rewrites feed all of it: `/v1/*` and `/v1/v1/*` (clients that double-prefix) → `/api/v1/*`, `/v1beta/*` → `/api/v1beta/*` (Gemini-native clients), `/codex/*` and `/responses` → `/api/v1/responses`.

`open-sse/transformer/` sits outside the translator registry: `responsesTransformer.js` (OpenAI Responses-API shaping) and `streamToJsonConverter.js` (collapse a stream into one JSON body for non-streaming callers).

### Translator engine (`open-sse/translator/`)
- Pivots through **OpenAI as the intermediate format**. A translator registered on an exact `source:target` pair (e.g. `claude:kiro`) runs as a **direct route**, skipping the lossy double-hop. Prefer a direct route for fragile pairs (thinking blocks, tool ids, non-base64 images, `is_error`).
- Translators **self-register** via `register(from, to, reqFn, resFn)` as an import side effect — a new translator file MUST be imported in `open-sse/translator/index.js` or it never runs.
- Never hardcode role/block/model strings — use `open-sse/translator/schema/` and `open-sse/config/` constants. Config-driven and DRY is enforced by convention here.

### Provider registry (`open-sse/providers/registry/*`)
- One file per provider. `providers/registry/index.js` is an **auto-generated** static import list — regenerate it with `scripts/migrate-registry.mjs` / `injectDisplayToRegistry.mjs`, don't hand-edit.
- Add a provider: copy `providers/REGISTRY_TEMPLATE.js`, add models to `config/providerModels.js`. Only add an executor for non-OpenAI-compatible upstreams.

### Persistence — IMPORTANT (ARCHITECTURE.md is stale here)
State is **no longer `db.json`**. It's a SQLite layer under `src/lib/db/` with an adapter fallback chain (`driver.js`): `bun:sqlite` → `better-sqlite3` (optional native dep) → `node:sqlite` (Node ≥22.5) → `sql.js` (pure-JS fallback, always works). `better-sqlite3` is deliberately in `optionalDependencies` so install never fails without build tools.
- `src/lib/localDb.js` is a **backward-compat shim** re-exporting `src/lib/db/index.js`. New code should import from `@/lib/db/index.js`; per-entity logic lives in `src/lib/db/repos/*`. Schema/migrations in `src/lib/db/migrations/`.
- DB file location resolves via `src/lib/db/paths.js` (`DATA_DIR`, else `~/.9router/`).
- Usage lives in the same SQLite DB (`usageHistory` / `usageDaily` / `_meta`); `src/lib/usageDb.js` is another shim over `db/repos/usageRepo.js`. There is no `log.txt` — `appendRequestLog()` is an empty no-op and `getRecentLogs()` reads back out of `usageHistory`.
- `usage.json`, `db.json`, `disabledModels.json` and `request-details.json` survive only as one-shot migration sources (`LEGACY_FILES` in `paths.js`, consumed by `db/migrate.js`). Nothing writes them.
- Live counters (active requests, recent-request ring, SSE emitter) hang off `global._*` in `usageRepo.js` — deliberate, because Next evaluates the module more than once per process. Don't "fix" them into module-scope `let`s.

### RTK token saver (`open-sse/rtk/`)
Pre-translate hooks that compress `tool_result` content in-place to cut tokens. **Fail-open**: any error returns null and leaves the body untouched — never throw out of them. Skips `is_error`/`status:"error"` results to preserve traces.

### Subsystems that live beside the router, not inside it
These have their own `/api/*` routes and dashboard cards, and none of them sit on the `/v1` request path — don't refactor them as if they did.
- `src/mitm/` (CommonJS) — local MITM proxy that captures IDE traffic: generates + installs a root CA (`cert/`), rewrites the OS hosts file / DNS for the hosts in `src/shared/constants/mitmToolHosts.js` (`dns/`), and elevates on Windows via `winElevated.js`. Touching it means touching the user's trust store and hosts file — the atomic-write/rollback and elevation paths are deliberate.
- `src/lib/pxpipe/` + `/api/pxpipe/*` — the Token Saver. Runs in **library mode**: the module is npm-installed into a runtime dir and loaded in-process, so "running" means "module loaded", not "port listening". Sibling of `open-sse/rtk/`.
- `/api/tunnel/*` — Tailscale-based remote exposure (install/enable/status).
- `skills/` — published agent skills (one `SKILL.md` per capability) fetched by third-party agents over raw GitHub URLs. Editing one changes a public contract; keep `skills/README.md`'s table in sync.

## Conventions & gotchas

- Plain JavaScript (ESM), no TypeScript. `@/*` path alias → `src/*` (`jsconfig.json`).
- `custom-server.js` wraps the Next standalone server to derive client IP from the TCP socket and strip attacker-controlled `X-Forwarded-For` — trusting forwarding headers only from a loopback reverse proxy. Preserve this when touching request/IP/rate-limit code.
- Security-sensitive env: `JWT_SECRET` (session cookie), `INITIAL_PASSWORD` (default `123456` — must override), `API_KEY_SECRET`, `MACHINE_ID_SALT`. Full env contract in `.env.example` and ARCHITECTURE.md's env matrix.
- `serverExternalPackages` in `next.config.mjs` must keep `open` (plus the sqlite drivers) external — bundling `open` bakes the build machine's absolute `import.meta.url` into the output and kills every importer at module scope on a different OS. The comment there explains it; don't "clean it up".
- Binary/protobuf upstreams (kiro EventStream, cursor protobuf, commandcode NDJSON) don't round-trip through OpenAI — they're handled inside their own executor, not the translator.
- Versioning: root and `cli/` are versioned independently; changes are logged in `CHANGELOG.md`. Commit style is Conventional Commits (`fix(translator): …`, `feat(...)`).
