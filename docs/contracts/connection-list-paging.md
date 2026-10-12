# SP64 Connections list paging

`/providers/connections` keeps the existing bounded `GET /api/connections` read,
order by provider and account priority, All/Needs attention filter, and row
actions. The client shows at most 25 accounts per page. Previous/Next controls
appear only when the filtered list needs more than one page. Switching tabs
starts at page one; if a mutation or refresh shortens the list, the current page
clamps to the last available page. Locale changes keep the page and pending
actions. The account counts used by Priority ↓ include accounts on other pages.

Variable-height account details and action buttons remain fully visible. No
server pagination, new API, storage key, provider call, or dependency is added.
