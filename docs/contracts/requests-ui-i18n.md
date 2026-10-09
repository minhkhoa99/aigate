# Requests list and detail EN/VI (SP38 / M3 U7)

SP38 localizes owned copy on `/traffic/requests` and
`/traffic/requests/detail?id=` over the existing SP24b request APIs. Filter
values, URL parameters, cursor pages (100 rows, 500 visible maximum), query
keys, request IDs and detail payloads stay unchanged. Changing browser locale
does not fetch, reset loaded pages or filters, or navigate. Dates and numbers
use native Intl in the browser locale/timezone; amounts remain USD.

Headings, filter labels, table headers, empty/error/Retry states, pagination,
status pills, attempt timeline, metrics, metadata labels and privacy notice
render in EN/VI. Provider/account/model/key names, endpoint paths, request IDs,
HTTP/API codes and permitted raw diagnostics remain literal. The technical
`x-request-id`, TTFT and `ms` labels remain literal. A missing value is shown as
unknown or none as appropriate; unpriced cost is not shown as zero.

Filter-list failures show their code, diagnostic and Retry instead of implying
there are no providers/models/endpoints. A failed next page keeps already
loaded rows visible and offers Retry. Detail read failures offer Retry and Back
to requests. A missing id never fetches a detail.

Acceptance uses only synthetic same-origin API replies. It covers mounted
EN/VI, URL filter/pagination preservation, list/filter/next-page/detail errors,
empty and populated views, status/code/raw identifiers, copyable request id,
390px layout and zero locale-triggered requests. No vendor or user data.
