# Graph Report - docs  (2026-09-25)

## Corpus Check
- 13 files · ~36,585 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 466 nodes · 1272 edges · 17 communities
- Extraction: 82% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 220 edges (avg confidence: 0.87)
- Token cost: 475,429 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Identity, API Keys & Settings (SP5-SP6)|Identity, API Keys & Settings (SP5-SP6)]]
- [[_COMMUNITY_Overview, Routing & Usage Screens|Overview, Routing & Usage Screens]]
- [[_COMMUNITY_Network & Settings Screens, Stitch Audit|Network & Settings Screens, Stitch Audit]]
- [[_COMMUNITY_Providers, Media & Architecture|Providers, Media & Architecture]]
- [[_COMMUNITY_Domain Model, Errors & DoD|Domain Model, Errors & DoD]]
- [[_COMMUNITY_Engine Capabilities & API-UI Map (SP7)|Engine Capabilities & API-UI Map (SP7)]]
- [[_COMMUNITY_Architecture Principles & Health|Architecture Principles & Health]]
- [[_COMMUNITY_Integrations, Console & Feature Groups|Integrations, Console & Feature Groups]]
- [[_COMMUNITY_Chat API v1 & Endpoint Screen|Chat API /v1 & Endpoint Screen]]
- [[_COMMUNITY_Phase Model, Golden Scenarios & Tests|Phase Model, Golden Scenarios & Tests]]
- [[_COMMUNITY_Discovery Coverage & Evidence|Discovery Coverage & Evidence]]
- [[_COMMUNITY_Behavioral Tracing Rules|Behavioral Tracing Rules]]
- [[_COMMUNITY_M-1 Discovery Tasks|M-1 Discovery Tasks]]
- [[_COMMUNITY_Parity Principles & Capabilities Spec|Parity Principles & Capabilities Spec]]
- [[_COMMUNITY_Fallback, Streaming & Gaps|Fallback, Streaming & Gaps]]
- [[_COMMUNITY_Performance & Latency Rules|Performance & Latency Rules]]
- [[_COMMUNITY_Lean Code Rules|Lean Code Rules]]

## God Nodes (most connected - your core abstractions)
1. `Identity and API keys contract (M1 SP6)` - 37 edges
2. `Bounded context: routing (core)` - 35 edges
3. `Feature Matrix — mandatory 17-column artifact` - 27 edges
4. `Milestone M-1 · Discovery` - 26 edges
5. `The 23 feature groups required by behavioral.md §5` - 26 edges
6. `Bounded context: connections` - 25 edges
7. `SP6 — identity + apikeys (password login + key validation only)` - 24 edges
8. `Overview — /` - 22 edges
9. `Settings contract (M1 SP5)` - 22 edges
10. `Bounded context: identity` - 20 edges

## Surprising Connections (you probably didn't know these)
- `identity.machine-id-derivation` --conceptually_related_to--> `Bounded context: identity`  [INFERRED]
  docs/contracts/identity-apikeys.md → docs/superpowers/specs/2026-09-22-aigate-design.md
- `UI error code: INVALID_REQUEST (400)` --semantically_similar_to--> `ErrorCode: INVALID_REQUEST`  [INFERRED] [semantically similar]
  docs/design/API_UI_MAP.md → docs/superpowers/specs/2026-09-22-aigate-design.md
- `Decision (user, 2026-09-25): onboarding is one step (set password, open dashboard)` --references--> `Onboarding — /welcome`  [INFERRED]
  docs/PROGRESS_HANDOFF.md → docs/superpowers/specs/2026-09-22-aigate-design.md
- `Rule 7 — Error handling: never swallow, keep context and stack, bounded retry` --rationale_for--> `Task 12 — Trace Token Saver`  [INFERRED]
  docs/governance/rules.md → docs/superpowers/plans/2026-09-22-m1-discovery.md
- `Rule 4 — Every workload must be BOUNDED` --semantically_similar_to--> `§16 Do not inherit performance issues; all large workloads bounded`  [INFERRED] [semantically similar]
  docs/governance/rules.md → docs/governance/behavioral.md

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

## Communities (17 total, 0 thin omitted)

### Community 0 - "Identity, API Keys & Settings (SP5-SP6)"
Cohesion: 0.05
Nodes (97): apikey.delete-key, apikey.generate-key, apikey.legacy-format-unenforced, apikey.list-keys, apikey.update-key-status, apikey.validate-lookup, endpoint.enforce-require-api-key, identity.auth-status-disclosure (+89 more)

### Community 1 - "Overview, Routing & Usage Screens"
Cohesion: 0.07
Nodes (58): usage.write-not-synchronous, GET /overview/summary, SSE /events/requests, / → Overview, /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver, /traffic/usage, /traffic/requests* → Usage, Requests, RequestDetail, Audit finding: Console shown in sidebar regardless of Developer mode, Audit finding: routing-fallback merged 4 tabs into one 3886px screen (+50 more)

### Community 2 - "Network & Settings Screens, Stitch Audit"
Cohesion: 0.10
Nodes (54): /network/* → ProxyPools, DeployWizard, Tunnel, Mitm, /settings/auth OIDC and SAML tabs, /settings/general → SettingsGeneral, Audit PASS: no credential leaked across 27 HTML exports, Audit FAIL: only the happy path was drawn (state rules §10.7), Audit finding: MITM CA buttons adjacent, type-to-confirm modal missing, Audit finding: settings-auth regenerated as settings-auth-v2, Audit finding: login-callback / deploy-wizard / authflow-modals are showcases, not routes (+46 more)

### Community 3 - "Providers, Media & Architecture"
Cohesion: 0.12
Nodes (43): /providers/media* → MediaProviders, /providers* → LlmProviders, ProviderDetail, Connections, Quota, §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra), §9 Build an explicit domain model (Provider, Quota, RoutingPolicy…), §6 Feature Matrix requirement — nothing is understood until fully traced, §11 Providers reached only through a port (AIProviderPort), AuthFlow — declarative, data-driven auth step framework, Feature Matrix — mandatory 17-column artifact (+35 more)

### Community 4 - "Domain Model, Errors & DoD"
Cohesion: 0.08
Nodes (35): Definition of Done — 13 items, not self-awarded, AIGate domain model (Provider, Credential, RoutingPolicy, AccountLock, …), Error taxonomy (8 ErrorCodes), IMPLEMENTATION_ACCIDENT — debt not inherited from 9router, Parity verification — 3 tiers, Mandatory 6-phase feature process (A Discovery → F Parity), Normalizer + semantic SSE diff (not chunk diff), FALLBACK_POLICY (8 error codes as data) (+27 more)

### Community 5 - "Engine Capabilities & API-UI Map (SP7)"
Cohesion: 0.12
Nodes (31): catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, combo.detect-required-capabilities, API ↔ UI map (docs/design/API_UI_MAP.md), docs/PROJECT_MAP.md (generated U-project ownership map), Rule: an API is done only when its UI screen is wired in the same SP (+23 more)

### Community 6 - "Architecture Principles & Health"
Cohesion: 0.09
Nodes (27): GET /health, 9router as Behavioral Source of Truth (not a template to port), Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Feature-based frontend structure with import boundaries, Hexagonal architecture, granularity = bounded context, Split: machines block mechanics, skills teach judgement, Monorepo layout (apps/server, apps/web, apps/cli, packages/engine, contracts, database, tools) (+19 more)

### Community 7 - "Integrations, Console & Feature Groups"
Cohesion: 0.19
Nodes (25): /traffic/console → Console (Developer mode only), /integrations/* → CliTools, CliToolDetail, Skills, Mcp, §5 Feature discovery — inventory every group, do not trust the UI menu, The 23 feature groups required by behavioral.md §5, CLI-tool config writes require diff preview + backup, Bounded context: tooling, Feature group: CLI Tools, Feature group: Console Log (+17 more)

### Community 8 - "Chat API /v1 & Endpoint Screen"
Cohesion: 0.12
Nodes (24): endpoint.extract-header-order, endpoint.rewrite-lanes, settings.combo-rotation-reset, /gateway/endpoint base URL pill ("Chat API pending"), POST /v1/chat/completions (/v1 Chat API), §12 Router is its own business engine, not controller logic, §13 Translator/protocol separation — canonical vs vendor formats, Canonical Internal Protocol (+16 more)

### Community 9 - "Phase Model, Golden Scenarios & Tests"
Cohesion: 0.24
Nodes (12): §30 The 12 pre-implementation questions, §25 Golden scenarios (13 critical flows), Phase model A→F (Discovery, Behavior Extraction, Contract, Design, Implementation, Parity Verification), §24 Characterization/contract tests prove old ≈ new at contract level, Constraint — no Phase C contracts during discovery, Constraint — no AIGate product code in M-1 (only tools/discovery and docs), Phase A — Discovery, Phase B — Behavior Extraction (+4 more)

### Community 10 - "Discovery Coverage & Evidence"
Cohesion: 0.33
Nodes (11): docs/discovery/coverage.md, docs/discovery/inventory.json, Evidence with file:line — traced is a test, not a self-declaration, Fixed inventory counts (154 routes, 28 pages, 123 providers, 29 executors, 48 translators, 11 repos, 14 OAuth routes), Task 19 — M-1 exit gate, cli.ts — validate | inventory | coverage | capabilities, coverage.ts — matrix vs inventory coverage report, gate.test.ts — M-1 exit gate test (+3 more)

### Community 11 - "Behavioral Tracing Rules"
Cohesion: 0.18
Nodes (11): §3 The 20 behavioral questions (trigger…edge cases), §8 Business rule beats old implementation, §29 Definition of Done — 13 checklist items, no self-declared DONE, §19 Fallback as explicit policy with classified errors, §28 Per-feature process: DISCOVER→TRACE→DOCUMENT→…→REVIEW, Feature Matrix entry template (null never "" or "N/A"), Canonical error classification codes (8 values), parityStatus lifecycle (not-started → traced → contracted → implemented → verified) (+3 more)

### Community 12 - "M-1 Discovery Tasks"
Cohesion: 0.33
Nodes (11): 07-token-saver.yaml, 10-proxy-pools.yaml, Milestone M-1 · Discovery, Rule 10 — Cache only with a reason: key, TTL, invalidation, max size, Task 1 — Discovery tooling workspace, Task 2 — Feature Matrix schema and validator, Task 3 — Inventory extractor, Task 4 — Coverage checker (+3 more)

### Community 13 - "Parity Principles & Capabilities Spec"
Cohesion: 0.22
Nodes (9): docs/capabilities.md (GENERATED capability specification), §2 Core principles — never port, rename, or translate 9router line by line, §14 Feature parity is not code parity, Final principle — 9router says WHAT, never HOW, §1 Goal — build a NEW AI gateway, 9router is reference only, §27 Separate BUSINESS REQUIREMENT from IMPLEMENTATION ACCIDENT, IMPLEMENTATION_ACCIDENT label, 9router checkout (read-only behavioral reference at E:/9router) (+1 more)

### Community 14 - "Fallback, Streaming & Gaps"
Cohesion: 0.33
Nodes (7): docs/discovery/gaps.md (Gap register), §20 No blind fallback — fallback follows error semantics, §18 Streaming is first-class (TTFT, cancellation, backpressure), 05-request-routing-fallback.yaml, 06-combo-capacity-adapter.yaml, Task 10 — Trace Request routing, Auto fallback, Task 11 — Trace Combo / Vision Adapter

### Community 15 - "Performance & Latency Rules"
Cohesion: 0.29
Nodes (7): §17 Latency — clean architecture must not add hot-path I/O, §16 Do not inherit performance issues; all large workloads bounded, Constraint — every filesystem scan uses fast-glob with an explicit ignore list, Rule 4 — Every workload must be BOUNDED, Rule 11 — Review questions beyond "does it run?" (10x/100x traffic, unbounded work), Rule 5 — Low latency: parallelize independent awaits, only when bounded, Rule 3 — Optimize performance at design time, not micro-optimization

### Community 16 - "Lean Code Rules"
Cohesion: 0.50
Nodes (4): §15 Code quality — shortest CLEAR implementation, not shortest possible, Rule 1 — Write LEAN code, no over-engineering, Rule 2 — Code must be maintainable, no magic values or hidden side effects, Rule 12 — Priority order: Correctness → Simplicity → Maintainability → Predictable resources → Latency → Throughput → Optimization

## Ambiguous Edges - Review These
- `Token Saver — /gateway/token-saver` → `U6 — Routing & Fallback + Simulator`  [AMBIGUOUS]
  docs/superpowers/specs/2026-09-22-aigate-design.md · relation: implements
- `U6 — Routing & Fallback + Simulator` → `GAP: Token Saver screen missing from the U0–U11 table`  [AMBIGUOUS]
  docs/superpowers/specs/2026-09-22-aigate-design.md · relation: references
- `The 23 feature groups required by behavioral.md §5` → `Feature group — MCP (API with no UI, found during spec work)`  [AMBIGUOUS]
  docs/superpowers/plans/2026-09-22-m1-discovery.md · relation: conceptually_related_to
- `Open decision (user confirmation pending): scan every message + system prompt for required capabilities` → `detectRequiredCapabilities()`  [AMBIGUOUS]
  docs/contracts/engine.md · relation: rationale_for

## Knowledge Gaps
- **17 isolated node(s):** `ErrorCode: INTERNAL_ERROR`, `Parity tier 2 — Vendor acceptance (PASS/FAIL)`, `Parity tier 3 — Upstream shape drift (warning only)`, `Golden scenario: normal completion`, `Golden scenario: stream completion` (+12 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Token Saver — /gateway/token-saver` and `U6 — Routing & Fallback + Simulator`?**
  _Edge tagged AMBIGUOUS (relation: implements) - confidence is low._
- **What is the exact relationship between `U6 — Routing & Fallback + Simulator` and `GAP: Token Saver screen missing from the U0–U11 table`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `The 23 feature groups required by behavioral.md §5` and `Feature group — MCP (API with no UI, found during spec work)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Open decision (user confirmation pending): scan every message + system prompt for required capabilities` and `detectRequiredCapabilities()`?**
  _Edge tagged AMBIGUOUS (relation: rationale_for) - confidence is low._
- **Why does `Bounded context: routing (core)` connect `Chat API /v1 & Endpoint Screen` to `Identity, API Keys & Settings (SP5-SP6)`, `Overview, Routing & Usage Screens`, `Network & Settings Screens, Stitch Audit`, `Providers, Media & Architecture`, `Domain Model, Errors & DoD`, `Engine Capabilities & API-UI Map (SP7)`, `M-1 Discovery Tasks`, `Fallback, Streaming & Gaps`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **Why does `Milestone M-1 · Discovery` connect `M-1 Discovery Tasks` to `Overview, Routing & Usage Screens`, `Network & Settings Screens, Stitch Audit`, `Providers, Media & Architecture`, `Architecture Principles & Health`, `Integrations, Console & Feature Groups`, `Chat API /v1 & Endpoint Screen`, `Phase Model, Golden Scenarios & Tests`, `Discovery Coverage & Evidence`, `Parity Principles & Capabilities Spec`, `Fallback, Streaming & Gaps`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **Why does `The Tracing Protocol (6 steps, applied by Tasks 6–18)` connect `Network & Settings Screens, Stitch Audit` to `Identity, API Keys & Settings (SP5-SP6)`, `Overview, Routing & Usage Screens`, `Providers, Media & Architecture`, `Integrations, Console & Feature Groups`, `Chat API /v1 & Endpoint Screen`, `Discovery Coverage & Evidence`, `Behavioral Tracing Rules`, `Parity Principles & Capabilities Spec`, `Fallback, Streaming & Gaps`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._