# Graph Report - docs  (2026-09-25)

## Corpus Check
- 17 files · ~43,168 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 568 nodes · 1517 edges · 23 communities
- Extraction: 84% EXTRACTED · 16% INFERRED · 0% AMBIGUOUS · INFERRED: 238 edges (avg confidence: 0.87)
- Token cost: 574,916 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Overview, Traffic & Network Screens|Overview, Traffic & Network Screens]]
- [[_COMMUNITY_Providers, Credentials & Architecture|Providers, Credentials & Architecture]]
- [[_COMMUNITY_Discovery Outputs & Behavioral Questions|Discovery Outputs & Behavioral Questions]]
- [[_COMMUNITY_Error Classification & Parity|Error Classification & Parity]]
- [[_COMMUNITY_API-UI Map & Wiring Rules|API-UI Map & Wiring Rules]]
- [[_COMMUNITY_Connections & Secret Storage (SP11)|Connections & Secret Storage (SP11)]]
- [[_COMMUNITY_Settings Context (SP5)|Settings Context (SP5)]]
- [[_COMMUNITY_SP10 OpenAI Protocol & Translation|SP10 OpenAI Protocol & Translation]]
- [[_COMMUNITY_API Key Validation Rules|API Key Validation Rules]]
- [[_COMMUNITY_Login, Sessions & Lockout (SP6)|Login, Sessions & Lockout (SP6)]]
- [[_COMMUNITY_API Key Management (SP6)|API Key Management (SP6)]]
- [[_COMMUNITY_Capability Resolution & Model Lists|Capability Resolution & Model Lists]]
- [[_COMMUNITY_SP9 Adapter Mapping & Errors|SP9 Adapter Mapping & Errors]]
- [[_COMMUNITY_Integrations & CLI Tooling|Integrations & CLI Tooling]]
- [[_COMMUNITY_Transient Retry & Direct Transport|Transient Retry & Direct Transport]]
- [[_COMMUNITY_Chat API v1 & Endpoint Screen|Chat API /v1 & Endpoint Screen]]
- [[_COMMUNITY_Identity, SSO & Tracing Protocol|Identity, SSO & Tracing Protocol]]
- [[_COMMUNITY_First-run Setup & Onboarding|First-run Setup & Onboarding]]
- [[_COMMUNITY_UI Transport Error Codes|UI Transport Error Codes]]
- [[_COMMUNITY_M1 Walking Skeleton Steps|M1 Walking Skeleton Steps]]
- [[_COMMUNITY_Latency & Bounded Workloads|Latency & Bounded Workloads]]
- [[_COMMUNITY_Bounded Retry & Lint Enforcement|Bounded Retry & Lint Enforcement]]
- [[_COMMUNITY_Lean Code Rules|Lean Code Rules]]

## God Nodes (most connected - your core abstractions)
1. `Identity and API keys contract (M1 SP6)` - 37 edges
2. `Bounded context: routing (core)` - 35 edges
3. `Feature Matrix — mandatory 17-column artifact` - 27 edges
4. `Milestone M-1 · Discovery` - 27 edges
5. `Bounded context: connections` - 26 edges
6. `The 23 feature groups required by behavioral.md §5` - 26 edges
7. `SP6 — identity + apikeys (password login + key validation only)` - 25 edges
8. `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` - 23 edges
9. `Overview — /` - 22 edges
10. `Settings contract (M1 SP5)` - 22 edges

## Surprising Connections (you probably didn't know these)
- `identity.machine-id-derivation` --conceptually_related_to--> `Bounded context: identity`  [INFERRED]
  docs/contracts/identity-apikeys.md → docs/superpowers/specs/2026-09-22-aigate-design.md
- `TransportModule (injects DirectTransport under HTTP_TRANSPORT)` --implements--> `Bounded context: transport`  [INFERRED]
  docs/contracts/transport.md → docs/superpowers/specs/2026-09-22-aigate-design.md
- `ErrorCode: TIMEOUT` --conceptually_related_to--> `UI error code: TIMEOUT`  [AMBIGUOUS]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/API_UI_MAP.md
- `Decision (user, 2026-09-25): onboarding is one step (set password, open dashboard)` --references--> `Onboarding — /welcome`  [INFERRED]
  docs/PROGRESS_HANDOFF.md → docs/superpowers/specs/2026-09-22-aigate-design.md
- `Feature group — MCP (API with no UI, found during spec work)` --conceptually_related_to--> `The 23 feature groups required by behavioral.md §5`  [AMBIGUOUS]
  docs/superpowers/plans/2026-09-22-m1-discovery.md → docs/governance/behavioral.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **CIP request flow: ProtocolAdapter(in) → CanonicalRequest → RoutingEngine → ProviderAdapter → Vendor** — concept_cip, ctx_routing, port_ai_provider, port_http_transport, concept_vendor_extensions [EXTRACTED 1.00]
- **M1 walking skeleton — one streaming chat completion end to end** — ms_m1, sp_sp5, sp_sp6, sp_sp7, sp_sp8, sp_sp9, sp_sp10, sp_sp11, sp_sp12, parity_tier1_client_contract, parity_tier2_vendor_acceptance [EXTRACTED 1.00]
- **Overview screen aggregates data 9router scattered across three places** — screen_overview, entity_account_lock, ctx_connections, ctx_usage, group_quota_tracker, sp_u8 [EXTRACTED 1.00]
- **Discovery pipeline: inventory + matrix validation → coverage → capabilities** — tool_inventory, tool_validate, tool_coverage, tool_capabilities, tool_cli, artifact_capabilities_md [EXTRACTED 1.00]
- **M-1 exit gate: matrix valid, 23 groups, every route and repo cited** — task_19_exit_gate, tool_gate_test, concept_23_feature_groups, artifact_capabilities_md, artifact_coverage_md, artifact_gaps_md [EXTRACTED 1.00]
- **Tracing protocol labelling and evidence discipline** — concept_tracing_protocol, label_reference_behavior, label_suspected_bug, label_implementation_accident, concept_suspicion_block, concept_evidence_file_line, concept_parity_status [EXTRACTED 1.00]
- **Screens sharing the list/detail (master-detail) pattern** — screen_llm_providers, screen_provider_detail, screen_requests, screen_request_detail, screen_cli_tools, screen_cli_tool_detail, screen_media_providers, screen_routing_fallback [EXTRACTED 1.00]
- **The three required states contract that U0 must implement across every lane** — ds_state_loading, ds_state_empty, ds_state_error, sp_u0, audit_happy_path_only [EXTRACTED 1.00]
- **The seven nav groups forming the identical sidebar shell owned by U1** — nav_group_overview, nav_group_gateway, nav_group_providers, nav_group_traffic, nav_group_network, nav_group_integrations, nav_group_settings, ds_sidebar_nav, sp_u1 [EXTRACTED 1.00]
- **Dashboard auth flow (status → setup/login → session → logout/password change)** — api_ui_map_get_api_auth_status, api_ui_map_post_api_auth_setup, api_ui_map_post_api_auth_login, api_ui_map_post_api_auth_logout, api_ui_map_post_api_auth_password, api_ui_map_screen_shell_gate, api_ui_map_screen_welcome_onboarding, api_ui_map_screen_login, api_ui_map_screen_settings_auth, identity_apikeys_session_store [EXTRACTED 1.00]
- **API key lifecycle (create once, list masked, enable/disable, revoke, validate for /v1)** — api_ui_map_get_api_keys, api_ui_map_post_api_keys, api_ui_map_patch_api_keys_id, api_ui_map_delete_api_keys_id, api_ui_map_screen_endpoint_keys, identity_apikeys_api_key_format, identity_apikeys_is_valid, identity_apikeys_extract_api_key [EXTRACTED 1.00]
- **UI error pipeline (ApiError → toProblem → toast/inline/redirect)** — api_ui_map_shared_api_client, api_ui_map_to_problem, api_ui_map_errors_test, ui_handoff_use_toast, api_ui_map_err_unauthenticated, api_ui_map_screen_shell_gate, api_ui_map_rule_failed_mutation_rereads [EXTRACTED 1.00]
- **SP8 transport stack: port, direct implementation, module, bounded reader** — port_http_transport, transport_direct_transport, transport_module, transport_read_bounded_text, transport_http_request, transport_http_response [EXTRACTED 1.00]
- **Deferred SP0.1 rules enforced in lint by SP8** — lint_fetch_through_transport, lint_retry_through_helper, lint_fetch_timeout, lint_check_tests, sp_sp0_1 [EXTRACTED 1.00]
- **SP9 adapter flow: AIProviderPort over HttpTransportPort with status classification and bounded retry** — sp_sp9, port_ai_provider, port_http_transport, sp9_status_classification, engine_with_retry, transport_fail_http_status [INFERRED 0.85]
- **SP9 adapter failure path: classify, retry transient, fail partial streams** — adapter_status_classification, adapter_retry_transient, adapter_partial_stream_error, engine_fallback_policy_data, engine_with_retry [EXTRACTED 1.00]
- **SP10 round trip: parse → CIP → provider adapter → render / encode** — protocol_parse_openai_chat, concept_cip, adapter_openai_compatible, protocol_completion_renderer, protocol_stream_encoder [EXTRACTED 1.00]
- **SP11 test flow: UI Test → controller → decrypt → validateCredential → guarded write → toast** — web_test_result, connections_controller, secret_cipher_aes_gcm, adapter_validate_credential, connections_stale_test_guard [EXTRACTED 1.00]

## Communities (23 total, 0 thin omitted)

### Community 0 - "Overview, Traffic & Network Screens"
Cohesion: 0.06
Nodes (83): GET /overview/summary, SSE /events/requests, /traffic/console → Console (Developer mode only), /network/* → ProxyPools, DeployWizard, Tunnel, Mitm, / → Overview, /traffic/usage, /traffic/requests* → Usage, Requests, RequestDetail, Audit finding: Console shown in sidebar regardless of Developer mode, Audit PASS: no credential leaked across 27 HTML exports (+75 more)

### Community 1 - "Providers, Credentials & Architecture"
Cohesion: 0.07
Nodes (81): validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, /providers/media* → MediaProviders, /providers/quota → Quota; custom provider form; multi-account, /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver, docs/discovery/gaps.md (Gap register), §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra), §9 Build an explicit domain model (Provider, Quota, RoutingPolicy…), §5 Feature discovery — inventory every group, do not trust the UI menu (+73 more)

### Community 2 - "Discovery Outputs & Behavioral Questions"
Cohesion: 0.07
Nodes (54): docs/capabilities.md (GENERATED capability specification), docs/discovery/coverage.md, docs/discovery/inventory.json, §30 The 12 pre-implementation questions, §3 The 20 behavioral questions (trigger…edge cases), §8 Business rule beats old implementation, §2 Core principles — never port, rename, or translate 9router line by line, §29 Definition of Done — 13 checklist items, no self-declared DONE (+46 more)

### Community 3 - "Error Classification & Parity"
Cohesion: 0.06
Nodes (44): fallback.error-classification, Status → ErrorCode by status + error.code/type only (never message text), API_UI_MAP row: SP8 transport, No UI, 9router as Behavioral Source of Truth (not a template to port), Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Definition of Done — 13 items, not self-awarded, AIGate domain model (Provider, Credential, RoutingPolicy, AccountLock, …) (+36 more)

### Community 4 - "API-UI Map & Wiring Rules"
Cohesion: 0.09
Nodes (36): usage.write-not-synchronous, API ↔ UI map (docs/design/API_UI_MAP.md), GET /health, docs/PROJECT_MAP.md (generated U-project ownership map), Rule: an API is done only when its UI screen is wired in the same SP, Failed mutations re-read the server; submit disabled while pending, Feature-based frontend structure with import boundaries, Hexagonal architecture, granularity = bounded context (+28 more)

### Community 5 - "Connections & Secret Storage (SP11)"
Cohesion: 0.10
Nodes (32): catalog.connection-detail-crud, catalog.connection-listing, connection.client-listing-sanitized, connection.test-single-connection, connection.create-dedup-and-priority-assignment, connection.delete-and-reorder, connection.storage-shape-json-blob, DELETE /api/connections/:id (+24 more)

### Community 6 - "Settings Context (SP5)"
Cohesion: 0.17
Nodes (24): endpoint.enforce-require-api-key, settings.combo-rotation-reset, settings.database-export-import, settings.defaults-and-merge, settings.get-secret-stripping, settings.hot-path-read-no-cache, settings.outbound-proxy-live-apply, settings.patch-protected-keys (+16 more)

### Community 7 - "SP10 OpenAI Protocol & Translation"
Cohesion: 0.14
Nodes (20): fallback.partial-stream-failure, routing.request-translation, routing.source-format-detection, routing.stream-mode-decision, translator.pivot-loss, translator.tool-id-normalization, Truncated stream or error event → PROVIDER_UNAVAILABLE with details.partial, Golden scenario: partial stream failure (+12 more)

### Community 8 - "API Key Validation Rules"
Cohesion: 0.15
Nodes (19): apikey.delete-key, apikey.legacy-format-unenforced, apikey.list-keys, apikey.update-key-status, apikey.validate-lookup, endpoint.rewrite-lanes, identity.auth-status-disclosure, identity.machine-id-derivation (+11 more)

### Community 9 - "Login, Sessions & Lockout (SP6)"
Cohesion: 0.20
Nodes (19): identity.password-login-lockout, identity.session-cookie-lifecycle, UI error code: INVALID_CREDENTIALS (401), UI error code: INVALID_REQUEST (400), UI error code: RATE_LIMITED (429), UI error code: SETUP_REQUIRED (409), useChangePassword (features/settings/api.ts), useLogin (features/settings/api.ts) (+11 more)

### Community 10 - "API Key Management (SP6)"
Cohesion: 0.22
Nodes (18): apikey.generate-key, DELETE /api/keys/:id, UI error code: NOT_FOUND (404), UI error code: UNAUTHENTICATED (401), GET /api/keys, useApiKeys (features/gateway/api.ts), useCreateKey (features/gateway/api.ts), useDeleteKey (features/gateway/api.ts) (+10 more)

### Community 11 - "Capability Resolution & Model Lists"
Cohesion: 0.21
Nodes (17): catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, combo.detect-required-capabilities, ListedModel { id, descriptor? } — getModels never invents limits (≤1000 ids), API_UI_MAP row: SP7 packages/engine, No UI, Rule: an SP with no HTTP API records "No UI" in its row (+9 more)

### Community 12 - "SP9 Adapter Mapping & Errors"
Cohesion: 0.17
Nodes (16): fallback.upstream-error-result, routing.default-executor-openai-fallback, routing.non-streaming-response, routing.streaming-pipeline, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O, OpenAICompatibleAdapter (AIProviderPort for openai-compatible), readSseData() — bounded SSE reader (1 Mi chars per line/event, cancels body) (+8 more)

### Community 13 - "Integrations & CLI Tooling"
Cohesion: 0.32
Nodes (16): /integrations/* → CliTools, CliToolDetail, Skills, Mcp, CLI-tool config writes require diff preview + backup, Bounded context: tooling, Feature group: CLI Tools, Feature group: Console Log, Feature group — MCP (API with no UI, found during spec work), Feature group: Skills, 12-integrations.yaml (+8 more)

### Community 14 - "Transient Retry & Direct Transport"
Cohesion: 0.16
Nodes (15): fallback.executor-retry-budget, transport.test.mjs: adapter streams end to end over DirectTransport, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, ErrorCode: PROVIDER_UNAVAILABLE, Golden scenario: all providers unavailable, DirectTransport (direct branch implementation), Upstream answers 4xx or 5xx, Failure: connection refused, DNS failure, TLS failure (+7 more)

### Community 15 - "Chat API /v1 & Endpoint Screen"
Cohesion: 0.20
Nodes (14): endpoint.extract-header-order, transport.proxy-priority-chain, API_UI_MAP row: SP10 OpenAI Chat protocol, No UI, /gateway/endpoint base URL pill ("Chat API pending"), POST /v1/chat/completions (/v1 Chat API), ExecCtx (one shared client-cancel + deadline signal), Golden scenario: client cancellation, extractApiKey() (Authorization: Bearer first, then x-api-key) (+6 more)

### Community 16 - "Identity, SSO & Tracing Protocol"
Cohesion: 0.27
Nodes (13): /settings/auth OIDC and SAML tabs, Audit finding: login-callback / deploy-wizard / authflow-modals are showcases, not routes, §27 Separate BUSINESS REQUIREMENT from IMPLEMENTATION ACCIDENT, §7 Trace the behavior — never conclude from a function name, The Tracing Protocol (6 steps, applied by Tasks 6–18), Bounded context: identity, IMPLEMENTATION_ACCIDENT label, Auth — /login, /callback (+5 more)

### Community 17 - "First-run Setup & Onboarding"
Cohesion: 0.26
Nodes (12): UI error code: ALREADY_SET_UP (409), UI error code: NOT_LOCAL (403), useSetup (features/settings/api.ts), POST /api/auth/setup, /welcome → Onboarding (one step), AIGATE_INITIAL_PASSWORD (first password at boot), Decision 2 (user, 2026-09-25): first password set from the local machine; no default password, Decision 4 (user, 2026-09-25): requireLogin = false exempts local clients only (+4 more)

### Community 18 - "UI Transport Error Codes"
Cohesion: 0.29
Nodes (11): UI error code: BAD_RESPONSE, UI error code: HTTP_5xx, UI error code: LIMIT_REACHED (409), UI error code: NETWORK_ERROR, UI error code: any other code (fallback), UI error code: TIMEOUT, shared/errors.test.mjs, useAuthStatus (features/settings/api.ts) (+3 more)

### Community 19 - "M1 Walking Skeleton Steps"
Cohesion: 0.43
Nodes (7): API_UI_MAP row: SP9 OpenAICompatibleAdapter, No UI, Milestone M1 · Walking skeleton (thin end-to-end slice), HttpTransportPort, Next step: M1 SP8 transport (HttpTransportPort, direct + timeout, no UI), SP8 — transport: HttpTransportPort (direct + timeout only), SP9 — engine: OpenAI-compatible provider adapter, Transport contract (M1 SP8)

### Community 20 - "Latency & Bounded Workloads"
Cohesion: 0.29
Nodes (7): §17 Latency — clean architecture must not add hot-path I/O, §16 Do not inherit performance issues; all large workloads bounded, Constraint — every filesystem scan uses fast-glob with an explicit ignore list, Rule 4 — Every workload must be BOUNDED, Rule 11 — Review questions beyond "does it run?" (10x/100x traffic, unbounded work), Rule 5 — Low latency: parallelize independent awaits, only when bounded, Rule 3 — Optimize performance at design time, not micro-optimization

### Community 21 - "Bounded Retry & Lint Enforcement"
Cohesion: 0.53
Nodes (6): withRetry() — bounded retry helper (≤10 attempts, capped backoff, abortable), tools/lint/check.test.mjs (lint:check 13/13), Lint rule aigate/fetch-through-transport, Lint rule aigate/fetch-timeout (accepts AbortSignal.any([..., AbortSignal.timeout(n)])), Lint rule aigate/retry-through-helper, SP0.1 — Mechanical lint/CI suite (§11.2)

### Community 22 - "Lean Code Rules"
Cohesion: 0.50
Nodes (4): §15 Code quality — shortest CLEAR implementation, not shortest possible, Rule 1 — Write LEAN code, no over-engineering, Rule 2 — Code must be maintainable, no magic values or hidden side effects, Rule 12 — Priority order: Correctness → Simplicity → Maintainability → Predictable resources → Latency → Throughput → Optimization

## Ambiguous Edges - Review These
- `ErrorCode: TIMEOUT` → `UI error code: TIMEOUT`  [AMBIGUOUS]
  docs/design/API_UI_MAP.md · relation: conceptually_related_to
- `Token Saver — /gateway/token-saver` → `U6 — Routing & Fallback + Simulator`  [AMBIGUOUS]
  docs/superpowers/specs/2026-09-22-aigate-design.md · relation: implements
- `U6 — Routing & Fallback + Simulator` → `GAP: Token Saver screen missing from the U0–U11 table`  [AMBIGUOUS]
  docs/superpowers/specs/2026-09-22-aigate-design.md · relation: references
- `The 23 feature groups required by behavioral.md §5` → `Feature group — MCP (API with no UI, found during spec work)`  [AMBIGUOUS]
  docs/superpowers/plans/2026-09-22-m1-discovery.md · relation: conceptually_related_to
- `Open decision (user confirmation pending): scan every message + system prompt for required capabilities` → `detectRequiredCapabilities()`  [AMBIGUOUS]
  docs/contracts/engine.md · relation: rationale_for

## Knowledge Gaps
- **19 isolated node(s):** `ErrorCode: INTERNAL_ERROR`, `Parity tier 2 — Vendor acceptance (PASS/FAIL)`, `Parity tier 3 — Upstream shape drift (warning only)`, `Golden scenario: normal completion`, `Golden scenario: stream completion` (+14 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `ErrorCode: TIMEOUT` and `UI error code: TIMEOUT`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Token Saver — /gateway/token-saver` and `U6 — Routing & Fallback + Simulator`?**
  _Edge tagged AMBIGUOUS (relation: implements) - confidence is low._
- **What is the exact relationship between `U6 — Routing & Fallback + Simulator` and `GAP: Token Saver screen missing from the U0–U11 table`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `The 23 feature groups required by behavioral.md §5` and `Feature group — MCP (API with no UI, found during spec work)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Open decision (user confirmation pending): scan every message + system prompt for required capabilities` and `detectRequiredCapabilities()`?**
  _Edge tagged AMBIGUOUS (relation: rationale_for) - confidence is low._
- **Why does `Bounded context: routing (core)` connect `Providers, Credentials & Architecture` to `Overview, Traffic & Network Screens`, `Discovery Outputs & Behavioral Questions`, `Error Classification & Parity`, `Settings Context (SP5)`, `SP10 OpenAI Protocol & Translation`, `API Key Validation Rules`, `Capability Resolution & Model Lists`, `Chat API /v1 & Endpoint Screen`, `Identity, SSO & Tracing Protocol`, `M1 Walking Skeleton Steps`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **Why does `Milestone M-1 · Discovery` connect `Discovery Outputs & Behavioral Questions` to `Overview, Traffic & Network Screens`, `Providers, Credentials & Architecture`, `Error Classification & Parity`, `API-UI Map & Wiring Rules`, `Settings Context (SP5)`, `Integrations & CLI Tooling`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._