# Graph Report - docs  (2026-09-25)

## Corpus Check
- 14 files · ~37,720 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 498 nodes · 1370 edges · 22 communities
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 232 edges (avg confidence: 0.87)
- Token cost: 574,916 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Overview, Usage & Console Screens|Overview, Usage & Console Screens]]
- [[_COMMUNITY_Engine Capabilities & API-UI Map|Engine Capabilities & API-UI Map]]
- [[_COMMUNITY_Discovery Outputs & Behavioral Questions|Discovery Outputs & Behavioral Questions]]
- [[_COMMUNITY_Providers, Media & Architecture|Providers, Media & Architecture]]
- [[_COMMUNITY_Routing, Fallback & Gaps|Routing, Fallback & Gaps]]
- [[_COMMUNITY_API Key Validation Rules|API Key Validation Rules]]
- [[_COMMUNITY_API Key Management (SP6)|API Key Management (SP6)]]
- [[_COMMUNITY_Login, Sessions & Lockout (SP6)|Login, Sessions & Lockout (SP6)]]
- [[_COMMUNITY_Settings Context (SP5)|Settings Context (SP5)]]
- [[_COMMUNITY_Integrations & CLI Tooling|Integrations & CLI Tooling]]
- [[_COMMUNITY_Settings General & Stitch Audit|Settings General & Stitch Audit]]
- [[_COMMUNITY_Transport Direct Branch (SP8)|Transport Direct Branch (SP8)]]
- [[_COMMUNITY_Chat API v1 & Endpoint Screen|Chat API /v1 & Endpoint Screen]]
- [[_COMMUNITY_UI Transport Error Codes|UI Transport Error Codes]]
- [[_COMMUNITY_Error Taxonomy & Model Checks|Error Taxonomy & Model Checks]]
- [[_COMMUNITY_Parity Verification & Golden Scenarios|Parity Verification & Golden Scenarios]]
- [[_COMMUNITY_Bounded Retry & Lint Enforcement|Bounded Retry & Lint Enforcement]]
- [[_COMMUNITY_First-run Setup & Onboarding|First-run Setup & Onboarding]]
- [[_COMMUNITY_Performance & Latency Rules|Performance & Latency Rules]]
- [[_COMMUNITY_Lean Code Rules|Lean Code Rules]]
- [[_COMMUNITY_Domain Model & Account Locks|Domain Model & Account Locks]]
- [[_COMMUNITY_Timeout Handling|Timeout Handling]]

## God Nodes (most connected - your core abstractions)
1. `Identity and API keys contract (M1 SP6)` - 37 edges
2. `Bounded context: routing (core)` - 35 edges
3. `Feature Matrix — mandatory 17-column artifact` - 27 edges
4. `Milestone M-1 · Discovery` - 27 edges
5. `The 23 feature groups required by behavioral.md §5` - 26 edges
6. `Bounded context: connections` - 25 edges
7. `SP6 — identity + apikeys (password login + key validation only)` - 25 edges
8. `Overview — /` - 22 edges
9. `Settings contract (M1 SP5)` - 22 edges
10. `Bounded context: identity` - 20 edges

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

## Communities (22 total, 0 thin omitted)

### Community 0 - "Overview, Usage & Console Screens"
Cohesion: 0.05
Nodes (88): settings.outbound-proxy-live-apply, settings.proxy-test-outbound-probe, usage.write-not-synchronous, GET /overview/summary, SSE /events/requests, /traffic/console → Console (Developer mode only), /network/* → ProxyPools, DeployWizard, Tunnel, Mitm, / → Overview (+80 more)

### Community 1 - "Engine Capabilities & API-UI Map"
Cohesion: 0.06
Nodes (56): catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, combo.detect-required-capabilities, API ↔ UI map (docs/design/API_UI_MAP.md), GET /health, docs/PROJECT_MAP.md (generated U-project ownership map) (+48 more)

### Community 2 - "Discovery Outputs & Behavioral Questions"
Cohesion: 0.06
Nodes (55): docs/capabilities.md (GENERATED capability specification), docs/discovery/coverage.md, docs/discovery/inventory.json, §30 The 12 pre-implementation questions, §3 The 20 behavioral questions (trigger…edge cases), §8 Business rule beats old implementation, §2 Core principles — never port, rename, or translate 9router line by line, §29 Definition of Done — 13 checklist items, no self-declared DONE (+47 more)

### Community 3 - "Providers, Media & Architecture"
Cohesion: 0.11
Nodes (47): /providers/media* → MediaProviders, /providers* → LlmProviders, ProviderDetail, Connections, Quota, §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra), §9 Build an explicit domain model (Provider, Quota, RoutingPolicy…), §5 Feature discovery — inventory every group, do not trust the UI menu, §6 Feature Matrix requirement — nothing is understood until fully traced, §11 Providers reached only through a port (AIProviderPort), The 23 feature groups required by behavioral.md §5 (+39 more)

### Community 4 - "Routing, Fallback & Gaps"
Cohesion: 0.09
Nodes (43): endpoint.rewrite-lanes, /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver, /settings/auth OIDC and SAML tabs, docs/discovery/gaps.md (Gap register), §20 No blind fallback — fallback follows error semantics, §12 Router is its own business engine, not controller logic, §18 Streaming is first-class (TTFT, cancellation, backpressure), §13 Translator/protocol separation — canonical vs vendor formats (+35 more)

### Community 5 - "API Key Validation Rules"
Cohesion: 0.14
Nodes (20): apikey.legacy-format-unenforced, apikey.list-keys, apikey.validate-lookup, endpoint.enforce-require-api-key, identity.auth-status-disclosure, identity.machine-id-derivation, identity.reset-password-local-only, settings.patch-password-change (+12 more)

### Community 6 - "API Key Management (SP6)"
Cohesion: 0.21
Nodes (19): apikey.delete-key, apikey.generate-key, apikey.update-key-status, DELETE /api/keys/:id, UI error code: LIMIT_REACHED (409), UI error code: NOT_FOUND (404), GET /api/keys, useApiKeys (features/gateway/api.ts) (+11 more)

### Community 7 - "Login, Sessions & Lockout (SP6)"
Cohesion: 0.20
Nodes (18): identity.password-login-lockout, identity.session-cookie-lifecycle, UI error code: INVALID_CREDENTIALS (401), UI error code: RATE_LIMITED (429), UI error code: SETUP_REQUIRED (409), useChangePassword (features/settings/api.ts), useLogin (features/settings/api.ts), useLogout (features/settings/api.ts) (+10 more)

### Community 8 - "Settings Context (SP5)"
Cohesion: 0.22
Nodes (18): settings.combo-rotation-reset, settings.defaults-and-merge, settings.get-secret-stripping, settings.hot-path-read-no-cache, settings.patch-protected-keys, GET /api/settings, useRequireApiKey (features/gateway/api.ts), PATCH /api/settings (+10 more)

### Community 9 - "Integrations & CLI Tooling"
Cohesion: 0.29
Nodes (17): /integrations/* → CliTools, CliToolDetail, Skills, Mcp, CLI-tool config writes require diff preview + backup, Bounded context: tooling, Copy field component, Feature group: CLI Tools, Feature group: Console Log, Feature group — MCP (API with no UI, found during spec work), Feature group: Skills (+9 more)

### Community 10 - "Settings General & Stitch Audit"
Cohesion: 0.31
Nodes (15): settings.database-export-import, /settings/general → SettingsGeneral, Audit finding: login-callback / deploy-wizard / authflow-modals are showcases, not routes, §7 Trace the behavior — never conclude from a function name, The Tracing Protocol (6 steps, applied by Tasks 6–18), Bounded context: identity, Bounded context: settings, Feature group: Settings (+7 more)

### Community 11 - "Transport Direct Branch (SP8)"
Cohesion: 0.16
Nodes (15): ErrorCode: PROVIDER_UNAVAILABLE, Golden scenario: all providers unavailable, DirectTransport (direct branch implementation), Failure: body larger than maxBytes in readBoundedText, Upstream answers 4xx or 5xx, Failure: malformed URL or non-https (http only to localhost/127.0.0.1/[::1]), Failure: connection refused, DNS failure, TLS failure, Failure: upstream answers 3xx (redirect not followed) (+7 more)

### Community 12 - "Chat API /v1 & Endpoint Screen"
Cohesion: 0.21
Nodes (12): endpoint.extract-header-order, transport.proxy-priority-chain, /gateway/endpoint base URL pill ("Chat API pending"), POST /v1/chat/completions (/v1 Chat API), ExecCtx (one shared client-cancel + deadline signal), Golden scenario: client cancellation, extractApiKey() (Authorization: Bearer first, then x-api-key), SP12 — routing: chat lane + Fastify raw streaming, backpressure, cancellation (+4 more)

### Community 13 - "UI Transport Error Codes"
Cohesion: 0.27
Nodes (12): UI error code: BAD_RESPONSE, UI error code: HTTP_5xx, UI error code: NETWORK_ERROR, UI error code: any other code (fallback), UI error code: TIMEOUT, UI error code: UNAUTHENTICATED (401), shared/errors.test.mjs, shared/api.ts — same-origin JSON client, ApiError with stable code, 10 s timeout (+4 more)

### Community 14 - "Error Taxonomy & Model Checks"
Cohesion: 0.29
Nodes (12): Error taxonomy (8 ErrorCodes), assertModelSupports() — MODEL_UNAVAILABLE / INVALID_REQUEST, FALLBACK_POLICY (8 error codes as data), ErrorCode: AUTH_ERROR, ErrorCode: INTERNAL_ERROR, ErrorCode: INVALID_REQUEST, ErrorCode: MODEL_UNAVAILABLE, ErrorCode: QUOTA_EXHAUSTED (+4 more)

### Community 15 - "Parity Verification & Golden Scenarios"
Cohesion: 0.17
Nodes (12): Parity verification — 3 tiers, Normalizer + semantic SSE diff (not chunk diff), Golden scenario: invalid credentials, Golden scenario: normal completion, Golden scenario: partial stream failure, Golden scenario: provider fallback, Golden scenario: quota exhausted, Golden scenario: rate limit (+4 more)

### Community 16 - "Bounded Retry & Lint Enforcement"
Cohesion: 0.27
Nodes (11): withRetry() — bounded retry helper (≤10 attempts, capped backoff, abortable), Golden scenario: stream completion, tools/lint/check.test.mjs (lint:check 13/13), Lint rule aigate/fetch-through-transport, Lint rule aigate/fetch-timeout (accepts AbortSignal.any([..., AbortSignal.timeout(n)])), Lint rule aigate/retry-through-helper, Next step: M1 SP8 transport (HttpTransportPort, direct + timeout, no UI), Next step: M1 SP9 OpenAI-compatible adapter (AIProviderPort over HttpTransportPort, no UI) (+3 more)

### Community 17 - "First-run Setup & Onboarding"
Cohesion: 0.33
Nodes (10): UI error code: ALREADY_SET_UP (409), UI error code: INVALID_REQUEST (400), UI error code: NOT_LOCAL (403), useSetup (features/settings/api.ts), POST /api/auth/setup, /welcome → Onboarding (one step), AIGATE_INITIAL_PASSWORD (first password at boot), Decision 2 (user, 2026-09-25): first password set from the local machine; no default password (+2 more)

### Community 18 - "Performance & Latency Rules"
Cohesion: 0.29
Nodes (7): §17 Latency — clean architecture must not add hot-path I/O, §16 Do not inherit performance issues; all large workloads bounded, Constraint — every filesystem scan uses fast-glob with an explicit ignore list, Rule 4 — Every workload must be BOUNDED, Rule 11 — Review questions beyond "does it run?" (10x/100x traffic, unbounded work), Rule 5 — Low latency: parallelize independent awaits, only when bounded, Rule 3 — Optimize performance at design time, not micro-optimization

### Community 19 - "Lean Code Rules"
Cohesion: 0.50
Nodes (4): §15 Code quality — shortest CLEAR implementation, not shortest possible, Rule 1 — Write LEAN code, no over-engineering, Rule 2 — Code must be maintainable, no magic values or hidden side effects, Rule 12 — Priority order: Correctness → Simplicity → Maintainability → Predictable resources → Latency → Throughput → Optimization

### Community 20 - "Domain Model & Account Locks"
Cohesion: 0.50
Nodes (4): AIGate domain model (Provider, Credential, RoutingPolicy, AccountLock, …), IMPLEMENTATION_ACCIDENT — debt not inherited from 9router, AccountLock entity, Golden scenario: account failover

### Community 21 - "Timeout Handling"
Cohesion: 1.00
Nodes (3): ErrorCode: TIMEOUT, Golden scenario: provider timeout, Failure: no headers or stalled body within timeoutMs

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
- **17 isolated node(s):** `ErrorCode: INTERNAL_ERROR`, `Parity tier 2 — Vendor acceptance (PASS/FAIL)`, `Parity tier 3 — Upstream shape drift (warning only)`, `Golden scenario: normal completion`, `Golden scenario: partial stream failure` (+12 more)
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
- **Why does `Milestone M-1 · Discovery` connect `Discovery Outputs & Behavioral Questions` to `Overview, Usage & Console Screens`, `Engine Capabilities & API-UI Map`, `Providers, Media & Architecture`, `Routing, Fallback & Gaps`, `Integrations & CLI Tooling`, `Settings General & Stitch Audit`?**
  _High betweenness centrality (0.129) - this node is a cross-community bridge._
- **Why does `Bounded context: routing (core)` connect `Routing, Fallback & Gaps` to `Overview, Usage & Console Screens`, `Engine Capabilities & API-UI Map`, `Discovery Outputs & Behavioral Questions`, `Providers, Media & Architecture`, `API Key Management (SP6)`, `Settings Context (SP5)`, `Settings General & Stitch Audit`, `Chat API /v1 & Endpoint Screen`, `Error Taxonomy & Model Checks`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._