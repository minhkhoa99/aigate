# SP31 Media Providers dashboard — Native plan

Base: `dfc1ace`, clean worktree. The SP23 media catalog and TTS voice APIs are
already wired; SP31 closes the remaining M3 U5 dashboard state gaps.

- [x] Record the local rules and view contract before product code.
- [x] Derive route/account availability from existing catalog and connection
  data; show separate route/configured counts and honest loading/error states.
- [x] Make kind/provider details and endpoint actions match actual route
  availability; mount TTS voice browser only with complete inputs.
- [x] Run focused rule/UI checks and isolated browser acceptance, then build,
  lint, discovery validation and diff checks.
- [x] Update API/UI map, handoff, contract and matrix to observed evidence;
  refresh installed AST graph if needed and checkpoint locally without push.
