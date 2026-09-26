# Graph Report - docs  (2026-09-26)

## Corpus Check
- 25 files · ~55,688 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 692 nodes · 1818 edges · 30 communities
- Extraction: 85% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 261 edges (avg confidence: 0.87)
- Token cost: 574,916 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Overview, Network & Console Screens|Overview, Network & Console Screens]]
- [[_COMMUNITY_Screens, Architecture & Credential Checks|Screens, Architecture & Credential Checks]]
- [[_COMMUNITY_Capabilities & API-UI Map|Capabilities & API-UI Map]]
- [[_COMMUNITY_Discovery Outputs & Behavioral Questions|Discovery Outputs & Behavioral Questions]]
- [[_COMMUNITY_Error Taxonomy, Parity & Governance|Error Taxonomy, Parity & Governance]]
- [[_COMMUNITY_Connections & Secret Storage (SP11)|Connections & Secret Storage (SP11)]]
- [[_COMMUNITY_API Key Lookup & Identity|API Key Lookup & Identity]]
- [[_COMMUNITY_Login, Sessions & Password|Login, Sessions & Password]]
- [[_COMMUNITY_Catalog API & Anthropic Headers (SP13, SP14a)|Catalog API & Anthropic Headers (SP13, SP14a)]]
- [[_COMMUNITY_API Key Lifecycle|API Key Lifecycle]]
- [[_COMMUNITY_Settings Export & Tracing Protocol|Settings Export & Tracing Protocol]]
- [[_COMMUNITY_Transport Retry & Redaction|Transport Retry & Redaction]]
- [[_COMMUNITY_Protocol Translation (SP10)|Protocol Translation (SP10)]]
- [[_COMMUNITY_Settings API|Settings API]]
- [[_COMMUNITY_Custom Provider Nodes & apiType (SP13b, SP14c)|Custom Provider Nodes & apiType (SP13b, SP14c)]]
- [[_COMMUNITY_Provider Nodes API & Errors|Provider Nodes API & Errors]]
- [[_COMMUNITY_Anthropic Adapter & Anthropic Nodes (SP14a, SP14b)|Anthropic Adapter & Anthropic Nodes (SP14a, SP14b)]]
- [[_COMMUNITY_Chat Lane Routing Matrix (SP12)|Chat Lane Routing Matrix (SP12)]]
- [[_COMMUNITY_OpenAI Responses Adapter (SP14c)|OpenAI Responses Adapter (SP14c)]]
- [[_COMMUNITY_Catalog Extraction & Registry (SP4)|Catalog Extraction & Registry (SP4)]]
- [[_COMMUNITY_UI Error Codes (Transport & Connections)|UI Error Codes (Transport & Connections)]]
- [[_COMMUNITY_OpenAI Adapter & Non-Streaming Response|OpenAI Adapter & Non-Streaming Response]]
- [[_COMMUNITY_Client Cancellation & Backpressure|Client Cancellation & Backpressure]]
- [[_COMMUNITY_Stream-Only Providers & CodeBuddy (SP14b)|Stream-Only Providers & CodeBuddy (SP14b)]]
- [[_COMMUNITY_Onboarding & Setup Errors|Onboarding & Setup Errors]]
- [[_COMMUNITY_Chat API v1 & Endpoint Screen|Chat API /v1 & Endpoint Screen]]
- [[_COMMUNITY_Stream Mode & Parity Findings|Stream Mode & Parity Findings]]
- [[_COMMUNITY_Partial Stream Failure|Partial Stream Failure]]
- [[_COMMUNITY_Lean Code Rules|Lean Code Rules]]
- [[_COMMUNITY_Local Access & Schema Decisions|Local Access & Schema Decisions]]

## God Nodes (most connected - your core abstractions)
1. `Identity and API keys contract (M1 SP6)` - 37 edges
2. `Bounded context: routing (core)` - 35 edges
3. `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` - 32 edges
4. `Feature Matrix — mandatory 17-column artifact` - 27 edges
5. `Milestone M-1 · Discovery` - 27 edges
6. `Bounded context: connections` - 26 edges
7. `The 23 feature groups required by behavioral.md §5` - 26 edges
8. `SP6 — identity + apikeys (password login + key validation only)` - 25 edges
9. `shared/errors.ts toProblem() — the one code-to-message table` - 24 edges
10. `ChatLane (modules/routing/infrastructure/chat-lane.ts)` - 24 edges

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
- **OpenAI Responses family: adapter, non-stream read, 9router stream, apiType custom providers** — openai_responses_adapter, responses_non_stream_read, responses_stream_9router, provider_nodes_api_type_column, create_adapter [EXTRACTED 1.00]

## Communities (30 total, 0 thin omitted)

### Community 0 - "Overview, Network & Console Screens"
Cohesion: 0.05
Nodes (98): settings.outbound-proxy-live-apply, settings.proxy-test-outbound-probe, usage.write-not-synchronous, GET /overview/summary, SSE /events/requests, /traffic/console → Console (Developer mode only), /integrations/* → CliTools, CliToolDetail, Skills, Mcp, /network/* → ProxyPools, DeployWizard, Tunnel, Mitm (+90 more)

### Community 1 - "Screens, Architecture & Credential Checks"
Cohesion: 0.07
Nodes (80): validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, /providers/media* → MediaProviders, /providers/quota → Quota; custom provider form; multi-account, /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver, /settings/auth OIDC and SAML tabs, §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra), §9 Build an explicit domain model (Provider, Quota, RoutingPolicy…), §5 Feature discovery — inventory every group, do not trust the UI menu (+72 more)

### Community 2 - "Capabilities & API-UI Map"
Cohesion: 0.06
Nodes (64): catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, combo.detect-required-capabilities, API ↔ UI map (docs/design/API_UI_MAP.md), GET /health, docs/PROJECT_MAP.md (generated U-project ownership map) (+56 more)

### Community 3 - "Discovery Outputs & Behavioral Questions"
Cohesion: 0.05
Nodes (62): docs/capabilities.md (GENERATED capability specification), docs/discovery/coverage.md, docs/discovery/gaps.md (Gap register), docs/discovery/inventory.json, §30 The 12 pre-implementation questions, §3 The 20 behavioral questions (trigger…edge cases), §8 Business rule beats old implementation, §2 Core principles — never port, rename, or translate 9router line by line (+54 more)

### Community 4 - "Error Taxonomy, Parity & Governance"
Cohesion: 0.07
Nodes (52): fallback.error-classification, Status → ErrorCode by status + error.code/type only (never message text), API_UI_MAP row: M0 SP3 parity harness, No UI, Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Definition of Done — 13 items, not self-awarded, Error taxonomy (8 ErrorCodes), IMPLEMENTATION_ACCIDENT — debt not inherited from 9router (+44 more)

### Community 5 - "Connections & Secret Storage (SP11)"
Cohesion: 0.11
Nodes (30): catalog.connection-detail-crud, catalog.connection-listing, connection.client-listing-sanitized, connection.test-single-connection, connection.create-dedup-and-priority-assignment, connection.delete-and-reorder, connection.storage-shape-json-blob, DELETE /api/connections/:id (+22 more)

### Community 6 - "API Key Lookup & Identity"
Cohesion: 0.15
Nodes (23): apikey.legacy-format-unenforced, apikey.list-keys, apikey.validate-lookup, endpoint.rewrite-lanes, identity.auth-status-disclosure, identity.machine-id-derivation, identity.reset-password-local-only, settings.patch-password-change (+15 more)

### Community 7 - "Login, Sessions & Password"
Cohesion: 0.18
Nodes (19): identity.password-login-lockout, identity.session-cookie-lifecycle, UI error code: INVALID_CREDENTIALS (401), UI error code: RATE_LIMITED (429), UI error code: SETUP_REQUIRED (409), useChangePassword (features/settings/api.ts), useLogin (features/settings/api.ts), useLogout (features/settings/api.ts) (+11 more)

### Community 8 - "Catalog API & Anthropic Headers (SP13, SP14a)"
Cohesion: 0.15
Nodes (19): provider.anthropic-auth-and-headers, Adapter: catalog headers first, key last; raw or Bearer scheme; chatUrl/modelsUrl called directly, GET /api/providers/:id (chatUrl + models; 404 NOT_FOUND), GET /api/providers (all 121, connectable + reason), UI error code: PROVIDER_NOT_SUPPORTED (400), API_UI_MAP row: SP14a AnthropicAdapter — no new screen; /providers pills follow connectable, /providers → LlmProviders (catalog from GET /api/providers; Connected / Coming later pills), /providers/detail → ProviderDetail (Connection panel or reason; Models table) (+11 more)

### Community 9 - "API Key Lifecycle"
Cohesion: 0.16
Nodes (18): apikey.delete-key, apikey.generate-key, apikey.update-key-status, endpoint.enforce-require-api-key, DELETE /api/keys/:id, UI error code: LIMIT_REACHED (409), UI error code: NOT_FOUND (404), useCreateKey (features/gateway/api.ts) (+10 more)

### Community 10 - "Settings Export & Tracing Protocol"
Cohesion: 0.28
Nodes (17): settings.database-export-import, /settings/general → SettingsGeneral, Audit finding: login-callback / deploy-wizard / authflow-modals are showcases, not routes, §7 Trace the behavior — never conclude from a function name, The Tracing Protocol (6 steps, applied by Tasks 6–18), Bounded context: apikeys, Bounded context: identity, Bounded context: settings (+9 more)

### Community 11 - "Transport Retry & Redaction"
Cohesion: 0.15
Nodes (17): fallback.executor-retry-budget, transport.test.mjs: adapter streams end to end over DirectTransport, Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, ErrorCode: PROVIDER_UNAVAILABLE, DirectTransport (direct branch implementation), Failure: body larger than maxBytes in readBoundedText, Upstream answers 4xx or 5xx (+9 more)

### Community 12 - "Protocol Translation (SP10)"
Cohesion: 0.18
Nodes (17): routing.request-translation, routing.source-format-detection, translator.pivot-loss, translator.tool-id-normalization, src/json.ts — shared JSON narrowing (isRecord, record, text, list, parseJson), CIP gains image detail and tool strict (OpenAI → OpenAI trip keeps them), toOpenAIChatCompletion() — CanonicalResponse → chat.completion JSON, OpenAI Chat Completions protocol adapter contract (M1 SP10) (+9 more)

### Community 13 - "Settings API"
Cohesion: 0.31
Nodes (14): settings.combo-rotation-reset, settings.defaults-and-merge, settings.get-secret-stripping, settings.hot-path-read-no-cache, settings.patch-protected-keys, GET /api/settings, useRequireApiKey (features/gateway/api.ts), PATCH /api/settings (+6 more)

### Community 14 - "Custom Provider Nodes & apiType (SP13b, SP14c)"
Cohesion: 0.22
Nodes (14): connection.provider-node-api-type, connection.provider-node-create-list, connection.provider-node-repo-storage, connection.provider-node-update-delete, connection.provider-node-validate-partial-ssrf (stays traced: no validate route), /v1: <prefix>/<model> reaches a custom provider after built-in ids, aliases, and catalog prefixes, Custom providers contract (M2 SP13b), provider-node domain rules — prefix token, base URL normalize (strip /chat/completions), https or loopback http (+6 more)

### Community 15 - "Provider Nodes API & Errors"
Cohesion: 0.20
Nodes (14): DELETE /api/provider-nodes/:id (cascades the connection), GET /api/provider-nodes, PATCH /api/provider-nodes/:id, POST /api/provider-nodes, UI error code: NODE_LIMIT (409), UI error code: PREFIX_RESERVED (409), UI error code: PREFIX_TAKEN (409), useProviderNodes / useCreateNode / useUpdateNode / useDeleteNode (features/providers/api.ts) (+6 more)

### Community 16 - "Anthropic Adapter & Anthropic Nodes (SP14a, SP14b)"
Cohesion: 0.24
Nodes (13): connection.anthropic-compatible-node, translator.claude-to-openai-response, translator.openai-to-claude-request, AnthropicAdapter — CIP <-> Messages (max_tokens rules, thinking budgets, tool_use, SSE events), packages/engine/test/anthropic-adapter.test.mjs (10) + apps/server/test/anthropic-lane.test.mjs (4); 23 mutations caught, Deviations not ported: stop/top_p kept, none stays none, no Claude Code line, stream errors fail, same stop/usage mapping, 403 invalid, Claude Code anthropic-beta list for claude-* models on an Anthropic node (claude-code flag only on the official host), Anthropic node connection test: POST <base>/v1/messages, claude-3-haiku, only 401/403 invalid (9router) (+5 more)

### Community 17 - "Chat Lane Routing Matrix (SP12)"
Cohesion: 0.21
Nodes (13): catalog.model-listing-live-override, fallback.accounts-exhausted-response, routing.lane-entry-routes, routing.model-resolution, routing.request-preflight, Chat lane contract (M1 SP12), Keyless mode serves this machine only (loopback socket, Host, Origin) → 403 api_key_required, Model resolution: provider/model (any id) or a bare catalog id; 404 model_not_found / no_active_connection (+5 more)

### Community 18 - "OpenAI Responses Adapter (SP14c)"
Cohesion: 0.21
Nodes (13): routing.responses-non-stream-answer, translator.openai-to-responses-request, translator.responses-to-openai-stream, API_UI_MAP row: SP14c Responses adapter (no new screen for perplexity-agent) and the API select on /providers/new, createAdapter(provider, transport) — adapter chosen by protocol family, User decision 2026-09-26: SP14c corrects the non-stream answer, keeps 9router request drops and stream error handling, OpenAIResponsesAdapter — CIP <-> Responses API (extends OpenAICompatibleAdapter; 9router request and stream, corrected non-stream), OpenAI Responses provider contract (M2 SP14c) (+5 more)

### Community 19 - "Catalog Extraction & Registry (SP4)"
Cohesion: 0.21
Nodes (12): catalog.registry-build, catalog.registry-entry-shape, ListedModel { id, descriptor? } — getModels never invents limits (≤1000 ids), CATALOG — providers.generated.ts (121 providers, 935 models; never hand-edited), CatalogProvider / CatalogModel / validateCatalog (packages/engine/src/catalog/schema.ts), Registry extraction contract (M0 SP4), tools/extract (deleted in SP13b; restorable from git d2783c1) — wrote the catalog from 9router, tools/extract verify (deleted in SP13b with the tool) (+4 more)

### Community 20 - "UI Error Codes (Transport & Connections)"
Cohesion: 0.26
Nodes (12): UI error code: ALREADY_CONNECTED (409), UI error code: BAD_RESPONSE, UI error code: CREDENTIAL_UNREADABLE (409), UI error code: HTTP_5xx, UI error code: NETWORK_ERROR, UI error code: any other code (fallback), UI error code: TIMEOUT, shared/errors.test.mjs (+4 more)

### Community 21 - "OpenAI Adapter & Non-Streaming Response"
Cohesion: 0.25
Nodes (11): routing.default-executor-openai-fallback, routing.non-streaming-response, routing.streaming-pipeline, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), OpenAICompatibleAdapter (AIProviderPort for openai-compatible), readSseData() — bounded SSE reader (1 Mi chars per line/event, cancels body), packages/engine/test/openai-adapter.test.mjs (15 tests, fake transport, SSE split every 3 bytes; 16 mutations caught), Refused before I/O: video, media by URL, assistant thinking, tool_result.isError, budgetTokens, foreign vendorExtensions (+3 more)

### Community 22 - "Client Cancellation & Backpressure"
Cohesion: 0.20
Nodes (10): routing.client-disconnect-propagation, transport.proxy-priority-chain, §18 Streaming is first-class (TTFT, cancellation, backpressure), Backpressure: a false write() waits for drain; the upstream read pauses with it, One ExecCtx signal: client disconnect + 600 s budget (TIMEOUT) + idle watchdog, ExecCtx (one shared client-cancel + deadline signal), AIProviderPort, Failure: caller ctx.signal aborts (client left, budget spent) (+2 more)

### Community 23 - "Stream-Only Providers & CodeBuddy (SP14b)"
Cohesion: 0.27
Nodes (10): routing.forced-stream-json-collapse, provider.codebuddy-request-quirks, API_UI_MAP row: SP14b stream-only providers (no new screen) and the protocol select on /providers/new, Catalog providers contract (M2 SP13), CodeBuddy quirks: reasoningSummary (cn, intl), neutralAgentPrompt (cn) via EXECUTOR_QUIRKS, User decision 2026-09-26: SP14b keeps 9router on every suspected bug asked, User decision 2026-09-26 (second ask): the stream-only collapse buffer is unbounded like 9router, SP14b — Anthropic-compatible custom providers, stream-only providers (49 connectable) (+2 more)

### Community 24 - "Onboarding & Setup Errors"
Cohesion: 0.33
Nodes (10): UI error code: ALREADY_SET_UP (409), UI error code: INVALID_REQUEST (400), UI error code: NOT_LOCAL (403), useSetup (features/settings/api.ts), POST /api/auth/setup, /welcome → Onboarding (one step), AIGATE_INITIAL_PASSWORD (first password at boot), Decision 2 (user, 2026-09-25): first password set from the local machine; no default password (+2 more)

### Community 25 - "Chat API /v1 & Endpoint Screen"
Cohesion: 0.31
Nodes (9): endpoint.extract-header-order, API_UI_MAP row: SP10 OpenAI Chat protocol, No UI, /gateway/endpoint readiness pill (Ready / Connect a provider / Check connection) + curl test, POST /v1/chat/completions + GET /v1/models (/v1 Chat API), Idle timeout between chunks (AIGATE_STREAM_IDLE_TIMEOUT_MS, default 300 s) → TIMEOUT error event, extractApiKey() (Authorization: Bearer first, then x-api-key), SP12 — routing: chat lane + Fastify raw streaming, backpressure, cancellation, Deferred: streaming idle timeout (gap between chunks) with SP12 (+1 more)

### Community 26 - "Stream Mode & Parity Findings"
Cohesion: 0.28
Nodes (9): fallback.upstream-error-result, routing.stream-mode-decision, Finding: 9router 0.5.55 errors carry only { message } with its node id and the raw upstream body, Finding: omitted stream on 9router 0.5.55 → JSON body sent as text/event-stream + bare [DONE] (unparsable), Finding: 9router adds 2000 tokens to reported prompt/total usage (addBufferToUsage) — SUSPECTED_BUG, tools/parity/src/scenarios.mjs DEVIATIONS — intentional differences from 9router, each with entry, label, reason, tools/parity/tapes — 11 tapes from 9router 0.5.55 (JSON, stream, tool calls, omitted stream, 400/401/429/500, cut stream), Rule: an omitted stream flag means non-streaming (JSON) (+1 more)

### Community 27 - "Partial Stream Failure"
Cohesion: 0.83
Nodes (4): fallback.partial-stream-failure, Truncated stream or error event → PROVIDER_UNAVAILABLE with details.partial, Stream headers only after the first chunk: earlier failures are real JSON statuses, Golden scenario: partial stream failure

### Community 28 - "Lean Code Rules"
Cohesion: 0.50
Nodes (4): §15 Code quality — shortest CLEAR implementation, not shortest possible, Rule 1 — Write LEAN code, no over-engineering, Rule 2 — Code must be maintainable, no magic values or hidden side effects, Rule 12 — Priority order: Correctness → Simplicity → Maintainability → Predictable resources → Latency → Throughput → Optimization

### Community 29 - "Local Access & Schema Decisions"
Cohesion: 0.67
Nodes (4): Decision 4 (user, 2026-09-25): requireLogin = false exempts local clients only, Who counts as local (loopback socket + loopback Host + Origin), Decision (user, 2026-09-25): schema is added per bounded context, in its SP, after its contract exists, Setting key: requireLogin (boolean, default true)

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
- **Why does `Bounded context: routing (core)` connect `Screens, Architecture & Credential Checks` to `Overview, Network & Console Screens`, `Capabilities & API-UI Map`, `Discovery Outputs & Behavioral Questions`, `Error Taxonomy, Parity & Governance`, `API Key Lookup & Identity`, `API Key Lifecycle`, `Settings Export & Tracing Protocol`, `Protocol Translation (SP10)`, `Settings API`, `OpenAI Responses Adapter (SP14c)`, `Client Cancellation & Backpressure`, `Chat API /v1 & Endpoint Screen`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Why does `Task board (PROGRESS_HANDOFF)` connect `Capabilities & API-UI Map` to `Screens, Architecture & Credential Checks`, `Discovery Outputs & Behavioral Questions`, `Error Taxonomy, Parity & Governance`, `API Key Lookup & Identity`, `Catalog API & Anthropic Headers (SP13, SP14a)`, `Protocol Translation (SP10)`, `Settings API`, `Chat API /v1 & Endpoint Screen`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._