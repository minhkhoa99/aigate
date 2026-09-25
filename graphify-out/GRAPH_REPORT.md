# Graph Report - docs  (2026-09-25)

## Corpus Check
- 15 files · ~39,568 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 516 nodes · 1404 edges · 24 communities
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 232 edges (avg confidence: 0.87)
- Token cost: 574,916 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_API Keys, Identity & Endpoint (SP6)|API Keys, Identity & Endpoint (SP6)]]
- [[_COMMUNITY_Settings, Network & SSO Screens|Settings, Network & SSO Screens]]
- [[_COMMUNITY_API-UI Map & Wired Endpoints|API-UI Map & Wired Endpoints]]
- [[_COMMUNITY_Providers, Credentials & Architecture|Providers, Credentials & Architecture]]
- [[_COMMUNITY_Overview, Usage & Observability|Overview, Usage & Observability]]
- [[_COMMUNITY_Error Classification & Parity Tiers|Error Classification & Parity Tiers]]
- [[_COMMUNITY_Integrations, Console & Design System|Integrations, Console & Design System]]
- [[_COMMUNITY_Routing Engine & Token Saver|Routing Engine & Token Saver]]
- [[_COMMUNITY_SP9 Adapter Matrix Entries|SP9 Adapter Matrix Entries]]
- [[_COMMUNITY_Capability Resolution (SP7)|Capability Resolution (SP7)]]
- [[_COMMUNITY_Transport Direct Branch (SP8)|Transport Direct Branch (SP8)]]
- [[_COMMUNITY_M-1 Discovery Tasks|M-1 Discovery Tasks]]
- [[_COMMUNITY_Phase Model & Golden Scenarios|Phase Model & Golden Scenarios]]
- [[_COMMUNITY_Definition of Done & Skills|Definition of Done & Skills]]
- [[_COMMUNITY_Discovery Outputs & Exit Gate|Discovery Outputs & Exit Gate]]
- [[_COMMUNITY_Tracing Protocol & Gap Register|Tracing Protocol & Gap Register]]
- [[_COMMUNITY_Bounded Retry & Lint Enforcement|Bounded Retry & Lint Enforcement]]
- [[_COMMUNITY_Core Porting Principles|Core Porting Principles]]
- [[_COMMUNITY_CIP, ExecCtx & AIProviderPort|CIP, ExecCtx & AIProviderPort]]
- [[_COMMUNITY_Feature Matrix Schema & Lifecycle|Feature Matrix Schema & Lifecycle]]
- [[_COMMUNITY_Latency & Bounded Workloads|Latency & Bounded Workloads]]
- [[_COMMUNITY_Transient Retry & Provider Unavailable|Transient Retry & Provider Unavailable]]
- [[_COMMUNITY_Lean Code Rules|Lean Code Rules]]
- [[_COMMUNITY_Translator & Protocol Separation|Translator & Protocol Separation]]

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
- `TransportModule (injects DirectTransport under HTTP_TRANSPORT)` --implements--> `Bounded context: transport`  [INFERRED]
  docs/contracts/transport.md → docs/superpowers/specs/2026-09-22-aigate-design.md
- `ErrorCode: TIMEOUT` --conceptually_related_to--> `UI error code: TIMEOUT`  [AMBIGUOUS]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/API_UI_MAP.md
- `Feature group — MCP (API with no UI, found during spec work)` --conceptually_related_to--> `The 23 feature groups required by behavioral.md §5`  [AMBIGUOUS]
  docs/superpowers/plans/2026-09-22-m1-discovery.md → docs/governance/behavioral.md
- `Rule 4 — Every workload must be BOUNDED` --semantically_similar_to--> `§16 Do not inherit performance issues; all large workloads bounded`  [INFERRED] [semantically similar]
  docs/governance/rules.md → docs/governance/behavioral.md
- `?uiState=loading|empty|error preview parameter` --references--> `Required state: error with retry`  [INFERRED]
  docs/design/UI_HANDOFF.md → docs/design/DESIGN.md

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

## Communities (24 total, 0 thin omitted)

### Community 0 - "API Keys, Identity & Endpoint (SP6)"
Cohesion: 0.06
Nodes (94): apikey.delete-key, apikey.generate-key, apikey.legacy-format-unenforced, apikey.list-keys, apikey.update-key-status, apikey.validate-lookup, endpoint.enforce-require-api-key, identity.auth-status-disclosure (+86 more)

### Community 1 - "Settings, Network & SSO Screens"
Cohesion: 0.08
Nodes (63): identity.machine-id-derivation, settings.database-export-import, settings.outbound-proxy-live-apply, settings.proxy-test-outbound-probe, /network/* → ProxyPools, DeployWizard, Tunnel, Mitm, /settings/auth OIDC and SAML tabs, /settings/general → SettingsGeneral, Audit finding: Console shown in sidebar regardless of Developer mode (+55 more)

### Community 2 - "API-UI Map & Wired Endpoints"
Cohesion: 0.07
Nodes (53): endpoint.extract-header-order, transport.proxy-priority-chain, API ↔ UI map (docs/design/API_UI_MAP.md), GET /health, docs/PROJECT_MAP.md (generated U-project ownership map), API_UI_MAP row: SP7 packages/engine, No UI, API_UI_MAP row: SP8 transport, No UI, API_UI_MAP row: SP9 OpenAICompatibleAdapter, No UI (+45 more)

### Community 3 - "Providers, Credentials & Architecture"
Cohesion: 0.11
Nodes (46): validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, /providers/media* → MediaProviders, /providers* → LlmProviders, ProviderDetail, Connections, Quota, §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra), §9 Build an explicit domain model (Provider, Quota, RoutingPolicy…), §5 Feature discovery — inventory every group, do not trust the UI menu, §6 Feature Matrix requirement — nothing is understood until fully traced, §11 Providers reached only through a port (AIProviderPort) (+38 more)

### Community 4 - "Overview, Usage & Observability"
Cohesion: 0.13
Nodes (30): usage.write-not-synchronous, GET /overview/summary, SSE /events/requests, / → Overview, /traffic/usage, /traffic/requests* → Usage, Requests, RequestDetail, §23 Observability per request; never log keys, tokens or secrets, §21 Quota must be understood fully, not copied from the UI tracker, §22 Usage fields to trace per request (tokens, cost, latency, fallback attempts) (+22 more)

### Community 5 - "Error Classification & Parity Tiers"
Cohesion: 0.09
Nodes (27): Status → ErrorCode by status + error.code/type only (never message text), Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Error taxonomy (8 ErrorCodes), Stated limits of tape-based parity, Parity verification — 3 tiers, Recording proxy + 4-part tape, Normalizer + semantic SSE diff (not chunk diff) (+19 more)

### Community 6 - "Integrations, Console & Design System"
Cohesion: 0.23
Nodes (21): /traffic/console → Console (Developer mode only), /integrations/* → CliTools, CliToolDetail, Skills, Mcp, CLI-tool config writes require diff preview + backup, Bounded context: tooling, Copy field component, Type scale (12/13/14/16/20/32) and mono for identifiers, Feature group: CLI Tools, Feature group: Console Log (+13 more)

### Community 7 - "Routing Engine & Token Saver"
Cohesion: 0.22
Nodes (20): endpoint.rewrite-lanes, /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver, §12 Router is its own business engine, not controller logic, Routing simulator (decision-tree dry run), Bounded context: routing (core), GAP: Token Saver screen missing from the U0–U11 table, Feature group: Auto fallback, Feature group: Combo / Vision Adapter (+12 more)

### Community 8 - "SP9 Adapter Matrix Entries"
Cohesion: 0.14
Nodes (20): fallback.error-classification, fallback.partial-stream-failure, fallback.upstream-error-result, routing.default-executor-openai-fallback, routing.non-streaming-response, routing.streaming-pipeline, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), ListedModel { id, descriptor? } — getModels never invents limits (≤1000 ids) (+12 more)

### Community 9 - "Capability Resolution (SP7)"
Cohesion: 0.26
Nodes (14): catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, combo.detect-required-capabilities, assertModelSupports() — MODEL_UNAVAILABLE / INVALID_REQUEST, Engine contract (M1 SP7), defineRegistry() / builtinRegistry (single openai entry, 4 chat models) (+6 more)

### Community 10 - "Transport Direct Branch (SP8)"
Cohesion: 0.18
Nodes (13): transport.test.mjs: adapter streams end to end over DirectTransport, ErrorCode: TIMEOUT, Golden scenario: provider timeout, DirectTransport (direct branch implementation), Upstream answers 4xx or 5xx, Failure: malformed URL or non-https (http only to localhost/127.0.0.1/[::1]), Failure: no headers or stalled body within timeoutMs, Failure: timeoutMs not an integer from 1 to 600000 (+5 more)

### Community 11 - "M-1 Discovery Tasks"
Cohesion: 0.28
Nodes (13): 07-token-saver.yaml, 10-proxy-pools.yaml, Milestone M-1 · Discovery, Rule 10 — Cache only with a reason: key, TTL, invalidation, max size, Task 1 — Discovery tooling workspace, Task 2 — Feature Matrix schema and validator, Task 3 — Inventory extractor, Task 4 — Coverage checker (+5 more)

### Community 12 - "Phase Model & Golden Scenarios"
Cohesion: 0.24
Nodes (12): §30 The 12 pre-implementation questions, §25 Golden scenarios (13 critical flows), Phase model A→F (Discovery, Behavior Extraction, Contract, Design, Implementation, Parity Verification), §24 Characterization/contract tests prove old ≈ new at contract level, Constraint — no Phase C contracts during discovery, Constraint — no AIGate product code in M-1 (only tools/discovery and docs), Phase A — Discovery, Phase B — Behavior Extraction (+4 more)

### Community 13 - "Definition of Done & Skills"
Cohesion: 0.18
Nodes (12): Definition of Done — 13 items, not self-awarded, AIGate domain model (Provider, Credential, RoutingPolicy, AccountLock, …), IMPLEMENTATION_ACCIDENT — debt not inherited from 9router, Split: machines block mechanics, skills teach judgement, Mandatory 6-phase feature process (A Discovery → F Parity), Iron law: no skill without a failing test first (RED → GREEN → REFACTOR), UI performance constraints, AccountLock entity (+4 more)

### Community 14 - "Discovery Outputs & Exit Gate"
Cohesion: 0.33
Nodes (11): docs/discovery/coverage.md, docs/discovery/inventory.json, Evidence with file:line — traced is a test, not a self-declaration, Fixed inventory counts (154 routes, 28 pages, 123 providers, 29 executors, 48 translators, 11 repos, 14 OAuth routes), Task 19 — M-1 exit gate, cli.ts — validate | inventory | coverage | capabilities, coverage.ts — matrix vs inventory coverage report, gate.test.ts — M-1 exit gate test (+3 more)

### Community 15 - "Tracing Protocol & Gap Register"
Cohesion: 0.22
Nodes (11): docs/discovery/gaps.md (Gap register), §20 No blind fallback — fallback follows error semantics, §18 Streaming is first-class (TTFT, cancellation, backpressure), §7 Trace the behavior — never conclude from a function name, The Tracing Protocol (6 steps, applied by Tasks 6–18), 05-request-routing-fallback.yaml, 13-console-remote.yaml, Rule 8 — Every resource has an explicit lifecycle (+3 more)

### Community 16 - "Bounded Retry & Lint Enforcement"
Cohesion: 0.27
Nodes (10): §8 Business rule beats old implementation, §19 Fallback as explicit policy with classified errors, Canonical error classification codes (8 values), withRetry() — bounded retry helper (≤10 attempts, capped backoff, abortable), tools/lint/check.test.mjs (lint:check 13/13), Lint rule aigate/fetch-through-transport, Lint rule aigate/fetch-timeout (accepts AbortSignal.any([..., AbortSignal.timeout(n)])), Lint rule aigate/retry-through-helper (+2 more)

### Community 17 - "Core Porting Principles"
Cohesion: 0.22
Nodes (9): docs/capabilities.md (GENERATED capability specification), §2 Core principles — never port, rename, or translate 9router line by line, §14 Feature parity is not code parity, Final principle — 9router says WHAT, never HOW, §1 Goal — build a NEW AI gateway, 9router is reference only, §27 Separate BUSINESS REQUIREMENT from IMPLEMENTATION ACCIDENT, IMPLEMENTATION_ACCIDENT label, 9router checkout (read-only behavioral reference at E:/9router) (+1 more)

### Community 18 - "CIP, ExecCtx & AIProviderPort"
Cohesion: 0.25
Nodes (9): Canonical Internal Protocol (CIP), vendorExtensions — typed carry-through field, ExecCtx (one shared client-cancel + deadline signal), Feature group: Translation / language functionality, Golden scenario: client cancellation, AIProviderPort, SP14 — Provider adapters by protocol family (kiro, cursor, commandcode, vertex, azure…), SP15 — Protocol adapters, all 13 formats (+1 more)

### Community 19 - "Feature Matrix Schema & Lifecycle"
Cohesion: 0.29
Nodes (7): §3 The 20 behavioral questions (trigger…edge cases), §29 Definition of Done — 13 checklist items, no self-declared DONE, §28 Per-feature process: DISCOVER→TRACE→DOCUMENT→…→REVIEW, Feature Matrix entry template (null never "" or "N/A"), parityStatus lifecycle (not-started → traced → contracted → implemented → verified), suspicion block — expected / actual / impact, schema.ts — Zod Feature Matrix entry schema

### Community 20 - "Latency & Bounded Workloads"
Cohesion: 0.29
Nodes (7): §17 Latency — clean architecture must not add hot-path I/O, §16 Do not inherit performance issues; all large workloads bounded, Constraint — every filesystem scan uses fast-glob with an explicit ignore list, Rule 4 — Every workload must be BOUNDED, Rule 11 — Review questions beyond "does it run?" (10x/100x traffic, unbounded work), Rule 5 — Low latency: parallelize independent awaits, only when bounded, Rule 3 — Optimize performance at design time, not micro-optimization

### Community 21 - "Transient Retry & Provider Unavailable"
Cohesion: 0.40
Nodes (6): fallback.executor-retry-budget, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, ErrorCode: PROVIDER_UNAVAILABLE, Golden scenario: all providers unavailable, Failure: connection refused, DNS failure, TLS failure, Failure: upstream answers 3xx (redirect not followed)

### Community 22 - "Lean Code Rules"
Cohesion: 0.50
Nodes (4): §15 Code quality — shortest CLEAR implementation, not shortest possible, Rule 1 — Write LEAN code, no over-engineering, Rule 2 — Code must be maintainable, no magic values or hidden side effects, Rule 12 — Priority order: Correctness → Simplicity → Maintainability → Predictable resources → Latency → Throughput → Optimization

### Community 23 - "Translator & Protocol Separation"
Cohesion: 0.50
Nodes (4): §13 Translator/protocol separation — canonical vs vendor formats, Canonical Internal Protocol, 11-translation-i18n.yaml, Task 16 — Trace Translation engine and interface language

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
- **Why does `Bounded context: routing (core)` connect `Routing Engine & Token Saver` to `API Keys, Identity & Endpoint (SP6)`, `API-UI Map & Wired Endpoints`, `Providers, Credentials & Architecture`, `Overview, Usage & Observability`, `Error Classification & Parity Tiers`, `M-1 Discovery Tasks`, `Tracing Protocol & Gap Register`, `CIP, ExecCtx & AIProviderPort`, `Translator & Protocol Separation`?**
  _High betweenness centrality (0.126) - this node is a cross-community bridge._
- **Why does `Milestone M-1 · Discovery` connect `M-1 Discovery Tasks` to `API-UI Map & Wired Endpoints`, `Providers, Credentials & Architecture`, `Overview, Usage & Observability`, `Error Classification & Parity Tiers`, `Integrations, Console & Design System`, `Phase Model & Golden Scenarios`, `Discovery Outputs & Exit Gate`, `Tracing Protocol & Gap Register`, `Core Porting Principles`, `Translator & Protocol Separation`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._