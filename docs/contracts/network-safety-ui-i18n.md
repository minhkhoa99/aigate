# Tunnel and MITM EN/VI (SP41 / M3 U9)

SP41 localizes owned copy on `/network/tunnel` and `/network/mitm` over the
existing SP25 APIs. Tailscale's public URL, the local `/v1` URL, certificate
paths, hostnames, server blocked reasons, API codes and permitted diagnostics
stay literal. Browser locale changes do not refetch, submit actions, reset a
MITM preview or replay pending mutations. Tunnel's existing five-second status
poll continues independently of locale.

Tunnel remains guarded by server access checks. The UI retains `installed`,
`accessReady`, `routeConflict` and `running` gating, type-to-confirm enable/
disable, and a visible public-access warning. An unsubmitted confirmation is
cleared when its translated phrase changes language; a pending action disables
confirmation and closing. Failed status reads show code/diagnostic/Retry, and
action failures keep the confirmation with a render-time localized notice.

MITM still uses `POST /api/tooling/mitm/preview` to obtain a raw five-minute
`previewId` and server-authored changes, followed only by explicit
`POST /api/tooling/mitm/apply`. Preview contents, paths and IDs remain literal;
expiry time uses browser-local Intl. A locale change preserves the preview and
never creates or applies one. While Apply is pending, no other preview action
or Cancel can replace it. `PREVIEW_EXPIRED` clears the stale preview and shows
its code with localized recovery advice so the user must review a new one. Failed status reads
show code/diagnostic/Retry. This UI slice does not change the CA, trust store,
hosts file, listener or server-side guards.

Acceptance uses synthetic same-origin API replies only. It never invokes
Tailscale, `certutil`, the OS trust store, hosts-file writes, a real listener,
vendor endpoints, credentials or user data.
