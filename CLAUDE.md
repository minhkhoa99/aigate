# AIGate

Read `docs/PROGRESS_HANDOFF.md` before resuming work. M-1 discovery is complete against the read-only 9Router reference at `.reference/9router` commit `39e36d3d`. M0 SP0 is in progress; the handoff has the current step.

**REQUIRED SKILL:** `porting-behavior-not-code` — before any feature taken from 9router. Read `.agents/skills/porting-behavior-not-code/SKILL.md`.
**REQUIRED SKILL:** `writing-lean-bounded-code` — before writing any product code. Read `.agents/skills/writing-lean-bounded-code/SKILL.md`.

## Repository map

- `apps/server` is the NestJS 12 + Fastify backend (ESM, built with `tsc`). So far it has only `GET /health`, and in production it serves `apps/web/dist` on the same port (default `20200`, bound to `127.0.0.1`).
- `packages/database` is the SQLite driver chain. All four drivers (bun:sqlite, better-sqlite3, node:sqlite, sql.js) go through one locked `sqlite-proxy` (see SPIKE-1). Tables are added per bounded context in the SP that implements it, following `packages/database/SCHEMA_CONVENTIONS.md`. So far there are none; `test/fixture` holds the conformance schema. Never await network I/O inside a transaction, because the lock serializes all access. The server opens `$AIGATE_DATA_DIR/aigate.db` (default `~/.aigate`).
- `apps/web` is a Vite/React visual preview. Its provider catalog and combo form are UI only; credentials and combos are not persisted to an AIGate backend. Read `docs/design/UI_HANDOFF.md` before frontend work.
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
