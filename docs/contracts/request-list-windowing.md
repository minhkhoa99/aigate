# Requests table windowing (SP58 / M3 U7)

The Requests page keeps SP24b's cursor API and SP38's filters, detail links and
localized presentation. At most 500 rows are loaded, 100 per explicit page.
The table scrolls vertically within a 468 px scrollport. It renders the rows
around the visible area plus five rows on each side; unmounted rows retain their
place through table spacer rows. Row height is 36 px and columns have stable
widths so scrolling does not move values between columns. The table exposes its
total loaded row count. Its focusable scroll region allows keyboard PageDown;
links in the visible window remain keyboard reachable.

Changing filters starts at the top of the new result. Loading another page or
changing EN/VI keeps the current scroll position. Errors preserve loaded rows
and the existing Retry path. Narrow viewports can scroll horizontally. No
server endpoint, cache key, persistence, request metadata or vendor interaction
changes.
