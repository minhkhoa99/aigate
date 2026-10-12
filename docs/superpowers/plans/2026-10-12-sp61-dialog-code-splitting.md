# SP61 — defer dialog code from the browser entry

Base: clean `236a7aa`. The production entry is 606.55 kB minified
(185.06 kB gzip). Its source map includes Radix Dialog and focus/dismiss
dependencies because `shared/ui.tsx` imports Dialog even though the initial
shell, auth gate and loading states use only core UI pieces. Every current
dialog consumer is in a route-loaded feature module.

## Contract

- `AIGATE_EXTENSION`: the shell, auth gate, loading/error states and routes
  continue to work without fetching dialog code on initial load. Feature
  routes that use `Modal` or `ConfirmDialog` fetch that code on visit.
- `AIGATE_EXTENSION`: preserve the existing Radix portal, overlay, title,
  focus handling, Escape/outside dismissal, confirm-name input, pending
  disable state, and EN/VI text. Restore focus to the opener on close when it
  still exists; the prior unmount left focus on `body`. Do not change dialog
  timing or mutations.
- `IMPLEMENTATION_ACCIDENT`: having Dialog in the common `shared/ui.tsx`
  module is a file layout detail, not a user-facing contract.
- No HTTP API, database, storage, dependency or vendor call changes.

## Gates

- [x] Matrix and contract before product code.
- [x] Move dialog components to their own module and update every consumer.
- [x] Measure production entry/deferred chunks; browser-check an initial core UI view and a
  dialog's focus, dismissal and confirmation at normal and 390 px widths.
- [x] Web tests, build, lint, discovery, AST graph, handoff, local commit.
