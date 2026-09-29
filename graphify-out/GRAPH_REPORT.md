# Graph Report - docs  (2026-09-29)

## Corpus Check
- 39 files · ~85,035 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 905 nodes · 2234 edges · 48 communities (47 shown, 1 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 261 edges (avg confidence: 0.87)
- Token cost: 574,916 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Dashboard screens and API routes|Dashboard screens and API routes]]
- [[_COMMUNITY_Application architecture and provider flows|Application architecture and provider flows]]
- [[_COMMUNITY_Provider connection and protocol adapters|Provider connection and protocol adapters]]
- [[_COMMUNITY_Discovery artifacts and architecture specification|Discovery artifacts and architecture specification]]
- [[_COMMUNITY_Provider connections and account management|Provider connections and account management]]
- [[_COMMUNITY_Custom providers and stream routing|Custom providers and stream routing]]
- [[_COMMUNITY_Gemini and Responses client protocols|Gemini and Responses client protocols]]
- [[_COMMUNITY_Settings and runtime configuration|Settings and runtime configuration]]
- [[_COMMUNITY_API key lifecycle and UI|API key lifecycle and UI]]
- [[_COMMUNITY_Gateway routing and model resolution|Gateway routing and model resolution]]
- [[_COMMUNITY_OAuth providers and refresh lifecycle|OAuth providers and refresh lifecycle]]
- [[_COMMUNITY_API key validation and endpoint security|API key validation and endpoint security]]
- [[_COMMUNITY_Catalog registry and provider headers|Catalog registry and provider headers]]
- [[_COMMUNITY_Parity, branding and audit documents|Parity, branding and audit documents]]
- [[_COMMUNITY_Fallback policy and OpenAI adapter|Fallback policy and OpenAI adapter]]
- [[_COMMUNITY_Live catalog models and custom model import|Live catalog models and custom model import]]
- [[_COMMUNITY_Transport failures and bounded requests|Transport failures and bounded requests]]
- [[_COMMUNITY_Identity, settings and dashboard modules|Identity, settings and dashboard modules]]
- [[_COMMUNITY_Request translation and OpenAI messages|Request translation and OpenAI messages]]
- [[_COMMUNITY_Shared UI error mappings|Shared UI error mappings]]
- [[_COMMUNITY_Golden scenarios and parity verification|Golden scenarios and parity verification]]
- [[_COMMUNITY_Engine errors, capabilities and transport contract|Engine errors, capabilities and transport contract]]
- [[_COMMUNITY_Anthropic client protocol lane|Anthropic client protocol lane]]
- [[_COMMUNITY_Model capabilities and engine contract|Model capabilities and engine contract]]
- [[_COMMUNITY_GitHubCodex adapters and collected streams|GitHub/Codex adapters and collected streams]]
- [[_COMMUNITY_Non-streaming routing and OpenAI response mapping|Non-streaming routing and OpenAI response mapping]]
- [[_COMMUNITY_Health, architecture and project structure|Health, architecture and project structure]]
- [[_COMMUNITY_Milestones, APIUI map and handoff|Milestones, API/UI map and handoff]]
- [[_COMMUNITY_Error taxonomy, retries and lint policy|Error taxonomy, retries and lint policy]]
- [[_COMMUNITY_SP18 keyless proxy rotation, DNS bypass and OpenCode|SP18 keyless proxy rotation, DNS bypass and OpenCode]]
- [[_COMMUNITY_Claude and Codex OAuth adapters|Claude and Codex OAuth adapters]]
- [[_COMMUNITY_Setup, passwords and local access|Setup, passwords and local access]]
- [[_COMMUNITY_Foundation constraints and SQLite design|Foundation constraints and SQLite design]]
- [[_COMMUNITY_Dashboard login and error states|Dashboard login and error states]]
- [[_COMMUNITY_Domain model and implementation rules|Domain model and implementation rules]]
- [[_COMMUNITY_Catalog schema and registry validation|Catalog schema and registry validation]]
- [[_COMMUNITY_Project map and UI integration rules|Project map and UI integration rules]]
- [[_COMMUNITY_Streaming transport and cancellation|Streaming transport and cancellation]]
- [[_COMMUNITY_Antigravity OAuth provider family|Antigravity OAuth provider family]]
- [[_COMMUNITY_SP16d OAuth provider family|SP16d OAuth provider family]]
- [[_COMMUNITY_Partial stream failure handling|Partial stream failure handling]]
- [[_COMMUNITY_Trae OAuth and SOLO provider family|Trae OAuth and SOLO provider family]]
- [[_COMMUNITY_Cursor ConnectRPC transport|Cursor ConnectRPC transport]]
- [[_COMMUNITY_Hosted relay deployment|Hosted relay deployment]]
- [[_COMMUNITY_Kiro OAuth and EventStream provider|Kiro OAuth and EventStream provider]]
- [[_COMMUNITY_Error-code mapping and fallback policy|Error-code mapping and fallback policy]]
- [[_COMMUNITY_Code quality rules|Code quality rules]]
- [[_COMMUNITY_Google OAuth configuration|Google OAuth configuration]]

## God Nodes (most connected - your core abstractions)
1. `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` - 39 edges
2. `Identity and API keys contract (M1 SP6)` - 37 edges
3. `Bounded context: routing (core)` - 36 edges
4. `Feature Matrix — mandatory 17-column artifact` - 27 edges
5. `Milestone M-1 · Discovery` - 27 edges
6. `API ↔ UI map (docs/design/API_UI_MAP.md)` - 27 edges
7. `ChatLane (modules/routing/infrastructure/chat-lane.ts)` - 27 edges
8. `Bounded context: connections` - 26 edges
9. `The 23 feature groups required by behavioral.md §5` - 26 edges
10. `SP6 — identity + apikeys (password login + key validation only)` - 25 edges

## Surprising Connections (you probably didn't know these)
- `Kiro AWS EventStream and Q model adapter` --uses--> `HttpTransportPort`  [EXTRACTED]
  packages/engine/src/adapters/kiro.ts → docs/superpowers/specs/2026-09-22-aigate-design.md
- `Trae SOLO chat session and SSE adapter` --uses--> `HttpTransportPort`  [EXTRACTED]
  packages/engine/src/adapters/trae.ts → docs/superpowers/specs/2026-09-22-aigate-design.md
- `Trae browser sign-in and callback/token import UI` --wires--> `Connections & AuthFlow — /providers/connections`  [EXTRACTED]
  apps/web/src/features/providers/sign-in.tsx → docs/superpowers/specs/2026-09-22-aigate-design.md
- `Keyless proxy strategy panel with empty state` --extends--> `Proxy Pools — /network/proxy-pools`  [EXTRACTED]
  apps/web/src/features/network/screens.tsx → docs/superpowers/specs/2026-09-22-aigate-design.md
- `Platform-specific hosted relay deploy wizard` --extends--> `Proxy Pools — /network/proxy-pools`  [EXTRACTED]
  apps/web/src/features/network/screens.tsx → docs/superpowers/specs/2026-09-22-aigate-design.md

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
- **Ollama family: adapter, NDJSON reader, per-connection host and optional key, connections UI** — ollama_adapter, read_json_lines, connection_base_url, screen_connections_ollama_host, create_adapter [EXTRACTED 1.00]
- **Gemini family: adapter, schema cleaner, signature cache, CIP image chunk and finish override** — gemini_adapter, gemini_schema_cleaner, gemini_signature_cache, cip_image_delta_finish_override, create_adapter [EXTRACTED 1.00]
- **Vertex family: Google Cloud auth, Vertex and partner adapters, JSON credential connections and field** — google_auth, vertex_adapter, vertex_partner_adapter, json_credential_connections, screen_connections_google_key [EXTRACTED 1.00]
- **Per-connection data: descriptor fields, withConnection, chat probe, migration 0008, connection fields UI** — connection_fields_descriptor, chat_probe_test, connection_data_columns, screen_connections_fields, clinepass_envelope_headers [EXTRACTED 1.00]

## Communities (48 total, 1 thin omitted)

### Community 0 - "Dashboard screens and API routes"
Cohesion: 0.07
Nodes (85): GET /overview/summary, SSE /events/requests, /traffic/console → Console (Developer mode only), /integrations/* → CliTools, CliToolDetail, Skills, Mcp, /network/* → ProxyPools, DeployWizard, Tunnel, Mitm, / → Overview, /traffic/usage, /traffic/requests* → Usage, Requests, RequestDetail, Audit finding: Console shown in sidebar regardless of Developer mode (+77 more)

### Community 1 - "Application architecture and provider flows"
Cohesion: 0.06
Nodes (83): validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, /providers/media* → MediaProviders, /providers/quota → Quota; custom provider form; multi-account, /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver, /settings/auth OIDC and SAML tabs, docs/discovery/gaps.md (Gap register), §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra), §9 Build an explicit domain model (Provider, Quota, RoutingPolicy…) (+75 more)

### Community 2 - "Provider connection and protocol adapters"
Cohesion: 0.05
Nodes (66): connection.anthropic-compatible-node, connection.commandcode-key-test, connection.ollama-local-host, connection.vertex-credential-test, provider.qoder-agent-transport (traced, not ported), provider.vertex-google-auth, routing.vertex-endpoints, translator.claude-to-openai-response (+58 more)

### Community 3 - "Discovery artifacts and architecture specification"
Cohesion: 0.05
Nodes (64): docs/capabilities.md (GENERATED capability specification), docs/discovery/coverage.md, docs/discovery/inventory.json, §30 The 12 pre-implementation questions, §3 The 20 behavioral questions (trigger…edge cases), §2 Core principles — never port, rename, or translate 9router line by line, §29 Definition of Done — 13 checklist items, no self-declared DONE, §14 Feature parity is not code parity (+56 more)

### Community 4 - "Provider connections and account management"
Cohesion: 0.06
Nodes (52): catalog.connection-detail-crud, catalog.connection-listing, connection.azure-openai-deployment, connection.client-listing-sanitized, connection.cloudflare-account-id, connection.test-single-connection, provider.clinepass-headers-envelope, connection.create-dedup-and-priority-assignment (+44 more)

### Community 5 - "Custom providers and stream routing"
Cohesion: 0.07
Nodes (46): connection.provider-node-api-type, connection.provider-node-create-list, connection.provider-node-repo-storage, connection.provider-node-update-delete, connection.provider-node-validate-partial-ssrf (stays traced: no validate route), routing.forced-stream-json-collapse, provider.codebuddy-request-quirks, DELETE /api/provider-nodes/:id (cascades the connection) (+38 more)

### Community 6 - "Gemini and Responses client protocols"
Cohesion: 0.08
Nodes (32): catalog.v1beta-generate-content-dispatch, catalog.v1beta-models-listing, routing.responses-compact-lane, routing.responses-non-stream-answer, translator.gemini-client-request, translator.openai-to-gemini-client-response, translator.openai-to-responses-client-response, translator.openai-to-responses-request (+24 more)

### Community 7 - "Settings and runtime configuration"
Cohesion: 0.12
Nodes (29): settings.combo-rotation-reset, settings.database-export-import, settings.defaults-and-merge, settings.get-secret-stripping, settings.hot-path-read-no-cache, settings.outbound-proxy-live-apply, settings.patch-protected-keys, settings.proxy-test-outbound-probe (+21 more)

### Community 8 - "API key lifecycle and UI"
Cohesion: 0.18
Nodes (23): apikey.generate-key, DELETE /api/keys/:id, UI error code: LIMIT_REACHED (409), UI error code: NOT_FOUND (404), UI error code: UNAUTHENTICATED (401), GET /api/keys, useApiKeys (features/gateway/api.ts), useCreateKey (features/gateway/api.ts) (+15 more)

### Community 9 - "Gateway routing and model resolution"
Cohesion: 0.14
Nodes (21): endpoint.extract-header-order, catalog.model-listing-live-override, fallback.accounts-exhausted-response, routing.lane-entry-routes, routing.model-resolution, routing.request-preflight, API_UI_MAP row: SP10 OpenAI Chat protocol, No UI, /gateway/endpoint readiness pill (Ready / Connect a provider / Check connection) + curl test (+13 more)

### Community 10 - "OAuth providers and refresh lifecycle"
Cohesion: 0.20
Nodes (21): oauth.dashboard-flow, oauth.refresh-lifecycle, oauth.token-storage, provider.cline-oauth, provider.gitlab-duo-oauth, provider.kilocode-device-auth, provider.kimchi-browser-token, account.concurrent-refresh-race (+13 more)

### Community 11 - "API key validation and endpoint security"
Cohesion: 0.18
Nodes (19): apikey.delete-key, apikey.legacy-format-unenforced, apikey.list-keys, apikey.update-key-status, apikey.validate-lookup, endpoint.enforce-require-api-key, identity.auth-status-disclosure, identity.reset-password-local-only (+11 more)

### Community 12 - "Catalog registry and provider headers"
Cohesion: 0.15
Nodes (19): catalog.registry-build, catalog.registry-entry-shape, provider.anthropic-auth-and-headers, Adapter: catalog headers first, key last; raw or Bearer scheme; chatUrl/modelsUrl called directly, GET /api/providers (all 121, connectable + reason), API_UI_MAP row: SP14a AnthropicAdapter — no new screen; /providers pills follow connectable, /providers → LlmProviders (catalog from GET /api/providers; Connected / Coming later pills), builtinRegistry built from CATALOG (41 connectable providers) (+11 more)

### Community 13 - "Parity, branding and audit documents"
Cohesion: 0.15
Nodes (19): API_UI_MAP row: M0 SP3 parity harness, No UI, Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Stated limits of tape-based parity, Recording proxy + 4-part tape, Normalizer + semantic SSE diff (not chunk diff), docs/parity/m1-gate-report.md — M1 gate: tier 1 11/11, golden 10 pass + 3 deferred, tier 2 waits for a key, coverage 11/284, pnpm parity record | replay | live | gate (+11 more)

### Community 14 - "Fallback policy and OpenAI adapter"
Cohesion: 0.15
Nodes (17): fallback.error-classification, fallback.executor-retry-budget, routing.default-executor-openai-fallback, routing.streaming-pipeline, OpenAICompatibleAdapter (AIProviderPort for openai-compatible), readSseData() — bounded SSE reader (1 Mi chars per line/event, cancels body), packages/engine/test/openai-adapter.test.mjs (15 tests, fake transport, SSE split every 3 bytes; 16 mutations caught), Refused before I/O: video, media by URL, assistant thinking, tool_result.isError, budgetTokens, foreign vendorExtensions (+9 more)

### Community 15 - "Live catalog models and custom model import"
Cohesion: 0.18
Nodes (15): catalog.provider-models-live-fetch, catalog.compatible-models-import-ui, catalog.custom-models-orphan-on-node-delete, catalog.model-connectivity-test, catalog.model-custom-registration, API_UI_MAP row SP16a, GET /api/connections/:id/models (adapter getModels, MODELS_FETCH_FAILED), Model import and custom models contract (M2 SP16a) (+7 more)

### Community 16 - "Transport failures and bounded requests"
Cohesion: 0.17
Nodes (15): transport.test.mjs: adapter streams end to end over DirectTransport, Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, ErrorCode: PROVIDER_UNAVAILABLE, DirectTransport (direct branch implementation), Failure: body larger than maxBytes in readBoundedText, Upstream answers 4xx or 5xx, Failure: connection refused, DNS failure, TLS failure (+7 more)

### Community 17 - "Identity, settings and dashboard modules"
Cohesion: 0.34
Nodes (14): identity.machine-id-derivation, /settings/general → SettingsGeneral, Audit finding: login-callback / deploy-wizard / authflow-modals are showcases, not routes, Bounded context: identity, Bounded context: settings, Feature group: Settings, Nav group: Settings (General · Auth & Access · Developer), Auth — /login, /callback (+6 more)

### Community 18 - "Request translation and OpenAI messages"
Cohesion: 0.22
Nodes (14): routing.request-translation, routing.source-format-detection, translator.openai-cache-control-filter, translator.pivot-loss, translator.tool-id-normalization, OpenAI Chat cache_control on messages and text parts (CanonicalMessage.cacheControl), 11-translation-i18n.yaml, toOpenAIChatCompletion() — CanonicalResponse → chat.completion JSON (+6 more)

### Community 19 - "Shared UI error mappings"
Cohesion: 0.21
Nodes (14): UI error code: ALREADY_CONNECTED (409), UI error code: BAD_RESPONSE, UI error code: HTTP_5xx, UI error code: NETWORK_ERROR, UI error code: any other code (fallback), UI error code: TIMEOUT, shared/errors.test.mjs, useAuthStatus (features/settings/api.ts) (+6 more)

### Community 20 - "Golden scenarios and parity verification"
Cohesion: 0.26
Nodes (14): Parity verification — 3 tiers, apps/server/test/golden.test.mjs — 13 golden scenarios at M1 scope (3 deferred: SP16, SP17, SP19), Golden scenario: account failover, Golden scenario: all providers unavailable, Golden scenario: client cancellation, Golden scenario: invalid credentials, Golden scenario: model unavailable, Golden scenario: normal completion (+6 more)

### Community 21 - "Engine errors, capabilities and transport contract"
Cohesion: 0.19
Nodes (13): API_UI_MAP row: SP8 transport, No UI, Error taxonomy (8 ErrorCodes), assertModelSupports() — MODEL_UNAVAILABLE / INVALID_REQUEST, ErrorCode: AUTH_ERROR, ErrorCode: INTERNAL_ERROR, ErrorCode: INVALID_REQUEST, ErrorCode: MODEL_UNAVAILABLE, ErrorCode: QUOTA_EXHAUSTED (+5 more)

### Community 22 - "Anthropic client protocol lane"
Cohesion: 0.23
Nodes (12): endpoint.rewrite-lanes, routing.count-tokens-estimate, translator.claude-client-request, translator.openai-to-claude-client-response, protocols/anthropic-messages.ts — parse to CIP, anthropicRequestFor (passthrough for Anthropic, claude→openai rules otherwise), message, SSE encoder, count_tokens, API_UI_MAP row: SP15 Anthropic Messages client protocol, Chat lane client protocol object (parse, prepare, respond, encoder) shared by /v1/chat/completions and /v1/messages, User decision 2026-09-27: SP15 Anthropic first; OpenAI-shaped errors and 9router non-stream/stream-default kept; real usage, live tool args, signature_delta corrected (+4 more)

### Community 23 - "Model capabilities and engine contract"
Cohesion: 0.30
Nodes (12): catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, combo.detect-required-capabilities, Engine contract (M1 SP7), detectRequiredCapabilities(), dependency-cruiser rule engine-framework-free (+4 more)

### Community 24 - "GitHub/Codex adapters and collected streams"
Cohesion: 0.22
Nodes (11): provider.github-copilot-oauth, API ↔ UI map (docs/design/API_UI_MAP.md), API_UI_MAP SP16b2 row (device sign-in slow_down), Failed mutations re-read the server; submit disabled while pending, adapters/collect.ts (stream collected into one response), copilotChatBody (Copilot part and parameter rules), SP16b2 user decision (do not ask, port 9router as is), GithubAdapter (Copilot /chat/completions, /responses, /v1/messages) (+3 more)

### Community 25 - "Non-streaming routing and OpenAI response mapping"
Cohesion: 0.22
Nodes (11): fallback.upstream-error-result, routing.non-streaming-response, routing.stream-mode-decision, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), Finding: 9router 0.5.55 errors carry only { message } with its node id and the raw upstream body, Finding: omitted stream on 9router 0.5.55 → JSON body sent as text/event-stream + bare [DONE] (unparsable), Finding: 9router adds 2000 tokens to reported prompt/total usage (addBufferToUsage) — SUSPECTED_BUG, tools/parity/src/scenarios.mjs DEVIATIONS — intentional differences from 9router, each with entry, label, reason (+3 more)

### Community 26 - "Health, architecture and project structure"
Cohesion: 0.22
Nodes (11): usage.write-not-synchronous, GET /health, 9router as Behavioral Source of Truth (not a template to port), Feature-based frontend structure with import boundaries, Hexagonal architecture, granularity = bounded context, Monorepo layout (apps/server, apps/web, apps/cli, packages/engine, contracts, database, tools), Open decisions not settled by this spec, AIGate Design Spec (2026-09-22) (+3 more)

### Community 27 - "Milestones, API/UI map and handoff"
Cohesion: 0.29
Nodes (11): API_UI_MAP row: M0 SP4 tools/extract + CATALOG, No UI yet (SP13 serves /providers), API_UI_MAP row: SP7 packages/engine, No UI, API_UI_MAP row: SP9 OpenAICompatibleAdapter, No UI, Rule: an SP with no HTTP API records "No UI" in its row, Milestone M1 · Walking skeleton (thin end-to-end slice), AIGate progress handoff (docs/PROGRESS_HANDOFF.md), Gap: M0 SP3 (parity harness) and SP4 (tools/extract) never built, Task board (PROGRESS_HANDOFF) (+3 more)

### Community 28 - "Error taxonomy, retries and lint policy"
Cohesion: 0.24
Nodes (11): §8 Business rule beats old implementation, §19 Fallback as explicit policy with classified errors, Canonical error classification codes (8 values), withRetry() — bounded retry helper (≤10 attempts, capped backoff, abortable), tools/lint/check.test.mjs (lint:check 13/13), Lint rule aigate/fetch-through-transport, Lint rule aigate/fetch-timeout (accepts AbortSignal.any([..., AbortSignal.timeout(n)])), Lint rule aigate/retry-through-helper (+3 more)

### Community 29 - "SP18 keyless proxy rotation, DNS bypass and OpenCode"
Cohesion: 0.18
Nodes (11): Keyless proxy rotation API and resolver, Keyless proxy strategy panel with empty state, Google DNS pinning for exact MITM hosts, OpenCode Chat, Responses and Messages adapter selector, Bounded OpenCode public session and fingerprint headers, Connectable OpenCode public registry descriptor, Persisted provider proxy strategy migration 0017, SP18 OpenCode Free keyless provider routing (+3 more)

### Community 30 - "Claude and Codex OAuth adapters"
Cohesion: 0.29
Nodes (10): provider.claude-oauth, provider.codex-oauth, translator.claude-oauth-cloaking, API_UI_MAP row SP16b, adapters/claude-code.ts (prepareClaudeRequest, billing header, user id, _ide + decoys), adapters/codex.ts (CodexExecutor body, compact URL, model list), SP16b user decisions (claude + codex now, full cloaking, keep 9router bugs), 02-providers-auth.yaml (+2 more)

### Community 31 - "Setup, passwords and local access"
Cohesion: 0.33
Nodes (10): UI error code: ALREADY_SET_UP (409), UI error code: NOT_LOCAL (403), useSetup (features/settings/api.ts), POST /api/auth/setup, /welcome → Onboarding (one step), AIGATE_INITIAL_PASSWORD (first password at boot), Decision 2 (user, 2026-09-25): first password set from the local machine; no default password, Decision (user, 2026-09-25, option A): on shared machines rely on AIGATE_INITIAL_PASSWORD (+2 more)

### Community 32 - "Foundation constraints and SQLite design"
Cohesion: 0.24
Nodes (10): Split: machines block mechanics, skills teach judgement, Iron law: no skill without a failing test first (RED → GREEN → REFACTOR), UI performance constraints, Milestone M0 · Foundation, Decision (user, 2026-09-25): route all four SQLite clients through one locked sqlite-proxy wrapper, Locked sqlite-proxy wrapper (AsyncLocalStorage, BEGIN/COMMIT around batch), Skill: writing-lean-bounded-code, SP0 — 2 skills + mechanical lint suite (+2 more)

### Community 33 - "Dashboard login and error states"
Cohesion: 0.42
Nodes (9): identity.password-login-lockout, UI error code: INVALID_CREDENTIALS (401), UI error code: INVALID_REQUEST (400), UI error code: RATE_LIMITED (429), UI error code: SETUP_REQUIRED (409), useLogin (features/settings/api.ts), POST /api/auth/login, /login → Login (+1 more)

### Community 34 - "Domain model and implementation rules"
Cohesion: 0.25
Nodes (9): Durable account and model lock storage, Definition of Done — 13 items, not self-awarded, AIGate domain model (Provider, Credential, RoutingPolicy, AccountLock, …), IMPLEMENTATION_ACCIDENT — debt not inherited from 9router, Mandatory 6-phase feature process (A Discovery → F Parity), AccountLock entity, Pre-response account fallback in chat lane, Bounded priority and sticky round-robin selection (+1 more)

### Community 35 - "Catalog schema and registry validation"
Cohesion: 0.32
Nodes (8): ListedModel { id, descriptor? } — getModels never invents limits (≤1000 ids), CATALOG — providers.generated.ts (121 providers, 935 models; never hand-edited), CatalogProvider / CatalogModel / validateCatalog (packages/engine/src/catalog/schema.ts), defineRegistry() / builtinRegistry (single openai entry, 4 chat models), tools/extract verify (deleted in SP13b with the tool), Rule: model ids unique per (kind, id) — Gemini 2.5 serves both chat and stt, Rule: limits only when declared; 9router's floor 200000/64000 becomes null (sentinel probe), 46 SP13 candidates: openai-compatible, API key, standard chat URL, not hidden

### Community 36 - "Project map and UI integration rules"
Cohesion: 0.36
Nodes (8): docs/PROJECT_MAP.md (generated U-project ownership map), Rule: an API is done only when its UI screen is wired in the same SP, Decision: CLAUDE.md requires wiring the screen in the same SP as its API, Decision (user): build the Stitch UI before connecting application logic, UI ownership handoff (docs/design/UI_HANDOFF.md), Claude's integration boundary (keep shell/screens markup, add feature api.ts hooks), UI_READY — visual layout implemented with demo data only, ?uiState=loading|empty|error preview parameter

### Community 37 - "Streaming transport and cancellation"
Cohesion: 0.29
Nodes (7): routing.client-disconnect-propagation, transport.proxy-priority-chain, One ExecCtx signal: client disconnect + 600 s budget (TIMEOUT) + idle watchdog, ExecCtx (one shared client-cancel + deadline signal), Failure: caller ctx.signal aborts (client left, budget spent), HttpRequest (requires timeoutMs), Rule: every call states timeoutMs (1 to 600000 ms), bounding headers and body inside ctx.signal

### Community 38 - "Antigravity OAuth provider family"
Cohesion: 0.53
Nodes (6): provider.antigravity-oauth, AntigravityAdapter - daily Cloud Code envelope, Gemini/Claude/image requests, Antigravity Google OAuth, userinfo, loadCodeAssist and onboarding, API_UI_MAP SP16c2 row - generic OAuth Connections UI, SP16c2 tests - Antigravity engine and server lanes, SP16c2 - OAuth antigravity (67 connectable)

### Community 39 - "SP16d OAuth provider family"
Cohesion: 0.53
Nodes (6): SP16d provider OAuth matrix entries, OAuth provider data and API-key routing storage, Grok Responses, Kimi Messages and iFlow signed OpenAI adapters, Grok device code, Kimi device flow, CodeBuddy state polling and iFlow auth code, SP16d engine/server tests and generic Connections UI, SP16d - OAuth grok-cli, kimi, CodeBuddy and iFlow (69 connectable)

### Community 40 - "Partial stream failure handling"
Cohesion: 0.53
Nodes (6): fallback.partial-stream-failure, Truncated stream or error event → PROVIDER_UNAVAILABLE with details.partial, Stream headers only after the first chunk: earlier failures are real JSON statuses, Golden scenario: partial stream failure, OpenAIChatStreamEncoder — StreamChunk → OpenAI SSE; fail() = error event, no [DONE], Usage chunk after the finish chunk, only with stream_options.include_usage

### Community 41 - "Trae OAuth and SOLO provider family"
Cohesion: 0.33
Nodes (6): M2 Trae OAuth and SOLO provider family, Trae SOLO chat session and SSE adapter, Trae loopback OAuth and token import contract, Trae dynamic loopback OAuth proxy and token exchange, Trae SOLO session and EventStream contract, Trae browser sign-in and callback/token import UI

### Community 42 - "Cursor ConnectRPC transport"
Cohesion: 0.40
Nodes (5): Cursor ConnectRPC and AgentService adapter, Cursor auto-detect and manual import dialog, Cursor local token import and no-refresh contract, Bounded server-owned HTTP/2 transport, M2 Cursor IDE token import and HTTP/2 provider

### Community 43 - "Hosted relay deployment"
Cohesion: 0.40
Nodes (5): Hosted relay deploy API contract, Authenticated Vercel, Cloudflare, and Deno deploy endpoints, Platform-specific hosted relay deploy wizard, Provider deployment, bounded polling, and cleanup, SP18 hosted relay deploy (Vercel, Cloudflare, Deno)

### Community 44 - "Kiro OAuth and EventStream provider"
Cohesion: 0.40
Nodes (5): Kiro AWS EventStream and Q model adapter, Kiro device, social, token, CLIProxy, and API-key sign-in UI, Kiro OAuth, local imports, and refresh contract, Kiro OAuth and local credential import routes, M2 Kiro OAuth and provider family

### Community 45 - "Error-code mapping and fallback policy"
Cohesion: 0.67
Nodes (4): Status → ErrorCode by status + error.code/type only (never message text), FALLBACK_POLICY (8 error codes as data), Rule: safe upstream codes (context_length_exceeded) reach the client, toOpenAIError() — ErrorCode → OpenAI status/type/code; internals never leak

### Community 46 - "Code quality rules"
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
- **42 isolated node(s):** `ErrorCode: INTERNAL_ERROR`, `03-accounts-multiaccount.yaml`, `05-request-routing-fallback.yaml`, `07-token-saver.yaml`, `09-media-providers.yaml` (+37 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

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
- **Why does `Bounded context: routing (core)` connect `Application architecture and provider flows` to `Dashboard screens and API routes`, `Provider connection and protocol adapters`, `Discovery artifacts and architecture specification`, `Settings and runtime configuration`, `API key lifecycle and UI`, `Gateway routing and model resolution`, `Fallback policy and OpenAI adapter`, `Live catalog models and custom model import`, `Request translation and OpenAI messages`, `Golden scenarios and parity verification`, `Anthropic client protocol lane`, `Milestones, API/UI map and handoff`?**
  _High betweenness centrality (0.113) - this node is a cross-community bridge._
- **Why does `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` connect `Fallback policy and OpenAI adapter` to `Dashboard screens and API routes`, `Application architecture and provider flows`, `Provider connection and protocol adapters`, `Catalog schema and registry validation`, `Provider connections and account management`, `Custom providers and stream routing`, `Gemini and Responses client protocols`, `Partial stream failure handling`, `Gateway routing and model resolution`, `Catalog registry and provider headers`, `Error-code mapping and fallback policy`, `Transport failures and bounded requests`, `Non-streaming routing and OpenAI response mapping`, `Error taxonomy, retries and lint policy`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._