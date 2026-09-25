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
- Follow-up: §4.2 now defines `ExecCtx.signal` as one client-cancel + request-deadline signal shared by routing, retries, adapters and response bodies. It defines the bounded retry helper contract; implementation waits for `apps/api`. Lint now rejects spread arrays in `Promise.all` and accepts `ctx.signal` for provider fetches only under `apps/api/src/modules/engine/`. Tests for both rules failed before the fix and pass afterward. A temporary violating source file made the actual `pnpm lint` command exit 1; it was removed.
- This machine no longer has `D:\9router`. `.reference/9router` was cloned at the exact commit above and ignored by Git. With `NINEROUTER_PATH` set to that checkout, `pnpm test` passed 54/54 and `pnpm discovery validate` passed 283 entries. `pnpm lint:check` passed 7/7, `pnpm web:build`, provider catalog test, and `pnpm install --frozen-lockfile` passed. Initial discovery attempts against the stale `E:\9router` snapshot and missing `D:\9router` failed for reference-path reasons, not product regressions.
- GitHub Actions run `36088813308` on `f676559` passed every step. Temporary branch `test/sp0-ci-red` at `acffd1b` failed run `36088820515` specifically at `Run pnpm lint`; the branch was then deleted from the remote and locally. The ignored `.worktrees/sp0-ci-red` directory contains install leftovers after `git worktree remove` could not delete the nonempty directory; it is not a registered worktree.

## Next concrete work

**SP0.1 is not complete.** The M-1 plan's unchecked boxes are historical instructions; its execution checkpoint records completion. The execution and retry contracts are now defined in §4.2; when `apps/api` exists, implement the helper, enforce provider `execute` timeout and bounded retries, and check repository SQL enforcement against actual Drizzle calls. Clean and deliberately violating branches have now passed and failed CI in the intended places. Keep the two skills for SP0.2-SP0.5 after their own red baselines; do not write them first. SP1 (NestJS/Fastify boot) follows SP0.

Before starting, inspect `docs/superpowers/specs/2026-09-22-aigate-design.md` §9 and §11, `docs/governance/rules.md`, and this handoff. Do not treat `UI_READY` as working API integration or copy the 9Router implementation accidents into AIGate.

## Reproduce the M-1 gate (PowerShell)

```powershell
$env:NINEROUTER_PATH = (Resolve-Path '.reference/9router').Path
pnpm test
pnpm discovery validate
pnpm web:build
```
