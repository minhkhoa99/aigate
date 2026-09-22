# AIGate — Stitch design briefs

Prompt-shaped input for the Stitch MCP server, derived from
`docs/superpowers/specs/2026-09-22-aigate-design.md` §10.

The spec states screens as engineering contracts (ASCII layout, data source,
edge cases). Stitch needs visual description. This file is the translation.
**The spec stays the source of truth** — when the two disagree, the spec wins
and this file gets corrected.

Order of work: read the **Shared design system** section first and paste it as
context for every screen. Then generate screens in the order listed — grouped by
visual pattern, not by the spec's numbering, so related screens land consistent.

---

## Shared design system

Paste this preamble with every screen prompt.

> **Product:** AIGate — a local AI gateway with a web dashboard. Runs on the
> user's own machine. The user is a developer routing AI traffic across many
> upstream providers.
>
> **Tone:** dense, technical, calm. This is an operations console, not a
> marketing site. No hero sections, no illustrations, no rounded pastel cards.
> Closer to Linear / Vercel dashboard / Grafana than to a SaaS landing page.
>
> **Layout:** persistent left sidebar (collapsible), top bar with breadcrumb +
> search + theme toggle + account menu, content area with a max readable width
> for forms and full-bleed for tables.
>
> **Type:** one sans for UI, one mono for identifiers — model ids, API keys,
> URLs, log lines, token counts. Numbers in tables are tabular-figure mono and
> right-aligned.
>
> **Color:** neutral grey base, one accent for primary actions. Status colors
> carry meaning and are used nowhere else: green = healthy, amber = degraded or
> nearly exhausted, red = failed or exhausted, grey = disabled or unknown.
> Must work in light and dark.
>
> **Density:** compact. Table rows ~36px. Prefer a table over a card grid when
> the list can exceed ~20 items.
>
> **Every screen must show its states:** loading skeleton shaped like the real
> content, empty state with a cause line and one action button, error state
> with a code plus a human sentence plus a retry button. Never a bare spinner,
> never "Something went wrong".
>
> **Destructive actions** open a confirm modal that requires typing the
> object's name.

### Sidebar navigation (identical on every screen)

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

---

## Generation order

| # | Screen | Why this order |
|---|---|---|
| 1 | Overview | Sets the visual language — cards, sparklines, live list, status grid |
| 2 | LLM Providers (list + detail) | Establishes the list/detail pattern reused by Media and Connections |
| 3 | Connections + AuthFlow | The hardest interaction; do it while the pattern is fresh |
| 4 | Endpoint & Keys | Establishes the secret-reveal and copy patterns |
| 5 | Routing & Fallback | The most complex single screen |
| 6 | Usage | Establishes charts |
| 7 | Requests list + detail | Establishes the attempt timeline |
| 8 | Quota | Reuses cards + progress |
| 9 | Token Saver | Reuses cards + pipeline diagram |
| 10 | Media Providers | Reuses Providers |
| 11 | Proxy Pools + deploy wizard | Establishes the wizard pattern |
| 12 | Tunnel | Reuses wizard + warning banner |
| 13 | MITM | Reuses warning banner at maximum severity |
| 14 | CLI Tools list + detail | Establishes the config-diff pattern |
| 15 | MCP | Reuses config-diff |
| 16 | Skills | Simplest content screen |
| 17 | Settings ×3 tabs | Establishes form patterns |
| 18 | Login + OAuth callback | Outside the shell |
| 19 | Onboarding wizard | Outside the shell, reuses AuthFlow |
| 20 | Console | Dev-only, monospace log viewer |

---

## 1 · Overview — `/`

Landing screen. Answers in three seconds: is the gateway alive, what is it
costing, what is broken.

Top: a status strip — green dot, "Running", the base URL in mono with a copy
button, and a "Change port" link.

Below: four metric cards in a row — Requests 24h, Tokens 24h, Cost 24h, Error
rate 24h. Each shows a large number, a small sparkline, and a delta chip versus
the previous 24 hours (green down for error rate, green up for requests).

Below that, a two-column split. Left, wider: a **Live requests** panel — a
streaming list of the 20 most recent requests, newest at top, each row showing
time, model, provider, time-to-first-token, token count, and a success or
failure glyph. A small pulsing dot in the panel header indicates the live
connection. Right, narrower: a **Needs attention** panel — a short list of
grouped warnings: locked accounts, credentials expiring soon, quotas nearly
exhausted. Each row is clickable and carries a severity color.

Bottom, full width: **Provider health** — a dense grid of small squares, one per
configured provider, colored by error rate over the last hour, with the provider
name on hover.

Empty state: when no request has ever been made, replace the live panel and the
health grid with a single onboarding card — "No traffic yet", one line
explaining the gateway is running but nothing is pointed at it, and a "Connect
your first tool" button.

---

## 2 · LLM Providers — `/providers` and `/providers/:id`

**List.** A search field and a filter row across the top: auth type, connected
only, has OAuth, free tier, capability. Then a virtualized grid of provider
cards — around 123 of them. Each card: provider logo, name, a small auth-type
badge, an account count like "2 accounts", and a health dot. Cards are compact,
four or five per row at desktop width.

**Detail.** A header with the logo, provider name, auth badge, a "Test" button
and a "Docs" link. Below, four tabs.

*Accounts* — a table of connections: label, credential type, status, quota,
token expiry, proxy pool, and per-row Test / Edit / Delete actions. An "Add
account" button opens the AuthFlow modal.

*Models* — a table of models with capability badges (vision, PDF, audio, video,
tools), price per million tokens in and out, and an enable toggle per row.

*Config* — a form: base URL override, custom headers as key/value rows, proxy
pool select, priority number.

*Activity* — a compact recent-requests table scoped to this provider.

---

## 3 · Connections and AuthFlow — `/providers/connections`

**Table.** Every credential across every provider in one place: provider logo
and name, connection label, credential type, status pill, expiry with a relative
time, last used, proxy pool, and row actions Test / Refresh token / Delete.
Filter chips above: expiring soon, failing, locked. A "Test all" button shows a
determinate progress bar while it walks the list.

**AuthFlow modal.** This replaces twelve hand-written per-provider dialogs, so
design it as one shell with seven interchangeable step bodies. The shell has a
vertical step rail on the left showing completed / active / pending, and the
active step's body on the right, with Back and Continue in a footer.

Design all seven step bodies:

1. **Text field** — one or more labelled inputs; secret fields masked with a
   reveal eye.
2. **OAuth popup** — an explanatory line and a large "Open provider login"
   button, then a waiting state with a cancel link.
3. **Device code** — a very large monospace code, a copy button, a countdown
   ring showing time until expiry, the verification URL, and a "Waiting for
   approval" line with a cancel link.
4. **Paste cookie** — step-by-step instructions on the left, a large textarea on
   the right, and a "Verify" button that turns into a green check or a red
   error.
5. **Import from file** — a card showing a config file detected on the machine,
   its path in mono, what will be read from it, and Import / Choose another.
6. **Choose social provider** — a row of large provider buttons (Google, GitHub,
   and so on).
7. **Confirm** — a summary list of what is about to be saved, with the secret
   values masked.

Also design the failure state for a step: red border, the error code in mono, a
human sentence, and a "Try again" button that returns to the same step rather
than restarting the flow.

---

## 4 · Endpoint & Keys — `/gateway/endpoint`

Top: a large copyable base URL in mono with a copy button. Under it, a tab strip
— OpenAI, Anthropic, Gemini, Codex — where each tab swaps both the URL shown and
an environment-variable snippet block sized for copying into a terminal.

Middle: an **API keys** table — name, masked key in mono showing only the first
and last few characters, created date, last used, an active/revoked pill, and an
overflow menu. A "Create key" button above the table.

The create-key modal shows the **full key exactly once**: a large mono block, a
prominent copy button, and a red warning line saying it cannot be shown again.
Design that modal's post-copy state too.

Bottom: a small security card with two toggles — "Require API key" and "Require
login" — each with a one-line consequence under the label.

---

## 5 · Routing & Fallback — `/gateway/routing`

The most complex screen. Four tabs.

*Combo* — a master/detail split: a list of combos on the left, the selected
combo on the right. The detail shows a three-way mode selector (Fallback,
Round-robin, Fusion) as a segmented control, then a drag-reorderable list of
member models where each row shows the model name, capability badges, a health
dot, and a remove button. Choosing Fusion reveals four extra numeric fields:
minimum panel size, judge model select, straggler grace in milliseconds, hard
timeout in milliseconds.

*Fallback* — a radio pair for fill-first versus round-robin, a sticky toggle,
and a table of currently active account locks showing account, model, reason,
and a live countdown to release.

*Capacity Adapter* — four collapsible panels, one per capability: vision, PDF,
audio input, video input. Each has an enable toggle, a round-robin toggle, and a
reorderable model list.

*Simulate* — a two-pane view: a JSON request editor on the left, and on the
right a rendered decision tree showing model → candidate → account, with each
node labelled by the reason it was chosen or rejected. Rejected branches are
greyed with the rejection reason in red.

Also design a warning banner for the Combo tab: amber, appearing when no member
of the combo can satisfy a capability, naming which adapter pool will take over.

---

## 6 · Usage — `/traffic/usage`

A range selector across the top: Today, 7d, 30d, Custom. Below, a stacked area
chart of tokens per day segmented by provider, then a line chart of cost per
day. Below the charts, a breakdown table: provider × model, with columns for
requests, input tokens, output tokens, cached tokens, cost, and error rate.
An "Export CSV" button sits above the table on the right.

---

## 7 · Requests — `/traffic/requests` and `/traffic/requests/:id`

**List.** A dense virtualized table: timestamp, model, provider, account,
status pill, time-to-first-token, total latency, tokens, cost. Filter chips
above: errors only, provider, model, had fallback. Cursor pagination at the
bottom, not page numbers.

**Detail.** The key element is a vertical **attempt timeline**. Each attempt is
a node showing the provider and account, the outcome (an error code in mono or a
green 200), and the elapsed time. Failed attempts show a short connector labelled
with the reason the router moved on — "recoverable → next candidate". The final
successful attempt is visually terminal.

Below the timeline, a tab strip: Request (canonical), Vendor request, Vendor
response, Client response — each a JSON viewer. The last three carry a small
"Developer mode" badge, since they are hidden unless that setting is on.

A metadata strip at the top shows request id and trace id in mono with copy
buttons. **No credential, key, or token ever appears anywhere on this screen.**

---

## 8 · Quota — `/providers/quota`

A filter row: provider select, and a "nearly exhausted only" toggle. Then a grid
of account cards. Each card: provider logo and account label, a large circular
progress ring showing used versus limit, the quota unit (requests, tokens,
currency, or subscription), a countdown to reset plus the absolute reset time in
smaller text, and — importantly — a small label stating whether the number is
**reported by the provider** or **counted locally**, styled differently so the
two are never confused. Cards turn amber near the limit and red when exhausted,
with a "locked" ribbon when the account is locked out.

---

## 9 · Token Saver — `/gateway/token-saver`

Top: three summary figures — tokens saved over 7 days, average reduction
percentage, requests skipped.

Middle: a horizontal **pipeline diagram** showing five stages in execution order
— RTK, Headroom, Caveman, Ponytail, PXPIPE — connected by arrows. Each stage is
a card with a toggle, a one-line description, tokens saved by that stage, a
"Configure" link, and a small counter reading "skipped N times after errors" so
a silently failing stage is visible.

The PXPIPE card additionally shows a module-status pill reading "loaded" or "not
installed" — not "running", since nothing listens on a port — plus two numeric
fields.

Bottom: a **Try it** panel — a payload textarea on the left, and on the right a
side-by-side diff showing what each stage changed.

---

## 10 · Media Providers — `/providers/media/:kind`

A tab strip across nine kinds: Image, Video, TTS, STT, Embedding, Image→Text,
Web Search, Web Fetch, Music. Kinds with no configured provider render dimmed
with a small "not configured" label — **never hidden**.

Under the tabs, the endpoint path for the selected kind in mono with a copy
button. Then the same provider-and-connection table as LLM Providers.

The TTS tab gains a **voice browser**: filters for language, region, and gender,
and a list of voices where each row has the voice name, locale rendered as a
human-readable place name, and a play button for a preview.

---

## 11 · Proxy Pools — `/network/proxy-pools`

A table: pool name, type badge (HTTP, Vercel, Cloudflare, Deno), URL in mono, a
strict-proxy toggle, test status pill, a "used by N connections" count, and row
actions. Two buttons above: "Add manually" and a prominent "Auto-deploy relay".

**Deploy wizard**, three steps in a modal: choose platform as three large cards;
paste an access token into a masked field with a line stating the token is sent
once and never stored; then a deploy progress view with named milestones
(creating, uploading, building, ready), an elapsed timer, a 120-second ceiling,
and a scrollable log. Design the success state (showing the new URL with a copy
button) and the failure state (keeping the log visible with a retry button).

The strict-proxy toggle needs an explicit warning under it, written as a full
sentence: turning it off means a dead proxy silently falls back to a direct
connection, exposing the real IP without any notice.

---

## 12 · Tunnel — `/network/tunnel`

A state card showing one of: not installed, installed but off, running. An
"Install" button opens a progress view with a live log, not a spinner. When
running, show the public URL in mono with a copy button and a QR code.

A permanent security banner: enabling the tunnel exposes the gateway to the
public internet. The enable control is **disabled** while "Require API key" is
off, with an inline explanation and a link to turn it on first.

---

## 13 · MITM — `/network/mitm`

Design this screen at maximum warning severity.

A persistent red-bordered banner at the top, written in full sentences: this
feature installs a root certificate into the operating system trust store and
modifies the hosts file.

Below: a status checklist — CA generated, CA installed, proxy running, hosts
modified — each a row with a state glyph. Then three separate buttons, Generate
CA / Install CA / Remove CA, each spaced apart so they cannot be mis-clicked,
each opening its own type-to-confirm modal.

Then a table of redirected hosts: hostname, enabled toggle, source (default or
user-added).

A Windows-specific note block explaining that administrator rights are required
and that a UAC prompt will appear.

---

## 14 · CLI Tools — `/integrations/cli-tools` and `/:toolId`

**List.** A grid of thirteen tool cards — Claude Code, Codex, Cursor, Gemini CLI
and so on. Each card: logo, tool name, an "installed" state glyph, a "pointing at
AIGate" state glyph, and a Configure button.

**Detail.** A current-state panel reading the tool's real config file, its path
shown in mono. An "Auto-configure" button that opens a **diff view** — the
config file before and after, with added lines green and removed lines red — and
only then an Apply button. A "Remove configuration" button that restores from
backup. Below, a collapsible manual-instructions block for users who would
rather AIGate not touch their files.

---

## 15 · MCP — `/integrations/mcp`

A table of configured MCP servers: name, command or URL in mono, scope, an
enabled toggle, edit action. An "Add" button and a "Marketplace" button above.
Writing changes opens the same diff view as CLI Tools, naming which file of
which tool will be written.

---

## 16 · Skills — `/integrations/skills`

A grid of skill cards: skill name, one-line description, an "Entry" badge on the
entry skill, and Copy link / View buttons. Above the grid, a short "Quick start"
block with a copyable sentence to paste to an agent. Entirely static — no
server state, no loading condition.

---

## 17 · Settings — `/settings/general`, `/auth`, `/developer`

A settings shell with a left sub-navigation of three tabs and a form area.

*General* — language, theme, port, data directory, outbound proxy, update
channel, and an export/import configuration pair. Any field whose change needs a
restart carries an inline "requires restart" chip; fields that apply immediately
say so.

*Auth & Access* — change password (current, new, confirm), require-login toggle,
require-API-key toggle, Local Mode toggle, then collapsible OIDC and SAML
sections. Secret fields never render a value — they show a "configured" pill and
a Replace button.

*Developer* — a developer-mode toggle with a line explaining it reveals Console,
Translator, and raw request tabs; a request-logging toggle; and a red
danger-zone block with "Reset all data" behind a type-to-confirm modal.

---

## 18 · Login and OAuth callback — `/login`, `/callback`

*Login* — centred card on a plain background: AIGate wordmark, a single password
field, a sign-in button, and — when configured — SSO buttons below a divider. If
the default password is still in use, a red banner above the card warns that it
must be changed.

*Callback* — a minimal centred card with a progress indicator and a status line.
Design its failure variant too: it must name which step of the exchange failed,
not just say "authentication failed".

---

## 19 · Onboarding — `/welcome`

A five-step wizard outside the main shell, with a horizontal step indicator:
Set password → Connect a provider → Create an API key → Connect a tool → Send a
test request.

Design the final step carefully: it shows a live request being sent and its
streaming response arriving, with a green success panel. Onboarding is only
complete when a real request has succeeded — not when the user has clicked
through every screen.

---

## 20 · Console — `/traffic/console` (developer mode only)

A full-height monospace log viewer on a near-black surface in dark mode. A
toolbar across the top: Pause, Clear, a search field, and level filter chips for
log, info, warn, error, debug. Log lines are colored by level. The panel
auto-scrolls to the bottom and shows a "Jump to latest" pill when the user has
scrolled up. A status line at the bottom shows the live-connection dot and a
count of lines dropped when the 200-line buffer overflowed.

---

## After Stitch generates

1. Screenshot every screen and check it against the spec's `§10.7` state rules —
   Stitch tends to draw only the happy path.
2. Check the sidebar is identical across all screens; regenerate any that drift.
3. Confirm no screen renders a credential, key, or token value.
4. Feed the accepted screens into sub-project **U0** (design system) and **U1**
   (shell) of the spec's `§10.10`, not directly into feature code.
