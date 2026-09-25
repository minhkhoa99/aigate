# Graph Report - docs  (2026-09-26)

## Corpus Check
- 19 files · ~46,553 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 603 nodes · 1620 edges · 27 communities
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 245 edges (avg confidence: 0.87)
- Token cost: 574,916 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Overview, Traffic, Network & Integrations|Overview, Traffic, Network & Integrations]]
- [[_COMMUNITY_Providers, Credentials & Architecture|Providers, Credentials & Architecture]]
- [[_COMMUNITY_Discovery Outputs & Behavioral Questions|Discovery Outputs & Behavioral Questions]]
- [[_COMMUNITY_Parity Harness, Tiers & Error Taxonomy (SP3)|Parity Harness, Tiers & Error Taxonomy (SP3)]]
- [[_COMMUNITY_Routing Engine, Latency & CIP|Routing Engine, Latency & CIP]]
- [[_COMMUNITY_Connections & Secret Storage (SP11)|Connections & Secret Storage (SP11)]]
- [[_COMMUNITY_Settings Context (SP5)|Settings Context (SP5)]]
- [[_COMMUNITY_API Key Validation & Identity Rules|API Key Validation & Identity Rules]]
- [[_COMMUNITY_SSO, Settings General & Tracing Protocol|SSO, Settings General & Tracing Protocol]]
- [[_COMMUNITY_SP12 Chat Lane Matrix Entries|SP12 Chat Lane Matrix Entries]]
- [[_COMMUNITY_Transport & Transient Retry|Transport & Transient Retry]]
- [[_COMMUNITY_Login, Sessions & Lockout (SP6)|Login, Sessions & Lockout (SP6)]]
- [[_COMMUNITY_UI Transport Error Codes|UI Transport Error Codes]]
- [[_COMMUNITY_SP10 OpenAI Protocol & Translation|SP10 OpenAI Protocol & Translation]]
- [[_COMMUNITY_SP9 Adapter Errors & Streaming|SP9 Adapter Errors & Streaming]]
- [[_COMMUNITY_API Key Management (SP6)|API Key Management (SP6)]]
- [[_COMMUNITY_Capability Resolution (SP7)|Capability Resolution (SP7)]]
- [[_COMMUNITY_API-UI Map & Handoff|API-UI Map & Handoff]]
- [[_COMMUNITY_Architecture Spec & Monorepo|Architecture Spec & Monorepo]]
- [[_COMMUNITY_Fallback Policy & Bounded Retry|Fallback Policy & Bounded Retry]]
- [[_COMMUNITY_9router Findings Usage & Errors|9router Findings: Usage & Errors]]
- [[_COMMUNITY_First-run Setup & Onboarding|First-run Setup & Onboarding]]
- [[_COMMUNITY_Chat API v1 & Endpoint Screen|Chat API /v1 & Endpoint Screen]]
- [[_COMMUNITY_UI Ownership & Wiring Rules|UI Ownership & Wiring Rules]]
- [[_COMMUNITY_Partial Stream Failure & Encoder|Partial Stream Failure & Encoder]]
- [[_COMMUNITY_Skills & Lint Enforcement|Skills & Lint Enforcement]]
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
- `identity.machine-id-derivation` --conceptually_related_to--> `Bounded context: identity`  [INFERRED]
  docs/contracts/identity-apikeys.md → docs/superpowers/specs/2026-09-22-aigate-design.md
- `TransportModule (injects DirectTransport under HTTP_TRANSPORT)` --implements--> `Bounded context: transport`  [INFERRED]
  docs/contracts/transport.md → docs/superpowers/specs/2026-09-22-aigate-design.md
- `ErrorCode: TIMEOUT` --conceptually_related_to--> `UI error code: TIMEOUT`  [AMBIGUOUS]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/API_UI_MAP.md
- `MITM — /network/mitm` --semantically_similar_to--> `Settings · Developer (/settings/developer)`  [INFERRED] [semantically similar]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/stitch-briefs.md
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

## Communities (27 total, 0 thin omitted)

### Community 0 - "Overview, Traffic, Network & Integrations"
Cohesion: 0.06
Nodes (93): usage.write-not-synchronous, GET /overview/summary, SSE /events/requests, /traffic/console → Console (Developer mode only), /integrations/* → CliTools, CliToolDetail, Skills, Mcp, /network/* → ProxyPools, DeployWizard, Tunnel, Mitm, / → Overview, /traffic/usage, /traffic/requests* → Usage, Requests, RequestDetail (+85 more)

### Community 1 - "Providers, Credentials & Architecture"
Cohesion: 0.09
Nodes (57): validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, /providers/media* → MediaProviders, /providers/quota → Quota; custom provider form; multi-account, §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra), §9 Build an explicit domain model (Provider, Quota, RoutingPolicy…), §5 Feature discovery — inventory every group, do not trust the UI menu, §6 Feature Matrix requirement — nothing is understood until fully traced, §20 No blind fallback — fallback follows error semantics (+49 more)

### Community 2 - "Discovery Outputs & Behavioral Questions"
Cohesion: 0.07
Nodes (51): docs/capabilities.md (GENERATED capability specification), docs/discovery/coverage.md, docs/discovery/gaps.md (Gap register), docs/discovery/inventory.json, §30 The 12 pre-implementation questions, §3 The 20 behavioral questions (trigger…edge cases), §2 Core principles — never port, rename, or translate 9router line by line, §29 Definition of Done — 13 checklist items, no self-declared DONE (+43 more)

### Community 3 - "Parity Harness, Tiers & Error Taxonomy (SP3)"
Cohesion: 0.08
Nodes (46): API_UI_MAP row: M0 SP3 parity harness, No UI, Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Error taxonomy (8 ErrorCodes), Stated limits of tape-based parity, Parity verification — 3 tiers, Recording proxy + 4-part tape, Normalizer + semantic SSE diff (not chunk diff) (+38 more)

### Community 4 - "Routing Engine, Latency & CIP"
Cohesion: 0.10
Nodes (38): /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver, §17 Latency — clean architecture must not add hot-path I/O, §16 Do not inherit performance issues; all large workloads bounded, §12 Router is its own business engine, not controller logic, §13 Translator/protocol separation — canonical vs vendor formats, Canonical Internal Protocol, Canonical Internal Protocol (CIP), Routing simulator (decision-tree dry run) (+30 more)

### Community 5 - "Connections & Secret Storage (SP11)"
Cohesion: 0.09
Nodes (37): catalog.connection-detail-crud, catalog.connection-listing, connection.client-listing-sanitized, connection.test-single-connection, connection.create-dedup-and-priority-assignment, connection.delete-and-reorder, connection.storage-shape-json-blob, DELETE /api/connections/:id (+29 more)

### Community 6 - "Settings Context (SP5)"
Cohesion: 0.15
Nodes (22): settings.combo-rotation-reset, settings.database-export-import, settings.defaults-and-merge, settings.get-secret-stripping, settings.hot-path-read-no-cache, settings.outbound-proxy-live-apply, settings.patch-protected-keys, settings.proxy-test-outbound-probe (+14 more)

### Community 7 - "API Key Validation & Identity Rules"
Cohesion: 0.16
Nodes (20): apikey.generate-key, apikey.legacy-format-unenforced, apikey.list-keys, apikey.validate-lookup, endpoint.rewrite-lanes, identity.machine-id-derivation, identity.reset-password-local-only, identity.session-cookie-lifecycle (+12 more)

### Community 8 - "SSO, Settings General & Tracing Protocol"
Cohesion: 0.26
Nodes (20): /settings/auth OIDC and SAML tabs, /settings/general → SettingsGeneral, Audit finding: login-callback / deploy-wizard / authflow-modals are showcases, not routes, §7 Trace the behavior — never conclude from a function name, The Tracing Protocol (6 steps, applied by Tasks 6–18), Bounded context: apikeys, Bounded context: identity, Bounded context: settings (+12 more)

### Community 9 - "SP12 Chat Lane Matrix Entries"
Cohesion: 0.15
Nodes (19): endpoint.enforce-require-api-key, catalog.model-listing-live-override, fallback.accounts-exhausted-response, routing.client-disconnect-propagation, routing.lane-entry-routes, routing.model-resolution, routing.request-preflight, §18 Streaming is first-class (TTFT, cancellation, backpressure) (+11 more)

### Community 10 - "Transport & Transient Retry"
Cohesion: 0.14
Nodes (18): transport.proxy-priority-chain, transport.test.mjs: adapter streams end to end over DirectTransport, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, ErrorCode: PROVIDER_UNAVAILABLE, DirectTransport (direct branch implementation), Failure: body larger than maxBytes in readBoundedText, Upstream answers 4xx or 5xx, Failure: connection refused, DNS failure, TLS failure (+10 more)

### Community 11 - "Login, Sessions & Lockout (SP6)"
Cohesion: 0.23
Nodes (17): identity.password-login-lockout, UI error code: INVALID_CREDENTIALS (401), UI error code: RATE_LIMITED (429), UI error code: SETUP_REQUIRED (409), useChangePassword (features/settings/api.ts), useLogin (features/settings/api.ts), useLogout (features/settings/api.ts), POST /api/auth/login (+9 more)

### Community 12 - "UI Transport Error Codes"
Cohesion: 0.20
Nodes (16): identity.auth-status-disclosure, UI error code: BAD_RESPONSE, UI error code: HTTP_5xx, UI error code: NETWORK_ERROR, UI error code: any other code (fallback), UI error code: TIMEOUT, UI error code: UNAUTHENTICATED (401), shared/errors.test.mjs (+8 more)

### Community 13 - "SP10 OpenAI Protocol & Translation"
Cohesion: 0.18
Nodes (16): routing.request-translation, routing.source-format-detection, routing.stream-mode-decision, translator.pivot-loss, translator.tool-id-normalization, CIP gains image detail and tool strict (OpenAI → OpenAI trip keeps them), toOpenAIChatCompletion() — CanonicalResponse → chat.completion JSON, OpenAI Chat Completions protocol adapter contract (M1 SP10) (+8 more)

### Community 14 - "SP9 Adapter Errors & Streaming"
Cohesion: 0.17
Nodes (15): fallback.error-classification, fallback.executor-retry-budget, routing.default-executor-openai-fallback, routing.streaming-pipeline, ListedModel { id, descriptor? } — getModels never invents limits (≤1000 ids), OpenAICompatibleAdapter (AIProviderPort for openai-compatible), readSseData() — bounded SSE reader (1 Mi chars per line/event, cancels body), Status → ErrorCode by status + error.code/type only (never message text) (+7 more)

### Community 15 - "API Key Management (SP6)"
Cohesion: 0.23
Nodes (14): apikey.delete-key, apikey.update-key-status, DELETE /api/keys/:id, UI error code: INVALID_REQUEST (400), UI error code: LIMIT_REACHED (409), UI error code: NOT_FOUND (404), useApiKeys (features/gateway/api.ts), useCreateKey (features/gateway/api.ts) (+6 more)

### Community 16 - "Capability Resolution (SP7)"
Cohesion: 0.26
Nodes (14): catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, combo.detect-required-capabilities, assertModelSupports() — MODEL_UNAVAILABLE / INVALID_REQUEST, Engine contract (M1 SP7), defineRegistry() / builtinRegistry (single openai entry, 4 chat models) (+6 more)

### Community 17 - "API-UI Map & Handoff"
Cohesion: 0.32
Nodes (13): API ↔ UI map (docs/design/API_UI_MAP.md), API_UI_MAP row: SP7 packages/engine, No UI, API_UI_MAP row: SP8 transport, No UI, Rule: an SP with no HTTP API records "No UI" in its row, HttpTransportPort, AIGate progress handoff (docs/PROGRESS_HANDOFF.md), Gap: M0 SP3 (parity harness) and SP4 (tools/extract) never built, Next step: M1 SP8 transport (HttpTransportPort, direct + timeout, no UI) (+5 more)

### Community 18 - "Architecture Spec & Monorepo"
Cohesion: 0.22
Nodes (13): GET /health, Feature-based frontend structure with import boundaries, Hexagonal architecture, granularity = bounded context, Monorepo layout (apps/server, apps/web, apps/cli, packages/engine, contracts, database, tools), Open decisions not settled by this spec, AIGate Design Spec (2026-09-22), Milestone M0 · Foundation, Decision (user, 2026-09-25): route all four SQLite clients through one locked sqlite-proxy wrapper (+5 more)

### Community 19 - "Fallback Policy & Bounded Retry"
Cohesion: 0.21
Nodes (12): §8 Business rule beats old implementation, §19 Fallback as explicit policy with classified errors, Canonical error classification codes (8 values), ExecCtx (one shared client-cancel + deadline signal), withRetry() — bounded retry helper (≤10 attempts, capped backoff, abortable), tools/lint/check.test.mjs (lint:check 13/13), Lint rule aigate/fetch-through-transport, Lint rule aigate/fetch-timeout (accepts AbortSignal.any([..., AbortSignal.timeout(n)])) (+4 more)

### Community 20 - "9router Findings: Usage & Errors"
Cohesion: 0.24
Nodes (10): fallback.upstream-error-result, routing.non-streaming-response, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O, Finding: 9router 0.5.55 errors carry only { message } with its node id and the raw upstream body, Finding: omitted stream on 9router 0.5.55 → JSON body sent as text/event-stream + bare [DONE] (unparsable), Finding: 9router adds 2000 tokens to reported prompt/total usage (addBufferToUsage) — SUSPECTED_BUG, tools/parity/src/scenarios.mjs DEVIATIONS — intentional differences from 9router, each with entry, label, reason (+2 more)

### Community 21 - "First-run Setup & Onboarding"
Cohesion: 0.33
Nodes (10): UI error code: ALREADY_SET_UP (409), UI error code: NOT_LOCAL (403), useSetup (features/settings/api.ts), POST /api/auth/setup, /welcome → Onboarding (one step), AIGATE_INITIAL_PASSWORD (first password at boot), Decision 2 (user, 2026-09-25): first password set from the local machine; no default password, Decision (user, 2026-09-25, option A): on shared machines rely on AIGATE_INITIAL_PASSWORD (+2 more)

### Community 22 - "Chat API /v1 & Endpoint Screen"
Cohesion: 0.31
Nodes (9): endpoint.extract-header-order, API_UI_MAP row: SP10 OpenAI Chat protocol, No UI, API_UI_MAP row: SP9 OpenAICompatibleAdapter, No UI, /gateway/endpoint readiness pill (Ready / Connect a provider / Check connection) + curl test, POST /v1/chat/completions + GET /v1/models (/v1 Chat API), Idle timeout between chunks (AIGATE_STREAM_IDLE_TIMEOUT_MS, default 300 s) → TIMEOUT error event, extractApiKey() (Authorization: Bearer first, then x-api-key), SP12 — routing: chat lane + Fastify raw streaming, backpressure, cancellation (+1 more)

### Community 23 - "UI Ownership & Wiring Rules"
Cohesion: 0.36
Nodes (8): docs/PROJECT_MAP.md (generated U-project ownership map), Rule: an API is done only when its UI screen is wired in the same SP, Decision: CLAUDE.md requires wiring the screen in the same SP as its API, Decision (user): build the Stitch UI before connecting application logic, UI ownership handoff (docs/design/UI_HANDOFF.md), Claude's integration boundary (keep shell/screens markup, add feature api.ts hooks), UI_READY — visual layout implemented with demo data only, ?uiState=loading|empty|error preview parameter

### Community 24 - "Partial Stream Failure & Encoder"
Cohesion: 0.53
Nodes (6): fallback.partial-stream-failure, Truncated stream or error event → PROVIDER_UNAVAILABLE with details.partial, Stream headers only after the first chunk: earlier failures are real JSON statuses, Golden scenario: partial stream failure, OpenAIChatStreamEncoder — StreamChunk → OpenAI SSE; fail() = error event, no [DONE], Usage chunk after the finish chunk, only with stream_options.include_usage

### Community 25 - "Skills & Lint Enforcement"
Cohesion: 0.40
Nodes (5): Split: machines block mechanics, skills teach judgement, Iron law: no skill without a failing test first (RED → GREEN → REFACTOR), UI performance constraints, Skill: writing-lean-bounded-code, SP0 — 2 skills + mechanical lint suite

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
- **Why does `Bounded context: routing (core)` connect `Routing Engine, Latency & CIP` to `Overview, Traffic, Network & Integrations`, `Providers, Credentials & Architecture`, `Discovery Outputs & Behavioral Questions`, `Parity Harness, Tiers & Error Taxonomy (SP3)`, `Settings Context (SP5)`, `API Key Validation & Identity Rules`, `SSO, Settings General & Tracing Protocol`, `SP12 Chat Lane Matrix Entries`, `SP10 OpenAI Protocol & Translation`, `API-UI Map & Handoff`, `Chat API /v1 & Endpoint Screen`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Why does `Milestone M-1 · Discovery` connect `Discovery Outputs & Behavioral Questions` to `Overview, Traffic, Network & Integrations`, `Providers, Credentials & Architecture`, `Parity Harness, Tiers & Error Taxonomy (SP3)`, `Routing Engine, Latency & CIP`, `SSO, Settings General & Tracing Protocol`, `API-UI Map & Handoff`, `Architecture Spec & Monorepo`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._