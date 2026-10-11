# SP56 — restore a missing signed static channel archive

Base: `b84d0e3`, clean worktree. SP55 can remove an unreferenced archive,
while SP54 rollback requires it. SP52 publication only promotes a new version
and does not restore an older archive. This slice restores one missing archive
from the operator's retained signed release without changing the fixed channel
manifest.

## Rules before code

- `AIGATE_EXTENSION`: `pnpm release:channel-restore <signed-manifest>
  <public-key.pem> <channel-dir>` previews one missing archive; `--apply`
  stages and atomically creates only its signed artifact basename.
- `AIGATE_EXTENSION`: under the SP52 `.publish.lock`, validate the current
  manifest signature and the source manifest/archive with the same pinned
  Ed25519 key, exact length and SHA-256. The current archive may be missing,
  enabling its repair. No version ordering is required for a missing archive.
- `AIGATE_EXTENSION`: refuse an existing target path, including damaged or
  symlinked files; never overwrite immutable channel archives. Reverify the
  staged copy before linking it into the channel. No latest-manifest mutation,
  hosting request, managed-install mutation or user-data access.
- `IMPLEMENTATION_ACCIDENT`: reference npm update behavior has no signed
  static channel archive restore operation.

## Gates

- [x] Contract and Feature Matrix entry before product code.
- [x] Synthetic preview/apply, refusal, current-archive recovery and rollback checks.
- [x] Relevant release regressions, build, lint, discovery, diff and AST graph.
- [x] Handoff/API_UI_MAP/matrix from actual evidence; local checkpoint only.

Verification: channel tests 4/4 include publish/rollback/prune regressions,
CLI preview/apply, source signature/archive refusal, wrong key, busy lock,
existing healthy/damaged/non-regular target refusal, invalid current manifest,
recovery of a missing current archive, unchanged latest on older restore, and
successful rollback after restore. The Windows symlink fixture is attempted
but may be refused by the OS (`EPERM`); `lstat` rejection is implemented. SP49
signed package regression passes 1/1 after the full build. Build and lint
(689 modules/2540 dependencies), discovery (389 entries), diff checks and
AST-only graph (533 files, 11,663 nodes/25,960 edges) pass. No real channel,
key, vendor, credential, user data, browser/API flow, dependency, semantic
extraction or remote push was involved.
