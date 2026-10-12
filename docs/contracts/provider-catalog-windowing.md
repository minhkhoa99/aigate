# SP60 provider catalog windowing

`/providers` keeps its existing `GET /api/providers` and connection reads.
It excludes service and hidden entries, groups visible LLM providers in the
same order, and applies the existing local name/ID search. Section counts,
card text/status/reason and detail links are unchanged. The API Key section
still starts with 20 cards and exposes Show all/Show fewer.

When search or Show all yields more than 20 API Key cards, the section uses a
484 px, keyboard-scrollable grid with 74 px cards and 8 px gaps. The client
mounts the six visible rows and two extra rows on each side, using blank grid
padding for the absent rows. Width breakpoints remain 4/3/2/1 columns. Search
resets that region; locale and connection updates do not. No new endpoint,
request, storage, vendor call or dependency is introduced.
