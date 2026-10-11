# SP57 — load dashboard screens by route

Base: `5632ab3`, clean worktree. The production Vite build emits one 835.25 kB
JavaScript entry chunk and warns above 500 kB. Spec §10.6 requires route code
splitting. `app/screens.tsx` statically imports every feature screen even on
`/login` and `/`.

## Rules before code

- `AIGATE_EXTENSION`: keep the shell, auth status gate, locale and shared UI in
  the initial module. Load each feature screen module only on route entry;
  routes that share one source module share its chunk. Keep existing routes,
  parameters, Developer Console gate and `?uiState=` preview behavior.
- `AIGATE_EXTENSION`: show a localized skeleton while a route chunk loads.
  A failed chunk/render shows a visible code and Reload action; navigating to
  another route recovers. Locale changes must not reset a mounted screen,
  refetch its data or replay its mutations.
- `AIGATE_EXTENSION`: no new API, dependency, database field, storage key,
  vendor call or screen design. Measure built entry/chunks and inspect at least
  login, overview, a deep detail route and a gated route in an isolated browser.
- `IMPLEMENTATION_ACCIDENT`: eager import of all screens was a UI handoff
  layout detail, not a user-facing contract.

## Gates

- [x] Contract and Feature Matrix entry before product code.
- [x] Lazy route implementation and focused route/loading/error checks.
- [x] Production build bundle measurement and isolated browser acceptance.
- [x] Lint, discovery, AST graph, staged/unstaged diff, handoff; local commit.
