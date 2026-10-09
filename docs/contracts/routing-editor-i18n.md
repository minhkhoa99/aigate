# Routing editors EN/VI (SP34 / M3 U6)

SP34 extends the existing SP28 browser locale to the Routing Combo tab,
create/edit Combo form, and Capacity adapter tab. Their APIs, query keys,
payloads, validation rules and server behavior remain as in `combos.md` and
`capacity-adapter.md`. This is presentation only: no API, migration,
dependency, polling or vendor request is added.

Owned labels, help, status, empty/error states, form validation and mutation
notices render in EN/VI. Combo names, provider/model IDs, API error codes,
upstream diagnostics, route paths and numeric limits remain literal. The
selected Routing tab, Combo form draft, Capacity pool draft and pending
operations remain mounted when the locale changes. Render-time toast messages
must change language without replaying create/update/delete/save/probe calls.

The fixed limits stay visible: 16 members per combo, fusion fan-out at most 4,
16 models per capacity pool, and the existing sticky rotation range 1–1000.
`Test` remains an explicit, potentially vendor-calling action through
`POST /api/models/test`; changing locale must never trigger it. A failed read
shows the stable API code and localized or raw diagnostic with Retry. Raw
model names and provider errors must be escaped as text, never interpreted as
markup.

Acceptance uses synthetic local API responses with a rejecting fake probe
endpoint: EN/VI and literal values; empty/read-error/Retry; duplicate draft
validation; pending mutation and draft preservation on mounted locale switch;
no automatic probe or mutation replay; and 390px layout. No real account,
credential or vendor transport is required.
