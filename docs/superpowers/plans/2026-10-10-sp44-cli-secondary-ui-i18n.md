# SP44 / M3 U10 — remaining CLI adapter details EN/VI

Base: clean `4f40943`. Cover 14 remaining CLI detail routes through their
existing SP25 API hooks; do not change server file writers or payloads.

## Acceptance plan

1. Record extension matrix and UI contract before product edits.
2. Localize owned copy, read failure/retry, review expiry and mutation feedback.
   Preserve drafts/review across locale switches; block overlapping actions;
   clear stale/expired reviews.
3. Run focused i18n checks and isolated browser acceptance across adapter
   families, EN/VI switching, read error, preview/apply/reset, pending state,
   stale review and 390px layout. Use synthetic responses only.
4. Run build, lint, discovery validation, installed AST-only graph refresh and
   staged/unstaged diff checks. Update handoff, API↔UI map and matrix; commit
   locally after verification.

## Ledger

- [x] Scope, contract and matrix entry recorded.
- [x] Product implementation and focused i18n/error checks (16/16).
- [x] Isolated Edge/CDP browser acceptance: 14 routes, 29 synthetic reads,
  28 configure/reset previews and 15 Apply attempts; mounted EN↔VI caused
  zero requests, stale review cleared, held Apply disabled controls, and 390px
  layout had no horizontal overflow. No real CLI file, key or vendor used.
- [x] Build, lint (652 modules/2335 dependencies), discovery (377 entries),
  installed AST-only graph refresh (11,196 nodes/24,977 edges), staged and
  unstaged diff checks pass; graph remains merge-derived.
- [x] Handoff, map, matrix and local checkpoint follow verification.
