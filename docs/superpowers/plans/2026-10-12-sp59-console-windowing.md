# SP59 — bounded Developer Console rendering

Base: clean `572895a`. The Console keeps a 200-event client ring but mounts
every filtered event. M3 design §10.6 calls for windowing lists above about
50 rows.

## Contract

- `AIGATE_EXTENSION`: keep the existing GET/SSE/Clear endpoints, 200-event
  ring, Developer gate, filters, Pause/Resume, EN/VI, errors and explicit Clear.
- `AIGATE_EXTENSION`: show each complete metadata message on one 26 px line
  inside a 400 px scroll region. Long lines remain accessible by horizontal
  scrolling; no message text is truncated or sent elsewhere.
- `AIGATE_EXTENSION`: mount only the visible log window plus five rows above
  and below. Keep the vertical and horizontal scroll extents stable as rows
  enter/leave the DOM. Filters and Clear reset scroll; locale and new events
  preserve it. The region is keyboard scrollable.
- `AIGATE_EXTENSION`: prevent window changes caused by scrolling from being
  announced as new live events. Only a genuinely new visible event reaches a
  separate live announcement.
- `IMPLEMENTATION_ACCIDENT`: rendering all 200 entries and wrapping long
  messages are presentation details, not server/API contracts.

## Gates

- [x] Contract and Feature Matrix entry before product code.
- [x] Implement fixed-height window and focused boundary checks.
- [x] Verify 200 rows, filters, live append/Clear, EN/VI, keyboard and 390 px in a synthetic browser fixture.
- [x] Build, lint, discovery and AST graph refresh; handoff and local checkpoint. Tracked graph artifacts remain at the prior root to avoid a whole-graph relocation diff.
