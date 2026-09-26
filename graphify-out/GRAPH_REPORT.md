# Graph Report - docs  (2026-09-26)

## Corpus Check
- 28 files · ~60,701 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 732 nodes · 1908 edges · 31 communities
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 261 edges (avg confidence: 0.87)
- Token cost: 574,916 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Settings, usage, overview and traffic screens|Settings, usage, overview and traffic screens]]
- [[_COMMUNITY_Credential test, preview screens, and gap register|Credential test, preview screens, and gap register]]
- [[_COMMUNITY_Discovery outputs and behavioral spec sections|Discovery outputs and behavioral spec sections]]
- [[_COMMUNITY_Provider adapters and matrix entries (Ollama, Responses, Gemini, Vertex)|Provider adapters and matrix entries (Ollama, Responses, Gemini, Vertex)]]
- [[_COMMUNITY_Error taxonomy, parity harness, and governance docs|Error taxonomy, parity harness, and governance docs]]
- [[_COMMUNITY_Custom provider nodes (OpenAIAnthropic, apiType)|Custom provider nodes (OpenAI/Anthropic, apiType)]]
- [[_COMMUNITY_Provider connections CRUD and connection tests|Provider connections CRUD and connection tests]]
- [[_COMMUNITY_API key management and endpoint lanes|API key management and endpoint lanes]]
- [[_COMMUNITY_Settings storage and protected keys|Settings storage and protected keys]]
- [[_COMMUNITY_API keys UI and error codes|API keys UI and error codes]]
- [[_COMMUNITY_Login, lockout, and UI error codes|Login, lockout, and UI error codes]]
- [[_COMMUNITY_Registry build and Anthropic auth headers|Registry build and Anthropic auth headers]]
- [[_COMMUNITY_Request translation and CIP|Request translation and CIP]]
- [[_COMMUNITY_Transport, retry budget, and upstream errors|Transport, retry budget, and upstream errors]]
- [[_COMMUNITY_API to UI map and port rules|API to UI map and port rules]]
- [[_COMMUNITY_Architecture decisions and health|Architecture decisions and health]]
- [[_COMMUNITY_Model capabilities and combos|Model capabilities and combos]]
- [[_COMMUNITY_Chat lane routing and model resolution|Chat lane routing and model resolution]]
- [[_COMMUNITY_Provider catalog API and extracted catalog|Provider catalog API and extracted catalog]]
- [[_COMMUNITY_Error classification and OpenAI-compatible adapter|Error classification and OpenAI-compatible adapter]]
- [[_COMMUNITY_Identity settings and audit findings|Identity settings and audit findings]]
- [[_COMMUNITY_Non-streaming answers and 9router findings|Non-streaming answers and 9router findings]]
- [[_COMMUNITY_Onboarding setup and its errors|Onboarding setup and its errors]]
- [[_COMMUNITY_Streaming, cancellation, and proxy chain|Streaming, cancellation, and proxy chain]]
- [[_COMMUNITY_Endpoint readiness and the v1 lane|Endpoint readiness and the /v1 lane]]
- [[_COMMUNITY_Project map, handoff, and UI ownership|Project map, handoff, and UI ownership]]
- [[_COMMUNITY_Partial stream failure and stream encoder|Partial stream failure and stream encoder]]
- [[_COMMUNITY_Tracing protocol and business requirements|Tracing protocol and business requirements]]
- [[_COMMUNITY_Lint rules and bounded retry helper|Lint rules and bounded retry helper]]
- [[_COMMUNITY_Skills and SP0 lint suite|Skills and SP0 lint suite]]
- [[_COMMUNITY_Code quality rules|Code quality rules]]

## God Nodes (most connected - your core abstractions)
1. `Identity and API keys contract (M1 SP6)` - 37 edges
2. `Bounded context: routing (core)` - 35 edges
3. `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` - 35 edges
4. `Feature Matrix — mandatory 17-column artifact` - 27 edges
5. `Milestone M-1 · Discovery` - 27 edges
6. `Bounded context: connections` - 26 edges
7. `The 23 feature groups required by behavioral.md §5` - 26 edges
8. `SP6 — identity + apikeys (password login + key validation only)` - 25 edges
9. `ChatLane (modules/routing/infrastructure/chat-lane.ts)` - 25 edges
10. `shared/errors.ts toProblem() — the one code-to-message table` - 24 edges

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
- **Ollama family: adapter, NDJSON reader, per-connection host and optional key, connections UI** — ollama_adapter, read_json_lines, connection_base_url, screen_connections_ollama_host, create_adapter [EXTRACTED 1.00]
- **Gemini family: adapter, schema cleaner, signature cache, CIP image chunk and finish override** — gemini_adapter, gemini_schema_cleaner, gemini_signature_cache, cip_image_delta_finish_override, create_adapter [EXTRACTED 1.00]
- **Vertex family: Google Cloud auth, Vertex and partner adapters, JSON credential connections and field** — google_auth, vertex_adapter, vertex_partner_adapter, json_credential_connections, screen_connections_google_key [EXTRACTED 1.00]

## Communities (31 total, 0 thin omitted)

### Community 0 - "Settings, usage, overview and traffic screens"
Cohesion: 0.06
Nodes (90): settings.outbound-proxy-live-apply, settings.proxy-test-outbound-probe, usage.write-not-synchronous, GET /overview/summary, SSE /events/requests, /traffic/console → Console (Developer mode only), /integrations/* → CliTools, CliToolDetail, Skills, Mcp, /network/* → ProxyPools, DeployWizard, Tunnel, Mitm (+82 more)

### Community 1 - "Credential test, preview screens, and gap register"
Cohesion: 0.06
Nodes (81): validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, /providers/media* → MediaProviders, /providers/quota → Quota; custom provider form; multi-account, /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver, docs/discovery/gaps.md (Gap register), §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra), §9 Build an explicit domain model (Provider, Quota, RoutingPolicy…), §5 Feature discovery — inventory every group, do not trust the UI menu (+73 more)

### Community 2 - "Discovery outputs and behavioral spec sections"
Cohesion: 0.05
Nodes (62): docs/capabilities.md (GENERATED capability specification), docs/discovery/coverage.md, docs/discovery/inventory.json, §30 The 12 pre-implementation questions, §3 The 20 behavioral questions (trigger…edge cases), §8 Business rule beats old implementation, §2 Core principles — never port, rename, or translate 9router line by line, §29 Definition of Done — 13 checklist items, no self-declared DONE (+54 more)

### Community 3 - "Provider adapters and matrix entries (Ollama, Responses, Gemini, Vertex)"
Cohesion: 0.06
Nodes (59): connection.ollama-local-host, connection.vertex-credential-test, provider.qoder-agent-transport (traced, not ported), provider.vertex-google-auth, routing.vertex-endpoints, routing.responses-non-stream-answer, translator.claude-to-openai-response, translator.gemini-to-openai-response (+51 more)

### Community 4 - "Error taxonomy, parity harness, and governance docs"
Cohesion: 0.08
Nodes (46): Status → ErrorCode by status + error.code/type only (never message text), API_UI_MAP row: M0 SP3 parity harness, No UI, Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Error taxonomy (8 ErrorCodes), Stated limits of tape-based parity, Parity verification — 3 tiers, Recording proxy + 4-part tape (+38 more)

### Community 5 - "Custom provider nodes (OpenAI/Anthropic, apiType)"
Cohesion: 0.09
Nodes (37): connection.anthropic-compatible-node, connection.provider-node-api-type, connection.provider-node-create-list, connection.provider-node-repo-storage, connection.provider-node-update-delete, connection.provider-node-validate-partial-ssrf (stays traced: no validate route), routing.forced-stream-json-collapse, provider.codebuddy-request-quirks (+29 more)

### Community 6 - "Provider connections CRUD and connection tests"
Cohesion: 0.09
Nodes (36): catalog.connection-detail-crud, catalog.connection-listing, connection.client-listing-sanitized, connection.test-single-connection, connection.create-dedup-and-priority-assignment, connection.delete-and-reorder, connection.storage-shape-json-blob, GET /api/providers/:id (chatUrl + models; 404 NOT_FOUND) (+28 more)

### Community 7 - "API key management and endpoint lanes"
Cohesion: 0.11
Nodes (27): apikey.delete-key, apikey.legacy-format-unenforced, apikey.list-keys, apikey.update-key-status, apikey.validate-lookup, endpoint.rewrite-lanes, identity.auth-status-disclosure, identity.machine-id-derivation (+19 more)

### Community 8 - "Settings storage and protected keys"
Cohesion: 0.17
Nodes (26): settings.combo-rotation-reset, settings.database-export-import, settings.defaults-and-merge, settings.get-secret-stripping, settings.hot-path-read-no-cache, settings.patch-protected-keys, GET /api/settings, usePatchSettings (features/settings/api.ts) (+18 more)

### Community 9 - "API keys UI and error codes"
Cohesion: 0.18
Nodes (23): apikey.generate-key, endpoint.enforce-require-api-key, DELETE /api/keys/:id, UI error code: LIMIT_REACHED (409), UI error code: NOT_FOUND (404), UI error code: UNAUTHENTICATED (401), GET /api/keys, useApiKeys (features/gateway/api.ts) (+15 more)

### Community 10 - "Login, lockout, and UI error codes"
Cohesion: 0.15
Nodes (22): identity.password-login-lockout, UI error code: BAD_RESPONSE, UI error code: HTTP_5xx, UI error code: INVALID_CREDENTIALS (401), UI error code: NETWORK_ERROR, UI error code: any other code (fallback), UI error code: RATE_LIMITED (429), UI error code: SETUP_REQUIRED (409) (+14 more)

### Community 11 - "Registry build and Anthropic auth headers"
Cohesion: 0.18
Nodes (18): catalog.registry-build, catalog.registry-entry-shape, provider.anthropic-auth-and-headers, Adapter: catalog headers first, key last; raw or Bearer scheme; chatUrl/modelsUrl called directly, API_UI_MAP row: M0 SP4 tools/extract + CATALOG, No UI yet (SP13 serves /providers), builtinRegistry built from CATALOG (41 connectable providers), apps/server/test/catalog.test.mjs (catalog API) + chat-lane resolution tests, CatalogController — GET /api/providers, GET /api/providers/:id (+10 more)

### Community 12 - "Request translation and CIP"
Cohesion: 0.16
Nodes (18): routing.request-translation, routing.source-format-detection, translator.pivot-loss, translator.tool-id-normalization, Canonical Internal Protocol (CIP), vendorExtensions — typed carry-through field, src/json.ts — shared JSON narrowing (isRecord, record, text, list, parseJson), Feature group: Translation / language functionality (+10 more)

### Community 13 - "Transport, retry budget, and upstream errors"
Cohesion: 0.15
Nodes (17): fallback.executor-retry-budget, transport.test.mjs: adapter streams end to end over DirectTransport, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, ErrorCode: PROVIDER_UNAVAILABLE, DirectTransport (direct branch implementation), Failure: body larger than maxBytes in readBoundedText, Upstream answers 4xx or 5xx, Failure: malformed URL or non-https (http only to localhost/127.0.0.1/[::1]) (+9 more)

### Community 14 - "API to UI map and port rules"
Cohesion: 0.20
Nodes (17): API ↔ UI map (docs/design/API_UI_MAP.md), API_UI_MAP row: SP7 packages/engine, No UI, API_UI_MAP row: SP8 transport, No UI, API_UI_MAP row: SP9 OpenAICompatibleAdapter, No UI, Rule: an SP with no HTTP API records "No UI" in its row, Port law — a port exists only with a real second implementation or a mandatory I/O fake boundary, Milestone M1 · Walking skeleton (thin end-to-end slice), AIProviderPort (+9 more)

### Community 15 - "Architecture decisions and health"
Cohesion: 0.18
Nodes (15): GET /health, 9router as Behavioral Source of Truth (not a template to port), Feature-based frontend structure with import boundaries, Hexagonal architecture, granularity = bounded context, Monorepo layout (apps/server, apps/web, apps/cli, packages/engine, contracts, database, tools), Open decisions not settled by this spec, AIGate Design Spec (2026-09-22), Decision 3 (user, 2026-09-25): sessions stored in the database, not a JWT (+7 more)

### Community 16 - "Model capabilities and combos"
Cohesion: 0.26
Nodes (14): catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, combo.detect-required-capabilities, assertModelSupports() — MODEL_UNAVAILABLE / INVALID_REQUEST, Engine contract (M1 SP7), defineRegistry() / builtinRegistry (single openai entry, 4 chat models) (+6 more)

### Community 17 - "Chat lane routing and model resolution"
Cohesion: 0.19
Nodes (14): catalog.model-listing-live-override, fallback.accounts-exhausted-response, routing.client-disconnect-propagation, routing.lane-entry-routes, routing.model-resolution, routing.request-preflight, Chat lane contract (M1 SP12), Keyless mode serves this machine only (loopback socket, Host, Origin) → 403 api_key_required (+6 more)

### Community 18 - "Provider catalog API and extracted catalog"
Cohesion: 0.16
Nodes (14): ListedModel { id, descriptor? } — getModels never invents limits (≤1000 ids), GET /api/providers (all 121, connectable + reason), API_UI_MAP row: SP14a AnthropicAdapter — no new screen; /providers pills follow connectable, /providers → LlmProviders (catalog from GET /api/providers; Connected / Coming later pills), CATALOG — providers.generated.ts (121 providers, 935 models; never hand-edited), CatalogProvider / CatalogModel / validateCatalog (packages/engine/src/catalog/schema.ts), tools/extract (deleted in SP13b; restorable from git d2783c1) — wrote the catalog from 9router, tools/extract verify (deleted in SP13b with the tool) (+6 more)

### Community 19 - "Error classification and OpenAI-compatible adapter"
Cohesion: 0.21
Nodes (13): fallback.error-classification, fallback.upstream-error-result, routing.default-executor-openai-fallback, routing.streaming-pipeline, Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O, OpenAICompatibleAdapter (AIProviderPort for openai-compatible), readSseData() — bounded SSE reader (1 Mi chars per line/event, cancels body), packages/engine/test/openai-adapter.test.mjs (15 tests, fake transport, SSE split every 3 bytes; 16 mutations caught) (+5 more)

### Community 20 - "Identity settings and audit findings"
Cohesion: 0.38
Nodes (11): /settings/auth OIDC and SAML tabs, Audit finding: settings-auth regenerated as settings-auth-v2, Audit finding: login-callback / deploy-wizard / authflow-modals are showcases, not routes, Audit FAIL: sidebar not identical across screens, Bounded context: identity, Nav group: Settings (General · Auth & Access · Developer), Auth — /login, /callback, OAuth callback (/callback) (+3 more)

### Community 21 - "Non-streaming answers and 9router findings"
Cohesion: 0.24
Nodes (10): routing.non-streaming-response, routing.stream-mode-decision, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), Finding: 9router 0.5.55 errors carry only { message } with its node id and the raw upstream body, Finding: omitted stream on 9router 0.5.55 → JSON body sent as text/event-stream + bare [DONE] (unparsable), Finding: 9router adds 2000 tokens to reported prompt/total usage (addBufferToUsage) — SUSPECTED_BUG, tools/parity/src/scenarios.mjs DEVIATIONS — intentional differences from 9router, each with entry, label, reason, tools/parity/tapes — 11 tapes from 9router 0.5.55 (JSON, stream, tool calls, omitted stream, 400/401/429/500, cut stream) (+2 more)

### Community 22 - "Onboarding setup and its errors"
Cohesion: 0.33
Nodes (10): UI error code: ALREADY_SET_UP (409), UI error code: INVALID_REQUEST (400), UI error code: NOT_LOCAL (403), useSetup (features/settings/api.ts), POST /api/auth/setup, /welcome → Onboarding (one step), AIGATE_INITIAL_PASSWORD (first password at boot), Decision 2 (user, 2026-09-25): first password set from the local machine; no default password (+2 more)

### Community 23 - "Streaming, cancellation, and proxy chain"
Cohesion: 0.25
Nodes (9): transport.proxy-priority-chain, §18 Streaming is first-class (TTFT, cancellation, backpressure), Backpressure: a false write() waits for drain; the upstream read pauses with it, One ExecCtx signal: client disconnect + 600 s budget (TIMEOUT) + idle watchdog, ExecCtx (one shared client-cancel + deadline signal), Golden scenario: client cancellation, Failure: caller ctx.signal aborts (client left, budget spent), HttpRequest (requires timeoutMs) (+1 more)

### Community 24 - "Endpoint readiness and the /v1 lane"
Cohesion: 0.36
Nodes (8): endpoint.extract-header-order, API_UI_MAP row: SP10 OpenAI Chat protocol, No UI, /gateway/endpoint readiness pill (Ready / Connect a provider / Check connection) + curl test, POST /v1/chat/completions + GET /v1/models (/v1 Chat API), Idle timeout between chunks (AIGATE_STREAM_IDLE_TIMEOUT_MS, default 300 s) → TIMEOUT error event, extractApiKey() (Authorization: Bearer first, then x-api-key), SP12 — routing: chat lane + Fastify raw streaming, backpressure, cancellation, Deferred: streaming idle timeout (gap between chunks) with SP12

### Community 25 - "Project map, handoff, and UI ownership"
Cohesion: 0.39
Nodes (8): docs/PROJECT_MAP.md (generated U-project ownership map), Rule: an API is done only when its UI screen is wired in the same SP, Decision: CLAUDE.md requires wiring the screen in the same SP as its API, AIGate progress handoff (docs/PROGRESS_HANDOFF.md), Decision (user): build the Stitch UI before connecting application logic, UI ownership handoff (docs/design/UI_HANDOFF.md), Claude's integration boundary (keep shell/screens markup, add feature api.ts hooks), UI_READY — visual layout implemented with demo data only

### Community 26 - "Partial stream failure and stream encoder"
Cohesion: 0.53
Nodes (6): fallback.partial-stream-failure, Truncated stream or error event → PROVIDER_UNAVAILABLE with details.partial, Stream headers only after the first chunk: earlier failures are real JSON statuses, Golden scenario: partial stream failure, OpenAIChatStreamEncoder — StreamChunk → OpenAI SSE; fail() = error event, no [DONE], Usage chunk after the finish chunk, only with stream_options.include_usage

### Community 27 - "Tracing protocol and business requirements"
Cohesion: 0.33
Nodes (6): §27 Separate BUSINESS REQUIREMENT from IMPLEMENTATION ACCIDENT, §7 Trace the behavior — never conclude from a function name, The Tracing Protocol (6 steps, applied by Tasks 6–18), Feature group: Endpoint & API Key, IMPLEMENTATION_ACCIDENT label, Task 6 — Trace Endpoint & API Key, Settings

### Community 28 - "Lint rules and bounded retry helper"
Cohesion: 0.53
Nodes (6): withRetry() — bounded retry helper (≤10 attempts, capped backoff, abortable), tools/lint/check.test.mjs (lint:check 13/13), Lint rule aigate/fetch-through-transport, Lint rule aigate/fetch-timeout (accepts AbortSignal.any([..., AbortSignal.timeout(n)])), Lint rule aigate/retry-through-helper, SP0.1 — Mechanical lint/CI suite (§11.2)

### Community 29 - "Skills and SP0 lint suite"
Cohesion: 0.40
Nodes (5): Split: machines block mechanics, skills teach judgement, Iron law: no skill without a failing test first (RED → GREEN → REFACTOR), UI performance constraints, Skill: writing-lean-bounded-code, SP0 — 2 skills + mechanical lint suite

### Community 30 - "Code quality rules"
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
- **22 isolated node(s):** `ErrorCode: INTERNAL_ERROR`, `02-providers-auth.yaml`, `03-accounts-multiaccount.yaml`, `05-request-routing-fallback.yaml`, `07-token-saver.yaml` (+17 more)
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
- **Why does `Bounded context: routing (core)` connect `Credential test, preview screens, and gap register` to `Settings, usage, overview and traffic screens`, `Discovery outputs and behavioral spec sections`, `Provider adapters and matrix entries (Ollama, Responses, Gemini, Vertex)`, `Error taxonomy, parity harness, and governance docs`, `API key management and endpoint lanes`, `Settings storage and protected keys`, `API keys UI and error codes`, `Request translation and CIP`, `API to UI map and port rules`, `Endpoint readiness and the /v1 lane`, `Tracing protocol and business requirements`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **Why does `Task board (PROGRESS_HANDOFF)` connect `Registry build and Anthropic auth headers` to `Credential test, preview screens, and gap register`, `Discovery outputs and behavioral spec sections`, `Error taxonomy, parity harness, and governance docs`, `Settings storage and protected keys`, `API keys UI and error codes`, `Request translation and CIP`, `API to UI map and port rules`, `Architecture decisions and health`, `Endpoint readiness and the /v1 lane`, `Project map, handoff, and UI ownership`, `Skills and SP0 lint suite`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._