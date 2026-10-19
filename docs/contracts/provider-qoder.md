# Qoder International — native integration contract

Status: native engine, owned-attempt API, conditional refresh and EN/VI dashboard implemented with synthetic validation, 2026-10-19. Zed is deferred by the user's latest request. This is not a live acceptance record.

The user explicitly requested proceeding with Qoder API/gateway and OAuth implementation first. Implement and test the observed contract without claiming the unresolved access/feasibility gates passed. No vendor permission, live account entitlement, model discovery or inference success is inferred from fixtures. See `docs/discovery/zed-qoder-p1-evidence.md` for official package pins and remaining upstream questions.

## Scope and boundaries

- Independent `qoder` provider, existing OpenAI-compatible protocol + a native adapter quirk. Do not rebuild core or modify generated catalog source.
- Bearer access-token connections through existing connection CRUD; browser/device OAuth through the owned-attempt API below. PAT exchange, CN and vision remain outside this slice; `pt-` credentials fail explicitly instead of being treated as ready inference tokens.
- Chat uses the newer observed `https://api2-v2.qoder.sh/model/v1/chat/completions` JSON/SSE route. No WAF encoder, Wasm signing, fabricated official CLI version, official client ID or OS headers.
- Device authorize/poll and refresh use the observed International `qoder.com/device/selectAccounts` and `https://openapi.qoder.sh/api/v1/deviceToken/{poll,refresh}`; verify identity at `/api/v1/userinfo` before saving.
- Optional operator-owned public client ID may be provided on start. Do not copy the official CLI's client ID. Missing/rejected registration is a real upstream failure, not a reason to impersonate a client.
- Live catalog remains an unresolved upstream dependency: attempt only the reference-observed `https://api3.qoder.sh/algo/api/v2/model/list` without bypass/signing. Preserve real signature/protocol errors. Never substitute the static catalog as a successful live import. Existing explicit custom-model import and per-model Test remain usable independently.

## Owned attempt API

All routes are guarded by the dashboard session, same-origin checked when Origin is supplied, and `Cache-Control: no-store`. A separate random HTTP-only SameSite=Strict browser-flow cookie binds local/keyless dashboards too; binding includes the dashboard session when present. Never return a token, verifier, refresh token or upstream poll URL. No credentials in logs/errors.

- `POST /api/oauth/qoder/attempts` optional `{clientId?: string}` → `{id, authUrl, expiresAt, interval: 2, status: "pending"}`. Server holds verifier/nonce/machineId. Two attempts per owner, sixteen global; five-minute local deadline (not token expiry).
- `POST /api/oauth/qoder/attempts/:id/poll` → pending or `{id,status:"approved",account:{id,name,email},expiresAt}`. One poll in flight; minimum two seconds; 150 polls maximum. Poll 202/404 is pending; token200 must be parsed and identity verified. Freeze the approved candidate. Upstream failure is precise and terminal, not indefinite polling.
- `POST /api/oauth/qoder/attempts/:id/confirm` → `{success:true,connection:{id,provider,email}}`. Atomic single consumption of the frozen candidate; stored token remains untested for inference. Session/owner/expiry mismatch cannot save. Confirmation may be retried only idempotently without a second connection.
- `DELETE /api/oauth/qoder/attempts/:id` →204; cancel owned work and release secrets. Shutdown/expiry also cancels work. Unknown/foreign IDs expose no account data.

Precise API codes: `QODER_ATTEMPT_NOT_FOUND`, `QODER_ATTEMPT_EXPIRED`, `QODER_ATTEMPT_LIMIT`, `QODER_POLL_TOO_FAST`, `QODER_AUTH_FAILED`, `QODER_PROTOCOL_ERROR`, `QODER_ACCOUNT_MISMATCH`, `QODER_NOT_APPROVED`, plus existing `INVALID_REQUEST`, `CREDENTIAL_UNREADABLE`. Every code reaches EN/VI through shared errors. Error payloads may contain safe HTTP/business code, never arbitrary raw upstream strings or tokens.

## Storage and refresh

Existing cipher and access/refresh sealed columns only. `oauth_data` contains allowlisted non-secret machine/client/account IDs, never extra tokens. Match Qoder account by stable upstream ID, not mutable/missing email. New/reconnected Qoder credentials have `testStatus: untested`; login success is not connection/inference-test success.

Expiry is validated upstream absolute RFC3339 or explicit relative seconds. No synthetic 30-day expiry/minimum-day clamp. Missing expiry stays null; expired credentials cannot become newly valid. Malformed supplied expiry is a protocol error rather than guessed units.

Qoder proactive refresh is single-flight, no retry of uncertain rotating refresh. Preserve proxy choice, bounded shared operation and independent cancelled waiters. Conditionally persist successful rotation only for the unchanged active credential version. No old in-flight result may overwrite a reconnect, disable or deleted connection. Missing expiry on replacement is unknown, not inherited fabricated validity. Background legacy refresh path is not used for Qoder. No automatic generation replay after reactive refresh; surface auth failure and reconnect/refresh for future requests.

An uncertain refresh clears only the unchanged old refresh grant and marks the connection for sign-in; a later request cannot silently retry that rotating grant. Access-token validity remains subject to real expiry/upstream rejection. Identity verification time is deducted from the candidate lifetime before confirmation.

## Chat and tests

Reuse canonical request/message/tool conversion, existing client lanes and transport. Send plain JSON with actual access token, stream true and usage enabled; nonstream clients receive a bounded collected validated stream. Enforce text/tool-only input. Preserve tool choice, arguments, call IDs and tool results; AIGate never runs the tools.

No adapter/transport/account/combo retries after a submitted Qoder generation. Mark execution-uncertain errors and honor this through routing/fallback/probes. Fresh auth can be used for a later user request; never replay ambiguous execution or tool calls.

Bound stream to 8 MiB decoded data and 1 MiB per SSE event; at most64 tool calls and256 KiB args each, inside total bound. Require usable native events, a finish reason and `[DONE]` before successful stop. Notifications are not assistant content; HTTP200 error events, malformed data, EOF, timeout and reader failures are errors. Reject incomplete/invalid tool calls. Propagate cancellation and reader cleanup. Preserve rate-limit/quota/auth/timeout/model/protocol distinctions and safe Retry-After. Never emit successful stop on failure.

Connection Test checks actual upstream identity, not token existence/expiry. UI explicitly explains that this checks the account and that the existing model Test is the separate inference check, which may cost credits. No automatic paid generation on sign-in, listing/import or refresh. Live model-import errors remain distinct from account-check success; preserve prior imported IDs on failure.

## Validation and release state

Native fixture tests must cover owned login success/failure/isolation/limits/cancel/expiry/confirm, sealed storage, refresh/CAS, actual outbound identity/model/chat requests, stream interruption/errors, tool round trips and no replay; EN/VI API/UI wiring and existing-provider regressions are mandatory.

Real login, catalog, inference, token rotation and tool compatibility require an authorized account and explicit inference budget. They remain NOT RUN until observed. The UI must show an integration-under-validation notice and catalog/signing limits; do not advertise fixtures as live success. No full Qoder completion claim without the approved per-provider acceptance matrix.

Implemented validation: 30 Qoder engine fixtures and 16 server integration tests cover the native wire path, owned attempt isolation/limits/cancel/expiry/idempotent confirmation, sealed persistence, stable account reconnect, single-flight refresh and stale-result rejection, account/model separation, signature failures and no replay through proxy/retry/account/combo paths. Shared EN/VI tests check every Qoder API diagnostic. Chrome desktop checked English start/approve/confirm/save and the Vietnamese form against an isolated fake transport/database; no real Qoder credentials or inference were used.
