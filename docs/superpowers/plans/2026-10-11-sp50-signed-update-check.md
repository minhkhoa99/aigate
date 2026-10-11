# SP50 — signed release availability

Base: `5b0dfd4`, clean tracked worktree. SP49 produces the signed manifest.
The current source/portable installation has no stable launcher or rollback
switch, so this SP performs an explicit trusted availability check only. A
later SP owns download, install, restart and rollback.

## Contract

- Optional operator configuration: HTTPS manifest URL without credentials,
  query or fragment, and an absolute Ed25519 public-key file. Both must be
  present for the channel to be ready. No key or URL is baked into AIGate.
- Authenticated `GET /api/settings/update` returns current version, channel
  readiness, busy state and last successful in-memory check. It makes no
  network request. `POST /api/settings/update/check` has no body, explicitly
  fetches the fixed URL through the shared transport, with a 4 s transport
  budget, 5 s overall deadline and 4 KiB manifest cap.
- Parse exact SP49 manifest v1, verify Ed25519 signature with the pinned key,
  compare full SemVer (including prerelease), and return metadata only. Do
  not fetch the archive or accept a URL from the response.
- One check runs at a time. On failure keep the last good result; UI displays
  precise EN/VI error and Retry. Locale changes never trigger a check.

## Gates

- [x] Add contract and Feature Matrix rule before product edits.
- [x] Implement bounded server check, cancellation and guarded endpoints.
- [x] Wire General UI EN/VI and stable errors.
- [x] Test unconfigured/auth, signed current/newer/older, tamper, body bound,
      timeout/cancel/busy and zero archive requests with a fake transport.
- [x] Build, lint, discovery, diff, AST graph, handoff and local checkpoint.
