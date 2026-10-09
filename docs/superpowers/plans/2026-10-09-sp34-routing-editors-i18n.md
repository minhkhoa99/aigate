# SP34 Routing editor EN/VI — Native plan

Base: `ce8820c`, clean worktree. Complete M3 U6 language coverage for the
existing Combo list/form and Capacity adapter alongside the already-localized
Routing status and Simulator.

- [x] Record the display/data and mutation boundaries in a local contract and
  Feature Matrix before product code.
- [x] Localize owned copy and render-time notices without changing request
  payloads, limits, query keys, drafts or tab identity.
- [x] Run focused locale/routing checks and isolated browser acceptance for
  EN/VI, pending/draft preservation, errors, zero unintended probe/mutation
  calls and 390px layout.
- [x] Run build, lint, discovery and staged/unstaged diff checks; refresh the
  installed AST graph, update map/handoff/ledger and commit locally without push.

Verification: shared i18n 8/8; isolated Edge/CDP acceptance through synthetic
same-origin API passed for combo draft and duplicate error across locale changes,
capacity draft/pending save, raw diagnostic/read error/Retry, 390px width and
explicit probe. Request log: one deliberate pool PUT and one deliberate model
Test POST; zero automatic probes or replayed saves. Full build, lint and
discovery validation (367 entries) passed. Graph AST refresh: 454 code files,
11092 nodes/24580 edges, zero LLM tokens; inherited semantic links are not
fresh extraction. Staged/unstaged diff check and local checkpoint are recorded
in the handoff after staging.
