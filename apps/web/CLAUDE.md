# Frontend UI ownership

Read `docs/design/UI_HANDOFF.md` and `docs/design/API_UI_MAP.md` from the repo root before frontend work. `API_UI_MAP.md` lists which screens are wired to which API and how each error code is shown; update it whenever you wire a screen.
Every U0–U11 route is marked `UI_READY`: its React layout already exists under
`src/features/*/screens.tsx`. Keep and wire those screens to API/query/form
logic; do not duplicate the pages or build another shell from Stitch exports.
The fixture data and visual-only action buttons are intentionally pending
backend integration. The design source is `docs/design/stitch-export` plus
`docs/design/DESIGN.md` and `docs/design/stitch-audit.md`.
