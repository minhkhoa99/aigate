# SP53 — explicit managed release cleanup

Base: `e743265`, clean worktree. SP51 retains every installed release so a
long-lived managed root grows after repeated updates. SP53 adds bounded,
operator-initiated cleanup without changing activation or rollback.

## Rules before code

- `AIGATE_EXTENSION`: `pnpm release:prune <managed-root>` lists installed
  release versions and marks current, previous and pending as protected.
- `AIGATE_EXTENSION`: `pnpm release:prune <managed-root> <version> --apply`
  deletes only that exact unreferenced release after re-reading state under
  the existing exclusive managed update lock.
- `AIGATE_EXTENSION`: require a valid managed root, direct regular release
  directories, package/version markers and a path contained within
  `<root>/releases`. Ignore symlinks and unfamiliar entries, and refuse a
  scan above 256 direct entries. Never scan or modify application data.
- `AIGATE_EXTENSION`: the preview is read-only and apply has no automatic
  selection. A failed partial deletion is reported for operator inspection.
- `IMPLEMENTATION_ACCIDENT`: reference npm global overwrites/process killing
  do not define this managed release retention policy.

## Gates

- [x] Contract and Feature Matrix entry before product code.
- [x] CLI and package allowlist; synthetic protected/candidate/path/lock/limit
      acceptance, with no real managed root or user data.
- [x] Relevant release regressions, build, lint, discovery, diff and AST graph.
- [x] Handoff, API/UI map and matrix status from actual evidence; local
      checkpoint only, no push.

Verification: synthetic prune checks 2/2 cover preview, exact deletion,
current/previous/pending protection, state change, busy lock, bad marker,
path traversal, root/release junction refusal, an external junction sentinel
surviving recursive deletion, and 256-entry refusal. SP49 package regression
1/1 includes the CLI in the signed archive; SP51 managed installer/launcher
regression 3/3 passes. Full build, lint (689 modules/2540 dependencies),
discovery (386 entries), diff checks and AST graph (527 files, 11,628 nodes/
25,916 edges) pass. No real managed root, user data, credential, vendor,
dependency, semantic extraction or remote push.
