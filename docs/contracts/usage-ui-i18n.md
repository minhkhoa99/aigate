# Usage analytics EN/VI (SP37 / M3 U7)

SP37 localizes owned copy on `/traffic/usage` and its Pricing modal over the
existing SP24a summary, chart, CSV, pricing and SP26 live stream APIs. It does
not change query keys, URL period ids, fetch cadence, SSE lifecycle, pricing
payloads, history persistence or server bounds. Switching locale never starts
a request, reopens SSE or repeats a pricing mutation. The selected period,
custom date draft, chart color slots and modal draft remain mounted.

Headings, controls, metrics, chart/tooltips, table headers, empty/error/Retry,
live status and pricing form/notices render in EN/VI. Provider/model/account
names, endpoint and timezone ids, stable error codes and permitted raw server
diagnostics remain literal. Currency stays USD, and usage bucket labels use
the server's timezone with the selected display locale. Small costs retain
four decimal places. Numbers and times use native Intl, without a dependency.
An incomplete custom period must not trigger summary/chart reads or CSV export.
Price fields accept a decimal point or comma and keep their typed draft through
a locale switch; saved numeric rates and USD units are unchanged. Failed
provider/model/price reads show the API code, permitted diagnostic and Retry.

Acceptance covers EN/VI while mounted, period and custom draft, chart/table,
pricing draft and one pending save, stream reconnect/error, empty and failed
reads, 390px layout, and zero locale-triggered GET/POST/SSE. Synthetic same-origin
responses only; no vendor, credential or user data.
