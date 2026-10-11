# SP47 — encrypted installation backup and reviewed restore

Base `2ff54d3` on `feat/m1-discovery`. Preserve the verified M2 SSO and the
separate SP27 portable settings transfer. No real user data or credentials are
used in acceptance. Native SQLite/Node crypto only; no new dependency.

1. Add a bounded, consistent SQLite snapshot operation and encrypted archive
   codec with a fixed owned-file list. Authenticate sensitive routes with a
   real session and fresh password.
2. Validate and preview archive without writes. Apply only stages it after a
   current-state fingerprint check; startup applies before opening SQLite and
   rolls back safely after an interrupted replacement.
3. Wire General Settings export, file review, typed confirmation and explicit
   restart notice in EN/VI. Keep portable settings transfer unchanged.
4. Run isolated backup/restore and regression tests, browser acceptance, build,
   lint, discovery, graph AST refresh and diff checks. Update handoff/contract
   and checkpoint locally; do not push.

## Ledger

- [x] Reference rules labeled and native contract written.
- [x] Snapshot, archive and restore staging/startup path.
- [x] API/UI and focused acceptance: database 6/6, scoped server 23/23, web i18n 8/8, isolated Edge export/preview/apply EN/VI and 390px.
- [x] Static/graph/doc gates and local checkpoint (no push).
