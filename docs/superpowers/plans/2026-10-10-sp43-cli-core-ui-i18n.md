# SP43 / M3 U10 — CLI Tools discovery and core adapters EN/VI

Base: clean `ccb8e27`. The SP25 tooling contract and SP42 handoff define the
starting state. The next bounded slice covers the read-only CLI list and the
Claude Code, Codex, OpenCode and Cline Preview→Apply screens.

## Acceptance plan

1. Record the UI contract and AIGate extension matrix entry before product
   changes; preserve SP25 server behavior and all other CLI detail screens.
2. Localize owned EN/VI text. Keep raw names/paths/models/diffs/codes; show
   precise read errors and stable preview failure recovery. Guard pending
   actions and preserve mounted drafts/review across locale changes.
3. Run focused catalog/i18n checks and isolated built-browser acceptance with
   synthetic list, four detail statuses, preview/configure/reset/apply,
   expired/stale responses, pending state and 390px layout. Never touch the
   actual host's config files or use credentials.
4. Run build, lint, discovery validation, installed AST-only graph refresh,
   staged/unstaged diff checks; update handoff/map/contracts/matrix with
   observed evidence and make a local checkpoint only after gates pass.

## Ledger

- [x] Scope and contract recorded.
- [x] Product implementation and focused i18n checks (8/8).
- [x] Isolated browser acceptance: 35 synthetic requests, list/four details,
  read error/Retry, expired/changed review, held Apply, Reset→Apply, mounted
  EN/VI and 390px layout; no locale-triggered request.
- [x] Build, lint, discovery (376 entries) and installed AST graph checks:
  11,168 nodes/24,867 links; old IDs/links/hyperedges retained; zero new LLM
  tokens. Staged and unstaged diff checks pass.
- [x] Handoff, contracts, matrix and API↔UI map updated; local checkpoint
  follows verification.
