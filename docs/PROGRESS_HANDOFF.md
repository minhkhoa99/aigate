# AIGate progress handoff

Updated: 2026-09-25. Read this before continuing the project plan.

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

**SP0.2 and SP0.3 are complete locally.** The RED baseline in `docs/superpowers/skill-tests/2026-09-25-writing-lean-bounded-red.md` records three independent scenarios and the usage-query failure. The repo skill `.agents/skills/writing-lean-bounded-code` has three references, passes `quick_validate.py`, and is 364 words. GREEN and micro-test results are in `docs/superpowers/skill-tests/2026-09-25-writing-lean-bounded-green.md`. Usage: 5/5 guided agents aggregated in SQL versus 2/5 controls on the original pressure prompt. Fan-out: guided 5/5 declared an input maximum versus 0/5 controls. Cache: guided 5/5 added TTL, size cap, and invalidation versus 0/5 controls. Guided fan-out answers first used `Array.from` worker lists, which lint rejects. After `bounded-patterns.md` was patched, a 5-agent rerun produced literal worker lists, and all five were lint-clean. Known gap: 4/5 of those answers passed no deadline signal to the check call. A lint run showed the `!` non-null assertion passes lint (`no-type-assertion` covers `as` only, per spec §11); the skill and test docs were corrected to match. Do not connect the skill in `CLAUDE.md` yet: SP0.5 still needs its GREEN cycle, then SP0.6 verifies automatic discovery. After SP0, start SP1.

**SP0.4 RED baseline is recorded** in `docs/superpowers/skill-tests/2026-09-25-porting-behavior-not-code-red.md`. Six agents without the skill ran two per spec §11.6 scenario. Each could read only `.reference/9router`.

- **A. Port a file to TS: RED 2/2.** Given `proxy-pools/[id]/route.js` with "keep it the same", both agents translated it line by line and kept the `SUSPECTED_BUG` where `validTypes` omits `deno`. One agent found the bug and shipped it "on purpose" pending a question. The other wrote a test that locks in the silent coercion to `http`.
- **B. Skip the Feature Matrix: 0/2 RED.** Both agents refused and traced the reference.
- **C. Keep `global._*`: 0/2 RED.** Both agents dropped the Next.js guards.

**Next step, SP0.5:** write `.agents/skills/porting-behavior-not-code` (under 450 words) with `feature-matrix.md`, `golden-scenarios.md`, and `error-taxonomy.md`, per spec §11.4. Target only A's failure:

- Measure parity at the contract, not the code.
- Label rules before translating.
- Do not reproduce a `SUSPECTED_BUG` by default.
- Do not write tests that encode a suspected bug.

Then run 5 guided and 5 control agents on A, and rerun B and C to confirm no regression.

Before starting, inspect `docs/superpowers/specs/2026-09-22-aigate-design.md` §9 and §11, `docs/governance/rules.md`, and this handoff. Do not treat `UI_READY` as working API integration or copy the 9Router implementation accidents into AIGate.

## Reproduce the M-1 gate (PowerShell)

```powershell
$env:NINEROUTER_PATH = (Resolve-Path '.reference/9router').Path
pnpm test
pnpm discovery validate
pnpm web:build
```
