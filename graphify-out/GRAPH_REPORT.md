# Graph Report - docs  (2026-09-26)

## Corpus Check
- 23 files · ~52,414 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 663 nodes · 1752 edges · 24 communities
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 261 edges (avg confidence: 0.87)
- Token cost: 574,916 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_API Keys, Identity & Settings|API Keys, Identity & Settings]]
- [[_COMMUNITY_Overview, Network & Console Screens|Overview, Network & Console Screens]]
- [[_COMMUNITY_Catalog, Custom Providers & Anthropic Adapter (SP4, SP13, SP14a)|Catalog, Custom Providers & Anthropic Adapter (SP4, SP13, SP14a)]]
- [[_COMMUNITY_Architecture, Domain Model & Screens|Architecture, Domain Model & Screens]]
- [[_COMMUNITY_Discovery Outputs & Behavioral Questions|Discovery Outputs & Behavioral Questions]]
- [[_COMMUNITY_Routing Screens, Latency & Audits|Routing Screens, Latency & Audits]]
- [[_COMMUNITY_Error Taxonomy & Governance|Error Taxonomy & Governance]]
- [[_COMMUNITY_Connections & Secret Storage (SP11)|Connections & Secret Storage (SP11)]]
- [[_COMMUNITY_Chat Lane Routing Matrix (SP12)|Chat Lane Routing Matrix (SP12)]]
- [[_COMMUNITY_API-UI Map & No-UI Rows|API-UI Map & No-UI Rows]]
- [[_COMMUNITY_Transport Retry & Redaction|Transport Retry & Redaction]]
- [[_COMMUNITY_Error Classification & OpenAI Adapter|Error Classification & OpenAI Adapter]]
- [[_COMMUNITY_Capabilities & Engine Contract (SP7)|Capabilities & Engine Contract (SP7)]]
- [[_COMMUNITY_Protocol Translation (SP10)|Protocol Translation (SP10)]]
- [[_COMMUNITY_Parity Coverage & Branding|Parity Coverage & Branding]]
- [[_COMMUNITY_Frontend Structure & Monorepo|Frontend Structure & Monorepo]]
- [[_COMMUNITY_Skills, Milestone M0 & Decisions|Skills, Milestone M0 & Decisions]]
- [[_COMMUNITY_Upstream Errors & Non-Streaming Response|Upstream Errors & Non-Streaming Response]]
- [[_COMMUNITY_Handoff & Project Map|Handoff & Project Map]]
- [[_COMMUNITY_Chat API v1 & Endpoint Screen|Chat API /v1 & Endpoint Screen]]
- [[_COMMUNITY_Partial Stream Failure|Partial Stream Failure]]
- [[_COMMUNITY_Retry Helper & Lint Rules|Retry Helper & Lint Rules]]
- [[_COMMUNITY_Transport Idle Timeout|Transport Idle Timeout]]
- [[_COMMUNITY_Lean Code Rules|Lean Code Rules]]

## God Nodes (most connected - your core abstractions)
1. `Identity and API keys contract (M1 SP6)` - 37 edges
2. `Bounded context: routing (core)` - 35 edges
3. `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` - 29 edges
4. `Feature Matrix — mandatory 17-column artifact` - 27 edges
5. `Milestone M-1 · Discovery` - 27 edges
6. `Bounded context: connections` - 26 edges
7. `The 23 feature groups required by behavioral.md §5` - 26 edges
8. `SP6 — identity + apikeys (password login + key validation only)` - 25 edges
9. `shared/errors.ts toProblem() — the one code-to-message table` - 24 edges
10. `ChatLane (modules/routing/infrastructure/chat-lane.ts)` - 24 edges

## Surprising Connections (you probably didn't know these)
- `TransportModule (injects DirectTransport under HTTP_TRANSPORT)` --implements--> `Bounded context: transport`  [INFERRED]
  docs/contracts/transport.md → docs/superpowers/specs/2026-09-22-aigate-design.md
- `ErrorCode: TIMEOUT` --conceptually_related_to--> `UI error code: TIMEOUT`  [AMBIGUOUS]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/API_UI_MAP.md
- `LLM Providers — /providers, /:id, /new` --references--> `/providers/new → CustomProviderForm (create; ?id= edit); save → Add connection modal preselected`  [INFERRED]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/API_UI_MAP.md
- `LLM Providers — /providers, /:id, /new` --references--> `/providers → Custom providers section (features/providers/custom.tsx): Connect, Edit, Delete`  [INFERRED]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/API_UI_MAP.md
- `Audit finding: routing-fallback merged 4 tabs into one 3886px screen` --references--> `U1 — Shell (router tree, query client, layout, 7-group sidebar, SSE client, error boundary, i18n)`  [INFERRED]
  docs/design/stitch-audit.md → docs/superpowers/specs/2026-09-22-aigate-design.md

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
- **Adapters chosen by protocol family behind AIProviderPort** — create_adapter, adapter_openai_compatible, anthropic_adapter, http_provider_adapter, provider_protocols [EXTRACTED 1.00]

## Communities (24 total, 0 thin omitted)

### Community 0 - "API Keys, Identity & Settings"
Cohesion: 0.05
Nodes (108): apikey.delete-key, apikey.generate-key, apikey.legacy-format-unenforced, apikey.list-keys, apikey.update-key-status, apikey.validate-lookup, endpoint.enforce-require-api-key, endpoint.rewrite-lanes (+100 more)

### Community 1 - "Overview, Network & Console Screens"
Cohesion: 0.07
Nodes (74): GET /overview/summary, SSE /events/requests, /traffic/console → Console (Developer mode only), /network/* → ProxyPools, DeployWizard, Tunnel, Mitm, / → Overview, /traffic/usage, /traffic/requests* → Usage, Requests, RequestDetail, Audit finding: Console shown in sidebar regardless of Developer mode, Audit PASS: no credential leaked across 27 HTML exports (+66 more)

### Community 2 - "Catalog, Custom Providers & Anthropic Adapter (SP4, SP13, SP14a)"
Cohesion: 0.05
Nodes (64): catalog.registry-build, catalog.registry-entry-shape, connection.provider-node-create-list, connection.provider-node-repo-storage, connection.provider-node-update-delete, connection.provider-node-validate-partial-ssrf (stays traced: no validate route), provider.anthropic-auth-and-headers, translator.claude-to-openai-response (+56 more)

### Community 3 - "Architecture, Domain Model & Screens"
Cohesion: 0.09
Nodes (60): validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, /integrations/* → CliTools, CliToolDetail, Skills, Mcp, /providers/media* → MediaProviders, /providers/quota → Quota; custom provider form; multi-account, §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra), §9 Build an explicit domain model (Provider, Quota, RoutingPolicy…), §5 Feature discovery — inventory every group, do not trust the UI menu, §6 Feature Matrix requirement — nothing is understood until fully traced (+52 more)

### Community 4 - "Discovery Outputs & Behavioral Questions"
Cohesion: 0.06
Nodes (59): docs/capabilities.md (GENERATED capability specification), docs/discovery/coverage.md, docs/discovery/gaps.md (Gap register), docs/discovery/inventory.json, §30 The 12 pre-implementation questions, §3 The 20 behavioral questions (trigger…edge cases), §8 Business rule beats old implementation, §2 Core principles — never port, rename, or translate 9router line by line (+51 more)

### Community 5 - "Routing Screens, Latency & Audits"
Cohesion: 0.09
Nodes (43): /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver, /settings/auth OIDC and SAML tabs, Audit finding: routing-fallback merged 4 tabs into one 3886px screen, §17 Latency — clean architecture must not add hot-path I/O, §20 No blind fallback — fallback follows error semantics, §16 Do not inherit performance issues; all large workloads bounded, §12 Router is its own business engine, not controller logic, §13 Translator/protocol separation — canonical vs vendor formats (+35 more)

### Community 6 - "Error Taxonomy & Governance"
Cohesion: 0.08
Nodes (42): Status → ErrorCode by status + error.code/type only (never message text), 9router as Behavioral Source of Truth (not a template to port), Definition of Done — 13 items, not self-awarded, AIGate domain model (Provider, Credential, RoutingPolicy, AccountLock, …), Error taxonomy (8 ErrorCodes), IMPLEMENTATION_ACCIDENT — debt not inherited from 9router, Parity verification — 3 tiers, Mandatory 6-phase feature process (A Discovery → F Parity) (+34 more)

### Community 7 - "Connections & Secret Storage (SP11)"
Cohesion: 0.10
Nodes (38): catalog.connection-detail-crud, catalog.connection-listing, connection.client-listing-sanitized, connection.test-single-connection, connection.create-dedup-and-priority-assignment, connection.delete-and-reorder, connection.storage-shape-json-blob, DELETE /api/connections/:id (+30 more)

### Community 8 - "Chat Lane Routing Matrix (SP12)"
Cohesion: 0.14
Nodes (19): catalog.model-listing-live-override, fallback.accounts-exhausted-response, routing.client-disconnect-propagation, routing.lane-entry-routes, routing.model-resolution, routing.request-preflight, §18 Streaming is first-class (TTFT, cancellation, backpressure), Backpressure: a false write() waits for drain; the upstream read pauses with it (+11 more)

### Community 9 - "API-UI Map & No-UI Rows"
Cohesion: 0.22
Nodes (18): API ↔ UI map (docs/design/API_UI_MAP.md), API_UI_MAP row: M0 SP4 tools/extract + CATALOG, No UI yet (SP13 serves /providers), API_UI_MAP row: SP7 packages/engine, No UI, API_UI_MAP row: SP8 transport, No UI, API_UI_MAP row: SP9 OpenAICompatibleAdapter, No UI, Failed mutations re-read the server; submit disabled while pending, Rule: an SP with no HTTP API records "No UI" in its row, HttpTransportPort (+10 more)

### Community 10 - "Transport Retry & Redaction"
Cohesion: 0.15
Nodes (16): fallback.executor-retry-budget, transport.test.mjs: adapter streams end to end over DirectTransport, Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, ErrorCode: PROVIDER_UNAVAILABLE, DirectTransport (direct branch implementation), Upstream answers 4xx or 5xx, Failure: malformed URL or non-https (http only to localhost/127.0.0.1/[::1]) (+8 more)

### Community 11 - "Error Classification & OpenAI Adapter"
Cohesion: 0.17
Nodes (15): fallback.error-classification, routing.default-executor-openai-fallback, routing.streaming-pipeline, OpenAICompatibleAdapter (AIProviderPort for openai-compatible), readSseData() — bounded SSE reader (1 Mi chars per line/event, cancels body), packages/engine/test/openai-adapter.test.mjs (15 tests, fake transport, SSE split every 3 bytes; 16 mutations caught), Refused before I/O: video, media by URL, assistant thinking, tool_result.isError, budgetTokens, foreign vendorExtensions, TokenUsage normalized: inputTokens excludes cache reads, outputTokens includes reasoning (+7 more)

### Community 12 - "Capabilities & Engine Contract (SP7)"
Cohesion: 0.26
Nodes (14): catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, combo.detect-required-capabilities, assertModelSupports() — MODEL_UNAVAILABLE / INVALID_REQUEST, Engine contract (M1 SP7), defineRegistry() / builtinRegistry (single openai entry, 4 chat models) (+6 more)

### Community 13 - "Protocol Translation (SP10)"
Cohesion: 0.23
Nodes (13): routing.request-translation, routing.source-format-detection, routing.stream-mode-decision, translator.pivot-loss, translator.tool-id-normalization, toOpenAIChatCompletion() — CanonicalResponse → chat.completion JSON, OpenAI Chat Completions protocol adapter contract (M1 SP10), parseOpenAIChatRequest() — OpenAI body → CanonicalRequest (INVALID_REQUEST names the field) (+5 more)

### Community 14 - "Parity Coverage & Branding"
Cohesion: 0.22
Nodes (13): API_UI_MAP row: M0 SP3 parity harness, No UI, Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Stated limits of tape-based parity, Recording proxy + 4-part tape, pnpm parity record | replay | live | gate, Parity harness contract (M0 SP3) and the M1 acceptance gate, tools/parity/src/live.mjs — tier 2 against OpenAI (OPENAI_API_KEY, ≤16 tokens per tape) (+5 more)

### Community 15 - "Frontend Structure & Monorepo"
Cohesion: 0.20
Nodes (12): usage.write-not-synchronous, GET /health, Feature-based frontend structure with import boundaries, Hexagonal architecture, granularity = bounded context, Monorepo layout (apps/server, apps/web, apps/cli, packages/engine, contracts, database, tools), Open decisions not settled by this spec, AIGate Design Spec (2026-09-22), Decision 1 (user, 2026-09-25): API keys are random and stored as a hash (+4 more)

### Community 16 - "Skills, Milestone M0 & Decisions"
Cohesion: 0.24
Nodes (10): Split: machines block mechanics, skills teach judgement, Iron law: no skill without a failing test first (RED → GREEN → REFACTOR), UI performance constraints, Milestone M0 · Foundation, Decision (user, 2026-09-25): route all four SQLite clients through one locked sqlite-proxy wrapper, Locked sqlite-proxy wrapper (AsyncLocalStorage, BEGIN/COMMIT around batch), Skill: writing-lean-bounded-code, SP0 — 2 skills + mechanical lint suite (+2 more)

### Community 17 - "Upstream Errors & Non-Streaming Response"
Cohesion: 0.28
Nodes (9): fallback.upstream-error-result, routing.non-streaming-response, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), Finding: 9router 0.5.55 errors carry only { message } with its node id and the raw upstream body, Finding: omitted stream on 9router 0.5.55 → JSON body sent as text/event-stream + bare [DONE] (unparsable), Finding: 9router adds 2000 tokens to reported prompt/total usage (addBufferToUsage) — SUSPECTED_BUG, tools/parity/src/scenarios.mjs DEVIATIONS — intentional differences from 9router, each with entry, label, reason, tools/parity/tapes — 11 tapes from 9router 0.5.55 (JSON, stream, tool calls, omitted stream, 400/401/429/500, cut stream) (+1 more)

### Community 18 - "Handoff & Project Map"
Cohesion: 0.36
Nodes (8): docs/PROJECT_MAP.md (generated U-project ownership map), Rule: an API is done only when its UI screen is wired in the same SP, Decision: CLAUDE.md requires wiring the screen in the same SP as its API, Decision (user): build the Stitch UI before connecting application logic, UI ownership handoff (docs/design/UI_HANDOFF.md), Claude's integration boundary (keep shell/screens markup, add feature api.ts hooks), UI_READY — visual layout implemented with demo data only, ?uiState=loading|empty|error preview parameter

### Community 19 - "Chat API /v1 & Endpoint Screen"
Cohesion: 0.43
Nodes (7): endpoint.extract-header-order, API_UI_MAP row: SP10 OpenAI Chat protocol, No UI, /gateway/endpoint readiness pill (Ready / Connect a provider / Check connection) + curl test, POST /v1/chat/completions + GET /v1/models (/v1 Chat API), extractApiKey() (Authorization: Bearer first, then x-api-key), SP12 — routing: chat lane + Fastify raw streaming, backpressure, cancellation, features/gateway/api.ts useChatReadiness — shared ["connections"] query

### Community 20 - "Partial Stream Failure"
Cohesion: 0.53
Nodes (6): fallback.partial-stream-failure, Truncated stream or error event → PROVIDER_UNAVAILABLE with details.partial, Stream headers only after the first chunk: earlier failures are real JSON statuses, Golden scenario: partial stream failure, OpenAIChatStreamEncoder — StreamChunk → OpenAI SSE; fail() = error event, no [DONE], Usage chunk after the finish chunk, only with stream_options.include_usage

### Community 21 - "Retry Helper & Lint Rules"
Cohesion: 0.53
Nodes (6): withRetry() — bounded retry helper (≤10 attempts, capped backoff, abortable), tools/lint/check.test.mjs (lint:check 13/13), Lint rule aigate/fetch-through-transport, Lint rule aigate/fetch-timeout (accepts AbortSignal.any([..., AbortSignal.timeout(n)])), Lint rule aigate/retry-through-helper, SP0.1 — Mechanical lint/CI suite (§11.2)

### Community 22 - "Transport Idle Timeout"
Cohesion: 0.40
Nodes (5): transport.proxy-priority-chain, Idle timeout between chunks (AIGATE_STREAM_IDLE_TIMEOUT_MS, default 300 s) → TIMEOUT error event, Deferred: streaming idle timeout (gap between chunks) with SP12, HttpRequest (requires timeoutMs), Rule: every call states timeoutMs (1 to 600000 ms), bounding headers and body inside ctx.signal

### Community 23 - "Lean Code Rules"
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
- **22 isolated node(s):** `ErrorCode: INTERNAL_ERROR`, `02-providers-auth.yaml`, `03-accounts-multiaccount.yaml`, `05-request-routing-fallback.yaml`, `07-token-saver.yaml` (+17 more)
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
- **Why does `Bounded context: routing (core)` connect `Routing Screens, Latency & Audits` to `API Keys, Identity & Settings`, `Overview, Network & Console Screens`, `Architecture, Domain Model & Screens`, `Discovery Outputs & Behavioral Questions`, `Error Taxonomy & Governance`, `API-UI Map & No-UI Rows`, `Protocol Translation (SP10)`, `Chat API /v1 & Endpoint Screen`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **Why does `Task board (PROGRESS_HANDOFF)` connect `API-UI Map & No-UI Rows` to `API Keys, Identity & Settings`, `Catalog, Custom Providers & Anthropic Adapter (SP4, SP13, SP14a)`, `Architecture, Domain Model & Screens`, `Discovery Outputs & Behavioral Questions`, `Protocol Translation (SP10)`, `Parity Coverage & Branding`, `Frontend Structure & Monorepo`, `Skills, Milestone M0 & Decisions`, `Chat API /v1 & Endpoint Screen`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._