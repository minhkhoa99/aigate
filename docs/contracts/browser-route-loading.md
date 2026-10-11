# SP57 browser route loading

The shell, `/api/auth/status` gate, locale provider and shared UI load with the
initial browser entry. Feature screens load when their route is visited. One
screen source module may serve multiple sibling routes; navigation preserves
the route, search parameters and existing component/query behavior. A mounted
page does not remount or refetch merely because EN/VI changes.

While a screen module loads, the content area shows the existing localized
loading skeleton. If the module or screen fails to render, the route shows
`UI_LOAD_FAILED` and a Reload button. A different route gets a fresh error
boundary. The shell and auth gate remain available. Developer Console stays
hidden behind the existing browser-local Developer mode gate. The development
only `?uiState=` preview still renders without loading a feature screen.

This is a browser delivery change only: no API, server query, route path,
credential handling, persistence, dependency or user data changes. Vite's
production assets supply the chunks from the same origin.
