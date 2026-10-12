# SP60 — provider catalog card windowing

Base: clean `7ac1976`. The current registry has 121 entries; `/providers`
shows 77 visible LLM entries: 17 OAuth, 15 Free, 43 API Key, and 2 Web
account. The existing API Key section shows 20 cards until expanded. Search
can show all 43 API Key cards. M3 design §10.6 asks for windowing around 50
rows; this is the remaining provider catalog stress case.

## Contract

- `REFERENCE_BEHAVIOR`: preserve catalog group order, category counts, local
  search, the API Key Show all/Show fewer control, card names/model counts,
  status pills, reason titles, and detail links.
- `AIGATE_EXTENSION`: when the API Key section has more than 20 visible cards,
  use a keyboard-scrollable six-row region. Mount only its visible card rows
  plus two rows of overscan. Keep its scroll height stable across windows.
- `AIGATE_EXTENSION`: search remounts that region at the top. Locale and
  connection status updates preserve its position. Responsive 4/3/2/1-column
  layouts retain the existing breakpoints and all cards remain reachable.
- `IMPLEMENTATION_ACCIDENT`: mounting every expanded API Key card is a
  presentation detail, not part of the provider/API contract.

## Gates

- [x] Matrix and contract before product code.
- [x] Window boundary test and browser acceptance for expanded/search/mobile.
- [x] Build, lint, discovery, AST graph refresh, handoff and local checkpoint.
