# AIGate

Read `docs/PROGRESS_HANDOFF.md` before resuming work. M-1 discovery is complete against the read-only 9Router reference at `D:\9router` commit `39e36d3d`; the next milestone is M0 SP0.1.

## Repository map

- `apps/web` is a Vite/React visual preview. Its provider catalog and combo form are UI only; credentials and combos are not persisted to an AIGate backend. Read `docs/design/UI_HANDOFF.md` before frontend work.
- `tools/discovery` holds the Feature Matrix tooling and parity gates. `docs/discovery/feature-matrix` records reference behavior; `docs/discovery/inventory.json`, `docs/discovery/coverage.md`, and `docs/capabilities.md` are generated outputs.
- `docs/superpowers/specs/2026-09-22-aigate-design.md` is the architecture and milestone spec. For M0, read sections 9 and 11. Follow `docs/governance/rules.md` for implementation.
- `D:\9router` is a read-only reference, not the AIGate source tree. Its `CLAUDE.md` and commands do not describe this repository.

## Verify (PowerShell)

```powershell
pnpm install --frozen-lockfile
$env:NINEROUTER_PATH = 'D:\9router'
pnpm test
pnpm discovery validate
pnpm web:build
```

Before stopping, update `docs/PROGRESS_HANDOFF.md` with work completed, checks run, current work, and the next concrete step. Do not equate a visual UI preview with live backend integration.
