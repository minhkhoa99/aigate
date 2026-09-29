# Proxy pools contract (M2 SP18)

Proxy pools choose the network path of an upstream provider request.  They are
configured through `/api/proxy-pools` and attached to an individual connection
through its `proxyPoolId`.

## Pool data and management

- A pool has a generated id, a 1–64 character name, an HTTPS relay or HTTP(S)
  proxy URL, an optional comma-separated `noProxy` host list, type (`http`,
  `vercel`, `cloudflare`, or `deno`), `isActive`, and `strictProxy`.
- Create and update reject malformed values; all four types are accepted on
  both paths.  A pool cannot be deleted while a connection refers to it.
- `POST /api/proxy-pools/:id/test` tests an HTTP proxy through a bounded HEAD
  request, or a relay through its header protocol.  It records the result but
  does not silently change `isActive`.
- A connection may name a pool on create or patch. `null`, `""`, and
  `"__none__"` clear it. Unknown pool ids are `INVALID_REQUEST`.

## Request dispatch

1. An active connection pool wins over environment proxy variables. A relay
   sends to its URL with `x-relay-target` (origin) and `x-relay-path`
   (path/query); a regular pool uses an HTTP proxy. `noProxy` excludes matching
   target hosts.
2. When no connection pool applies, `HTTPS_PROXY`, `HTTP_PROXY`, then
   `ALL_PROXY` are considered for HTTPS requests, unless `NO_PROXY` excludes
   the target.
3. If a configured proxy fails, `strictProxy: true` returns
   `PROVIDER_UNAVAILABLE`; otherwise the request may retry directly. Relay
   failures are never retried directly because their failure is an upstream
   response, not a transport tunnel failure.
4. IDE hosts that overlap local MITM use Google DNS only on direct requests
   (including non-strict proxy fallback); strict proxy failures stay failures.
   DNS uses exact host matches, the original hostname remains TLS SNI/Host, and
   the five-minute IP cache has a fixed seven-host key set.

Proxy dispatchers are LRU, capped at 20 entries and expire after five minutes;
eviction closes the dispatcher. No request performs network I/O inside a
database transaction.

Keyless chat providers use an empty credential and no persisted
provider-connection row. A provider may still add fixed public protocol markers
(OpenCode's `Bearer public` is not a stored user credential). GET
`/api/proxy-pools/rotations` lists eligible runtime providers;
PATCH /api/proxy-pools/rotations/:providerId sets rotateStrategy (none,
round-robin, or random) and an optional pinned proxyPoolId. Rotating modes select
from the first 100 active pools (name order) per request.
Round-robin cursors are process-local and reset on restart. Deleting a pinned
pool clears its reference. Strategy rows live in `provider_proxy_strategies`
(migration 0017); strategy `none` uses the pin, while the other strategies
select an active pool. A null pin leaves the normal environment-proxy/direct
selection in effect.

OpenCode Free is the current eligible keyless chat provider; its endpoint
protocol is documented in `provider-opencode-free.md`. Other keyless catalog
entries are hidden or belong to media/search lanes.

## Hosted relay deploy

`POST /api/proxy-pools/vercel-deploy`, `cloudflare-deploy`, and `deno-deploy`
create a hosted relay and its pool, returning `201 { proxyPool, deployUrl }`.
They require respectively a `vercelToken`, Cloudflare `apiToken` + 32-character
`accountId`, or a `denoToken` + organization domain (`orgDomain`); all accept
optional `projectName`. Credentials are used only during deployment and never
persisted. Vercel waits up to 120 seconds; Cloudflare uploads a Worker and
resolves its workers.dev subdomain; Deno Deploy polls up to 60 seconds.

All relays validate `x-relay-target`, remove both relay headers and `host`,
then forward method, headers, and body. Deploy failures attempt bounded cleanup
of any remote resource already created. Pool persistence happens only after a
usable URL is available. Validation errors use `INVALID_REQUEST`, duplicate
provider names use `CONFLICT`, provider failures use `PROVIDER_UNAVAILABLE`,
and exhausted readiness polling uses `TIMEOUT`.

## Reference deviations

- 9router silently reclassifies a Deno pool as HTTP on update. AIGate rejects
  invalid types and preserves `deno`.
- 9router can bypass strict proxy for chat traffic and orphan failed hosted
  deployments. AIGate propagates strict proxy to every request and cleans up
  failed deployments.
- 9router stores keyless strategies in its general settings object and may use
  the literal `public` sentinel; AIGate stores strategies in a dedicated table
  and sends no authentication header at all.
