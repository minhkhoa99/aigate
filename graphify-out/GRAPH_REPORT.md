# Graph Report - docs  (2026-09-27)

## Corpus Check
- 34 files · ~70,730 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 805 nodes · 2058 edges · 36 communities
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 261 edges (avg confidence: 0.87)
- Token cost: 574,916 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Settings, proxies, combos and dashboard screens|Settings, proxies, combos and dashboard screens]]
- [[_COMMUNITY_OAuth sign-in and provider adapters (SP16)|OAuth sign-in and provider adapters (SP16)]]
- [[_COMMUNITY_Generated discovery outputs and gap register|Generated discovery outputs and gap register]]
- [[_COMMUNITY_Per-connection data providers|Per-connection data providers]]
- [[_COMMUNITY_API_UI_MAP history and branding|API_UI_MAP history and branding]]
- [[_COMMUNITY_Connection CRUD and listing|Connection CRUD and listing]]
- [[_COMMUNITY_Custom provider nodes|Custom provider nodes]]
- [[_COMMUNITY_Client protocols Responses, Gemini, compact (SP15b-c)|Client protocols: Responses, Gemini, compact (SP15b-c)]]
- [[_COMMUNITY_Identity, machine id and general settings|Identity, machine id and general settings]]
- [[_COMMUNITY_API key listing and status|API key listing and status]]
- [[_COMMUNITY_Model listing, fallback and client disconnect|Model listing, fallback and client disconnect]]
- [[_COMMUNITY_Retry budget and transport|Retry budget and transport]]
- [[_COMMUNITY_API to UI map rows|API to UI map rows]]
- [[_COMMUNITY_Password lockout and session cookies|Password lockout and session cookies]]
- [[_COMMUNITY_Settings defaults and secret stripping|Settings defaults and secret stripping]]
- [[_COMMUNITY_Error classification and default executor|Error classification and default executor]]
- [[_COMMUNITY_Request translation and stream mode|Request translation and stream mode]]
- [[_COMMUNITY_Usage, project map and APIUI rule|Usage, project map and API/UI rule]]
- [[_COMMUNITY_API key createdelete and require-key gate|API key create/delete and require-key gate]]
- [[_COMMUNITY_Ollama adapter and local host|Ollama adapter and local host]]
- [[_COMMUNITY_Proxy chain and business-rule principles|Proxy chain and business-rule principles]]
- [[_COMMUNITY_UI error codes|UI error codes]]
- [[_COMMUNITY_Anthropic provider and compatible nodes|Anthropic provider and compatible nodes]]
- [[_COMMUNITY_Capability resolution|Capability resolution]]
- [[_COMMUNITY_Stream-only providers and JSON collapse|Stream-only providers and JSON collapse]]
- [[_COMMUNITY_Rewrite lanes and Anthropic Messages client (SP15)|Rewrite lanes and Anthropic Messages client (SP15)]]
- [[_COMMUNITY_Registry build and listed models|Registry build and listed models]]
- [[_COMMUNITY_Catalog headers and provider catalog API|Catalog headers and provider catalog API]]
- [[_COMMUNITY_Upstream error results and non-streaming response|Upstream error results and non-streaming response]]
- [[_COMMUNITY_Responses provider adapter (SP14c)|Responses provider adapter (SP14c)]]
- [[_COMMUNITY_Setup and request error codes|Setup and request error codes]]
- [[_COMMUNITY_Health, milestone M0 and open decisions|Health, milestone M0 and open decisions]]
- [[_COMMUNITY_Definition of done and debt labels|Definition of done and debt labels]]
- [[_COMMUNITY_Header extraction and OpenAI chat protocol|Header extraction and OpenAI chat protocol]]
- [[_COMMUNITY_Partial stream failure|Partial stream failure]]
- [[_COMMUNITY_Lean code rules|Lean code rules]]

## God Nodes (most connected - your core abstractions)
1. `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` - 39 edges
2. `Identity and API keys contract (M1 SP6)` - 37 edges
3. `Bounded context: routing (core)` - 35 edges
4. `Feature Matrix — mandatory 17-column artifact` - 27 edges
5. `Milestone M-1 · Discovery` - 27 edges
6. `Bounded context: connections` - 26 edges
7. `The 23 feature groups required by behavioral.md §5` - 26 edges
8. `ChatLane (modules/routing/infrastructure/chat-lane.ts)` - 26 edges
9. `SP6 — identity + apikeys (password login + key validation only)` - 25 edges
10. `API ↔ UI map (docs/design/API_UI_MAP.md)` - 24 edges

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

## Communities (36 total, 0 thin omitted)

### Community 0 - "Settings, proxies, combos and dashboard screens"
Cohesion: 0.05
Nodes (109): settings.combo-rotation-reset, settings.outbound-proxy-live-apply, settings.proxy-test-outbound-probe, GET /overview/summary, SSE /events/requests, /traffic/console → Console (Developer mode only), /integrations/* → CliTools, CliToolDetail, Skills, Mcp, /network/* → ProxyPools, DeployWizard, Tunnel, Mitm (+101 more)

### Community 1 - "OAuth sign-in and provider adapters (SP16)"
Cohesion: 0.06
Nodes (77): oauth.dashboard-flow, oauth.refresh-lifecycle, oauth.token-storage, provider.cline-oauth, provider.gitlab-duo-oauth, provider.kilocode-device-auth, provider.kimchi-browser-token, account.concurrent-refresh-race (+69 more)

### Community 2 - "Generated discovery outputs and gap register"
Cohesion: 0.05
Nodes (66): docs/capabilities.md (GENERATED capability specification), docs/discovery/coverage.md, docs/discovery/gaps.md (Gap register), docs/discovery/inventory.json, §30 The 12 pre-implementation questions, §3 The 20 behavioral questions (trigger…edge cases), §2 Core principles — never port, rename, or translate 9router line by line, §29 Definition of Done — 13 checklist items, no self-declared DONE (+58 more)

### Community 3 - "Per-connection data providers"
Cohesion: 0.06
Nodes (51): connection.azure-openai-deployment, connection.cloudflare-account-id, connection.commandcode-key-test, connection.vertex-credential-test, provider.clinepass-headers-envelope, provider.qoder-agent-transport (traced, not ported), provider.vertex-google-auth, routing.vertex-endpoints (+43 more)

### Community 4 - "API_UI_MAP history and branding"
Cohesion: 0.08
Nodes (44): API_UI_MAP row: M0 SP3 parity harness, No UI, Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Error taxonomy (8 ErrorCodes), Stated limits of tape-based parity, Parity verification — 3 tiers, Recording proxy + 4-part tape, Normalizer + semantic SSE diff (not chunk diff) (+36 more)

### Community 5 - "Connection CRUD and listing"
Cohesion: 0.09
Nodes (38): catalog.connection-detail-crud, catalog.connection-listing, connection.client-listing-sanitized, connection.test-single-connection, connection.create-dedup-and-priority-assignment, connection.delete-and-reorder, connection.storage-shape-json-blob, GET /api/providers/:id (chatUrl + models; 404 NOT_FOUND) (+30 more)

### Community 6 - "Custom provider nodes"
Cohesion: 0.14
Nodes (24): connection.provider-node-api-type, connection.provider-node-create-list, connection.provider-node-repo-storage, connection.provider-node-update-delete, connection.provider-node-validate-partial-ssrf (stays traced: no validate route), DELETE /api/provider-nodes/:id (cascades the connection), GET /api/provider-nodes, PATCH /api/provider-nodes/:id (+16 more)

### Community 7 - "Client protocols: Responses, Gemini, compact (SP15b-c)"
Cohesion: 0.12
Nodes (23): catalog.v1beta-generate-content-dispatch, catalog.v1beta-models-listing, routing.responses-compact-lane, translator.gemini-client-request, translator.openai-to-gemini-client-response, translator.openai-to-responses-client-response, translator.responses-client-request, API_UI_MAP row: SP15b OpenAI Responses client protocol (+15 more)

### Community 8 - "Identity, machine id and general settings"
Cohesion: 0.23
Nodes (20): identity.machine-id-derivation, settings.database-export-import, /settings/general → SettingsGeneral, Audit finding: login-callback / deploy-wizard / authflow-modals are showcases, not routes, §7 Trace the behavior — never conclude from a function name, The Tracing Protocol (6 steps, applied by Tasks 6–18), Bounded context: apikeys, Bounded context: identity (+12 more)

### Community 9 - "API key listing and status"
Cohesion: 0.16
Nodes (19): apikey.delete-key, apikey.legacy-format-unenforced, apikey.list-keys, apikey.update-key-status, apikey.validate-lookup, identity.auth-status-disclosure, identity.reset-password-local-only, settings.patch-password-change (+11 more)

### Community 10 - "Model listing, fallback and client disconnect"
Cohesion: 0.15
Nodes (19): catalog.model-listing-live-override, fallback.accounts-exhausted-response, routing.client-disconnect-propagation, routing.lane-entry-routes, routing.model-resolution, routing.request-preflight, routing.streaming-pipeline, §18 Streaming is first-class (TTFT, cancellation, backpressure) (+11 more)

### Community 11 - "Retry budget and transport"
Cohesion: 0.13
Nodes (19): fallback.executor-retry-budget, transport.test.mjs: adapter streams end to end over DirectTransport, Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, readSseData() — bounded SSE reader (1 Mi chars per line/event, cancels body), ErrorCode: PROVIDER_UNAVAILABLE, readJsonLines() — bounded NDJSON reader (1 MiB per line, blank lines skipped), DirectTransport (direct branch implementation) (+11 more)

### Community 12 - "API to UI map rows"
Cohesion: 0.23
Nodes (18): API ↔ UI map (docs/design/API_UI_MAP.md), API_UI_MAP row: M0 SP4 tools/extract + CATALOG, No UI yet (SP13 serves /providers), API_UI_MAP row: SP7 packages/engine, No UI, API_UI_MAP row: SP8 transport, No UI, API_UI_MAP row: SP9 OpenAICompatibleAdapter, No UI, Failed mutations re-read the server; submit disabled while pending, Rule: an SP with no HTTP API records "No UI" in its row, Milestone M1 · Walking skeleton (thin end-to-end slice) (+10 more)

### Community 13 - "Password lockout and session cookies"
Cohesion: 0.21
Nodes (17): identity.password-login-lockout, identity.session-cookie-lifecycle, UI error code: INVALID_CREDENTIALS (401), UI error code: RATE_LIMITED (429), UI error code: SETUP_REQUIRED (409), useChangePassword (features/settings/api.ts), useLogin (features/settings/api.ts), useLogout (features/settings/api.ts) (+9 more)

### Community 14 - "Settings defaults and secret stripping"
Cohesion: 0.23
Nodes (17): settings.defaults-and-merge, settings.get-secret-stripping, settings.hot-path-read-no-cache, settings.patch-protected-keys, GET /api/settings, usePatchSettings (features/settings/api.ts), useRequireApiKey (features/gateway/api.ts), PATCH /api/settings (+9 more)

### Community 15 - "Error classification and default executor"
Cohesion: 0.15
Nodes (17): fallback.error-classification, routing.default-executor-openai-fallback, OpenAICompatibleAdapter (AIProviderPort for openai-compatible), Status → ErrorCode by status + error.code/type only (never message text), packages/engine/test/openai-adapter.test.mjs (15 tests, fake transport, SSE split every 3 bytes; 16 mutations caught), Refused before I/O: video, media by URL, assistant thinking, tool_result.isError, budgetTokens, foreign vendorExtensions, TokenUsage normalized: inputTokens excludes cache reads, outputTokens includes reasoning, Canonical Internal Protocol (CIP) (+9 more)

### Community 16 - "Request translation and stream mode"
Cohesion: 0.20
Nodes (16): routing.request-translation, routing.source-format-detection, routing.stream-mode-decision, translator.pivot-loss, translator.tool-id-normalization, toOpenAIChatCompletion() — CanonicalResponse → chat.completion JSON, OpenAI Chat Completions protocol adapter contract (M1 SP10), parseOpenAIChatRequest() — OpenAI body → CanonicalRequest (INVALID_REQUEST names the field) (+8 more)

### Community 17 - "Usage, project map and API/UI rule"
Cohesion: 0.16
Nodes (16): usage.write-not-synchronous, docs/PROJECT_MAP.md (generated U-project ownership map), Rule: an API is done only when its UI screen is wired in the same SP, 9router as Behavioral Source of Truth (not a template to port), Feature-based frontend structure with import boundaries, Hexagonal architecture, granularity = bounded context, Monorepo layout (apps/server, apps/web, apps/cli, packages/engine, contracts, database, tools), AIGate Design Spec (2026-09-22) (+8 more)

### Community 18 - "API key create/delete and require-key gate"
Cohesion: 0.24
Nodes (15): apikey.generate-key, endpoint.enforce-require-api-key, DELETE /api/keys/:id, UI error code: LIMIT_REACHED (409), UI error code: NOT_FOUND (404), useCreateKey (features/gateway/api.ts), useDeleteKey (features/gateway/api.ts), useSetKeyActive (features/gateway/api.ts) (+7 more)

### Community 19 - "Ollama adapter and local host"
Cohesion: 0.15
Nodes (15): connection.ollama-local-host, translator.ollama-to-openai-response, translator.openai-to-ollama-request, API_UI_MAP row: SP14c Responses adapter (no new screen for perplexity-agent) and the API select on /providers/new, API_UI_MAP row: SP14d Ollama adapter and ollama-local connections, Catalog providers contract (M2 SP13), User decision 2026-09-26: SP14d corrects the ollama request drops and the stream error/cut-off handling; gemini deferred, Fix: HttpProviderAdapter.clean no longer splits messages on an empty key (found by the ollama lane test) (+7 more)

### Community 20 - "Proxy chain and business-rule principles"
Cohesion: 0.16
Nodes (15): transport.proxy-priority-chain, §8 Business rule beats old implementation, §19 Fallback as explicit policy with classified errors, Canonical error classification codes (8 values), ExecCtx (one shared client-cancel + deadline signal), withRetry() — bounded retry helper (≤10 attempts, capped backoff, abortable), tools/lint/check.test.mjs (lint:check 13/13), Lint rule aigate/fetch-through-transport (+7 more)

### Community 21 - "UI error codes"
Cohesion: 0.20
Nodes (15): UI error code: ALREADY_CONNECTED (409), UI error code: BAD_RESPONSE, UI error code: CREDENTIAL_UNREADABLE (409), UI error code: HTTP_5xx, UI error code: NETWORK_ERROR, UI error code: any other code (fallback), UI error code: TIMEOUT, UI error code: UNAUTHENTICATED (401) (+7 more)

### Community 22 - "Anthropic provider and compatible nodes"
Cohesion: 0.23
Nodes (14): connection.anthropic-compatible-node, provider.anthropic-auth-and-headers, translator.claude-to-openai-response, translator.openai-to-claude-request, AnthropicAdapter — CIP <-> Messages (max_tokens rules, thinking budgets, tool_use, SSE events), packages/engine/test/anthropic-adapter.test.mjs (10) + apps/server/test/anthropic-lane.test.mjs (4); 23 mutations caught, Deviations not ported: stop/top_p kept, none stays none, no Claude Code line, stream errors fail, same stop/usage mapping, 403 invalid, Claude Code anthropic-beta list for claude-* models on an Anthropic node (claude-code flag only on the official host) (+6 more)

### Community 23 - "Capability resolution"
Cohesion: 0.28
Nodes (13): catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, combo.detect-required-capabilities, assertModelSupports() — MODEL_UNAVAILABLE / INVALID_REQUEST, Engine contract (M1 SP7), defineRegistry() / builtinRegistry (single openai entry, 4 chat models) (+5 more)

### Community 24 - "Stream-only providers and JSON collapse"
Cohesion: 0.19
Nodes (13): routing.forced-stream-json-collapse, provider.codebuddy-request-quirks, API_UI_MAP row: SP14b stream-only providers (no new screen) and the protocol select on /providers/new, CodeBuddy quirks: reasoningSummary (cn, intl), neutralAgentPrompt (cn) via EXECUTOR_QUIRKS, User decision 2026-09-26: SP14b keeps 9router on every suspected bug asked, User decision 2026-09-26 (second ask): the stream-only collapse buffer is unbounded like 9router, features/providers/node-rules.ts unreachable(): OpenAI-compatible prefixes win, then the oldest, apps/server/test/provider-nodes.test.mjs (5 tests; 15 mutations caught) (+5 more)

### Community 25 - "Rewrite lanes and Anthropic Messages client (SP15)"
Cohesion: 0.23
Nodes (12): endpoint.rewrite-lanes, routing.count-tokens-estimate, translator.claude-client-request, translator.openai-to-claude-client-response, protocols/anthropic-messages.ts — parse to CIP, anthropicRequestFor (passthrough for Anthropic, claude→openai rules otherwise), message, SSE encoder, count_tokens, API_UI_MAP row: SP15 Anthropic Messages client protocol, Chat lane client protocol object (parse, prepare, respond, encoder) shared by /v1/chat/completions and /v1/messages, User decision 2026-09-27: SP15 Anthropic first; OpenAI-shaped errors and 9router non-stream/stream-default kept; real usage, live tool args, signature_delta corrected (+4 more)

### Community 26 - "Registry build and listed models"
Cohesion: 0.21
Nodes (12): catalog.registry-build, catalog.registry-entry-shape, ListedModel { id, descriptor? } — getModels never invents limits (≤1000 ids), CATALOG — providers.generated.ts (121 providers, 935 models; never hand-edited), CatalogProvider / CatalogModel / validateCatalog (packages/engine/src/catalog/schema.ts), Registry extraction contract (M0 SP4), tools/extract (deleted in SP13b; restorable from git d2783c1) — wrote the catalog from 9router, tools/extract verify (deleted in SP13b with the tool) (+4 more)

### Community 27 - "Catalog headers and provider catalog API"
Cohesion: 0.23
Nodes (12): Adapter: catalog headers first, key last; raw or Bearer scheme; chatUrl/modelsUrl called directly, GET /api/providers (all 121, connectable + reason), API_UI_MAP row: SP14a AnthropicAdapter — no new screen; /providers pills follow connectable, /providers → LlmProviders (catalog from GET /api/providers; Connected / Coming later pills), apps/server/test/catalog.test.mjs (catalog API) + chat-lane resolution tests, CatalogController — GET /api/providers, GET /api/providers/:id, /v1 resolution: provider-or-alias/model; non-connectable prefix → provider_not_supported; bare id → first declaring provider with an active connection, useProviders (features/providers/api.ts) (+4 more)

### Community 28 - "Upstream error results and non-streaming response"
Cohesion: 0.28
Nodes (9): fallback.upstream-error-result, routing.non-streaming-response, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), Finding: 9router 0.5.55 errors carry only { message } with its node id and the raw upstream body, Finding: omitted stream on 9router 0.5.55 → JSON body sent as text/event-stream + bare [DONE] (unparsable), Finding: 9router adds 2000 tokens to reported prompt/total usage (addBufferToUsage) — SUSPECTED_BUG, tools/parity/src/scenarios.mjs DEVIATIONS — intentional differences from 9router, each with entry, label, reason, tools/parity/tapes — 11 tapes from 9router 0.5.55 (JSON, stream, tool calls, omitted stream, 400/401/429/500, cut stream) (+1 more)

### Community 29 - "Responses provider adapter (SP14c)"
Cohesion: 0.31
Nodes (9): routing.responses-non-stream-answer, translator.openai-to-responses-request, translator.responses-to-openai-stream, builtinRegistry built from CATALOG (41 connectable providers), User decision 2026-09-26: SP14c corrects the non-stream answer, keeps 9router request drops and stream error handling, OpenAIResponsesAdapter — CIP <-> Responses API (extends OpenAICompatibleAdapter; 9router request and stream, corrected non-stream), PROVIDER_PROTOCOLS: openai-compatible | anthropic; descriptor quirks, Non-streaming Responses answer: stream false, output[] read (reasoning, text, refusal, tool calls, incomplete, failed, usage) (+1 more)

### Community 30 - "Setup and request error codes"
Cohesion: 0.39
Nodes (9): UI error code: ALREADY_SET_UP (409), UI error code: INVALID_REQUEST (400), UI error code: NOT_LOCAL (403), useSetup (features/settings/api.ts), POST /api/auth/setup, /welcome → Onboarding (one step), AIGATE_INITIAL_PASSWORD (first password at boot), Decision 2 (user, 2026-09-25): first password set from the local machine; no default password (+1 more)

### Community 31 - "Health, milestone M0 and open decisions"
Cohesion: 0.33
Nodes (9): GET /health, Open decisions not settled by this spec, Milestone M0 · Foundation, Decision (user, 2026-09-25): route all four SQLite clients through one locked sqlite-proxy wrapper, Port decision (spec §13): default 20200, PORT override, binds 127.0.0.1, Locked sqlite-proxy wrapper (AsyncLocalStorage, BEGIN/COMMIT around batch), SP1 — Monorepo skeleton (pnpm, TS strict, NestJS+Fastify, Vite, /health), SP2 — SPIKE-1 + Drizzle schema + 4-tier driver chain + migration runner (+1 more)

### Community 32 - "Definition of done and debt labels"
Cohesion: 0.25
Nodes (9): Definition of Done — 13 items, not self-awarded, IMPLEMENTATION_ACCIDENT — debt not inherited from 9router, Split: machines block mechanics, skills teach judgement, Mandatory 6-phase feature process (A Discovery → F Parity), Iron law: no skill without a failing test first (RED → GREEN → REFACTOR), UI performance constraints, Skill: porting-behavior-not-code, Skill: writing-lean-bounded-code (+1 more)

### Community 33 - "Header extraction and OpenAI chat protocol"
Cohesion: 0.53
Nodes (6): endpoint.extract-header-order, API_UI_MAP row: SP10 OpenAI Chat protocol, No UI, /gateway/endpoint readiness pill (Ready / Connect a provider / Check connection) + curl test, POST /v1/chat/completions + GET /v1/models (/v1 Chat API), extractApiKey() (Authorization: Bearer first, then x-api-key), SP12 — routing: chat lane + Fastify raw streaming, backpressure, cancellation

### Community 34 - "Partial stream failure"
Cohesion: 0.83
Nodes (4): fallback.partial-stream-failure, Truncated stream or error event → PROVIDER_UNAVAILABLE with details.partial, Stream headers only after the first chunk: earlier failures are real JSON statuses, Golden scenario: partial stream failure

### Community 35 - "Lean code rules"
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
- **23 isolated node(s):** `ErrorCode: INTERNAL_ERROR`, `02-providers-auth.yaml`, `03-accounts-multiaccount.yaml`, `05-request-routing-fallback.yaml`, `07-token-saver.yaml` (+18 more)
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
- **Why does `Bounded context: routing (core)` connect `Settings, proxies, combos and dashboard screens` to `OAuth sign-in and provider adapters (SP16)`, `Header extraction and OpenAI chat protocol`, `Per-connection data providers`, `API_UI_MAP history and branding`, `Generated discovery outputs and gap register`, `Identity, machine id and general settings`, `API to UI map rows`, `Error classification and default executor`, `Request translation and stream mode`, `API key create/delete and require-key gate`, `Rewrite lanes and Anthropic Messages client (SP15)`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **Why does `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` connect `Error classification and default executor` to `OAuth sign-in and provider adapters (SP16)`, `Partial stream failure`, `Per-connection data providers`, `Custom provider nodes`, `Model listing, fallback and client disconnect`, `Retry budget and transport`, `API to UI map rows`, `Ollama adapter and local host`, `Proxy chain and business-rule principles`, `Anthropic provider and compatible nodes`, `Stream-only providers and JSON collapse`, `Registry build and listed models`, `Catalog headers and provider catalog API`, `Upstream error results and non-streaming response`, `Responses provider adapter (SP14c)`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._