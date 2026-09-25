# Graph Report - docs  (2026-09-26)

## Corpus Check
- 22 files · ~50,597 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 650 nodes · 1724 edges · 30 communities
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 257 edges (avg confidence: 0.87)
- Token cost: 574,916 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_API Keys, Identity & Settings|API Keys, Identity & Settings]]
- [[_COMMUNITY_Discovery Outputs & Behavioral Questions|Discovery Outputs & Behavioral Questions]]
- [[_COMMUNITY_Overview, Usage, Console & Integrations|Overview, Usage, Console & Integrations]]
- [[_COMMUNITY_Architecture, Domain Model & Screens|Architecture, Domain Model & Screens]]
- [[_COMMUNITY_Network, Proxy & Settings Audits|Network, Proxy & Settings Audits]]
- [[_COMMUNITY_Connections & Secret Storage (SP11)|Connections & Secret Storage (SP11)]]
- [[_COMMUNITY_Custom Providers (SP13b)|Custom Providers (SP13b)]]
- [[_COMMUNITY_Routing Screens & Router Design|Routing Screens & Router Design]]
- [[_COMMUNITY_Upstream Errors & Streaming Decisions|Upstream Errors & Streaming Decisions]]
- [[_COMMUNITY_Chat Lane Routing Matrix (SP12)|Chat Lane Routing Matrix (SP12)]]
- [[_COMMUNITY_Catalog API & Provider Screens (SP13)|Catalog API & Provider Screens (SP13)]]
- [[_COMMUNITY_Protocol Translation (SP10)|Protocol Translation (SP10)]]
- [[_COMMUNITY_SP9 Adapter & SSE Reader|SP9 Adapter & SSE Reader]]
- [[_COMMUNITY_API-UI Map & No-UI Rows|API-UI Map & No-UI Rows]]
- [[_COMMUNITY_Capabilities & Engine Contract (SP7)|Capabilities & Engine Contract (SP7)]]
- [[_COMMUNITY_Transport (SP8)|Transport (SP8)]]
- [[_COMMUNITY_Parity Coverage & Branding|Parity Coverage & Branding]]
- [[_COMMUNITY_Catalog Extraction & Registry (SP4, SP13)|Catalog Extraction & Registry (SP4, SP13)]]
- [[_COMMUNITY_Governance & Frontend Structure|Governance & Frontend Structure]]
- [[_COMMUNITY_Fallback Policy & ExecCtx|Fallback Policy & ExecCtx]]
- [[_COMMUNITY_Parity Tiers & Golden Scenarios|Parity Tiers & Golden Scenarios]]
- [[_COMMUNITY_Chat API v1 & Endpoint Screen|Chat API /v1 & Endpoint Screen]]
- [[_COMMUNITY_Error Taxonomy|Error Taxonomy]]
- [[_COMMUNITY_Skills, Milestone M0 & Decisions|Skills, Milestone M0 & Decisions]]
- [[_COMMUNITY_Handoff & Project Map|Handoff & Project Map]]
- [[_COMMUNITY_Definition of Done & Domain Model|Definition of Done & Domain Model]]
- [[_COMMUNITY_Parity Normalizer & M1 Gate|Parity Normalizer & M1 Gate]]
- [[_COMMUNITY_Transient Retry|Transient Retry]]
- [[_COMMUNITY_Lean Code Rules|Lean Code Rules]]
- [[_COMMUNITY_Timeouts|Timeouts]]

## God Nodes (most connected - your core abstractions)
1. `Identity and API keys contract (M1 SP6)` - 37 edges
2. `Bounded context: routing (core)` - 35 edges
3. `Feature Matrix — mandatory 17-column artifact` - 27 edges
4. `Milestone M-1 · Discovery` - 27 edges
5. `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` - 27 edges
6. `Bounded context: connections` - 26 edges
7. `The 23 feature groups required by behavioral.md §5` - 26 edges
8. `SP6 — identity + apikeys (password login + key validation only)` - 25 edges
9. `shared/errors.ts toProblem() — the one code-to-message table` - 24 edges
10. `ChatLane (modules/routing/infrastructure/chat-lane.ts)` - 23 edges

## Surprising Connections (you probably didn't know these)
- `identity.machine-id-derivation` --conceptually_related_to--> `Bounded context: identity`  [INFERRED]
  docs/contracts/identity-apikeys.md → docs/superpowers/specs/2026-09-22-aigate-design.md
- `TransportModule (injects DirectTransport under HTTP_TRANSPORT)` --implements--> `Bounded context: transport`  [INFERRED]
  docs/contracts/transport.md → docs/superpowers/specs/2026-09-22-aigate-design.md
- `ErrorCode: TIMEOUT` --conceptually_related_to--> `UI error code: TIMEOUT`  [AMBIGUOUS]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/API_UI_MAP.md
- `LLM Providers — /providers, /:id, /new` --references--> `/providers/new → CustomProviderForm (create; ?id= edit); save → Add connection modal preselected`  [INFERRED]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/API_UI_MAP.md
- `LLM Providers — /providers, /:id, /new` --references--> `/providers → Custom providers section (features/providers/custom.tsx): Connect, Edit, Delete`  [INFERRED]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/API_UI_MAP.md

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
- **SP12 request path: key gate → parse → resolve + capabilities → adapter → encode with backpressure** — chat_lane_key_gate, protocol_parse_openai_chat, chat_lane_model_resolution, adapter_openai_compatible, protocol_stream_encoder, chat_lane_backpressure [EXTRACTED 1.00]
- **SP3 replay loop: tape → AIGate (stubbed vendor) → normalizer → judge against 9router with declared deviations** — parity_tapes, chat_lane_service, parity_normalizer, parity_judge, parity_deviations [EXTRACTED 1.00]
- **SP4 loop: 9router registry → extract → CATALOG → verify diff (0) + validateCatalog** — extract_tool, catalog_generated, extract_verify, catalog_schema, rule_no_invented_limits [EXTRACTED 1.00]
- **Catalog → registry → /api/providers → /providers screens** — catalog_generated, builtin_registry_catalog, catalog_controller, hook_use_providers, api_ui_map_screen_llm_providers_wired, api_ui_map_screen_provider_detail_wired [EXTRACTED 1.00]
- **Custom provider: form → /api/provider-nodes → connection → /v1 <prefix>/<model>** — screen_custom_provider_form, hook_use_provider_nodes, provider_nodes_controller, provider_nodes_repo, connections_controller, chat_lane_custom_prefix [EXTRACTED 1.00]

## Communities (30 total, 0 thin omitted)

### Community 0 - "API Keys, Identity & Settings"
Cohesion: 0.05
Nodes (98): apikey.delete-key, apikey.generate-key, apikey.legacy-format-unenforced, apikey.list-keys, apikey.update-key-status, apikey.validate-lookup, endpoint.enforce-require-api-key, identity.auth-status-disclosure (+90 more)

### Community 1 - "Discovery Outputs & Behavioral Questions"
Cohesion: 0.05
Nodes (64): docs/capabilities.md (GENERATED capability specification), docs/discovery/coverage.md, docs/discovery/gaps.md (Gap register), docs/discovery/inventory.json, §30 The 12 pre-implementation questions, §3 The 20 behavioral questions (trigger…edge cases), §2 Core principles — never port, rename, or translate 9router line by line, §29 Definition of Done — 13 checklist items, no self-declared DONE (+56 more)

### Community 2 - "Overview, Usage, Console & Integrations"
Cohesion: 0.09
Nodes (59): GET /overview/summary, SSE /events/requests, /traffic/console → Console (Developer mode only), /integrations/* → CliTools, CliToolDetail, Skills, Mcp, / → Overview, /traffic/usage, /traffic/requests* → Usage, Requests, RequestDetail, Audit finding: Console shown in sidebar regardless of Developer mode, Audit FAIL: only the happy path was drawn (state rules §10.7) (+51 more)

### Community 3 - "Architecture, Domain Model & Screens"
Cohesion: 0.09
Nodes (54): validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, API_UI_MAP row: M0 SP4 tools/extract + CATALOG, No UI yet (SP13 serves /providers), /providers/media* → MediaProviders, /providers/quota → Quota; custom provider form; multi-account, §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra), §9 Build an explicit domain model (Provider, Quota, RoutingPolicy…), §5 Feature discovery — inventory every group, do not trust the UI menu, §6 Feature Matrix requirement — nothing is understood until fully traced (+46 more)

### Community 4 - "Network, Proxy & Settings Audits"
Cohesion: 0.11
Nodes (48): settings.outbound-proxy-live-apply, settings.proxy-test-outbound-probe, /network/* → ProxyPools, DeployWizard, Tunnel, Mitm, /settings/auth OIDC and SAML tabs, /settings/general → SettingsGeneral, Audit PASS: no credential leaked across 27 HTML exports, Audit finding: MITM CA buttons adjacent, type-to-confirm modal missing, Audit finding: settings-auth regenerated as settings-auth-v2 (+40 more)

### Community 5 - "Connections & Secret Storage (SP11)"
Cohesion: 0.11
Nodes (30): catalog.connection-detail-crud, catalog.connection-listing, connection.client-listing-sanitized, connection.test-single-connection, connection.create-dedup-and-priority-assignment, connection.delete-and-reorder, connection.storage-shape-json-blob, DELETE /api/connections/:id (+22 more)

### Community 6 - "Custom Providers (SP13b)"
Cohesion: 0.12
Nodes (25): connection.provider-node-create-list, connection.provider-node-repo-storage, connection.provider-node-update-delete, connection.provider-node-validate-partial-ssrf (stays traced: no validate route), DELETE /api/provider-nodes/:id (cascades the connection), GET /api/provider-nodes, PATCH /api/provider-nodes/:id, POST /api/provider-nodes (+17 more)

### Community 7 - "Routing Screens & Router Design"
Cohesion: 0.17
Nodes (24): endpoint.rewrite-lanes, settings.combo-rotation-reset, /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver, Audit finding: routing-fallback merged 4 tabs into one 3886px screen, §12 Router is its own business engine, not controller logic, Routing simulator (decision-tree dry run), Bounded context: routing (core), GAP: Token Saver screen missing from the U0–U11 table (+16 more)

### Community 8 - "Upstream Errors & Streaming Decisions"
Cohesion: 0.14
Nodes (19): fallback.error-classification, fallback.partial-stream-failure, fallback.upstream-error-result, routing.default-executor-openai-fallback, routing.non-streaming-response, routing.stream-mode-decision, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O (+11 more)

### Community 9 - "Chat Lane Routing Matrix (SP12)"
Cohesion: 0.16
Nodes (17): catalog.model-listing-live-override, fallback.accounts-exhausted-response, routing.client-disconnect-propagation, routing.lane-entry-routes, routing.model-resolution, routing.request-preflight, §18 Streaming is first-class (TTFT, cancellation, backpressure), Backpressure: a false write() waits for drain; the upstream read pauses with it (+9 more)

### Community 10 - "Catalog API & Provider Screens (SP13)"
Cohesion: 0.17
Nodes (16): Adapter: catalog headers first, key last; raw or Bearer scheme; chatUrl/modelsUrl called directly, GET /api/providers/:id (chatUrl + models; 404 NOT_FOUND), GET /api/providers (all 121, connectable + reason), UI error code: PROVIDER_NOT_SUPPORTED (400), /providers → LlmProviders (catalog from GET /api/providers; Connected / Coming later pills), /providers/detail → ProviderDetail (Connection panel or reason; Models table), builtinRegistry built from CATALOG (41 connectable providers), apps/server/test/catalog.test.mjs (catalog API) + chat-lane resolution tests (+8 more)

### Community 11 - "Protocol Translation (SP10)"
Cohesion: 0.21
Nodes (15): routing.request-translation, routing.source-format-detection, translator.pivot-loss, translator.tool-id-normalization, toOpenAIChatCompletion() — CanonicalResponse → chat.completion JSON, Rule: safe upstream codes (context_length_exceeded) reach the client, OpenAI Chat Completions protocol adapter contract (M1 SP10), parseOpenAIChatRequest() — OpenAI body → CanonicalRequest (INVALID_REQUEST names the field) (+7 more)

### Community 12 - "SP9 Adapter & SSE Reader"
Cohesion: 0.19
Nodes (14): OpenAICompatibleAdapter (AIProviderPort for openai-compatible), readSseData() — bounded SSE reader (1 Mi chars per line/event, cancels body), packages/engine/test/openai-adapter.test.mjs (15 tests, fake transport, SSE split every 3 bytes; 16 mutations caught), Refused before I/O: video, media by URL, assistant thinking, tool_result.isError, budgetTokens, foreign vendorExtensions, TokenUsage normalized: inputTokens excludes cache reads, outputTokens includes reasoning, Canonical Internal Protocol (CIP), vendorExtensions — typed carry-through field, src/json.ts — shared JSON narrowing (isRecord, record, text, list, parseJson) (+6 more)

### Community 13 - "API-UI Map & No-UI Rows"
Cohesion: 0.31
Nodes (14): API ↔ UI map (docs/design/API_UI_MAP.md), API_UI_MAP row: SP7 packages/engine, No UI, API_UI_MAP row: SP8 transport, No UI, Rule: an SP with no HTTP API records "No UI" in its row, Milestone M1 · Walking skeleton (thin end-to-end slice), HttpTransportPort, Gap: M0 SP3 (parity harness) and SP4 (tools/extract) never built, Next step: M1 SP8 transport (HttpTransportPort, direct + timeout, no UI) (+6 more)

### Community 14 - "Capabilities & Engine Contract (SP7)"
Cohesion: 0.28
Nodes (13): catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, combo.detect-required-capabilities, Engine contract (M1 SP7), defineRegistry() / builtinRegistry (single openai entry, 4 chat models), detectRequiredCapabilities() (+5 more)

### Community 15 - "Transport (SP8)"
Cohesion: 0.17
Nodes (13): transport.proxy-priority-chain, transport.test.mjs: adapter streams end to end over DirectTransport, DirectTransport (direct branch implementation), Upstream answers 4xx or 5xx, Failure: malformed URL or non-https (http only to localhost/127.0.0.1/[::1]), Failure: timeoutMs not an integer from 1 to 600000, HttpRequest (requires timeoutMs), HttpResponse (+5 more)

### Community 16 - "Parity Coverage & Branding"
Cohesion: 0.22
Nodes (13): API_UI_MAP row: M0 SP3 parity harness, No UI, Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Stated limits of tape-based parity, Recording proxy + 4-part tape, pnpm parity record | replay | live | gate, Parity harness contract (M0 SP3) and the M1 acceptance gate, tools/parity/src/live.mjs — tier 2 against OpenAI (OPENAI_API_KEY, ≤16 tokens per tape) (+5 more)

### Community 17 - "Catalog Extraction & Registry (SP4, SP13)"
Cohesion: 0.21
Nodes (12): catalog.registry-build, catalog.registry-entry-shape, ListedModel { id, descriptor? } — getModels never invents limits (≤1000 ids), CATALOG — providers.generated.ts (121 providers, 935 models; never hand-edited), CatalogProvider / CatalogModel / validateCatalog (packages/engine/src/catalog/schema.ts), Registry extraction contract (M0 SP4), tools/extract (deleted in SP13b; restorable from git d2783c1) — wrote the catalog from 9router, tools/extract verify (deleted in SP13b with the tool) (+4 more)

### Community 18 - "Governance & Frontend Structure"
Cohesion: 0.20
Nodes (12): usage.write-not-synchronous, GET /health, 9router as Behavioral Source of Truth (not a template to port), Feature-based frontend structure with import boundaries, Hexagonal architecture, granularity = bounded context, Monorepo layout (apps/server, apps/web, apps/cli, packages/engine, contracts, database, tools), Open decisions not settled by this spec, AIGate Design Spec (2026-09-22) (+4 more)

### Community 19 - "Fallback Policy & ExecCtx"
Cohesion: 0.21
Nodes (12): §8 Business rule beats old implementation, §19 Fallback as explicit policy with classified errors, Canonical error classification codes (8 values), ExecCtx (one shared client-cancel + deadline signal), withRetry() — bounded retry helper (≤10 attempts, capped backoff, abortable), tools/lint/check.test.mjs (lint:check 13/13), Lint rule aigate/fetch-through-transport, Lint rule aigate/fetch-timeout (accepts AbortSignal.any([..., AbortSignal.timeout(n)])) (+4 more)

### Community 20 - "Parity Tiers & Golden Scenarios"
Cohesion: 0.30
Nodes (12): Parity verification — 3 tiers, apps/server/test/golden.test.mjs — 13 golden scenarios at M1 scope (3 deferred: SP16, SP17, SP19), Golden scenario: all providers unavailable, Golden scenario: client cancellation, Golden scenario: invalid credentials, Golden scenario: model unavailable, Golden scenario: normal completion, Golden scenario: provider fallback (+4 more)

### Community 21 - "Chat API /v1 & Endpoint Screen"
Cohesion: 0.24
Nodes (11): endpoint.extract-header-order, routing.streaming-pipeline, API_UI_MAP row: SP10 OpenAI Chat protocol, No UI, API_UI_MAP row: SP9 OpenAICompatibleAdapter, No UI, /gateway/endpoint readiness pill (Ready / Connect a provider / Check connection) + curl test, POST /v1/chat/completions + GET /v1/models (/v1 Chat API), Idle timeout between chunks (AIGATE_STREAM_IDLE_TIMEOUT_MS, default 300 s) → TIMEOUT error event, extractApiKey() (Authorization: Bearer first, then x-api-key) (+3 more)

### Community 22 - "Error Taxonomy"
Cohesion: 0.25
Nodes (11): Status → ErrorCode by status + error.code/type only (never message text), Error taxonomy (8 ErrorCodes), assertModelSupports() — MODEL_UNAVAILABLE / INVALID_REQUEST, FALLBACK_POLICY (8 error codes as data), ErrorCode: AUTH_ERROR, ErrorCode: INTERNAL_ERROR, ErrorCode: INVALID_REQUEST, ErrorCode: MODEL_UNAVAILABLE (+3 more)

### Community 23 - "Skills, Milestone M0 & Decisions"
Cohesion: 0.24
Nodes (10): Split: machines block mechanics, skills teach judgement, Iron law: no skill without a failing test first (RED → GREEN → REFACTOR), UI performance constraints, Milestone M0 · Foundation, Decision (user, 2026-09-25): route all four SQLite clients through one locked sqlite-proxy wrapper, Locked sqlite-proxy wrapper (AsyncLocalStorage, BEGIN/COMMIT around batch), Skill: writing-lean-bounded-code, SP0 — 2 skills + mechanical lint suite (+2 more)

### Community 24 - "Handoff & Project Map"
Cohesion: 0.39
Nodes (8): docs/PROJECT_MAP.md (generated U-project ownership map), Rule: an API is done only when its UI screen is wired in the same SP, Decision: CLAUDE.md requires wiring the screen in the same SP as its API, AIGate progress handoff (docs/PROGRESS_HANDOFF.md), Decision (user): build the Stitch UI before connecting application logic, UI ownership handoff (docs/design/UI_HANDOFF.md), Claude's integration boundary (keep shell/screens markup, add feature api.ts hooks), UI_READY — visual layout implemented with demo data only

### Community 25 - "Definition of Done & Domain Model"
Cohesion: 0.32
Nodes (8): Definition of Done — 13 items, not self-awarded, AIGate domain model (Provider, Credential, RoutingPolicy, AccountLock, …), IMPLEMENTATION_ACCIDENT — debt not inherited from 9router, Mandatory 6-phase feature process (A Discovery → F Parity), AccountLock entity, Golden scenario: account failover, Skill: porting-behavior-not-code, SP17 — Multi-account fallback: fill-first/round-robin/sticky, AccountLock, provider-keyed mutex

### Community 26 - "Parity Normalizer & M1 Gate"
Cohesion: 0.40
Nodes (6): Normalizer + semantic SSE diff (not chunk diff), docs/parity/m1-gate-report.md — M1 gate: tier 1 11/11, golden 10 pass + 3 deferred, tier 2 waits for a key, coverage 11/284, tools/parity/src/replay.mjs judge — every difference must be a labeled deviation with AIGate's value, tools/parity/src/normalize.mjs — semantic response view (text, tool calls, finish, usage, terminal, error), Parity tier 1 — Client contract (PASS/FAIL, the real contract), Parity tier 3 — Upstream shape drift (warning only)

### Community 27 - "Transient Retry"
Cohesion: 0.50
Nodes (5): fallback.executor-retry-budget, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, ErrorCode: PROVIDER_UNAVAILABLE, Failure: connection refused, DNS failure, TLS failure, Failure: upstream answers 3xx (redirect not followed)

### Community 28 - "Lean Code Rules"
Cohesion: 0.50
Nodes (4): §15 Code quality — shortest CLEAR implementation, not shortest possible, Rule 1 — Write LEAN code, no over-engineering, Rule 2 — Code must be maintainable, no magic values or hidden side effects, Rule 12 — Priority order: Correctness → Simplicity → Maintainability → Predictable resources → Latency → Throughput → Optimization

### Community 29 - "Timeouts"
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
- **21 isolated node(s):** `ErrorCode: INTERNAL_ERROR`, `02-providers-auth.yaml`, `03-accounts-multiaccount.yaml`, `05-request-routing-fallback.yaml`, `07-token-saver.yaml` (+16 more)
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
- **Why does `Bounded context: routing (core)` connect `Routing Screens & Router Design` to `API Keys, Identity & Settings`, `Discovery Outputs & Behavioral Questions`, `Overview, Usage, Console & Integrations`, `Architecture, Domain Model & Screens`, `Network, Proxy & Settings Audits`, `Custom Providers (SP13b)`, `Protocol Translation (SP10)`, `SP9 Adapter & SSE Reader`, `API-UI Map & No-UI Rows`, `Chat API /v1 & Endpoint Screen`, `Error Taxonomy`, `Definition of Done & Domain Model`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **Why does `Task board (PROGRESS_HANDOFF)` connect `API-UI Map & No-UI Rows` to `API Keys, Identity & Settings`, `Discovery Outputs & Behavioral Questions`, `Architecture, Domain Model & Screens`, `Catalog API & Provider Screens (SP13)`, `Protocol Translation (SP10)`, `Parity Coverage & Branding`, `Governance & Frontend Structure`, `Chat API /v1 & Endpoint Screen`, `Skills, Milestone M0 & Decisions`, `Handoff & Project Map`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._