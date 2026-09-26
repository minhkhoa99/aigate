# Graph Report - docs  (2026-09-26)

## Corpus Check
- 24 files · ~54,142 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 678 nodes · 1789 edges · 23 communities
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 261 edges (avg confidence: 0.87)
- Token cost: 574,916 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_API Keys, Identity & Settings|API Keys, Identity & Settings]]
- [[_COMMUNITY_Overview, Network & Console Screens|Overview, Network & Console Screens]]
- [[_COMMUNITY_Endpoints, Media & Gap Register|Endpoints, Media & Gap Register]]
- [[_COMMUNITY_Discovery Outputs & Behavioral Questions|Discovery Outputs & Behavioral Questions]]
- [[_COMMUNITY_Connections & Secret Storage (SP11)|Connections & Secret Storage (SP11)]]
- [[_COMMUNITY_Custom Providers, Anthropic Nodes & Stream-Only (SP13b, SP14b)|Custom Providers, Anthropic Nodes & Stream-Only (SP13b, SP14b)]]
- [[_COMMUNITY_Error Taxonomy, Parity & Governance|Error Taxonomy, Parity & Governance]]
- [[_COMMUNITY_Protocol Translation & OpenAI Adapter|Protocol Translation & OpenAI Adapter]]
- [[_COMMUNITY_Capabilities & API-UI Map|Capabilities & API-UI Map]]
- [[_COMMUNITY_Upstream Errors & Stream Mode|Upstream Errors & Stream Mode]]
- [[_COMMUNITY_Chat Lane Routing Matrix (SP12)|Chat Lane Routing Matrix (SP12)]]
- [[_COMMUNITY_Transport Retry & Redaction|Transport Retry & Redaction]]
- [[_COMMUNITY_Skills, Milestone M0 & Decisions|Skills, Milestone M0 & Decisions]]
- [[_COMMUNITY_Catalog Registry & Anthropic Adapter (SP13, SP14a)|Catalog Registry & Anthropic Adapter (SP13, SP14a)]]
- [[_COMMUNITY_Architecture & Monorepo|Architecture & Monorepo]]
- [[_COMMUNITY_Catalog Extraction & Registry Schema (SP4)|Catalog Extraction & Registry Schema (SP4)]]
- [[_COMMUNITY_Handoff, Project Map & UI Ownership|Handoff, Project Map & UI Ownership]]
- [[_COMMUNITY_Client Cancellation & Backpressure|Client Cancellation & Backpressure]]
- [[_COMMUNITY_Streaming Pipeline & Idle Timeout|Streaming Pipeline & Idle Timeout]]
- [[_COMMUNITY_Chat API v1 & Endpoint Screen|Chat API /v1 & Endpoint Screen]]
- [[_COMMUNITY_Partial Stream Failure|Partial Stream Failure]]
- [[_COMMUNITY_Retry Helper & Lint Rules|Retry Helper & Lint Rules]]
- [[_COMMUNITY_Lean Code Rules|Lean Code Rules]]

## God Nodes (most connected - your core abstractions)
1. `Identity and API keys contract (M1 SP6)` - 37 edges
2. `Bounded context: routing (core)` - 35 edges
3. `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` - 31 edges
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
- `MITM — /network/mitm` --semantically_similar_to--> `Settings · Developer (/settings/developer)`  [INFERRED] [semantically similar]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/stitch-briefs.md
- `Feature group — MCP (API with no UI, found during spec work)` --conceptually_related_to--> `The 23 feature groups required by behavioral.md §5`  [AMBIGUOUS]
  docs/superpowers/plans/2026-09-22-m1-discovery.md → docs/governance/behavioral.md
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
- **Anthropic-compatible custom providers: storage, descriptor, adapter headers, connection test, UI** — provider_nodes_type_column, anthropic_node_descriptor, anthropic_node_betas, anthropic_node_connection_test, node_rules_unreachable, anthropic_adapter [EXTRACTED 1.00]

## Communities (23 total, 0 thin omitted)

### Community 0 - "API Keys, Identity & Settings"
Cohesion: 0.05
Nodes (107): apikey.delete-key, apikey.generate-key, apikey.legacy-format-unenforced, apikey.list-keys, apikey.update-key-status, apikey.validate-lookup, endpoint.enforce-require-api-key, identity.auth-status-disclosure (+99 more)

### Community 1 - "Overview, Network & Console Screens"
Cohesion: 0.05
Nodes (100): settings.outbound-proxy-live-apply, settings.proxy-test-outbound-probe, usage.write-not-synchronous, GET /overview/summary, SSE /events/requests, /traffic/console → Console (Developer mode only), /integrations/* → CliTools, CliToolDetail, Skills, Mcp, /network/* → ProxyPools, DeployWizard, Tunnel, Mitm (+92 more)

### Community 2 - "Endpoints, Media & Gap Register"
Cohesion: 0.06
Nodes (82): endpoint.rewrite-lanes, validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, /providers/media* → MediaProviders, /providers/quota → Quota; custom provider form; multi-account, /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver, docs/discovery/gaps.md (Gap register), §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra), §9 Build an explicit domain model (Provider, Quota, RoutingPolicy…) (+74 more)

### Community 3 - "Discovery Outputs & Behavioral Questions"
Cohesion: 0.05
Nodes (62): docs/capabilities.md (GENERATED capability specification), docs/discovery/coverage.md, docs/discovery/inventory.json, §30 The 12 pre-implementation questions, §3 The 20 behavioral questions (trigger…edge cases), §8 Business rule beats old implementation, §2 Core principles — never port, rename, or translate 9router line by line, §29 Definition of Done — 13 checklist items, no self-declared DONE (+54 more)

### Community 4 - "Connections & Secret Storage (SP11)"
Cohesion: 0.07
Nodes (48): catalog.connection-detail-crud, catalog.connection-listing, connection.client-listing-sanitized, connection.test-single-connection, connection.create-dedup-and-priority-assignment, connection.delete-and-reorder, connection.storage-shape-json-blob, GET /api/providers/:id (chatUrl + models; 404 NOT_FOUND) (+40 more)

### Community 5 - "Custom Providers, Anthropic Nodes & Stream-Only (SP13b, SP14b)"
Cohesion: 0.07
Nodes (47): connection.anthropic-compatible-node, connection.provider-node-create-list, connection.provider-node-repo-storage, connection.provider-node-update-delete, connection.provider-node-validate-partial-ssrf (stays traced: no validate route), routing.forced-stream-json-collapse, provider.anthropic-auth-and-headers, provider.codebuddy-request-quirks (+39 more)

### Community 6 - "Error Taxonomy, Parity & Governance"
Cohesion: 0.08
Nodes (47): Status → ErrorCode by status + error.code/type only (never message text), API_UI_MAP row: M0 SP3 parity harness, No UI, Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Error taxonomy (8 ErrorCodes), Stated limits of tape-based parity, Parity verification — 3 tiers, Recording proxy + 4-part tape (+39 more)

### Community 7 - "Protocol Translation & OpenAI Adapter"
Cohesion: 0.15
Nodes (22): routing.request-translation, routing.source-format-detection, translator.pivot-loss, translator.tool-id-normalization, OpenAICompatibleAdapter (AIProviderPort for openai-compatible), packages/engine/test/openai-adapter.test.mjs (15 tests, fake transport, SSE split every 3 bytes; 16 mutations caught), Refused before I/O: video, media by URL, assistant thinking, tool_result.isError, budgetTokens, foreign vendorExtensions, TokenUsage normalized: inputTokens excludes cache reads, outputTokens includes reasoning (+14 more)

### Community 8 - "Capabilities & API-UI Map"
Cohesion: 0.20
Nodes (19): catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, combo.detect-required-capabilities, API ↔ UI map (docs/design/API_UI_MAP.md), API_UI_MAP row: SP7 packages/engine, No UI, API_UI_MAP row: SP8 transport, No UI (+11 more)

### Community 9 - "Upstream Errors & Stream Mode"
Cohesion: 0.13
Nodes (18): fallback.error-classification, fallback.executor-retry-budget, fallback.upstream-error-result, routing.default-executor-openai-fallback, routing.non-streaming-response, routing.stream-mode-decision, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O (+10 more)

### Community 10 - "Chat Lane Routing Matrix (SP12)"
Cohesion: 0.17
Nodes (16): catalog.model-listing-live-override, fallback.accounts-exhausted-response, routing.lane-entry-routes, routing.model-resolution, routing.request-preflight, Chat lane contract (M1 SP12), Key gate in onRequest, before the body is read (401 missing_api_key / invalid_api_key), Keyless mode serves this machine only (loopback socket, Host, Origin) → 403 api_key_required (+8 more)

### Community 11 - "Transport Retry & Redaction"
Cohesion: 0.16
Nodes (16): transport.test.mjs: adapter streams end to end over DirectTransport, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, ErrorCode: PROVIDER_UNAVAILABLE, DirectTransport (direct branch implementation), Failure: body larger than maxBytes in readBoundedText, Upstream answers 4xx or 5xx, Failure: malformed URL or non-https (http only to localhost/127.0.0.1/[::1]), Failure: connection refused, DNS failure, TLS failure (+8 more)

### Community 12 - "Skills, Milestone M0 & Decisions"
Cohesion: 0.19
Nodes (15): API_UI_MAP row: M0 SP4 tools/extract + CATALOG, No UI yet (SP13 serves /providers), Split: machines block mechanics, skills teach judgement, Iron law: no skill without a failing test first (RED → GREEN → REFACTOR), UI performance constraints, Milestone M0 · Foundation, Decision (user, 2026-09-25): route all four SQLite clients through one locked sqlite-proxy wrapper, AIGate progress handoff (docs/PROGRESS_HANDOFF.md), Gap: M0 SP3 (parity harness) and SP4 (tools/extract) never built (+7 more)

### Community 13 - "Catalog Registry & Anthropic Adapter (SP13, SP14a)"
Cohesion: 0.21
Nodes (14): catalog.registry-build, catalog.registry-entry-shape, Adapter: catalog headers first, key last; raw or Bearer scheme; chatUrl/modelsUrl called directly, GET /api/providers (all 121, connectable + reason), API_UI_MAP row: SP14a AnthropicAdapter — no new screen; /providers pills follow connectable, /providers → LlmProviders (catalog from GET /api/providers; Connected / Coming later pills), builtinRegistry built from CATALOG (41 connectable providers), apps/server/test/catalog.test.mjs (catalog API) + chat-lane resolution tests (+6 more)

### Community 14 - "Architecture & Monorepo"
Cohesion: 0.22
Nodes (11): GET /health, 9router as Behavioral Source of Truth (not a template to port), Feature-based frontend structure with import boundaries, Hexagonal architecture, granularity = bounded context, Monorepo layout (apps/server, apps/web, apps/cli, packages/engine, contracts, database, tools), Open decisions not settled by this spec, AIGate Design Spec (2026-09-22), Decision 1 (user, 2026-09-25): API keys are random and stored as a hash (+3 more)

### Community 15 - "Catalog Extraction & Registry Schema (SP4)"
Cohesion: 0.27
Nodes (10): ListedModel { id, descriptor? } — getModels never invents limits (≤1000 ids), CATALOG — providers.generated.ts (121 providers, 935 models; never hand-edited), CatalogProvider / CatalogModel / validateCatalog (packages/engine/src/catalog/schema.ts), defineRegistry() / builtinRegistry (single openai entry, 4 chat models), tools/extract (deleted in SP13b; restorable from git d2783c1) — wrote the catalog from 9router, tools/extract verify (deleted in SP13b with the tool), Rule: model ids unique per (kind, id) — Gemini 2.5 serves both chat and stt, Rule: limits only when declared; 9router's floor 200000/64000 becomes null (sentinel probe) (+2 more)

### Community 16 - "Handoff, Project Map & UI Ownership"
Cohesion: 0.36
Nodes (8): docs/PROJECT_MAP.md (generated U-project ownership map), Rule: an API is done only when its UI screen is wired in the same SP, Decision: CLAUDE.md requires wiring the screen in the same SP as its API, Decision (user): build the Stitch UI before connecting application logic, UI ownership handoff (docs/design/UI_HANDOFF.md), Claude's integration boundary (keep shell/screens markup, add feature api.ts hooks), UI_READY — visual layout implemented with demo data only, ?uiState=loading|empty|error preview parameter

### Community 17 - "Client Cancellation & Backpressure"
Cohesion: 0.33
Nodes (7): routing.client-disconnect-propagation, §18 Streaming is first-class (TTFT, cancellation, backpressure), Backpressure: a false write() waits for drain; the upstream read pauses with it, One ExecCtx signal: client disconnect + 600 s budget (TIMEOUT) + idle watchdog, ExecCtx (one shared client-cancel + deadline signal), Golden scenario: client cancellation, Failure: caller ctx.signal aborts (client left, budget spent)

### Community 18 - "Streaming Pipeline & Idle Timeout"
Cohesion: 0.29
Nodes (7): routing.streaming-pipeline, transport.proxy-priority-chain, readSseData() — bounded SSE reader (1 Mi chars per line/event, cancels body), Idle timeout between chunks (AIGATE_STREAM_IDLE_TIMEOUT_MS, default 300 s) → TIMEOUT error event, Deferred: streaming idle timeout (gap between chunks) with SP12, HttpRequest (requires timeoutMs), Rule: every call states timeoutMs (1 to 600000 ms), bounding headers and body inside ctx.signal

### Community 19 - "Chat API /v1 & Endpoint Screen"
Cohesion: 0.53
Nodes (6): endpoint.extract-header-order, API_UI_MAP row: SP10 OpenAI Chat protocol, No UI, /gateway/endpoint readiness pill (Ready / Connect a provider / Check connection) + curl test, POST /v1/chat/completions + GET /v1/models (/v1 Chat API), extractApiKey() (Authorization: Bearer first, then x-api-key), SP12 — routing: chat lane + Fastify raw streaming, backpressure, cancellation

### Community 20 - "Partial Stream Failure"
Cohesion: 0.53
Nodes (6): fallback.partial-stream-failure, Truncated stream or error event → PROVIDER_UNAVAILABLE with details.partial, Stream headers only after the first chunk: earlier failures are real JSON statuses, Golden scenario: partial stream failure, OpenAIChatStreamEncoder — StreamChunk → OpenAI SSE; fail() = error event, no [DONE], Usage chunk after the finish chunk, only with stream_options.include_usage

### Community 21 - "Retry Helper & Lint Rules"
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
- **20 isolated node(s):** `ErrorCode: INTERNAL_ERROR`, `02-providers-auth.yaml`, `03-accounts-multiaccount.yaml`, `05-request-routing-fallback.yaml`, `07-token-saver.yaml` (+15 more)
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
- **Why does `Bounded context: routing (core)` connect `Endpoints, Media & Gap Register` to `API Keys, Identity & Settings`, `Overview, Network & Console Screens`, `Discovery Outputs & Behavioral Questions`, `Error Taxonomy, Parity & Governance`, `Protocol Translation & OpenAI Adapter`, `Capabilities & API-UI Map`, `Upstream Errors & Stream Mode`, `Chat API /v1 & Endpoint Screen`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Why does `Task board (PROGRESS_HANDOFF)` connect `Skills, Milestone M0 & Decisions` to `API Keys, Identity & Settings`, `Overview, Network & Console Screens`, `Endpoints, Media & Gap Register`, `Discovery Outputs & Behavioral Questions`, `Error Taxonomy, Parity & Governance`, `Protocol Translation & OpenAI Adapter`, `Capabilities & API-UI Map`, `Upstream Errors & Stream Mode`, `Catalog Registry & Anthropic Adapter (SP13, SP14a)`, `Architecture & Monorepo`, `Chat API /v1 & Endpoint Screen`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._