# Zed / Qoder International — P1 access and protocol evidence

Date: 2026-10-19

Plan: [approved implementation plan](../../plans/plan_2026-10-19_zed-qoder.md).

## Status and decision

The user approved starting the gated plan with “hãy bắt đầu”. G0 is passed. This report records actual P1 work, **not completed providers**.

- **Zed:** focused official-source/documentation review completed; a designated third-party access basis remains unresolved. G1 is open, G2/live acceptance not run.
- **Qoder International:** focused official-documentation review and integrity-verified static inspection of the official distribution completed. New current-client evidence materially changes the older reference assumptions. Third-party direct-access permission, full catalog/tool/stream contracts and truthful client identity remain unresolved. G1 is open, G2/live acceptance not run.
- Qoder is **not excluded again**. Neither provider is declared technically impossible. No runtime descriptor/adapter/UI is enabled from this research.

No credentials were read from the host, no sign-in was initiated, no inference was requested, no vendor was contacted, no package/installer/postinstall code was executed, and no project dependency or lockfile was changed. Initial reachability observations from the planning session remain in plan §2.1; they were not repeated as private-endpoint probes in P1.

## 1. Method and limits

Independent bounded reviews covered Zed official access documentation (six focused searches, four official pages) and Qoder supported direct-integration documentation (eight focused searches, six fetch attempts, including one third-party 404). Parent work checked official installation/package documentation and registry metadata, then statically inspected two pinned package archives. Searches not finding a contract do not prove that no contract exists.

The Qoder official installation documentation links the npm scope; that establishes distribution provenance better than a third-party package name alone. Downloaded bytes were checked against the exact registry-published SHA-512 integrity value **before** inspection. This verifies registry-content integrity, not a separately verified publisher signature or service-access authorization.

Safety bounds used for static package work:

- HTTPS certificate validation; no redirect following; 5-second connect timeout.
- CLI download: at most 32 MiB and 60 seconds; SDK: at most 2 MiB and 30 seconds.
- Gzip decoded caps: CLI 80 MiB, SDK 2 MiB; at most 600 tar entries, validated entry lengths.
- Archive members read in memory, never extracted into an executable installation. No `npm install`, postinstall, imports/eval of downloaded JS, or CLI execution.
- Only short relevant literal/context windows were printed. No obfuscated strings were decoded, signing module executed, embedded secret extracted, or TLS interception performed.
- Task-owned archives/manifests were kept in `.tmp-qoder-protocol-20261019` only during inspection, then removed. The pinned URLs/hashes/observations below are the retained evidence; no vendor source is added to AIGate.

## 2. P1-Z — official access review

### Official evidence

| Source | Relevant published behavior | Interpretation boundary |
|---|---|---|
| [Terms](https://zed.dev/terms), last updated 2026-03-02, §2.2 | Access only through mechanisms designated by Zed. | Native editor source shows the editor's mechanism, not designation of arbitrary external clients. |
| Same Terms §2.4 | Restrictions include seeking access to non-public APIs and providing/distributing service access to third parties. | Need a supported access basis for the intended same-user local gateway and distribution model. This report is not legal advice or a determination of breach. |
| [Use an Existing Subscription](https://zed.dev/docs/ai/use-an-existing-subscription) | Zed Pro/Business/Student maps to Zed-hosted models; the feature table says No for External Agent via ACP and Terminal Thread. | Does not document exporting Zed-hosted entitlement to other apps; the table alone is not a universal prohibition on all external clients. |
| [External Agents](https://zed.dev/docs/ai/external-agents) | External agents run through their own process/provider relationship; billing/legal/data handling are with that provider. | ACP integration into the editor is not access to Zed-hosted inference. |
| [Use a Gateway](https://zed.dev/docs/ai/use-a-gateway.md), search-indexed directionality | Routes Zed AI features through an external gateway such as OpenRouter. | This is Zed → gateway, not gateway → Zed-hosted models. Not evidence for the requested provider. |

The earlier pinned official-source protocol findings remain valid: commit `56934ec0560bce8929025497411de7f5322fb6ca`; RSA callback, account/LLM token distinction, organization-bound models and native-family NDJSON completions. They do not answer the access question.

**Result:** no explicit applicable public inference API, external-client registration or vendor authorization was established in this review. Do not initiate authenticated cloud probes until G1 is resolved. Do not describe this as a failed OAuth/chat test; none was attempted.

### Prepared vendor clarification — not sent

> We are developing AIGate, a local gateway. May an independently identified third-party application let each user authenticate their own Zed account through `/native_app_signin` using its own RSA key and loopback callback, retain that user's credentials locally, call `/client/users/me` and `/client/llm_tokens`, and use `/models` and `/completions` to serve that same user's other local applications?
>
> Is this designated access under Terms §2.2 and permitted under §2.4? Please distinguish personal/internal same-user use from distributing gateway software; there would be no account sharing, resale or access-protection bypass. If permitted, what supported API or external-client registration, truthful client-identification/compatibility headers, token lifecycle, organization scope, billing and usage limits apply? May we perform bounded authenticated feasibility tests?

The operator may already have an applicable agreement/addendum; if so, the relevant scope/restrictions can resolve this question without a new vendor exchange. **No credentials are needed in chat.**

## 3. P1-Q — documented supported integration surface

Official sources:

- [CLI authentication](https://docs.qoder.com/cli/authentication): proprietary browser sign-in and automatic token refresh. Do not infer no-refresh from the old reference's error.
- [SDK authentication](https://docs.qoder.com/cli/sdk/authentication): local `qodercliAuth()` is documented for developer workstations, not stateless CI/production; PAT/SAT are separate methods. SAT example scopes include `models.read chat.completions`, indicating an inference capability exists, but not establishing the browser-token gateway contract.
- [SDK architecture](https://docs.qoder.com/cli/sdk/how-it-works): CLI subprocess owns model requests, conversation/agent loop and approved tool execution.
- [Installation](https://docs.qoder.com/cli/installation): official legacy npm package is `@qoder-ai/qodercli`; recommended native installation is a separate distribution. Neither was installed.
- [SDK overview](https://docs.qoder.com/cli/sdk/overview): SDK is an embeddable agent runtime, not a raw HTTP inference library.
- [Cloud Agents authentication](https://docs.qoder.com/cloud-agents/api/conventions/authentication): public API uses PAT/SAT on `api.qoder.com`; not proof that device/browser tokens apply to that product.
- [Forward Mode](https://docs.qoder.com/cloud-agents/api/forward/overview): managed agent delivery using templates/identities, not a transparent model proxy by virtue of the word “Forward”.

[Qoder Terms](https://qoder.com/product-service), updated 2026-04-29, address individual account use (§2.3), protection/authentication bypass (§3.2.6), software analysis/modification restrictions (§3.2.8–3.2.10), service use (§4.2) and open-source license rights (§16.9). The CLI archive carries an Apache-2.0 LICENSE; the SDK LICENSE points to product terms. Neither artifact's license establishes rights to backend inference. Do not conflate reading distributed source, permission to redistribute SDK code, and service access. Further protocol work should use vendor-supported documentation/fixtures and resolve applicable permissions rather than decode protected implementation details. No legal conclusion is made here.

### 3.1 Pinned official package evidence

Registry metadata consulted at the official npm registry on 2026-10-19; inspection used the exact versions below, not a floating `latest` install.

| Item | Official CLI | Official TypeScript SDK |
|---|---|---|
| Package | `@qoder-ai/qodercli@1.1.73` | `@qoder-ai/qoder-agent-sdk@1.0.53` |
| Archive | [qodercli-1.1.73.tgz](https://registry.npmjs.org/@qoder-ai/qodercli/-/qodercli-1.1.73.tgz) | [qoder-agent-sdk-1.0.53.tgz](https://registry.npmjs.org/@qoder-ai/qoder-agent-sdk/-/qoder-agent-sdk-1.0.53.tgz) |
| Compressed bytes observed | 30,842,140 | 173,945 |
| Decoded tar bytes | 70,249,472 | 704,000 |
| Archive entries | 222 | 102 |
| SHA-256 computed | `76bed33e16861809574feb5973ed1feea692f2f613cfbeb0bd03ed77adcf6d0f` | `b3eca4c48803dfa501bc7929b5aba553b932ea113631e3bb0e4dd0767e21e8c8` |
| Published SHA-512 matched | `sha512-OdmmSppZUAZWL5ZEEORV5BNplXgAaa5cFMXnmNPStvIlknJ1fiyykgY6AjsP1t7OgWuVlh76vDK8lpbPNRlmBQ==` | `sha512-Ws290e5QDC5QsvA5wCjDdMLNZwZPRUXjtk9SQ6VdFX0L1x7DrdC983+hYeEb1uJSCt53FA1E2ISA3OWhaBH4wQ==` |
| Declared install script | `node postinstall.cjs` — **not run** | `node scripts/postinstall.cjs` — **not run** |
| Relevant version caveat | Actual npm CLI bundle inspected | Metadata pins compatible CLI `1.1.71`; not automatically equivalent to separately inspected `1.1.73` |

CLI observations below are from `package/bundle/qodercli.js`, 34,278,604 archive-member bytes, read as UTF-8. Locations are **zero-based UTF-16 string offsets after decoding**, not byte offsets, line numbers or stable identifiers across releases. Search literals plus the pinned archive hash identify the observations. Minified local variable/function names are not part of the desired AIGate design.

### 3.2 Important new official-distribution findings

| Finding | Observed location/context | What remains unproven |
|---|---|---|
| New International model host | Literal `api2-v2.qoder.sh` at offset 25,264 is the production International model-server choice; separate api3/center/openapi and nonproduction/region choices exist. | Permitted third-party use, account entitlements and exact required headers. Do not copy test/daily/CN hosts into this slice. |
| New text inference route | `/model/v1/chat/completions` appears in URL construction around 19,003,812 and a native model-server stream method around 33,964,518. That method requests Bearer auth, JSON body and `Accept: text/event-stream`. | Global pipeline middleware may still add identity/signing behavior. This is **not proof that Bearer alone suffices** or that the endpoint is a documented public API. |
| Device poll | `/api/v1/deviceToken/poll`; observed query includes nonce, verifier and `challenge_method`. Browser entry includes S256 challenge, nonce, machine ID and a **client ID**; optional machine token also exists. | Registering a truthful independent client; allowed machine identity fields; direct-flow authorization; complete denial/expiry response contract. Do not reuse an obfuscated official-client ID as AIGate's identity. |
| Device refresh | `/api/v1/deviceToken/refresh` at 18,872,548 and 33,957,533; POST JSON with `refresh_token` and machine identity fields. Response parsing includes `device_token`, `refresh_token`, `expires_at`, `refresh_token_expires_at`. | Current live schema, exact date/expiry semantics, rotation and revocation, machine binding and third-party use. Do not invent missing expiry or replay uncertain rotation. |
| Alternative native response parser | New identity pipeline accepts several token/identity field spellings and both absolute/relative expiry hints on poll. | These permissive client fallbacks are not proof of all server variants; do not copy zero/default validity into a gateway token lifetime. |
| New-route stream | Model-server method sends model/messages, `stream:true`, usage option and optional purpose metadata. It processes SSE, `[DONE]`, notifications and error events. | Successful client-owned tools, nonstream upstream support, exact terminal/error precedence, usage and all fragment variants. The observed narrow method does not by itself prove tools are unsupported elsewhere. |
| Distinct older signed agent path | A separate remote-chat method around 33,965,000 attaches `withWasmInferSigningMeta` with model key/source. | The older signed agent protocol and newer model route must not be conflated. Signing requirements for one cannot be asserted for the other without a complete contract. No signing module was executed. |
| Attribution headers | Literal `Cosy-Version`, `Cosy-ClientType`, `Cosy-MachineOS` appear in shared request preparation. | Which are mandatory, which values identify an independent app truthfully, and whether registration is required. No hardcoded CLI-version/machine/access impersonation is approved. |
| Live catalog | This bounded inspection did not establish a supported live catalog contract for the newer route. | Lack of a plain literal in a partly obfuscated bundle is not proof that no catalog endpoint exists. Must still meet the real model-import requirement. |

### 3.3 How this changes the plan

1. The old reference's encoded `/algo/.../agent_chat_generation` transport is **not established as the only current route**. Do not port its WAF-labeled encoder or impose its signing design on the newer endpoint.
2. Device refresh is now corroborated by official docs **and current official distribution** at a different route than the old reference's refresh candidate. Do not implement the old route by default or declare device tokens unrefreshable.
3. The original unsigned api3 model-list `403 / 101 / Signature invalid` pertains to that exact older endpoint. It cannot prove that the newer api2-v2 inference route needs that signature, is WAF-blocked, or is unusable.
4. The current bundle is evidence of official-client behavior, not full public API documentation, third-party authorization or a live test. **G1/G2 are still not passed.**
5. First-release requirements remain unchanged. A static/sample model list, text-only route, or SDK running tools locally does not satisfy models/tool-calling acceptance.

A third-party migration [commit](https://github.com/apmantza/pi-free/commit/0874bcd48d606493a4ffc81894be1ca2bf4de1e8) first supplied the newer-host lead; it explicitly removed an encoder and retained static models. Its behavior was not adopted as the native contract. An indexed third-party issue claimed newer device-refresh/inference routes but fetching it returned 404; the official archive inspection, not that unavailable issue, corroborates the route observations above.

### Prepared Qoder clarification — not sent

> We are developing AIGate, an independently identified same-user local model gateway for Qoder International. We want users to sign in through a supported browser/device flow, store credentials securely on their own host, refresh them correctly, import their actual enabled models, and send text/tool requests without Qoder CLI executing tools.
>
> 1. Is direct use of browser/device credentials by this gateway supported? Is external-client registration required, and what client ID and machine/attribution headers may AIGate truthfully use? Please distinguish internal personal use from distributing the gateway software; there is no account sharing, resale, fee avoidance or protection bypass.
> 2. Is `https://api2-v2.qoder.sh/model/v1/chat/completions` a supported interface for that use? Which credential types/scopes does it accept? Please provide the supported model-list and inference schemas, client-owned tools/tool-result continuation, streaming terminal/error/usage semantics, and nonstream behavior.
> 3. Please provide the supported browser entry/poll/identity/refresh contract. Is `https://openapi.qoder.sh/api/v1/deviceToken/refresh` current for browser/device tokens? What are expiry formats, rotation/revocation and machine/region binding? How does it differ from the older `/algo/api/v3/user/refresh_token` path?
> 4. Which endpoints require signing, encryption or encoding? Please supply supported canonical serialization, algorithms, public key/key-version information and deterministic test vectors. Is a documented unencoded direct inference interface available? We will not implement WAF evasion, spoofed entitlement or protection bypass.
> 5. May we perform bounded authenticated feasibility tests, and what quotas, billing and client-version compatibility policy apply?

The official [terms/contact page](https://qoder.com/product-service) lists `contact@qoder.com`. This report prepares the request only; it does not send correspondence or assert vendor approval.

## 4. Exact remaining prerequisites and next actions

| Provider | Next required evidence | After that evidence |
|---|---|---|
| Zed | Applicable supported-access documentation, operator agreement or vendor confirmation for the proposed independent local gateway. | Close G1 only within granted scope; authorized account login and explicit minimal inference/tool budget for G2. |
| Qoder International | Supported third-party browser/device client identification and newer direct-route/capability/catalog/refresh contract; permission/fixtures for any required signing. | Verify canonical requests and lifecycle; bounded authorized account tests for G2, including real model import and caller-owned tools. |

The operator should supply the applicable authorization/documentation **without tokens or account secrets**. If none exists yet, send the prepared vendor questions through the operator's support channel. These external answers cannot be manufactured by an unauthenticated HTTP probe.

A separately reviewed official SDK/local-session spike remains an alternative if direct access cannot be supported. It is not started automatically and is not a silent replacement for browser/device gateway authentication or caller-owned tool semantics. PAT/SAT, CN and images remain backlog.

## 5. Validation and completion boundaries

Executed in this P1 round:

- Official package downloads completed within size/time bounds.
- Both SHA-512 integrity comparisons passed; SHA-256/archive sizes/entry counts recorded above.
- Bounded static checks corroborated newer host, inference/poll/refresh paths, identity headers and separation of model-server versus signed agent methods.
- Source/documentation review distinguishes wire evidence, policy questions, exact tested failures and untested hypotheses.
- Discovery validation and whitespace checks are recorded in the handoff after final edits.

Not executed: installation/CLI `--help`/SDK initialization, login, credential persistence/load, refresh against upstream, live catalog, connection Test, generation/tools/streaming, provider regression/build/browser acceptance. There is no new product code to validate. No feature is marked implemented/verified, and no UI/mock result is used as acceptance.
