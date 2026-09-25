# Graph Report - docs  (2026-09-26)

## Corpus Check
- 21 files · ~49,113 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 629 nodes · 1679 edges · 27 communities
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 251 edges (avg confidence: 0.87)
- Token cost: 574,916 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Overview, Network, Integrations & Console|Overview, Network, Integrations & Console]]
- [[_COMMUNITY_Architecture, Domain Model & Feature Groups|Architecture, Domain Model & Feature Groups]]
- [[_COMMUNITY_Provider Catalog & Connections (SP4, SP11, SP13)|Provider Catalog & Connections (SP4, SP11, SP13)]]
- [[_COMMUNITY_Discovery Outputs & Behavioral Questions|Discovery Outputs & Behavioral Questions]]
- [[_COMMUNITY_Parity Harness & Error Taxonomy (SP3)|Parity Harness & Error Taxonomy (SP3)]]
- [[_COMMUNITY_API Keys (SP6)|API Keys (SP6)]]
- [[_COMMUNITY_Identity & Settings Audits|Identity & Settings Audits]]
- [[_COMMUNITY_Transport, Retry & Adapter Errors|Transport, Retry & Adapter Errors]]
- [[_COMMUNITY_Chat Lane Routing Matrix (SP12)|Chat Lane Routing Matrix (SP12)]]
- [[_COMMUNITY_Settings API (SP5)|Settings API (SP5)]]
- [[_COMMUNITY_Governance & Frontend Structure|Governance & Frontend Structure]]
- [[_COMMUNITY_Sessions & Password Change|Sessions & Password Change]]
- [[_COMMUNITY_API-UI Map & No-UI Rows|API-UI Map & No-UI Rows]]
- [[_COMMUNITY_Upstream Errors & Non-Streaming Response|Upstream Errors & Non-Streaming Response]]
- [[_COMMUNITY_Capabilities & Engine Contract (SP7)|Capabilities & Engine Contract (SP7)]]
- [[_COMMUNITY_SP9 Adapter & CIP|SP9 Adapter & CIP]]
- [[_COMMUNITY_SP10 OpenAI Protocol & Translation|SP10 OpenAI Protocol & Translation]]
- [[_COMMUNITY_Skills, Lint & Retry Helper|Skills, Lint & Retry Helper]]
- [[_COMMUNITY_Onboarding Setup Errors|Onboarding Setup Errors]]
- [[_COMMUNITY_Transport-Level UI Errors|Transport-Level UI Errors]]
- [[_COMMUNITY_Chat API v1 & Endpoint Screen|Chat API /v1 & Endpoint Screen]]
- [[_COMMUNITY_Login & Rate Limiting|Login & Rate Limiting]]
- [[_COMMUNITY_Latency & Bounded Workloads|Latency & Bounded Workloads]]
- [[_COMMUNITY_Stream Reading & Idle Timeout|Stream Reading & Idle Timeout]]
- [[_COMMUNITY_M0 Foundation & SPIKE-1|M0 Foundation & SPIKE-1]]
- [[_COMMUNITY_Partial Stream Failure|Partial Stream Failure]]
- [[_COMMUNITY_Lean Code Rules|Lean Code Rules]]

## God Nodes (most connected - your core abstractions)
1. `Identity and API keys contract (M1 SP6)` - 37 edges
2. `Bounded context: routing (core)` - 35 edges
3. `Feature Matrix — mandatory 17-column artifact` - 27 edges
4. `Milestone M-1 · Discovery` - 27 edges
5. `Bounded context: connections` - 26 edges
6. `The 23 feature groups required by behavioral.md §5` - 26 edges
7. `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` - 26 edges
8. `SP6 — identity + apikeys (password login + key validation only)` - 25 edges
9. `ChatLane (modules/routing/infrastructure/chat-lane.ts)` - 23 edges
10. `Overview — /` - 22 edges

## Surprising Connections (you probably didn't know these)
- `TransportModule (injects DirectTransport under HTTP_TRANSPORT)` --implements--> `Bounded context: transport`  [INFERRED]
  docs/contracts/transport.md → docs/superpowers/specs/2026-09-22-aigate-design.md
- `ErrorCode: TIMEOUT` --conceptually_related_to--> `UI error code: TIMEOUT`  [AMBIGUOUS]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/API_UI_MAP.md
- `MITM — /network/mitm` --semantically_similar_to--> `Settings · Developer (/settings/developer)`  [INFERRED] [semantically similar]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/stitch-briefs.md
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
- **SP12 request path: key gate → parse → resolve + capabilities → adapter → encode with backpressure** — chat_lane_key_gate, protocol_parse_openai_chat, chat_lane_model_resolution, adapter_openai_compatible, protocol_stream_encoder, chat_lane_backpressure [EXTRACTED 1.00]
- **SP3 replay loop: tape → AIGate (stubbed vendor) → normalizer → judge against 9router with declared deviations** — parity_tapes, chat_lane_service, parity_normalizer, parity_judge, parity_deviations [EXTRACTED 1.00]
- **SP4 loop: 9router registry → extract → CATALOG → verify diff (0) + validateCatalog** — extract_tool, catalog_generated, extract_verify, catalog_schema, rule_no_invented_limits [EXTRACTED 1.00]
- **Catalog → registry → /api/providers → /providers screens** — catalog_generated, builtin_registry_catalog, catalog_controller, hook_use_providers, api_ui_map_screen_llm_providers_wired, api_ui_map_screen_provider_detail_wired [EXTRACTED 1.00]

## Communities (27 total, 0 thin omitted)

### Community 0 - "Overview, Network, Integrations & Console"
Cohesion: 0.06
Nodes (88): settings.outbound-proxy-live-apply, settings.proxy-test-outbound-probe, GET /overview/summary, SSE /events/requests, /traffic/console → Console (Developer mode only), /integrations/* → CliTools, CliToolDetail, Skills, Mcp, /network/* → ProxyPools, DeployWizard, Tunnel, Mitm, / → Overview (+80 more)

### Community 1 - "Architecture, Domain Model & Feature Groups"
Cohesion: 0.06
Nodes (82): validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, API_UI_MAP row: M0 SP4 tools/extract + CATALOG, No UI yet (SP13 serves /providers), /providers/media* → MediaProviders, /providers/quota → Quota; custom provider form; multi-account, /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver, §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra), §9 Build an explicit domain model (Provider, Quota, RoutingPolicy…), §5 Feature discovery — inventory every group, do not trust the UI menu (+74 more)

### Community 2 - "Provider Catalog & Connections (SP4, SP11, SP13)"
Cohesion: 0.05
Nodes (63): catalog.connection-detail-crud, catalog.connection-listing, catalog.registry-build, catalog.registry-entry-shape, connection.client-listing-sanitized, connection.test-single-connection, connection.create-dedup-and-priority-assignment, connection.delete-and-reorder (+55 more)

### Community 3 - "Discovery Outputs & Behavioral Questions"
Cohesion: 0.06
Nodes (59): docs/capabilities.md (GENERATED capability specification), docs/discovery/coverage.md, docs/discovery/gaps.md (Gap register), docs/discovery/inventory.json, §30 The 12 pre-implementation questions, §3 The 20 behavioral questions (trigger…edge cases), §8 Business rule beats old implementation, §2 Core principles — never port, rename, or translate 9router line by line (+51 more)

### Community 4 - "Parity Harness & Error Taxonomy (SP3)"
Cohesion: 0.07
Nodes (51): Status → ErrorCode by status + error.code/type only (never message text), API_UI_MAP row: M0 SP3 parity harness, No UI, 9router as Behavioral Source of Truth (not a template to port), Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Definition of Done — 13 items, not self-awarded, Error taxonomy (8 ErrorCodes), IMPLEMENTATION_ACCIDENT — debt not inherited from 9router (+43 more)

### Community 5 - "API Keys (SP6)"
Cohesion: 0.12
Nodes (33): apikey.delete-key, apikey.generate-key, apikey.legacy-format-unenforced, apikey.list-keys, apikey.update-key-status, apikey.validate-lookup, endpoint.rewrite-lanes, identity.auth-status-disclosure (+25 more)

### Community 6 - "Identity & Settings Audits"
Cohesion: 0.20
Nodes (24): identity.machine-id-derivation, settings.database-export-import, /settings/auth OIDC and SAML tabs, /settings/general → SettingsGeneral, Audit finding: settings-auth regenerated as settings-auth-v2, Audit finding: login-callback / deploy-wizard / authflow-modals are showcases, not routes, Audit FAIL: sidebar not identical across screens, §7 Trace the behavior — never conclude from a function name (+16 more)

### Community 7 - "Transport, Retry & Adapter Errors"
Cohesion: 0.11
Nodes (21): fallback.executor-retry-budget, transport.proxy-priority-chain, transport.test.mjs: adapter streams end to end over DirectTransport, Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, ExecCtx (one shared client-cancel + deadline signal), ErrorCode: PROVIDER_UNAVAILABLE, DirectTransport (direct branch implementation) (+13 more)

### Community 8 - "Chat Lane Routing Matrix (SP12)"
Cohesion: 0.14
Nodes (20): endpoint.enforce-require-api-key, catalog.model-listing-live-override, fallback.accounts-exhausted-response, routing.client-disconnect-propagation, routing.lane-entry-routes, routing.model-resolution, routing.request-preflight, §18 Streaming is first-class (TTFT, cancellation, backpressure) (+12 more)

### Community 9 - "Settings API (SP5)"
Cohesion: 0.22
Nodes (18): settings.combo-rotation-reset, settings.defaults-and-merge, settings.get-secret-stripping, settings.hot-path-read-no-cache, settings.patch-protected-keys, GET /api/settings, useRequireApiKey (features/gateway/api.ts), PATCH /api/settings (+10 more)

### Community 10 - "Governance & Frontend Structure"
Cohesion: 0.15
Nodes (18): usage.write-not-synchronous, GET /health, docs/PROJECT_MAP.md (generated U-project ownership map), Rule: an API is done only when its UI screen is wired in the same SP, Feature-based frontend structure with import boundaries, Hexagonal architecture, granularity = bounded context, Monorepo layout (apps/server, apps/web, apps/cli, packages/engine, contracts, database, tools), Open decisions not settled by this spec (+10 more)

### Community 11 - "Sessions & Password Change"
Cohesion: 0.19
Nodes (15): identity.session-cookie-lifecycle, settings.patch-password-change, UI error code: INVALID_CREDENTIALS (401), useChangePassword (features/settings/api.ts), useLogout (features/settings/api.ts), usePatchSettings (features/settings/api.ts), useSettings (features/settings/api.ts), POST /api/auth/logout (+7 more)

### Community 12 - "API-UI Map & No-UI Rows"
Cohesion: 0.30
Nodes (15): API ↔ UI map (docs/design/API_UI_MAP.md), API_UI_MAP row: SP7 packages/engine, No UI, API_UI_MAP row: SP8 transport, No UI, Rule: an SP with no HTTP API records "No UI" in its row, Milestone M1 · Walking skeleton (thin end-to-end slice), HttpTransportPort, AIGate progress handoff (docs/PROGRESS_HANDOFF.md), Gap: M0 SP3 (parity harness) and SP4 (tools/extract) never built (+7 more)

### Community 13 - "Upstream Errors & Non-Streaming Response"
Cohesion: 0.18
Nodes (14): fallback.error-classification, fallback.upstream-error-result, routing.default-executor-openai-fallback, routing.non-streaming-response, routing.stream-mode-decision, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), Finding: 9router 0.5.55 errors carry only { message } with its node id and the raw upstream body, Finding: omitted stream on 9router 0.5.55 → JSON body sent as text/event-stream + bare [DONE] (unparsable) (+6 more)

### Community 14 - "Capabilities & Engine Contract (SP7)"
Cohesion: 0.28
Nodes (13): catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, combo.detect-required-capabilities, Engine contract (M1 SP7), defineRegistry() / builtinRegistry (single openai entry, 4 chat models), detectRequiredCapabilities() (+5 more)

### Community 15 - "SP9 Adapter & CIP"
Cohesion: 0.23
Nodes (12): routing.request-translation, routing.source-format-detection, OpenAICompatibleAdapter (AIProviderPort for openai-compatible), packages/engine/test/openai-adapter.test.mjs (15 tests, fake transport, SSE split every 3 bytes; 16 mutations caught), Refused before I/O: video, media by URL, assistant thinking, tool_result.isError, budgetTokens, foreign vendorExtensions, TokenUsage normalized: inputTokens excludes cache reads, outputTokens includes reasoning, src/json.ts — shared JSON narrowing (isRecord, record, text, list, parseJson), UnsupportedFeatureError (+4 more)

### Community 16 - "SP10 OpenAI Protocol & Translation"
Cohesion: 0.25
Nodes (11): translator.pivot-loss, translator.tool-id-normalization, toOpenAIChatCompletion() — CanonicalResponse → chat.completion JSON, Rule: safe upstream codes (context_length_exceeded) reach the client, OpenAI Chat Completions protocol adapter contract (M1 SP10), OpenAIChatStreamEncoder — StreamChunk → OpenAI SSE; fail() = error event, no [DONE], toOpenAIError() — ErrorCode → OpenAI status/type/code; internals never leak, Not ported: tool-id normalization and empty tool answers (Anthropic adapters, SP15) (+3 more)

### Community 17 - "Skills, Lint & Retry Helper"
Cohesion: 0.24
Nodes (11): Split: machines block mechanics, skills teach judgement, Iron law: no skill without a failing test first (RED → GREEN → REFACTOR), UI performance constraints, withRetry() — bounded retry helper (≤10 attempts, capped backoff, abortable), tools/lint/check.test.mjs (lint:check 13/13), Lint rule aigate/fetch-through-transport, Lint rule aigate/fetch-timeout (accepts AbortSignal.any([..., AbortSignal.timeout(n)])), Lint rule aigate/retry-through-helper (+3 more)

### Community 18 - "Onboarding Setup Errors"
Cohesion: 0.33
Nodes (10): UI error code: ALREADY_SET_UP (409), UI error code: INVALID_REQUEST (400), UI error code: NOT_LOCAL (403), useSetup (features/settings/api.ts), POST /api/auth/setup, /welcome → Onboarding (one step), AIGATE_INITIAL_PASSWORD (first password at boot), Decision 2 (user, 2026-09-25): first password set from the local machine; no default password (+2 more)

### Community 19 - "Transport-Level UI Errors"
Cohesion: 0.36
Nodes (10): UI error code: BAD_RESPONSE, UI error code: HTTP_5xx, UI error code: NETWORK_ERROR, UI error code: any other code (fallback), UI error code: TIMEOUT, UI error code: UNAUTHENTICATED (401), shared/errors.test.mjs, shared/api.ts — same-origin JSON client, ApiError with stable code, 10 s timeout (+2 more)

### Community 20 - "Chat API /v1 & Endpoint Screen"
Cohesion: 0.36
Nodes (8): endpoint.extract-header-order, API_UI_MAP row: SP10 OpenAI Chat protocol, No UI, API_UI_MAP row: SP9 OpenAICompatibleAdapter, No UI, /gateway/endpoint readiness pill (Ready / Connect a provider / Check connection) + curl test, POST /v1/chat/completions + GET /v1/models (/v1 Chat API), extractApiKey() (Authorization: Bearer first, then x-api-key), SP12 — routing: chat lane + Fastify raw streaming, backpressure, cancellation, features/gateway/api.ts useChatReadiness — shared ["connections"] query

### Community 21 - "Login & Rate Limiting"
Cohesion: 0.52
Nodes (7): identity.password-login-lockout, UI error code: RATE_LIMITED (429), UI error code: SETUP_REQUIRED (409), useLogin (features/settings/api.ts), POST /api/auth/login, /login → Login, Login lockout: 5 failures → 30 s / 2 min / 10 min / 30 min, capped at 10,000 clients

### Community 22 - "Latency & Bounded Workloads"
Cohesion: 0.29
Nodes (7): §17 Latency — clean architecture must not add hot-path I/O, §16 Do not inherit performance issues; all large workloads bounded, Constraint — every filesystem scan uses fast-glob with an explicit ignore list, Rule 4 — Every workload must be BOUNDED, Rule 11 — Review questions beyond "does it run?" (10x/100x traffic, unbounded work), Rule 5 — Low latency: parallelize independent awaits, only when bounded, Rule 3 — Optimize performance at design time, not micro-optimization

### Community 23 - "Stream Reading & Idle Timeout"
Cohesion: 0.33
Nodes (6): routing.streaming-pipeline, readSseData() — bounded SSE reader (1 Mi chars per line/event, cancels body), Idle timeout between chunks (AIGATE_STREAM_IDLE_TIMEOUT_MS, default 300 s) → TIMEOUT error event, Deferred: streaming idle timeout (gap between chunks) with SP12, Failure: body larger than maxBytes in readBoundedText, readBoundedText() (bounded body reader, default 4 MiB)

### Community 24 - "M0 Foundation & SPIKE-1"
Cohesion: 0.60
Nodes (5): Milestone M0 · Foundation, Decision (user, 2026-09-25): route all four SQLite clients through one locked sqlite-proxy wrapper, Locked sqlite-proxy wrapper (AsyncLocalStorage, BEGIN/COMMIT around batch), SP2 — SPIKE-1 + Drizzle schema + 4-tier driver chain + migration runner, SPIKE-1 — drizzle-orm/sqlite-proxy on node:sqlite + sql.js

### Community 25 - "Partial Stream Failure"
Cohesion: 0.83
Nodes (4): fallback.partial-stream-failure, Truncated stream or error event → PROVIDER_UNAVAILABLE with details.partial, Stream headers only after the first chunk: earlier failures are real JSON statuses, Golden scenario: partial stream failure

### Community 26 - "Lean Code Rules"
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
- **Why does `Bounded context: routing (core)` connect `Architecture, Domain Model & Feature Groups` to `Overview, Network, Integrations & Console`, `Discovery Outputs & Behavioral Questions`, `Parity Harness & Error Taxonomy (SP3)`, `API Keys (SP6)`, `Identity & Settings Audits`, `Chat Lane Routing Matrix (SP12)`, `Settings API (SP5)`, `API-UI Map & No-UI Rows`, `SP10 OpenAI Protocol & Translation`, `Chat API /v1 & Endpoint Screen`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Why does `Task board (PROGRESS_HANDOFF)` connect `API-UI Map & No-UI Rows` to `Architecture, Domain Model & Feature Groups`, `Provider Catalog & Connections (SP4, SP11, SP13)`, `Discovery Outputs & Behavioral Questions`, `Parity Harness & Error Taxonomy (SP3)`, `API Keys (SP6)`, `Settings API (SP5)`, `Governance & Frontend Structure`, `SP10 OpenAI Protocol & Translation`, `Skills, Lint & Retry Helper`, `Chat API /v1 & Endpoint Screen`, `M0 Foundation & SPIKE-1`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._