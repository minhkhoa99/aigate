# SP58 — bounded Requests table rendering

Base: clean `f88d6ac`. The Requests page fetches at most five 100-row cursor
pages, but currently mounts every loaded row. M3 design §10.6 calls for
windowing lists that can exceed about 50 rows.

## Contract

- `AIGATE_EXTENSION`: keep the existing 100-row fetch, 500-row cap, URL filters,
  detail links, EN/VI formatting, errors and explicit Load more control.
- `AIGATE_EXTENSION`: scroll through every loaded row in a bounded-height table;
  mount only a viewport window plus a small overscan, with stable 36 px rows and
  semantic table headers. Reset table scroll when filters change; keep the scroll
  position when a page arrives or the language changes.
- `AIGATE_EXTENSION`: preserve horizontal scrolling at narrow widths and expose
  the loaded row count to assistive technology. No new API, dependency, storage,
  vendor call or request payload.
- `IMPLEMENTATION_ACCIDENT`: eagerly mapping all 500 rows into React cells is a
  rendering detail, not part of request history behavior.

## Gates

- [x] Contract and Feature Matrix entry before product code.
- [x] Implement bounded table window and focused boundary checks.
- [x] Verify 500-row/short-result, locale, keyboard and narrow-screen behavior in a synthetic browser fixture. Filter reset follows the keyed table remount; the full Requests filter/API flow was not replayed in this fixture.
- [x] Build, lint, discovery and AST graph refresh; handoff and local checkpoint. Tracked graph artifacts remain at the prior root to avoid a whole-graph relocation diff.
