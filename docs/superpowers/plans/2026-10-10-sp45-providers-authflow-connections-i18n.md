# SP45 / M3 U4 — Providers, AuthFlow and Connections EN/VI

Base: clean `e30008e` on `feat/m1-discovery`. Extend the existing browser-local
locale over the U4 provider catalog, custom-provider and model panels, OAuth/
token AuthFlow, and Connections screens. Keep the existing SP13–SP17/M2 APIs,
query keys, payloads, credential boundaries and mutation lifecycle unchanged.

## Scope

- Localize owned presentation in `features/providers/{screens,custom,models,sign-in,test-result}.ts(x)`.
- Cover built-in/custom provider list and detail, connection fields and actions,
  model import/test controls, and all existing sign-in branches: generic OAuth,
  device code, Trae callback/token import, Cursor import, and Kiro methods.
- Preserve provider/model names and IDs, URLs, endpoint paths, protocol names,
  API codes, server diagnostics, callback values, credential hints that are
  literal protocol data, and every submitted field/value.
- Locale changes render copy in place. They do not refetch, reopen OAuth/device
  polling, reset drafts, replay mutations, alter query keys or change timers.
- This slice does not add an API, dependency, storage key, database field,
  provider integration, or real credential/vendor action.

## Ordered work

1. Record the contract and Feature Matrix extension before product edits.
2. Add matched EN/VI catalog keys and wire the existing U4 components at render
   time, using the existing shared error boundary for stable codes/raw text.
3. Add focused native assertions for catalog parity and mounted provider/AuthFlow
   copy/state preservation; run an isolated browser fixture with synthetic APIs,
   fake transport and no host credential/CLI writes.
4. Run the requested final gates: build, lint, discovery validation, installed
   AST-only graph refresh, project map refresh and staged/unstaged diff checks.
5. Update the contract, API↔UI map, matrix and handoff from actual evidence, then
   create one local checkpoint commit. Do not push.

## Acceptance plan

- Native: shared locale catalog/error tests plus focused provider/test-result
  checks; no broad suite.
- Browser: built same-origin app on an isolated loopback fixture with synthetic
  catalog/connections/OAuth/model responses; verify EN↔VI on `/providers`,
  provider detail, custom provider form, Connections and AuthFlow branches,
  retained drafts/pending state, zero locale-triggered network/mutation replay,
  visible code/raw diagnostic, and 390px no horizontal overflow.
- Mark the matrix `verified` only if the focused tests, browser acceptance,
  build, lint, discovery, graph and diff gates all pass.

## Ledger

- [x] Scope, contract and Feature Matrix entry recorded before product edits.
- [x] Product implementation and focused native checks (build plus 10 targeted tests).
- [x] Isolated browser acceptance with synthetic responses and zero vendor calls: EN→VI,
  literal provider retention, three initial API reads and zero locale-triggered reads.
- [x] Build, lint, discovery (378 entries), AST graph/project map refresh and diff gates.
- [ ] Handoff, API↔UI map, matrix evidence and local checkpoint commit.
