# SP54 — explicit static channel rollback

Base: `51046d4`, clean worktree. SP52 only promotes newer releases. An operator
needs a bounded way to withdraw a bad but valid release from the channel while
keeping the fixed manifest usable for fresh installs and update checks.

## Rules before code

- `AIGATE_EXTENSION`: `pnpm release:channel-rollback <prior-signed-manifest>
  <public-key.pem> <channel-dir>` previews a target strictly older than the
  verified current channel version. The operator retains the prior manifest.
- `AIGATE_EXTENSION`: verify the current manifest signature and the target
  manifest plus its immutable same-directory archive under the SP52
  `.publish.lock`. A damaged current archive must not block recovery. Apply
  stages the prior manifest and atomically replaces only `latest.manifest.json`.
- `AIGATE_EXTENSION`: no archive is copied, removed or overwritten. Wrong key,
  target tamper/missing archive, invalid current signature, same/newer version,
  symlink or busy lock refuse.
- `AIGATE_EXTENSION`: preview changes no release file; only a short lock file
  is created and removed. No network, process restart or user data operation.
- `IMPLEMENTATION_ACCIDENT`: npm global updater behavior does not define
  rollback of this signed static channel.

## Gates

- [x] Contract and Feature Matrix entry before product code.
- [x] Explicit preview/apply CLI and synthetic rollback/error/HTTP acceptance.
- [x] Relevant release/update regressions, build, lint, discovery, diff and AST graph.
- [x] Handoff/API_UI_MAP/matrix from actual evidence; local checkpoint only.

Verification: channel tests 2/2 cover preview/CLI apply, signed old target,
same/newer refusal, wrong/oversized key, missing/tampered/non-regular target
archive, busy lock, malformed current manifest, and recovery from a damaged
current archive. Local HTTP serves the restored manifest and exact target
digest. SP49 package 1/1 and SP51 managed installer/launcher 3/3 pass after
build. Full build, lint (689 modules/2540 dependencies), discovery (387
entries), diff and AST graph (529 files, 11,643 nodes/25,938 edges) pass.
No real channel, key, vendor, user data, dependency, semantic extraction or
remote push.
