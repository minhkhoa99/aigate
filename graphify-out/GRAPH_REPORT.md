# Graph Report - docs  (2026-09-27)

## Corpus Check
- 35 files · ~75,415 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 844 nodes · 2150 edges · 38 communities
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 261 edges (avg confidence: 0.87)
- Token cost: 574,916 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Dashboard screens awaiting backend|Dashboard screens awaiting backend]]
- [[_COMMUNITY_Provider screens and adapter credentials|Provider screens and adapter credentials]]
- [[_COMMUNITY_Catalog registry and custom provider nodes|Catalog registry and custom provider nodes]]
- [[_COMMUNITY_Discovery outputs and porting skill questions|Discovery outputs and porting skill questions]]
- [[_COMMUNITY_Architecture spec, domain model, error taxonomy|Architecture spec, domain model, error taxonomy]]
- [[_COMMUNITY_OAuth sign-in, refresh, and provider flows|OAuth sign-in, refresh, and provider flows]]
- [[_COMMUNITY_Provider connections and per-connection data|Provider connections and per-connection data]]
- [[_COMMUNITY_Settings context|Settings context]]
- [[_COMMUNITY_Gemini client lane and Responses compact|Gemini client lane and Responses compact]]
- [[_COMMUNITY_Transport, retry budget, and proxy chain|Transport, retry budget, and proxy chain]]
- [[_COMMUNITY_API keys and identity|API keys and identity]]
- [[_COMMUNITY_Chat lane routing and key gate|Chat lane routing and key gate]]
- [[_COMMUNITY_Tracing protocol and bounded contexts|Tracing protocol and bounded contexts]]
- [[_COMMUNITY_Model capabilities and custom models|Model capabilities and custom models]]
- [[_COMMUNITY_API to UI map rows (engine SPs)|API to UI map rows (engine SPs)]]
- [[_COMMUNITY_Password login and sessions|Password login and sessions]]
- [[_COMMUNITY_API key screens and errors|API key screens and errors]]
- [[_COMMUNITY_Translation pivot and cache_control filter|Translation pivot and cache_control filter]]
- [[_COMMUNITY_Monorepo layout and core decisions|Monorepo layout and core decisions]]
- [[_COMMUNITY_Anthropic adapter and compatible nodes|Anthropic adapter and compatible nodes]]
- [[_COMMUNITY_OpenAI-compatible adapter and CIP|OpenAI-compatible adapter and CIP]]
- [[_COMMUNITY_Transport error codes in the UI|Transport error codes in the UI]]
- [[_COMMUNITY_Anthropic Messages client lane|Anthropic Messages client lane]]
- [[_COMMUNITY_Onboarding setup|Onboarding setup]]
- [[_COMMUNITY_Ollama adapter|Ollama adapter]]
- [[_COMMUNITY_Gemini adapter|Gemini adapter]]
- [[_COMMUNITY_Vertex adapters|Vertex adapters]]
- [[_COMMUNITY_OpenAI Responses adapter|OpenAI Responses adapter]]
- [[_COMMUNITY_Fallback policy and lint rules|Fallback policy and lint rules]]
- [[_COMMUNITY_Command Code adapter|Command Code adapter]]
- [[_COMMUNITY_Parity findings and deviations|Parity findings and deviations]]
- [[_COMMUNITY_SP14 provider adapter SPs|SP14 provider adapter SPs]]
- [[_COMMUNITY_Streaming pipeline and error classification|Streaming pipeline and error classification]]
- [[_COMMUNITY_UI ownership and project map|UI ownership and project map]]
- [[_COMMUNITY_OpenAI Chat protocol lane|OpenAI Chat protocol lane]]
- [[_COMMUNITY_Partial stream failure|Partial stream failure]]
- [[_COMMUNITY_Skills and lint suite|Skills and lint suite]]
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
- `identity.machine-id-derivation` --conceptually_related_to--> `Bounded context: identity`  [INFERRED]
  docs/contracts/identity-apikeys.md → docs/superpowers/specs/2026-09-22-aigate-design.md
- `TransportModule (injects DirectTransport under HTTP_TRANSPORT)` --implements--> `Bounded context: transport`  [INFERRED]
  docs/contracts/transport.md → docs/superpowers/specs/2026-09-22-aigate-design.md
- `ErrorCode: TIMEOUT` --conceptually_related_to--> `UI error code: TIMEOUT`  [AMBIGUOUS]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/API_UI_MAP.md
- `MITM — /network/mitm` --semantically_similar_to--> `Settings · Developer (/settings/developer)`  [INFERRED] [semantically similar]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/stitch-briefs.md
- `Decision (user, 2026-09-25): onboarding is one step (set password, open dashboard)` --references--> `Onboarding — /welcome`  [INFERRED]
  docs/PROGRESS_HANDOFF.md → docs/superpowers/specs/2026-09-22-aigate-design.md

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

## Communities (38 total, 0 thin omitted)

### Community 0 - "Dashboard screens awaiting backend"
Cohesion: 0.06
Nodes (95): usage.write-not-synchronous, GET /overview/summary, SSE /events/requests, /traffic/console → Console (Developer mode only), /integrations/* → CliTools, CliToolDetail, Skills, Mcp, /network/* → ProxyPools, DeployWizard, Tunnel, Mitm, / → Overview, /traffic/usage, /traffic/requests* → Usage, Requests, RequestDetail (+87 more)

### Community 1 - "Provider screens and adapter credentials"
Cohesion: 0.07
Nodes (74): validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, API_UI_MAP row: M0 SP4 tools/extract + CATALOG, No UI yet (SP13 serves /providers), /providers/media* → MediaProviders, /providers/quota → Quota; custom provider form; multi-account, /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver, /settings/auth OIDC and SAML tabs, docs/discovery/gaps.md (Gap register), §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra) (+66 more)

### Community 2 - "Catalog registry and custom provider nodes"
Cohesion: 0.05
Nodes (63): catalog.registry-build, catalog.registry-entry-shape, connection.provider-node-api-type, connection.provider-node-create-list, connection.provider-node-repo-storage, connection.provider-node-update-delete, connection.provider-node-validate-partial-ssrf (stays traced: no validate route), routing.forced-stream-json-collapse (+55 more)

### Community 3 - "Discovery outputs and porting skill questions"
Cohesion: 0.06
Nodes (58): docs/capabilities.md (GENERATED capability specification), docs/discovery/coverage.md, docs/discovery/inventory.json, §30 The 12 pre-implementation questions, §3 The 20 behavioral questions (trigger…edge cases), §2 Core principles — never port, rename, or translate 9router line by line, §29 Definition of Done — 13 checklist items, no self-declared DONE, §14 Feature parity is not code parity (+50 more)

### Community 4 - "Architecture spec, domain model, error taxonomy"
Cohesion: 0.07
Nodes (51): API_UI_MAP row: M0 SP3 parity harness, No UI, Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Definition of Done — 13 items, not self-awarded, AIGate domain model (Provider, Credential, RoutingPolicy, AccountLock, …), Error taxonomy (8 ErrorCodes), IMPLEMENTATION_ACCIDENT — debt not inherited from 9router, Stated limits of tape-based parity (+43 more)

### Community 5 - "OAuth sign-in, refresh, and provider flows"
Cohesion: 0.08
Nodes (50): catalog.provider-models-live-fetch, oauth.dashboard-flow, oauth.refresh-lifecycle, oauth.token-storage, provider.claude-oauth, provider.cline-oauth, provider.codex-oauth, provider.github-copilot-oauth (+42 more)

### Community 6 - "Provider connections and per-connection data"
Cohesion: 0.06
Nodes (49): catalog.connection-detail-crud, catalog.connection-listing, connection.azure-openai-deployment, connection.client-listing-sanitized, connection.cloudflare-account-id, connection.test-single-connection, provider.clinepass-headers-envelope, connection.create-dedup-and-priority-assignment (+41 more)

### Community 7 - "Settings context"
Cohesion: 0.14
Nodes (23): settings.combo-rotation-reset, settings.database-export-import, settings.defaults-and-merge, settings.get-secret-stripping, settings.hot-path-read-no-cache, settings.outbound-proxy-live-apply, settings.patch-protected-keys, settings.proxy-test-outbound-probe (+15 more)

### Community 8 - "Gemini client lane and Responses compact"
Cohesion: 0.12
Nodes (23): catalog.v1beta-generate-content-dispatch, catalog.v1beta-models-listing, routing.responses-compact-lane, translator.gemini-client-request, translator.openai-to-gemini-client-response, translator.openai-to-responses-client-response, translator.responses-client-request, API_UI_MAP row: SP15b OpenAI Responses client protocol (+15 more)

### Community 9 - "Transport, retry budget, and proxy chain"
Cohesion: 0.11
Nodes (23): fallback.executor-retry-budget, transport.proxy-priority-chain, transport.test.mjs: adapter streams end to end over DirectTransport, Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, ExecCtx (one shared client-cancel + deadline signal), ErrorCode: PROVIDER_UNAVAILABLE, DirectTransport (direct branch implementation) (+15 more)

### Community 10 - "API keys and identity"
Cohesion: 0.15
Nodes (21): apikey.delete-key, apikey.legacy-format-unenforced, apikey.validate-lookup, identity.auth-status-disclosure, identity.machine-id-derivation, identity.reset-password-local-only, settings.patch-password-change, DELETE /api/keys/:id (+13 more)

### Community 11 - "Chat lane routing and key gate"
Cohesion: 0.15
Nodes (19): endpoint.enforce-require-api-key, catalog.model-listing-live-override, fallback.accounts-exhausted-response, routing.client-disconnect-propagation, routing.lane-entry-routes, routing.model-resolution, routing.request-preflight, §18 Streaming is first-class (TTFT, cancellation, backpressure) (+11 more)

### Community 12 - "Tracing protocol and bounded contexts"
Cohesion: 0.26
Nodes (19): /settings/general → SettingsGeneral, Audit finding: login-callback / deploy-wizard / authflow-modals are showcases, not routes, §7 Trace the behavior — never conclude from a function name, The Tracing Protocol (6 steps, applied by Tasks 6–18), Bounded context: apikeys, Bounded context: identity, Bounded context: settings, Feature group: Settings (+11 more)

### Community 13 - "Model capabilities and custom models"
Cohesion: 0.18
Nodes (18): catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.compatible-models-import-ui, catalog.custom-models-orphan-on-node-delete, catalog.model-registry-global, combo.detect-required-capabilities, API_UI_MAP row SP16a (+10 more)

### Community 14 - "API to UI map rows (engine SPs)"
Cohesion: 0.23
Nodes (18): API ↔ UI map (docs/design/API_UI_MAP.md), API_UI_MAP row: SP7 packages/engine, No UI, API_UI_MAP row: SP8 transport, No UI, API_UI_MAP row: SP9 OpenAICompatibleAdapter, No UI, Failed mutations re-read the server; submit disabled while pending, Rule: an SP with no HTTP API records "No UI" in its row, Milestone M1 · Walking skeleton (thin end-to-end slice), HttpTransportPort (+10 more)

### Community 15 - "Password login and sessions"
Cohesion: 0.23
Nodes (16): identity.password-login-lockout, identity.session-cookie-lifecycle, UI error code: INVALID_CREDENTIALS (401), UI error code: RATE_LIMITED (429), UI error code: SETUP_REQUIRED (409), useChangePassword (features/settings/api.ts), useLogin (features/settings/api.ts), useLogout (features/settings/api.ts) (+8 more)

### Community 16 - "API key screens and errors"
Cohesion: 0.22
Nodes (15): apikey.generate-key, apikey.list-keys, apikey.update-key-status, UI error code: INVALID_REQUEST (400), UI error code: LIMIT_REACHED (409), UI error code: NOT_FOUND (404), GET /api/keys, useApiKeys (features/gateway/api.ts) (+7 more)

### Community 17 - "Translation pivot and cache_control filter"
Cohesion: 0.16
Nodes (15): routing.request-translation, routing.source-format-detection, translator.openai-cache-control-filter, translator.pivot-loss, translator.tool-id-normalization, Status → ErrorCode by status + error.code/type only (never message text), OpenAI Chat cache_control on messages and text parts (CanonicalMessage.cacheControl), 11-translation-i18n.yaml (+7 more)

### Community 18 - "Monorepo layout and core decisions"
Cohesion: 0.18
Nodes (15): GET /health, 9router as Behavioral Source of Truth (not a template to port), Feature-based frontend structure with import boundaries, Hexagonal architecture, granularity = bounded context, Monorepo layout (apps/server, apps/web, apps/cli, packages/engine, contracts, database, tools), Open decisions not settled by this spec, AIGate Design Spec (2026-09-22), Decision 3 (user, 2026-09-25): sessions stored in the database, not a JWT (+7 more)

### Community 19 - "Anthropic adapter and compatible nodes"
Cohesion: 0.26
Nodes (13): connection.anthropic-compatible-node, translator.claude-to-openai-response, translator.openai-to-claude-request, AnthropicAdapter — CIP <-> Messages (max_tokens rules, thinking budgets, tool_use, SSE events), packages/engine/test/anthropic-adapter.test.mjs (10) + apps/server/test/anthropic-lane.test.mjs (4); 23 mutations caught, Deviations not ported: stop/top_p kept, none stays none, no Claude Code line, stream errors fail, same stop/usage mapping, 403 invalid, Claude Code anthropic-beta list for claude-* models on an Anthropic node (claude-code flag only on the official host), Anthropic node connection test: POST <base>/v1/messages, claude-3-haiku, only 401/403 invalid (9router) (+5 more)

### Community 20 - "OpenAI-compatible adapter and CIP"
Cohesion: 0.24
Nodes (13): OpenAICompatibleAdapter (AIProviderPort for openai-compatible), packages/engine/test/openai-adapter.test.mjs (15 tests, fake transport, SSE split every 3 bytes; 16 mutations caught), Refused before I/O: video, media by URL, assistant thinking, tool_result.isError, budgetTokens, foreign vendorExtensions, TokenUsage normalized: inputTokens excludes cache reads, outputTokens includes reasoning, Canonical Internal Protocol (CIP), vendorExtensions — typed carry-through field, src/json.ts — shared JSON narrowing (isRecord, record, text, list, parseJson), UnsupportedFeatureError (+5 more)

### Community 21 - "Transport error codes in the UI"
Cohesion: 0.24
Nodes (13): UI error code: BAD_RESPONSE, UI error code: HTTP_5xx, UI error code: NETWORK_ERROR, UI error code: any other code (fallback), UI error code: TIMEOUT, UI error code: UNAUTHENTICATED (401), shared/errors.test.mjs, shared/api.ts — same-origin JSON client, ApiError with stable code, 10 s timeout (+5 more)

### Community 22 - "Anthropic Messages client lane"
Cohesion: 0.23
Nodes (12): endpoint.rewrite-lanes, routing.count-tokens-estimate, translator.claude-client-request, translator.openai-to-claude-client-response, protocols/anthropic-messages.ts — parse to CIP, anthropicRequestFor (passthrough for Anthropic, claude→openai rules otherwise), message, SSE encoder, count_tokens, API_UI_MAP row: SP15 Anthropic Messages client protocol, Chat lane client protocol object (parse, prepare, respond, encoder) shared by /v1/chat/completions and /v1/messages, User decision 2026-09-27: SP15 Anthropic first; OpenAI-shaped errors and 9router non-stream/stream-default kept; real usage, live tool args, signature_delta corrected (+4 more)

### Community 23 - "Onboarding setup"
Cohesion: 0.26
Nodes (12): UI error code: ALREADY_SET_UP (409), UI error code: NOT_LOCAL (403), useSetup (features/settings/api.ts), POST /api/auth/setup, /welcome → Onboarding (one step), AIGATE_INITIAL_PASSWORD (first password at boot), Decision 2 (user, 2026-09-25): first password set from the local machine; no default password, Decision 4 (user, 2026-09-25): requireLogin = false exempts local clients only (+4 more)

### Community 24 - "Ollama adapter"
Cohesion: 0.20
Nodes (11): connection.ollama-local-host, translator.ollama-to-openai-response, translator.openai-to-ollama-request, readSseData() — bounded SSE reader (1 Mi chars per line/event, cancels body), API_UI_MAP row: SP14d Ollama adapter and ollama-local connections, User decision 2026-09-26: SP14d corrects the ollama request drops and the stream error/cut-off handling; gemini deferred, Fix: HttpProviderAdapter.clean no longer splits messages on an empty key (found by the ollama lane test), OllamaAdapter — CIP <-> /api/chat JSON and NDJSON (options, format, think; error lines and cut-offs fail) (+3 more)

### Community 25 - "Gemini adapter"
Cohesion: 0.31
Nodes (11): translator.gemini-to-openai-response, translator.openai-to-gemini-request, API_UI_MAP row: SP14e Gemini adapter (no new screen; Key rejected on a 400), CIP image_delta chunk (delta.images) and vendorExtensions.openai.finish_reason honoured by the OpenAI renderer, User decision 2026-09-26: SP14e keeps 9router's Gemini request drops and answer mapping; only the schema cleaner is corrected, GeminiAdapter — CIP <-> generateContent / streamGenerateContent?alt=sse (x-goog-api-key, safety off, thinking level/budget, 400 key test = invalid), cleanGeminiSchema() — corrected: walks schema positions only, no invented reason parameter, depth 64, Thought-signature cache (in memory, 1 h, 2000, same family) and the borrowed 9router signature on the first call (+3 more)

### Community 26 - "Vertex adapters"
Cohesion: 0.31
Nodes (10): connection.vertex-credential-test, provider.qoder-agent-transport (traced, not ported), provider.vertex-google-auth, routing.vertex-endpoints, translator.openai-to-vertex-request, User decision 2026-09-26: SP14f scope vertex only; qoder not ported; correct signatures, tokens, test, location; keep bounded project probe, google-auth.ts — parseGoogleCredential, RS256 JWT via WebCrypto, token cache per credential (1 h, 256), fresh mint after 401, Vertex AI provider contract (M2 SP14f) (+2 more)

### Community 27 - "OpenAI Responses adapter"
Cohesion: 0.24
Nodes (10): routing.responses-non-stream-answer, translator.openai-to-responses-request, translator.responses-to-openai-stream, API_UI_MAP row: SP14c Responses adapter (no new screen for perplexity-agent) and the API select on /providers/new, User decision 2026-09-26: SP14c corrects the non-stream answer, keeps 9router request drops and stream error handling, OpenAIResponsesAdapter — CIP <-> Responses API (extends OpenAICompatibleAdapter; 9router request and stream, corrected non-stream), OpenAI Responses provider contract (M2 SP14c), PROVIDER_PROTOCOLS: openai-compatible | anthropic; descriptor quirks (+2 more)

### Community 28 - "Fallback policy and lint rules"
Cohesion: 0.27
Nodes (10): §8 Business rule beats old implementation, §19 Fallback as explicit policy with classified errors, Canonical error classification codes (8 values), withRetry() — bounded retry helper (≤10 attempts, capped backoff, abortable), tools/lint/check.test.mjs (lint:check 13/13), Lint rule aigate/fetch-through-transport, Lint rule aigate/fetch-timeout (accepts AbortSignal.any([..., AbortSignal.timeout(n)])), Lint rule aigate/retry-through-helper (+2 more)

### Community 29 - "Command Code adapter"
Cohesion: 0.36
Nodes (9): connection.commandcode-key-test, translator.commandcode-to-openai-response, translator.openai-to-commandcode-request, API_UI_MAP row: SP14h Command Code adapter (no new screen), CommandCodeAdapter — envelope, NDJSON events via readJsonLines, peek with in-band error classification and 5xx retries, collapse for non-streaming clients, ping test, User decision 2026-09-27: SP14h keeps 9router request drops/defaults and stream error/end/finish/usage behavior; corrects the connection test; URL images refused and workingDir neutral for security, Command Code provider contract (M2 SP14h), SP14h tests: engine commandcode-adapter.test.mjs (8), server commandcode-lane.test.mjs; 39 mutations caught (+1 more)

### Community 30 - "Parity findings and deviations"
Cohesion: 0.28
Nodes (9): fallback.upstream-error-result, routing.stream-mode-decision, Finding: 9router 0.5.55 errors carry only { message } with its node id and the raw upstream body, Finding: omitted stream on 9router 0.5.55 → JSON body sent as text/event-stream + bare [DONE] (unparsable), Finding: 9router adds 2000 tokens to reported prompt/total usage (addBufferToUsage) — SUSPECTED_BUG, tools/parity/src/scenarios.mjs DEVIATIONS — intentional differences from 9router, each with entry, label, reason, tools/parity/tapes — 11 tapes from 9router 0.5.55 (JSON, stream, tool calls, omitted stream, 400/401/429/500, cut stream), Rule: an omitted stream flag means non-streaming (JSON) (+1 more)

### Community 31 - "SP14 provider adapter SPs"
Cohesion: 0.28
Nodes (9): API_UI_MAP row: SP14f Vertex adapters and the JSON credential field, Connections accept a complete Google Cloud JSON credential for googleCloud providers; keyHint = client_email, Connections: service-account JSON or API key field for Vertex (16384 chars), SP14f tests: engine vertex-adapter.test.mjs (9), server vertex-lane.test.mjs; 52 mutations, 1 equivalent removed, SP14 — Provider adapters by protocol family (kiro, cursor, commandcode, vertex, azure…), SP14c — OpenAI Responses adapter; perplexity-agent and Responses custom providers (50 connectable), SP14d — Ollama adapter; ollama-local host and optional key; STT reclassified (52 connectable), SP14f — Vertex AI and Vertex partner (Google Cloud credentials); qoder not ported (55 connectable) (+1 more)

### Community 32 - "Streaming pipeline and error classification"
Cohesion: 0.25
Nodes (8): fallback.error-classification, routing.default-executor-openai-fallback, routing.non-streaming-response, routing.streaming-pipeline, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), Idle timeout between chunks (AIGATE_STREAM_IDLE_TIMEOUT_MS, default 300 s) → TIMEOUT error event, OpenAI-compatible provider adapter contract (M1 SP9), Deferred: streaming idle timeout (gap between chunks) with SP12

### Community 33 - "UI ownership and project map"
Cohesion: 0.36
Nodes (8): docs/PROJECT_MAP.md (generated U-project ownership map), Rule: an API is done only when its UI screen is wired in the same SP, Decision: CLAUDE.md requires wiring the screen in the same SP as its API, Decision (user): build the Stitch UI before connecting application logic, UI ownership handoff (docs/design/UI_HANDOFF.md), Claude's integration boundary (keep shell/screens markup, add feature api.ts hooks), UI_READY — visual layout implemented with demo data only, ?uiState=loading|empty|error preview parameter

### Community 34 - "OpenAI Chat protocol lane"
Cohesion: 0.53
Nodes (6): endpoint.extract-header-order, API_UI_MAP row: SP10 OpenAI Chat protocol, No UI, /gateway/endpoint readiness pill (Ready / Connect a provider / Check connection) + curl test, POST /v1/chat/completions + GET /v1/models (/v1 Chat API), extractApiKey() (Authorization: Bearer first, then x-api-key), SP12 — routing: chat lane + Fastify raw streaming, backpressure, cancellation

### Community 35 - "Partial stream failure"
Cohesion: 0.53
Nodes (6): fallback.partial-stream-failure, Truncated stream or error event → PROVIDER_UNAVAILABLE with details.partial, Stream headers only after the first chunk: earlier failures are real JSON statuses, Golden scenario: partial stream failure, OpenAIChatStreamEncoder — StreamChunk → OpenAI SSE; fail() = error event, no [DONE], Usage chunk after the finish chunk, only with stream_options.include_usage

### Community 36 - "Skills and lint suite"
Cohesion: 0.40
Nodes (5): Split: machines block mechanics, skills teach judgement, Iron law: no skill without a failing test first (RED → GREEN → REFACTOR), UI performance constraints, Skill: writing-lean-bounded-code, SP0 — 2 skills + mechanical lint suite

### Community 37 - "Code quality rules"
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
- **26 isolated node(s):** `ErrorCode: INTERNAL_ERROR`, `03-accounts-multiaccount.yaml`, `05-request-routing-fallback.yaml`, `07-token-saver.yaml`, `09-media-providers.yaml` (+21 more)
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
- **Why does `Bounded context: routing (core)` connect `Provider screens and adapter credentials` to `Dashboard screens awaiting backend`, `OpenAI Chat protocol lane`, `Discovery outputs and porting skill questions`, `Architecture spec, domain model, error taxonomy`, `OAuth sign-in, refresh, and provider flows`, `Settings context`, `Tracing protocol and bounded contexts`, `API to UI map rows (engine SPs)`, `Translation pivot and cache_control filter`, `OpenAI-compatible adapter and CIP`, `Anthropic Messages client lane`, `SP14 provider adapter SPs`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **Why does `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` connect `OpenAI-compatible adapter and CIP` to `Streaming pipeline and error classification`, `Provider screens and adapter credentials`, `Catalog registry and custom provider nodes`, `Partial stream failure`, `Provider connections and per-connection data`, `Transport, retry budget, and proxy chain`, `Chat lane routing and key gate`, `API to UI map rows (engine SPs)`, `Translation pivot and cache_control filter`, `Anthropic adapter and compatible nodes`, `Ollama adapter`, `Gemini adapter`, `Vertex adapters`, `OpenAI Responses adapter`, `Fallback policy and lint rules`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._