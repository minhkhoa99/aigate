# Graph Report - docs  (2026-09-26)

## Corpus Check
- 20 files · ~47,818 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 615 nodes · 1646 edges · 19 communities
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 249 edges (avg confidence: 0.87)
- Token cost: 574,916 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_API Keys, Identity & Settings|API Keys, Identity & Settings]]
- [[_COMMUNITY_Catalog, Registry & Capabilities (SP4, SP7)|Catalog, Registry & Capabilities (SP4, SP7)]]
- [[_COMMUNITY_Providers, Credentials & Architecture|Providers, Credentials & Architecture]]
- [[_COMMUNITY_Discovery Outputs & Behavioral Questions|Discovery Outputs & Behavioral Questions]]
- [[_COMMUNITY_Parity Harness & Error Taxonomy (SP3)|Parity Harness & Error Taxonomy (SP3)]]
- [[_COMMUNITY_Routing Engine, Fallback & Latency|Routing Engine, Fallback & Latency]]
- [[_COMMUNITY_Connections & Secret Storage (SP11)|Connections & Secret Storage (SP11)]]
- [[_COMMUNITY_Transport, Network & UI Audits|Transport, Network & UI Audits]]
- [[_COMMUNITY_Transient Retry & Governance|Transient Retry & Governance]]
- [[_COMMUNITY_Overview, Usage & Observability|Overview, Usage & Observability]]
- [[_COMMUNITY_Integrations, Console & Design System|Integrations, Console & Design System]]
- [[_COMMUNITY_SP12 Chat Lane Matrix Entries|SP12 Chat Lane Matrix Entries]]
- [[_COMMUNITY_SP10 OpenAI Protocol & Translation|SP10 OpenAI Protocol & Translation]]
- [[_COMMUNITY_9router Findings Errors & Usage|9router Findings: Errors & Usage]]
- [[_COMMUNITY_SP9 Adapter & CIP|SP9 Adapter & CIP]]
- [[_COMMUNITY_Chat API v1 & Endpoint Screen|Chat API /v1 & Endpoint Screen]]
- [[_COMMUNITY_Partial Stream Failure & Encoder|Partial Stream Failure & Encoder]]
- [[_COMMUNITY_Stream Reading & Idle Timeout|Stream Reading & Idle Timeout]]
- [[_COMMUNITY_Lean Code Rules|Lean Code Rules]]

## God Nodes (most connected - your core abstractions)
1. `Identity and API keys contract (M1 SP6)` - 37 edges
2. `Bounded context: routing (core)` - 35 edges
3. `Feature Matrix — mandatory 17-column artifact` - 27 edges
4. `Milestone M-1 · Discovery` - 27 edges
5. `Bounded context: connections` - 26 edges
6. `The 23 feature groups required by behavioral.md §5` - 26 edges
7. `SP6 — identity + apikeys (password login + key validation only)` - 25 edges
8. `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` - 25 edges
9. `Overview — /` - 22 edges
10. `Settings contract (M1 SP5)` - 22 edges

## Surprising Connections (you probably didn't know these)
- `TransportModule (injects DirectTransport under HTTP_TRANSPORT)` --implements--> `Bounded context: transport`  [INFERRED]
  docs/contracts/transport.md → docs/superpowers/specs/2026-09-22-aigate-design.md
- `ErrorCode: TIMEOUT` --conceptually_related_to--> `UI error code: TIMEOUT`  [AMBIGUOUS]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/API_UI_MAP.md
- `MITM — /network/mitm` --semantically_similar_to--> `Settings · Developer (/settings/developer)`  [INFERRED] [semantically similar]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/stitch-briefs.md
- `Decision (user, 2026-09-25): onboarding is one step (set password, open dashboard)` --references--> `Onboarding — /welcome`  [INFERRED]
  docs/PROGRESS_HANDOFF.md → docs/superpowers/specs/2026-09-22-aigate-design.md
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

## Communities (19 total, 0 thin omitted)

### Community 0 - "API Keys, Identity & Settings"
Cohesion: 0.05
Nodes (108): apikey.delete-key, apikey.generate-key, apikey.legacy-format-unenforced, apikey.list-keys, apikey.update-key-status, apikey.validate-lookup, endpoint.enforce-require-api-key, identity.auth-status-disclosure (+100 more)

### Community 1 - "Catalog, Registry & Capabilities (SP4, SP7)"
Cohesion: 0.05
Nodes (68): catalog.registry-build, catalog.registry-entry-shape, catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, combo.detect-required-capabilities, ListedModel { id, descriptor? } — getModels never invents limits (≤1000 ids) (+60 more)

### Community 2 - "Providers, Credentials & Architecture"
Cohesion: 0.08
Nodes (62): validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, /providers/media* → MediaProviders, /providers/quota → Quota; custom provider form; multi-account, Audit finding: Console shown in sidebar regardless of Developer mode, Audit FAIL: sidebar not identical across screens, §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra), §9 Build an explicit domain model (Provider, Quota, RoutingPolicy…), §5 Feature discovery — inventory every group, do not trust the UI menu (+54 more)

### Community 3 - "Discovery Outputs & Behavioral Questions"
Cohesion: 0.07
Nodes (54): docs/capabilities.md (GENERATED capability specification), docs/discovery/coverage.md, docs/discovery/gaps.md (Gap register), docs/discovery/inventory.json, §30 The 12 pre-implementation questions, §3 The 20 behavioral questions (trigger…edge cases), §2 Core principles — never port, rename, or translate 9router line by line, §29 Definition of Done — 13 checklist items, no self-declared DONE (+46 more)

### Community 4 - "Parity Harness & Error Taxonomy (SP3)"
Cohesion: 0.07
Nodes (48): Status → ErrorCode by status + error.code/type only (never message text), API_UI_MAP row: M0 SP3 parity harness, No UI, Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Error taxonomy (8 ErrorCodes), Stated limits of tape-based parity, Parity verification — 3 tiers, Recording proxy + 4-part tape (+40 more)

### Community 5 - "Routing Engine, Fallback & Latency"
Cohesion: 0.08
Nodes (41): endpoint.rewrite-lanes, /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver, Audit finding: routing-fallback merged 4 tabs into one 3886px screen, §17 Latency — clean architecture must not add hot-path I/O, §20 No blind fallback — fallback follows error semantics, §16 Do not inherit performance issues; all large workloads bounded, §12 Router is its own business engine, not controller logic, §13 Translator/protocol separation — canonical vs vendor formats (+33 more)

### Community 6 - "Connections & Secret Storage (SP11)"
Cohesion: 0.09
Nodes (39): catalog.connection-detail-crud, catalog.connection-listing, connection.client-listing-sanitized, connection.test-single-connection, connection.create-dedup-and-priority-assignment, connection.delete-and-reorder, connection.storage-shape-json-blob, DELETE /api/connections/:id (+31 more)

### Community 7 - "Transport, Network & UI Audits"
Cohesion: 0.12
Nodes (38): transport.proxy-priority-chain, /network/* → ProxyPools, DeployWizard, Tunnel, Mitm, Audit PASS: no credential leaked across 27 HTML exports, Audit FAIL: only the happy path was drawn (state rules §10.7), Audit finding: MITM CA buttons adjacent, type-to-confirm modal missing, Audit finding: settings-auth regenerated as settings-auth-v2, Minimal frontend state management, Web stack (Vite, TanStack Router/Query/Virtual, RHF+zod, Tailwind+Radix, Recharts, i18next) (+30 more)

### Community 8 - "Transient Retry & Governance"
Cohesion: 0.09
Nodes (30): fallback.executor-retry-budget, transport.test.mjs: adapter streams end to end over DirectTransport, Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, §8 Business rule beats old implementation, §19 Fallback as explicit policy with classified errors, Canonical error classification codes (8 values), ExecCtx (one shared client-cancel + deadline signal) (+22 more)

### Community 9 - "Overview, Usage & Observability"
Cohesion: 0.13
Nodes (30): usage.write-not-synchronous, GET /overview/summary, SSE /events/requests, / → Overview, /traffic/usage, /traffic/requests* → Usage, Requests, RequestDetail, §23 Observability per request; never log keys, tokens or secrets, §21 Quota must be understood fully, not copied from the UI tracker, §22 Usage fields to trace per request (tokens, cost, latency, fallback attempts) (+22 more)

### Community 10 - "Integrations, Console & Design System"
Cohesion: 0.23
Nodes (21): /traffic/console → Console (Developer mode only), /integrations/* → CliTools, CliToolDetail, Skills, Mcp, CLI-tool config writes require diff preview + backup, Bounded context: tooling, Copy field component, Type scale (12/13/14/16/20/32) and mono for identifiers, Feature group: CLI Tools, Feature group: Console Log (+13 more)

### Community 11 - "SP12 Chat Lane Matrix Entries"
Cohesion: 0.16
Nodes (17): catalog.model-listing-live-override, fallback.accounts-exhausted-response, routing.client-disconnect-propagation, routing.lane-entry-routes, routing.model-resolution, routing.request-preflight, §18 Streaming is first-class (TTFT, cancellation, backpressure), Backpressure: a false write() waits for drain; the upstream read pauses with it (+9 more)

### Community 12 - "SP10 OpenAI Protocol & Translation"
Cohesion: 0.17
Nodes (16): routing.request-translation, routing.source-format-detection, routing.stream-mode-decision, translator.pivot-loss, translator.tool-id-normalization, src/json.ts — shared JSON narrowing (isRecord, record, text, list, parseJson), CIP gains image detail and tool strict (OpenAI → OpenAI trip keeps them), toOpenAIChatCompletion() — CanonicalResponse → chat.completion JSON (+8 more)

### Community 13 - "9router Findings: Errors & Usage"
Cohesion: 0.21
Nodes (12): fallback.error-classification, fallback.upstream-error-result, routing.default-executor-openai-fallback, routing.non-streaming-response, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), Finding: 9router 0.5.55 errors carry only { message } with its node id and the raw upstream body, Finding: omitted stream on 9router 0.5.55 → JSON body sent as text/event-stream + bare [DONE] (unparsable), Finding: 9router adds 2000 tokens to reported prompt/total usage (addBufferToUsage) — SUSPECTED_BUG (+4 more)

### Community 14 - "SP9 Adapter & CIP"
Cohesion: 0.31
Nodes (9): OpenAICompatibleAdapter (AIProviderPort for openai-compatible), packages/engine/test/openai-adapter.test.mjs (15 tests, fake transport, SSE split every 3 bytes; 16 mutations caught), Refused before I/O: video, media by URL, assistant thinking, tool_result.isError, budgetTokens, foreign vendorExtensions, TokenUsage normalized: inputTokens excludes cache reads, outputTokens includes reasoning, Canonical Internal Protocol (CIP), vendorExtensions — typed carry-through field, UnsupportedFeatureError, Feature group: Translation / language functionality (+1 more)

### Community 15 - "Chat API /v1 & Endpoint Screen"
Cohesion: 0.36
Nodes (8): endpoint.extract-header-order, API_UI_MAP row: SP10 OpenAI Chat protocol, No UI, API_UI_MAP row: SP9 OpenAICompatibleAdapter, No UI, /gateway/endpoint readiness pill (Ready / Connect a provider / Check connection) + curl test, POST /v1/chat/completions + GET /v1/models (/v1 Chat API), extractApiKey() (Authorization: Bearer first, then x-api-key), SP12 — routing: chat lane + Fastify raw streaming, backpressure, cancellation, features/gateway/api.ts useChatReadiness — shared ["connections"] query

### Community 16 - "Partial Stream Failure & Encoder"
Cohesion: 0.53
Nodes (6): fallback.partial-stream-failure, Truncated stream or error event → PROVIDER_UNAVAILABLE with details.partial, Stream headers only after the first chunk: earlier failures are real JSON statuses, Golden scenario: partial stream failure, OpenAIChatStreamEncoder — StreamChunk → OpenAI SSE; fail() = error event, no [DONE], Usage chunk after the finish chunk, only with stream_options.include_usage

### Community 17 - "Stream Reading & Idle Timeout"
Cohesion: 0.50
Nodes (4): routing.streaming-pipeline, readSseData() — bounded SSE reader (1 Mi chars per line/event, cancels body), Idle timeout between chunks (AIGATE_STREAM_IDLE_TIMEOUT_MS, default 300 s) → TIMEOUT error event, Deferred: streaming idle timeout (gap between chunks) with SP12

### Community 18 - "Lean Code Rules"
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
- **19 isolated node(s):** `ErrorCode: INTERNAL_ERROR`, `02-providers-auth.yaml`, `03-accounts-multiaccount.yaml`, `05-request-routing-fallback.yaml`, `07-token-saver.yaml` (+14 more)
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
- **Why does `Bounded context: routing (core)` connect `Routing Engine, Fallback & Latency` to `API Keys, Identity & Settings`, `Catalog, Registry & Capabilities (SP4, SP7)`, `Providers, Credentials & Architecture`, `Discovery Outputs & Behavioral Questions`, `Parity Harness & Error Taxonomy (SP3)`, `Overview, Usage & Observability`, `SP10 OpenAI Protocol & Translation`, `SP9 Adapter & CIP`, `Chat API /v1 & Endpoint Screen`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **Why does `Milestone M-1 · Discovery` connect `Discovery Outputs & Behavioral Questions` to `API Keys, Identity & Settings`, `Catalog, Registry & Capabilities (SP4, SP7)`, `Providers, Credentials & Architecture`, `Parity Harness & Error Taxonomy (SP3)`, `Routing Engine, Fallback & Latency`, `Overview, Usage & Observability`, `Integrations, Console & Design System`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._