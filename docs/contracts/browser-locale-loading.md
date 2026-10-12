# SP62 browser locale loading

English stays in the initial browser entry. The Vietnamese catalog is a
same-origin JS chunk loaded once when a saved Vietnamese preference starts the
app or when the user selects Vietnamese in General. Loading must finish before
Vietnamese is exposed to the mounted UI; no English flash or partial catalog.
English users do not fetch the Vietnamese chunk. A failed initial load shows a
retryable startup error without changing the saved preference. A failed mounted
switch keeps the current language and screen state, shows an error, and asks
for a page reload before retrying. The browser module loader deduplicates
successful imports; a failed module import can remain cached for that page.
If another language is selected while Vietnamese is loading, the latest
selection wins.

Translation fallback, key/placeholder parity, literal provider data and Intl
formatting retain the SP28 contract. Language switching keeps the router,
queries, forms, SSE and toasts mounted and makes no API or vendor request. No
new dependency, endpoint or storage key.
