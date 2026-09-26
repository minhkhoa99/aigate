# Graph Report - docs  (2026-09-26)

## Corpus Check
- 29 files · ~62,160 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 746 nodes · 1938 edges · 36 communities
- Extraction: 86% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 261 edges (avg confidence: 0.87)
- Token cost: 574,916 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Usage, overview, console and integration screens|Usage, overview, console and integration screens]]
- [[_COMMUNITY_Credential test, provider screens, and gap register|Credential test, provider screens, and gap register]]
- [[_COMMUNITY_Discovery outputs and behavioral spec sections|Discovery outputs and behavioral spec sections]]
- [[_COMMUNITY_Retry budget and error classification|Retry budget and error classification]]
- [[_COMMUNITY_Provider connections CRUD and connection tests|Provider connections CRUD and connection tests]]
- [[_COMMUNITY_Transport, proxy chain, and upstream errors|Transport, proxy chain, and upstream errors]]
- [[_COMMUNITY_Custom provider nodes (OpenAIAnthropic, apiType)|Custom provider nodes (OpenAI/Anthropic, apiType)]]
- [[_COMMUNITY_API key status, deletion, and auth status|API key status, deletion, and auth status]]
- [[_COMMUNITY_API key generation and endpoint lanes|API key generation and endpoint lanes]]
- [[_COMMUNITY_Machine identity, general settings, audit findings|Machine identity, general settings, audit findings]]
- [[_COMMUNITY_Settings storage and protected keys|Settings storage and protected keys]]
- [[_COMMUNITY_Vertex and Google Cloud credentials (SP14f)|Vertex and Google Cloud credentials (SP14f)]]
- [[_COMMUNITY_Chat lane routing and model resolution|Chat lane routing and model resolution]]
- [[_COMMUNITY_Catalog API and adapter headers|Catalog API and adapter headers]]
- [[_COMMUNITY_Anthropic adapter and Anthropic-compatible nodes|Anthropic adapter and Anthropic-compatible nodes]]
- [[_COMMUNITY_Per-connection data Azure, Cloudflare, ClinePass (SP14g)|Per-connection data: Azure, Cloudflare, ClinePass (SP14g)]]
- [[_COMMUNITY_Model capabilities and combos|Model capabilities and combos]]
- [[_COMMUNITY_Error classification and non-streaming answers|Error classification and non-streaming answers]]
- [[_COMMUNITY_Stream-only providers and CodeBuddy quirks|Stream-only providers and CodeBuddy quirks]]
- [[_COMMUNITY_Settings API and password|Settings API and password]]
- [[_COMMUNITY_Registry build and extracted catalog|Registry build and extracted catalog]]
- [[_COMMUNITY_Request translation and format detection|Request translation and format detection]]
- [[_COMMUNITY_OpenAI Responses adapter (SP14c)|OpenAI Responses adapter (SP14c)]]
- [[_COMMUNITY_Gemini adapter (SP14e)|Gemini adapter (SP14e)]]
- [[_COMMUNITY_Architecture decisions and health|Architecture decisions and health]]
- [[_COMMUNITY_API to UI map|API to UI map]]
- [[_COMMUNITY_Onboarding setup and its errors|Onboarding setup and its errors]]
- [[_COMMUNITY_Skills and SP0 lint suite|Skills and SP0 lint suite]]
- [[_COMMUNITY_Endpoint readiness and OpenAI Chat protocol|Endpoint readiness and OpenAI Chat protocol]]
- [[_COMMUNITY_Upstream error results and stream mode|Upstream error results and stream mode]]
- [[_COMMUNITY_Login lockout and its errors|Login lockout and its errors]]
- [[_COMMUNITY_Ollama adapter and ollama-local (SP14d)|Ollama adapter and ollama-local (SP14d)]]
- [[_COMMUNITY_Project map, handoff, and wiring rule|Project map, handoff, and wiring rule]]
- [[_COMMUNITY_Streaming pipeline and bounded SSE|Streaming pipeline and bounded SSE]]
- [[_COMMUNITY_Partial stream failure|Partial stream failure]]
- [[_COMMUNITY_Code quality rules|Code quality rules]]

## God Nodes (most connected - your core abstractions)
1. `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` - 39 edges
2. `Identity and API keys contract (M1 SP6)` - 37 edges
3. `Bounded context: routing (core)` - 35 edges
4. `Feature Matrix — mandatory 17-column artifact` - 27 edges
5. `Milestone M-1 · Discovery` - 27 edges
6. `Bounded context: connections` - 26 edges
7. `The 23 feature groups required by behavioral.md §5` - 26 edges
8. `SP6 — identity + apikeys (password login + key validation only)` - 25 edges
9. `ChatLane (modules/routing/infrastructure/chat-lane.ts)` - 25 edges
10. `shared/errors.ts toProblem() — the one code-to-message table` - 24 edges

## Surprising Connections (you probably didn't know these)
- `ErrorCode: TIMEOUT` --conceptually_related_to--> `UI error code: TIMEOUT`  [AMBIGUOUS]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/API_UI_MAP.md
- `MITM — /network/mitm` --semantically_similar_to--> `Settings · Developer (/settings/developer)`  [INFERRED] [semantically similar]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/stitch-briefs.md
- `Feature group — MCP (API with no UI, found during spec work)` --conceptually_related_to--> `The 23 feature groups required by behavioral.md §5`  [AMBIGUOUS]
  docs/superpowers/plans/2026-09-22-m1-discovery.md → docs/governance/behavioral.md
- `Rule 4 — Every workload must be BOUNDED` --semantically_similar_to--> `§16 Do not inherit performance issues; all large workloads bounded`  [INFERRED] [semantically similar]
  docs/governance/rules.md → docs/governance/behavioral.md
- `?uiState=loading|empty|error preview parameter` --references--> `Required state: error with retry`  [INFERRED]
  docs/design/UI_HANDOFF.md → docs/design/DESIGN.md

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

### Community 0 - "Usage, overview, console and integration screens"
Cohesion: 0.05
Nodes (88): usage.write-not-synchronous, GET /overview/summary, SSE /events/requests, /traffic/console → Console (Developer mode only), /integrations/* → CliTools, CliToolDetail, Skills, Mcp, / → Overview, /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver, /settings/auth OIDC and SAML tabs (+80 more)

### Community 1 - "Credential test, provider screens, and gap register"
Cohesion: 0.07
Nodes (73): validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, /providers/media* → MediaProviders, /providers/quota → Quota; custom provider form; multi-account, docs/discovery/gaps.md (Gap register), §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra), §9 Build an explicit domain model (Provider, Quota, RoutingPolicy…), §5 Feature discovery — inventory every group, do not trust the UI menu, §6 Feature Matrix requirement — nothing is understood until fully traced (+65 more)

### Community 2 - "Discovery outputs and behavioral spec sections"
Cohesion: 0.05
Nodes (62): docs/capabilities.md (GENERATED capability specification), docs/discovery/coverage.md, docs/discovery/inventory.json, §30 The 12 pre-implementation questions, §3 The 20 behavioral questions (trigger…edge cases), §8 Business rule beats old implementation, §2 Core principles — never port, rename, or translate 9router line by line, §29 Definition of Done — 13 checklist items, no self-declared DONE (+54 more)

### Community 3 - "Retry budget and error classification"
Cohesion: 0.06
Nodes (58): fallback.executor-retry-budget, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, Status → ErrorCode by status + error.code/type only (never message text), API_UI_MAP row: M0 SP3 parity harness, No UI, API_UI_MAP row: SP8 transport, No UI, Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Definition of Done — 13 items, not self-awarded (+50 more)

### Community 4 - "Provider connections CRUD and connection tests"
Cohesion: 0.08
Nodes (45): catalog.connection-detail-crud, catalog.connection-listing, connection.client-listing-sanitized, connection.test-single-connection, connection.create-dedup-and-priority-assignment, connection.delete-and-reorder, connection.storage-shape-json-blob, DELETE /api/connections/:id (+37 more)

### Community 5 - "Transport, proxy chain, and upstream errors"
Cohesion: 0.09
Nodes (41): transport.proxy-priority-chain, transport.test.mjs: adapter streams end to end over DirectTransport, Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O, /network/* → ProxyPools, DeployWizard, Tunnel, Mitm, Audit finding: MITM CA buttons adjacent, type-to-confirm modal missing, Hard constraint: tunnel requires 'Require API key' enabled, Bounded context: transport, Decision: do NOT clone 9Remote (+33 more)

### Community 6 - "Custom provider nodes (OpenAI/Anthropic, apiType)"
Cohesion: 0.14
Nodes (25): connection.provider-node-api-type, connection.provider-node-create-list, connection.provider-node-repo-storage, connection.provider-node-update-delete, connection.provider-node-validate-partial-ssrf (stays traced: no validate route), DELETE /api/provider-nodes/:id (cascades the connection), GET /api/provider-nodes, PATCH /api/provider-nodes/:id (+17 more)

### Community 7 - "API key status, deletion, and auth status"
Cohesion: 0.17
Nodes (23): apikey.delete-key, apikey.update-key-status, identity.auth-status-disclosure, DELETE /api/keys/:id, UI error code: INVALID_REQUEST (400), UI error code: LIMIT_REACHED (409), UI error code: NOT_FOUND (404), UI error code: UNAUTHENTICATED (401) (+15 more)

### Community 8 - "API key generation and endpoint lanes"
Cohesion: 0.17
Nodes (19): apikey.generate-key, apikey.legacy-format-unenforced, apikey.list-keys, apikey.validate-lookup, endpoint.enforce-require-api-key, endpoint.rewrite-lanes, identity.reset-password-local-only, identity.session-cookie-lifecycle (+11 more)

### Community 9 - "Machine identity, general settings, audit findings"
Cohesion: 0.27
Nodes (18): identity.machine-id-derivation, /settings/general → SettingsGeneral, Audit finding: login-callback / deploy-wizard / authflow-modals are showcases, not routes, §7 Trace the behavior — never conclude from a function name, The Tracing Protocol (6 steps, applied by Tasks 6–18), Bounded context: apikeys, Bounded context: identity, Bounded context: settings (+10 more)

### Community 10 - "Settings storage and protected keys"
Cohesion: 0.14
Nodes (18): settings.combo-rotation-reset, settings.database-export-import, settings.defaults-and-merge, settings.get-secret-stripping, settings.hot-path-read-no-cache, settings.outbound-proxy-live-apply, settings.patch-protected-keys, settings.proxy-test-outbound-probe (+10 more)

### Community 11 - "Vertex and Google Cloud credentials (SP14f)"
Cohesion: 0.18
Nodes (18): connection.vertex-credential-test, provider.qoder-agent-transport (traced, not ported), provider.vertex-google-auth, routing.vertex-endpoints, translator.openai-to-vertex-request, API_UI_MAP row: SP14f Vertex adapters and the JSON credential field, User decision 2026-09-26: SP14f scope vertex only; qoder not ported; correct signatures, tokens, test, location; keep bounded project probe, google-auth.ts — parseGoogleCredential, RS256 JWT via WebCrypto, token cache per credential (1 h, 256), fresh mint after 401 (+10 more)

### Community 12 - "Chat lane routing and model resolution"
Cohesion: 0.16
Nodes (17): catalog.model-listing-live-override, fallback.accounts-exhausted-response, routing.client-disconnect-propagation, routing.lane-entry-routes, routing.model-resolution, routing.request-preflight, §18 Streaming is first-class (TTFT, cancellation, backpressure), Backpressure: a false write() waits for drain; the upstream read pauses with it (+9 more)

### Community 13 - "Catalog API and adapter headers"
Cohesion: 0.17
Nodes (15): catalog.registry-entry-shape, Adapter: catalog headers first, key last; raw or Bearer scheme; chatUrl/modelsUrl called directly, GET /api/providers/:id (chatUrl + models; 404 NOT_FOUND), GET /api/providers (all 121, connectable + reason), API_UI_MAP row: SP14a AnthropicAdapter — no new screen; /providers pills follow connectable, /providers → LlmProviders (catalog from GET /api/providers; Connected / Coming later pills), apps/server/test/catalog.test.mjs (catalog API) + chat-lane resolution tests, CatalogController — GET /api/providers, GET /api/providers/:id (+7 more)

### Community 14 - "Anthropic adapter and Anthropic-compatible nodes"
Cohesion: 0.21
Nodes (15): connection.anthropic-compatible-node, translator.claude-to-openai-response, translator.openai-to-claude-request, AnthropicAdapter — CIP <-> Messages (max_tokens rules, thinking budgets, tool_use, SSE events), packages/engine/test/anthropic-adapter.test.mjs (10) + apps/server/test/anthropic-lane.test.mjs (4); 23 mutations caught, Deviations not ported: stop/top_p kept, none stays none, no Claude Code line, stream errors fail, same stop/usage mapping, 403 invalid, Claude Code anthropic-beta list for claude-* models on an Anthropic node (claude-code flag only on the official host), Anthropic node connection test: POST <base>/v1/messages, claude-3-haiku, only 401/403 invalid (9router) (+7 more)

### Community 15 - "Per-connection data: Azure, Cloudflare, ClinePass (SP14g)"
Cohesion: 0.16
Nodes (14): connection.azure-openai-deployment, connection.cloudflare-account-id, provider.clinepass-headers-envelope, translator.cloudflare-content-flatten, API_UI_MAP row: SP14g per-connection data and ClinePass, Descriptor chatProbe: connection test by a one-token chat (azure 401/403, cloudflare 401/403/404, clinepass 401/403), ClinePass: Cline headers naming AIGate, non-stream { success, data } unwrapped, provider_connections.deployment, api_version, organization, account_id (migration 0008); POST/PATCH validation per field (+6 more)

### Community 16 - "Model capabilities and combos"
Cohesion: 0.26
Nodes (14): catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, combo.detect-required-capabilities, assertModelSupports() — MODEL_UNAVAILABLE / INVALID_REQUEST, Engine contract (M1 SP7), defineRegistry() / builtinRegistry (single openai entry, 4 chat models) (+6 more)

### Community 17 - "Error classification and non-streaming answers"
Cohesion: 0.19
Nodes (13): fallback.error-classification, routing.default-executor-openai-fallback, routing.non-streaming-response, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), OpenAICompatibleAdapter (AIProviderPort for openai-compatible), packages/engine/test/openai-adapter.test.mjs (15 tests, fake transport, SSE split every 3 bytes; 16 mutations caught), Refused before I/O: video, media by URL, assistant thinking, tool_result.isError, budgetTokens, foreign vendorExtensions, TokenUsage normalized: inputTokens excludes cache reads, outputTokens includes reasoning (+5 more)

### Community 18 - "Stream-only providers and CodeBuddy quirks"
Cohesion: 0.21
Nodes (13): routing.forced-stream-json-collapse, provider.anthropic-auth-and-headers, provider.codebuddy-request-quirks, API_UI_MAP row: SP14b stream-only providers (no new screen) and the protocol select on /providers/new, builtinRegistry built from CATALOG (41 connectable providers), Catalog providers contract (M2 SP13), CodeBuddy quirks: reasoningSummary (cn, intl), neutralAgentPrompt (cn) via EXECUTOR_QUIRKS, User decision 2026-09-26: SP14b keeps 9router on every suspected bug asked (+5 more)

### Community 19 - "Settings API and password"
Cohesion: 0.26
Nodes (13): GET /api/settings, useChangePassword (features/settings/api.ts), useLogout (features/settings/api.ts), usePatchSettings (features/settings/api.ts), useRequireApiKey (features/gateway/api.ts), useSettings (features/settings/api.ts), PATCH /api/settings, POST /api/auth/logout (+5 more)

### Community 20 - "Registry build and extracted catalog"
Cohesion: 0.22
Nodes (11): catalog.registry-build, ListedModel { id, descriptor? } — getModels never invents limits (≤1000 ids), CATALOG — providers.generated.ts (121 providers, 935 models; never hand-edited), CatalogProvider / CatalogModel / validateCatalog (packages/engine/src/catalog/schema.ts), Registry extraction contract (M0 SP4), tools/extract (deleted in SP13b; restorable from git d2783c1) — wrote the catalog from 9router, tools/extract verify (deleted in SP13b with the tool), Rule: model ids unique per (kind, id) — Gemini 2.5 serves both chat and stt (+3 more)

### Community 21 - "Request translation and format detection"
Cohesion: 0.27
Nodes (11): routing.request-translation, routing.source-format-detection, translator.pivot-loss, translator.tool-id-normalization, toOpenAIChatCompletion() — CanonicalResponse → chat.completion JSON, OpenAI Chat Completions protocol adapter contract (M1 SP10), parseOpenAIChatRequest() — OpenAI body → CanonicalRequest (INVALID_REQUEST names the field), Not ported: tool-id normalization and empty tool answers (Anthropic adapters, SP15) (+3 more)

### Community 22 - "OpenAI Responses adapter (SP14c)"
Cohesion: 0.24
Nodes (11): routing.responses-non-stream-answer, translator.openai-to-responses-request, translator.responses-to-openai-stream, API_UI_MAP row: SP14c Responses adapter (no new screen for perplexity-agent) and the API select on /providers/new, User decision 2026-09-26: SP14c corrects the non-stream answer, keeps 9router request drops and stream error handling, OpenAIResponsesAdapter — CIP <-> Responses API (extends OpenAICompatibleAdapter; 9router request and stream, corrected non-stream), OpenAI Responses provider contract (M2 SP14c), Non-streaming Responses answer: stream false, output[] read (reasoning, text, refusal, tool calls, incomplete, failed, usage) (+3 more)

### Community 23 - "Gemini adapter (SP14e)"
Cohesion: 0.31
Nodes (11): translator.gemini-to-openai-response, translator.openai-to-gemini-request, API_UI_MAP row: SP14e Gemini adapter (no new screen; Key rejected on a 400), CIP image_delta chunk (delta.images) and vendorExtensions.openai.finish_reason honoured by the OpenAI renderer, User decision 2026-09-26: SP14e keeps 9router's Gemini request drops and answer mapping; only the schema cleaner is corrected, GeminiAdapter — CIP <-> generateContent / streamGenerateContent?alt=sse (x-goog-api-key, safety off, thinking level/budget, 400 key test = invalid), cleanGeminiSchema() — corrected: walks schema positions only, no invented reason parameter, depth 64, Thought-signature cache (in memory, 1 h, 2000, same family) and the borrowed 9router signature on the first call (+3 more)

### Community 24 - "Architecture decisions and health"
Cohesion: 0.22
Nodes (11): GET /health, 9router as Behavioral Source of Truth (not a template to port), Feature-based frontend structure with import boundaries, Hexagonal architecture, granularity = bounded context, Monorepo layout (apps/server, apps/web, apps/cli, packages/engine, contracts, database, tools), Open decisions not settled by this spec, AIGate Design Spec (2026-09-22), Decision 1 (user, 2026-09-25): API keys are random and stored as a hash (+3 more)

### Community 25 - "API to UI map"
Cohesion: 0.36
Nodes (10): API ↔ UI map (docs/design/API_UI_MAP.md), API_UI_MAP row: M0 SP4 tools/extract + CATALOG, No UI yet (SP13 serves /providers), API_UI_MAP row: SP7 packages/engine, No UI, Failed mutations re-read the server; submit disabled while pending, Rule: an SP with no HTTP API records "No UI" in its row, AIGate progress handoff (docs/PROGRESS_HANDOFF.md), Gap: M0 SP3 (parity harness) and SP4 (tools/extract) never built, Task board (PROGRESS_HANDOFF) (+2 more)

### Community 26 - "Onboarding setup and its errors"
Cohesion: 0.33
Nodes (10): UI error code: ALREADY_SET_UP (409), UI error code: NOT_LOCAL (403), useSetup (features/settings/api.ts), POST /api/auth/setup, /welcome → Onboarding (one step), AIGATE_INITIAL_PASSWORD (first password at boot), Decision 2 (user, 2026-09-25): first password set from the local machine; no default password, Decision (user, 2026-09-25, option A): on shared machines rely on AIGATE_INITIAL_PASSWORD (+2 more)

### Community 27 - "Skills and SP0 lint suite"
Cohesion: 0.24
Nodes (10): Split: machines block mechanics, skills teach judgement, Iron law: no skill without a failing test first (RED → GREEN → REFACTOR), UI performance constraints, Milestone M0 · Foundation, Decision (user, 2026-09-25): route all four SQLite clients through one locked sqlite-proxy wrapper, Locked sqlite-proxy wrapper (AsyncLocalStorage, BEGIN/COMMIT around batch), Skill: writing-lean-bounded-code, SP0 — 2 skills + mechanical lint suite (+2 more)

### Community 28 - "Endpoint readiness and OpenAI Chat protocol"
Cohesion: 0.33
Nodes (9): endpoint.extract-header-order, API_UI_MAP row: SP10 OpenAI Chat protocol, No UI, API_UI_MAP row: SP9 OpenAICompatibleAdapter, No UI, /gateway/endpoint readiness pill (Ready / Connect a provider / Check connection) + curl test, POST /v1/chat/completions + GET /v1/models (/v1 Chat API), extractApiKey() (Authorization: Bearer first, then x-api-key), Milestone M1 · Walking skeleton (thin end-to-end slice), SP12 — routing: chat lane + Fastify raw streaming, backpressure, cancellation (+1 more)

### Community 29 - "Upstream error results and stream mode"
Cohesion: 0.28
Nodes (9): fallback.upstream-error-result, routing.stream-mode-decision, Finding: 9router 0.5.55 errors carry only { message } with its node id and the raw upstream body, Finding: omitted stream on 9router 0.5.55 → JSON body sent as text/event-stream + bare [DONE] (unparsable), Finding: 9router adds 2000 tokens to reported prompt/total usage (addBufferToUsage) — SUSPECTED_BUG, tools/parity/src/scenarios.mjs DEVIATIONS — intentional differences from 9router, each with entry, label, reason, tools/parity/tapes — 11 tapes from 9router 0.5.55 (JSON, stream, tool calls, omitted stream, 400/401/429/500, cut stream), Rule: an omitted stream flag means non-streaming (JSON) (+1 more)

### Community 30 - "Login lockout and its errors"
Cohesion: 0.46
Nodes (8): identity.password-login-lockout, UI error code: INVALID_CREDENTIALS (401), UI error code: RATE_LIMITED (429), UI error code: SETUP_REQUIRED (409), useLogin (features/settings/api.ts), POST /api/auth/login, /login → Login, Login lockout: 5 failures → 30 s / 2 min / 10 min / 30 min, capped at 10,000 clients

### Community 31 - "Ollama adapter and ollama-local (SP14d)"
Cohesion: 0.32
Nodes (8): connection.ollama-local-host, translator.ollama-to-openai-response, translator.openai-to-ollama-request, API_UI_MAP row: SP14d Ollama adapter and ollama-local connections, User decision 2026-09-26: SP14d corrects the ollama request drops and the stream error/cut-off handling; gemini deferred, OllamaAdapter — CIP <-> /api/chat JSON and NDJSON (options, format, think; error lines and cut-offs fail), Ollama provider contract (M2 SP14d), SP14d — Ollama adapter; ollama-local host and optional key; STT reclassified (52 connectable)

### Community 32 - "Project map, handoff, and wiring rule"
Cohesion: 0.36
Nodes (8): docs/PROJECT_MAP.md (generated U-project ownership map), Rule: an API is done only when its UI screen is wired in the same SP, Decision: CLAUDE.md requires wiring the screen in the same SP as its API, Decision (user): build the Stitch UI before connecting application logic, UI ownership handoff (docs/design/UI_HANDOFF.md), Claude's integration boundary (keep shell/screens markup, add feature api.ts hooks), UI_READY — visual layout implemented with demo data only, ?uiState=loading|empty|error preview parameter

### Community 33 - "Streaming pipeline and bounded SSE"
Cohesion: 0.29
Nodes (7): routing.streaming-pipeline, readSseData() — bounded SSE reader (1 Mi chars per line/event, cancels body), Idle timeout between chunks (AIGATE_STREAM_IDLE_TIMEOUT_MS, default 300 s) → TIMEOUT error event, readJsonLines() — bounded NDJSON reader (1 MiB per line, blank lines skipped), Deferred: streaming idle timeout (gap between chunks) with SP12, Failure: body larger than maxBytes in readBoundedText, readBoundedText() (bounded body reader, default 4 MiB)

### Community 34 - "Partial stream failure"
Cohesion: 0.53
Nodes (6): fallback.partial-stream-failure, Truncated stream or error event → PROVIDER_UNAVAILABLE with details.partial, Stream headers only after the first chunk: earlier failures are real JSON statuses, Golden scenario: partial stream failure, OpenAIChatStreamEncoder — StreamChunk → OpenAI SSE; fail() = error event, no [DONE], Usage chunk after the finish chunk, only with stream_options.include_usage

### Community 35 - "Code quality rules"
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
- **Why does `Bounded context: routing (core)` connect `Credential test, provider screens, and gap register` to `Usage, overview, console and integration screens`, `Discovery outputs and behavioral spec sections`, `Retry budget and error classification`, `API key generation and endpoint lanes`, `Machine identity, general settings, audit findings`, `Settings storage and protected keys`, `Vertex and Google Cloud credentials (SP14f)`, `Request translation and format detection`, `API to UI map`, `Endpoint readiness and OpenAI Chat protocol`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **Why does `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` connect `Error classification and non-streaming answers` to `Streaming pipeline and bounded SSE`, `Partial stream failure`, `Retry budget and error classification`, `Credential test, provider screens, and gap register`, `Transport, proxy chain, and upstream errors`, `Custom provider nodes (OpenAI/Anthropic, apiType)`, `Vertex and Google Cloud credentials (SP14f)`, `Chat lane routing and model resolution`, `Catalog API and adapter headers`, `Anthropic adapter and Anthropic-compatible nodes`, `Per-connection data: Azure, Cloudflare, ClinePass (SP14g)`, `Stream-only providers and CodeBuddy quirks`, `Registry build and extracted catalog`, `OpenAI Responses adapter (SP14c)`, `Gemini adapter (SP14e)`, `Ollama adapter and ollama-local (SP14d)`?**
  _High betweenness centrality (0.113) - this node is a cross-community bridge._