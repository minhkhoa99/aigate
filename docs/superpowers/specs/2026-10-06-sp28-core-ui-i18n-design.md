# SP28 — core dashboard localization (EN/VI)

Status: conversational design and this written spec approved on 2026-10-06.
Implementation plan awaits user review and execution-method selection; no
product implementation is approved yet.

## Intent and baseline

Make the existing AIGate core dashboard usable in English and Vietnamese,
without changing gateway behavior or rebuilding its visual layout. The user
approved React Context, two JSON catalogs and native `Intl`, browser-local
language selection, English default/fallback, and unchanged API identifiers.

The workspace starts clean at `bd7315c` (`first`). SP26 and SP27 are present in
that commit; their older handoff notes saying uncommitted are historical.
The original design specifies i18n in M3 U1 and language selection in General
(sections 10.3, 10.9.18 and 10.10). SP28 is a locally numbered M3 slice, not a
previously defined M2 roadmap entry.

There is no existing dashboard locale catalog or i18next dependency.
`app/shell.tsx` already owns browser presentation preferences; `main.tsx`
mounts shared toast/query/router providers. `shared/errors.ts` resolves known
codes and deliberately preserves server validation/provider diagnostics.
Overview consumes a fixed summary and the existing usage SSE.

## Scope

Translate the app-owned copy, accessible labels, placeholders, status labels
and actions in:

- Shell: navigation groups/items, breadcrumbs, navigation search, menu/sidebar
  controls, theme control and session captions. Search matches the displayed
  localized label and its English label; route paths remain unchanged.
- Auth: `/login`, `/welcome`, `/callback`, including existing loading,
  validation, submission and callback-delivery states.
- Settings: `/settings/general`, `/settings/auth`, `/settings/developer`.
  Existing OIDC/SAML previews remain previews; translating them does not
  implement authentication integrations.
- Overview: `/`, including metrics/comparisons, live states, onboarding,
  provider health, account-alert framing, writer warnings and truncation notes.
- Shared primitives: default loading/empty/error text, copy feedback,
  confirmation instructions, notification dismissal and reusable status text.
- App-owned shared error guidance and core success notifications.

Other feature-specific page copy remains English in this slice. Their shell
and shared default controls may be localized. Do not describe SP28 as complete
localization of every dashboard screen.

Do not add server locale endpoints, database columns/migrations, locale export
fields, third-party translation requests, language packs, dependency changes,
auto-update, startup registration, backup or unrelated UI refactoring.

## Architecture and ownership

Use two statically bundled UTF-8 JSON catalogs under
`apps/web/src/shared/locales/`, one English source and one Vietnamese target.
Use stable message keys, flat string values and named primitive placeholders
such as `{count}`. Both catalogs must have identical keys and placeholder
names/counts. Do not introduce an ICU/HTML parser, remote loader or custom
plural engine; write complete sentences with named values for these two
languages.

A small pure module in `shared/` provides locale normalization, catalog lookup,
bounded named interpolation and native formatting. A single React Context
provider exposes the selected language and its setter to actual consumers.
Mount it above the existing toast/router consumers; changing language must not
recreate the QueryClient, router or their providers. Keep translation logic
independent of network calls, React rendering and mutable global locale state.

The integration touches `main.tsx`, `app/shell.tsx`, shared UI/error/toast code,
`features/settings/{screens,general}.tsx`, and
`features/overview/screens.tsx`. Features consume the shared locale API, never
another feature's implementation. Keep the existing component layout and
theme/developer behavior.

The original spec's i18next choice is deliberately deferred: two fixed
catalogs and the approved scope do not need an additional localization engine.
This is not a wrapper designed to accommodate arbitrary future engines.

## Language state and storage

Language is exactly `en` or `vi`. General shows an immediately applied
selector labeled English / Tiếng Việt. Store only this enum under
`aigate-language`; do not include it in the SP27 server settings document.

Read storage once when initializing the root locale state. A missing or
unsupported stored value selects `en`, preserving the current English default.
Do not infer Vietnamese from browser locale or fetch a server preference.
If storage access is denied, the app remains usable and selection works in
memory; persistence is best-effort, without automatic retry or polling.

Set `document.documentElement.lang` to `en` or `vi`, including standalone Auth
screens. Selection survives reload/logout when storage is available. This
slice does not add cross-tab synchronization, account synchronization or a
language-specific URL prefix. Tab/form/query state is not reset by selection.

## Translation and data boundaries

English is the source and runtime fallback. A missing Vietnamese entry uses
its English value. An entirely unknown key returns the key as a development
diagnostic, never `undefined`; the catalog check must catch it before delivery.
Missing interpolation values leave their marker intact and are check failures
in the selected callers, not an excuse to render `undefined` or evaluate text.
React renders catalog strings as text. Never interpret translations or
placeholder values as HTML, JavaScript or instructions.

Translate user-facing labels, not business state. Preserve API URLs, query
keys, request bodies, IDs, provider/model names, gateway URLs, environment
variable names, filenames and error codes. State/selection keys remain stable
when their displayed labels change. The confirmation token `IMPORT` remains
literal ASCII; only the instruction around it is translated.

Preserve raw validation messages, provider diagnostics and Overview's server
`attention.message`. Translate their surrounding labels/advice where those
are app-owned. Do not guess translations from an English substring or change
API responses to make localization possible.

Use consistent Vietnamese terms: Overview = Tổng quan, Requests = Yêu cầu,
Connections = Kết nối, Quota = Hạn mức, Retry = Thử lại, Settings = Cài đặt.
Keep AIGate, OAuth, OIDC, SAML, MCP, MITM, CLI and named product/stage names.

## Errors and notifications

Keep the existing `toProblem(error)` English behavior for callers not migrated
in this slice and its runnable English contract checks. Locale-aware resolution
must preserve the original code and diagnostic detail, including timeout,
remaining-attempt and retry-after values. Known app-owned guidance, unknown
failure advice and core client-side validation/success notices get catalog keys.

In-scope inline errors resolve using the current locale at render time; retain
the error/translation inputs rather than only a pretranslated string where
language can change while the error remains visible. Locale-aware core toast
inputs likewise render through the shared provider. Existing string-only toast
callers outside scope remain supported verbatim. Keep the current single-toast
capacity and six-second dismissal lifecycle; changing locale must not restart
the timer or add a queue.

## Number, time and money presentation

Use `en-US` for English and `vi-VN` for Vietnamese through native `Intl`.
Localize displayed counts, compact totals, percentages, comparison magnitudes,
retention/duration values and timestamps in the selected screens. A native
formatter is created per selected locale/options in the consuming scope, not
kept in an unbounded cache indexed by arbitrary caller input.

Keep costs in USD: no currency conversion, rate lookup or VND relabeling.
Preserve the existing precision/sign/zero-baseline/unpriced semantics. Preserve
Overview's server-provided usage timezone and actual timestamps; locale changes
only their presentation, not rolling windows, buckets or stored values.

## Lifecycle and resource bounds

Two static catalogs, one locale state, one storage key, and no new timer,
subscription, growing cache, queue or network request are needed. Translate
through explicit callers, not a DOM scan or MutationObserver.

Locale is not a query key or a dependency that opens/restarts a live stream.
Switching language must not invalidate/refetch queries, remount the screen,
reopen SSE, change polling cadence, replay mutations or clear form/import
review state. Existing fetch/read cancellation and reconnect bounds remain
unchanged. No backend change is required.

## Acceptance and verification

Before product code, record this slice's labeled Feature Matrix rules and
`docs/contracts/i18n.md`; keep the original locale behavior separate from its
reference storage/framework implementation. Update `API_UI_MAP.md` to show
browser-only language selection and the precise translation boundary.

Leave small runnable checks in the existing native Node test workflow for:

- English/Vietnamese JSON key and placeholder parity, no empty translations.
- Locale normalization/fallback and denied-storage behavior.
- Safe interpolation with reordered Vietnamese placeholders and literal values.
- Locale-aware count/percentage/USD/time formatting without changing timezone.
- Error guidance preserving code, numeric context and raw server diagnostics;
  existing English error assertions still pass.

When test execution is authorized, run the targeted locale/error checks and
browser smoke on isolated local data, not a broad suite or live providers.
Browser acceptance covers EN↔VI switching, reload/logout persistence,
`html lang`, translated navigation/search/aria labels, standalone Auth, General
import preview/confirmation, Developer, Overview empty/live/error/reconnect
states, and an existing inline error/toast during switching. Compare request
and stream activity before/after switching to verify it creates no traffic.
Check 1440/929/390px for text fit and usable controls in both languages.

Run build, lint, discovery validation and diff checks. Record actual results,
not planned coverage. Update handoff/CLAUDE/ownership documentation and refresh
the local AST graph/generated PROJECT_MAP. Full semantic graph enrichment still
needs the previously missing LLM API key; do not install SQL AST support merely
to remove its warning.

## Review and next gate

This spec defines the approved approach, not permission to execute the checks
or an implementation plan. After written-spec approval, use the
`superpowers:writing-plans` workflow to prepare the implementation plan. Present
that plan and agree its execution method before editing product code.

The managed permission profile declares `.git` read-only, but the normal spec
checkpoint succeeded at `7d37a91` without an override. Use only normal scoped
git operations and report actual results. Keep files intact if a later write
is refused; never bypass restrictions, reset user work or claim false success.
