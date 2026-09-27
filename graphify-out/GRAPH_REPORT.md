# Graph Report - docs  (2026-09-27)

## Corpus Check
- 35 files · ~74,457 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 836 nodes · 2129 edges · 31 communities
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 261 edges (avg confidence: 0.87)
- Token cost: 574,916 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Transport, proxies, dashboard screens and integrations|Transport, proxies, dashboard screens and integrations]]
- [[_COMMUNITY_Architecture principles, credential tests and preview screens|Architecture principles, credential tests and preview screens]]
- [[_COMMUNITY_Catalog registry and capability resolution|Catalog registry and capability resolution]]
- [[_COMMUNITY_Generated discovery outputs and gap register|Generated discovery outputs and gap register]]
- [[_COMMUNITY_Per-connection providers and compatible nodes|Per-connection providers and compatible nodes]]
- [[_COMMUNITY_Connection CRUD, listing and per-connection data|Connection CRUD, listing and per-connection data]]
- [[_COMMUNITY_Custom provider nodes and forced stream collapse|Custom provider nodes and forced stream collapse]]
- [[_COMMUNITY_OAuth sign-in SP16, claude and codex (SP16b)|OAuth sign-in: SP16, claude and codex (SP16b)]]
- [[_COMMUNITY_Health, milestones and definition of done|Health, milestones and definition of done]]
- [[_COMMUNITY_Request translation and cache_control filter|Request translation and cache_control filter]]
- [[_COMMUNITY_API keys createdelete and require-key gate|API keys create/delete and require-key gate]]
- [[_COMMUNITY_Settings defaults and secret stripping|Settings defaults and secret stripping]]
- [[_COMMUNITY_API key listing and identity|API key listing and identity]]
- [[_COMMUNITY_Model listing, resolution and streaming pipeline|Model listing, resolution and streaming pipeline]]
- [[_COMMUNITY_Machine id, export and tracing protocol|Machine id, export and tracing protocol]]
- [[_COMMUNITY_Retry budget and transport errors|Retry budget and transport errors]]
- [[_COMMUNITY_Parity tiers and golden scenarios|Parity tiers and golden scenarios]]
- [[_COMMUNITY_Error taxonomy and fallback policy|Error taxonomy and fallback policy]]
- [[_COMMUNITY_Model import and custom models (SP16a)|Model import and custom models (SP16a)]]
- [[_COMMUNITY_Transport UI error codes|Transport UI error codes]]
- [[_COMMUNITY_Parity harness and branding|Parity harness and branding]]
- [[_COMMUNITY_Gemini client protocol (SP15c)|Gemini client protocol (SP15c)]]
- [[_COMMUNITY_Error classification and non-streaming response|Error classification and non-streaming response]]
- [[_COMMUNITY_Responses client protocol (SP15b)|Responses client protocol (SP15b)]]
- [[_COMMUNITY_Anthropic Messages client protocol (SP15)|Anthropic Messages client protocol (SP15)]]
- [[_COMMUNITY_Setup and request error codes|Setup and request error codes]]
- [[_COMMUNITY_Password lockout and login|Password lockout and login]]
- [[_COMMUNITY_Header extraction and OpenAI chat lane|Header extraction and OpenAI chat lane]]
- [[_COMMUNITY_Partial stream failure|Partial stream failure]]
- [[_COMMUNITY_Rewrite lanes and client protocol object|Rewrite lanes and client protocol object]]
- [[_COMMUNITY_Lean code rules|Lean code rules]]

## God Nodes (most connected - your core abstractions)
1. `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` - 39 edges
2. `Identity and API keys contract (M1 SP6)` - 37 edges
3. `Bounded context: routing (core)` - 36 edges
4. `Feature Matrix — mandatory 17-column artifact` - 27 edges
5. `Milestone M-1 · Discovery` - 27 edges
6. `Bounded context: connections` - 26 edges
7. `The 23 feature groups required by behavioral.md §5` - 26 edges
8. `API ↔ UI map (docs/design/API_UI_MAP.md)` - 26 edges
9. `ChatLane (modules/routing/infrastructure/chat-lane.ts)` - 26 edges
10. `SP6 — identity + apikeys (password login + key validation only)` - 25 edges

## Surprising Connections (you probably didn't know these)
- `TransportModule (injects DirectTransport under HTTP_TRANSPORT)` --implements--> `Bounded context: transport`  [INFERRED]
  docs/contracts/transport.md → docs/superpowers/specs/2026-09-22-aigate-design.md
- `ErrorCode: TIMEOUT` --conceptually_related_to--> `UI error code: TIMEOUT`  [AMBIGUOUS]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/API_UI_MAP.md
- `Decision (user, 2026-09-25): onboarding is one step (set password, open dashboard)` --references--> `Onboarding — /welcome`  [INFERRED]
  docs/PROGRESS_HANDOFF.md → docs/superpowers/specs/2026-09-22-aigate-design.md
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

## Communities (31 total, 0 thin omitted)

### Community 0 - "Transport, proxies, dashboard screens and integrations"
Cohesion: 0.05
Nodes (97): transport.proxy-priority-chain, GET /overview/summary, SSE /events/requests, /traffic/console → Console (Developer mode only), /integrations/* → CliTools, CliToolDetail, Skills, Mcp, /network/* → ProxyPools, DeployWizard, Tunnel, Mitm, / → Overview, /settings/auth OIDC and SAML tabs (+89 more)

### Community 1 - "Architecture principles, credential tests and preview screens"
Cohesion: 0.07
Nodes (77): validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, /providers/media* → MediaProviders, /providers/quota → Quota; custom provider form; multi-account, /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver, §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra), §9 Build an explicit domain model (Provider, Quota, RoutingPolicy…), §5 Feature discovery — inventory every group, do not trust the UI menu, §6 Feature Matrix requirement — nothing is understood until fully traced (+69 more)

### Community 2 - "Catalog registry and capability resolution"
Cohesion: 0.05
Nodes (73): catalog.registry-build, catalog.registry-entry-shape, catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, combo.detect-required-capabilities, provider.anthropic-auth-and-headers (+65 more)

### Community 3 - "Generated discovery outputs and gap register"
Cohesion: 0.05
Nodes (65): docs/capabilities.md (GENERATED capability specification), docs/discovery/coverage.md, docs/discovery/gaps.md (Gap register), docs/discovery/inventory.json, §30 The 12 pre-implementation questions, §3 The 20 behavioral questions (trigger…edge cases), §2 Core principles — never port, rename, or translate 9router line by line, §29 Definition of Done — 13 checklist items, no self-declared DONE (+57 more)

### Community 4 - "Per-connection providers and compatible nodes"
Cohesion: 0.06
Nodes (61): connection.anthropic-compatible-node, connection.commandcode-key-test, connection.ollama-local-host, connection.vertex-credential-test, provider.qoder-agent-transport (traced, not ported), provider.vertex-google-auth, routing.vertex-endpoints, translator.claude-to-openai-response (+53 more)

### Community 5 - "Connection CRUD, listing and per-connection data"
Cohesion: 0.06
Nodes (49): catalog.connection-detail-crud, catalog.connection-listing, connection.azure-openai-deployment, connection.client-listing-sanitized, connection.cloudflare-account-id, connection.test-single-connection, provider.clinepass-headers-envelope, connection.create-dedup-and-priority-assignment (+41 more)

### Community 6 - "Custom provider nodes and forced stream collapse"
Cohesion: 0.07
Nodes (45): connection.provider-node-api-type, connection.provider-node-create-list, connection.provider-node-repo-storage, connection.provider-node-update-delete, connection.provider-node-validate-partial-ssrf (stays traced: no validate route), routing.forced-stream-json-collapse, routing.responses-non-stream-answer, provider.codebuddy-request-quirks (+37 more)

### Community 7 - "OAuth sign-in: SP16, claude and codex (SP16b)"
Cohesion: 0.12
Nodes (31): oauth.dashboard-flow, oauth.refresh-lifecycle, oauth.token-storage, provider.claude-oauth, provider.cline-oauth, provider.codex-oauth, provider.github-copilot-oauth, provider.gitlab-duo-oauth (+23 more)

### Community 8 - "Health, milestones and definition of done"
Cohesion: 0.09
Nodes (27): usage.write-not-synchronous, GET /health, 9router as Behavioral Source of Truth (not a template to port), Definition of Done — 13 items, not self-awarded, Feature-based frontend structure with import boundaries, Hexagonal architecture, granularity = bounded context, IMPLEMENTATION_ACCIDENT — debt not inherited from 9router, Split: machines block mechanics, skills teach judgement (+19 more)

### Community 9 - "Request translation and cache_control filter"
Cohesion: 0.12
Nodes (26): routing.request-translation, routing.source-format-detection, routing.stream-mode-decision, translator.openai-cache-control-filter, translator.pivot-loss, translator.tool-id-normalization, OpenAICompatibleAdapter (AIProviderPort for openai-compatible), packages/engine/test/openai-adapter.test.mjs (15 tests, fake transport, SSE split every 3 bytes; 16 mutations caught) (+18 more)

### Community 10 - "API keys create/delete and require-key gate"
Cohesion: 0.18
Nodes (23): apikey.generate-key, endpoint.enforce-require-api-key, DELETE /api/keys/:id, UI error code: LIMIT_REACHED (409), UI error code: NOT_FOUND (404), UI error code: UNAUTHENTICATED (401), GET /api/keys, useApiKeys (features/gateway/api.ts) (+15 more)

### Community 11 - "Settings defaults and secret stripping"
Cohesion: 0.17
Nodes (23): settings.combo-rotation-reset, settings.defaults-and-merge, settings.get-secret-stripping, settings.hot-path-read-no-cache, settings.outbound-proxy-live-apply, settings.patch-protected-keys, settings.proxy-test-outbound-probe, GET /api/settings (+15 more)

### Community 12 - "API key listing and identity"
Cohesion: 0.15
Nodes (21): apikey.delete-key, apikey.legacy-format-unenforced, apikey.list-keys, apikey.update-key-status, apikey.validate-lookup, identity.auth-status-disclosure, identity.reset-password-local-only, identity.session-cookie-lifecycle (+13 more)

### Community 13 - "Model listing, resolution and streaming pipeline"
Cohesion: 0.14
Nodes (20): catalog.model-listing-live-override, fallback.accounts-exhausted-response, routing.client-disconnect-propagation, routing.model-resolution, routing.request-preflight, routing.streaming-pipeline, §18 Streaming is first-class (TTFT, cancellation, backpressure), Backpressure: a false write() waits for drain; the upstream read pauses with it (+12 more)

### Community 14 - "Machine id, export and tracing protocol"
Cohesion: 0.20
Nodes (19): identity.machine-id-derivation, settings.database-export-import, /settings/general → SettingsGeneral, Audit finding: login-callback / deploy-wizard / authflow-modals are showcases, not routes, §26 When the old code has a bug — label, analyse, do not auto-reproduce, §7 Trace the behavior — never conclude from a function name, The Tracing Protocol (6 steps, applied by Tasks 6–18), Bounded context: identity (+11 more)

### Community 15 - "Retry budget and transport errors"
Cohesion: 0.13
Nodes (19): fallback.executor-retry-budget, transport.test.mjs: adapter streams end to end over DirectTransport, Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, readSseData() — bounded SSE reader (1 Mi chars per line/event, cancels body), ErrorCode: PROVIDER_UNAVAILABLE, readJsonLines() — bounded NDJSON reader (1 MiB per line, blank lines skipped), DirectTransport (direct branch implementation) (+11 more)

### Community 16 - "Parity tiers and golden scenarios"
Cohesion: 0.18
Nodes (19): Parity verification — 3 tiers, Normalizer + semantic SSE diff (not chunk diff), apps/server/test/golden.test.mjs — 13 golden scenarios at M1 scope (3 deferred: SP16, SP17, SP19), Golden scenario: account failover, Golden scenario: all providers unavailable, Golden scenario: client cancellation, Golden scenario: invalid credentials, Golden scenario: model unavailable (+11 more)

### Community 17 - "Error taxonomy and fallback policy"
Cohesion: 0.17
Nodes (17): Status → ErrorCode by status + error.code/type only (never message text), API_UI_MAP row: SP8 transport, No UI, Error taxonomy (8 ErrorCodes), FALLBACK_POLICY (8 error codes as data), ErrorCode: AUTH_ERROR, ErrorCode: INTERNAL_ERROR, ErrorCode: INVALID_REQUEST, ErrorCode: MODEL_UNAVAILABLE (+9 more)

### Community 18 - "Model import and custom models (SP16a)"
Cohesion: 0.18
Nodes (15): catalog.provider-models-live-fetch, catalog.compatible-models-import-ui, catalog.custom-models-orphan-on-node-delete, catalog.model-connectivity-test, catalog.model-custom-registration, API_UI_MAP row SP16a, GET /api/connections/:id/models (adapter getModels, MODELS_FETCH_FAILED), Model import and custom models contract (M2 SP16a) (+7 more)

### Community 19 - "Transport UI error codes"
Cohesion: 0.23
Nodes (13): UI error code: BAD_RESPONSE, UI error code: HTTP_5xx, UI error code: NETWORK_ERROR, UI error code: any other code (fallback), UI error code: TIMEOUT, shared/errors.test.mjs, useAuthStatus (features/settings/api.ts), shared/api.ts — same-origin JSON client, ApiError with stable code, 10 s timeout (+5 more)

### Community 20 - "Parity harness and branding"
Cohesion: 0.22
Nodes (13): API_UI_MAP row: M0 SP3 parity harness, No UI, Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Stated limits of tape-based parity, Recording proxy + 4-part tape, pnpm parity record | replay | live | gate, Parity harness contract (M0 SP3) and the M1 acceptance gate, tools/parity/src/live.mjs — tier 2 against OpenAI (OPENAI_API_KEY, ≤16 tokens per tape) (+5 more)

### Community 21 - "Gemini client protocol (SP15c)"
Cohesion: 0.24
Nodes (12): catalog.v1beta-generate-content-dispatch, catalog.v1beta-models-listing, translator.gemini-client-request, translator.openai-to-gemini-client-response, API_UI_MAP row: SP15c Gemini client protocol, User decision 2026-09-27: SP15c keeps 9router on request, response and auth/path; TTS passthrough ported now, protocols/gemini-generate.ts — path parsing, text-only request, GenerateContentResponse, Gemini SSE encoder, model list, TTS request, TTS passthrough: body to Google unchanged with the gemini connection key; only content-type forwarded (+4 more)

### Community 22 - "Error classification and non-streaming response"
Cohesion: 0.21
Nodes (12): fallback.error-classification, fallback.upstream-error-result, routing.default-executor-openai-fallback, routing.non-streaming-response, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), Finding: 9router 0.5.55 errors carry only { message } with its node id and the raw upstream body, Finding: omitted stream on 9router 0.5.55 → JSON body sent as text/event-stream + bare [DONE] (unparsable), Finding: 9router adds 2000 tokens to reported prompt/total usage (addBufferToUsage) — SUSPECTED_BUG (+4 more)

### Community 23 - "Responses client protocol (SP15b)"
Cohesion: 0.24
Nodes (11): routing.responses-compact-lane, translator.openai-to-responses-client-response, translator.responses-client-request, API_UI_MAP row: SP15b OpenAI Responses client protocol, User decision 2026-09-27: SP15b keeps 9router on all four asks (request pivot drops/leaks, SSE shapes, non-stream answer, compact), protocols/openai-responses.ts — Responses → chat pivot in CIP, passthrough to Responses providers, response object, response.* SSE encoder, OpenAI Responses client protocol contract (M2 SP15b), OpenAI-compatible adapter sends reasoning history as reasoning_content + encrypted_content (+3 more)

### Community 24 - "Anthropic Messages client protocol (SP15)"
Cohesion: 0.29
Nodes (10): routing.count-tokens-estimate, translator.claude-client-request, translator.openai-to-claude-client-response, protocols/anthropic-messages.ts — parse to CIP, anthropicRequestFor (passthrough for Anthropic, claude→openai rules otherwise), message, SSE encoder, count_tokens, API_UI_MAP row: SP15 Anthropic Messages client protocol, User decision 2026-09-27: SP15 Anthropic first; OpenAI-shaped errors and 9router non-stream/stream-default kept; real usage, live tool args, signature_delta corrected, Anthropic Messages client protocol contract (M2 SP15), Endpoint screen: OpenAI and Anthropic chips, Claude Code and Anthropic curl copy fields (+2 more)

### Community 25 - "Setup and request error codes"
Cohesion: 0.33
Nodes (10): UI error code: ALREADY_SET_UP (409), UI error code: INVALID_REQUEST (400), UI error code: NOT_LOCAL (403), useSetup (features/settings/api.ts), POST /api/auth/setup, /welcome → Onboarding (one step), AIGATE_INITIAL_PASSWORD (first password at boot), Decision 2 (user, 2026-09-25): first password set from the local machine; no default password (+2 more)

### Community 26 - "Password lockout and login"
Cohesion: 0.46
Nodes (8): identity.password-login-lockout, UI error code: INVALID_CREDENTIALS (401), UI error code: RATE_LIMITED (429), UI error code: SETUP_REQUIRED (409), useLogin (features/settings/api.ts), POST /api/auth/login, /login → Login, Login lockout: 5 failures → 30 s / 2 min / 10 min / 30 min, capped at 10,000 clients

### Community 27 - "Header extraction and OpenAI chat lane"
Cohesion: 0.53
Nodes (6): endpoint.extract-header-order, API_UI_MAP row: SP10 OpenAI Chat protocol, No UI, /gateway/endpoint readiness pill (Ready / Connect a provider / Check connection) + curl test, POST /v1/chat/completions + GET /v1/models (/v1 Chat API), extractApiKey() (Authorization: Bearer first, then x-api-key), SP12 — routing: chat lane + Fastify raw streaming, backpressure, cancellation

### Community 28 - "Partial stream failure"
Cohesion: 0.53
Nodes (6): fallback.partial-stream-failure, Truncated stream or error event → PROVIDER_UNAVAILABLE with details.partial, Stream headers only after the first chunk: earlier failures are real JSON statuses, Golden scenario: partial stream failure, OpenAIChatStreamEncoder — StreamChunk → OpenAI SSE; fail() = error event, no [DONE], Usage chunk after the finish chunk, only with stream_options.include_usage

### Community 29 - "Rewrite lanes and client protocol object"
Cohesion: 0.50
Nodes (4): endpoint.rewrite-lanes, routing.lane-entry-routes, No CORS on /v1; JSON content type required (415), Chat lane client protocol object (parse, prepare, respond, encoder) shared by /v1/chat/completions and /v1/messages

### Community 30 - "Lean code rules"
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
- **23 isolated node(s):** `ErrorCode: INTERNAL_ERROR`, `03-accounts-multiaccount.yaml`, `05-request-routing-fallback.yaml`, `07-token-saver.yaml`, `09-media-providers.yaml` (+18 more)
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
- **Why does `Bounded context: routing (core)` connect `Architecture principles, credential tests and preview screens` to `Transport, proxies, dashboard screens and integrations`, `Catalog registry and capability resolution`, `Generated discovery outputs and gap register`, `Per-connection providers and compatible nodes`, `Request translation and cache_control filter`, `API keys create/delete and require-key gate`, `Settings defaults and secret stripping`, `Machine id, export and tracing protocol`, `Error taxonomy and fallback policy`, `Model import and custom models (SP16a)`, `Anthropic Messages client protocol (SP15)`, `Header extraction and OpenAI chat lane`, `Rewrite lanes and client protocol object`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **Why does `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` connect `Request translation and cache_control filter` to `Transport, proxies, dashboard screens and integrations`, `Architecture principles, credential tests and preview screens`, `Catalog registry and capability resolution`, `Per-connection providers and compatible nodes`, `Connection CRUD, listing and per-connection data`, `Custom provider nodes and forced stream collapse`, `Model listing, resolution and streaming pipeline`, `Retry budget and transport errors`, `Error taxonomy and fallback policy`, `Error classification and non-streaming response`, `Partial stream failure`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._