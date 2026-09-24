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
| U4 providers and AuthFlow | UI_READY | `/providers`, `/providers/{new,detail,connections}` and add-connection modal; [provider parity baseline](provider-parity.md) |
| U5 media providers | UI_READY | `/providers/media`, `/providers/media/catalog`, `/providers/media/provider`, legacy video preview routes |
| U6 routing and Token Saver | UI_READY | `/gateway/{routing,routing/new,token-saver}`; create-combo form previews a local draft |
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

## Work completed on 2026-09-24 for Claude

| Area | Implemented UI | Still required for functional completion |
|---|---|---|
| Providers | `/providers` and media catalog now list all 111 visible IDs from the local 9Router source registry, grouped by OAuth, Free Tier, API Key, and media capability. Provider detail and `/providers/connections` show connection methods and credential fields. See [provider parity baseline](provider-parity.md) and `apps/web/src/features/providers/catalog.ts`. | Save/test credentials, OAuth callbacks and refresh, model discovery, request adapters, quota/health, and live connection state. The catalog is metadata, not 111 working integrations. |
| Routing combo | `/gateway/routing` now starts on a Combo tab with an empty list state. Its `+ Create combo` action opens `/gateway/routing/new`. The form supports name, fallback/round-robin/fusion modes, ordered model selection with add/remove/reorder, Fusion quorum/judge/grace/timeout/concurrency fields, native input checks, cross-field checks, and an unsaved draft preview. Member and judge dropdowns currently use the four sample models shown on Routing; arbitrary model IDs cannot be typed. Source: `apps/web/src/features/gateway/combo-create.tsx`. | Replace the sample dropdown options with the full live model list from active provider connections, including availability/capability; define the API payload, save/list/edit/delete combos, enforce server validation, run real routing, and implement dry-run simulation. The preview does not persist or dispatch requests. |

The combo preview uses a UI-only shape (`name`, `strategy`, `models`, optional `fusion`). Treat it as a draft for discussion, not an agreed API contract. The 9Router create dialog was used as a reference for name, models, and three strategies; AIGate's extra Fusion controls follow the project spec in §10.3.

Verification: run `pnpm web:build` from the repo root. The provider catalog count check is `node --test apps/web/src/features/providers/catalog.test.mjs`.
