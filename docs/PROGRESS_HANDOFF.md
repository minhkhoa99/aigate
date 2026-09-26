# AIGate progress handoff

Updated: 2026-09-26. Read this before continuing the project plan.

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
| M2 SP14h `commandcode` adapter (NDJSON AI SDK v5 events, forced stream) | **Next** | "Next step" at the end |

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

**Next step, M2 SP14h.** `commandcode` (traced in SP14f, not yet in the matrix): NDJSON AI SDK v5 events (`text-delta`, `reasoning-delta`, `tool-input-*`, `tool-call`, `finish-step`, `finish`, `error`), forced stream collapsed for non-streaming clients, an envelope request (`threadId`, `config`, `params`) with `x-command-code-version`/`x-cli-environment` headers. Suspected bugs to ask about: lines lost in the executor's peek phase, no `[DONE]` for OpenAI streaming clients, the error message replaced by "upstream connection lost", a cut-off stream treated as complete, request drops (`tool_choice`, `stop`, `max_completion_tokens`, developer role as user), default temperature 0.3, the thinking suffix leaking into `params.model`. Open question for SP22: nanobanana is image-only but still connectable. Known gap: 9router's generic chat-probe fallback in the API-key test (`src/app/api/providers/validate/route.js:600`) is not ported for catalog providers without a `chatProbe`.
