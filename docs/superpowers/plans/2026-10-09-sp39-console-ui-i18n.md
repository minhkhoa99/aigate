# SP39 Console EN/VI — Native plan

Base: `e597f6a`, clean worktree. Complete the existing M3 U11 Console's
bounded language slice over SP25's metadata log API and Developer mode gate.

- [x] Record gate, API, filter, stream and Clear boundaries in contract and
  Feature Matrix before product code.
- [x] Localize owned Console/gate copy and browser-local time. Preserve raw
  events, stable filter values and existing 200-event/8-stream bounds.
- [x] Show read and Clear errors with code/diagnostic/Retry as applicable;
  prevent duplicate pending Clear. Run focused native and isolated browser
  acceptance including mounted EN/VI, SSE lifecycle and mobile.
- [x] Run build, lint, discovery, AST graph and staged/unstaged diff checks;
  update API↔UI map, handoff and ledger; checkpoint locally without push.

Verification: focused i18n 8/8; isolated built Edge/CDP fixture passed
initial read failure/Retry, mounted EN↔VI, stable raw WARN/filter state,
Pause/Resume connection lifecycle, one held Clear through a language change,
Clear failure retaining events, closed gate EN/VI and 390px layout. Two log
GETs, two SSE opens/closes and two deliberate DELETEs; zero locale-triggered
requests. `pnpm build`, `pnpm lint` (648 modules/2307 dependencies), 372-entry
discovery and AST-only graph refresh pass. Graph: 11,119 nodes/24,668 edges,
zero LLM tokens, all prior node/link identities and 29 hyperedges retained.
Temporary fixture/browser/server removed; no vendor, real credential or user
data. Local checkpoint only; no push.
