# AIGate progress handoff

Updated: 2026-09-25. Read this before continuing the project plan.

## Task board

Update this table, and the section of the SP you touched, every time an SP or subtask finishes (user rule, 2026-09-25).

| Step | Status | Where to look |
|---|---|---|
| M-1 Discovery (Tasks 1–19) | Done | "Completed and verified" |
| M0 SP0 Lint, CI, and the two skills | Done | SP0.1–SP0.6 below |
| M0 SP1 Monorepo skeleton | Done | SP1 below |
| M0 SP2 SPIKE-1 and database driver chain | Done | SP2 below, `packages/database` |
| M0 SP3 Parity harness | **Not started** | Needed before the parity gates |
| M0 SP4 `tools/extract` registry extraction | **Not started** | Needed before SP13 |
| M1 SP5 `settings` | Done, UI wired | `docs/contracts/settings.md` |
| M1 SP6 `identity` + `apikeys` | Done, UI wired | `docs/contracts/identity-apikeys.md` |
| Error handling and the API↔UI map | Done | `docs/design/API_UI_MAP.md` |
| M1 SP7 `engine` core | Done, no UI | `docs/contracts/engine.md` |
| M1 SP8 `transport` (direct branch + timeout) | Done, no UI | `docs/contracts/transport.md` |
| M1 SP9 `engine`: OpenAI-compatible adapter | Done, no UI | `docs/contracts/provider-openai.md` |
| M1 SP10 `engine`: protocol adapter in/out (OpenAI only) | Done, no UI | `docs/contracts/protocol-openai.md` |
| M1 SP11 `connections` (one API-key account) | Done, UI wired | `docs/contracts/connections.md` |
| M1 SP12 routing + `/v1` streaming | **Next** | SP11 below |

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

**Next step, M1 SP12 (`routing`: chat lane on `/v1/chat/completions`):**
- **Route.** A Fastify raw route. It checks the client key through `ApiKeysRepository.isValid` when `requireApiKey` is on, then parses with `parseOpenAIChatRequest`.
- **Provider.** It resolves the provider and model from the registry, reads the active connection (`ConnectionsRepository`), and runs `assertModelSupports`.
- **Execution.** It calls `OpenAICompatibleAdapter.execute` or `stream`, under one `ExecCtx` signal (client disconnect + request budget).
- **Streaming.**
  - Write the `OpenAIChatStreamEncoder` output with backpressure.
  - Add an idle timeout between chunks.
  - Call `fail()` when the stream is cut off partway.
  - Map errors with `toOpenAIError`.
- **UI.** Turn the `/gateway/endpoint` "Chat API pending" pill live in the same SP.