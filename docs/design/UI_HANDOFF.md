# UI ownership handoff

The user asked for the interface from `docs/design/stitch-export` to be built
before Claude connects application logic. The implementation was built on
`feat/ui-first` in `.worktrees/ui-first` and has been fast-forwarded into the
current `feat/m1-discovery` branch. `apps/web` is ready for logic integration.

**`UI_READY` means the screen's visual layout is implemented in React with demo
data. It does not mean its API, authentication, mutation, validation, SSE, or
business behavior is implemented. Claude owns those integrations and should
keep the existing screen layout/components instead of recreating Stitch HTML.**

## Architecture and source of truth

- Spec: `docs/superpowers/specs/2026-09-22-aigate-design.md` §10.3–10.10;
  ownership map: `docs/PROJECT_MAP.md` U0–U11.
- Stitch reference: `docs/design/stitch-export/{html,shot}/`; fixes:
  `docs/design/stitch-audit.md`; tokens and rules: `docs/design/DESIGN.md`.
- `apps/web` is a Vite + React SPA with TanStack Router/Query, Tailwind tokens,
  Radix dialogs, `app/` shell and route mapping, `features/<area>/screens.tsx`,
  and `shared/ui.tsx`. Add `api.ts`, hooks, models, and forms inside the owning
  feature only when real integration needs them. Features must not import other
  features. Query owns server state; router search params own shareable filters;
  component state owns ephemeral UI.
- One shell renders all console pages. Sidebar follows Stitch `overview` with
  all seven groups. Console is visible only in Developer mode. Use
  `settings-auth-v2`; the original `settings-auth` export is obsolete.

## Visual implementation status

| Project area | UI status | React screens |
|---|---|---|
| U0/U1 design system and shell | UI_READY | theme, sidebar, topbar, responsive layout, shared states/dialogs/toast |
| U2 auth, onboarding, settings | UI_READY | `/welcome`, `/login`, `/callback`, `/settings/{general,auth,developer}` |
| U3 endpoint and keys | UI_READY | `/gateway/endpoint` |
| U4 providers and AuthFlow | UI_READY | `/providers`, `/providers/{new,anthropic,connections}` and add-connection modal |
| U5 media providers | UI_READY | `/providers/media`, `/providers/media/video`, `/providers/media/video/xai` |
| U6 routing and Token Saver | UI_READY | `/gateway/{routing,token-saver}` |
| U7 usage, quota, requests | UI_READY | `/traffic/{usage,requests}`, request detail, `/providers/quota` |
| U8 overview | UI_READY | `/` |
| U9 network | UI_READY | `/network/{proxy-pools,tunnel,mitm}`, deploy wizard |
| U10 integrations | UI_READY | `/integrations/{cli-tools,skills,mcp}`, CLI tool detail |
| U11 developer console | UI_READY | `/traffic/console` (Developer mode gate) |

Stitch `authflow-modals`, `deploy-wizard`, and `login-callback` are state
showcases, not extra top-level routes. API values in the UI are fixtures; the
sidebar says “Demo data · backend pending.” Buttons that save, deploy, revoke,
or authenticate are visual interaction points only. Never treat a demo click as
a completed mutation. No stored credential value is rendered.

## Claude's integration boundary

1. Implement feature API adapters, TanStack Query hooks, real forms/validation,
   mutation outcomes, SSE, auth, i18n, and error
   boundary per the spec. Replace fixture arrays with sanitized API data.
2. Keep `app/shell.tsx`, `styles.css`, `shared/ui.tsx`, and visual markup in
   `features/*/screens.tsx` as the UI source. Change them only where data binding
   or accessibility requires it; do not create a second page/shell for a
   `UI_READY` route.
3. Shared loading/empty/error visuals can be inspected on any shell route with
   `?uiState=loading`, `?uiState=empty`, or `?uiState=error`. Wire real query
   states to these components; remove the preview parameter when no longer
   useful. Call `useToast()` from `shared/toast.tsx` for transient mutation
   errors/successes; login currently demonstrates an error toast. Destructive
   actions use a Radix type-to-confirm dialog.
4. Run `pnpm install`, `pnpm web`, and `pnpm web:build` from the repo root.

This branch is **visual UI complete for U0–U11, not M3 functionally complete**.
