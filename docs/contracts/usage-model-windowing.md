# Usage provider/model table windowing (SP63 / M3 U7)

The Usage summary keeps its existing at-most-200 provider/model rows in busiest
first order and the same CSV export. The Provider × model table displays every
loaded row in a 468 px scroll region while mounting only the visible 36 px rows
and five rows of overscan on each side. Fixed column widths preserve alignment
as rows enter and leave the DOM. A focusable labeled region supports keyboard
scroll, and the table reports the full loaded row count.

Changing the period starts the table at the top. Changing EN/VI, opening
Pricing or receiving live usage leaves its scroll position alone. Empty,
loading, failed-read/Retry and incomplete custom-date states retain their
existing behavior. Narrow screens scroll the table horizontally without
widening the document. No API, query key, server bound, vendor call, storage key
or dependency changes.
