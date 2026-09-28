# Graph Report - docs  (2026-09-28)

## Corpus Check
- 36 files · ~81,348 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 873 nodes · 2196 edges · 33 communities
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 261 edges (avg confidence: 0.87)
- Token cost: 574,916 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Usage, dashboard and integrations|Usage, dashboard and integrations]]
- [[_COMMUNITY_OAuth sign-in and provider flows|OAuth sign-in and provider flows]]
- [[_COMMUNITY_Catalog connections and model listing|Catalog connections and model listing]]
- [[_COMMUNITY_Architecture and discovery rules|Architecture and discovery rules]]
- [[_COMMUNITY_Gemini and client protocols|Gemini and client protocols]]
- [[_COMMUNITY_Discovery outputs and coverage|Discovery outputs and coverage]]
- [[_COMMUNITY_Tracing protocol and bounded contexts|Tracing protocol and bounded contexts]]
- [[_COMMUNITY_API keys and identity|API keys and identity]]
- [[_COMMUNITY_Settings and environment|Settings and environment]]
- [[_COMMUNITY_Routing core and dashboard|Routing core and dashboard]]
- [[_COMMUNITY_Endpoint routing and transport|Endpoint routing and transport]]
- [[_COMMUNITY_Identity settings and auth screens|Identity settings and auth screens]]
- [[_COMMUNITY_Catalog capabilities|Catalog capabilities]]
- [[_COMMUNITY_Parity harness|Parity harness]]
- [[_COMMUNITY_Model resolution and fallback|Model resolution and fallback]]
- [[_COMMUNITY_API key lifecycle|API key lifecycle]]
- [[_COMMUNITY_Translation pivot and cache control|Translation pivot and cache control]]
- [[_COMMUNITY_Anthropic provider adapter|Anthropic provider adapter]]
- [[_COMMUNITY_Architecture domain model|Architecture domain model]]
- [[_COMMUNITY_Anthropic-compatible and stream-only providers|Anthropic-compatible and stream-only providers]]
- [[_COMMUNITY_Provider credentials and headers|Provider credentials and headers]]
- [[_COMMUNITY_Vertex adapters|Vertex adapters]]
- [[_COMMUNITY_OpenAI-compatible adapter and streaming|OpenAI-compatible adapter and streaming]]
- [[_COMMUNITY_Error taxonomy and capabilities|Error taxonomy and capabilities]]
- [[_COMMUNITY_Parity scenarios|Parity scenarios]]
- [[_COMMUNITY_Custom provider nodes and options|Custom provider nodes and options]]
- [[_COMMUNITY_Transport retry budget|Transport retry budget]]
- [[_COMMUNITY_Catalog registry extraction|Catalog registry extraction]]
- [[_COMMUNITY_Anthropic client lane|Anthropic client lane]]
- [[_COMMUNITY_Feature process and contract tests|Feature process and contract tests]]
- [[_COMMUNITY_Gemini adapter|Gemini adapter]]
- [[_COMMUNITY_UI error handling|UI error handling]]
- [[_COMMUNITY_Governance and implementation rules|Governance and implementation rules]]

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
- `Bounded server-owned HTTP/2 transport` --extends--> `Transport contract (M1 SP8)`  [EXTRACTED]
  apps/server/src/modules/transport/infrastructure/direct-transport.ts → docs/contracts/transport.md
- `Framework-free thinking suffix parser and override` --feeds--> `Model resolution: provider/model (any id) or a bare catalog id; 404 model_not_found / no_active_connection`  [EXTRACTED]
  packages/engine/src/thinking.ts → docs/contracts/chat-lane.md
- `Provider Models Use as, Copy and Test suffix` --implements--> `model(level) suffix contract and unknown suffix caveat`  [EXTRACTED]
  apps/web/src/features/providers/model-rules.ts → docs/contracts/provider-thinking.md
- `Framework-free thinking suffix parser and override` --implements--> `model(level) suffix contract and unknown suffix caveat`  [EXTRACTED]
  packages/engine/src/thinking.ts → docs/contracts/provider-thinking.md
- `Cursor ConnectRPC and AgentService adapter` --implements--> `Cursor local token import and no-refresh contract`  [EXTRACTED]
  packages/engine/src/adapters/cursor.ts → docs/contracts/oauth.md

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

## Communities (33 total, 0 thin omitted)

### Community 0 - "Usage, dashboard and integrations"
Cohesion: 0.06
Nodes (89): usage.write-not-synchronous, GET /overview/summary, SSE /events/requests, /traffic/console → Console (Developer mode only), /network/* → ProxyPools, DeployWizard, Tunnel, Mitm, / → Overview, /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver, /traffic/usage, /traffic/requests* → Usage, Requests, RequestDetail (+81 more)

### Community 1 - "OAuth sign-in and provider flows"
Cohesion: 0.06
Nodes (87): settings.combo-rotation-reset, validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, /integrations/* → CliTools, CliToolDetail, Skills, Mcp, /providers/media* → MediaProviders, /providers/quota → Quota; custom provider form; multi-account, docs/discovery/gaps.md (Gap register), §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra), §9 Build an explicit domain model (Provider, Quota, RoutingPolicy…) (+79 more)

### Community 2 - "Catalog connections and model listing"
Cohesion: 0.06
Nodes (66): oauth.dashboard-flow, oauth.refresh-lifecycle, oauth.token-storage, provider.antigravity-oauth, provider.claude-oauth, provider.cline-oauth, provider.codex-oauth, provider.github-copilot-oauth (+58 more)

### Community 3 - "Architecture and discovery rules"
Cohesion: 0.06
Nodes (59): docs/capabilities.md (GENERATED capability specification), docs/discovery/coverage.md, docs/discovery/inventory.json, §30 The 12 pre-implementation questions, §3 The 20 behavioral questions (trigger…edge cases), §8 Business rule beats old implementation, §2 Core principles — never port, rename, or translate 9router line by line, §29 Definition of Done — 13 checklist items, no self-declared DONE (+51 more)

### Community 4 - "Gemini and client protocols"
Cohesion: 0.05
Nodes (58): catalog.connection-detail-crud, catalog.connection-listing, catalog.provider-models-live-fetch, connection.azure-openai-deployment, connection.client-listing-sanitized, connection.cloudflare-account-id, connection.test-single-connection, provider.clinepass-headers-envelope (+50 more)

### Community 5 - "Discovery outputs and coverage"
Cohesion: 0.06
Nodes (54): Status → ErrorCode by status + error.code/type only (never message text), API_UI_MAP row: SP8 transport, No UI, 9router as Behavioral Source of Truth (not a template to port), Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Definition of Done — 13 items, not self-awarded, AIGate domain model (Provider, Credential, RoutingPolicy, AccountLock, …), Error taxonomy (8 ErrorCodes) (+46 more)

### Community 6 - "Tracing protocol and bounded contexts"
Cohesion: 0.07
Nodes (49): connection.commandcode-key-test, connection.ollama-local-host, connection.vertex-credential-test, provider.qoder-agent-transport (traced, not ported), provider.vertex-google-auth, routing.vertex-endpoints, translator.commandcode-to-openai-response, translator.gemini-to-openai-response (+41 more)

### Community 7 - "API keys and identity"
Cohesion: 0.07
Nodes (47): catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.compatible-models-import-ui, catalog.custom-models-orphan-on-node-delete, catalog.model-registry-global, fallback.executor-retry-budget, combo.detect-required-capabilities (+39 more)

### Community 8 - "Settings and environment"
Cohesion: 0.13
Nodes (33): apikey.delete-key, apikey.generate-key, apikey.legacy-format-unenforced, apikey.list-keys, apikey.update-key-status, apikey.validate-lookup, endpoint.enforce-require-api-key, identity.reset-password-local-only (+25 more)

### Community 9 - "Routing core and dashboard"
Cohesion: 0.12
Nodes (27): connection.provider-node-api-type, connection.provider-node-create-list, connection.provider-node-repo-storage, connection.provider-node-update-delete, connection.provider-node-validate-partial-ssrf (stays traced: no validate route), DELETE /api/provider-nodes/:id (cascades the connection), GET /api/provider-nodes, PATCH /api/provider-nodes/:id (+19 more)

### Community 10 - "Endpoint routing and transport"
Cohesion: 0.11
Nodes (25): catalog.v1beta-generate-content-dispatch, catalog.v1beta-models-listing, routing.responses-compact-lane, translator.gemini-client-request, translator.openai-to-gemini-client-response, translator.openai-to-responses-client-response, translator.responses-client-request, API_UI_MAP row: SP14c Responses adapter (no new screen for perplexity-agent) and the API select on /providers/new (+17 more)

### Community 11 - "Identity settings and auth screens"
Cohesion: 0.16
Nodes (22): settings.database-export-import, settings.defaults-and-merge, settings.get-secret-stripping, settings.hot-path-read-no-cache, settings.outbound-proxy-live-apply, settings.patch-protected-keys, settings.proxy-test-outbound-probe, settings.require-login-public-status (+14 more)

### Community 12 - "Catalog capabilities"
Cohesion: 0.14
Nodes (21): routing.forced-stream-json-collapse, routing.responses-non-stream-answer, provider.codebuddy-request-quirks, translator.openai-to-responses-request, translator.responses-to-openai-stream, API_UI_MAP row: SP14b stream-only providers (no new screen) and the protocol select on /providers/new, builtinRegistry built from CATALOG (41 connectable providers), Catalog providers contract (M2 SP13) (+13 more)

### Community 13 - "Parity harness"
Cohesion: 0.14
Nodes (21): GET /health, API_UI_MAP row: M0 SP3 parity harness, No UI, API_UI_MAP row: M0 SP4 tools/extract + CATALOG, No UI yet (SP13 serves /providers), Split: machines block mechanics, skills teach judgement, Open decisions not settled by this spec, Iron law: no skill without a failing test first (RED → GREEN → REFACTOR), UI performance constraints, Milestone M0 · Foundation (+13 more)

### Community 14 - "Model resolution and fallback"
Cohesion: 0.14
Nodes (20): catalog.model-listing-live-override, fallback.accounts-exhausted-response, routing.client-disconnect-propagation, routing.lane-entry-routes, routing.model-resolution, routing.request-preflight, routing.streaming-pipeline, §18 Streaming is first-class (TTFT, cancellation, backpressure) (+12 more)

### Community 15 - "API key lifecycle"
Cohesion: 0.27
Nodes (18): identity.machine-id-derivation, /settings/auth OIDC and SAML tabs, /settings/general → SettingsGeneral, Audit finding: settings-auth regenerated as settings-auth-v2, Audit finding: login-callback / deploy-wizard / authflow-modals are showcases, not routes, Audit FAIL: sidebar not identical across screens, Bounded context: identity, Bounded context: settings (+10 more)

### Community 16 - "Translation pivot and cache control"
Cohesion: 0.24
Nodes (17): identity.password-login-lockout, identity.session-cookie-lifecycle, UI error code: INVALID_CREDENTIALS (401), UI error code: INVALID_REQUEST (400), UI error code: RATE_LIMITED (429), UI error code: SETUP_REQUIRED (409), useChangePassword (features/settings/api.ts), useLogin (features/settings/api.ts) (+9 more)

### Community 17 - "Anthropic provider adapter"
Cohesion: 0.16
Nodes (15): fallback.error-classification, fallback.upstream-error-result, routing.default-executor-openai-fallback, routing.non-streaming-response, routing.stream-mode-decision, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O, Finding: 9router 0.5.55 errors carry only { message } with its node id and the raw upstream body (+7 more)

### Community 18 - "Architecture domain model"
Cohesion: 0.18
Nodes (15): docs/PROJECT_MAP.md (generated U-project ownership map), Rule: an API is done only when its UI screen is wired in the same SP, Feature-based frontend structure with import boundaries, Hexagonal architecture, granularity = bounded context, Monorepo layout (apps/server, apps/web, apps/cli, packages/engine, contracts, database, tools), AIGate Design Spec (2026-09-22), Decision 1 (user, 2026-09-25): API keys are random and stored as a hash, Decision 3 (user, 2026-09-25): sessions stored in the database, not a JWT (+7 more)

### Community 19 - "Anthropic-compatible and stream-only providers"
Cohesion: 0.23
Nodes (14): connection.anthropic-compatible-node, provider.anthropic-auth-and-headers, translator.claude-to-openai-response, translator.openai-to-claude-request, AnthropicAdapter — CIP <-> Messages (max_tokens rules, thinking budgets, tool_use, SSE events), packages/engine/test/anthropic-adapter.test.mjs (10) + apps/server/test/anthropic-lane.test.mjs (4); 23 mutations caught, Deviations not ported: stop/top_p kept, none stays none, no Claude Code line, stream errors fail, same stop/usage mapping, 403 invalid, Claude Code anthropic-beta list for claude-* models on an Anthropic node (claude-code flag only on the official host) (+6 more)

### Community 20 - "Provider credentials and headers"
Cohesion: 0.24
Nodes (13): routing.request-translation, routing.source-format-detection, translator.openai-cache-control-filter, translator.pivot-loss, translator.tool-id-normalization, OpenAI Chat cache_control on messages and text parts (CanonicalMessage.cacheControl), toOpenAIChatCompletion() — CanonicalResponse → chat.completion JSON, OpenAI Chat Completions protocol adapter contract (M1 SP10) (+5 more)

### Community 21 - "Vertex adapters"
Cohesion: 0.21
Nodes (13): Adapter: catalog headers first, key last; raw or Bearer scheme; chatUrl/modelsUrl called directly, GET /api/providers/:id (chatUrl + models; 404 NOT_FOUND), GET /api/providers (all 121, connectable + reason), API_UI_MAP row: SP14a AnthropicAdapter — no new screen; /providers pills follow connectable, /providers → LlmProviders (catalog from GET /api/providers; Connected / Coming later pills), apps/server/test/catalog.test.mjs (catalog API) + chat-lane resolution tests, CatalogController — GET /api/providers, GET /api/providers/:id, /v1 resolution: provider-or-alias/model; non-connectable prefix → provider_not_supported; bare id → first declaring provider with an active connection (+5 more)

### Community 22 - "OpenAI-compatible adapter and streaming"
Cohesion: 0.23
Nodes (12): endpoint.rewrite-lanes, routing.count-tokens-estimate, translator.claude-client-request, translator.openai-to-claude-client-response, protocols/anthropic-messages.ts — parse to CIP, anthropicRequestFor (passthrough for Anthropic, claude→openai rules otherwise), message, SSE encoder, count_tokens, API_UI_MAP row: SP15 Anthropic Messages client protocol, Chat lane client protocol object (parse, prepare, respond, encoder) shared by /v1/chat/completions and /v1/messages, User decision 2026-09-27: SP15 Anthropic first; OpenAI-shaped errors and 9router non-stream/stream-default kept; real usage, live tool args, signature_delta corrected (+4 more)

### Community 23 - "Error taxonomy and capabilities"
Cohesion: 0.21
Nodes (12): catalog.registry-build, catalog.registry-entry-shape, ListedModel { id, descriptor? } — getModels never invents limits (≤1000 ids), CATALOG — providers.generated.ts (121 providers, 935 models; never hand-edited), CatalogProvider / CatalogModel / validateCatalog (packages/engine/src/catalog/schema.ts), Registry extraction contract (M0 SP4), tools/extract (deleted in SP13b; restorable from git d2783c1) — wrote the catalog from 9router, tools/extract verify (deleted in SP13b with the tool) (+4 more)

### Community 24 - "Parity scenarios"
Cohesion: 0.24
Nodes (11): OpenAICompatibleAdapter (AIProviderPort for openai-compatible), packages/engine/test/openai-adapter.test.mjs (15 tests, fake transport, SSE split every 3 bytes; 16 mutations caught), Refused before I/O: video, media by URL, assistant thinking, tool_result.isError, budgetTokens, foreign vendorExtensions, TokenUsage normalized: inputTokens excludes cache reads, outputTokens includes reasoning, Canonical Internal Protocol (CIP), vendorExtensions — typed carry-through field, src/json.ts — shared JSON narrowing (isRecord, record, text, list, parseJson), UnsupportedFeatureError (+3 more)

### Community 25 - "Custom provider nodes and options"
Cohesion: 0.33
Nodes (10): UI error code: ALREADY_SET_UP (409), UI error code: NOT_LOCAL (403), useSetup (features/settings/api.ts), POST /api/auth/setup, /welcome → Onboarding (one step), AIGATE_INITIAL_PASSWORD (first password at boot), Decision 2 (user, 2026-09-25): first password set from the local machine; no default password, Decision (user, 2026-09-25, option A): on shared machines rely on AIGATE_INITIAL_PASSWORD (+2 more)

### Community 26 - "Transport retry budget"
Cohesion: 0.33
Nodes (10): UI error code: BAD_RESPONSE, UI error code: HTTP_5xx, UI error code: LIMIT_REACHED (409), UI error code: NETWORK_ERROR, UI error code: any other code (fallback), UI error code: TIMEOUT, shared/errors.test.mjs, shared/api.ts — same-origin JSON client, ApiError with stable code, 10 s timeout (+2 more)

### Community 27 - "Catalog registry extraction"
Cohesion: 0.33
Nodes (9): endpoint.extract-header-order, API_UI_MAP row: SP10 OpenAI Chat protocol, No UI, API_UI_MAP row: SP9 OpenAICompatibleAdapter, No UI, /gateway/endpoint readiness pill (Ready / Connect a provider / Check connection) + curl test, POST /v1/chat/completions + GET /v1/models (/v1 Chat API), extractApiKey() (Authorization: Bearer first, then x-api-key), Milestone M1 · Walking skeleton (thin end-to-end slice), SP12 — routing: chat lane + Fastify raw streaming, backpressure, cancellation (+1 more)

### Community 28 - "Anthropic client lane"
Cohesion: 0.29
Nodes (7): Custom provider thinking level, Provider Models Use as, Copy and Test suffix, model(level) suffix contract and unknown suffix caveat, Provider thinking defaults and model effort levels, provider_thinking table - built-in provider default level, M2 provider thinking part 2 - model-level suffixes, Framework-free thinking suffix parser and override

### Community 29 - "Feature process and contract tests"
Cohesion: 0.53
Nodes (6): fallback.partial-stream-failure, Truncated stream or error event → PROVIDER_UNAVAILABLE with details.partial, Stream headers only after the first chunk: earlier failures are real JSON statuses, Golden scenario: partial stream failure, OpenAIChatStreamEncoder — StreamChunk → OpenAI SSE; fail() = error event, no [DONE], Usage chunk after the finish chunk, only with stream_options.include_usage

### Community 30 - "Gemini adapter"
Cohesion: 0.40
Nodes (5): features/providers/node-rules.ts unreachable(): OpenAI-compatible prefixes win, then the oldest, apps/server/test/provider-nodes.test.mjs (5 tests; 15 mutations caught), CustomProviderDetail page, /providers → Custom providers section (features/providers/custom.tsx): Connect, Edit, Delete, SP14b tests: engine adapter tests (8 new), server provider-nodes (2) + stream-only.test.mjs (3), web node-rules.test.mjs; 34 mutations caught

### Community 31 - "UI error handling"
Cohesion: 0.67
Nodes (4): identity.auth-status-disclosure, GET /api/auth/status, useAuthStatus (features/settings/api.ts), Shell gate (app/shell.tsx) — redirects to /welcome or /login

### Community 32 - "Governance and implementation rules"
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
- **32 isolated node(s):** `ErrorCode: INTERNAL_ERROR`, `03-accounts-multiaccount.yaml`, `05-request-routing-fallback.yaml`, `07-token-saver.yaml`, `09-media-providers.yaml` (+27 more)
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
- **Why does `Bounded context: routing (core)` connect `OAuth sign-in and provider flows` to `Usage, dashboard and integrations`, `Architecture and discovery rules`, `Gemini and client protocols`, `Discovery outputs and coverage`, `Tracing protocol and bounded contexts`, `API keys and identity`, `Settings and environment`, `Provider credentials and headers`, `OpenAI-compatible adapter and streaming`, `Parity scenarios`, `Catalog registry extraction`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Why does `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` connect `Parity scenarios` to `Usage, dashboard and integrations`, `OAuth sign-in and provider flows`, `Gemini and client protocols`, `Discovery outputs and coverage`, `Tracing protocol and bounded contexts`, `API keys and identity`, `Routing core and dashboard`, `Catalog capabilities`, `Model resolution and fallback`, `Anthropic provider adapter`, `Anthropic-compatible and stream-only providers`, `Vertex adapters`, `Error taxonomy and capabilities`, `Feature process and contract tests`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._