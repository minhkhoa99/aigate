# Console EN/VI (SP39 / M3 U11)

`/traffic/console` remains available only when browser Developer mode is on.
The closed gate, headings, stream state, controls, filters, privacy notice,
empty/error/Retry states and Clear failure notice use the selected EN/VI
language. Event IDs, levels (`INFO`, `WARN`, `ERROR`), messages and permitted
raw API diagnostics stay literal. Timestamps use the browser locale and zone.

The existing `GET /api/tooling/logs` returns at most 200 metadata events;
`GET /api/tooling/logs/stream` permits at most eight open streams. Only an
explicit Clear sends `DELETE /api/tooling/logs`. A pending Clear disables its
button, remains mounted across language changes and cannot be replayed by a
language switch. A failed Clear preserves the visible events and shows its
stable code and diagnostic. A failed initial read shows code, diagnostic and
Retry rather than an empty log. The existing server clear broadcast empties
open tabs.

Language changes preserve filter text/level, paused state, cached events,
pending Clear and the current SSE connection; they send no GET, DELETE or new
SSE request. Pause closes the stream; Resume opens one. Unmount closes it.
Only metadata is displayed; no prompt, response, credential or key is captured.
Acceptance uses a same-origin synthetic API/SSE fixture with no vendor call,
real credential or user data.
