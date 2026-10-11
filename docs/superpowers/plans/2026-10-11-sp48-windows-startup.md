# SP48 — Windows sign-in startup

Base `43023ca`; the preceding Sign out spacing fix has its own checkpoint.
The original M3 General design mentions updates but AIGate has no published
release channel. SP48 is the remaining bounded OS startup slice in General.

1. Label the AIGate-only behavior in the Feature Matrix and define the contract.
2. Implement status and guarded enable/disable for an exact current-user
   Startup-folder script. Never overwrite a foreign entry or store credentials.
3. Wire EN/VI General UI with fresh password, errors and truthful status.
4. Verify synthetic folder/API cases, browser presentation, build/lint/discovery,
   AST graph, diff checks; update handoff/map and checkpoint locally without push.

## Ledger

- [x] Scope, rule labels and contract.
- [x] Native registration and focused backend tests: 20/20 scoped; generated VBScript launched a synthetic Node entry via `cscript`.
- [x] General UI and browser acceptance: EN→VI, one POST only, 390px without overflow; shared i18n checks 8/8.
- [x] Docs, full build, lint, discovery (381), AST graph and diff gates; local checkpoint without push.
