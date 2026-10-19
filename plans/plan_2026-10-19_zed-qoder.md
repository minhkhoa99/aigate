# Zed and Qoder International: implementation and acceptance plan

Date: 2026-10-19

Status: **Latest user direction prioritizes Qoder implementation and defers Zed. Qoder native engine, owned login API, conditional refresh and EN/VI UI are implemented and synthetically tested; live access/contract/acceptance gates remain open.** See `docs/contracts/provider-qoder.md` and the latest handoff entry; the original gated plan below records the earlier sequencing, not a claim that live gates have passed.

## 1. Decisions and scope

The user's latest request supersedes the 2026-09-26 blanket exclusion of Qoder **for legitimate protocol research and integration**. It does not authorize WAF evasion, fabricated client/access identity, protection bypass, or enabling an unimplemented runtime provider. Qoder remains a first-release objective; an obstacle must produce an evidence report and alternatives, not another unilateral exclusion.

Approved functional scope, separately for `zed` and `qoder`:

- Zed browser/native-app RSA sign-in; Qoder International device/browser sign-in if the upstream supports that integration.
- Sealed credentials, truthful expiry/refresh/account state, live model import/synchronization and real connection testing.
- Text and client-owned tool calling, streaming and non-streaming, precise failure handling, and EN/VI dashboard integration.
- Reuse the existing credential repository, transport, CIP, adapter factory, router, model-import workflow and provider UI. No gateway-core rebuild.

Backlog: Qoder CN, PAT/service-account authentication, images/vision and additional context-tier controls. Supporting a wire-family does not promise every model or feature in that family. SDK/ACP is an alternative to assess, **not an approved substitute for a gateway provider**.

The user has already approved correcting reference bugs: failed/truncated streams must fail; no invented or extended expiry; no credential-exists success; no swallowed failures; real upstream tests; no unsafe/unbounded generation replay. No further approval of those corrections is needed.

## 2. Evidence and current feasibility

Evidence categories below describe confidence, not new Feature Matrix labels:

- **Official:** published vendor documentation or pinned vendor source.
- **Reference-only:** observed in read-only 9router `39e36d3d0c849e0e01dfeacddf111edf892448fc`; not independently established as the current upstream contract.
- **Unverified:** requires permitted protocol information or a controlled live test.

### 2.1 Recorded connectivity observations

Initial pre-authentication probes from this machine on 2026-10-19, approximately 08:12–08:16 UTC:

| URL | Method and observed result | What this establishes |
|---|---|---|
| `https://zed.dev/native_app_signin` | GET 200 HTML; intentionally stopped at 64 KiB (curl exit 63). A subsequent HEAD completed with 200. | Public sign-in endpoint reachable; not a completed browser login. |
| `https://cloud.zed.dev/client/users/me` | GET 401, 28-byte body | An HTTP auth rejection was received; identity not verified. |
| `https://cloud.zed.dev/models` | GET 401, 3-byte body | Catalog endpoint answered; no authorized catalog obtained. |
| `https://qoder.com/device/selectAccounts` | GET 302, not followed | Entry point reachable; login/poll behavior untested. |
| `https://openapi.qoder.sh/api/v1/userinfo` | GET 401 JSON, 106 bytes | Auth rejection received; no credential verified. |
| `https://api3.qoder.sh/algo/api/v2/model/list` | GET 403 JSON, 44 bytes; bounded repeat returned `{"code":"101","message":"Signature invalid"}` | An unsigned request is insufficient. This is **not evidence of WAF blocking or technical impossibility**. |

All probes used TLS verification (curl `ssl_verify_result=0`), no credentials, no redirect following, a 5-second connect limit and 15-second total deadline, and bounded bodies. No paid inference, login approval, signature spoofing or protection-bypass headers were used. These are observations from this session, not a retained vendor acceptance tape. They do not prove that direct third-party access is permitted.

Neither `qoder` nor `qodercli` was found on PATH. No downloaded CLI was installed or executed. No authenticated model list, token refresh, chat or tool-call test has passed for either provider. Further vendor operations are subject to the access gate below.

### 2.2 Zed: officially corroborated protocol

Official source inspected at `zed-industries/zed` commit **`56934ec0560bce8929025497411de7f5322fb6ca`** (2026-10-17). Its source package declares version 1.26.0; this is not a claim about the installed/stable release.

| Area | Verified contract | Pinned official source |
|---|---|---|
| Browser callback | Bind `127.0.0.1:0`; open `/native_app_signin` with public key, port and optional system ID; callback returns `user_id` and encrypted `access_token`. This is not ordinary OAuth2. | [client.rs L1469–1552](https://github.com/zed-industries/zed/blob/56934ec0560bce8929025497411de7f5322fb6ca/crates/client/src/client.rs#L1469-L1552) |
| RSA | RSA-2048; public PKCS#1 DER, padded base64url; OAEP SHA-256. Official client also has a deprecated PKCS#1 v1.5 decryption fallback. | [auth.rs L10–105](https://github.com/zed-industries/zed/blob/56934ec0560bce8929025497411de7f5322fb6ca/crates/rpc/src/auth.rs#L10-L105) |
| Account and mint | Account authorization is `<numericUserId> <accountAccessToken>`, **not Bearer**. `GET /client/users/me`; `POST /client/llm_tokens` with `organization_id`; optional `x-zed-system-id`. | [cloud_api_client.rs L108–149](https://github.com/zed-industries/zed/blob/56934ec0560bce8929025497411de7f5322fb6ca/crates/cloud_api_client/src/cloud_api_client.rs#L108-L149), [L315–328](https://github.com/zed-industries/zed/blob/56934ec0560bce8929025497411de7f5322fb6ca/crates/cloud_api_client/src/cloud_api_client.rs#L315-L328) |
| Account/organization | Account configuration carries organizations, eligibility/defaults; native client chooses valid default or first. Gateway must expose and confirm the actual selection. | [cloud_api_types.rs L22–94](https://github.com/zed-industries/zed/blob/56934ec0560bce8929025497411de7f5322fb6ca/crates/cloud_api_types/src/cloud_api_types.rs#L22-L94), [user.rs L894–921](https://github.com/zed-industries/zed/blob/56934ec0560bce8929025497411de7f5322fb6ca/crates/client/src/user.rs#L894-L921) |
| LLM token | Mint response contains `token`; no proven refresh token or expiry. Cache is organization-bound and cleared on organization change/fetch failure. | [llm_token.rs L26–105](https://github.com/zed-industries/zed/blob/56934ec0560bce8929025497411de7f5322fb6ca/crates/cloud_api_client/src/llm_token.rs#L26-L105) |
| Refresh semantics | Native client remints once on 401/expired/outdated LLM-token indication. Account auth rejection while minting requires sign-in again. | [language_models_cloud.rs L153–183](https://github.com/zed-industries/zed/blob/56934ec0560bce8929025497411de7f5322fb6ca/crates/language_models_cloud/src/language_models_cloud.rs#L153-L183), [client.rs L1608–1677](https://github.com/zed-industries/zed/blob/56934ec0560bce8929025497411de7f5322fb6ca/crates/client/src/client.rs#L1608-L1677) |
| Live catalog | LLM Bearer token on `GET /models`; native model families, capabilities, limits and disabled reasons. | [cloud_llm_client.rs L299–351](https://github.com/zed-industries/zed/blob/56934ec0560bce8929025497411de7f5322fb6ca/crates/cloud_llm_client/src/cloud_llm_client.rs#L299-L351), [language_models_cloud.rs L618–647](https://github.com/zed-industries/zed/blob/56934ec0560bce8929025497411de7f5322fb6ca/crates/language_models_cloud/src/language_models_cloud.rs#L618-L647) |
| Chat | `POST /completions`, native provider envelope; Anthropic Messages, OpenAI Responses, Google GenerateContent, xAI Chat. Wire family does not imply present model availability. | [cloud_llm_client.rs L219–255](https://github.com/zed-industries/zed/blob/56934ec0560bce8929025497411de7f5322fb6ca/crates/cloud_llm_client/src/cloud_llm_client.rs#L219-L255), [language_models_cloud.rs L1011–1360](https://github.com/zed-industries/zed/blob/56934ec0560bce8929025497411de7f5322fb6ca/crates/language_models_cloud/src/language_models_cloud.rs#L1011-L1360) |
| Stream | Native NDJSON with negotiated status frames, not ordinary SSE. Failed status and missing terminal status are failures. | [language_models_cloud.rs L212–300](https://github.com/zed-industries/zed/blob/56934ec0560bce8929025497411de7f5322fb6ca/crates/language_models_cloud/src/language_models_cloud.rs#L212-L300) |

**Access/permission limit:** [Zed Terms](https://zed.dev/terms), updated 2026-03-02, §2.2 restricts access to designated mechanisms; §2.4 addresses non-public APIs and redistribution. Open client source establishes wire behavior, not a grant to operate a third-party inference gateway. Establish a vendor-supported access basis or obtain confirmation before authenticated protocol experiments/rollout. This is an unresolved access-policy question, not a tested technical failure or a legal determination.

Other unverified points: hosted callback compatibility with OAEP-only; required compatibility headers for AIGate; actual account/organization entitlement; currently enabled models; family-specific tool round trips. No fixed 50-minute or other synthetic token expiry will be used.

### 2.3 Qoder: official integration surface versus direct-HTTP gaps

Official documentation read on 2026-10-19:

- [CLI authentication](https://docs.qoder.com/cli/authentication): browser login exists and **browser tokens are automatically refreshed by the CLI**. Environment PAT takes precedence. This contradicts a reference assumption that device credentials cannot refresh; it does not disclose the refresh HTTP schema.
- [CLI reference](https://docs.qoder.com/cli/cli-reference): login, model listing, structured JSON/stream-json, tool controls and finite task/output/retry controls are documented.
- [SDK authentication](https://docs.qoder.com/cli/sdk/authentication): PAT, service-account and local `qodercliAuth()` are supported. Local login reuse is documented for developer workstations, not stateless production. SAT exchange is documented, but is outside the approved first-release auth scope.
- [SDK architecture](https://docs.qoder.com/cli/sdk/how-it-works): SDK starts a local `qodercli` process, exchanges JSONL and lets that runtime own model requests, the agent loop and approved tool execution. It is **not a documented raw inference HTTP SDK**.
- [ACP](https://docs.qoder.com/cli/acp): official `qoder --acp` works as an external agent, including in Zed. That does not make Qoder an AIGate model provider or make Zed-hosted models available through AIGate.

Reference-only candidates, **not approved wire contracts**:

| Area | Reference observation | Required verification |
|---|---|---|
| Device/browser flow | `qoder.com/device/selectAccounts`, generated S256 challenge/verifier, nonce and machine ID; GET `/api/v1/deviceToken/poll` with nonce/verifier. | Vendor-supported use, exact parameters, pending/denied/expired states, polling interval, identity binding and token scope. Do not call this standard RFC device authorization without evidence. |
| Credential lifecycle | `/api/v1/userinfo`; reference refresh `/algo/api/v3/user/refresh_token`; fallback 30-day expiry/minimum-one-day clamp. | Correct refresh grant, region, expiry units, rotation and revocation. Discard fabricated expiry. A reference 403 is insufficient to conclude refresh is unsupported. |
| Models/inference | Intl `api3.qoder.sh/algo/api/v2/model/list`; CLI agent SSE endpoint with `FetchKeys`, `AgentId`, optional `Encode=1`; nested `{statusCodeValue, body}` events. | Current approved inference URL/envelope, enabled model IDs/capabilities, terminal success/error/usage and tool-result continuation. |
| Signing/encryption | COSY signature, RSA-wrapped AES user-info, AES-CBC/MD5-related transformations and encoded body/path signing. | Official/approved algorithm and serialization, current public key/key version, timestamp/nonce rules and deterministic test vectors. No guessed machine identity/client versions or exported secret keys. |
| Body encoding | Third-party reference code explicitly describes reordered/substituted base64 as a WAF-bypass scheme. | Determine whether any transformation is an ordinary required protocol encoding, optional compression/encryption, or protection evasion. The comment is a warning, not proof that all body encoding is forbidden or that official CLI uses it. |

Reference evidence: `src/lib/oauth/services/qoder.js`, `src/lib/oauth/providers/qoder.js`, `open-sse/shared/qoder/{constants,cosy,encoding}.js`, `open-sse/executors/qoder.js`, `open-sse/services/qoderModels.js` in the pinned reference checkout. No code from those files will be translated line by line.

**Planning conclusion:** Qoder direct HTTP feasibility is **undetermined**, not rejected. Authentication, signing, encryption and streaming investigation is incomplete. Public docs establish a supported CLI/SDK/ACP route; they do not yet establish a supported direct gateway protocol. The unsigned 403 is the only concrete direct-model failure observed here.

**P1 update after approval:** integrity-verified static inspection of official CLI `1.1.73` corroborates a newer `api2-v2.qoder.sh/model/v1/chat/completions` model-server route and `/api/v1/deviceToken/refresh`. The older reference transport is not established as the only current option; its catalog 403 cannot be generalized to that newer route. Client ID, truthful attribution, live catalog/tools/full middleware and third-party access remain unverified; G1/G2 are not passed. Full package pins, hashes, static findings, official-access review and prepared unsent vendor questions are in [the P1 evidence report](../docs/discovery/zed-qoder-p1-evidence.md).

## 3. Approval and feasibility gates

| Gate | Deliverable / pass condition | Current status |
|---|---|---|
| G0 — approve this plan | User approves implementation sequencing and safeguards. Approval does not authorize bypass or paid requests. | Approved 2026-10-19 |
| G1 — permitted access and contract | Zed designated-access/permission basis; Qoder approved direct interface or vendor confirmation, including signing/encoding classification and refresh semantics. No unresolved requirement for false identity/protection evasion. | Open: P1 review recorded; external access/contract inputs pending for both |
| G2 — isolated feasibility | With permitted test accounts: auth → verified identity → catalog → one bounded text result → tool round trip and interrupted stream; correct credential lifecycle. Record sanitized evidence. | Not run |
| G3 — product slices | Only after that provider's G1/G2 pass: contracts/matrix first, then adapter + server + UI together. Provider flags/status cannot imply support before the corresponding runtime exists. | Not started |
| G4 — synthetic/security/regression | Native unit/contract tests, limits, retry audit, EN/VI browser checks and old-provider gates pass; precise deviations recorded. | Not started |
| G5 — live acceptance | All ten acceptance rows below pass separately for that provider, with live successes and controlled negative tests distinguished. | Not run |

Zed and Qoder can proceed independently after their own gates. A working Zed slice must not be held indefinitely by Qoder research; it also must not make the combined delivery appear complete.

If G1/G2 fails: retain Qoder on the task board; report the exact bounded test, version/region, sanitized HTTP/business code, observed failure and unproven hypotheses. Offer vendor protocol clarification or a separately scoped official SDK/ACP spike. Do not repeat blocked requests with altered identity/encoding, silently switch to PAT/CN, or reintroduce a permanent exclusion. A policy question cannot be proved/disproved by connectivity tests; label it separately from technical failures.

### Qoder feasibility investigation after approval

1. Seek supported inference/device/refresh documentation or vendor guidance. Pin the official CLI/SDK release, distribution source and checksum before a local spike; do not execute unreviewed reference scripts.
2. In an isolated user-controlled account/config directory, inspect documented CLI capabilities, login, model listing and bounded structured output. Clear inherited auth overrides; no workspace, shell/file/MCP tools, hooks, plugins, skills or transcript persistence. No `--yolo` or permission bypass.
3. Obtain approved protocol fixtures/test vectors for required signing and encryption. Where permitted, compare the official client behavior with direct requests using the **same authorized account**, without TLS interception, extracting embedded secrets or defeating anti-tamper/protection controls. Separate public protocol constants from access identity.
4. Verify refresh, expiry units, region and user identity; never infer no-refresh from the reference's failure. Confirm client tool calls can be returned without CLI executing them.
5. Document each finding as official, observed with authorization, reference-only or unresolved. If direct transport remains unsupported, stop that transport implementation and report alternatives for a new decision.

An SDK alternative needs its own review: subprocess lifecycle, configuration/credential isolation, additional dependencies, network calls outside `HttpTransportPort`, proxy behavior, cancellation/backpressure, concurrency, native tools/agent loops and ability to round-trip caller-owned tool results. Disabling built-ins alone does not prove gateway-equivalent tool semantics. No gateway-core/subprocess exception is pre-approved by this plan.

## 4. Zed implementation design (conditional on gates)

### 4.1 Browser sign-in and account confirmation

1. Dashboard opens a blank popup synchronously on the user click, then starts a session-guarded server attempt. Bind listener to literal `127.0.0.1`, random port, never `0.0.0.0`.
2. Server generates a fresh RSA key pair and protocol-compatible public encoding; keeps private key, system ID, attempt ID and session binding in memory. Browser receives only the hosted auth URL, opaque attempt ID and local deadline.
3. Match the official callback contract exactly. **Do not invent a callback path/state/PKCE field that Zed does not return.** Validate method, host/port, query size, numeric user ID, ciphertext and encoding; decrypt OAEP-SHA256 server-side. OAEP-only initially; legacy v1.5 needs demonstrated necessity and a separate security decision.
4. RSA encryption protects callback content, but does not authenticate the callback sender. Verify identity upstream, show the verified account/organization to the initiating dashboard session, and require explicit confirmation before saving. Never accept callback identity claims alone.
5. Wrong-key/malformed callbacks must not consume a pending legitimate attempt. Keep candidate data separate; permit at most one validation in flight per attempt, bound bad callbacks, then close safely with an actionable restart error if abused. Freeze the first upstream-verified candidate and close the listener; status returns an opaque candidate revision. Confirmation must match that exact revision, canonical account ID and an organization from its verified list. Later callbacks cannot replace the account shown for review. Duplicate callbacks/confirmation cannot create duplicate connections.
6. User cancellation, expiry, session loss, shutdown or completed confirmation closes listener/timers and releases private key references. `Cache-Control: no-store`, no referrer, static callback page with no third-party resources; logs must exclude callback queries and auth URL material.

First release requires browser and AIGate listener on the same machine. Remote dashboard/browser sign-in is explicitly unsupported unless a vendor-supported callback design is verified; do not expose a loopback callback publicly as a workaround.

### 4.2 Token lifecycle

- Seal the account token in the existing access-token field. Persist only allowlisted non-secret identity/org/system metadata in `oauth_data`; that JSON column is **not encrypted**. Keep minted LLM tokens server-side in a bounded organization/credential-version-keyed cache; their vendor expiry is unknown unless explicitly supplied. Never put either token or RSA private key into ordinary provider metadata/UI/poll results.
- Account/LLM expiry remains unknown if upstream provides none. Show “Expiry not provided” / “Không có thông tin hết hạn”, not “Never expires.” Local cache eviction is not vendor token expiration.
- Remint LLM token on cache miss or a proven pre-execution expired/outdated rejection, at most once and single-flight. Account rejection during identity/mint means reconnect, not an OAuth refresh grant that does not exist.
- Organization/account change invalidates cached tokens and catalog. Do not silently switch organization. Delete/disable/reconnect invalidates pending work; an old refresh/mint result cannot overwrite a replacement credential.
- Follow the resolved proxy and request cancellation/deadline through request-owned identity/model/chat calls and their body reads. Shared mint/catalog/refresh operations follow the bounded ownership contract below; an individual waiter cannot cancel another request's operation. Disconnect removes local credentials; do not claim upstream revocation without a verified revocation operation.

**Shared-operation ownership (both providers):** key single-flight work by connection credential version, organization/region and proxy version. Give the shared operation its own deadline of at most 20 seconds (or the existing lower operation budget) and module-shutdown signal, and let each waiter independently race its own cancellation/deadline without extending that deadline. Shared catalog/mint work is aborted when its final waiter leaves. Once a rotating refresh has been submitted, it may finish within its original bound even if all callers disconnect: conditionally persist the replacement credential before resolving, so a valid rotated token is not lost. Compare-and-swap must verify the unchanged existing credential version and active state; deletion, disable, reconnect or organization change invalidates the result. Never recreate a deleted row or return stale credentials to a cancelled waiter. Shutdown waits only within the existing shutdown budget, aborts remaining work and records a sanitized reconnect-required outcome if rotation became uncertain. A process crash during upstream rotation is a documented residual reconnect risk, not a reason to retry an ambiguous refresh.

### 4.3 Native model routing, chat and tools

Build the verified envelope:

```json
{"provider":"anthropic|open_ai|google|x_ai","model":"<live-id>","provider_request":{}}
```

`provider_request` is the corresponding native Anthropic Messages / OpenAI Responses / Gemini GenerateContent / xAI Chat body, not one generic OpenAI Chat body for every family. Reuse existing pure CIP builders/parsers where their contracts match. Gemini's inner model may require `models/<id>` while the envelope uses the bare ID. Preserve role, system, tool schema/choice, stable call IDs, parallel call indexes, incremental arguments and tool-result association. Never execute user tools in AIGate.

Use documented capability/status negotiation. Do not fake an official editor version/system identity to pass access restrictions. If a required compatibility declaration cannot truthfully be sent by AIGate, report it at G1/G2. Catalog data-retention consent requirements remain disabled with a clear reason unless explicit consent can be represented and enforced; excluded vision must not be advertised as implemented.

NDJSON frames include queued/started status, native events, failed status and `stream_ended`. Queue/status frames are not assistant text. Validate the negotiated protocol, native family completion and outer terminal success; missing terminal marker, invalid JSON, unexpected EOF, reader error or late failed status fails the request. Never emit a successful final stop before the outer status is validated. Bound queued duration even if status frames continue arriving.

Non-streaming aggregates that same validated native stream with explicit output/tool limits; do not assume upstream supports `stream:false`. A partial result followed by failure is an error, not a completed assistant message. Maintain existing client-protocol-specific error encoding after downstream headers have been sent.

## 5. Qoder adapter design (only after verified contract)

Keep International endpoint/region, authentication grant, signing/encryption and model/event normalization as separate small responsibilities, following current adapter patterns. This permits later CN/PAT work without prebuilding a generic framework. There is one independent Qoder descriptor/adapter; it does not run through Zed.

- Device verifier/nonce and temporary authorization data stay server-side in a session-bound attempt. Poll cadence/pending/slow-down/denial/expiry follow verified upstream responses; use a bounded local attempt deadline if upstream gives none, without representing it as token expiry.
- Seal access/refresh credentials in existing secret fields. If upstream requires additional secret material, reuse a versioned sealed payload in an existing secret field where appropriate, or propose the smallest encrypted-schema extension before implementation. Never place secrets in plaintext `oauth_data` to avoid a migration.
- Refresh only the verified grant, including rotation and expiry units; single-flight per connection with stale-write refusal. Unknown expiry is unknown, not 30 days. Confirm whether supported credentials can be used outside the official CLI before persisting gateway credentials.
- Sign the exact serialized bytes and path specified by an approved protocol; use proper cryptographic primitives behind the runtime boundary where necessary. No third-party “WAF bypass” encoder, spoofed access entitlement or guessed CLI headers.
- Normalize the verified live catalog and native request/response events into existing CIP. Preserve caller-owned tool declarations, call IDs/arguments and tool-result continuation. The CLI executing a tool is not a passed gateway tool-call test.
- Streaming and execute() share validated terminal semantics. HTTP 200 carrying a nested error is an error. Malformed/truncated stream, late upstream failure, reader error or missing terminal success must never become assistant text or synthetic success.

## 6. Minimal integration changes and compatibility boundaries

Existing sources inspected: `packages/engine/src/{ports,registry,oauth,builtin-registry}.ts`, `adapters/{index,collect}.ts`; connections `oauth.controller.ts`, `connections.controller.ts`, `connections.repo.ts`, `token-refresher.ts`; routing `chat-lane.ts`; providers `sign-in.tsx`/`models.tsx` and the existing OAuth/model contracts.

| Area | Planned additive work | Guardrail |
|---|---|---|
| Engine | New native adapter/protocol modules and factory/registry entries, plus pure family conversions only where existing helpers cannot be reused. | Keep `AIProviderPort` methods and existing CIP/transport interfaces. No npm/Node imports in engine; runtime crypto belongs server-side or uses supported platform primitives. Never hand-edit `providers.generated.ts`. |
| Auth server | Small provider-specific sign-in service/controller behind current connections module; reuse repository/cipher. Existing generic controller can delegate, not absorb another large implementation. | New providers use server-held attempts. No global rewrite of legacy flows. |
| Storage | Existing sealed access/refresh fields, verified identity/org metadata. Provider-scoped save options for `untested`, canonical identity matching, and conditional credential-version writes. | Current `saveOAuth()` marks login `active`; that must not imply a passed connection test for these providers. Do not change legacy defaults. No migration assumed unless encrypted extra secrets or durable model metadata demonstrably require it. |
| Refresh/routing | New-provider-only safe refresh/replay selection, preserving the existing manager and account router. Audit adapter retries, `withRefresh`, account failover, combo fallback and model probes together. | Legacy reactive refresh retries three times and logs raw messages; neither new provider may inherit this unsafe path. Scope opt-in policy; prove old-provider defaults unchanged. |
| Models | Reuse connection `getModels`, import/custom IDs and model-test UI; add optional sanitized metadata/availability/freshness to the existing model result. Select the actual connection instead of silently using the first account. | Current controller discards descriptors and hides specific errors; new-provider failures must retain actionable sanitized cause without returning dashboard HTTP 401 for an upstream 401. Existing `{id,inCatalog}` consumers remain valid. |
| Capability enforcement | Provider-local credential/org-keyed live model resolver reused by getModels and execution. Persist imported IDs via existing custom models; keep bounded runtime descriptor snapshots, lazy refresh after restart and invalidation on account change. | Current routing's initial capability check uses static registry models. New adapters must additionally enforce authoritative live enabled status/known capabilities before generation; don't mutate global registry or inherit permissive defaults as proven tool support. |
| `/v1/models` | Scoped handling for the two providers: imported/live enabled IDs only; refresh/snapshot ownership is explicit. | Current static+custom union must not advertise known-disabled/stale entitlements as available. Stale/unknown data is not evidence that the account can run a model. No live vendor fan-out on every list request. |
| Web | Provider cards/detail, sign-in states, account/org confirmation, models/import/sync, test results, expiry/reconnect and cancellation in existing components. EN/VI strings through existing catalogs/errors. | No second shell/provider-management app; preserve drafts on locale switch and prevent duplicate start/poll/test submissions. |
| Contracts/discovery | Per-provider auth/model/transport rules and deviations, OAuth/provider contracts, `API_UI_MAP.md`, capability/coverage generation and `/graphify docs --update`. | Matrix rules labeled before product code; no “implemented/verified” status before evidence. |

**Proposed session API shape, to finalize in contracts after G0:** start, status, confirm and cancel under `/api/oauth/{zed|qoder}/attempts`. All are dashboard-session guarded, same-origin, ownership checked, no-store; start/confirm/cancel are POST. Status exposes only opaque ID, phase, deadline, safe verified account/org summary or sanitized error. Confirm atomically consumes the attempt. No private key, token, verifier or raw callback is returned. Exact routes must be checked against the existing generic `:provider/:action` routes; no accidental fallthrough. The loopback callback itself cannot require a dashboard cookie; its narrow protocol validator plus upstream identity check and session-bound confirmation are mandatory.

### Real Test Connection and model synchronization

Separate evidence stages: authenticated account, token mint/refresh where applicable, accessible catalog, and selected-model minimal generation. Login/catalog-only success is never labeled “Chat connection passed.” New connections begin untested for inference. Reuse existing model-test execution for a single explicitly selected enabled text model, with tools disabled and a small output cap. Display the selected model and potential charge before explicit Test; do not auto-generate on login/import/background refresh. `validateCredential()` must make a real upstream check and must not return success merely from token presence/expiry.

A failed model sync preserves the last good snapshot and imported IDs, marks them stale and displays the cause. Successful sync shows new/removed/disabled entries and confirmation before changing imported IDs; do not delete custom entries silently. Unknown capabilities/limits remain unknown. Account/org changes cannot reuse another account's entitlement snapshot. No vendor polling loop solely to refresh the dashboard.

### Errors and retry safety

Reuse engine `AUTH_ERROR`, `RATE_LIMIT`, `QUOTA_EXHAUSTED`, `TIMEOUT`, `PROVIDER_UNAVAILABLE`, `INVALID_REQUEST`, `MODEL_UNAVAILABLE` and current client error encoders. Distinguish rejected account credentials, expired LLM token, authorization/entitlement denial, malformed protocol and retryable network failures. In particular, not every Qoder 403 is auth expiry: `Signature invalid` is a protocol/signature diagnostic.

Dashboard errors use stable precise codes with EN/VI messages in `apps/web/src/shared/errors.ts`; upstream diagnostic fragments are bounded and redacted, not blindly echoed. Include safe operation/stage, HTTP/business code and request ID when available. Upstream auth failure must not terminate the dashboard session. Tentative new codes cover expired/cancelled/mismatched attempts, reconnect required, organization/entitlement, signature/protocol failure, interrupted stream, limits and live-test failure; contracts must enumerate every actual code and UI recovery before implementation.

No automatic generation replay on 429, 5xx, read timeout, ambiguous network failure, malformed data, partial output or tool-call output. No account/combo fallback replay when execution outcome is uncertain. At most one refresh/remint + resend only for a verified **pre-execution** auth rejection, before any native/output/tool event; if upstream does not establish pre-execution rejection, refresh for a future request and fail the current one. Transport-level connect failures may only be retried if proven no request was submitted. Honor bounded `Retry-After` as an actionable delay, not an unbounded wait/retry loop. Never retry after successful terminal output or downstream cancellation. Existing legacy provider behavior remains covered by regression tests.

## 7. Proposed resource and security budgets

These are gateway safety limits, **not claimed vendor token TTLs**. Use existing lower limits/deadlines where applicable; document any necessary change before product code.

| Resource that can grow | Proposed first-release bound / lifecycle |
|---|---|
| Pending login attempts | 2 per dashboard session, 16 globally across these two providers; reserve before RSA generation; at most 2 key generations in flight. Local 10-minute deadline or earlier upstream deadline; release on every exit/shutdown. |
| Callback work | 8 KiB URL; exact RSA ciphertext size; one upstream validation per attempt at a time; maximum 5 invalid callback candidates, then close/restart. No queue of candidate secrets. |
| Device polling | At most 1 upstream poll in flight per attempt; minimum 2 seconds or upstream's slower cadence; at most 300 calls and 10 minutes. Stop on terminal result/cancel; finite transient error allowance. |
| Ordinary responses | Auth/token 64 KiB; identity 1 MiB; model list 2 MiB and 2,000 entries. Enforce streamed decoded bytes, not Content-Length alone; reject oversize instead of silently truncating catalogs. |
| Model IDs/tool data | Existing model-ID validation; at most 64 returned calls and 256 KiB arguments per call, all included in the total output cap. Reject unmatched/duplicate tool IDs and malformed JSON. |
| Streams/non-stream aggregation | 1 MiB per NDJSON/SSE logical record; 8 MiB total decoded output per request, including text/thinking/tool data; incremental UTF-8 decoding, bounded fragment count and existing writer backpressure. No detached readers or unbounded `collected()` use. |
| Deadlines | Identity/catalog/refresh/test inside existing controller and `ExecCtx` budgets. Generation at most 600 seconds total or caller's earlier deadline; use existing `AIGATE_STREAM_IDLE_TIMEOUT_MS`; status/heartbeat traffic cannot defeat absolute/queue deadline. |
| Metadata/token caches | At most 128 entries each across new providers; metadata at most 16 MiB total with 5-minute freshness, token cache 10-minute local eviction or earlier proven expiry. Keys include provider/account/connection credential version/org/region. No raw token in keys/logs. Single-flight, cleared on failure/change/removal/shutdown. |
| Model sync / refresh fan-out | One per connection and at most 4 concurrent sync/refresh jobs globally for these providers, no waiting queue (reuse in-flight result or return busy). Connection/model list reads remain paginated/bounded. |
| Generation concurrency | Reuse existing capacity controls; add a new-provider local safety ceiling of 4 in flight per connection and 16 globally, no waiting queue, unless an existing lower bound already applies. Return an explicit busy error, not a hidden retry. |
| Retries | Polling is a finite auth flow, not generation replay. Refresh: at most one verified operation per request, single-flight, no nested generic retries; generation resend at most once and only under the pre-execution rule above. |

No secrets in access/query logs, traces, snapshots, error messages, analytics, exported settings or browser storage. Log metadata/allowlisted codes only, never raw upstream `error.message` without sanitization. Treat verified account email as personal data; return only to the owning dashboard. Network work must remain outside database transactions. Raw prompt/tool payload logging is not needed for this feature.

## 8. Feature rules to record before implementation

Split final Feature Matrix entries by provider and auth/catalog/chat behavior; keep reference source and native test evidence separate. Initial rule classification:

| Rule | Label | Native contract / decision |
|---|---|---|
| Zed RSA callback, account→LLM credential distinction and native family envelope | `REFERENCE_BEHAVIOR` | Preserve verified behavior, corroborated by official source. |
| Qoder device login, live catalog and signed native transport | `REFERENCE_BEHAVIOR` | Preserve only once the authorized current contract is verified; no blanket endorsement of reference constants/encoding. |
| Failed status as assistant text; swallowed reader error; EOF reported as success | `SUSPECTED_BUG` | User-approved correction: terminal error, never successful completion. |
| Fixed 50-minute Zed TTL, fabricated Qoder 30-day/minimum-one-day validity | `SUSPECTED_BUG` | User-approved correction: explicit upstream expiry or unknown; no extension. |
| Test unsupported/token-presence/expiry-only success; inconsistent Test/runtime | `SUSPECTED_BUG` | Real upstream stages plus explicit minimal inference test. |
| Private-key exposure in poll data, callback races and missing proxy propagation | `SUSPECTED_BUG` | Server-held attempts, ownership/canonical identity confirmation and one ctx/proxy throughout. |
| CN image host/PAT expiry bugs | `SUSPECTED_BUG` | Document only; these auth/media modes remain backlog, not implicitly ported. |
| Next.js route/global-polling/singleton layout and reference token-cache implementation | `IMPLEMENTATION_ACCIDENT` | Use existing Nest/Fastify/engine boundaries and bounded lifecycle; do not copy layout. |

No runtime-support status or parity count is increased by this plan. Update the historical Qoder exclusion note to the superseding decision while keeping current transport status `traced`/unimplemented. Generated capability documents must not claim device/chat/refresh support from a planning change.

## 9. Work packages / task board

| ID | Deliverable | Depends on | Status |
|---|---|---|---|
| P0 | Pin evidence, record initial connectivity, supersede old research exclusion and submit this plan | Current request | Reviewed and approved 2026-10-19 |
| P1-Z | Establish Zed access basis and resolve callback/header/organization questions | G0 | Public access review complete; awaiting applicable supported-access basis |
| P1-Q | Verify Qoder authorized direct contract, signing/encryption/refresh; report SDK alternative separately if necessary | G0 | Official docs/artifacts inspected; newer routes corroborated, client-access/full contract inputs pending |
| P2-Z / P2-Q | Isolated feasibility and sanitized protocol fixtures for each provider | Provider's G1 | Not started |
| P3-Z / P3-Q | Labeled Feature Matrix entries, contracts, error/API/UI map and exact safety limits | Provider's G2 | Not started |
| P4-Z | Zed auth + lifecycle + catalog/test + adapter + EN/VI UI in one coherent slice | P3-Z | Not started |
| P4-Q | Qoder International equivalent, no CN/PAT/vision substitution | P3-Q | Not started |
| P5 | Independent review, synthetic/security/browser checks and existing-provider regression | Each implemented slice | Not started |
| P6-Z / P6-Q | Separate live acceptance records; fix and rerun failures | Provider's G4 | Not started |
| P7 | Docs/capabilities/API map/graph/handoff, residual limits and per-provider completion report | Accepted slice | Not started |

P1-Z and P1-Q are independent research. Product edits to shared registry/factory/controllers/router/UI must be coordinated rather than assigned overlapping write sets. No delivery estimate until G1/G2 resolves the vendor-dependent unknowns.

## 10. Mandatory acceptance — run independently per provider

No row is currently passed. “Synthetic pass” and “live upstream pass” are different fields in the eventual report.

| # | Test | Required evidence |
|---|---|---|
| 1 | Login success/failure | Real authorized browser/device success with verified account/org; local controlled denial, cancellation, malformed/foreign/expired callback and duplicate confirmation. Competing valid callbacks cannot change the frozen candidate; stale candidate/org confirmation fails. Session mismatch cannot read/confirm/cancel another user's attempt. |
| 2 | Secure save/load | Reload/restart uses sealed credentials; DB/log/API/browser inspection shows no secret leakage; wrong secret key yields precise recovery; logout/delete/reconnect races cannot resurrect old credentials. |
| 3 | Live model import/sync | Actual account catalog/model IDs and metadata; explicit import; refresh/add/remove/disable/stale failure behavior, account/org isolation and restart refresh. No static/sample list claimed live. |
| 4 | Real Test Connection | Identity/catalog and explicit selected-model inference stages recorded; invalid/revoked credential fails; HTML/error-200/empty/malformed result is not accepted as success. Cost consent shown. |
| 5 | Non-stream text | Real `/v1` request returns usable text with correct model/finish/usage where supplied; only succeeds after verified upstream terminal completion. |
| 6 | Stream + interruption | Real streamed text; client cancellation releases reader/socket/timers. Controlled cut before/after text/tool deltas, late failure, malformed record and missing terminal marker cannot emit successful final completion. |
| 7 | Tool round trip | **Separate real successful streaming and non-streaming tool round trips**: supported model returns caller tool_calls; caller returns matching tool results and receives a valid next answer. Check fragmented/parallel calls, IDs/schema/tool_choice and Unicode. AIGate/CLI executes no user tools. Models without support return precise capability errors and do not count as passed tool coverage. |
| 8 | Expiry/refresh | Real supported refresh/remint where available; controlled expired/revoked/rotated token responses, concurrent single-flight and stale-write refusal. Cancel one/all waiters while mint/catalog/rotation is in flight; other callers remain correct and successful rotation persists without resurrecting deleted/replaced credentials. Unknown expiry remains unknown. Account token rejection requires reconnect. Do not fabricate a months-long token-aging test. |
| 9 | Limits/upstream errors | Controlled 429, signature/auth/entitlement denial, quota, timeout, 5xx, bad payload and interrupted body tests, preserving code/stage/Retry-After and retry bounds. Never flood upstream to manufacture a 429; only claim natural live failures actually observed. |
| 10 | Old-provider regression | Existing adapter/OAuth/account/combo/custom-provider/model-import tests plus shared client-protocol and EN/VI checks. New-provider unsafe-replay restrictions do not alter old defaults. Full gate failures are disclosed, not hidden by a narrow rerun. |

Exercise current client lanes: OpenAI Chat, Anthropic Messages, Responses and Gemini clients through existing CIP, including shared error encoding and tool continuation. For **each provider and each of the four client lanes**, record the live 2×2 matrix: text/non-stream, text/stream, tools/non-stream and tools/stream using an enabled tool-capable model where needed. Additionally exercise that matrix for each available upstream family normalization used by Zed; reuse a case where it covers both a client lane and a native family rather than repeating paid calls. Unavailable wire families/models are recorded as untested/unavailable, not accepted from fixtures or capability-refusal tests alone.

Use fake transport/fault injection for unsafe or difficult negative cases, paired with real upstream success-path evidence. Final evidence records provider, official client/protocol version, region, timestamp, operation, sanitized model/org label, outcome, latency and request ID if provided, without raw credential/prompt/tool secrets. If no permitted live account or inference budget is available, mark live acceptance **BLOCKED/NOT RUN**, never complete.

### Validation sequence once implementation is approved

1. Add new unit/adapter/server/web cases to their package test scripts so full `pnpm test` actually runs them. Run new tests first, then surrounding OAuth/model/routing tests. Engine must remain framework-free; source-only UI tests are not sufficient browser acceptance.
2. `pnpm --filter @aigate/engine test`; `pnpm --filter @aigate/server test`; `pnpm --filter @aigate/web test`; database conformance if any storage behavior/schema changes.
3. `pnpm test`, `pnpm build`, `pnpm lint`, `pnpm discovery validate`, `git diff --check`. Record pre-existing failures and parallel-run timeouts honestly; a narrow rerun is not a full-suite pass.
4. Isolated browser acceptance of actual screens/APIs at desktop and 390 px in EN/VI: popup blocked/cancelled, cross-session attempt, account/org confirmation, pending/error/reconnect, import/sync/stale list, explicit paid Test and retry. Remove only task-owned fixtures/processes.
5. Per-provider authorized live checks above, independent security/retry review, regenerate discovery outputs, refresh `/graphify docs --update` and update handoff. Graph root-path churn is not a reason to overwrite unrelated generated changes silently.

## 11. Approval and remaining prerequisites

The user approved **this plan and its gated sequencing** on 2026-10-19. P1-Z/P1-Q public research and static distribution evidence are recorded in the linked report. The next action is to resolve the documented external G1 access/contract inputs, then conduct isolated feasibility within the permitted scope—not immediately expose Connect buttons. Plan approval is not a claim that either provider works or a substitute for vendor access authorization.

Before authenticated live tests we need the upstream-supported/authorized access basis, an appropriately entitled account for each provider, the user's interactive login on the relevant machine, and an explicit minimal inference/tool-test spending limit. Do not paste credentials into the conversation. No paid calls or token extraction will be performed merely because editor tool auto-approve is enabled.

If official direct Qoder access cannot satisfy this scope, present the evidence and the separately reviewed SDK/ACP trade-off for a new decision. Neither removing Qoder nor replacing the requested independent gateway providers with editor-only integration is authorized by default.
