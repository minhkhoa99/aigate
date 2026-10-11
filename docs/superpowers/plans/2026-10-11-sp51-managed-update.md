# SP51 — verified managed update and rollback

Base: `91f9965`, clean tracked worktree. SP49 supplies signed archives and
SP50 supplies explicit signed availability checks.

## Rules before implementation

- `AIGATE_EXTENSION`: managed installs use a new root and an immutable release
  directory per version; source checkouts cannot self-overwrite.
- `AIGATE_EXTENSION`: a stable launcher owns version selection and startup
  fallback. Existing SP48 Startup registration must launch the stable entry
  when managed.
- `AIGATE_EXTENSION`: stage only after authenticated password confirmation,
  fixed-channel signature and streamed digest verification. A pending release
  switches on next launcher start, with no process kill.
- `AIGATE_EXTENSION`: user data stays outside release root; rollback selects
  the retained previous release and needs a restart.
- The 9router npm updater's public version probe and force-kill behavior are
  `IMPLEMENTATION_ACCIDENT` for this distribution and are not copied.

## Gates

- [x] Implement bounded package validation, initial managed install and stable launcher.
- [x] Implement authenticated stage/rollback API with cancellation and EN/VI UI.
- [x] Targeted synthetic package, fake transport, auth, tamper, stale, failure,
      startup fallback/rollback and browser acceptance checks.
- [x] Build, lint, discovery, diff and AST graph refresh; update handoff and
      feature matrix; local checkpoint only.

Verification: managed package/launcher tests 3/3, signed update API tests 7/7,
Settings/Startup regressions 7/7, shared web i18n/error/SSR 16/16, SP49
release regression 1/1. Isolated Edge used a same-origin fake API at 390 px:
one held stage POST, EN→VI switch during pending, pending result and no
horizontal overflow. Full build, lint, discovery (384 entries), AST-only graph
and diff checks passed. No real channel, signing key, vendor, credential,
user data, dependency addition, semantic extraction or remote push.
