# SP38 Requests list and detail EN/VI — Native plan

Base: `c33c832`, clean worktree. Complete M3 U7's remaining Requests page as a
bounded UI language slice over the existing SP24b API.

- [x] Record URL/data/pagination/presentation boundaries in the contract and
  Feature Matrix before product code.
- [x] Localize Requests list/detail and format numbers/dates in EN/VI. Keep
  IDs, names, codes, payloads and cursor/500-row bounds literal/unchanged.
- [x] Correct filter, next-page and detail read errors with code/diagnostic/
  Retry; run focused native and isolated browser acceptance including mobile.
- [x] Run build, lint, discovery, AST graph and staged/unstaged diff checks;
  update API↔UI map, handoff and ledger; checkpoint locally without push.

Verification: focused i18n/usage formatting 13/13. Isolated built Edge/CDP
fixture passed mounted EN↔VI list and detail, URL filters, filter/next-page/
detail failures with Retry, preserved rows and raw codes/names, missing ID,
390px list/detail layout and zero locale-triggered GETs. Full build/lint,
371-entry discovery, AST and diff/checkpoint evidence are in the handoff.
