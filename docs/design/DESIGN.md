# AIGate — Design System

Source of truth: `docs/design/stitch-briefs.md` § Shared design system.

## Product

AIGate — a local AI gateway with a web dashboard. Runs on the user's own
machine. The user is a developer routing AI traffic across many upstream
providers.

## Tone

Dense, technical, calm. An operations console, not a marketing site. No hero
sections, no illustrations, no rounded pastel cards. Closer to Linear / Vercel
dashboard / Grafana than to a SaaS landing page.

## Layout

- Persistent left sidebar, collapsible, 240px expanded / 56px collapsed.
- Top bar: breadcrumb, search, theme toggle, account menu.
- Content area: max readable width (~720px) for forms, full-bleed for tables.

## Typography

- One sans for UI (Inter).
- One mono for identifiers — model ids, API keys, URLs, log lines, token counts
  (JetBrains Mono).
- Numbers in tables: tabular figures, mono, right-aligned.
- Scale: 12px meta / 13px table / 14px body / 16px section / 20px page title /
  32px metric numbers.

## Color

Neutral grey base, one accent for primary actions (indigo). Status colors carry
meaning and are used nowhere else:

| Token | Meaning |
|---|---|
| green | healthy, succeeded |
| amber | degraded, nearly exhausted, warning |
| red | failed, exhausted, destructive |
| grey | disabled, unknown, not configured |

Must work in light and dark. Dark mode surface is near-black, not navy.

## Density

Compact. Table rows ~36px. Card padding 16px. Section gap 24px. Prefer a table
over a card grid when the list can exceed ~20 items.

## Required states — every screen

- **Loading**: skeleton shaped like the real content. Never a bare spinner.
- **Empty**: a cause line plus one action button. Never an illustration.
- **Error**: an error code in mono, a human sentence, a retry button. Never
  "Something went wrong".

## Destructive actions

Open a confirm modal that requires typing the object's name. Red button, and the
button stays disabled until the typed name matches.

## Components

- **Status pill**: 20px tall, 11px uppercase, status color at 12% background.
- **Health dot**: 8px circle in a status color.
- **Copy field**: mono value plus a ghost copy button; shows "Copied" for 2s.
- **Secret field**: masked by default with a reveal eye; never renders a stored
  secret value — shows a "configured" pill and a Replace button instead.
- **Metric card**: large number, sparkline, delta chip versus previous period.
- **Warning banner**: amber (or red at maximum severity), full sentences, left
  border 2px in the status color.

## Sidebar navigation — identical on every screen

```
Overview
Gateway        Endpoint & Keys · Routing & Fallback · Token Saver
Providers      LLM Providers · Media Providers · Connections · Quota
Traffic        Usage · Requests · Console(dev)
Network        Proxy Pools · Tunnel · MITM
Integrations   CLI Tools · Skills · MCP
Settings       General · Auth & Access · Developer
```

Console appears only when Developer mode is on. No other item is ever hidden.

## Hard rule

No credential, API key, cookie, or token value ever renders anywhere in the UI.
