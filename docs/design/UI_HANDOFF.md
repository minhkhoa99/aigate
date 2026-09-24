# UI ownership handoff

The user asked for the AIGate interface to be built ahead of backend integration.
Visual design and presentational frontend code are owned by `feat/ui-first` in
`.worktrees/ui-first`. Backend and contract work can continue on other branches.

## Source and architecture

- Product spec: `docs/superpowers/specs/2026-09-22-aigate-design.md` §10.3–10.10.
- Visual reference: `docs/design/stitch-export/{shot,html}/`; audit fixes in
  `docs/design/stitch-audit.md`; design tokens in `docs/design/DESIGN.md`.
- Target: `apps/web`, a Vite + React SPA. Organize by `app/`, `features/`,
  `shared/ui/` and `shared/api/`. Use the spec's TanStack Router/Query and
  feature boundaries when the application shell is built.

## Coordination rule

`UI_READY` means the visual structure, responsive layout, accessibility basics,
and loading/empty/error states exist in code. It does **not** mean the backend is
wired or the screen is production ready. Only screens explicitly listed as
`UI_READY` below are owned by the UI branch. Other Stitch exports remain design
references until marked. Claude should keep backend contracts and business logic
separate, then bind data and callbacks to the finished UI after the branch lands.

| Screen or layer | State | Owner's next action |
|---|---|---|
| U0 design system | IN_PROGRESS | UI branch implements |
| U1 app shell | IN_PROGRESS | UI branch implements |
| U2–U11 screens | DESIGN_REFERENCE | UI branch implements before integration |

Do not copy each Stitch sidebar into a separate route. `overview` is the
navigation reference; one shared sidebar renders every shell route. Use
`settings-auth-v2` instead of `settings-auth`. Stitch showcase composites
(`authflow-modals`, `deploy-wizard`, `login-callback`) represent states, not
additional top-level routes. Console appears only in developer mode.
