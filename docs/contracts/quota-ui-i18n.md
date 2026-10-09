# Quota dashboard EN/VI (SP36 / M3 U7)

SP36 localizes owned copy on the existing `/providers/quota` dashboard. It
extracts the screen into its own Providers module. The SP24c quota API,
60-second mounted polling, 60-second/100-entry server cache, four-worker
provider refresh and explicit refresh POST are unchanged. No API, dependency,
new polling or vendor request is introduced by a locale change.

Headings, metrics, values, fallback text, read errors, Retry and refresh state
render in EN/VI. Account/provider/plan/window names, stable API codes and
permitted raw diagnostics remain literal. USD balances use the selected locale
while preserving USD; reset times use the browser timezone. A missing balance
is unknown, never `$0`; a failed/pending read shows unknown metrics rather than
fabricated zero totals. A locale switch leaves the mounted query and pending
manual refresh untouched and must not refetch or replay POST.

Isolated acceptance uses synthetic same-origin quota responses and records
every request. It covers EN/VI while mounted, healthy/near/exhausted windows,
unlimited, cached, missing balance, no-window messages, empty/read error/Retry,
manual refresh pending/error, 390px layout and no automatic refresh on locale
change. The fixture never calls a real vendor or credential store.
