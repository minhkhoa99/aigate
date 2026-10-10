# SP42 / M3 U10 — Integrations Skills and MCP EN/VI

## Scope and gates

1. Keep the existing Skills catalogue and MCP API contracts; localize only owned browser copy. Preserve wire values, raw names/URLs/diagnostics and copied snippets.
2. Keep read, tab, form and mutation state stable across mounted EN/VI changes. Guard pending create/edit/delete, show code/diagnostic/Retry for failed reads, and retain drafts after mutation failure.
3. Run focused i18n checks and isolated same-origin browser acceptance for Skills copy, registry/marketplace/storage, errors, pending state and 390px layout. No real remote or local user configuration actions.
4. Run build, lint, discovery validation, staged/unstaged diff checks, and installed AST-only graph refresh if source changes require it. Update contract, map, matrix and handoff with observed evidence; create a local checkpoint only after gates pass.

## Ledger

- [x] Scope and contract recorded.
- [x] Product implementation and focused checks: shared i18n 8/8.
- [x] Isolated browser acceptance: 13 synthetic local requests, eight skill URLs/copy, read/save failure and Retry, held create, Pause/Edit/Delete, EN/VI and 390px layout. No locale-triggered request.
- [x] Build, lint, discovery, graph and staged/unstaged diff checks: 375 entries; AST 11,145 nodes/24,790 links, old IDs/links/hyperedges retained, zero new LLM tokens.
- [x] Handoff, contract, matrix and API↔UI map updated; local checkpoint follows verification.
