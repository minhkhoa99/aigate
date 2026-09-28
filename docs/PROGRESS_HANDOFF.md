# AIGate progress handoff

Updated: 2026-09-27. Read this before continuing the project plan.

## Task board

Update this table, and the section of the SP you touched, every time an SP or subtask finishes (user rule, 2026-09-25).

| Step | Status | Where to look |
|---|---|---|
| M-1 Discovery (Tasks 1–19) | Done | "Completed and verified" |
| M0 SP0 Lint, CI, and the two skills | Done | SP0.1–SP0.6 below |
| M0 SP1 Monorepo skeleton | Done | SP1 below |
| M0 SP2 SPIKE-1 and database driver chain | Done | SP2 below, `packages/database` |
| M0 SP3 Parity harness | Done, no UI | `docs/contracts/parity.md` |
| M1 SP5 `settings` | Done, UI wired | `docs/contracts/settings.md` |
| M1 SP6 `identity` + `apikeys` | Done, UI wired | `docs/contracts/identity-apikeys.md` |
| Error handling and the API↔UI map | Done | `docs/design/API_UI_MAP.md` |
| M1 SP7 `engine` core | Done, no UI | `docs/contracts/engine.md` |
| M1 SP8 `transport` (direct branch + timeout) | Done, no UI | `docs/contracts/transport.md` |
| M1 SP9 `engine`: OpenAI-compatible adapter | Done, no UI | `docs/contracts/provider-openai.md` |
| M1 SP10 `engine`: protocol adapter in/out (OpenAI only) | Done, no UI | `docs/contracts/protocol-openai.md` |
| M1 SP11 `connections` (one API-key account) | Done, UI wired | `docs/contracts/connections.md` |
| M1 SP12 routing + `/v1` streaming | Done, UI wired | `docs/contracts/chat-lane.md` |
| M1 acceptance gate (parity tiers 1+2, 13 golden scenarios) | **Passed** (tier 1 11/11, golden 10/10 + 3 deferred); tier 2 waits for an OpenAI key | `docs/parity/m1-gate-report.md` |
| M0 SP4 `tools/extract` registry extraction | Done, no UI | `docs/contracts/registry-extract.md` |
| M2 SP13 catalog → runtime registry (41 connectable providers) | Done, UI wired | `docs/contracts/catalog-providers.md` |
| M2 SP13b custom OpenAI-compatible providers; `tools/extract` deleted | Done, UI wired | `docs/contracts/custom-providers.md` |
| M2 SP14a Anthropic Messages adapter (5 more providers) | Done, no new screen | `docs/contracts/provider-anthropic.md` |
| M2 SP14b Anthropic-compatible custom providers, stream-only providers (49 connectable) | Done, UI wired | `docs/contracts/custom-providers.md`, `docs/contracts/stream-only-providers.md` |
| M2 SP14c `openai-responses` adapter (perplexity-agent, Responses custom providers; 50 connectable) | Done, UI wired | `docs/contracts/provider-openai-responses.md`, `docs/contracts/custom-providers.md` |
| M2 SP14d `ollama` adapter (ollama, ollama-local with host and optional key; STT reclassified; 52 connectable) | Done, UI wired | `docs/contracts/provider-ollama.md`, `docs/contracts/connections.md` |
| M2 SP14e `gemini` adapter (generateContent, thought signatures, corrected tool-schema cleaner; 53 connectable) | Done, no new screen | `docs/contracts/provider-gemini.md` |
| M2 SP14f `vertex` / `vertex-partner` (Google Cloud credentials: service-account JSON, authorized_user JSON, API key); qoder not ported; 55 connectable | Done, UI wired | `docs/contracts/provider-vertex.md`, `docs/contracts/connections.md` |
| M2 SP14g per-connection data (azure, cloudflare-ai: migration 0008) and clinepass; 58 connectable | Done, UI wired | `docs/contracts/provider-connection-data.md`, `docs/contracts/connections.md` |
| M2 SP14h `commandcode` adapter (NDJSON AI SDK v5 events, forced stream); 59 connectable | Done, no new screen | `docs/contracts/provider-commandcode.md` |
| M2 SP15 Anthropic Messages client protocol (`/v1/messages`, count_tokens) | Done, UI wired | `docs/contracts/protocol-anthropic.md`, `docs/contracts/chat-lane.md` |
| M2 SP15b OpenAI Responses client protocol (`/v1/responses`, compact, `/responses`, `/codex/*`) | Done, UI wired | `docs/contracts/protocol-responses.md`, `docs/contracts/chat-lane.md` |
| M2 SP15c Gemini client protocol (`/v1beta/models/*`, `GET /v1beta/models`, TTS passthrough) | Done, UI wired | `docs/contracts/protocol-gemini.md`, `docs/contracts/chat-lane.md` |
| M2 SP16 OAuth core + cline, clinepass, gitlab, kilocode, kimchi (62 connectable) | Done, UI wired | `docs/contracts/oauth.md`, `docs/contracts/connections.md` |
| M2 SP16a model import (live /models, custom models, model test, /v1/models) | Done, UI wired | `docs/contracts/custom-models.md` |
| M2 SP16b OAuth claude (full cloaking) and codex (64 connectable) | Done, UI wired | `docs/contracts/oauth.md` |
| M2 SP16b2 OAuth github (Copilot; 65 connectable) | Done, UI wired | `docs/contracts/oauth.md` |
| M2 SP16c OAuth gemini-cli (Cloud Code; 66 connectable) | Done, UI wired | `docs/contracts/oauth.md` |
| M2 SP16c2 OAuth antigravity | **Next** | "Next step" at the end |

## Completed and verified

- Branch: `feat/m1-discovery`. The starting commit for this audit was `c75d632`; UI preview and its provider/combo handoff were already committed. Read `docs/design/UI_HANDOFF.md` before frontend work. There is still no AIGate backend, live provider connection, or persistent combo API.
- **M-1 Tasks 1-19 are complete against the current reference.** The Feature Matrix has 283 entries covering all 23 groups. Discovery coverage is 166/166 API routes and 11/11 DB repos. Other dimensions are deliberately not exit gates (pages 5/28, registry files 15/124, executors 9/31, translators 37/48, settings keys 47/52); M0 SP4 handles registry extraction.
- The reference checkout is `.reference/9router` at commit `39e36d3d` (`v0.5.86`). It added 12 API routes since the original M-1 snapshot: six CLI tool settings routes, combo presets, four Xiaomi MiMo import/login routes, and System One. Eight new matrix entries trace them. Four stale translator evidence lines were corrected; inventory tests now use 166 routes, 124 registry files excluding `index.js`, and 31 executors. Generated inventory, coverage, and capabilities were refreshed.
- The UI provider catalog still matches the 111 active, visible imports in the current 9Router registry. `opencode-zen` uses the special import variable `p68z`, so a numeric-only parser incorrectly reports 110.
- Checks passed: `pnpm test` (54/54), `pnpm discovery validate` (283 entries), `pnpm web:build`, and `node --test apps/web/src/features/providers/catalog.test.mjs`. Discovery commands need `NINEROUTER_PATH` pointing to `.reference/9router` on this machine. `pnpm install --frozen-lockfile` was run without changing the lockfile.

## M0 SP0.1 in progress

- Replaced the copied 9Router `CLAUDE.md` with an AIGate-specific entry point to this handoff, the UI boundary, design spec, and local verification commands.
- Added ESLint, TypeScript ESLint, `eslint-plugin-boundaries`, and dependency-cruiser. `pnpm lint` currently passes. It checks dynamic `Promise.all`, raw `fetch` without `AbortSignal.timeout`, secret-named values in console/logger calls, non-const type assertions, explicit `any`, empty catches, imports across web features, route files over 200 nonblank lines, repository `SELECT *`/missing `LIMIT`, and vendor imports from `apps/*/src/modules/*/domain/`. The `no-secret-logging` and SQL rules are syntax heuristics, not full data-flow or SQL parsing.
- `pnpm lint:check` has seven passing tests that include deliberately invalid examples; the feature import and domain import fixtures were confirmed to fail their respective tools. GitHub Actions run `36075872718` on commit `5844482` completed successfully: install, lint, lint checks, M-1 tests and validation, and web build all passed.
- Verification after these edits: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm lint:check` (7/7), `pnpm test` (54/54), `pnpm discovery validate` (283 entries), `pnpm web:build`, provider catalog test (1/1), and `git diff --check` all passed locally.
- Follow-up: §4.2 now defines `ExecCtx.signal` as one client-cancel + request-deadline signal shared by routing, retries, adapters and response bodies. It defines the bounded retry helper contract; implementation waits for `packages/engine` as specified in §2. Lint rejects spread arrays in `Promise.all`. A former exception accepting `ctx.signal` under nonexistent `apps/api` was removed; raw fetch with an opaque signal stays rejected until a bounded request helper can be verified against real engine code. Tests failed before the correction and pass afterward. A temporary violating source file made the actual `pnpm lint` command exit 1; it was removed.
- This machine no longer has `D:\9router`. `.reference/9router` was cloned at the exact commit above and ignored by Git. With `NINEROUTER_PATH` set to that checkout, `pnpm test` passed 54/54 and `pnpm discovery validate` passed 283 entries. `pnpm lint:check` passed 7/7, `pnpm web:build`, provider catalog test, and `pnpm install --frozen-lockfile` passed. Initial discovery attempts against the stale `E:\9router` snapshot and missing `D:\9router` failed for reference-path reasons, not product regressions.
- GitHub Actions run `36088813308` on `f676559` passed every step. Temporary branch `test/sp0-ci-red` at `acffd1b` failed run `36088820515` specifically at `Run pnpm lint`; the branch was then deleted from the remote and locally. The leftover `.worktrees/sp0-ci-red` directory has been deleted.
- The CI-red evidence now lives in the repo: `tools/lint/check.test.mjs` runs the actual ESLint binary over `apps tools`. It asserts exit 1 with `aigate/bounded-promise-all` when a violating file is in the tree, and a clean pass once it is removed. Changing the expected rule id to a fake one made the test fail, so it does not pass vacuously. `pnpm lint:check` is 9/9.

- Latest full local gate (2026-09-25, after the fan-out rerun): `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm lint:check` (9/9), `pnpm test` (54/54), `pnpm discovery validate` (283 entries), `pnpm web:build`, provider catalog test (1/1), and `git diff --check` all passed. `NINEROUTER_PATH` pointed to `.reference/9router` at `39e36d3`.

## Next concrete work

**SP0.1 integration checks remain open.** The M-1 plan's unchecked boxes are historical instructions; its execution checkpoint records completion. The execution and retry contracts are defined in §4.2. When `packages/engine` exists, implement the helper and enforce provider `execute` timeout and bounded retries. When `packages/database` exists, check repository SQL enforcement against actual Drizzle calls. Clean and deliberately violating branches passed and failed CI in the intended places. Do not create a second backend at `apps/api`: the approved layout is `apps/server`, `packages/engine`, and `packages/database`.

**SP0.2 and SP0.3 are complete locally.** The RED baseline in `docs/superpowers/skill-tests/2026-09-25-writing-lean-bounded-red.md` records three independent scenarios and the usage-query failure. The repo skill `.agents/skills/writing-lean-bounded-code` has three references, passes `quick_validate.py`, and is 364 words. GREEN and micro-test results are in `docs/superpowers/skill-tests/2026-09-25-writing-lean-bounded-green.md`. Usage: 5/5 guided agents aggregated in SQL versus 2/5 controls on the original pressure prompt. Fan-out: guided 5/5 declared an input maximum versus 0/5 controls. Cache: guided 5/5 added TTL, size cap, and invalidation versus 0/5 controls. Guided fan-out answers first used `Array.from` worker lists, which lint rejects. After `bounded-patterns.md` was patched, a 5-agent rerun produced literal worker lists, and all five were lint-clean. Known gap: 4/5 of those answers passed no deadline signal to the check call. A lint run showed the `!` non-null assertion passes lint (`no-type-assertion` covers `as` only, per spec §11); the skill and test docs were corrected to match.
**SP0.4 RED baseline is recorded** in `docs/superpowers/skill-tests/2026-09-25-porting-behavior-not-code-red.md`. Six agents without the skill ran two per spec §11.6 scenario. Each could read only `.reference/9router`.

- **A. Port a file to TS: RED 2/2.** Given `proxy-pools/[id]/route.js` with "keep it the same", both agents translated it line by line and kept the `SUSPECTED_BUG` where `validTypes` omits `deno`. One agent found the bug and shipped it "on purpose" pending a question. The other wrote a test that locks in the silent coercion to `http`.
- **B. Skip the Feature Matrix: 0/2 RED.** Both agents refused and traced the reference.
- **C. Keep `global._*`: 0/2 RED.** Both agents dropped the Next.js guards.

**SP0.5 is complete locally.** The repo skill `.agents/skills/porting-behavior-not-code` passes `quick_validate.py`, has three references (`feature-matrix.md`, `golden-scenarios.md`, `error-taxonomy.md`), and is 442 words. Results are in `docs/superpowers/skill-tests/2026-09-25-porting-behavior-not-code-green.md`:

- **Scenario A:** 5/5 guided agents held the `deno` bug and asked. 0/5 controls did; every control kept the three-type list and never mentioned `deno`.
- **Scenarios B and C:** reruns passed 2/2 each.

Caveats:
- No guided answer wrote code in one turn, as the iron law requires. The second turn, writing the Feature Matrix entry first, was not measured.
- The recoverable-error table in `error-taxonomy.md` is a proposed default. Spec §5 does not define it; confirm it when `packages/engine` is designed.

**SP0.6 is complete locally, which closes SP0's skill track.** `CLAUDE.md` now has the two `REQUIRED SKILL` lines from spec §11.5, and each names the `SKILL.md` path. The path is needed because Claude Code does not register `.agents/skills`: a fresh session listed no repo skills. Five fresh `claude -p` sessions got unfamiliar tasks that did not name any skill; transcripts are in `docs/superpowers/skill-tests/2026-09-25-skill-discovery.md`. All four coding tasks read the skills they needed, and the documentation question read none. Codex discovery was not rerun.

SP0.1's integration checks remain deferred until `packages/engine` and `packages/database` exist, as described above.

**SP1 is complete locally.** `apps/server` is a NestJS 12 + Fastify app with `GET /health`.

- NestJS 12 is ESM-only, so the server uses `"type": "module"`, `NodeNext`, and `.js` import suffixes.
- It builds with `tsc`, because `emitDecoratorMetadata` rules out tsx/esbuild. Dev runs `tsc --watch` and `node --watch` in parallel via `pnpm run "/dev:/"`, with no extra dependency.
- Production serves `apps/web/dist` on the same port through `@fastify/static`, with an SPA fallback. Unknown `/api`, `/v1`, `/v1beta`, `/codex`, and `/responses` paths and missing asset files stay JSON 404s.
- Vite proxies those paths and `/health` to the server in dev.
- **Port decision (spec §13):** the default is `20200`, overridable with `PORT` (validated 1-65535). The server binds `127.0.0.1` unless `HOST` is set. The web preview still shows the old `localhost:20128` in two copy fields (integrations and SAML); update them when those screens get real data. The npm package and CLI binary name stay open until `apps/cli`.
- New root scripts: `pnpm dev` (server and web), `pnpm build` (web then server), `pnpm start`. `pnpm test` now also runs the server tests. CI runs `pnpm build` instead of `pnpm web:build`.

Checks:
- The server tests pass 2/2: `/health`, plus single-port SPA serving with the JSON-404 exclusions. Forcing the SPA fallback to always match made the second test fail.
- Run by hand:
  - `pnpm build && pnpm start` served `/health` (JSON), `/` and `/traffic/requests` (HTML), and `/v1/nope` (404 JSON) on port 20200. A request to the LAN IP could not connect.
  - `pnpm dev` served the server on 20200 and Vite on 5173, and Vite proxied `/health`. Editing the controller restarted the server.
- Full gate passed: `pnpm install --frozen-lockfile`, `lint`, `lint:check` (9/9), `test` (discovery 54/54, server 2/2), `discovery validate` (283), `build`, catalog test (1/1), `git diff --check`.
- `pnpm@10.34.5 install --frozen-lockfile` (the CI version) passed on a clean copy of the updated lockfile, which was written by local pnpm 12.5.1.
- GitHub Actions run `36117513362` on `142be79` passed every step: install, lint, lint checks, test, discovery validate, and build.

**SP2 SPIKE-1 is done; it passes only with a design change.** The report is `docs/superpowers/spikes/2026-09-25-spike-1-sqlite-drivers.md`. The harness is `packages/database/spike/conformance.mjs`: a throwaway schema, a `drizzle-kit` migration, and 12 checks per driver.

- **Without a lock, `sqlite-proxy` loses data under concurrency.** A write issued while an async transaction is open joins it and is rolled back with it. A second transaction's `begin` fails, and rows are lost on reopen.
- **Native sync drivers are no better.** better-sqlite3 rejects async transaction callbacks. bun-sqlite and native sql-js accept them but silently lose atomicity.
- **The fix works.** Put all four clients behind one per-database lock around `sqlite-proxy`, using `AsyncLocalStorage` for statements inside a transaction and `BEGIN/COMMIT` around `batch`. With it, better-sqlite3, bun-sqlite, sql-js, and node:sqlite each passed 12/12 on Node 22.19 and Bun 1.3.14. The three Node drivers also passed on Node 24.21. Removing the lock made the isolation check fail.
- **better-sqlite3 13 needs no build tools.** It ships N-API prebuilds. `pnpm-workspace.yaml` denies its build script, because allowing it triggers an implicit `node-gyp rebuild` that fails without Visual Studio. It loads under both pnpm 12 and pnpm 10.34.5.
- Checks run: full gate passed (install frozen, lint, lint:check, test, discovery validate, build, `git diff --check`), plus a pnpm 10.34.5 frozen install on a clean copy.

**Decided 2026-09-25 (user):** route all four clients through one locked `sqlite-proxy` wrapper, with one async API, one `db` type, and one migrator. Spec §1, §1.1, and §13 were updated. GitHub Actions run `36118864061` on `fb071cd` passed.

**Driver chain is built** in `packages/database` (`@aigate/database`, ESM, `tsc`). `openDatabase({ file, migrationsFolder, driver? })` does the following:

- Picks a driver: Bun tries bun:sqlite, then sql.js; Node tries better-sqlite3, then node:sqlite, then sql.js. It records why each failed driver failed.
- Wraps the client in the locked proxy.
- Applies pragmas: WAL, `busy_timeout = 5000`, and `foreign_keys = ON`. sql.js gets foreign keys only, reapplied after each export.
- Runs migrations atomically inside `BEGIN/COMMIT`.
- For sql.js, persists through the lock with a 100 ms debounce and write-then-rename. Up to 100 ms of writes can be lost on a crash.

One reviewed `as` has an `eslint-disable`. Drizzle types proxy rows as `any[]`, but `get` with no match must pass `undefined`; `[]` would become a row of undefined fields.

Tests (`test/conformance.test.mjs`): Node runs better-sqlite3, node:sqlite, and sql.js (5/5). Bun runs bun-sqlite and sql.js (4/4). Each of these mutations made tests fail:

- removing the lock
- a non-atomic batch
- no debounced persist
- `get` returning `[]`

The spike schema is now `test/fixture/` and is not an AIGate schema; `drizzle.config.ts` points at it until the real schema lands.

Wiring changes:

- `pnpm lint` now lints `packages`; the ESLint rule globs include `packages/**`.
- `pnpm test` includes the database tests.
- CI installs Bun 1.3.14 and runs `pnpm --filter @aigate/database test:bun`.
- Full gate passed locally.
- GitHub Actions run `36119809123` on `fc4a98c` passed on Linux with Node 24 and Bun 1.3.14, including the Bun database tests.

**SP2 is complete locally. Decided 2026-09-25 (user): schema is added per bounded context**, in the SP that implements that context and after its contract exists. It is not designed upfront for all 11 9router repos.

- **Server wiring.** `apps/server` opens the database at boot through `createServer({ databaseFile, webDist? })`.
  - The file is `$AIGATE_DATA_DIR/aigate.db`; the default directory is `~/.aigate`, created with mode 0700.
  - A `DATABASE` provider plus `DatabaseShutdown` close it on `app.close()`.
  - `GET /health` runs `select 1` and returns 503 `{status:"unavailable"}` if the database fails.
  - Server tests pass 3/3. Removing `DatabaseShutdown` made the close test fail.
  - A real `pnpm build && pnpm start` with a temp data dir created `aigate.db` in WAL mode, and `/health` returned 200.
- **Migrations.** The real migrations folder is `packages/database/drizzle/`. It starts with an empty journal and is the default for `openDatabase`. A new test checks that it opens with only `__drizzle_migrations`.
- **Conventions.** `packages/database/SCHEMA_CONVENTIONS.md` has 12 rules, each citing Feature Matrix entries (all 28 ids verified). They cover:
  - typed columns instead of JSON blobs, and no kv table
  - epoch-ms UTC instants
  - app-generated ids
  - DB-enforced uniqueness mapped to 409
  - short transactions with no I/O
  - hashed or encrypted secrets
  - named retention limits
  - a buffered usage writer
  - atomic file writes

  A research agent compiled the evidence from the matrix.
- **Two discovery errors fixed:**
  - `apikey.validate-lookup` claimed `apiKeys.key` had no index. It has `UNIQUE` plus `idx_ak_key` (`schema.js:81,87`).
  - Spec §6.1 called 9router's usage write synchronous. It is fire-and-forget with swallowed errors (`usage.write-not-synchronous`). The planned buffered writer now also counts write failures.

  Discovery still validates 283 entries, and the generated outputs are unchanged.

**M1 SP5 (`settings`) is complete locally.** The contract is `docs/contracts/settings.md`. It labels every rule from the four in-scope matrix entries, now marked `parityStatus: implemented`; six other `settings.*` entries were assigned to their owning SPs.

Decisions:
- A typed single-row table, with defaults as column defaults, replaces the JSON blob.
- The dropped `outboundProxyEnabled` inference is an `IMPLEMENTATION_ACCIDENT`.
- Secrets are not settings; identity owns them.
- PATCH uses an allowlist. Unknown, secret, or wrongly typed keys return 400 with nothing changed, where 9router silently stripped two names and stored everything else.
- The cache is write-through.
- SP5 keys are only `requireLogin` and `requireApiKey`. Later contexts add theirs by migration.

Changes:
- **Schema:** `packages/database/src/schema/settings.ts`, with `CHECK id = 1`. The first real migration is `drizzle/0000_lonely_patriot.sql`, and `drizzle.config.ts` now points at `src/schema`.
- **Server:** `modules/settings/{domain,infrastructure}` and `SettingsModule`. `DATABASE` is now a global `DatabaseModule`.
- **Access:** until identity lands in SP6, every `/api/*` route answers loopback clients only; others get 403. SP6 must replace this with the dashboard guard.
- **Deferred SP0.1 check done:** `aigate/bounded-query` now checks Drizzle chains. `select()` without columns is flagged, and a `select(...).from(...)` chain must end in `.limit()` or `.get()`. There are new `lint:check` tests (10/10). Removing `.get()` from the real repository is reported.

Tests:
- Server 7/7, database 6/6.
- Mutations of the loopback guard, the cache update, and `no-store` each made a test fail.
- **Test gap found and fixed.** Disabling the allowlist first went unnoticed, because every unknown key in the test had a non-boolean value and the type check caught it. Cases `{somethingNew:true}` and `{id:true}` now fail when the allowlist is off.

The M-1 gate test used to require every entry to stay exactly `traced`. It now accepts `traced` or later (`contracted`, `implemented`, `verified`), because SPs advance entries. The full gate passed: discovery 54/54, database 6/6, server 7/7, `lint:check` 10/10, Bun tests, build, and `git diff --check`.

**M1 SP6 (`identity` + `apikeys`) is complete locally, and the UI is wired to it.** The contract is `docs/contracts/identity-apikeys.md`.

The user decided four things on 2026-09-25:
1. API keys are `aigate_` + 32 random bytes; only the SHA-256 and the last 4 characters are stored.
2. There is no default password. The first password is set locally (`POST /api/auth/setup`) or from `AIGATE_INITIAL_PASSWORD`.
3. Sessions live in the database (a random cookie token whose hash is stored, with a 24 h expiry), not in a JWT. Spec §4.4 and §13 were updated.
4. `requireLogin=false` exempts local clients only.

"Local" means a loopback socket plus a loopback `Host` and `Origin`, which stops DNS rebinding.

Matrix:
- Added `identity.password-login-lockout`; the password lockout had no entry.
- 13 entries are now `implemented`. `endpoint.enforce-require-api-key` is `contracted`, because the `/v1` gate lands in SP12.

Server:
- **Global guard.** A global `DashboardAuthGuard` (`APP_GUARD`) denies every route unless it is `@Public()`. It replaced the SP5 loopback-only hook.
- **Auth routes.** `/api/auth/{status,setup,login,logout,password}`. Login lockout (5 failures, then 30 s, 2 min, 10 min, 30 min; a 1 h reset window) is capped at 10,000 clients. Password change revokes every other session.
- **Passwords and sessions.** scrypt from `node:crypto`; verification accepts only this build's parameters. At most 20 sessions are kept, and expired ones are deleted on each login.
- **Recovery.** `AIGATE_RESET_PASSWORD=true` at boot; there is no HTTP reset route.
- **API keys.** `/api/keys` offers list, create (the key is shown once), enable/disable, and delete. At most 100 keys. `ApiKeysRepository.isValid` and `extractApiKey` are exported for SP12.
- **Schema.** Migration `0001` adds `api_keys`, `dashboard_password`, and `sessions`.

Security review (agent, read-only):
- Fixed: Nest's urlencoded body parser is off (`bodyParser: false`), so cross-site HTML forms get 415. Stored scrypt parameters are checked.
- **Decided (option A):** on a machine shared with other OS users, another user could race to set the first password. The user chose to rely on `AIGATE_INITIAL_PASSWORD`; set it before the first start on shared machines. A one-time setup code is deferred until `apps/cli` or server deployments need it (contract, "Shared machines").

UI wiring (layouts kept; `apps/web/CLAUDE.md`):
- **Shared.** `shared/api.ts` is a same-origin JSON client with a 10 s timeout and `{code, message}` errors. Queries retry only on errors other than 4xx.
- **Settings feature.** `features/settings/api.ts` holds auth and settings hooks. The `Login`, `Onboarding` step 1, and `SettingsAuth` screens are wired: change password, the two toggles, and sign out. "Current password" is now a real input.
- **Gateway feature.** `features/gateway/api.ts` backs `EndpointKeys`: the real origin base URL, the key list with loading, empty, and error states, a create modal that shows the key once, disable/enable, and revoke through type-to-confirm.
  - Dropped the untracked "Last used" column and the "Reject legacy keys" toggle; neither has data.
  - The pill now says "Chat API pending".
- **Shell.** `Shell` routes to `/welcome` or `/login` from `/api/auth/status`.
- **Onboarding is one step (user decision, 2026-09-25).** Set the dashboard password, then open the dashboard. The Stitch Connect and Verify steps were removed because a provider is not required at first run; providers are connected later from the Providers screens. A browser check on a fresh data dir went from `/welcome` straight to the dashboard.

Checks:
- Server tests pass 22/22. 13 mutations each made a test fail:
  - the guard
  - the `requireLogin` locality check
  - the Host and Origin checks
  - lockout counting
  - revoking on password change and on logout
  - the session cap
  - the active-key check
  - the key limit
  - local-only setup
  - the urlencoded parser
- Full gate passed: install frozen, lint, `lint:check` 10/10, discovery 54/54 (284 entries), database 6/6, Bun, build, catalog 1/1, `git diff --check`.
- Browser e2e (Playwright, production build, temp data dir) walked the whole flow:
  - `/` redirected to `/welcome`; a password mismatch was caught without calling the server; setup, then the dashboard.
  - A key was created, shown once, then listed masked with no plaintext left on the page; disabled; revoked.
  - A wrong current password showed a toast with the attempts left; a correct change kept the session.
  - Sign out, the old password rejected, the new password accepted.
  - The only console errors were a missing `favicon.ico` (404), which predates this work.

**Error handling and the API-to-UI map (2026-09-25).**
- `apps/web/src/shared/api.ts` turns every failure into an `ApiError` with a stable code: `NETWORK_ERROR`, `TIMEOUT`, `BAD_RESPONSE`, or a server code.
- `shared/errors.ts` (`toProblem`, unit-tested) holds the one code-to-message table.
- A 401 `UNAUTHENTICATED` fires a session-ended event: the shell shows "Your session ended" and redirects to `/login`. A deliberate sign-out does not show it; both cases were checked in the browser.
- Failed mutations re-read the server.
- `docs/design/API_UI_MAP.md` is the living map from each API to its screen and error handling. `CLAUDE.md` now requires wiring the screen in the same SP as its API.

**M1 SP7 (`engine`) is complete locally.** The contract is `docs/contracts/engine.md`. `packages/engine` has zero npm imports; the dependency-cruiser rule `engine-framework-free` is proven by a `lint:check` fixture, now 11/11. It holds:
- **CIP core:** superset types, `vendorExtensions`, and `UnsupportedFeatureError`.
- **Error taxonomy:** the 8 codes, with `FALLBACK_POLICY` as data.
- **Registry:** `defineRegistry()` validation, and one entry, `openai`, with 4 chat models taken from 9router data.
- **Capabilities:** declared capabilities are final; undeclared models get the floor plus the additive vision heuristic, which checks `NOT_VISION` first. `detectRequiredCapabilities` scans every message and the system prompt. `assertModelSupports` returns `MODEL_UNAVAILABLE` or `INVALID_REQUEST`.
- **`withRetry`:** the bounded retry helper deferred from SP0.1. It allows at most 10 attempts, a capped backoff, an abortable wait, and no retry after an abort.
- **Ports:** `AIProviderPort` and `ExecCtx`.

Checks and status:
- Engine tests pass 15/15, and 10 mutations each made a test fail.
- Matrix: 3 capability entries are `implemented`, and 2 registry entries are `contracted`.
- **No UI:** SP7 has no HTTP API.
- **Decided (user, 2026-09-25):** capability detection scans every message and the system prompt, not only the trailing user turn as 9router did (`SUSPECTED_BUG` in the contract).
- **Gap:** M0 SP3 (the parity harness) and SP4 (`tools/extract`) were never built; SP13 and the parity gates need them.

**Knowledge graph refreshed (2026-09-25).** `graphify-out/graph.json` now has 466 nodes, 1272 edges, and 17 communities. `docs/PROJECT_MAP.md` was regenerated.

- **Corpus:** the original 7 docs plus `API_UI_MAP.md`, `UI_HANDOFF.md`, the three contracts, and this handoff, 13 files in total.
- **What it adds:** API endpoint nodes with a `status` of `wired` or `waiting:<SP>`, linked to their screen, hooks, contract, bounded context, SP, and UI error codes. For example, `POST /api/keys` links to `useCreateKey`, the SP6 contract, and `LIMIT_REACHED`.
- **Not re-extracted:** the Stitch HTML and PNGs and the Feature Matrix YAML. Together they would need about 30 agents; run a full `/graphify docs` when needed.
- **Python:** use `C:\Users\PC\AppData\Local\Programs\Python\Python312\python.exe`. The `python` on PATH is a venv without graphify.
- **After each SP:** write a hand-authored `graphify-out/.graphify_chunk_NN.json` (nodes carry `status`; SP nodes use the task-board status), then run `graphify-out/merge_chunk.py merge <chunk> [stale,ids]`, label the printed communities, run `merge_chunk.py finish <labels.json> <new doc> "<note>"`, then `build_project_map.py`.

**M1 SP8 (`transport`) is complete locally.** The contract is `docs/contracts/transport.md`.

- **Port.** `HttpTransportPort` (`HttpRequest`, which requires `timeoutMs`, and `HttpResponse`) plus `readBoundedText` (default 4 MiB) are in `packages/engine`.
- **`DirectTransport`.** It lives in `apps/server/src/modules/transport` and is injected under `HTTP_TRANSPORT`. It enforces:
  - https only, or http to loopback
  - `timeoutMs` from 1 to 600000, inside `ctx.signal`, covering the headers and the body
  - redirects are never followed
  - a caller abort keeps its reason; the timeout becomes `TIMEOUT`; network failures and redirects become `PROVIDER_UNAVAILABLE`
  - body read errors are mapped the same way
  - errors name the host only
- **The rest of the deferred SP0.1 rule is now enforced in lint.**
  - `aigate/fetch-through-transport` rejects `fetch` in the server and packages outside `modules/transport/infrastructure`.
  - `aigate/retry-through-helper` rejects a loop around an awaited `try/catch` in the server and engine (except `retry.ts`).
  - `aigate/fetch-timeout` accepts `AbortSignal.any([..., AbortSignal.timeout(n)])`.
  - `lint:check` is 13/13.
- **Checks.** Transport tests pass 10/10 against a real local HTTP server, with 6 mutations caught. The mutation that dropped the timeout hung the run instead of failing it, so the server, engine, and database test scripts now pass `--test-timeout=30000`.
- **Matrix.** `transport.proxy-priority-chain` is `contracted`; its relay and proxy branches come in SP18.
- **UI.** No UI, as recorded in `API_UI_MAP.md`.

**M1 SP9 (`engine`: OpenAI-compatible provider adapter) is complete locally.** The contract is `docs/contracts/provider-openai.md`.

- **Adapter.** `OpenAICompatibleAdapter(provider, transport)` in `packages/engine/src/adapters/openai-compatible.ts` implements `AIProviderPort`. There is no default provider config, so an unknown provider cannot inherit OpenAI settings (`routing.default-executor-openai-fallback` is a `SUSPECTED_BUG`).
- **Mapping.** CIP maps to and from chat completions. What OpenAI cannot carry throws `UnsupportedFeatureError` before any I/O: video, audio or files by URL, assistant thinking, `tool_result.isError`, `reasoning.budgetTokens`, and non-`openai` vendor extensions. `cacheControl` is the one hint left out.
- **Usage.** Now normalized in `cip.ts`: `inputTokens` excludes cache reads.
- **Errors.** Classified by status plus `error.code`/`error.type` only, never by message text. `insufficient_quota` gives `QUOTA_EXHAUSTED`, and `model_not_found` gives `MODEL_UNAVAILABLE`. Messages are at most 300 characters, the credential is redacted, and HTML pages are dropped. An API key with whitespace or control characters is `AUTH_ERROR` before I/O.
- **Retries.** 502, 503, 504, and an unreachable host get at most 3 attempts through `withRetry` (500 ms, then 1000 ms), and only before the stream starts. 429, 500, `TIMEOUT`, and redirects are never retried in place.
- **Streaming.**
  - `readSseData` (`packages/engine/src/sse.ts`) caps a line or an event at 1 Mi characters, splits only the new bytes so a slow drip costs linear time, and cancels the body on an early stop or an error.
  - A stream that ends with neither `finish_reason` nor `[DONE]`, or that sends an error event, throws `PROVIDER_UNAVAILABLE` with `details.partial`.
  - Usage is emitted before `stop`.
- **Port change.** `getModels` returns `ListedModel { id, descriptor? }`. Unknown ids carry no invented limits, and at most 1000 are read. `validateCredential` makes one call and returns `valid: false` only for `AUTH_ERROR` or `QUOTA_EXHAUSTED`; a network failure or 5xx is thrown.
- **Checks.**
  - Engine tests pass 30/30. The 15 new adapter tests use a fake transport, with SSE split every 3 bytes, including inside UTF-8.
  - Server tests pass 33/33, including one end-to-end stream over `DirectTransport` against a local HTTP server.
  - 16 mutations were run and all were caught. One first survived: the tool-index bound was only failing through the truncated-stream error, so the test was tightened.
- **Matrix.**
  - `implemented`: `fallback.upstream-error-result` and `fallback.executor-retry-budget`.
  - `contracted`: `fallback.error-classification`, `fallback.partial-stream-failure`, `routing.default-executor-openai-fallback`, `routing.non-streaming-response`, and `routing.streaming-pipeline`.
- **UI.** No UI, as recorded in `API_UI_MAP.md`. The first screens come later:
  - `validateCredential` backs "Test connection" on `/providers` in SP11.
  - Adapter errors reach clients through `/v1` in SP12.

**M1 SP10 (`engine`: OpenAI Chat Completions protocol adapter) is complete locally.** The contract is `docs/contracts/protocol-openai.md`.

- **Code.** Pure functions in `packages/engine/src/protocols/openai-chat.ts`: `parseOpenAIChatRequest`, `toOpenAIChatCompletion`, `OpenAIChatStreamEncoder`, and `toOpenAIError`. Shared JSON narrowing now lives in `src/json.ts`, which the provider adapter uses too.
- **Inbound.**
  - Every malformed field is `INVALID_REQUEST` with `details.param` naming it (for example `messages[3].content`). Unknown message fields are rejected, as OpenAI does.
  - Valid OpenAI that CIP cannot carry is `UnsupportedFeatureError`: `file_id`, a system message mid-conversation, the message `name`, the legacy function role and `function_call`, assistant refusal or audio, custom tools, and `allowed_tools`.
  - Unknown top-level fields (at most 64) go to `vendorExtensions.openai`, and so does a non-standard `reasoning_effort`.
  - `null` counts as unset. `n` must be 1.
  - Bounds: 10,000 messages, 512 parts, 128 tools, 128 tool calls, 4 stop strings. A `data:` URL is split at the first comma, never regex-scanned.
- **Stream flag.** An omitted `stream` means JSON. `routing.stream-mode-decision` is a `SUSPECTED_BUG` and is now `implemented`.
- **CIP.** Image `detail` and tool `strict` were added, so an OpenAI → OpenAI trip keeps them. The provider adapter maps both.
- **Outbound.**
  - `chat.completion`: `thinking` becomes `reasoning_content`, and both are kept. `prompt_tokens` includes cache reads and writes.
  - Streaming: usage comes after the finish chunk, and only with `include_usage`. `end()` sends `[DONE]`. `fail()` sends one error event and no `[DONE]`, so a cut-off answer is visible to the client.
- **Errors.** `toOpenAIError` gives one status, type, and code per `ErrorCode`.
  - An upstream `AUTH_ERROR` becomes **502 `upstream_auth_error`**, not 401, so a client does not blame its own AIGate key.
  - A safe upstream code such as `context_length_exceeded` is kept.
  - A non-`EngineError` or `INTERNAL_ERROR` returns only "Internal error".
- **Not ported.** Tool-id normalization and empty tool answers (`translator.tool-id-normalization`) belong to the Anthropic adapters in SP15. An invented tool answer would be fabricated content.
- **Checks.**
  - Engine tests pass 42/42; there are 12 new protocol tests, including round trips through `OpenAICompatibleAdapter` for JSON, SSE, and a cut-off stream.
  - 20 mutations were run and all were caught.
- **Matrix.** `routing.stream-mode-decision` is `implemented`. `routing.source-format-detection`, `routing.request-translation`, and `translator.pivot-loss` are `contracted`.
- **UI.** No UI, as recorded in `API_UI_MAP.md`. SP12 mounts these functions on `/v1/chat/completions`, which the `/gateway/endpoint` "Chat API pending" pill waits for.

**M1 SP11 (`connections`) is complete locally, with the UI wired.** The contract is `docs/contracts/connections.md`.

- **Decisions (user, 2026-09-25).**
  - Keys use AES-256-GCM with a key file and an env override.
  - OpenAI is the only provider, with one API-key account per provider.
- **Secret storage.**
  - `apps/server/src/secret-cipher.ts` holds `SecretCipherPort`, `AesGcmCipher`, `loadSecretKey`, and a global `SecretsModule` (`SECRET_CIPHER`).
  - The format is `v1.` + IV‖tag‖ciphertext, with AAD `provider_connections:<id>:api_key`.
  - The key comes from `AIGATE_SECRET_KEY` (hex or base64), or otherwise from `secret.key` next to the database. That file is created once through a temp file plus an exclusive link (mode 0600). A bad file stops startup and is never overwritten.
- **Database.** Migration `0002` adds `provider_connections`:
  - Typed columns, `provider` UNIQUE, and a CHECK on `test_status`.
  - The key is stored sealed; only the last 4 characters are in clear.
- **Server.** The module `modules/connections`:
  - A pure domain parser (unknown fields are 400).
  - A repository with an allowlisted view. Create uses `onConflictDoNothing` and returns 409 `ALREADY_CONNECTED`. A new key resets the status to `untested`.
  - `POST /:id/test`: decrypt, then `OpenAICompatibleAdapter.validateCredential` outside any transaction (20 s budget). The result is written only if the sealed key is unchanged. `CREDENTIAL_UNREADABLE` is 409.
  - `TransportModule` is now a global `TransportModule.with(transport?)`, and `createServer` takes `{ secretKey, transport }`. Tests pass a fake transport.
- **UI.**
  - `features/providers/api.ts` holds the hooks.
  - `test-result.ts` maps status to a pill and a toast; only `invalid` and `no_quota` blame the key.
  - `Connections`: a real table with Test, Replace key, Disable/Enable, and Delete, plus a Needs-attention tab and an Add modal that saves, then tests. The fixture rows, the Strategies tab, and the Quota column were removed.
  - `ProviderDetail`: a live Connection panel, or "Not supported yet".
  - `LlmProviders`: a Connected pill.
  - `shared/api.ts` accepts `timeoutMs`, used for the 25 s test. The `TIMEOUT` toast shows the real number of seconds.
  - `errors.ts` gains `PROVIDER_NOT_SUPPORTED`, `ALREADY_CONNECTED`, and `CREDENTIAL_UNREADABLE`.
- **Checks.**
  - Server tests pass 43/43 (7 connection tests, 3 cipher tests). Web tests pass 7/7.
  - 16 mutations were caught. One more mutation was a non-mutant: `linkSync` cannot overwrite, so a renameSync variant was used instead.
  - Live smoke test on port 20299, against the real OpenAI API: a fake key was saved sealed, the test returned 401, the row showed "Key rejected", and an `AUTH_ERROR` toast appeared. The provider detail pages showed the connected and "Not supported yet" states.
- **Matrix.**
  - `implemented`: `connection.storage-shape-json-blob`, `catalog.connection-listing`, `catalog.connection-detail-crud`, and `connection.test-single-connection`.
  - `contracted`: `connection.create-dedup-and-priority-assignment`, `connection.client-listing-sanitized`, and `connection.delete-and-reorder`.

**M1 SP12 (`routing`: the `/v1` chat lane) is complete locally, with the UI wired.** The contract is `docs/contracts/chat-lane.md`. The M1 slice (one streaming chat endpoint, a valid API key, one provider) works end to end.

- **Routes.** `POST /v1/chat/completions` and `GET /v1/models` are registered directly on Fastify (`modules/routing/infrastructure/v1-routes.ts`), outside the dashboard session guard. The chat body limit is 16 MiB; the rest of the server keeps 1 MiB.
- **Key gate (`onRequest`, before the body is read).**
  - With `requireApiKey` on, a missing or invalid key is 401 (`missing_api_key` / `invalid_api_key`).
  - With it off, only this machine is served (`isLocalRequest`: loopback socket, `Host`, and `Origin`). Anything else is 403 `api_key_required`. This is a `SUSPECTED_BUG` fix: 9router served every host, and DNS-rebinding pages, when keyless.
  - There is no CORS on `/v1`, and `Content-Type: application/json` is required (415 otherwise).
- **Model resolution.**
  - `provider/model` accepts any model id for a registry provider.
  - A bare id must be declared in the registry.
  - Unknown models are 404 `model_not_found`, with both accepted forms in the message.
  - Without an active connection the answer is 404 `no_active_connection`. A key that can no longer be decrypted is 500 `credential_unreadable`.
  - `assertModelSupports` runs before any upstream call.
- **`ChatLane` (`chat-lane.ts`).**
  - One `ExecCtx.signal` combines the client disconnect (the response `close` event), a 600 s budget whose reason is `EngineError TIMEOUT`, and, for streams, the idle watchdog.
  - JSON responses go through `execute` and `toOpenAIChatCompletion`.
  - Streams wait for the first chunk before sending any header, so an early failure is a real JSON status. Then `reply.hijack()` and `text/event-stream`.
  - Writes respect backpressure: a false `write()` waits for `drain`, and the wait ends if the client leaves.
  - The idle timeout, `AIGATE_STREAM_IDLE_TIMEOUT_MS` (default 300 000, allowed 1 000–600 000), aborts the upstream with `TIMEOUT` and sends an error event.
  - A mid-stream failure sends `encoder.fail` and no `[DONE]`. The upstream body is always cancelled.
  - Expected failures are not logged; bugs are, with the request id only.
- **Connections.** `ConnectionsRepository.activeKey` and `activeProviders` were added. An active connection is used even if it is untested.
- **UI.** `/gateway/endpoint`:
  - A readiness pill from the shared `["connections"]` query: Ready, Connect a provider, or Check connection, with a link to Connections.
  - A copyable curl test request using `openai/gpt-4.1-mini`.
  - The format labels were cut to OpenAI; the others come with SP15.
  - The Require API key row now says "When off, only this machine can call the chat API".
- **Checks.**
  - Server tests pass 53/53, with 10 new chat-lane tests. Three of them run on real sockets: client disconnect, backpressure (a paused reader stops the upstream reads), and the idle timeout.
  - 11 mutations were run and all were caught: backpressure, disconnect, idle timer, key gate, local-only keyless, headers before the first chunk, swallowed mid-stream error, content-type, disabled connection, capability check, prefix stripping.
  - Live smoke on port 20299 against the real OpenAI API:
    - `/v1/models` listed `openai/*`.
    - No key gave 401.
    - With a fake upstream key, JSON and stream requests both gave 502 `upstream_auth_error` with an `x-request-id`.
    - The endpoint pill showed "Check connection".
  - A successful chat needs a real OpenAI key: add one in Connections, then run the Test request.
- **Matrix.**
  - `implemented`: `endpoint.enforce-require-api-key`, `routing.request-preflight`, `routing.client-disconnect-propagation`, `routing.streaming-pipeline`, and `fallback.partial-stream-failure`.
  - `contracted`: `routing.lane-entry-routes`, `routing.model-resolution`, `fallback.accounts-exhausted-response`, and `catalog.model-listing-live-override`.

**M0 SP3 (the parity harness) is complete, and the M1 gate passed.** The contract is `docs/contracts/parity.md`; the report is `docs/parity/m1-gate-report.md`.

- **Harness.** `tools/parity/` is dev-only. `pnpm parity record | replay | live | gate`.
  - `vendor.mjs`: a scripted OpenAI-compatible vendor that records upstream requests, with secrets masked.
  - `record.mjs`: tapes from a running 9router.
  - `normalize.mjs`: the semantic view; SSE is compared by meaning, not by chunk.
  - `replay.mjs`: tier 1 `judge` and tier 3 drift.
  - `live.mjs`: tier 2 against OpenAI with `OPENAI_API_KEY`.
  - `coverage.mjs`.
  - `pnpm test` runs `tools/parity/test/parity.test.mjs`, so CI replays the committed tapes.
- **Recording.** Done from the user's running 9router **0.5.55** at `localhost:20128`. The matrix was traced at 0.5.86.
  - A temporary OpenAI-compatible node, a connection, and a client key, all named `AIGate parity (temporary)`, are created and then deleted by `cleanup()` before and after each run. 9router's code and settings are untouched.
  - Recording uses a per-scenario model id, because 9router locks accounts per model.
  - Each request sends `x-9router-token-saver: off`, because that instance had Token Saver on, which injects a system prompt.
  - This deviates from spec §8.2 (`outboundProxyUrl`): a forward proxy cannot read HTTPS without a MITM CA, so the node's `baseUrl` points at the local vendor instead.
- **Findings, declared as labeled deviations and written into the matrix.**
  - 9router adds **2000 tokens** to the prompt and total usage it reports (`addBufferToUsage`). `routing.non-streaming-response` is now `SUSPECTED_BUG`.
  - It invents usage for streams that did not ask for it.
  - With no `stream` flag, it sends the JSON answer as `text/event-stream` plus a bare `[DONE]`, which cannot be parsed.
  - A cut stream ends silently.
  - Error bodies have no `type`/`code`, and the message leaks the node id and the raw upstream body.
  - An upstream 401 is passed through as 401.
  - `stream-text` matches exactly.
- **Golden scenarios.** `apps/server/test/golden.test.mjs` has 13, at M1 scope: 10 pass, and 3 are skipped with reasons (token refresh SP16, account failover SP17, provider fallback SP17/19). Shared lane fakes moved to `apps/server/test/lane-helpers.mjs`.
- **Gate result.**
  - Tier 1: 11/11 PASS.
  - Tier 3: 3 expected warnings (`stream_options`, an explicit `stream: false`).
  - Tier 2: not run yet; it needs `OPENAI_API_KEY` and `pnpm parity live`.
  - Coverage: 11/284 capabilities by tape.
- **Checks.** The harness tests pass 5/5. Three mutations were caught: AIGate buffering usage like 9router, a 401 passed through, and the normalizer ignoring the terminal. The full gate is green.

**M0 SP4 (`tools/extract`) is complete.** The contract is `docs/contracts/registry-extract.md`.

- **Output.**
  - `packages/engine/src/catalog/providers.generated.ts`: `CATALOG`, 121 providers and 935 models from 9router 0.5.86 (`39e36d3d`), exported from `@aigate/engine`.
  - `catalog/schema.ts`: `CatalogProvider`, `CatalogModel`, `CATALOG_PROTOCOLS`, `validateCatalog`.
  - The runtime is **unchanged**: `builtinRegistry` still holds only OpenAI. SP13 switches it.
- **Tool.**
  - `tools/extract`: `pnpm extract` imports 9router's registry and its own `getCapabilitiesForModel` with no install, then writes the file. `pnpm extract verify` diffs against the raw source, independently of the mapper.
  - It stays until SP13 is done, then is deleted (spec §2), because SP13 may add catalog fields.
- **Rules.**
  - Protocol comes by family from `transport.format` (no transport → `service`).
  - `auth.kinds`: api-key, oauth, cookie, or none.
  - `chatUrl` is the full URL; an empty one (Azure) is `null`.
  - Capabilities come from 9router's tiers. Limits are copied **only when declared**. The floor's invented 200000/64000 becomes `null`, found with an in-memory sentinel and checked by an independent probe.
  - Model ids are unique per `(kind, id)`: Gemini 2.5 is both chat and stt.
  - `unmodelled` lists field **names only**, never values; no OAuth secret is copied.
- **Result.** Verify found 0 differences, `validateCatalog` 0 problems, and 254 models have no declared limits.
  - By protocol: openai-compatible 63, service 38, anthropic 6, other families 14.
  - By auth: api-key 88, oauth 22, none 9, cookie 2.
  - **46 SP13 candidates**: openai-compatible, API key, a standard URL, not hidden.
- **Checks.** Extract tests pass 3/3 in CI (the diff, no stale file, defaults restored). Engine tests pass 46/46, with 4 catalog tests. Six mutations were caught.
- **Matrix.** `catalog.registry-build`, `catalog.registry-entry-shape`, and `catalog.model-registry-global` are `contracted`.

**M2 SP13 (the catalog becomes the runtime registry) is complete.** The contract is `docs/contracts/catalog-providers.md`.

- **Registry.** `builtinRegistry` is built from `CATALOG` in `packages/engine/src/builtin-registry.ts`. **41 of 121** providers are connectable; `unsupportedReason()` gives every other one a reason the UI shows (adapter SP14, OAuth SP16, per-account URL, forceStream, the Cline envelope, hidden, services SP22/23).
  - SP4 counted 46 candidates; 5 drop out on `forceStream` or `clineEnvelope`. OpenAI is the one `forceStream` exception (`IMPLEMENTATION_ACCIDENT`: its API answers non-streaming, and the SP3 tapes replay that way).
  - `ProviderDescriptor` is `chatUrl`, `modelsUrl`, static `headers`, `aliases`, `auth { header, scheme }`. `providers/openai.ts` is deleted.
  - Limits may be `null`. An output limit above the context window (tencent hunyuan: 262144 > 200000) is not trusted and becomes `null`.
- **Adapter.** Calls `chatUrl`/`modelsUrl` directly. Catalog headers first, the key last, so a catalog header never replaces it; a `raw` scheme sends the key alone.
- **`/v1` resolution.** `provider-or-alias/model`; a non-connectable catalog prefix is 400 `provider_not_supported` with the reason; a bare id goes to the first declaring provider **with an active connection** (`glm-5` has six), else 404 `no_active_connection` naming three. A `/` whose prefix names no provider is part of the id (`zai-org/GLM-5.2`).
- **API.** `GET /api/providers` (all 121, with `connectable` and `reason`) and `GET /api/providers/:id` (+ `chatUrl`, models; 404 `NOT_FOUND`) in the new `catalog` module. `GET /api/connections/providers` is removed. `PROVIDER_NOT_SUPPORTED` now carries the catalog reason, or "is not in the catalog".
- **UI, wired.** `/providers` (`LlmProviders`) lists the 77 non-service, non-hidden providers from the API, grouped by category, with Connected / Coming later pills. `ProviderDetail` shows the Connection panel or the reason, plus a Models table (`not declared` for unknown limits). The Connections Add modal lists the 41 connectable providers; a `?provider=` that cannot be connected shows its reason. `features/providers/catalog.ts` keeps only the media lists.
- **Checks.** Engine 47/47, server 65/65 (new `test/catalog.test.mjs`, new resolution tests), web 7/7, parity 5/5, extract 3/3, discovery 54/54; `pnpm lint`, `pnpm build`, `pnpm discovery validate` (284) all pass. 13 mutations were caught, 0 survived: bare id ignoring connections, unknown prefix rejected, blocked prefix falling through, empty model, aliases off, the not-supported message, the catalog reason, the kind mapping, catalog headers dropped, headers overriding the key, raw scheme as bearer, the OpenAI stream exception, the tencent sanitizer.
- **Matrix.** `catalog.registry-build` and `catalog.registry-entry-shape` are `implemented` (`catalog.connection-listing` already was). `routing.model-resolution` stays `contracted` until combos (SP19).

**M2 SP13b (custom OpenAI-compatible providers) is complete.** The contract is `docs/contracts/custom-providers.md`.

- **Matrix first.** New entry `connection.provider-node-create-list` (GET/POST `/api/provider-nodes` and the `<prefix>/<model>` rule). Three `SUSPECTED_BUG` rules there were **not ported**:
  - a missing `baseUrl` defaulting to api.openai.com (the custom key would go to OpenAI): `baseUrl` is required
  - a pasted `/chat/completions` doubling the path: it is stripped, like the sibling node types do
  - reserved, duplicate, or slash-containing prefixes stored and then unreachable: refused at save
  - `connection.provider-node-update-delete`'s copy of node fields onto connections is an `IMPLEMENTATION_ACCIDENT`; connections store only the node id.
- **Storage.** Table `provider_nodes` (migration `0003`: id, name, unique prefix, base_url, timestamps), at most 100 (count + insert in one transaction). Delete removes the node's connection and sealed key in the same transaction.
- **API.** `GET/POST /api/provider-nodes`, `PATCH/DELETE /api/provider-nodes/:id` in the `connections` module. Errors: 400 `INVALID_REQUEST` naming the field, 409 `PREFIX_RESERVED` (any catalog id or alias), `PREFIX_TAKEN`, `NODE_LIMIT`, 404 `NOT_FOUND`. The base URL must be https, or http to this machine, with no credentials, query, or fragment.
- **Connections and `/v1`.** Connections accept a custom provider id; its test calls `GET <baseUrl>/models`. `/v1` resolves `<prefix>/<model>` after built-in ids, aliases, and catalog prefixes, with one indexed lookup. Custom providers declare no models, so they serve no bare id and are not in `/v1/models`.
- **UI, wired.** `/providers` Custom providers section (`features/providers/custom.tsx`): cards with Connect, Edit, Delete (the confirm says the connection and key go too). `/providers/new` is a real form (edit with `?id=`); save goes to the Add connection modal with the new provider preselected. The Anthropic compatible option is disabled until SP14. Browser smoke test on the production build: PREFIX_RESERVED toast, create, the preselected modal (42 providers), delete.
- **`tools/extract` deleted** (spec §2) with its test filter, script, and lockfile entry. `providers.generated.ts` stays; `docs/contracts/registry-extract.md` says how to restore the tool from git (`d2783c1`).
- **Checks.** Server 71/71 (5 new in `test/provider-nodes.test.mjs`), web 7/7, engine 47/47, parity 5/5, database 6/6, discovery 54/54; `pnpm lint`, `pnpm build`, `pnpm install --frozen-lockfile`, `pnpm discovery validate` (285). 15 mutations were caught, 0 survived.
- **Matrix.** `connection.provider-node-create-list`, `-update-delete`, and `-repo-storage` are `implemented`; `connection.provider-node-validate-partial-ssrf` stays `traced` (no validate route).

**SP13b follow-up (2026-09-26, user decision "keep the 9router behavior").** The three `SUSPECTED_BUG` rules are now ported as 9router has them: a missing `baseUrl` defaults to `https://api.openai.com/v1`; the base URL is stored trimmed, so a pasted `/chat/completions` doubles the path (one trailing `/` is dropped when the URL is built); any prefix is stored, built-in ids and aliases win at `/v1`, and the oldest duplicate wins. Migration `0004` drops the unique prefix index for a plain `(prefix, created_at)` index. `PREFIX_RESERVED` and `PREFIX_TAKEN` are gone. The dashboard card shows an **Unreachable** pill with the reason (`/api/providers` now carries `aliases` for it). The https-or-loopback, credential, and query checks stay: they are AIGate security rules. Server tests 72/72 (a new routing-quirks test).

**M2 SP14a (Anthropic Messages adapter) is complete.** The contract is `docs/contracts/provider-anthropic.md`.

- **Matrix first.** Three entries in `11-translation-i18n.yaml`, traced by an agent over the 9router claude path: `provider.anthropic-auth-and-headers`, `translator.openai-to-claude-request`, `translator.claude-to-openai-response` (now `implemented`, 288 entries).
- **User decision (2026-09-26): correct behavior, like SP9/SP10.** Kept from 9router: `max_tokens` default 64000, at least 32000 with tools, budget + 1024, capped at the model limit; thinking budgets low 1024 / medium 8192 / high 24576; `anthropic-version: 2023-06-01` and the catalog `anthropic-beta`; x-api-key; same-role merging with tool results first; the stop-reason table; `requireClaudeToolType`. Not ported: dropped `stop`/`top_p`, `none`→`auto`, the Claude Code identity line, replaced cache markers, silent thinking removal, dropped mid-stream errors, raw non-stream stop reasons, lost cache usage, `<think>` tags, json-fence stripping, 403 counted as a valid key.
- **Engine.** `adapters/http-adapter.ts` holds the shared HTTP handling (auth, retry before the first byte, error classification, redaction); `OpenAICompatibleAdapter` now extends it with no behavior change. `AnthropicAdapter` maps CIP ↔ Messages, JSON and SSE. `createAdapter` picks by `protocol` (`"openai-compatible" | "anthropic"`). Unmodelled OpenAI fields: `user` → `metadata.user_id`, `parallel_tool_calls: false` → `disable_parallel_tool_use`, anything else → 400 `unsupported_feature` naming the field.
- **Registry.** 46 connectable providers (anthropic, glm, kimi, minimax, minimax-cn added). `claude` now says "Needs OAuth sign-in (SP16)". The connection test reads `GET …/v1/models` (free) and falls back to a 1-token message where a host has no list.
- **Server.** The chat lane and the connection test use `createAdapter`. No new API or screen: `/providers` pills and the Add modal follow `connectable`.
- **Checks.** Engine 57/57 (10 new in `test/anthropic-adapter.test.mjs`), server 76/76 (4 new in `test/anthropic-lane.test.mjs`: JSON, stream, mid-stream error, refused field, connection test), web 7/7, parity 5/5, database 6/6, discovery 54/54; `pnpm lint`, `pnpm build`. 23 mutations, all caught (two survivors at first exposed real test gaps: the default version header and tool-result ordering).

**M2 SP14b (Anthropic-compatible custom providers, stream-only providers) is complete.** Contracts: `docs/contracts/custom-providers.md` ("Anthropic-compatible") and `docs/contracts/stream-only-providers.md`.

- **Matrix first.** Three new entries, now `implemented` (291 entries): `connection.anthropic-compatible-node`, `routing.forced-stream-json-collapse`, `provider.codebuddy-request-quirks`. Coverage and capabilities regenerated.
- **User decision (2026-09-26): keep 9router on all four asks**, although "correct" was recommended: the Claude Code beta list for `claude-*` models on a node and the substring `api.anthropic.com` official-host test; the node connection test (`<base>/v1/messages`, `claude-3-haiku-20240307`, any status but 401/403 is valid); the lossy SSE→JSON collapse (reasoning dropped when there is content, a cut-off stream answered as complete, malformed lines skipped); CodeBuddy CN's system prompt swap (over 2000 characters or an agent pattern → a neutral line). The collapse buffer first had a 4 MiB cap; on a second ask (2026-09-26) the user chose 9router here too, so a stream-only answer is read without a size limit (the 600 s transport deadline still applies). Not ported, and not asked: the `sk-ant-oat` Claude Code cloaking (AIGate never disguises traffic; OAuth is SP16).
- **Storage.** Migration `0005`: `provider_nodes.type` (`openai-compatible` default | `anthropic-compatible`). Ids are `<type>-<12 hex>`.
- **API.** `POST /api/provider-nodes` takes `type`; PATCH refuses a `type` change (`INVALID_REQUEST`) and now answers 404 before reading the body. An Anthropic base defaults to `https://api.anthropic.com/v1`, and one trailing `/` then `/messages` are removed on create and update. `/v1` matches OpenAI-compatible prefixes first, then Anthropic-compatible, oldest first within a type.
- **Engine.** `ProviderDescriptor.streamOnly` and `anthropicNode { official }`. `OpenAICompatibleAdapter.execute` streams and collapses for `streamOnly` (a JSON answer is still read as JSON); an error event keeps its 4xx/5xx status (`classifyStatus` is now exported). CodeBuddy quirks `reasoningSummary` and `neutralAgentPrompt` come from `EXECUTOR_QUIRKS` in `builtin-registry.ts`. `AnthropicAdapter` sends the node beta header and runs 9router's node connection test; `HttpProviderAdapter.request` adds `Authorization: Bearer` for a third-party node. `ANTHROPIC_VERSION` is exported.
- **Registry.** 49 connectable (codebuddy-cn, codebuddy-intl, api-airforce added); the "Only answers streaming requests" reason is gone.
- **UI, wired.** `/providers`: `+ Anthropic compatible` opens `/providers/new?type=anthropic-compatible`; cards show the protocol; the Unreachable rule moved to `features/providers/node-rules.ts` (OpenAI-compatible prefixes win). `/providers/new`: protocol select (fixed when editing), base URL hint and placeholder per protocol, "How it works" states the lenient 9router test. Browser check on the production build (port 20231, temp data dir): the http base URL toast (`INVALID_REQUEST` message), create with a pasted `/messages` (stored without it), the Add modal preselected with 50 choices (49 + the node), the `PROVIDER_UNAVAILABLE` "Could not check the key" toast and Not checked pill for an unknown host, the Unreachable pill once an OpenAI node took the prefix, the locked protocol on Edit; `GET /api/providers` has 49 connectable, the stream-only providers show no "Coming later".
- **Checks.** Engine 65/65 (8 new: collapse, errors, JSON fallback, CodeBuddy quirks, node headers, node test), server 81/81 (5 new: 2 in `provider-nodes.test.mjs`, 3 in the new `stream-only.test.mjs`), web 8/8 (new `node-rules.test.mjs`), database 6/6, parity 5/5, discovery 54/54; `pnpm lint`, `pnpm build`, `pnpm discovery validate` (291). 34 mutations: 31 caught at first; the 3 survivors (first usage wins, first tool id wins, `thinking.display` ignored) exposed test gaps, now closed, all 34 caught.

**M2 SP14c (OpenAI Responses adapter) is complete.** Contract: `docs/contracts/provider-openai-responses.md`; custom providers: `docs/contracts/custom-providers.md` (apiType).

- **Matrix first.** Four new entries, now `implemented` (295 entries): `translator.openai-to-responses-request`, `translator.responses-to-openai-stream`, `routing.responses-non-stream-answer`, `connection.provider-node-api-type`. Coverage and capabilities regenerated.
- **User decision (2026-09-26), mixed.** Corrected: the non-streaming answer (9router always sends `stream: true`, then parses Responses SSE with the chat parser and returns an empty message); AIGate sends `stream: false` and reads the Responses object (reasoning, text, refusal, tool calls, incomplete → `max_tokens`, failed → `PROVIDER_UNAVAILABLE`, usage with cache and reasoning tokens). Kept from 9router: the request drops (`tool_choice`, `stop`, `response_format`, `parallel_tool_calls`, `user`, … silently), parts without a Responses form as JSON text, bad arguments → `{}`, names cut to 128, call ids cut to 64; the stream (error events as `[Error] …` text with finish stop, a cut-off stream ends normally, `response.incomplete` and refusals ignored). One forced deviation: CIP merges the leading system messages, so all of them become `instructions` (9router keeps the first).
- **Also this round (second ask on SP14b):** the stream-only collapse buffer is unbounded like 9router (commit `7c3437b`).
- **Engine.** `OpenAIResponsesAdapter` extends `OpenAICompatibleAdapter` (model list and connection test inherited); `PROVIDER_PROTOCOLS` adds `openai-responses`; `createAdapter` switches on protocol. perplexity-agent is connectable (50); codex and grok-cli still need OAuth.
- **Storage and API.** Migration `0006`: `provider_nodes.api_type` (`chat` default | `responses`). `POST`/`PATCH /api/provider-nodes` take `apiType` (OpenAI-compatible only; changeable; applied to the next request). New OpenAI-compatible ids are `openai-compatible-<apiType>-<12 hex>` (9router), never renamed. A missing apiType is `chat` (9router refuses it; AIGate keeps SP13b clients working). The view has `apiType` (`null` for Anthropic).
- **UI, wired.** `/providers/new`: an API select (Chat completions / Responses) for OpenAI compatible, editable when editing; the base URL hint names both paths; cards say "· Responses". Browser check on the production build (port 20232, temp data dir): the API select, create as Responses (id `openai-compatible-responses-…`, card label), edit back to Chat (API shows `apiType: chat`, same id), Perplexity Agent found by search without "Coming later" (the API-key group shows 20 cards until "Show all").
- **Checks.** Engine 72/72 (6 new in `test/openai-responses-adapter.test.mjs`, plus the unbounded-buffer test), server 83/83 (a Responses node test in `provider-nodes.test.mjs`, new `responses-lane.test.mjs`), web 8/8, database 6/6, parity 5/5, discovery 54/54; `pnpm lint`, `pnpm build`, `pnpm discovery validate` (295). 27 mutations, all caught.

**SP14c decision re-confirmed (2026-09-26, user):** correct the non-streaming answer; keep 9router's request drops and stream error/end handling. Nothing changed in code.

**M2 SP14d (Ollama adapter) is complete.** Contract: `docs/contracts/provider-ollama.md`; connections: `docs/contracts/connections.md` (baseUrl, optional key).

- **Scope (user choice):** the ollama family plus reclassifying speech-to-text; gemini moves to SP14e.
- **Matrix first.** Three new entries, now `implemented` (298 entries): `translator.openai-to-ollama-request`, `translator.ollama-to-openai-response`, `connection.ollama-local-host`. Coverage and capabilities regenerated.
- **User decision (2026-09-26): correct** both the request (stop, seed, penalties, `format` from response_format, `think` from effort, `num_predict` from any max tokens; URL images refused; image-only turns and empty tool results kept) and the stream (an error line or a malformed line is `PROVIDER_UNAVAILABLE`; a body without its `done` line is a failure). Kept from 9router: tool_choice passed through, `tool_name` looked up from the assistant call (else `unknown_tool`), usage from `prompt_eval_count`/`eval_count`.
- **Engine.** `OllamaAdapter` (extends `OpenAICompatibleAdapter`; `/api/tags` model list); `readJsonLines` (bounded NDJSON reader in `sse.ts`); `PROVIDER_PROTOCOLS` adds `ollama`; descriptor `auth.optional` (no header for a keyless connection) and `connectionBaseUrl` with `withConnectionBaseUrl`. assemblyai and deepgram (serviceKinds only `stt`) now give the media reason; nanobanana (image-only) is left connectable for SP22. **Bug found by the lane test and fixed:** `HttpProviderAdapter.clean` split messages on an empty key, putting `***` between every character.
- **Storage and API.** Migration `0007`: `provider_connections.base_url` (nullable). `POST /api/connections` takes `baseUrl` and may omit `apiKey` only for ollama-local; `PATCH` takes `baseUrl` (`""` clears). Elsewhere: 400 naming `apiKey` or "baseUrl cannot be set on a <provider> connection". The host follows the https-or-loopback rule (9router accepts any URL). `activeKey` became `activeCredential` (`{ apiKey, baseUrl }`); `/v1` and the connection test apply the host.
- **UI, wired.** Connections Add modal: Host field and optional key for Ollama Local; the row shows the host, "no key", and Edit (host plus an optional new key). Browser check on the production build (port 20233): the modal fields, the http-LAN host toast (`INVALID_REQUEST` message), a keyless loopback connection saved (row with host and "no key", the "Could not reach" test toast), the Edit modal with the stored host; `GET /api/providers` has 52 connectable and the media reason for assemblyai/deepgram.
- **Checks.** Engine 79/79 (7 new in `test/ollama-adapter.test.mjs`), server 86/86 (3 new in `test/ollama-lane.test.mjs`), web 8/8, database 6/6, parity 5/5, discovery 54/54; `pnpm lint`, `pnpm build`, `pnpm discovery validate` (298). 28 mutations, all caught.

**M2 SP14e (Gemini adapter) is complete.** Contract: `docs/contracts/provider-gemini.md`.

- **Matrix first.** Two new entries, now `implemented` (300 entries): `translator.openai-to-gemini-request`, `translator.gemini-to-openai-response`. Coverage and capabilities regenerated.
- **User decision (2026-09-26): keep 9router** for the request and the answer, silent drops included (stop, tool_choice, response_format, seed, penalties, URL files/audio and video dropped; raw lower-cased `finish_reason` on non-streaming answers; thoughts counted as prompt tokens there; images as markdown or a non-standard `delta.images`; error chunks skipped; a stream without `finishReason` ends normally). **Corrected:** the tool-schema cleaner (`gemini-schema.ts`) walks schema positions only, so parameters named `title`, `format`, `const`, … survive, and an empty object sends no `parameters` instead of an invented required `reason`.
- **Forced deviations:** all leading system messages become `systemInstruction` (CIP merges them; 9router keeps the last); a non-stream body without candidates is an empty answer (9router returns the raw body); the signature cache is in memory only (9router's Gemini path never reads its SQLite layer); the key goes in `x-goog-api-key`, never the URL; 9router's output-limit cap on thinking floors is left out because no floor exceeds it.
- **Engine.** `GeminiAdapter` (extends `OpenAICompatibleAdapter`): safety settings OFF, name sanitizing (64), turn merging and the leading "..." turn, thought signatures (cached from streams, one hour, 2000, same family; else the borrowed 9router signature on the first call of a turn), thinking level (gemini-3) or budget (gemini-2.5) with output floors, `?pageSize=1000` model list, a 400 on the key test → invalid. `PROVIDER_PROTOCOLS` adds `gemini`; the descriptor uses `x-goog-api-key` raw. CIP adds the `image_delta` stream chunk; the OpenAI renderer honours `vendorExtensions.openai.finish_reason`. vertex keeps its reason.
- **UI.** No new screen: gemini is in the Connections Add modal through `connectable`. Browser check on the production build (port 20234, temp data dir): `/providers/connections?provider=gemini` preselects Gemini, the modal says 53 providers; saving a fake key made the live Google call answer 400 and the row show "Key rejected — Gemini answered 400: API key not valid…"; `GET /api/providers` has 53 connectable and vertex "Needs the vertex adapter (SP14)".
- **Checks.** Engine 89/89 (10 in `test/gemini-adapter.test.mjs`), server 87/87 (new `test/gemini-lane.test.mjs`), web 8/8, database 6/6, parity 5/5, discovery 54/54; `pnpm lint`, `pnpm build`, `pnpm discovery validate` (300). 67 mutations: 55 caught at first, 9 closed with new assertions, 3 were dead code and were removed (the floor cap, the per-model output limits, the empty-part filter); all live mutations are caught.

**M2 SP14f (Vertex AI) is complete.** Contract: `docs/contracts/provider-vertex.md`; connections: `docs/contracts/connections.md` (JSON credentials).

- **Scope (user choice):** vertex and vertex-partner only. **qoder/qoder-cn are not ported** (the Qoder CLI transport impersonates the client and obfuscates the body to pass a WAF); they say "Not supported: needs Qoder CLI impersonation". azure, cloudflare-ai, clinepass and commandcode move to SP14g+ (all four traced this round; the findings are summarized in "Next step").
- **Matrix first.** Five new entries (305): `provider.vertex-google-auth`, `connection.vertex-credential-test`, `routing.vertex-endpoints`, `translator.openai-to-vertex-request` (now `implemented`), `provider.qoder-agent-transport` (`traced`). Coverage and capabilities regenerated.
- **User decisions (2026-09-26).** Corrected: thought signatures (a cached real signature is sent back; only a call without one gets Vertex's borrowed signature; 9router overwrites every signature), token handling (401 → drop the cached token and mint once; cache per credential hash; authorized_user tokens cached until expiry), the connection test (mint a fresh token, or probe an API key; a 400 key is invalid), location `global` (9router: us-central1 on the global host). Kept, bounded: the vertex-partner API key's project read from the probe error (1 h, 256 keys). Security: the API key goes in `x-goog-api-key`, never `?key=`. Remote image URLs go as `fileData` (9router downloads them server-side).
- **Engine.** `adapters/google-auth.ts` (`parseGoogleCredential`; RS256 JWT with WebCrypto, no dependency; token cache), `adapters/vertex.ts` (`VertexAdapter` over the Gemini adapter, `VertexPartnerAdapter` over the OpenAI adapter; Bearer or key header; 401 re-mint; probe; catalog model list), `vertex-signature.ts` (copied from 9router). Hooks: `GeminiAdapter.bodyOptions` / `modelsBase`, `OpenAICompatibleAdapter.chatUrl`. `PROVIDER_PROTOCOLS` adds `vertex`; descriptor `auth.googleCloud`.
- **Server.** A trimmed key starting with `{` is a JSON credential (≤ 16384 chars), accepted only for `auth.googleCloud` providers and only when complete (400 naming the missing fields). `keyHint` for a JSON credential is its `client_email` (or `user credential`), shown unmasked.
- **UI, wired.** Add and Replace key modals: for Vertex the key field hints "Paste the service-account JSON key file from Google Cloud IAM, or a Vertex AI API key" and takes 16384 characters. Browser check on the production build (port 20235, temp data dir): the modal preselects Vertex AI with 55 providers; an incomplete JSON shows the `INVALID_REQUEST` toast "apiKey is not a usable Google Cloud credential: …"; a throwaway service account (real RSA key, fake account) was saved, its row shows the `client_email`, and the live token call answered "Key rejected — Google's token endpoint answered 400 for the service-account key: invalid_grant: Invalid grant: account not found" (Google parsed the JWT).
- **Checks.** Engine 98/98 (9 in `test/vertex-adapter.test.mjs`), server 88/88 (new `test/vertex-lane.test.mjs`), web 8/8, database 6/6, parity 5/5, discovery 54/54; `pnpm lint`, `pnpm build`, `pnpm discovery validate` (305). 52 mutations: 46 caught at first, 5 closed with new assertions, 1 equivalent mutant removed as redundant code (`bearer &&` in the Vertex base URL). Not verified against a real Google account: fileData with public image URLs on Vertex, and the probe's 404 message naming the project for a valid key.

**M2 SP14g (per-connection data, ClinePass) is complete.** Contract: `docs/contracts/provider-connection-data.md`; connections: `docs/contracts/connections.md`.

- **Scope (user choice):** azure, cloudflare-ai, clinepass; commandcode moves to SP14h.
- **Matrix first.** Four new entries, now `implemented` (309): `connection.azure-openai-deployment`, `connection.cloudflare-account-id`, `provider.clinepass-headers-envelope`, `translator.cloudflare-content-flatten`. Coverage and capabilities regenerated.
- **User decisions (2026-09-26).** Azure: keep 9router (the test passes every status but 401/403; the Add form requires endpoint, deployment, organization); the api.openai.com fallback for a missing endpoint is still refused (security). Cloudflare: correct (image/audio/file parts refused instead of dropped). ClinePass: correct (headers name AIGate; a real test). **Second ask:** the browser check showed Cline's `GET /api/v1/models` answering 200 to a fake key (9router's validate passes any key), while a one-token chat answered 401, so the ClinePass test is a one-token chat.
- **Engine.** Descriptor `connectionFields { required, optional, defaults }` and `chatProbe { model, body, invalidStatuses }`; `withConnectionBaseUrl` became `withConnection(provider, data)` (fills `{field}` tokens, URL-encoded; `OpenAI-Organization` header); the OpenAI adapter fills `{model}`, refuses a leftover token with `INVALID_REQUEST`, runs the chat probe, unwraps ClinePass's `{ success, data }` (non-stream), and flattens content for cloudflare-ai (`flattenContent` quirk). azure: `api-key` header, deployment defaults to the request model, api-version to `2024-10-01-preview`. `clineEnvelope` is no longer a blocking quirk.
- **Storage and API.** Migration `0008`: `provider_connections.deployment`, `api_version`, `organization`, `account_id` (nullable text). POST/PATCH take them, validated per field (rules in the contract); a field the provider does not take, or a missing/cleared required field, is 400 naming it. The view returns them. `activeCredential` and `readKey` return the whole connection data.
- **UI, wired.** `CONNECTION_FIELDS` in `features/providers/screens.tsx` (ollama-local host moved into it): Add shows the fields; Edit (for any provider with fields) prefills them and keeps the key unless a new one is typed; rows show endpoint, deployment, or "account <id>". Browser check on the production build (port 20236): the Cloudflare Account ID field and the server toast for "../bad"; a Cloudflare connection with a fake token tested live as "Key rejected — Cloudflare answered 401"; an Azure connection with endpoint, deployment, organization saved (row shows endpoint and deployment; the fake host gave "Could not reach"); Edit prefilled the fields, changed the deployment, and kept the key; the ClinePass live check led to the second ask above.
- **Checks.** Engine 103/103 (5 in `test/connection-data.test.mjs`), server 89/89 (new `test/connection-data-lane.test.mjs`), web 8/8, database 6/6, parity 5/5, discovery 54/54; `pnpm lint`, `pnpm build`, `pnpm discovery validate` (309). 41 mutations: 39 in the main run (37 caught at first, 2 closed with sharper envelope assertions), plus 2 for the ClinePass probe, all caught.
- **Repository note.** Two user commits ("change cdn", `cfd8c4b`, `f11db18`) landed while the mutation run was rewriting sources: they committed `.tmp-mutate.mjs`, `.tmp-mutate.log`, and `connection.ts` with a live mutation (`changes[field] = parsed.value;`, which stops a PATCH from clearing a field). The SP14g commit restores `connection.ts` and removes the two temporary files.

**M2 SP14h (Command Code adapter) is complete.** Contract: `docs/contracts/provider-commandcode.md`.

- **Matrix first.** Three new entries, now `implemented` (312): `translator.openai-to-commandcode-request`, `translator.commandcode-to-openai-response`, `connection.commandcode-key-test`. Coverage and capabilities regenerated.
- **User decisions (2026-09-27).** Keep 9router for the request (drops of tool_choice/stop/response_format/penalties/seed, defaults 64000 and 0.3, developer as user, bad arguments as `{}`, empty toolName) and for the stream (a mid-stream error as "upstream connection lost", a cut-off as complete, `error`/unknown finishes as stop, cached/reasoning tokens dropped), except the executor's implementation accidents (every line is read; `[DONE]` is sent). Correct the connection test (a one-token ping that reads the first event; live check: a fake key gets HTTP 401 "Invalid 'Authorization' header or token."). Security: an image by URL is refused, `config.workingDir` is "/". Forced by CIP: developer is system, max_completion_tokens is honored.
- **Engine.** `CommandCodeAdapter` (extends `HttpProviderAdapter`): envelope builder, NDJSON event mapping through `readJsonLines`, the peek before the first content event with in-band error classification (status or 9router's message guess) and retries for 502/503/504, the collapse for non-streaming clients, the static model list, and the ping test. `PROVIDER_PROTOCOLS` adds `commandcode`; `isTransient` and `budgetToLevel` are exported for reuse.
- **UI.** No new screen: commandcode is in the Connections Add modal through `connectable`; the ping result uses the existing test toasts.
- **Checks.** Engine 111/111 (8 in `test/commandcode-adapter.test.mjs`), server 90/90 (new `test/commandcode-lane.test.mjs`), web 8/8, database 6/6, parity 5/5, discovery 54/54; `pnpm lint`, `pnpm build`, `pnpm discovery validate` (312). 39 mutations: 38 caught at first, 1 closed (the test-retry assertion now uses a retryable 503). Production check (port 20237): `GET /api/providers` has 59 connectable; a Command Code connection with a fake key tested live as `invalid` — "Command Code answered 401: Invalid 'Authorization' header or token."

**Pre-SP15 custom-provider test correction (2026-09-27).** A local `vycel` node was configured with `http://127.0.0.1:5173/v1`, the AIGate Vite proxy, so its `GET /models` was sent back to AIGate. A fake-key HTTP request to that URL returned AIGate's own 401 `invalid_api_key`; the stored result had wrongly said `invalid` / `AUTH_ERROR` and the toast hid the upstream reason. The test now records `unreachable` / `INVALID_REQUEST` with an Edit Base URL message for that self-reference; other 401 responses remain key failures. The toast shows the redacted upstream reason, and the custom-provider form names the upstream URL. The saved `vycel` URL was not changed: its actual upstream API URL and protocol are still needed. Focused server custom-provider tests 10/10, web toast tests 2/2, lint, build, and discovery validate (312) passed.

**M2 SP15 (Anthropic Messages client protocol) is complete.** Contract: `docs/contracts/protocol-anthropic.md`; lane: `docs/contracts/chat-lane.md`.

- **Traced (for all of SP15).** 9router's client surfaces: `/v1/chat/completions`, `/v1/messages` (+ count_tokens), `/v1/responses` (+ compact, `/codex/*`, `/responses`), `/v1beta/models/{m}:generateContent|:streamGenerateContent`, `/v1/api/chat` (an Ollama stub), antigravity via the MITM. The 13 formats are `FORMATS` in `translator/formats.js`; only openai, openai-responses, claude, gemini and antigravity can be client formats.
- **Scope (user choice):** Anthropic Messages first; Responses → SP15b, Gemini → SP15c.
- **Matrix first.** Two new entries plus `routing.count-tokens-estimate`, now `implemented` (314): `translator.claude-client-request`, `translator.openai-to-claude-client-response`.
- **User decisions (2026-09-27).** Keep 9router: OpenAI-shaped errors for every client protocol (also SP15b/c); an omitted `stream` streams; non-streaming Claude clients get `chat.completion` unless the provider is openai-compatible (not stream-only) or Anthropic; the claude→openai request drops and adjustments for non-Anthropic providers; history thinking/cache_control/documents kept for Anthropic providers, dropped for others. Correct: real usage (also the usage chunk after the finish), live tool arguments, `signature_delta`.
- **Engine.** `protocols/anthropic-messages.ts`: `parseAnthropicMessagesRequest` (faithful CIP; unmodelled fields in `vendorExtensions.anthropic`; Anthropic-only blocks noted), `anthropicRequestFor` (unchanged for Anthropic providers, 9router's claude→openai rules otherwise), `anthropicClientGetsMessage`, `toAnthropicMessage`, `AnthropicStreamEncoder` (Read-tool arguments buffered and sanitized), `estimateAnthropicInputTokens`.
- **Server.** The chat lane takes a client protocol object (parse, prepare, respond, encoder); `/v1/messages` and `/v1/messages/count_tokens` share the key gate (Bearer or x-api-key), resolution, streaming, and error shape.
- **UI, wired.** `/gateway/endpoint`: Base URL panel names OpenAI and Anthropic, with Claude Code and Anthropic curl copy fields.
- **Checks.** Engine 118/118 (7 in `test/anthropic-protocol.test.mjs`), server 92/92 (new `test/messages-lane.test.mjs`), web 8/8, database 6/6, parity 5/5, discovery 54/54; `pnpm lint`, `pnpm build`, `pnpm discovery validate` (314). 52 mutations: 48 caught at first, 3 closed with new assertions (a tool turn, tool_choice any, Accept on the lane), 1 equivalent (the stream flag read before or after `prepare`, which keeps it). Browser check on the production build (port 20238): the Endpoint panel shows the OpenAI and Anthropic chips, the Claude Code and Anthropic curl copy fields; `/v1/messages/count_tokens` answered `{"input_tokens":3}` and `/v1/messages` without a connection answered the OpenAI-shaped `no_active_connection` error.

**M2 SP15b (OpenAI Responses client protocol) is complete.** Contract: `docs/contracts/protocol-responses.md`; lane: `docs/contracts/chat-lane.md`.

- **Traced.** `/v1/responses` → handleChat with the openai-responses source format; `/v1/responses/compact` sets `body._compact`; `/responses` and `/codex/*` are next.config rewrites; `translator/request/openai-responses.js` (Responses → chat pivot; same format passes unchanged), `translator/response/openai-responses.js` (the response.* events), `nonStreamingHandler.openAICompletionToResponses`, `sseToJsonHandler` (forced-stream openai targets also get a response object), `stream.js` (no `[DONE]` on a translated stream), `buildStreamErrorBytes` (chat error frame + `[DONE]`).
- **Matrix first.** Two new entries, `translator.responses-client-request` and `translator.openai-to-responses-client-response`, plus `routing.responses-compact-lane`, all `implemented` (316).
- **User decisions (2026-09-27).** Keep 9router on all four asks: the request drops and copied fields for non-Responses providers (tool_choice in the Responses shape, text/previous_response_id/truncation/_compact copied, hosted tools and unknown items dropped); the stream (output_index 0 shared, response.completed without output, status always completed, chat error frame + `[DONE]`); the non-streaming answer (an omitted stream streams, a response object only for openai-compatible and Responses providers, status = chat finish reason); and `/compact` (an ordinary answer, `_compact` copied).
- **Engine.** `protocols/openai-responses.ts`: `parseOpenAIResponsesRequest` (the pivot in CIP; copied fields in `vendorExtensions.openai`; custom tools tracked), `responsesRequestFor` (body passthrough for Responses providers via `vendorExtensions.responses`; the pivot for openai-compatible; no extensions, and no reasoning history for anthropic/ollama, elsewhere), `responsesClientGetsObject`, `toResponsesObject` (layered on `toOpenAIChatCompletion`), `ResponsesStreamEncoder`. The OpenAI-compatible adapter now sends reasoning history as `reasoning_content` + `encrypted_content` (redacted thinking still refused); the Responses adapter sends a passthrough body as given. `mediaSource` and `streamRequested` are exported for reuse.
- **Deviations (CIP limits).** system/developer items join the system prompt; `input_file`/`refusal` parts and non-http image URLs are a 400; a body without `input` is a 400; a Responses provider's answer is rendered again from CIP.
- **Server.** `/v1/responses`, `/responses`, `/codex`, `/codex/*`, `/v1/responses/compact` on the chat lane (same key gate, resolution, streaming, error shape).
- **UI, wired.** `/gateway/endpoint`: Responses chip, Codex CLI and Responses curl copy fields.
- **Checks.** Engine 125/125 (6 in `test/responses-protocol.test.mjs`, 1 new in `test/openai-adapter.test.mjs`), server 93/93 (new `test/responses-client-lane.test.mjs`), web 8/8, database 6/6, parity 5/5; `pnpm lint`, `pnpm build`, `pnpm discovery validate` (316). 75 mutations: 4 did not compile, 65 caught at first, 6 closed with new assertions (a custom call only in the history, reasoning from content, two reasoning items joined, reasoning closed at `</think>`, one reasoning item, empty tool arguments as `{}`). CI for 1e58fc8 failed once in `pnpm test` (logs need auth); 7937dad with the same code passed, so it was a flaky run. Browser check on the production build (port 20239, temp data dir): the Endpoint panel shows the Responses chip, the Codex CLI and Responses curl fields; a key created in the UI reached `/v1/responses`, `/responses`, `/codex/v1/responses` and `/v1/responses/compact` (each the OpenAI-shaped `no_active_connection`), and an empty `input` answered 400 with `param: input`.

**M2 SP15c (Gemini client protocol) is complete.** Contract: `docs/contracts/protocol-gemini.md`; lane: `docs/contracts/chat-lane.md`.

- **Traced.** `src/app/api/v1beta/models/route.js` (the listing) and `[...path]/route.js` (path parsing, stream by URL action, `convertGeminiToInternal`, `transformOpenAISSEToGeminiSSE`, `convertOpenAIResponseToGemini`, the TTS passthrough with its own key reading and account loop); `extractApiKey` reads Authorization and x-api-key only.
- **Matrix first.** Two new entries, `translator.gemini-client-request` and `translator.openai-to-gemini-client-response`, plus `catalog.v1beta-models-listing` and `catalog.v1beta-generate-content-dispatch`, all `implemented` (318).
- **User decisions (2026-09-27).** Keep 9router: the text-only request (three settings), the answer without tool calls or OpenAI's trailing usage and a silent end on a mid-stream error, the chat path's key headers (no x-goog-api-key or ?key=), the two-segment model id, any non-stream action generating, and the whole-catalog listing without a key. Port now: the TTS raw passthrough. The split-line loss is an implementation accident, not reproduced.
- **Engine.** `protocols/gemini-generate.ts`: `parseGeminiPath`, `parseGeminiGenerateRequest`, `toGeminiResponse` (layered on `toOpenAIChatCompletion`), `GeminiStreamEncoder` (usage on the finish only when the provider is not openai-compatible), `geminiModelList`, `isGeminiTtsRequest`, `geminiTtsRequest` (Google URL, client query minus key, the connection's key in x-goog-api-key, 45 s).
- **Server.** `GET /v1beta/models` (no key) and `POST /v1beta/models/*`: `onRequest` refuses a request with no key at all (or a remote one in keyless mode); the handler checks the key the path reads, then runs the chat lane or the TTS passthrough (Google's status and body piped back with only its content type). `checkKey` now takes the key.
- **Deviations.** Invalid JSON is the lane's 400 (9router 500); only the upstream content type is forwarded on TTS (security: no upstream cookies on the dashboard origin); one gemini connection, so no account fallback; `/v1/v1/*` still not served.
- **UI, wired.** `/gateway/endpoint`: Gemini chip, the key and text-only notes, a Gemini curl copy field.
- **Checks.** Engine 131/131 (6 in `test/gemini-protocol.test.mjs`), server 94/94 (new `test/gemini-client-lane.test.mjs`; `test/app.test.mjs` now uses `/v1beta/nope` for the reserved-prefix 404), web 8/8, database 6/6, parity 5/5; `pnpm lint`, `pnpm build`, `pnpm discovery validate` (318). 54 mutations: 1 did not compile, 48 caught at first, 5 closed with new assertions (stream SAFETY, models/ prefix on TTS, ?key= on TTS, the path model as modelVersion fallback, keyless local check on /v1beta). CI for f6102df and 81310ae passed. Browser check on the production build (port 20240, temp data dir): the Endpoint panel shows the Gemini chip, notes and curl; with a key made in the UI, `/v1beta/models/openai/gpt-4.1-mini:generateContent` answered `no_active_connection`, the same with only x-goog-api-key answered 401 `missing_api_key`, a TTS model with `?key=` answered 503 `no_active_connection`, and `GET /v1beta/models` listed the catalog without a key.

**M2 SP16 (OAuth sign-in core) is complete.** Contract: `docs/contracts/oauth.md`.

- **Traced.** `src/app/api/oauth/[provider]/[action]/route.js` (authorize, device-code, exchange, poll), `src/lib/oauth/providers/{cline,clinepass,gitlab,kilocode,kimchi}.js`, the callback page, `connectionsRepo.createProviderConnection` (oauth upsert by account), `tokenRefresh.checkAndRefreshToken` + `oauthCredentialManager.withCredentialRefreshLock` (proactive, locked), `chatCore` 401/403 + `refreshWithRetry` (reactive, 3 attempts, no lock), `backgroundTokenRefresh` (5 min / 30 min), `DefaultExecutor` hooks (clineHeaders, kilocodeOrg) and refreshers, `KimchiExecutor`. A survey agent mapped all ~20 OAuth providers (flows, executors, impersonation) for the scope question.
- **Matrix first.** Seven new entries in 02 (`oauth.dashboard-flow`, `oauth.token-storage`, `oauth.refresh-lifecycle`, `provider.cline-oauth`, `provider.gitlab-duo-oauth`, `provider.kilocode-device-auth`, `provider.kimchi-browser-token`) plus `account.concurrent-refresh-race`, all `implemented` (325).
- **User decisions (2026-09-27).** Scope: core + cline, clinepass, gitlab, kilocode, kimchi (SP16b claude/codex/github, SP16c gemini-cli/antigravity, SP16d grok-cli/kimi/codebuddy/iflow, later cursor/kiro/trae). Keep 9router's official-client headers (ToS risk accepted). Fixed-port callbacks: paste the URL. Kept on the second ask: unchecked state/verifier (gitlab secret in the query), 9router's refresh (reactive without the lock and with pauses even when nothing can refresh, background loop; overrides the spec's single-flight), ClinePass OAuth despite #2333, GitLab Duo's broken chat.
- **Database.** Migration 0009 rebuilds `provider_connections` (drizzle-kit's generated copy selected the new columns from the old table; fixed by hand before shipping and checked on a row-bearing 0008 database).
- **Engine.** `oauth.ts`: `OAUTH_PROVIDERS` (flows, exchange, device code, poll, refresh), `generatePkce`, `clineAccessToken`; the registry marks sign-in providers connectable (`oauth` flow on the descriptor; gitlab exempt from the hidden reason), Cline headers for cline, `clineAuth` (workos: for a JWT) and `kimchi` quirks, `organizationHeader` for kilocode (`withConnection` adds the organization header for any provider).
- **Server.** `api/oauth/:provider/:action` (`OAuthController`), `TokenRefresher` (proactive locked, reactive through `withRetry`, 5-minute background), `ConnectionsRepository.saveOAuth/storeRefresh/oauthExpiring`, refresh token sealed under its own context; the chat lane refreshes before and after (401/403, once); the connection test refreshes first; sign-in-only providers refuse keys; `refreshRetryDelayMs` server option (tests 0).
- **UI, wired.** `/providers/connections` sign-in in the Add connection dialog (`features/providers/sign-in.tsx`: popup + paste, GitLab app fields, device code polling), Signed-in rows with Sign in again, `/callback` relays the code; `OAUTH_FAILED` and `ALREADY_CONNECTED` messages in `shared/errors.ts`.
- **Checks.** Engine 137/137 (6 in `test/oauth.test.mjs`; counts 59 → 62 in five tests; cline connectable), server 98/98 (4 in `test/oauth-lane.test.mjs`; catalog and connection view expectations), web 8/8, database 6/6, parity 5/5; `pnpm lint`, `pnpm build`, `pnpm discovery validate` (325). 77 mutations: 8 did not compile, 55 caught at first, 6 equivalent (code removed: the base64 padding, the missing-brace check, Kilo's 202 branch, the workos: check, the device-flow checks in the controller), 8 closed with new assertions (a refused refresh with a token body, a failed GitLab user read, a token before approval, a failed Kilo profile, concurrent proactive refreshes, a blank Kimchi token, a 500 that must not refresh, a 403 that must). Browser check on the production build (port 20241, temp data dir): Kilo Code shows only its sign-in; Cline's sign-in opened the real Cline page (authkit) with our callback URL; pasting a callback URL with a test code signed in (toast, "Signed in as … · token until …", Sign in again); `/callback?code=…` shows its address to copy.

**M2 SP16a (model import) is complete.** Contract: `docs/contracts/custom-models.md`.

- **Why.** The user found the gate useless without real model ids: the detail page showed only the static catalog, and a custom provider had no models at all. 9router (checked live at localhost:20128) shows "Available Models" with a Model ID field, **Import from /models**, and per-model Copy/Test/Delete.
- **Traced.** `src/app/api/providers/[id]/models/route.js` (per-provider /models config, compatible nodes at `<baseUrl>/models`), `src/app/api/models/custom/route.js` + `aliasRepo` (custom models), `src/app/api/models/test/{route,ping}.js` (self-dispatched 1024-token probe, reasoning-only soft pass), `CompatibleModelsSection.js` and `page.js` (the import loop, cline import), `provider-nodes/[id]` DELETE, `/v1/models` custom-model listing.
- **Matrix first.** Two new entries in 04, `catalog.compatible-models-import-ui` (`SUSPECTED_BUG` kept) and `catalog.custom-models-orphan-on-node-delete` (`SUSPECTED_BUG` kept); `catalog.provider-models-live-fetch`, `catalog.model-custom-registration`, `catalog.model-connectivity-test` now `implemented` (327).
- **User decisions (2026-09-27).** The import shows a pick list (9router adds everything); the import is offered for every connected provider; the per-model Test ships now. Kept from 9router: a failed fetch shows only `Failed to fetch models: <status>`; ids are stored as given; a deleted custom provider leaves its custom models. The adapter's own 15 s limit still applies to the fetch (every upstream call goes through an adapter).
- **Database.** Migration 0010 adds `custom_models` (provider, model_id, created_at; primary key provider+model_id; no foreign key, the provider may be a catalog id or a custom provider id).
- **Server.** `GET /api/connections/:id/models` (the adapter's `getModels` with the connection's data, refreshed first; 502 `MODELS_FETCH_FAILED`), `CustomModelsController` + `CustomModelsRepository` (`/api/models/custom`, catalog module, exported to routing), `ModelTestController` → `ChatLane.probe` (resolution + adapter without the key gate, 15 s, reactive refresh through the new shared `withRefresh`), `/v1/models` adds custom models (custom providers under their prefix, unreachable prefixes skipped).
- **UI, wired.** `features/providers/models.tsx` `ProviderModels`: catalog and added models with the `/v1` id, Copy, Test (`model-rules.ts` `describeProbe`), Model ID + Add, Import dialog (filter, tick, Add selected / Add all new). `CustomProviderDetail` (custom provider cards link to it via **Models**; the detail page asks the node list first, so no 404 in the console). `MODELS_FETCH_FAILED` in `shared/errors.ts`.
- **Checks.** Server 102/102 (4 in `test/custom-models.test.mjs`), engine 137/137, web 10/10 (2 in `model-rules.test.mjs`), database 6/6 (table list), parity 5/5; `pnpm lint`, `pnpm build`, `pnpm discovery validate` (327). 21 mutations: 1 did not compile, 18 caught at first, 1 closed with a new assertion (delete scoped to the provider), 1 removed as equivalent (the rethrow of non-engine errors; every failure is now `Failed to fetch models`, as 9router). Browser check on the production build (port 20242, temp data dir, deleted after): a custom provider pointed at the local 9router imported its real list (961 ids), filter + tick added 2, "Use as" `nr/llm7/gpt-5.5` with Copy/Test, a repeated id toasts "Model already exists for this provider.", `/v1/models` lists `nr/…`; OpenAI without a connection has Import and Test disabled with the hint; with a fake key Import toasts `Failed to fetch models: 401` and Test shows "HTTP 502: OpenAI answered 401: …".

**Fix after SP16a (2026-09-27): `cache_control` on OpenAI Chat requests.** The user's client (connected, models imported) got 400 `messages[0].cache_control is not a known field`: the OpenAI Chat parser listed message and text-part fields exactly. It now reads `cache_control: { type: "ephemeral" }` on system, user, assistant and tool messages and on text parts into CIP `cacheControl` (a message-level mark on the last text part), so Anthropic providers keep the client's cache breakpoints and OpenAI-compatible ones drop the hint, as the contracts already said (`protocol-openai.md`). 9router passes a message-level mark through to OpenAI-compatible upstreams and keeps block marks only for the alicode family (`quirks.preserveCacheControl`, not ported yet). Checks: engine 138/138 (1 new test), server 102/102, web 10/10, lint; 5 mutations, 4 caught, 1 equivalent removed.

**Follow-up (2026-09-27): 9router's cache_control filter for OpenAI-format providers.** User decision: keep 9router on both asks (`translator.openai-cache-control-filter`, new in 11, `SUSPECTED_BUG` kept): a message's `cache_control` goes on the message to every OpenAI-compatible provider (CIP `CanonicalMessage.cacheControl`, `CanonicalRequest.systemCacheControl`), and a text part's only with the catalog quirk `preserveCacheControl` (alicode, alicode-intl, alims-intl, alitp-intl); Anthropic providers get a message's mark on its last text block. ttl is still dropped (CIP models ephemeral only). Checks: engine 138/138 (the cache test rewritten), 12 mutations (1 closed with an assistant-part assertion).

**M2 SP16b (OAuth claude and codex) is complete.** Contract: `docs/contracts/oauth.md` ("claude", "codex").

- **Traced** (three read-only agents): claude (`src/lib/oauth/providers/claude.js`, registry `claude.js`, `DefaultExecutor` headers, `selectAnthropicBeta`, `prepareClaudeRequest`, `claudeCloaking.js`, the test and models config), codex (`providers/codex.js`, `providerHelpers.extractCodexAccountInfo`, `CodexExecutor`, `codexInstructions.js`, `refreshCodexToken`, the 1455 proxy, test and models), github (for SP16b2).
- **Matrix first.** Three new entries in 02: `provider.claude-oauth`, `provider.codex-oauth` (both `implemented`, `SUSPECTED_BUG` kept) and `provider.github-copilot-oauth` (`traced`, for SP16b2); `translator.claude-oauth-cloaking` now `implemented` (331).
- **User decisions (2026-09-27).** claude and codex now, github next. claude: full 9router cloaking. Keep 9router on every suspected bug of both (claude models via x-api-key, expiry-only test, null refresh failures, no email, replaced cache marks; codex compact URL from the previous request, test after a failed refresh, account id not reread, model list at client version 0.144.6 without the account id).
- **Engine.** `oauth.ts`: claude (URLSearchParams authorize, `code#state`, JSON exchange/refresh, 4 h lead) and codex (fixed `http://localhost:1455/auth/callback`, %20 authorize, form exchange, id_token account, JSON refresh, 5-day lead, 8-day maximum age); `OAuthProvider.fixedRedirect/refreshLeadMs/maxRefreshAgeMs`. `adapters/claude-code.ts` (prepareClaudeRequest for claude, billing header, user id, `_ide` + 20 decoys, `withClaudeCodePrompt`, `isClaudeSignature`); `AnthropicAdapter` `claudeCode` quirk (?beta=true, Bearer, per-model beta list, decloaked names, lenient unsigned thinking, models via x-api-key). `adapters/codex.ts` + `codex-instructions.ts` (the CodexExecutor body, the compact URL state, the model list with -review twins); `OpenAIResponsesAdapter` `codex` quirk (session_id, collapsed execute, the codex models URL). `Credential.sessionId`; descriptor `accountIdHeader` (codex ChatGPT-Account-ID via `withConnection`) and `testByExpiry` (claude). claude and codex connectable (64).
- **Server.** The OAuth controller uses a provider's fixed redirect, passes the returned state to the exchange, and stores codex's account id; the repository stamps `last_refresh_at` at sign-in and reads it into `OAuthState`; `TokenRefresher.due()` uses the provider's lead and maximum age; the claude connection test reads the expiry (refreshing when due); the chat lane sends the connection id as the session and prepends the Claude Code prompt for non-Claude clients (and the model test).
- **UI, wired.** The Add connection dialog shows the claude and codex sign-in; GitLab's application fields only for gitlab (they showed for every PKCE provider); a provider whose callback is elsewhere (codex) says to paste the address of the page that cannot load.
- **Checks.** Engine 146/146 (8 in `test/claude-codex.test.mjs`; counts 62 -> 64 in five tests; claude/codex statuses), server 107/107 (5 in `test/claude-codex-lane.test.mjs`; catalog, chat-lane and connections tests now use github as the provider waiting for OAuth), web 10/10, database 6/6, parity 5/5; `pnpm lint`, `pnpm build`, `pnpm discovery validate` (331). 48 mutations: 3 did not compile, 34 caught at first, 10 closed with new assertions (a budget equal to the cap, two system blocks, a merge with tool results first, the single assistant mark, no placeholder after signed thinking, a deferred tool, a typed server tool, the R-form signature, the beta list for any model id, codex's maximum refresh age), 1 equivalent removed (the last-turn-is-user check, which the adapter already enforces). Browser check on the production build (port 20243): 64 connectable; codex's sign-in opened auth.openai.com and showed the paste hint for localhost:1455; a pasted fake callback reached OpenAI's token endpoint (`OAUTH_FAILED`, token_expired); claude's sign-in opened claude.ai/oauth/authorize with our callback, no GitLab fields, and a pasted fake `code#state` reached Anthropic (`invalid_grant`); gitlab still asks for its application. The temp data dir `%TEMP%\aigate-sp16b` could not be deleted (a hook blocked the command); it holds only the test database and a throwaway key.

**M2 SP16b2 (OAuth github Copilot) is complete.** Contract: `docs/contracts/oauth.md` ("github").

- **User decision (2026-09-27): "do not ask, do it like 9router"** (also recorded as the standing rule in memory). All of 9router's github behavior is kept, including the suspected bugs listed in `provider.github-copilot-oauth` (now `implemented`).
- **Engine.** `oauth.ts` github (device code, poll with `slowDown`, the Copilot token and user read after approval, the Copilot refresh with the GitHub-refresh fallback, `test` on /user, `background: false`); the Copilot token is the sealed access token and the GitHub token the sealed refresh token (a security deviation from 9router's plain data). `adapters/github.ts` `GithubAdapter` (quirk `copilot`): claude models to /v1/messages through `AnthropicAdapter` with the `copilotMessages` quirk (`copilotMessagesBody`: prepareClaudeRequest for a non-claude provider, image hoisting) and the Claude Code prompt; remembered models to /responses; others to /chat/completions with the `copilotChat` quirk; the 400 move to /responses; the Copilot model list. `adapters/collect.ts` (the stream fold, shared with codex). 65 connectable.
- **Server.** The poll passes `slow_down` through; a provider's own `test` runs on the refresh token (github); the background loop skips providers with `background: false`.
- **UI.** The device-code dialog polls as 9router's: only expired_token and access_denied stop it, slow_down adds 5 s (at most 30 s).
- **Checks.** Engine 153/153 (7 in `test/github-copilot.test.mjs`; counts 64 -> 65), server 108/108 (1 github lane test; the tests waiting for OAuth now use grok-cli), web 10/10, database 6/6, parity 5/5; `pnpm lint`, `pnpm build`, `pnpm discovery validate` (331). 34 mutations: 4 did not compile, 28 caught at first, 2 closed with new assertions (empty text parts on /chat/completions, typed tools off claude). Browser check on the production build (port 20244, the leftover temp dir reused): 65 connectable; Sign in with GitHub Copilot got a real device code from GitHub, opened github.com/login/device, and kept polling (authorization_pending) without an error.

**M2 SP16c (OAuth gemini-cli) is complete.** Contract: `docs/contracts/oauth.md` ("gemini-cli"). Split from antigravity (SP16c2), whose executor is much larger.

- **Standing rule (2026-09-27): port 9router without asking.** Traced `src/lib/oauth/providers/{gemini-cli,antigravity}.js`, `GeminiCLIExecutor`, `AntigravityExecutor`, `wrapInCloudCodeEnvelope(ForClaude)`, `services/projectId.js`, the chat handler's cold-miss lookup, the test (`probeCloudCodeAssistAccess`) and model configs. Two matrix entries in 02: `provider.gemini-cli-oauth` (`implemented`, `SUSPECTED_BUG` kept: a sign-in without a project is saved and requests name a random project, a new session per request, three different client descriptions) and `provider.antigravity-oauth` (`traced`, for SP16c2; its `cloakTools` is dead code) (333).
- **Engine.** `adapters/cloud-code.ts` (the loadCodeAssist / onboardUser project lookup, cached an hour per connection with shared in-flight lookups; the random project; the loadCodeAssist test); `adapters/gemini-cli.ts` `GeminiCliAdapter` (quirk `geminiCli`) over `GeminiAdapter`, which now has a `generateUrl` hook and an optional `wrap` hook: `<base>:generateContent` / `:streamGenerateContent?alt=sse`, the Gemini CLI headers, the Cloud Code envelope, the Gemini CLI thought signature, `fetchAvailableModels`. `oauth.ts` `googleSignIn` (shared with antigravity next) and the gemini-cli account read (userinfo, loadCodeAssist `mode: 1`). `Credential.projectId`. The catalog's `gemini-cli` protocol maps to the Gemini adapter; 66 connectable.
- **Server.** The repository reads `projectId` from `oauth_data`; the chat lane, the connection test and the model list pass it in the credential.
- **UI, wired.** The Add connection dialog's browser sign-in covers gemini-cli with no change (Google accepts the dashboard's loopback `/callback`); errors reach the user as `OAUTH_FAILED` with Google's words.
- **Checks.** Engine 160/160 (7 in `test/gemini-cli.test.mjs`; counts 65 -> 66 in five tests), server 109/109 (1 gemini-cli lane test: sign-in, the envelope with the stored project, a 401 refresh keeping the project, test and model list), web 10/10, database 6/6, parity 5/5; `pnpm lint`, `pnpm build`, `pnpm discovery validate` (333). 35 mutations: 1 did not compile, 29 caught at first, 2 closed with new assertions (legacy-tier without a default tier, userinfo read only on 2xx), 1 simplified away (the empty project body), 2 equivalent (the arch mapping on an x64 machine; `done !== true` against `done === false`, both retry). Browser check on the production build (port 20246, a temp data dir inside the repo): 66 connectable; Sign in with Gemini CLI opened Google's sign-in page for the Gemini CLI client with our loopback callback (no redirect error); a pasted fake code reached Google's token endpoint, and the dialog showed `OAUTH_FAILED` "Token exchange failed: { "error": "invalid_grant" … }". The untracked temp dir `.tmp-browser-sp16c` (test database only) could not be deleted: a hook blocked the command.
- **Fix (2026-09-28), user report "OpenAI … sent a non-SSE response to a streaming request".** Codex (and any upstream) may stream without a `Content-Type`; 9router reads such a body as SSE, AIGate refused it, so every codex chat and model test failed. `HttpProviderAdapter.sseBody` now accepts a missing content type and refuses any other non-SSE type with the status, the type and the page title, the upstream error or a short body (`routing.streaming-pipeline` in `provider-openai.md`). New tests (codex without a content type, the refusal messages) fail without the fix. Engine 161/161, server 109/109, web 10/10, database 6/6, parity 5/5; lint, build.

**Custom provider options (2026-09-28, user request; AIGate features, not in 9router).** Contract: `docs/contracts/custom-providers.md`.

- **Why.** conduit (a custom provider) answers 200 and then `{"error":{"type":"server_error","message":"Temporary service interruption…"}}` in the stream for longer requests; replaying the same body straight to conduit fails the same way (10 requests with the user's consent), so AIGate's body was not the cause. The user chose an opt-in retry per custom provider, and asked for custom headers.
- **Custom headers.** `customHeaders: [{ name, value }]` on `POST`/`PATCH /api/provider-nodes` (at most 20, lower-case HTTP token names, printable ASCII values; the key, framing and stream headers refused). Sealed at rest (`custom_headers_sealed`, migration 0011, context `provider_nodes:<id>:custom_headers`); views show `{ name, hint }` only; on PATCH a header without a value keeps the stored one (merged in one transaction). Sent with every request to the node, before the family's own headers.
- **Retry stream errors.** `retryStreamErrors` (default false, `retry_stream_errors`). When on, `StreamRetryAdapter` (engine `adapters/stream-retry.ts`, applied by `createAdapter` when the descriptor asks) sends a request again, twice at most (0.5 s, 1 s), when it fails before any content with a 429 that is not a spent quota or a first-event stream error; the start chunk is held back until content, so a retry never reaches the client.
- **UI, wired.** The custom provider form has Custom headers rows (password-type values, `Unchanged (••••1234)` for saved ones, + Add header, Remove) and a Retry stream errors checkbox; the detail page lists the header names and the retry state; refusals are `INVALID_REQUEST` toasts with the server's message.
- **Checks.** Web 11/11 (`headerPayload`), database 6/6, engine 161/161, server 111/111 (2 new provider-node tests: headers sealed, hinted, merged, sent, refused; retry off, on, bounded, not after content, not for a spent quota), parity 5/5; `pnpm lint`, `pnpm build`, `pnpm discovery validate` (333). Browser check on the production build (port 20247): an Authorization header was refused with the server message; X-Team was saved lower-case and shown as Unchanged (••••nope) on the edit page, kept when saved again with an empty value; the retry checkbox stayed on. The header rows moved from a Field label to a group, so the Add header button keeps its own name.

**Settings in .env (2026-09-28, user request).** GitHub push protection refused the push because the public Google OAuth clients (Gemini CLI, Antigravity) were in the source and docs. By user decision the secrets moved out of the repository:

- The server loads the repository's `.env` first (`apps/server/src/env.ts`, `process.loadEnvFile`; `AIGATE_ENV_FILE` names another file; variables already in the environment win). `.env.example` documents every variable (server settings commented out, since an empty value is not the same as none; the OAuth clients; the dev tools). `.gitignore` now ignores `.env`, `.env.*` (not `.env.example`) and `.tmp-*/`.
- `oauth.ts` reads `AIGATE_GEMINI_CLI_OAUTH_CLIENT_ID` and `AIGATE_GEMINI_CLI_OAUTH_CLIENT_SECRET` on each use (`GOOGLE_CLIENT_ENV`); without them the authorize step answers 400 `INVALID_REQUEST` naming the variables, and an exchange or refresh fails the same way before any call. `AIGATE_ANTIGRAVITY_OAUTH_CLIENT_ID`/`_SECRET` are reserved for SP16c2. Tests use fake clients; the docs point at 9router's `shared.js` instead of the values.
- Kept in the source, by assessment: the public client ids of claude, codex and github (not secrets, and not flagged), and the provider base URLs, which are the vendors' public endpoints from the extracted catalog (data, not configuration; a custom provider or a per-connection base URL reaches any other endpoint).
- The unpushed history was rewritten so that no commit carries the Google clients, and the throwaway data dir of the browser checks (with its test `secret.key`, committed by mistake in `af2de18 change cdn`) left the history; the files stay on disk, now ignored.

**Provider thinking (2026-09-28, user request "part 1").** Contract: `docs/contracts/provider-thinking.md`; matrix `routing.provider-thinking-default` (`implemented`, 334).

- **Traced** 9router's `settings.providerThinking`: the picker on the provider page (auto plus the union of the provider's model levels, `thinkingLevels.js`), `saveThinkingConfig` (auto deletes), and chatCore's injection of `reasoning_effort = mode` when the body has none, which thinkingUnified then applies in the target's format (a Claude budget, a Gemini level, stripped for a model without reasoning).
- **Engine.** `thinking.ts`: `THINKING_LEVELS`, `thinkingLevels(provider)` (the family's levels, null when no model reasons), `withThinking(request, provider, level)` (a budget for the Anthropic family, reasoning_effort otherwise; unchanged when the client sent its own thinking, for a model that does not reason, or for a level the family does not take; a Claude model behind an OpenAI-style provider only low/medium/high).
- **Server.** Table `provider_thinking` (migration 0012), `ProviderThinkingRepository` (cached, dropped on write) in the catalog module; `GET /api/providers/:id` adds `thinking`; `PUT /api/providers/:id/thinking`; the chat lane applies the level after the protocol's preparation, and the per-model test too.
- **Deviations.** The client's own thinking always wins (9router checks only reasoning_effort, so its level overrode a Claude budget or a Responses effort, against its own comment); levels by protocol family, not per model format; modes on/off not ported (never offered); the copied-name `(level)` suffix waits for part 2.
- **UI, wired.** The provider detail page has a Thinking panel (Default thinking level: Auto and the provider's levels), hidden when no model reasons; changes save at once with a toast; refusals show the server's message.
- **Checks.** Engine 166/166 (4 in `test/thinking.test.mjs`), server 113/113 (2 in `test/provider-thinking.test.mjs`), database 6/6 (the new table), web 11/11, parity 5/5; lint, build, discovery (334). 15 mutations: 14 caught, 1 did not compile. Browser check (production build, port 20248): the OpenAI page shows the Thinking panel; choosing Extra high saved it, and it was still selected after a reload.

**Thinking for custom providers (2026-09-28, user request).** A custom provider has its own level, picked in its form (`thinking` on `POST`/`PATCH /api/provider-nodes`, column `provider_nodes.thinking_level`, migration 0013), checked against its family's levels (`familyLevels` in the engine), and carried as `defaultThinking` on its descriptor; since a custom provider declares no models, `withThinking` applies it to every model it serves. The form's select shows Auto and the family's levels (a level the new protocol does not take is sent as Auto); the detail page shows the level. Found on the way (unchanged): a client's own thinking to a custom model the catalog does not know is refused by the existing capability check (`does not support: reasoning`). Checks: web 11/11, database 6/6, engine 166/166, server 114/114 (1 new provider-nodes test: the level to any model as reasoning_effort, a Claude budget on an Anthropic-compatible node, refusals, auto), parity 5/5; lint, build, discovery (334). Browser check (production build, port 20249): the custom provider form shows Default thinking level; High was saved and still selected after a reload.

**Retry policy of retryStreamErrors (2026-09-28, user report: conduit fails on longer questions).** conduit answers longer prompts with 200 and a first-event `server_error` ("Temporary service interruption. Retry the last turn…"), directly too; opencode, which works against it, treats `server_error` as retryable and retries up to 5 times from 2 s, doubling, at most 30 s (read from its 1.18.32 binary: `RETRY_INITIAL_DELAY` 2000, factor 2, jitter 0.25, 30000 without headers, `RETRY_MAX_RETRIES` 5). `StreamRetryAdapter` now uses that policy (6 attempts, 2, 4, 8, 16, 30 s, no jitter) instead of 2 retries at 0.5 s and 1 s; `createServer({ streamRetryDelayMs })` shortens it for tests. The provider still has to enable Retry stream errors.

**Next step, M2 SP16c2.** OAuth antigravity, from the `provider.antigravity-oauth` entry: `googleSignIn` with the Antigravity client and scopes; its account read (userinfo and loadCodeAssist with the IDE User-Agent and `x-request-source: local`, background onboarding); an `AntigravityAdapter` on `daily-cloudcode-pa.googleapis.com` (upstream model ids with the thinking suffix, the Claude path through Claude-shaped contents, the request fixes and prompt rewrites, the 64000 cap, IDE session and request ids, image models non-streaming, the 429/5xx retry with Retry-After); the sandbox model list and the loadCodeAssist test. Known gaps: 9router's generic chat-probe fallback in the API-key test; `/v1/v1/*` not served; codex image inlining and SSE overload peeking.