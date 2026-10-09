# SP30 Routing Overview and Fallback status — Native plan

Approved by the user's request to implement SP30 on 2026-10-09. Base:
`ccead71`, clean worktree. Scope: replace only the two remaining U6 sample
tabs with bounded local status. Contract: `docs/contracts/routing-status.md`.

- [x] Record the AIGate extension and exact read-only wire contract in the
  Feature Matrix before product code.
- [x] Add two metadata-only SQL projections to `ConnectionsRepository`: grouped
  enabled accounts by provider and active lock rows, each with a 101st sentinel.
- [x] Add a session-guarded routing status controller that combines those
  projections with the existing settings, combo and capacity repositories and
  live registry's keyless providers. Do not instantiate adapters or inspect
  secrets.
- [x] Replace sample Overview/Fallback markup with EN/VI status rendering,
  loading/error/Retry, explicit truncation, local lock countdown and tab-owned
  query/timer lifecycle. Keep Combo/Capacity/Simulator behavior unchanged.
- [x] Run targeted server/web checks, isolated browser acceptance with a
  synthetic DB and rejecting transport, build/lint/discovery/diff checks.
- [x] Update contract/API↔UI map, handoff, Feature Matrix verification state and
  AST graph if needed; create a local checkpoint without pushing.

Acceptance includes auth/no-store, exact expiry boundary, disabled-account
locks, 100-row overflow, keyless routes, no DB/vendor/refresh/decryption/usage/
rotation effects, EN/VI rendering, countdown/cleanup and 390px layout. This
snapshot is configuration information, not a live model probe.
