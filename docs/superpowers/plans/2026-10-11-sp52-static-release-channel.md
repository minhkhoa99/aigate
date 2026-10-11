# SP52 — local static release channel publication

Base: `8afc583`, clean tracked worktree. SP49 signs release files; SP50/51
consume a fixed HTTPS manifest and same-directory archive. No real host or key
is available. This slice supplies an operator-run local publication handoff.

## Contract before code

- `AIGATE_EXTENSION`: `pnpm release:publish <signed-manifest> <public-key.pem>
  <existing-channel-dir>` verifies the signed release before writing.
- `AIGATE_EXTENSION`: an existing channel must verify under the same pinned key;
  the new version must be newer by full SemVer. Archive basenames are immutable.
- `AIGATE_EXTENSION`: stage a verified archive inside the channel, publish that
  archive first, then atomically replace `latest.manifest.json`. Preserve prior
  archives so a failed publish leaves the old channel usable. An exclusive
  lock rejects concurrent writers; a stale lock needs operator inspection.
- `AIGATE_EXTENSION`: the tool touches only the chosen local channel directory.
  Hosting, TLS, signing key custody and deployment remain operator-owned.
- `IMPLEMENTATION_ACCIDENT`: the reference npm registry updater and process
  kill path do not define this distribution workflow.

## Gates

- [x] Local publisher with bounded verification, immutable artifacts and atomic
      manifest switch.
- [x] Synthetic key/package acceptance for first publish, promotion, tamper,
      downgrade, conflict, lock and failure preservation; local HTTP read.
- [x] Relevant regressions, build, lint, discovery, diff and AST graph checks.
- [x] Contract, matrix, API/UI map and handoff updated from passing evidence;
      local checkpoint only.

Verification: synthetic publisher 1/1 (wrong key, first publish, full SemVer
promotion/downgrade, exclusive lock, duplicate archive, damaged source and
channel, old manifest retention, local HTTP manifest/archive digest); SP49
package regression 1/1 and SP50/51 signed-update checks 7/7. Windows refused
creation of the optional symlink test fixture (`EPERM`); the code rejects
symlinked channel entries, but that branch was not executed here. Full build,
lint (689 modules/2540 dependencies), discovery (385 entries), AST-only graph
(523 files, 11,603 nodes/25,865 edges) and diff checks pass. No browser change,
real signing key, host, vendor, user data, new dependency or remote push.
