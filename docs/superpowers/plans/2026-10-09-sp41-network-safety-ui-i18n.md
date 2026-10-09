# SP41 Tunnel and MITM EN/VI — Native plan

Base: `ba5e25a`, clean worktree. Complete the remaining bounded M3 U9 UI
language slice over existing SP25 safety APIs.

- [x] Record server guards, confirmation/preview boundaries and mock-only
  acceptance in contract and Feature Matrix before product code.
- [x] Localize owned Tunnel/MITM copy while retaining raw URLs, paths, hosts,
  server changes, IDs and the existing action gating.
- [x] Show precise read/action errors and Retry; preserve MITM preview across
  EN/VI, clear an expired preview, and prevent overlap during Apply. Run
  focused native and isolated browser acceptance, including mobile.
- [x] Run build, lint, discovery, AST graph and staged/unstaged diff checks;
  update API↔UI map, handoff and ledger; checkpoint locally without push.

Verification: focused i18n 8/8; built Edge/CDP synthetic fixture passed
Tunnel read failure/Retry, blocked access/route, five-second poll, translated
confirmation reset, held enable, failed disable then explicit retry, MITM read
failure/Retry, raw preview across locale, held Apply, expired-preview recovery,
new preview/Apply and 390px layout. No locale-triggered actions or MITM reads;
no real system actions, vendor, credential or user data. `pnpm build`, `pnpm
lint` (649 modules/2317 dependencies), 374-entry discovery and AST refresh
pass. Graph: 11,134 nodes/24,745 edges, zero LLM tokens; all prior node/link
identities and 29 hyperedges remain. Updater communities changed 446→434
despite `--no-cluster`; no fresh semantic extraction. Temporary fixture and
browser/server removed. Local checkpoint only; no push.
