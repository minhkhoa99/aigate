# Proxy Pools and Deploy Wizard EN/VI (SP40 / M3 U9)

SP40 localizes owned copy on `/network/proxy-pools` and
`/network/proxy-pools/deploy` over the existing SP18 APIs. Pool names, URLs,
provider IDs/names, deployment URLs, strategy/type IDs, API codes and permitted
raw diagnostics stay literal. A browser language change retains the mounted
list, form drafts, selected platform/step, pending mutations and query keys;
it sends no GET, probe, PATCH, DELETE or deploy request by itself.

The list shows loading, empty, failed read with code/diagnostic/Retry, status,
test result, add/edit and type-to-confirm delete in EN/VI. A failed rotation
read shows code/diagnostic/Retry rather than a false empty catalog. Fixed,
round-robin and random keep wire values `none`, `round-robin`, `random`;
pool assignment keeps the raw pool ID. Mutation notices resolve in the current
language and preserve raw names, codes and diagnostics. The existing server
still blocks deletion of an assigned pool and applies strict proxy to live
requests; this UI slice changes neither behavior.

The wizard localizes all three steps, credentials, review, progress, disabled
states and notices. Tokens stay in local component state, never in storage or
URL. Switching platform clears the token; a successful deploy clears it after
completion. Only explicit Deploy sends one provider request; locale changes never
replay it. Server validation, remote deadlines/cleanup and the `201` response
remain as defined in `proxy-pools.md`. A failed deploy leaves the draft and
shows code/diagnostic; a success shows the raw deploy URL. Acceptance uses
only synthetic same-origin replies, never vendor endpoints, real tokens or
user data. Tunnel and MITM UI are outside SP40.
