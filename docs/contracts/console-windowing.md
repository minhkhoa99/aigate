# Developer Console windowing (SP59 / M3 U11)

The Developer Console retains SP25's metadata-only GET/SSE/Clear lifecycle and
SP39's browser-local EN/VI behavior. Filtering still runs over the bounded
200-event client ring. A 400 px scroll region presents complete messages as
single 26 px lines; long lines are reachable by horizontal scrolling. Only
the visible rows plus five rows of overscan on each side are mounted. Spacer
blocks retain the full vertical extent, and the widest loaded line holds the
horizontal extent steady while scrolling.

The log scroll region takes keyboard focus. Filtering or Clear starts at the
top; Pause/Resume, locale changes and new events do not reset the scroll or
reopen a connection. Scrolling does not create live announcements; a newly
arrived event that matches the active filters can be announced separately.
Empty/read-error/Retry and explicit Clear failure states remain. No endpoint,
payload, event retention, network request, storage key or vendor interaction
changes.
