# Graph Report - docs  (2026-09-25)

## Corpus Check
- 18 files · ~45,011 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 587 nodes · 1567 edges · 16 communities
- Extraction: 84% EXTRACTED · 16% INFERRED · 0% AMBIGUOUS · INFERRED: 245 edges (avg confidence: 0.87)
- Token cost: 574,916 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_API Keys, Identity & Settings (SP5–SP6)|API Keys, Identity & Settings (SP5–SP6)]]
- [[_COMMUNITY_Providers, Integrations & Architecture|Providers, Integrations & Architecture]]
- [[_COMMUNITY_Capabilities, Catalog & Usage|Capabilities, Catalog & Usage]]
- [[_COMMUNITY_Discovery Outputs & Behavioral Questions|Discovery Outputs & Behavioral Questions]]
- [[_COMMUNITY_Overview, Traffic & Console Screens|Overview, Traffic & Console Screens]]
- [[_COMMUNITY_Adapter Errors, Retry & Governance|Adapter Errors, Retry & Governance]]
- [[_COMMUNITY_Connections & Secret Storage (SP11)|Connections & Secret Storage (SP11)]]
- [[_COMMUNITY_Routing, Combos & SSO Screens|Routing, Combos & SSO Screens]]
- [[_COMMUNITY_Transport, Network & Tunnel|Transport, Network & Tunnel]]
- [[_COMMUNITY_SP10 OpenAI Protocol & Translation|SP10 OpenAI Protocol & Translation]]
- [[_COMMUNITY_SP9 Adapter Mapping & Models|SP9 Adapter Mapping & Models]]
- [[_COMMUNITY_SP12 Chat Lane Matrix Entries|SP12 Chat Lane Matrix Entries]]
- [[_COMMUNITY_Chat API v1 & Endpoint Screen|Chat API /v1 & Endpoint Screen]]
- [[_COMMUNITY_Streaming, Cancellation & Backpressure|Streaming, Cancellation & Backpressure]]
- [[_COMMUNITY_Partial Stream Failure|Partial Stream Failure]]
- [[_COMMUNITY_Lean Code Rules|Lean Code Rules]]

## God Nodes (most connected - your core abstractions)
1. `Identity and API keys contract (M1 SP6)` - 37 edges
2. `Bounded context: routing (core)` - 35 edges
3. `Feature Matrix — mandatory 17-column artifact` - 27 edges
4. `Milestone M-1 · Discovery` - 27 edges
5. `Bounded context: connections` - 26 edges
6. `The 23 feature groups required by behavioral.md §5` - 26 edges
7. `SP6 — identity + apikeys (password login + key validation only)` - 25 edges
8. `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` - 24 edges
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

## Communities (16 total, 0 thin omitted)

### Community 0 - "API Keys, Identity & Settings (SP5–SP6)"
Cohesion: 0.05
Nodes (102): apikey.delete-key, apikey.generate-key, apikey.legacy-format-unenforced, apikey.list-keys, apikey.update-key-status, apikey.validate-lookup, endpoint.enforce-require-api-key, identity.auth-status-disclosure (+94 more)

### Community 1 - "Providers, Integrations & Architecture"
Cohesion: 0.07
Nodes (74): validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, /integrations/* → CliTools, CliToolDetail, Skills, Mcp, /providers/media* → MediaProviders, /providers/quota → Quota; custom provider form; multi-account, §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra), §9 Build an explicit domain model (Provider, Quota, RoutingPolicy…), §5 Feature discovery — inventory every group, do not trust the UI menu, §6 Feature Matrix requirement — nothing is understood until fully traced (+66 more)

### Community 2 - "Capabilities, Catalog & Usage"
Cohesion: 0.05
Nodes (66): catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, combo.detect-required-capabilities, usage.write-not-synchronous, API ↔ UI map (docs/design/API_UI_MAP.md), GET /health (+58 more)

### Community 3 - "Discovery Outputs & Behavioral Questions"
Cohesion: 0.05
Nodes (64): docs/capabilities.md (GENERATED capability specification), docs/discovery/coverage.md, docs/discovery/gaps.md (Gap register), docs/discovery/inventory.json, §30 The 12 pre-implementation questions, §3 The 20 behavioral questions (trigger…edge cases), §8 Business rule beats old implementation, §2 Core principles — never port, rename, or translate 9router line by line (+56 more)

### Community 4 - "Overview, Traffic & Console Screens"
Cohesion: 0.09
Nodes (56): GET /overview/summary, SSE /events/requests, /traffic/console → Console (Developer mode only), / → Overview, /traffic/usage, /traffic/requests* → Usage, Requests, RequestDetail, Audit finding: Console shown in sidebar regardless of Developer mode, Audit PASS: no credential leaked across 27 HTML exports, Audit FAIL: only the happy path was drawn (state rules §10.7) (+48 more)

### Community 5 - "Adapter Errors, Retry & Governance"
Cohesion: 0.05
Nodes (50): fallback.executor-retry-budget, transport.test.mjs: adapter streams end to end over DirectTransport, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, Status → ErrorCode by status + error.code/type only (never message text), 9router as Behavioral Source of Truth (not a template to port), Definition of Done — 13 items, not self-awarded, Error taxonomy (8 ErrorCodes), IMPLEMENTATION_ACCIDENT — debt not inherited from 9router (+42 more)

### Community 6 - "Connections & Secret Storage (SP11)"
Cohesion: 0.08
Nodes (44): catalog.connection-detail-crud, catalog.connection-listing, connection.client-listing-sanitized, connection.test-single-connection, connection.create-dedup-and-priority-assignment, connection.delete-and-reorder, connection.storage-shape-json-blob, DELETE /api/connections/:id (+36 more)

### Community 7 - "Routing, Combos & SSO Screens"
Cohesion: 0.12
Nodes (33): endpoint.rewrite-lanes, settings.combo-rotation-reset, /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver, /settings/auth OIDC and SAML tabs, Audit finding: routing-fallback merged 4 tabs into one 3886px screen, §12 Router is its own business engine, not controller logic, §13 Translator/protocol separation — canonical vs vendor formats, Canonical Internal Protocol (+25 more)

### Community 8 - "Transport, Network & Tunnel"
Cohesion: 0.19
Nodes (23): transport.proxy-priority-chain, /network/* → ProxyPools, DeployWizard, Tunnel, Mitm, Hard constraint: tunnel requires 'Require API key' enabled, Bounded context: transport, Decision: do NOT clone 9Remote, Warning banner component, Feature group: Proxy Pools, 10-proxy-pools.yaml (+15 more)

### Community 9 - "SP10 OpenAI Protocol & Translation"
Cohesion: 0.16
Nodes (19): routing.request-translation, routing.source-format-detection, routing.stream-mode-decision, translator.pivot-loss, translator.tool-id-normalization, CIP gains image detail and tool strict (OpenAI → OpenAI trip keeps them), toOpenAIChatCompletion() — CanonicalResponse → chat.completion JSON, OpenAI Chat Completions protocol adapter contract (M1 SP10) (+11 more)

### Community 10 - "SP9 Adapter Mapping & Models"
Cohesion: 0.15
Nodes (17): fallback.error-classification, fallback.upstream-error-result, routing.default-executor-openai-fallback, routing.non-streaming-response, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), ListedModel { id, descriptor? } — getModels never invents limits (≤1000 ids), Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O, OpenAICompatibleAdapter (AIProviderPort for openai-compatible) (+9 more)

### Community 11 - "SP12 Chat Lane Matrix Entries"
Cohesion: 0.17
Nodes (16): catalog.model-listing-live-override, fallback.accounts-exhausted-response, routing.lane-entry-routes, routing.model-resolution, routing.request-preflight, routing.streaming-pipeline, Chat lane contract (M1 SP12), Idle timeout between chunks (AIGATE_STREAM_IDLE_TIMEOUT_MS, default 300 s) → TIMEOUT error event (+8 more)

### Community 12 - "Chat API /v1 & Endpoint Screen"
Cohesion: 0.36
Nodes (8): endpoint.extract-header-order, API_UI_MAP row: SP10 OpenAI Chat protocol, No UI, API_UI_MAP row: SP9 OpenAICompatibleAdapter, No UI, /gateway/endpoint readiness pill (Ready / Connect a provider / Check connection) + curl test, POST /v1/chat/completions + GET /v1/models (/v1 Chat API), extractApiKey() (Authorization: Bearer first, then x-api-key), SP12 — routing: chat lane + Fastify raw streaming, backpressure, cancellation, features/gateway/api.ts useChatReadiness — shared ["connections"] query

### Community 13 - "Streaming, Cancellation & Backpressure"
Cohesion: 0.33
Nodes (7): routing.client-disconnect-propagation, §18 Streaming is first-class (TTFT, cancellation, backpressure), Backpressure: a false write() waits for drain; the upstream read pauses with it, One ExecCtx signal: client disconnect + 600 s budget (TIMEOUT) + idle watchdog, ExecCtx (one shared client-cancel + deadline signal), Golden scenario: client cancellation, Failure: caller ctx.signal aborts (client left, budget spent)

### Community 14 - "Partial Stream Failure"
Cohesion: 0.83
Nodes (4): fallback.partial-stream-failure, Truncated stream or error event → PROVIDER_UNAVAILABLE with details.partial, Stream headers only after the first chunk: earlier failures are real JSON statuses, Golden scenario: partial stream failure

### Community 15 - "Lean Code Rules"
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
- **20 isolated node(s):** `ErrorCode: INTERNAL_ERROR`, `Parity tier 3 — Upstream shape drift (warning only)`, `Golden scenario: normal completion`, `Golden scenario: stream completion`, `02-providers-auth.yaml` (+15 more)
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
- **Why does `Bounded context: routing (core)` connect `Routing, Combos & SSO Screens` to `API Keys, Identity & Settings (SP5–SP6)`, `Providers, Integrations & Architecture`, `Capabilities, Catalog & Usage`, `Discovery Outputs & Behavioral Questions`, `Overview, Traffic & Console Screens`, `Adapter Errors, Retry & Governance`, `SP10 OpenAI Protocol & Translation`, `Chat API /v1 & Endpoint Screen`?**
  _High betweenness centrality (0.127) - this node is a cross-community bridge._
- **Why does `Milestone M-1 · Discovery` connect `Discovery Outputs & Behavioral Questions` to `API Keys, Identity & Settings (SP5–SP6)`, `Providers, Integrations & Architecture`, `Capabilities, Catalog & Usage`, `Routing, Combos & SSO Screens`, `Transport, Network & Tunnel`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._