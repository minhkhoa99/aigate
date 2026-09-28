# Graph Report - docs  (2026-09-28)

## Corpus Check
- 37 files · ~83,060 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 884 nodes · 2211 edges · 44 communities
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 265 edges (avg confidence: 0.87)
- Token cost: 574,916 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Runtime settings, proxy and telemetry|Runtime settings, proxy and telemetry]]
- [[_COMMUNITY_Product architecture and API surface|Product architecture and API surface]]
- [[_COMMUNITY_OAuth and provider flows|OAuth and provider flows]]
- [[_COMMUNITY_Provider connection and data-plane contracts|Provider connection and data-plane contracts]]
- [[_COMMUNITY_Discovery matrices and validation|Discovery matrices and validation]]
- [[_COMMUNITY_Catalog, connection listing and detail|Catalog, connection listing and detail]]
- [[_COMMUNITY_Client protocol routing and translators|Client protocol routing and translators]]
- [[_COMMUNITY_Identity and audit|Identity and audit]]
- [[_COMMUNITY_Settings and endpoint policies|Settings and endpoint policies]]
- [[_COMMUNITY_API key lifecycle|API key lifecycle]]
- [[_COMMUNITY_Parity tools and visual design|Parity tools and visual design]]
- [[_COMMUNITY_Provider registry and connectability|Provider registry and connectability]]
- [[_COMMUNITY_Routing lanes and fallback|Routing lanes and fallback]]
- [[_COMMUNITY_Error taxonomy|Error taxonomy]]
- [[_COMMUNITY_API key and account lifecycle|API key and account lifecycle]]
- [[_COMMUNITY_Identity sessions and password UI|Identity sessions and password UI]]
- [[_COMMUNITY_Architecture and system map|Architecture and system map]]
- [[_COMMUNITY_Model import and live catalog|Model import and live catalog]]
- [[_COMMUNITY_Custom provider nodes|Custom provider nodes]]
- [[_COMMUNITY_Provider adapters and request translation|Provider adapters and request translation]]
- [[_COMMUNITY_Transport and retry behavior|Transport and retry behavior]]
- [[_COMMUNITY_OpenAI protocol and translation details|OpenAI protocol and translation details]]
- [[_COMMUNITY_Model capability resolution|Model capability resolution]]
- [[_COMMUNITY_Parity verification and golden tests|Parity verification and golden tests]]
- [[_COMMUNITY_Architecture decisions and quality rules|Architecture decisions and quality rules]]
- [[_COMMUNITY_Milestones, plan and handoff|Milestones, plan and handoff]]
- [[_COMMUNITY_Canonical chat and stream contract|Canonical chat and stream contract]]
- [[_COMMUNITY_Frontend error handling|Frontend error handling]]
- [[_COMMUNITY_Onboarding and authentication UI|Onboarding and authentication UI]]
- [[_COMMUNITY_Provider node UI and APIs|Provider node UI and APIs]]
- [[_COMMUNITY_Fallback and error classification|Fallback and error classification]]
- [[_COMMUNITY_Streaming cancellation and backpressure|Streaming cancellation and backpressure]]
- [[_COMMUNITY_Catalog and registry schema|Catalog and registry schema]]
- [[_COMMUNITY_Provider stream-only behavior|Provider stream-only behavior]]
- [[_COMMUNITY_Project map and UI governance|Project map and UI governance]]
- [[_COMMUNITY_Anthropic-compatible custom providers|Anthropic-compatible custom providers]]
- [[_COMMUNITY_APIUI map and OAuth connections|API/UI map and OAuth connections]]
- [[_COMMUNITY_Provider thinking levels|Provider thinking levels]]
- [[_COMMUNITY_Gateway readiness and key extraction|Gateway readiness and key extraction]]
- [[_COMMUNITY_Anthropic protocol parsing|Anthropic protocol parsing]]
- [[_COMMUNITY_Transport ports and idle timeout|Transport ports and idle timeout]]
- [[_COMMUNITY_Lint rules and bounded retry|Lint rules and bounded retry]]
- [[_COMMUNITY_Custom provider validation and stream retry|Custom provider validation and stream retry]]
- [[_COMMUNITY_Code quality principles|Code quality principles]]

## God Nodes (most connected - your core abstractions)
1. `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` - 39 edges
2. `Identity and API keys contract (M1 SP6)` - 37 edges
3. `Bounded context: routing (core)` - 36 edges
4. `Feature Matrix — mandatory 17-column artifact` - 27 edges
5. `Milestone M-1 · Discovery` - 27 edges
6. `API ↔ UI map (docs/design/API_UI_MAP.md)` - 27 edges
7. `Bounded context: connections` - 26 edges
8. `The 23 feature groups required by behavioral.md §5` - 26 edges
9. `ChatLane (modules/routing/infrastructure/chat-lane.ts)` - 26 edges
10. `SP6 — identity + apikeys (password login + key validation only)` - 25 edges

## Surprising Connections (you probably didn't know these)
- `Kiro AWS EventStream and Q model adapter` --uses--> `HttpTransportPort`  [EXTRACTED]
  packages/engine/src/adapters/kiro.ts → docs/superpowers/specs/2026-09-22-aigate-design.md
- `Trae SOLO chat session and SSE adapter` --uses--> `HttpTransportPort`  [EXTRACTED]
  packages/engine/src/adapters/trae.ts → docs/superpowers/specs/2026-09-22-aigate-design.md
- `Trae browser sign-in and callback/token import UI` --wires--> `Connections & AuthFlow — /providers/connections`  [EXTRACTED]
  apps/web/src/features/providers/sign-in.tsx → docs/superpowers/specs/2026-09-22-aigate-design.md
- `Bounded server-owned HTTP/2 transport` --extends--> `Transport contract (M1 SP8)`  [EXTRACTED]
  apps/server/src/modules/transport/infrastructure/direct-transport.ts → docs/contracts/transport.md
- `Framework-free thinking suffix parser and override` --feeds--> `Model resolution: provider/model (any id) or a bare catalog id; 404 model_not_found / no_active_connection`  [EXTRACTED]
  packages/engine/src/thinking.ts → docs/contracts/chat-lane.md

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
- **Ollama family: adapter, NDJSON reader, per-connection host and optional key, connections UI** — ollama_adapter, read_json_lines, connection_base_url, screen_connections_ollama_host, create_adapter [EXTRACTED 1.00]
- **Gemini family: adapter, schema cleaner, signature cache, CIP image chunk and finish override** — gemini_adapter, gemini_schema_cleaner, gemini_signature_cache, cip_image_delta_finish_override, create_adapter [EXTRACTED 1.00]
- **Vertex family: Google Cloud auth, Vertex and partner adapters, JSON credential connections and field** — google_auth, vertex_adapter, vertex_partner_adapter, json_credential_connections, screen_connections_google_key [EXTRACTED 1.00]
- **Per-connection data: descriptor fields, withConnection, chat probe, migration 0008, connection fields UI** — connection_fields_descriptor, chat_probe_test, connection_data_columns, screen_connections_fields, clinepass_envelope_headers [EXTRACTED 1.00]

## Communities (44 total, 0 thin omitted)

### Community 0 - "Runtime settings, proxy and telemetry"
Cohesion: 0.05
Nodes (98): settings.outbound-proxy-live-apply, settings.proxy-test-outbound-probe, usage.write-not-synchronous, GET /overview/summary, SSE /events/requests, /traffic/console → Console (Developer mode only), /integrations/* → CliTools, CliToolDetail, Skills, Mcp, /network/* → ProxyPools, DeployWizard, Tunnel, Mitm (+90 more)

### Community 1 - "Product architecture and API surface"
Cohesion: 0.07
Nodes (73): validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, /providers/media* → MediaProviders, /providers/quota → Quota; custom provider form; multi-account, /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver, docs/discovery/gaps.md (Gap register), §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra), §9 Build an explicit domain model (Provider, Quota, RoutingPolicy…), §5 Feature discovery — inventory every group, do not trust the UI menu (+65 more)

### Community 2 - "OAuth and provider flows"
Cohesion: 0.05
Nodes (65): oauth.dashboard-flow, oauth.refresh-lifecycle, oauth.token-storage, provider.antigravity-oauth, provider.claude-oauth, provider.cline-oauth, provider.codex-oauth, provider.github-copilot-oauth (+57 more)

### Community 3 - "Provider connection and data-plane contracts"
Cohesion: 0.06
Nodes (62): connection.commandcode-key-test, connection.ollama-local-host, connection.vertex-credential-test, provider.qoder-agent-transport (traced, not ported), provider.vertex-google-auth, routing.vertex-endpoints, translator.claude-to-openai-response, translator.commandcode-to-openai-response (+54 more)

### Community 4 - "Discovery matrices and validation"
Cohesion: 0.06
Nodes (59): docs/capabilities.md (GENERATED capability specification), docs/discovery/coverage.md, docs/discovery/inventory.json, §30 The 12 pre-implementation questions, §3 The 20 behavioral questions (trigger…edge cases), §8 Business rule beats old implementation, §2 Core principles — never port, rename, or translate 9router line by line, §29 Definition of Done — 13 checklist items, no self-declared DONE (+51 more)

### Community 5 - "Catalog, connection listing and detail"
Cohesion: 0.07
Nodes (47): catalog.connection-detail-crud, catalog.connection-listing, connection.azure-openai-deployment, connection.client-listing-sanitized, connection.cloudflare-account-id, connection.test-single-connection, provider.clinepass-headers-envelope, connection.create-dedup-and-priority-assignment (+39 more)

### Community 6 - "Client protocol routing and translators"
Cohesion: 0.08
Nodes (32): catalog.v1beta-generate-content-dispatch, catalog.v1beta-models-listing, routing.responses-compact-lane, routing.responses-non-stream-answer, translator.gemini-client-request, translator.openai-to-gemini-client-response, translator.openai-to-responses-client-response, translator.openai-to-responses-request (+24 more)

### Community 7 - "Identity and audit"
Cohesion: 0.15
Nodes (30): identity.machine-id-derivation, /settings/auth OIDC and SAML tabs, /settings/general → SettingsGeneral, Audit PASS: no credential leaked across 27 HTML exports, Audit finding: settings-auth regenerated as settings-auth-v2, Audit finding: login-callback / deploy-wizard / authflow-modals are showcases, not routes, Audit FAIL: sidebar not identical across screens, §27 Separate BUSINESS REQUIREMENT from IMPLEMENTATION ACCIDENT (+22 more)

### Community 8 - "Settings and endpoint policies"
Cohesion: 0.16
Nodes (25): endpoint.enforce-require-api-key, settings.combo-rotation-reset, settings.database-export-import, settings.defaults-and-merge, settings.get-secret-stripping, settings.hot-path-read-no-cache, settings.patch-protected-keys, GET /api/settings (+17 more)

### Community 9 - "API key lifecycle"
Cohesion: 0.18
Nodes (22): apikey.generate-key, apikey.list-keys, DELETE /api/keys/:id, UI error code: INVALID_REQUEST (400), UI error code: LIMIT_REACHED (409), UI error code: NOT_FOUND (404), UI error code: UNAUTHENTICATED (401), GET /api/keys (+14 more)

### Community 10 - "Parity tools and visual design"
Cohesion: 0.15
Nodes (19): API_UI_MAP row: M0 SP3 parity harness, No UI, Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Stated limits of tape-based parity, Recording proxy + 4-part tape, Normalizer + semantic SSE diff (not chunk diff), docs/parity/m1-gate-report.md — M1 gate: tier 1 11/11, golden 10 pass + 3 deferred, tier 2 waits for a key, coverage 11/284, pnpm parity record | replay | live | gate (+11 more)

### Community 11 - "Provider registry and connectability"
Cohesion: 0.15
Nodes (19): catalog.registry-build, catalog.registry-entry-shape, provider.anthropic-auth-and-headers, Adapter: catalog headers first, key last; raw or Bearer scheme; chatUrl/modelsUrl called directly, GET /api/providers/:id (chatUrl + models; 404 NOT_FOUND), GET /api/providers (all 121, connectable + reason), API_UI_MAP row: SP14a AnthropicAdapter — no new screen; /providers pills follow connectable, /providers → LlmProviders (catalog from GET /api/providers; Connected / Coming later pills) (+11 more)

### Community 12 - "Routing lanes and fallback"
Cohesion: 0.16
Nodes (17): endpoint.rewrite-lanes, catalog.model-listing-live-override, fallback.accounts-exhausted-response, routing.lane-entry-routes, routing.model-resolution, routing.request-preflight, Chat lane contract (M1 SP12), Keyless mode serves this machine only (loopback socket, Host, Origin) → 403 api_key_required (+9 more)

### Community 13 - "Error taxonomy"
Cohesion: 0.17
Nodes (16): Status → ErrorCode by status + error.code/type only (never message text), API_UI_MAP row: SP8 transport, No UI, Error taxonomy (8 ErrorCodes), FALLBACK_POLICY (8 error codes as data), ErrorCode: AUTH_ERROR, ErrorCode: INTERNAL_ERROR, ErrorCode: INVALID_REQUEST, ErrorCode: MODEL_UNAVAILABLE (+8 more)

### Community 14 - "API key and account lifecycle"
Cohesion: 0.19
Nodes (15): apikey.delete-key, apikey.legacy-format-unenforced, apikey.update-key-status, apikey.validate-lookup, identity.auth-status-disclosure, identity.reset-password-local-only, settings.patch-password-change, settings.require-login-public-status (+7 more)

### Community 15 - "Identity sessions and password UI"
Cohesion: 0.22
Nodes (15): identity.password-login-lockout, identity.session-cookie-lifecycle, UI error code: INVALID_CREDENTIALS (401), UI error code: RATE_LIMITED (429), UI error code: SETUP_REQUIRED (409), useChangePassword (features/settings/api.ts), useLogin (features/settings/api.ts), useLogout (features/settings/api.ts) (+7 more)

### Community 16 - "Architecture and system map"
Cohesion: 0.18
Nodes (15): GET /health, 9router as Behavioral Source of Truth (not a template to port), Feature-based frontend structure with import boundaries, Hexagonal architecture, granularity = bounded context, Monorepo layout (apps/server, apps/web, apps/cli, packages/engine, contracts, database, tools), Open decisions not settled by this spec, AIGate Design Spec (2026-09-22), Decision 3 (user, 2026-09-25): sessions stored in the database, not a JWT (+7 more)

### Community 17 - "Model import and live catalog"
Cohesion: 0.18
Nodes (15): catalog.provider-models-live-fetch, catalog.compatible-models-import-ui, catalog.custom-models-orphan-on-node-delete, catalog.model-connectivity-test, catalog.model-custom-registration, API_UI_MAP row SP16a, GET /api/connections/:id/models (adapter getModels, MODELS_FETCH_FAILED), Model import and custom models contract (M2 SP16a) (+7 more)

### Community 18 - "Custom provider nodes"
Cohesion: 0.18
Nodes (15): connection.provider-node-api-type, connection.provider-node-repo-storage, /v1: <prefix>/<model> reaches a custom provider after built-in ids, aliases, and catalog prefixes, /v1 resolution: provider-or-alias/model; non-connectable prefix → provider_not_supported; bare id → first declaring provider with an active connection, Custom headers - sealed values, hints, validation and merge, tools/extract (deleted in SP13b; restorable from git d2783c1) — wrote the catalog from 9router, provider-node domain rules — prefix token, base URL normalize (strip /chat/completions), https or loopback http, provider_nodes.api_type (migration 0006): chat | responses; ids openai-compatible-<apiType>-<hex>; changeable (+7 more)

### Community 19 - "Provider adapters and request translation"
Cohesion: 0.21
Nodes (14): routing.request-translation, routing.source-format-detection, OpenAICompatibleAdapter (AIProviderPort for openai-compatible), packages/engine/test/openai-adapter.test.mjs (15 tests, fake transport, SSE split every 3 bytes; 16 mutations caught), Refused before I/O: video, media by URL, assistant thinking, tool_result.isError, budgetTokens, foreign vendorExtensions, TokenUsage normalized: inputTokens excludes cache reads, outputTokens includes reasoning, Canonical Internal Protocol (CIP), vendorExtensions — typed carry-through field (+6 more)

### Community 20 - "Transport and retry behavior"
Cohesion: 0.19
Nodes (14): fallback.executor-retry-budget, transport.test.mjs: adapter streams end to end over DirectTransport, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, ErrorCode: PROVIDER_UNAVAILABLE, DirectTransport (direct branch implementation), Failure: body larger than maxBytes in readBoundedText, Failure: connection refused, DNS failure, TLS failure, Failure: upstream answers 3xx (redirect not followed) (+6 more)

### Community 21 - "OpenAI protocol and translation details"
Cohesion: 0.22
Nodes (13): translator.openai-cache-control-filter, translator.pivot-loss, translator.tool-id-normalization, OpenAI Chat cache_control on messages and text parts (CanonicalMessage.cacheControl), 11-translation-i18n.yaml, toOpenAIChatCompletion() — CanonicalResponse → chat.completion JSON, OpenAI Chat Completions protocol adapter contract (M1 SP10), OpenAIChatStreamEncoder — StreamChunk → OpenAI SSE; fail() = error event, no [DONE] (+5 more)

### Community 22 - "Model capability resolution"
Cohesion: 0.28
Nodes (13): catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, combo.detect-required-capabilities, assertModelSupports() — MODEL_UNAVAILABLE / INVALID_REQUEST, Engine contract (M1 SP7), detectRequiredCapabilities() (+5 more)

### Community 23 - "Parity verification and golden tests"
Cohesion: 0.30
Nodes (12): Parity verification — 3 tiers, apps/server/test/golden.test.mjs — 13 golden scenarios at M1 scope (3 deferred: SP16, SP17, SP19), Golden scenario: account failover, Golden scenario: all providers unavailable, Golden scenario: invalid credentials, Golden scenario: model unavailable, Golden scenario: normal completion, Golden scenario: provider fallback (+4 more)

### Community 24 - "Architecture decisions and quality rules"
Cohesion: 0.20
Nodes (11): Definition of Done — 13 items, not self-awarded, AIGate domain model (Provider, Credential, RoutingPolicy, AccountLock, …), IMPLEMENTATION_ACCIDENT — debt not inherited from 9router, Split: machines block mechanics, skills teach judgement, Mandatory 6-phase feature process (A Discovery → F Parity), Iron law: no skill without a failing test first (RED → GREEN → REFACTOR), UI performance constraints, AccountLock entity (+3 more)

### Community 25 - "Milestones, plan and handoff"
Cohesion: 0.29
Nodes (11): API_UI_MAP row: M0 SP4 tools/extract + CATALOG, No UI yet (SP13 serves /providers), API_UI_MAP row: SP7 packages/engine, No UI, API_UI_MAP row: SP9 OpenAICompatibleAdapter, No UI, Rule: an SP with no HTTP API records "No UI" in its row, Milestone M1 · Walking skeleton (thin end-to-end slice), AIGate progress handoff (docs/PROGRESS_HANDOFF.md), Gap: M0 SP3 (parity harness) and SP4 (tools/extract) never built, Task board (PROGRESS_HANDOFF) (+3 more)

### Community 26 - "Canonical chat and stream contract"
Cohesion: 0.24
Nodes (10): routing.non-streaming-response, routing.stream-mode-decision, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), Finding: 9router 0.5.55 errors carry only { message } with its node id and the raw upstream body, Finding: omitted stream on 9router 0.5.55 → JSON body sent as text/event-stream + bare [DONE] (unparsable), Finding: 9router adds 2000 tokens to reported prompt/total usage (addBufferToUsage) — SUSPECTED_BUG, tools/parity/src/scenarios.mjs DEVIATIONS — intentional differences from 9router, each with entry, label, reason, tools/parity/tapes — 11 tapes from 9router 0.5.55 (JSON, stream, tool calls, omitted stream, 400/401/429/500, cut stream) (+2 more)

### Community 27 - "Frontend error handling"
Cohesion: 0.33
Nodes (10): UI error code: BAD_RESPONSE, UI error code: HTTP_5xx, UI error code: NETWORK_ERROR, UI error code: any other code (fallback), UI error code: TIMEOUT, shared/errors.test.mjs, useAuthStatus (features/settings/api.ts), shared/api.ts — same-origin JSON client, ApiError with stable code, 10 s timeout (+2 more)

### Community 28 - "Onboarding and authentication UI"
Cohesion: 0.33
Nodes (10): UI error code: ALREADY_SET_UP (409), UI error code: NOT_LOCAL (403), useSetup (features/settings/api.ts), POST /api/auth/setup, /welcome → Onboarding (one step), AIGATE_INITIAL_PASSWORD (first password at boot), Decision 2 (user, 2026-09-25): first password set from the local machine; no default password, Decision (user, 2026-09-25, option A): on shared machines rely on AIGATE_INITIAL_PASSWORD (+2 more)

### Community 29 - "Provider node UI and APIs"
Cohesion: 0.29
Nodes (10): DELETE /api/provider-nodes/:id (cascades the connection), GET /api/provider-nodes, PATCH /api/provider-nodes/:id, POST /api/provider-nodes, UI error code: NODE_LIMIT (409), UI error code: PREFIX_RESERVED (409), UI error code: PREFIX_TAKEN (409), useProviderNodes / useCreateNode / useUpdateNode / useDeleteNode (features/providers/api.ts) (+2 more)

### Community 30 - "Fallback and error classification"
Cohesion: 0.28
Nodes (9): fallback.error-classification, fallback.partial-stream-failure, fallback.upstream-error-result, routing.default-executor-openai-fallback, Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O, Truncated stream or error event → PROVIDER_UNAVAILABLE with details.partial, Stream headers only after the first chunk: earlier failures are real JSON statuses, Golden scenario: partial stream failure (+1 more)

### Community 31 - "Streaming cancellation and backpressure"
Cohesion: 0.29
Nodes (8): routing.client-disconnect-propagation, §18 Streaming is first-class (TTFT, cancellation, backpressure), Backpressure: a false write() waits for drain; the upstream read pauses with it, One ExecCtx signal: client disconnect + 600 s budget (TIMEOUT) + idle watchdog, ExecCtx (one shared client-cancel + deadline signal), Golden scenario: client cancellation, AIProviderPort, Failure: caller ctx.signal aborts (client left, budget spent)

### Community 32 - "Catalog and registry schema"
Cohesion: 0.32
Nodes (8): ListedModel { id, descriptor? } — getModels never invents limits (≤1000 ids), CATALOG — providers.generated.ts (121 providers, 935 models; never hand-edited), CatalogProvider / CatalogModel / validateCatalog (packages/engine/src/catalog/schema.ts), defineRegistry() / builtinRegistry (single openai entry, 4 chat models), tools/extract verify (deleted in SP13b with the tool), Rule: model ids unique per (kind, id) — Gemini 2.5 serves both chat and stt, Rule: limits only when declared; 9router's floor 200000/64000 becomes null (sentinel probe), 46 SP13 candidates: openai-compatible, API key, standard chat URL, not hidden

### Community 33 - "Provider stream-only behavior"
Cohesion: 0.32
Nodes (8): routing.forced-stream-json-collapse, provider.codebuddy-request-quirks, API_UI_MAP row: SP14b stream-only providers (no new screen) and the protocol select on /providers/new, CodeBuddy quirks: reasoningSummary (cn, intl), neutralAgentPrompt (cn) via EXECUTOR_QUIRKS, User decision 2026-09-26: SP14b keeps 9router on every suspected bug asked, User decision 2026-09-26 (second ask): the stream-only collapse buffer is unbounded like 9router, OpenAICompatibleAdapter.execute collapse: stream:true upstream, SSE folded into one answer (reasoning dropped with content, cut-off = complete, no size limit), Stream-only providers contract (M2 SP14b)

### Community 34 - "Project map and UI governance"
Cohesion: 0.36
Nodes (8): docs/PROJECT_MAP.md (generated U-project ownership map), Rule: an API is done only when its UI screen is wired in the same SP, Decision: CLAUDE.md requires wiring the screen in the same SP as its API, Decision (user): build the Stitch UI before connecting application logic, UI ownership handoff (docs/design/UI_HANDOFF.md), Claude's integration boundary (keep shell/screens markup, add feature api.ts hooks), UI_READY — visual layout implemented with demo data only, ?uiState=loading|empty|error preview parameter

### Community 35 - "Anthropic-compatible custom providers"
Cohesion: 0.25
Nodes (8): connection.anthropic-compatible-node, Claude Code anthropic-beta list for claude-* models on an Anthropic node (claude-code flag only on the official host), Anthropic node connection test: POST <base>/v1/messages, claude-3-haiku, only 401/403 invalid (9router), features/providers/node-rules.ts unreachable(): OpenAI-compatible prefixes win, then the oldest, apps/server/test/provider-nodes.test.mjs (5 tests; 15 mutations caught), CustomProviderDetail page, /providers → Custom providers section (features/providers/custom.tsx): Connect, Edit, Delete, SP14b tests: engine adapter tests (8 new), server provider-nodes (2) + stream-only.test.mjs (3), web node-rules.test.mjs; 34 mutations caught

### Community 36 - "API/UI map and OAuth connections"
Cohesion: 0.38
Nodes (7): API ↔ UI map (docs/design/API_UI_MAP.md), API_UI_MAP row: SP15 Anthropic Messages client protocol, API_UI_MAP row: SP16 OAuth sign-in, API_UI_MAP row SP16b, API_UI_MAP SP16b2 row (device sign-in slow_down), Connections: sign-in in Add connection (popup, paste, device code), Signed-in rows, Sign in again; /callback relay, Endpoint screen: OpenAI and Anthropic chips, Claude Code and Anthropic curl copy fields

### Community 37 - "Provider thinking levels"
Cohesion: 0.29
Nodes (7): Custom provider thinking level, Provider Models Use as, Copy and Test suffix, model(level) suffix contract and unknown suffix caveat, Provider thinking defaults and model effort levels, provider_thinking table - built-in provider default level, M2 provider thinking part 2 - model-level suffixes, Framework-free thinking suffix parser and override

### Community 38 - "Gateway readiness and key extraction"
Cohesion: 0.53
Nodes (6): endpoint.extract-header-order, API_UI_MAP row: SP10 OpenAI Chat protocol, No UI, /gateway/endpoint readiness pill (Ready / Connect a provider / Check connection) + curl test, POST /v1/chat/completions + GET /v1/models (/v1 Chat API), extractApiKey() (Authorization: Bearer first, then x-api-key), SP12 — routing: chat lane + Fastify raw streaming, backpressure, cancellation

### Community 39 - "Anthropic protocol parsing"
Cohesion: 0.47
Nodes (6): routing.count-tokens-estimate, translator.claude-client-request, translator.openai-to-claude-client-response, protocols/anthropic-messages.ts — parse to CIP, anthropicRequestFor (passthrough for Anthropic, claude→openai rules otherwise), message, SSE encoder, count_tokens, User decision 2026-09-27: SP15 Anthropic first; OpenAI-shaped errors and 9router non-stream/stream-default kept; real usage, live tool args, signature_delta corrected, SP15 tests: engine anthropic-protocol.test.mjs (7), server messages-lane.test.mjs; 52 mutations, 1 equivalent

### Community 40 - "Transport ports and idle timeout"
Cohesion: 0.33
Nodes (6): routing.streaming-pipeline, transport.proxy-priority-chain, Idle timeout between chunks (AIGATE_STREAM_IDLE_TIMEOUT_MS, default 300 s) → TIMEOUT error event, Deferred: streaming idle timeout (gap between chunks) with SP12, HttpRequest (requires timeoutMs), Rule: every call states timeoutMs (1 to 600000 ms), bounding headers and body inside ctx.signal

### Community 41 - "Lint rules and bounded retry"
Cohesion: 0.53
Nodes (6): withRetry() — bounded retry helper (≤10 attempts, capped backoff, abortable), tools/lint/check.test.mjs (lint:check 13/13), Lint rule aigate/fetch-through-transport, Lint rule aigate/fetch-timeout (accepts AbortSignal.any([..., AbortSignal.timeout(n)])), Lint rule aigate/retry-through-helper, SP0.1 — Mechanical lint/CI suite (§11.2)

### Community 42 - "Custom provider validation and stream retry"
Cohesion: 0.33
Nodes (6): connection.provider-node-create-list, connection.provider-node-update-delete, connection.provider-node-validate-partial-ssrf (stays traced: no validate route), Custom providers contract (M2 SP13b), Custom provider options - sealed headers and retryStreamErrors, StreamRetryAdapter - bounded retries for first-event stream errors

### Community 43 - "Code quality principles"
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
- **35 isolated node(s):** `ErrorCode: INTERNAL_ERROR`, `03-accounts-multiaccount.yaml`, `05-request-routing-fallback.yaml`, `07-token-saver.yaml`, `09-media-providers.yaml` (+30 more)
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
- **Why does `Bounded context: routing (core)` connect `Product architecture and API surface` to `Runtime settings, proxy and telemetry`, `Provider connection and data-plane contracts`, `Discovery matrices and validation`, `Gateway readiness and key extraction`, `Identity and audit`, `Settings and endpoint policies`, `Routing lanes and fallback`, `Error taxonomy`, `Model import and live catalog`, `Provider adapters and request translation`, `OpenAI protocol and translation details`, `Milestones, plan and handoff`, `Streaming cancellation and backpressure`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Why does `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` connect `Provider adapters and request translation` to `Runtime settings, proxy and telemetry`, `Catalog and registry schema`, `Product architecture and API surface`, `Provider connection and data-plane contracts`, `Provider stream-only behavior`, `Catalog, connection listing and detail`, `Client protocol routing and translators`, `Lint rules and bounded retry`, `Provider registry and connectability`, `Routing lanes and fallback`, `Error taxonomy`, `Custom provider nodes`, `Transport and retry behavior`, `Canonical chat and stream contract`, `Fallback and error classification`, `Streaming cancellation and backpressure`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._