# SP65 Voice Browser list paging

The TTS Voice Browser keeps its existing provider/model voice read, filters,
Listen and Copy actions. The server may return up to 2,000 voices. After local
filtering, the browser shows 25 rows per page, with localized Previous/Next
controls so every loaded voice can be reached. Changing provider, model or a
filter starts at page one. A shorter result clamps the current page; changing
EN/VI keeps the page, selected filters, pending preview and audio player.

Voice names and IDs remain literal. No voice is hidden by the former 200-row
display cutoff. The server bound, API payloads, preview deadline and explicit
provider call are unchanged. No new API, storage key or dependency is added.
