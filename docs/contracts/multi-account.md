# Multi-account routing contract (M2 SP17)

One provider may have several active connections.  Each gets a stable, per-provider `priority`; new accounts append after existing ones.  The dashboard lists every account and lets an operator choose the gateway-wide strategy.

## Selection

- `fill-first` is the default: choose the lowest priority eligible account.
- `round-robin` picks the least-recently-used eligible account, but keeps it for three selections before rotating.  The read-and-write is serialized per provider, not globally.
- An inactive account, an account already attempted in this request, or an account with a live lock for the model is ineligible.  Account-wide locks use the model key `__all`.

## Fallback and locks

Before a response is committed, an upstream auth, rate-limit, timeout, or 5xx failure with another active account available locks that account for the requested model and tries the next eligible account. A sole account keeps its upstream response unchanged. The lock is durable and has a bounded expiry: 2 minutes for auth, 30 seconds for timeout/5xx, and 2 seconds for rate limits. A successful request clears its own model lock.

Malformed client input, unsupported features, unknown models, and a client abort do not lock an account or retry another one.  This intentionally corrects 9router's `fallback.error-classification` suspected bug.

If every account is locked, the gateway returns 503 `provider_unavailable` with `Retry-After` for the earliest expiry.  No active account remains a 404 `no_active_connection`.

## API and UI

`GET /api/connections` exposes `priority`; `PATCH /api/connections/:id` accepts a positive integer `priority` and renumbers that provider's accounts.  Existing connection and OAuth APIs can add a second account.  The Connections screen no longer hides a provider that is already connected, shows priority, and exposes the global selection strategy through Settings.
