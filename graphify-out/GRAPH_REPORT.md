# Graph Report - docs  (2026-09-28)

## Corpus Check
- 35 files · ~79,108 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 858 nodes · 2174 edges · 50 communities
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
- [[_COMMUNITY_OpenAI client response lane|OpenAI client response lane]]
- [[_COMMUNITY_Anthropic request translation|Anthropic request translation]]
- [[_COMMUNITY_Provider node API|Provider node API]]
- [[_COMMUNITY_Command Code adapter|Command Code adapter]]
- [[_COMMUNITY_Onboarding setup|Onboarding setup]]
- [[_COMMUNITY_Discovery evidence and media|Discovery evidence and media]]
- [[_COMMUNITY_Password login|Password login]]
- [[_COMMUNITY_Settings auth hooks|Settings auth hooks]]
- [[_COMMUNITY_Ollama adapter|Ollama adapter]]
- [[_COMMUNITY_Custom provider storage|Custom provider storage]]
- [[_COMMUNITY_Ollama translation|Ollama translation]]
- [[_COMMUNITY_Performance and bounded workload rules|Performance and bounded workload rules]]
- [[_COMMUNITY_Partial stream failure|Partial stream failure]]
- [[_COMMUNITY_Lint suite|Lint suite]]
- [[_COMMUNITY_Transport contract|Transport contract]]
- [[_COMMUNITY_Fallback error classification|Fallback error classification]]
- [[_COMMUNITY_Code quality rules|Code quality rules]]

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
- **OpenAI Responses family: adapter, non-stream read, 9router stream, apiType custom providers** — openai_responses_adapter, responses_non_stream_read, responses_stream_9router, provider_nodes_api_type_column, create_adapter [EXTRACTED 1.00]
- **Ollama family: adapter, NDJSON reader, per-connection host and optional key, connections UI** — ollama_adapter, read_json_lines, connection_base_url, screen_connections_ollama_host, create_adapter [EXTRACTED 1.00]
- **Gemini family: adapter, schema cleaner, signature cache, CIP image chunk and finish override** — gemini_adapter, gemini_schema_cleaner, gemini_signature_cache, cip_image_delta_finish_override, create_adapter [EXTRACTED 1.00]
- **Vertex family: Google Cloud auth, Vertex and partner adapters, JSON credential connections and field** — google_auth, vertex_adapter, vertex_partner_adapter, json_credential_connections, screen_connections_google_key [EXTRACTED 1.00]
- **Per-connection data: descriptor fields, withConnection, chat probe, migration 0008, connection fields UI** — connection_fields_descriptor, chat_probe_test, connection_data_columns, screen_connections_fields, clinepass_envelope_headers [EXTRACTED 1.00]

## Communities (50 total, 0 thin omitted)

### Community 0 - "Usage, dashboard and integrations"
Cohesion: 0.05
Nodes (105): usage.write-not-synchronous, GET /overview/summary, SSE /events/requests, validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, /traffic/console → Console (Developer mode only), /integrations/* → CliTools, CliToolDetail, Skills, Mcp, /providers/media* → MediaProviders, /network/* → ProxyPools, DeployWizard, Tunnel, Mitm (+97 more)

### Community 1 - "OAuth sign-in and provider flows"
Cohesion: 0.07
Nodes (54): oauth.dashboard-flow, oauth.refresh-lifecycle, oauth.token-storage, provider.antigravity-oauth, provider.claude-oauth, provider.cline-oauth, provider.codex-oauth, provider.github-copilot-oauth (+46 more)

### Community 2 - "Catalog connections and model listing"
Cohesion: 0.07
Nodes (44): catalog.connection-detail-crud, catalog.connection-listing, catalog.provider-models-live-fetch, connection.client-listing-sanitized, connection.test-single-connection, connection.create-dedup-and-priority-assignment, connection.delete-and-reorder, connection.storage-shape-json-blob (+36 more)

### Community 3 - "Architecture and discovery rules"
Cohesion: 0.08
Nodes (38): GET /health, docs/PROJECT_MAP.md (generated U-project ownership map), API_UI_MAP row: M0 SP4 tools/extract + CATALOG, No UI yet (SP13 serves /providers), Rule: an API is done only when its UI screen is wired in the same SP, 9router as Behavioral Source of Truth (not a template to port), Definition of Done — 13 items, not self-awarded, Feature-based frontend structure with import boundaries, Hexagonal architecture, granularity = bounded context (+30 more)

### Community 4 - "Gemini and client protocols"
Cohesion: 0.09
Nodes (31): catalog.v1beta-generate-content-dispatch, catalog.v1beta-models-listing, routing.responses-non-stream-answer, translator.gemini-client-request, translator.openai-to-gemini-client-response, translator.openai-to-responses-client-response, translator.openai-to-responses-request, translator.responses-client-request (+23 more)

### Community 5 - "Discovery outputs and coverage"
Cohesion: 0.13
Nodes (31): docs/capabilities.md (GENERATED capability specification), docs/discovery/coverage.md, docs/discovery/gaps.md (Gap register), docs/discovery/inventory.json, §2 Core principles — never port, rename, or translate 9router line by line, §14 Feature parity is not code parity, Final principle — 9router says WHAT, never HOW, §1 Goal — build a NEW AI gateway, 9router is reference only (+23 more)

### Community 6 - "Tracing protocol and bounded contexts"
Cohesion: 0.16
Nodes (23): §5 Feature discovery — inventory every group, do not trust the UI menu, §6 Feature Matrix requirement — nothing is understood until fully traced, §20 No blind fallback — fallback follows error semantics, §13 Translator/protocol separation — canonical vs vendor formats, The 23 feature groups required by behavioral.md §5, Canonical Internal Protocol, Feature Matrix — mandatory 17-column artifact, Bounded context: catalog (+15 more)

### Community 7 - "API keys and identity"
Cohesion: 0.16
Nodes (22): apikey.generate-key, apikey.legacy-format-unenforced, apikey.list-keys, apikey.validate-lookup, endpoint.enforce-require-api-key, identity.reset-password-local-only, identity.session-cookie-lifecycle, settings.patch-password-change (+14 more)

### Community 8 - "Settings and environment"
Cohesion: 0.16
Nodes (21): settings.combo-rotation-reset, settings.database-export-import, settings.defaults-and-merge, settings.get-secret-stripping, settings.hot-path-read-no-cache, settings.outbound-proxy-live-apply, settings.patch-protected-keys, settings.proxy-test-outbound-probe (+13 more)

### Community 9 - "Routing core and dashboard"
Cohesion: 0.21
Nodes (21): /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver, §12 Router is its own business engine, not controller logic, Routing simulator (decision-tree dry run), Bounded context: routing (core), Metric card component, GAP: Token Saver screen missing from the U0–U11 table, Feature group: Auto fallback, Feature group: Combo / Vision Adapter (+13 more)

### Community 10 - "Endpoint routing and transport"
Cohesion: 0.13
Nodes (20): endpoint.extract-header-order, routing.client-disconnect-propagation, transport.proxy-priority-chain, API_UI_MAP row: SP10 OpenAI Chat protocol, No UI, API_UI_MAP row: SP9 OpenAICompatibleAdapter, No UI, /gateway/endpoint readiness pill (Ready / Connect a provider / Check connection) + curl test, POST /v1/chat/completions + GET /v1/models (/v1 Chat API), §18 Streaming is first-class (TTFT, cancellation, backpressure) (+12 more)

### Community 11 - "Identity settings and auth screens"
Cohesion: 0.24
Nodes (20): identity.machine-id-derivation, /settings/auth OIDC and SAML tabs, /settings/general → SettingsGeneral, Audit finding: settings-auth regenerated as settings-auth-v2, Audit finding: login-callback / deploy-wizard / authflow-modals are showcases, not routes, Audit FAIL: sidebar not identical across screens, Bounded context: apikeys, Bounded context: identity (+12 more)

### Community 12 - "Catalog capabilities"
Cohesion: 0.20
Nodes (18): catalog.capability-refine-additive-only, catalog.capability-vision-pattern-order, catalog.compatible-models-import-ui, catalog.custom-models-orphan-on-node-delete, catalog.model-registry-global, combo.detect-required-capabilities, API_UI_MAP row: SP7 packages/engine, No UI, Rule: an SP with no HTTP API records "No UI" in its row (+10 more)

### Community 13 - "Parity harness"
Cohesion: 0.16
Nodes (18): API_UI_MAP row: M0 SP3 parity harness, No UI, Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Stated limits of tape-based parity, Recording proxy + 4-part tape, Normalizer + semantic SSE diff (not chunk diff), pnpm parity record | replay | live | gate, Parity harness contract (M0 SP3) and the M1 acceptance gate (+10 more)

### Community 14 - "Model resolution and fallback"
Cohesion: 0.16
Nodes (17): endpoint.rewrite-lanes, catalog.model-listing-live-override, fallback.accounts-exhausted-response, routing.lane-entry-routes, routing.model-resolution, routing.request-preflight, routing.responses-compact-lane, Chat lane contract (M1 SP12) (+9 more)

### Community 15 - "API key lifecycle"
Cohesion: 0.22
Nodes (16): apikey.delete-key, apikey.update-key-status, identity.auth-status-disclosure, DELETE /api/keys/:id, UI error code: NOT_FOUND (404), UI error code: UNAUTHENTICATED (401), GET /api/auth/status, useAuthStatus (features/settings/api.ts) (+8 more)

### Community 16 - "Translation pivot and cache control"
Cohesion: 0.18
Nodes (16): routing.request-translation, routing.source-format-detection, translator.openai-cache-control-filter, translator.pivot-loss, translator.tool-id-normalization, OpenAI Chat cache_control on messages and text parts (CanonicalMessage.cacheControl), src/json.ts — shared JSON narrowing (isRecord, record, text, list, parseJson), 11-translation-i18n.yaml (+8 more)

### Community 17 - "Anthropic provider adapter"
Cohesion: 0.18
Nodes (16): provider.anthropic-auth-and-headers, Adapter: catalog headers first, key last; raw or Bearer scheme; chatUrl/modelsUrl called directly, GET /api/providers (all 121, connectable + reason), API_UI_MAP row: SP14a AnthropicAdapter — no new screen; /providers pills follow connectable, /providers → LlmProviders (catalog from GET /api/providers; Connected / Coming later pills), builtinRegistry built from CATALOG (41 connectable providers), apps/server/test/catalog.test.mjs (catalog API) + chat-lane resolution tests, CatalogController — GET /api/providers, GET /api/providers/:id (+8 more)

### Community 18 - "Architecture domain model"
Cohesion: 0.19
Nodes (16): §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra), §9 Build an explicit domain model (Provider, Quota, RoutingPolicy…), §11 Providers reached only through a port (AIProviderPort), AIGate domain model (Provider, Credential, RoutingPolicy, AccountLock, …), Bounded context: connections, AccountLock entity, Feature group: API-key providers, Feature group: Multi-account (+8 more)

### Community 19 - "Anthropic-compatible and stream-only providers"
Cohesion: 0.16
Nodes (15): connection.anthropic-compatible-node, routing.forced-stream-json-collapse, provider.codebuddy-request-quirks, Claude Code anthropic-beta list for claude-* models on an Anthropic node (claude-code flag only on the official host), Anthropic node connection test: POST <base>/v1/messages, claude-3-haiku, only 401/403 invalid (9router), API_UI_MAP row: SP14b stream-only providers (no new screen) and the protocol select on /providers/new, CodeBuddy quirks: reasoningSummary (cn, intl), neutralAgentPrompt (cn) via EXECUTOR_QUIRKS, User decision 2026-09-26: SP14b keeps 9router on every suspected bug asked (+7 more)

### Community 20 - "Provider credentials and headers"
Cohesion: 0.18
Nodes (15): connection.azure-openai-deployment, connection.cloudflare-account-id, provider.clinepass-headers-envelope, translator.cloudflare-content-flatten, API_UI_MAP row: SP14g per-connection data and ClinePass, Descriptor chatProbe: connection test by a one-token chat (azure 401/403, cloudflare 401/403/404, clinepass 401/403), ClinePass: Cline headers naming AIGate, non-stream { success, data } unwrapped, provider_connections.deployment, api_version, organization, account_id (migration 0008); POST/PATCH validation per field (+7 more)

### Community 21 - "Vertex adapters"
Cohesion: 0.21
Nodes (15): connection.vertex-credential-test, provider.qoder-agent-transport (traced, not ported), provider.vertex-google-auth, routing.vertex-endpoints, translator.openai-to-vertex-request, API_UI_MAP row: SP14f Vertex adapters and the JSON credential field, User decision 2026-09-26: SP14f scope vertex only; qoder not ported; correct signatures, tokens, test, location; keep bounded project probe, google-auth.ts — parseGoogleCredential, RS256 JWT via WebCrypto, token cache per credential (1 h, 256), fresh mint after 401 (+7 more)

### Community 22 - "OpenAI-compatible adapter and streaming"
Cohesion: 0.18
Nodes (15): fallback.upstream-error-result, routing.default-executor-openai-fallback, routing.streaming-pipeline, Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O, OpenAICompatibleAdapter (AIProviderPort for openai-compatible), readSseData() — bounded SSE reader (1 Mi chars per line/event, cancels body), packages/engine/test/openai-adapter.test.mjs (15 tests, fake transport, SSE split every 3 bytes; 16 mutations caught), Refused before I/O: video, media by URL, assistant thinking, tool_result.isError, budgetTokens, foreign vendorExtensions (+7 more)

### Community 23 - "Error taxonomy and capabilities"
Cohesion: 0.18
Nodes (14): catalog.capability-tier-fallback, API_UI_MAP row: SP8 transport, No UI, Error taxonomy (8 ErrorCodes), assertModelSupports() — MODEL_UNAVAILABLE / INVALID_REQUEST, ErrorCode: AUTH_ERROR, ErrorCode: INTERNAL_ERROR, ErrorCode: INVALID_REQUEST, ErrorCode: MODEL_UNAVAILABLE (+6 more)

### Community 24 - "Parity scenarios"
Cohesion: 0.25
Nodes (14): Parity verification — 3 tiers, apps/server/test/golden.test.mjs — 13 golden scenarios at M1 scope (3 deferred: SP16, SP17, SP19), Golden scenario: account failover, Golden scenario: all providers unavailable, Golden scenario: invalid credentials, Golden scenario: model unavailable, Golden scenario: normal completion, Golden scenario: provider fallback (+6 more)

### Community 25 - "Custom provider nodes and options"
Cohesion: 0.22
Nodes (13): connection.provider-node-api-type, /v1: <prefix>/<model> reaches a custom provider after built-in ids, aliases, and catalog prefixes, Custom headers - sealed values, hints, validation and merge, Custom provider thinking level, provider-node domain rules — prefix token, base URL normalize (strip /chat/completions), https or loopback http, provider_nodes.api_type (migration 0006): chat | responses; ids openai-compatible-<apiType>-<hex>; changeable, ProviderNodesRepository — list/get/byPrefix, count+insert transaction, cascade delete of the connection; nodeDescriptor(), provider_nodes table (migration 0003: id, name, unique prefix, base_url, timestamps; max 100) (+5 more)

### Community 26 - "Transport retry budget"
Cohesion: 0.19
Nodes (13): fallback.executor-retry-budget, transport.test.mjs: adapter streams end to end over DirectTransport, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, ErrorCode: PROVIDER_UNAVAILABLE, DirectTransport (direct branch implementation), Failure: body larger than maxBytes in readBoundedText, Failure: connection refused, DNS failure, TLS failure, Failure: upstream answers 3xx (redirect not followed) (+5 more)

### Community 27 - "Catalog registry extraction"
Cohesion: 0.21
Nodes (12): catalog.registry-build, catalog.registry-entry-shape, ListedModel { id, descriptor? } — getModels never invents limits (≤1000 ids), CATALOG — providers.generated.ts (121 providers, 935 models; never hand-edited), CatalogProvider / CatalogModel / validateCatalog (packages/engine/src/catalog/schema.ts), Registry extraction contract (M0 SP4), tools/extract (deleted in SP13b; restorable from git d2783c1) — wrote the catalog from 9router, tools/extract verify (deleted in SP13b with the tool) (+4 more)

### Community 28 - "Anthropic client lane"
Cohesion: 0.24
Nodes (12): routing.count-tokens-estimate, translator.claude-client-request, translator.openai-to-claude-client-response, protocols/anthropic-messages.ts — parse to CIP, anthropicRequestFor (passthrough for Anthropic, claude→openai rules otherwise), message, SSE encoder, count_tokens, API_UI_MAP row: SP15 Anthropic Messages client protocol, Canonical Internal Protocol (CIP), vendorExtensions — typed carry-through field, User decision 2026-09-27: SP15 Anthropic first; OpenAI-shaped errors and 9router non-stream/stream-default kept; real usage, live tool args, signature_delta corrected (+4 more)

### Community 29 - "Feature process and contract tests"
Cohesion: 0.24
Nodes (12): §30 The 12 pre-implementation questions, §25 Golden scenarios (13 critical flows), Phase model A→F (Discovery, Behavior Extraction, Contract, Design, Implementation, Parity Verification), §24 Characterization/contract tests prove old ≈ new at contract level, Constraint — no Phase C contracts during discovery, Constraint — no AIGate product code in M-1 (only tools/discovery and docs), Phase A — Discovery, Phase B — Behavior Extraction (+4 more)

### Community 30 - "Gemini adapter"
Cohesion: 0.31
Nodes (11): translator.gemini-to-openai-response, translator.openai-to-gemini-request, API_UI_MAP row: SP14e Gemini adapter (no new screen; Key rejected on a 400), CIP image_delta chunk (delta.images) and vendorExtensions.openai.finish_reason honoured by the OpenAI renderer, User decision 2026-09-26: SP14e keeps 9router's Gemini request drops and answer mapping; only the schema cleaner is corrected, GeminiAdapter — CIP <-> generateContent / streamGenerateContent?alt=sse (x-goog-api-key, safety off, thinking level/budget, 400 key test = invalid), cleanGeminiSchema() — corrected: walks schema positions only, no invented reason parameter, depth 64, Thought-signature cache (in memory, 1 h, 2000, same family) and the borrowed 9router signature on the first call (+3 more)

### Community 31 - "UI error handling"
Cohesion: 0.29
Nodes (11): UI error code: BAD_RESPONSE, UI error code: HTTP_5xx, UI error code: LIMIT_REACHED (409), UI error code: NETWORK_ERROR, UI error code: any other code (fallback), UI error code: TIMEOUT, shared/errors.test.mjs, useApiKeys (features/gateway/api.ts) (+3 more)

### Community 32 - "Governance and implementation rules"
Cohesion: 0.18
Nodes (11): §3 The 20 behavioral questions (trigger…edge cases), §8 Business rule beats old implementation, §29 Definition of Done — 13 checklist items, no self-declared DONE, §19 Fallback as explicit policy with classified errors, §28 Per-feature process: DISCOVER→TRACE→DOCUMENT→…→REVIEW, Feature Matrix entry template (null never "" or "N/A"), Canonical error classification codes (8 values), parityStatus lifecycle (not-started → traced → contracted → implemented → verified) (+3 more)

### Community 33 - "OpenAI client response lane"
Cohesion: 0.24
Nodes (10): routing.non-streaming-response, routing.stream-mode-decision, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), Finding: 9router 0.5.55 errors carry only { message } with its node id and the raw upstream body, Finding: omitted stream on 9router 0.5.55 → JSON body sent as text/event-stream + bare [DONE] (unparsable), Finding: 9router adds 2000 tokens to reported prompt/total usage (addBufferToUsage) — SUSPECTED_BUG, tools/parity/src/scenarios.mjs DEVIATIONS — intentional differences from 9router, each with entry, label, reason, tools/parity/tapes — 11 tapes from 9router 0.5.55 (JSON, stream, tool calls, omitted stream, 400/401/429/500, cut stream) (+2 more)

### Community 34 - "Anthropic request translation"
Cohesion: 0.36
Nodes (10): translator.claude-to-openai-response, translator.openai-to-claude-request, AnthropicAdapter — CIP <-> Messages (max_tokens rules, thinking budgets, tool_use, SSE events), packages/engine/test/anthropic-adapter.test.mjs (10) + apps/server/test/anthropic-lane.test.mjs (4); 23 mutations caught, Deviations not ported: stop/top_p kept, none stays none, no Claude Code line, stream errors fail, same stop/usage mapping, 403 invalid, Anthropic node descriptor: <base>/messages, x-api-key, Bearer for third-party hosts, anthropicNode { official }, createAdapter(provider, transport) — adapter chosen by protocol family, HttpProviderAdapter — shared auth headers, retry before first byte, error classification, redaction (+2 more)

### Community 35 - "Provider node API"
Cohesion: 0.29
Nodes (10): DELETE /api/provider-nodes/:id (cascades the connection), GET /api/provider-nodes, PATCH /api/provider-nodes/:id, POST /api/provider-nodes, UI error code: NODE_LIMIT (409), UI error code: PREFIX_RESERVED (409), UI error code: PREFIX_TAKEN (409), useProviderNodes / useCreateNode / useUpdateNode / useDeleteNode (features/providers/api.ts) (+2 more)

### Community 36 - "Command Code adapter"
Cohesion: 0.36
Nodes (9): connection.commandcode-key-test, translator.commandcode-to-openai-response, translator.openai-to-commandcode-request, API_UI_MAP row: SP14h Command Code adapter (no new screen), CommandCodeAdapter — envelope, NDJSON events via readJsonLines, peek with in-band error classification and 5xx retries, collapse for non-streaming clients, ping test, User decision 2026-09-27: SP14h keeps 9router request drops/defaults and stream error/end/finish/usage behavior; corrects the connection test; URL images refused and workingDir neutral for security, Command Code provider contract (M2 SP14h), SP14h tests: engine commandcode-adapter.test.mjs (8), server commandcode-lane.test.mjs; 39 mutations caught (+1 more)

### Community 37 - "Onboarding setup"
Cohesion: 0.39
Nodes (9): UI error code: ALREADY_SET_UP (409), UI error code: INVALID_REQUEST (400), UI error code: NOT_LOCAL (403), useSetup (features/settings/api.ts), POST /api/auth/setup, /welcome → Onboarding (one step), AIGATE_INITIAL_PASSWORD (first password at boot), Decision 2 (user, 2026-09-25): first password set from the local machine; no default password (+1 more)

### Community 38 - "Discovery evidence and media"
Cohesion: 0.28
Nodes (9): §7 Trace the behavior — never conclude from a function name, Evidence with file:line — traced is a test, not a self-declaration, Fixed inventory counts (154 routes, 28 pages, 123 providers, 29 executors, 48 translators, 11 repos, 14 OAuth routes), The Tracing Protocol (6 steps, applied by Tasks 6–18), Bounded context: media, Feature group: Media Providers, 09-media-providers.yaml, SP23 — media: 9 kinds, voice list (+1 more)

### Community 39 - "Password login"
Cohesion: 0.46
Nodes (8): identity.password-login-lockout, UI error code: INVALID_CREDENTIALS (401), UI error code: RATE_LIMITED (429), UI error code: SETUP_REQUIRED (409), useLogin (features/settings/api.ts), POST /api/auth/login, /login → Login, Login lockout: 5 failures → 30 s / 2 min / 10 min / 30 min, capped at 10,000 clients

### Community 40 - "Settings auth hooks"
Cohesion: 0.36
Nodes (8): useChangePassword (features/settings/api.ts), useLogout (features/settings/api.ts), usePatchSettings (features/settings/api.ts), POST /api/auth/logout, POST /api/auth/password, /settings/auth → SettingsAuth (password, sign out, Require login/API key toggles), scrypt password hashing (node:crypto, N = 2^15, constant-time compare), DB-stored sessions (aigate_session cookie, SHA-256 token hash, 24 h, max 20)

### Community 41 - "Ollama adapter"
Cohesion: 0.33
Nodes (7): connection.ollama-local-host, API_UI_MAP row: SP14d Ollama adapter and ollama-local connections, Ollama provider contract (M2 SP14d), SP14 — Provider adapters by protocol family (kiro, cursor, commandcode, vertex, azure…), SP14b — Anthropic-compatible custom providers, stream-only providers (49 connectable), SP14c — OpenAI Responses adapter; perplexity-agent and Responses custom providers (50 connectable), SP14d — Ollama adapter; ollama-local host and optional key; STT reclassified (52 connectable)

### Community 42 - "Custom provider storage"
Cohesion: 0.29
Nodes (7): connection.provider-node-create-list, connection.provider-node-repo-storage, connection.provider-node-update-delete, connection.provider-node-validate-partial-ssrf (stays traced: no validate route), Custom providers contract (M2 SP13b), Custom provider options - sealed headers and retryStreamErrors, StreamRetryAdapter - bounded retries for first-event stream errors

### Community 43 - "Ollama translation"
Cohesion: 0.33
Nodes (7): translator.ollama-to-openai-response, translator.openai-to-ollama-request, User decision 2026-09-26: SP14d corrects the ollama request drops and the stream error/cut-off handling; gemini deferred, Fix: HttpProviderAdapter.clean no longer splits messages on an empty key (found by the ollama lane test), OllamaAdapter — CIP <-> /api/chat JSON and NDJSON (options, format, think; error lines and cut-offs fail), PROVIDER_PROTOCOLS: openai-compatible | anthropic; descriptor quirks, SP14d tests: engine ollama-adapter.test.mjs (7), server ollama-lane.test.mjs (3); 28 mutations caught

### Community 44 - "Performance and bounded workload rules"
Cohesion: 0.29
Nodes (7): §17 Latency — clean architecture must not add hot-path I/O, §16 Do not inherit performance issues; all large workloads bounded, Constraint — every filesystem scan uses fast-glob with an explicit ignore list, Rule 4 — Every workload must be BOUNDED, Rule 11 — Review questions beyond "does it run?" (10x/100x traffic, unbounded work), Rule 5 — Low latency: parallelize independent awaits, only when bounded, Rule 3 — Optimize performance at design time, not micro-optimization

### Community 45 - "Partial stream failure"
Cohesion: 0.53
Nodes (6): fallback.partial-stream-failure, Truncated stream or error event → PROVIDER_UNAVAILABLE with details.partial, Stream headers only after the first chunk: earlier failures are real JSON statuses, Golden scenario: partial stream failure, OpenAIChatStreamEncoder — StreamChunk → OpenAI SSE; fail() = error event, no [DONE], Usage chunk after the finish chunk, only with stream_options.include_usage

### Community 46 - "Lint suite"
Cohesion: 0.53
Nodes (6): withRetry() — bounded retry helper (≤10 attempts, capped backoff, abortable), tools/lint/check.test.mjs (lint:check 13/13), Lint rule aigate/fetch-through-transport, Lint rule aigate/fetch-timeout (accepts AbortSignal.any([..., AbortSignal.timeout(n)])), Lint rule aigate/retry-through-helper, SP0.1 — Mechanical lint/CI suite (§11.2)

### Community 47 - "Transport contract"
Cohesion: 0.47
Nodes (6): HttpTransportPort, Next step: M1 SP8 transport (HttpTransportPort, direct + timeout, no UI), SP8 — transport: HttpTransportPort (direct + timeout only), Transport contract (M1 SP8), Upstream answers 4xx or 5xx, HttpResponse

### Community 48 - "Fallback error classification"
Cohesion: 0.50
Nodes (5): fallback.error-classification, Status → ErrorCode by status + error.code/type only (never message text), FALLBACK_POLICY (8 error codes as data), Rule: safe upstream codes (context_length_exceeded) reach the client, toOpenAIError() — ErrorCode → OpenAI status/type/code; internals never leak

### Community 49 - "Code quality rules"
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
- **28 isolated node(s):** `ErrorCode: INTERNAL_ERROR`, `03-accounts-multiaccount.yaml`, `05-request-routing-fallback.yaml`, `07-token-saver.yaml`, `09-media-providers.yaml` (+23 more)
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
- **Why does `Bounded context: routing (core)` connect `Routing core and dashboard` to `Usage, dashboard and integrations`, `Catalog connections and model listing`, `Discovery outputs and coverage`, `Discovery evidence and media`, `Tracing protocol and bounded contexts`, `Settings and environment`, `API keys and identity`, `Endpoint routing and transport`, `Ollama adapter`, `Catalog capabilities`, `Model resolution and fallback`, `Translation pivot and cache control`, `Architecture domain model`, `Anthropic client lane`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **Why does `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` connect `OpenAI-compatible adapter and streaming` to `Usage, dashboard and integrations`, `Gemini and client protocols`, `Endpoint routing and transport`, `Model resolution and fallback`, `Translation pivot and cache control`, `Anthropic provider adapter`, `Anthropic-compatible and stream-only providers`, `Provider credentials and headers`, `Vertex adapters`, `Custom provider nodes and options`, `Transport retry budget`, `Catalog registry extraction`, `Anthropic client lane`, `Gemini adapter`, `OpenAI client response lane`, `Anthropic request translation`, `Ollama translation`, `Partial stream failure`, `Lint suite`, `Transport contract`, `Fallback error classification`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._