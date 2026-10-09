# Routing status (SP30 / M3 U6)

Status: verified for Native implementation on 2026-10-09. This is a read-only AIGate UI
extension, not a 9router endpoint.

`GET /api/routing/status` requires the dashboard session and returns HTTP 200
with `Cache-Control: no-store`. The response is a local snapshot:

```ts
{
  observedAt: string; // ISO UTC
  fallbackStrategy: "fill-first" | "round-robin";
  comboStickyLimit: number;
  comboCount: number;
  enabledPoolCount: number;
  routes: { provider: string; kind: "account" | "keyless"; activeAccounts: number }[];
  routesTruncated: boolean;
  locks: {
    connectionId: string; provider: string; name: string; model: string;
    until: string; isActive: boolean;
  }[];
  locksTruncated: boolean;
}
```

`routes` lists providers with enabled saved accounts, plus built-in keyless
chat providers that live routing includes without an account. Each account
count is aggregated in SQL; these are configuration routes, not health or a
claim that every model is supported. Keyless entries have zero saved accounts.
At most 100 routes are returned, sorted by provider ID, with an explicit
overflow flag. Combo and enabled capacity-pool totals use their existing
bounded repositories (200 combos/four pools). The page links to Simulator for
model-specific decisions.

`locks` lists at most 100 account/model rows ordered by expiry, including
locks on disabled accounts. It selects only provider, account ID/name/active
flag, model and expiry; a 101st row sets `locksTruncated`. A lock expires only
when `until < observedAt`, matching live cleanup. The read does not delete
expired locks. UI countdown uses the snapshot's absolute expiry and updates
locally; the status query refreshes every 30 seconds while either tab is
mounted and offers manual Retry/Refresh.

No endpoint read opens a sealed key, OAuth token, custom header, proxy secret
or provider URL; it calls no vendor, token refresher, adapter or transport and
writes no usage, lock, settings, rotation or other state. Errors use existing
`UNAUTHENTICATED` and generic server/transport UI handling; no new error code.

Only Routing Overview and Fallback change in SP30. Combo, Capacity adapter,
Simulator and Settings controls keep their current owners. New status copy is
available in EN/VI; provider IDs, account names and model IDs stay literal.

Verification: focused server tests cover session guard, no-store, keyless
inclusion, active/disabled/expired/equal-expiry locks, 100-row overflow,
unchanged connection/lock rows, zero decryption and zero fake-transport calls.
Isolated Edge acceptance covered real EN/VI rendering, lock countdown, timer
cleanup on tab leave, network error/Retry and 390px layout. The browser fixture
used a disposable SQLite directory, removed after shutdown; transport calls: 0.
