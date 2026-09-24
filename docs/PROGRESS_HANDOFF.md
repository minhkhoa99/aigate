# AIGate progress handoff

Updated: 2026-09-25. Read this before continuing the project plan.

## Completed and verified

- Branch: `feat/m1-discovery`. The starting commit for this audit was `c75d632`; UI preview and its provider/combo handoff were already committed. Read `docs/design/UI_HANDOFF.md` before frontend work. There is still no AIGate backend, live provider connection, or persistent combo API.
- **M-1 Tasks 1-19 are complete against the current reference.** The Feature Matrix has 283 entries covering all 23 groups. Discovery coverage is 166/166 API routes and 11/11 DB repos. Other dimensions are deliberately not exit gates (pages 5/28, registry files 15/124, executors 9/31, translators 37/48, settings keys 47/52); M0 SP4 handles registry extraction.
- The reference checkout is `D:\9router` at commit `39e36d3d` (`v0.5.86`). It added 12 API routes since the original M-1 snapshot: six CLI tool settings routes, combo presets, four Xiaomi MiMo import/login routes, and System One. Eight new matrix entries trace them. Four stale translator evidence lines were corrected; inventory tests now use 166 routes, 124 registry files excluding `index.js`, and 31 executors. Generated inventory, coverage, and capabilities were refreshed.
- The UI provider catalog still matches the 111 active, visible imports in the current 9Router registry. `opencode-zen` uses the special import variable `p68z`, so a numeric-only parser incorrectly reports 110.
- Checks passed: `pnpm test` (54/54), `pnpm discovery validate` (283 entries), `pnpm web:build`, and `node --test apps/web/src/features/providers/catalog.test.mjs`. Discovery commands need `NINEROUTER_PATH=D:\9router` on this machine. `pnpm install --frozen-lockfile` was run without changing the lockfile.

## Next planned work: M0 SP0.1

The M-1 plan's unchecked boxes are historical instructions; the execution checkpoint at its top records completion. The next milestone is M0, starting with **SP0.1 mechanical lint and CI** in design spec §11.2/§11.7. No SP0 implementation exists yet. Define a small runnable violation fixture for each machine-checkable rule, then implement only the checks that can be applied to the current repo. Keep the two skills for SP0.2-SP0.5 after the red baseline; do not write them first. SP1 (NestJS/Fastify boot) follows SP0.

Before starting, inspect `docs/superpowers/specs/2026-09-22-aigate-design.md` §9 and §11, `docs/governance/rules.md`, and this handoff. Do not treat `UI_READY` as working API integration or copy the 9Router implementation accidents into AIGate.

## Reproduce the M-1 gate (PowerShell)

```powershell
$env:NINEROUTER_PATH = 'D:\9router'
pnpm test
pnpm discovery validate
pnpm web:build
```
