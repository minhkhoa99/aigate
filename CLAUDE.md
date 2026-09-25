# AIGate

Read `docs/PROGRESS_HANDOFF.md` before resuming work. M-1 discovery is complete against the read-only 9Router reference at `.reference/9router` commit `39e36d3d`. M0 SP0–SP2 and M1 SP5–SP12 and M0 SP3–SP4 are done; the M1 gate passed (`docs/parity/m1-gate-report.md`; tier 2 waits for an OpenAI key). M2 SP13 is next (M0 SP3/SP4 are not built yet); the handoff has the current step.

**REQUIRED SKILL:** `porting-behavior-not-code` — before any feature taken from 9router. Read `.agents/skills/porting-behavior-not-code/SKILL.md`.
**REQUIRED SKILL:** `writing-lean-bounded-code` — before writing any product code. Read `.agents/skills/writing-lean-bounded-code/SKILL.md`.
**REQUIRED:** an API is not done until its UI screen is wired in the same SP. Every error code it returns must reach the user as a precise message through `apps/web/src/shared/errors.ts`. Follow and update `docs/design/API_UI_MAP.md`, then refresh the graph (`/graphify docs --update`).

## Repository map

- `apps/server` is the NestJS 12 + Fastify backend (ESM, built with `tsc`). Bounded contexts live in `src/modules/<context>/{domain,infrastructure}`: `settings`, `identity`, `apikeys`, `routing` (the `/v1` chat lane, registered on Fastify directly: key gate in `onRequest`, streaming with backpressure, idle timeout `AIGATE_STREAM_IDLE_TIMEOUT_MS`), `connections` (provider keys sealed with `SecretCipherPort` from `src/secret-cipher.ts`), and `transport` (the only place allowed to call `fetch`; a global `HTTP_TRANSPORT`, replaceable in tests through `createServer({ transport })`). Every route needs a dashboard session unless marked `@Public()`; see `docs/contracts/`. Only JSON bodies are parsed. In production the server serves `apps/web/dist` on the same port (default `20200`, bound to `127.0.0.1`).
- `packages/engine` is the framework-free provider engine: CIP types, error taxonomy, registry schema plus the `openai` entry, the extracted `CATALOG` (121 providers, not yet the runtime registry), capability resolution, `withRetry`, `AIProviderPort`, the `OpenAICompatibleAdapter` (CIP ↔ chat completions, status → `ErrorCode`, bounded SSE in `sse.ts`). No npm imports are allowed (dependency-cruiser `engine-framework-free`). It also holds the client-facing OpenAI Chat protocol (`protocols/openai-chat.ts`: parse, render, SSE encoder, `toOpenAIError`). See `docs/contracts/engine.md`, `provider-openai.md`, and `protocol-openai.md`.
- `packages/database` is the SQLite driver chain. All four drivers (bun:sqlite, better-sqlite3, node:sqlite, sql.js) go through one locked `sqlite-proxy` (see SPIKE-1). Tables are added per bounded context in the SP that implements it, following `packages/database/SCHEMA_CONVENTIONS.md`. Tables so far: `settings`, `dashboard_password`, `sessions`, `api_keys`, `provider_connections`. `test/fixture` holds the separate conformance schema. Never await network I/O inside a transaction, because the lock serializes all access. The server opens `$AIGATE_DATA_DIR/aigate.db` (default `~/.aigate`) and the secret key `secret.key` beside it, unless `AIGATE_SECRET_KEY` is set. Losing that key makes stored provider keys unreadable.
- `apps/web` is the Vite/React dashboard. Login, onboarding step 1, auth settings, API keys, and provider connections (`/providers`, `/providers/connections`, provider detail) are wired to the server through `shared/api.ts` and per-feature `api.ts` hooks. Every other screen, including the provider catalog and combo form, is still a visual preview with fixture data. Read `docs/design/UI_HANDOFF.md` before frontend work.
- `tools/parity` is the dev-only parity harness (`docs/contracts/parity.md`): `pnpm parity record` (tapes from a running 9router, temporary node cleaned up), `replay` (tier 1/3, also in `pnpm test`), `live` (tier 2, `OPENAI_API_KEY`), `gate`. Every difference from 9router must be a labeled deviation in `tools/parity/src/scenarios.mjs`.
- `tools/extract` (dev-only, deleted after SP13) writes `packages/engine/src/catalog/providers.generated.ts` from 9router's registry: `pnpm extract`, then `pnpm extract verify` (a 0-difference diff, also in `pnpm test`). Never hand-edit the generated file.
- `tools/discovery` holds the Feature Matrix tooling and parity gates. `docs/discovery/feature-matrix` records reference behavior; `docs/discovery/inventory.json`, `docs/discovery/coverage.md`, and `docs/capabilities.md` are generated outputs.
- `docs/superpowers/specs/2026-09-22-aigate-design.md` is the architecture and milestone spec. For M0, read sections 9 and 11. Follow `docs/governance/rules.md` for implementation.
- `.reference/9router` is a read-only reference, not the AIGate source tree. Its `CLAUDE.md` and commands do not describe this repository.

## Verify (PowerShell)

```powershell
pnpm install --frozen-lockfile
git clone --filter=blob:none https://github.com/decolua/9router.git .reference/9router
git -C .reference/9router checkout 39e36d3d0c849e0e01dfeacddf111edf892448fc
$env:NINEROUTER_PATH = (Resolve-Path '.reference/9router').Path
pnpm test
pnpm discovery validate
pnpm build
```

`pnpm dev` starts the server and Vite together. `pnpm build && pnpm start` runs the single-port production build.

Before stopping, update `docs/PROGRESS_HANDOFF.md` with work completed, checks run, current work, and the next concrete step. Do not equate a visual UI preview with live backend integration.
