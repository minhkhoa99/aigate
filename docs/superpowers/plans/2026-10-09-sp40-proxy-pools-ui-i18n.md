# SP40 Proxy Pools and Deploy Wizard EN/VI — Native plan

Base: `6efd151`, clean worktree. Complete a bounded M3 U9 language slice over
SP18 pool/rotation/deploy APIs. Tunnel and MITM remain separate screens.

- [x] Record data, draft, credential and mutation boundaries in contract and
  Feature Matrix before product code.
- [x] Localize Pool list, rotation, add/edit/delete/test and Deploy Wizard;
  preserve raw IDs/URLs/diagnostics and current API payloads.
- [x] Correct failed pool/rotation reads to show code/diagnostic/Retry and use
  render-time localized mutation notices; run focused native and isolated
  browser acceptance for mounted EN/VI, pending mutations and mobile.
- [x] Run build, lint, discovery, AST graph and staged/unstaged diff checks;
  update API↔UI map, handoff and ledger; checkpoint locally without push.

Verification: focused i18n 8/8; isolated built Edge/CDP fixture passed
pool/rotation read failures and Retry, mounted EN↔VI with stable raw IDs and
form draft, held pool PATCH, probe error toast, rotation PATCH, guarded delete,
Cloudflare wizard draft, held failed deploy then explicit success, token
clearing and 390px Pool/Wizard layout. Locale changes caused zero requests;
only synthetic same-origin APIs were used. `pnpm build`, `pnpm lint` (649
modules/2314 dependencies), 373-entry discovery and AST-only graph refresh
pass. Graph: 11,129 nodes/24,732 edges, zero LLM tokens; all prior node/link
identities and 29 hyperedges remain. Temporary fixture/browser/server removed;
no vendor, real credential or user data. Local checkpoint only; no push.
