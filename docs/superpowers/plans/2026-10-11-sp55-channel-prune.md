# SP55 — explicit static channel archive cleanup

Base: `a33db39`, clean worktree. SP52 retains every published archive and SP54
retains them for rollback. A local operator needs an exact, reviewed cleanup
action when an old archive is no longer required.

## Rules before code

- `AIGATE_EXTENSION`: `pnpm release:channel-prune <signed-manifest>
  <public-key.pem> <channel-dir>` previews one archive named by a retained
  SP49 signed manifest. `--apply` removes only that archive.
- `AIGATE_EXTENSION`: verify the current channel manifest and archive, the
  target signature and the target archive's exact size/digest with the same
  pinned key. Reject the archive referenced by `latest.manifest.json`, whether
  or not its bytes match the supplied manifest.
- `AIGATE_EXTENSION`: take the SP52 `.publish.lock` for preview and apply;
  recheck under the lock before removal. Reject symlinked channel/manifest/key/
  archive paths, missing or tampered files and busy writers. Never scan or
  delete other channel files. A removed archive cannot be used for SP54
  rollback until the operator republishes it through a new valid channel flow.
- `IMPLEMENTATION_ACCIDENT`: the reference npm updater has no signed static
  channel archive cleanup behavior to port.

## Gates

- [x] Contract and Feature Matrix entry before product code.
- [x] CLI preview/apply and focused synthetic refusal/preservation tests.
- [x] Relevant release regressions, build, lint, discovery, diff and AST graph.
- [x] Handoff/API_UI_MAP/matrix from actual evidence; local checkpoint only.

Verification: channel tests 3/3 cover publication/rollback regression and
cleanup preview/apply, protected current archive, wrong key, tampered manifest,
missing/tampered/non-regular target archive, invalid current manifest/archive,
busy lock, exact deletion, and cleanup of an unreferenced newer archive after
rollback. The Windows symlink fixture is attempted but may be refused by the
OS (`EPERM`); code rejects it through `lstat`. SP49 signed package regression
passes 1/1. Full build and lint pass (689 modules/2540 dependencies), discovery
validates 388 entries, and AST-only graph refresh reports 531 files,
11,651 nodes/25,946 edges. Staged/unstaged diff checks pass. No browser route,
API, real channel/key, vendor, user data, dependency, semantic extraction or
remote push was involved.
