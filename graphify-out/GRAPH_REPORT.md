# Graph Report - docs  (2026-09-27)

## Corpus Check
- 31 files · ~65,425 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 765 nodes · 1980 edges · 44 communities
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 261 edges (avg confidence: 0.87)
- Token cost: 574,916 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_API keys, identity and dashboard auth|API keys, identity and dashboard auth]]
- [[_COMMUNITY_Dashboard screens and overview APIs|Dashboard screens and overview APIs]]
- [[_COMMUNITY_Endpoint lanes, combos and integrations|Endpoint lanes, combos and integrations]]
- [[_COMMUNITY_Provider connections and per-connection data|Provider connections and per-connection data]]
- [[_COMMUNITY_Error taxonomy, parity harness and branding|Error taxonomy, parity harness and branding]]
- [[_COMMUNITY_Vertex, Google auth and qoder decision|Vertex, Google auth and qoder decision]]
- [[_COMMUNITY_Outbound proxy and network settings|Outbound proxy and network settings]]
- [[_COMMUNITY_Governance, health and definition of done|Governance, health and definition of done]]
- [[_COMMUNITY_Model listing, fallback and client disconnect|Model listing, fallback and client disconnect]]
- [[_COMMUNITY_Retry budget and transport|Retry budget and transport]]
- [[_COMMUNITY_Registry build and Anthropic provider auth|Registry build and Anthropic provider auth]]
- [[_COMMUNITY_Upstream error classification|Upstream error classification]]
- [[_COMMUNITY_Custom provider nodes|Custom provider nodes]]
- [[_COMMUNITY_Capability resolution|Capability resolution]]
- [[_COMMUNITY_Request translation and pivot loss|Request translation and pivot loss]]
- [[_COMMUNITY_API to UI map rows|API to UI map rows]]
- [[_COMMUNITY_Responses API translation|Responses API translation]]
- [[_COMMUNITY_Generated discovery outputs|Generated discovery outputs]]
- [[_COMMUNITY_Spec pre-implementation questions and golden scenarios|Spec pre-implementation questions and golden scenarios]]
- [[_COMMUNITY_Anthropic Messages client protocol (SP15)|Anthropic Messages client protocol (SP15)]]
- [[_COMMUNITY_Stream mode and OpenAI chat mapping|Stream mode and OpenAI chat mapping]]
- [[_COMMUNITY_Anthropic adapter translation|Anthropic adapter translation]]
- [[_COMMUNITY_Provider node API routes|Provider node API routes]]
- [[_COMMUNITY_Command Code adapter|Command Code adapter]]
- [[_COMMUNITY_Stream-only providers and JSON collapse|Stream-only providers and JSON collapse]]
- [[_COMMUNITY_Provider catalog API|Provider catalog API]]
- [[_COMMUNITY_Proxy chain, idle timeout and exec context|Proxy chain, idle timeout and exec context]]
- [[_COMMUNITY_Project map and APIUI rule|Project map and API/UI rule]]
- [[_COMMUNITY_Discovery evidence and inventory counts|Discovery evidence and inventory counts]]
- [[_COMMUNITY_Anthropic-compatible nodes|Anthropic-compatible nodes]]
- [[_COMMUNITY_Ollama adapter|Ollama adapter]]
- [[_COMMUNITY_Registry extract and v1 resolution|Registry extract and /v1 resolution]]
- [[_COMMUNITY_Spec behavioral questions and per-feature process|Spec behavioral questions and per-feature process]]
- [[_COMMUNITY_Latency and performance constraints|Latency and performance constraints]]
- [[_COMMUNITY_Header extraction and OpenAI chat protocol|Header extraction and OpenAI chat protocol]]
- [[_COMMUNITY_Partial stream failure|Partial stream failure]]
- [[_COMMUNITY_Business rules and fallback policy|Business rules and fallback policy]]
- [[_COMMUNITY_withRetry and lint rules|withRetry and lint rules]]
- [[_COMMUNITY_Milestone M-1 discovery tasks|Milestone M-1 discovery tasks]]
- [[_COMMUNITY_Ollama local host connection|Ollama local host connection]]
- [[_COMMUNITY_Usage and quota tracing|Usage and quota tracing]]
- [[_COMMUNITY_Skills and UI performance|Skills and UI performance]]
- [[_COMMUNITY_Lean code rules|Lean code rules]]
- [[_COMMUNITY_Core porting principles|Core porting principles]]

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
10. `shared/errors.ts toProblem() — the one code-to-message table` - 24 edges

## Surprising Connections (you probably didn't know these)
- `TransportModule (injects DirectTransport under HTTP_TRANSPORT)` --implements--> `Bounded context: transport`  [INFERRED]
  docs/contracts/transport.md → docs/superpowers/specs/2026-09-22-aigate-design.md
- `ErrorCode: TIMEOUT` --conceptually_related_to--> `UI error code: TIMEOUT`  [AMBIGUOUS]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/API_UI_MAP.md
- `MITM — /network/mitm` --semantically_similar_to--> `Settings · Developer (/settings/developer)`  [INFERRED] [semantically similar]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/stitch-briefs.md
- `Audit finding: routing-fallback merged 4 tabs into one 3886px screen` --references--> `U1 — Shell (router tree, query client, layout, 7-group sidebar, SSE client, error boundary, i18n)`  [INFERRED]
  docs/design/stitch-audit.md → docs/superpowers/specs/2026-09-22-aigate-design.md
- `Final principle — 9router says WHAT, never HOW` --rationale_for--> `docs/capabilities.md (GENERATED capability specification)`  [INFERRED]
  docs/governance/behavioral.md → docs/superpowers/plans/2026-09-22-m1-discovery.md

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

## Communities (44 total, 0 thin omitted)

### Community 0 - "API keys, identity and dashboard auth"
Cohesion: 0.05
Nodes (112): apikey.delete-key, apikey.generate-key, apikey.legacy-format-unenforced, apikey.list-keys, apikey.update-key-status, apikey.validate-lookup, endpoint.enforce-require-api-key, identity.auth-status-disclosure (+104 more)

### Community 1 - "Dashboard screens and overview APIs"
Cohesion: 0.06
Nodes (92): GET /overview/summary, SSE /events/requests, validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, /traffic/console → Console (Developer mode only), /providers/media* → MediaProviders, / → Overview, /providers/quota → Quota; custom provider form; multi-account, /traffic/usage, /traffic/requests* → Usage, Requests, RequestDetail (+84 more)

### Community 2 - "Endpoint lanes, combos and integrations"
Cohesion: 0.08
Nodes (62): endpoint.rewrite-lanes, settings.combo-rotation-reset, /integrations/* → CliTools, CliToolDetail, Skills, Mcp, /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver, Audit finding: routing-fallback merged 4 tabs into one 3886px screen, §5 Feature discovery — inventory every group, do not trust the UI menu, §6 Feature Matrix requirement — nothing is understood until fully traced, §20 No blind fallback — fallback follows error semantics (+54 more)

### Community 3 - "Provider connections and per-connection data"
Cohesion: 0.07
Nodes (48): catalog.connection-detail-crud, catalog.connection-listing, connection.azure-openai-deployment, connection.client-listing-sanitized, connection.cloudflare-account-id, connection.test-single-connection, provider.clinepass-headers-envelope, connection.create-dedup-and-priority-assignment (+40 more)

### Community 4 - "Error taxonomy, parity harness and branding"
Cohesion: 0.08
Nodes (47): Status → ErrorCode by status + error.code/type only (never message text), API_UI_MAP row: M0 SP3 parity harness, No UI, Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Error taxonomy (8 ErrorCodes), Stated limits of tape-based parity, Parity verification — 3 tiers, Recording proxy + 4-part tape (+39 more)

### Community 5 - "Vertex, Google auth and qoder decision"
Cohesion: 0.13
Nodes (26): connection.vertex-credential-test, provider.qoder-agent-transport (traced, not ported), provider.vertex-google-auth, routing.vertex-endpoints, translator.gemini-to-openai-response, translator.openai-to-gemini-request, translator.openai-to-vertex-request, API_UI_MAP row: SP14e Gemini adapter (no new screen; Key rejected on a 400) (+18 more)

### Community 6 - "Outbound proxy and network settings"
Cohesion: 0.20
Nodes (21): settings.outbound-proxy-live-apply, settings.proxy-test-outbound-probe, /network/* → ProxyPools, DeployWizard, Tunnel, Mitm, Audit finding: MITM CA buttons adjacent, type-to-confirm modal missing, Hard constraint: tunnel requires 'Require API key' enabled, Bounded context: transport, Decision: do NOT clone 9Remote, Destructive-action rule: type-to-confirm modal (+13 more)

### Community 7 - "Governance, health and definition of done"
Cohesion: 0.12
Nodes (21): usage.write-not-synchronous, GET /health, 9router as Behavioral Source of Truth (not a template to port), Definition of Done — 13 items, not self-awarded, Feature-based frontend structure with import boundaries, Hexagonal architecture, granularity = bounded context, IMPLEMENTATION_ACCIDENT — debt not inherited from 9router, Monorepo layout (apps/server, apps/web, apps/cli, packages/engine, contracts, database, tools) (+13 more)

### Community 8 - "Model listing, fallback and client disconnect"
Cohesion: 0.16
Nodes (18): catalog.model-listing-live-override, fallback.accounts-exhausted-response, routing.client-disconnect-propagation, routing.lane-entry-routes, routing.model-resolution, routing.request-preflight, §18 Streaming is first-class (TTFT, cancellation, backpressure), Backpressure: a false write() waits for drain; the upstream read pauses with it (+10 more)

### Community 9 - "Retry budget and transport"
Cohesion: 0.15
Nodes (17): fallback.executor-retry-budget, transport.test.mjs: adapter streams end to end over DirectTransport, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, ErrorCode: PROVIDER_UNAVAILABLE, DirectTransport (direct branch implementation), Failure: body larger than maxBytes in readBoundedText, Upstream answers 4xx or 5xx, Failure: malformed URL or non-https (http only to localhost/127.0.0.1/[::1]) (+9 more)

### Community 10 - "Registry build and Anthropic provider auth"
Cohesion: 0.17
Nodes (16): catalog.registry-build, catalog.registry-entry-shape, provider.anthropic-auth-and-headers, Adapter: catalog headers first, key last; raw or Bearer scheme; chatUrl/modelsUrl called directly, ListedModel { id, descriptor? } — getModels never invents limits (≤1000 ids), builtinRegistry built from CATALOG (41 connectable providers), CATALOG — providers.generated.ts (121 providers, 935 models; never hand-edited), CatalogProvider / CatalogModel / validateCatalog (packages/engine/src/catalog/schema.ts) (+8 more)

### Community 11 - "Upstream error classification"
Cohesion: 0.16
Nodes (16): fallback.error-classification, fallback.upstream-error-result, routing.default-executor-openai-fallback, routing.streaming-pipeline, Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O, OpenAICompatibleAdapter (AIProviderPort for openai-compatible), readSseData() — bounded SSE reader (1 Mi chars per line/event, cancels body), packages/engine/test/openai-adapter.test.mjs (15 tests, fake transport, SSE split every 3 bytes; 16 mutations caught) (+8 more)

### Community 12 - "Custom provider nodes"
Cohesion: 0.22
Nodes (14): connection.provider-node-api-type, connection.provider-node-create-list, connection.provider-node-repo-storage, connection.provider-node-update-delete, connection.provider-node-validate-partial-ssrf (stays traced: no validate route), /v1: <prefix>/<model> reaches a custom provider after built-in ids, aliases, and catalog prefixes, Custom providers contract (M2 SP13b), provider-node domain rules — prefix token, base URL normalize (strip /chat/completions), https or loopback http (+6 more)

### Community 13 - "Capability resolution"
Cohesion: 0.26
Nodes (14): catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, combo.detect-required-capabilities, assertModelSupports() — MODEL_UNAVAILABLE / INVALID_REQUEST, Engine contract (M1 SP7), defineRegistry() / builtinRegistry (single openai entry, 4 chat models) (+6 more)

### Community 14 - "Request translation and pivot loss"
Cohesion: 0.23
Nodes (13): routing.request-translation, routing.source-format-detection, translator.pivot-loss, translator.tool-id-normalization, Canonical Internal Protocol (CIP), vendorExtensions — typed carry-through field, toOpenAIChatCompletion() — CanonicalResponse → chat.completion JSON, OpenAI Chat Completions protocol adapter contract (M1 SP10) (+5 more)

### Community 15 - "API to UI map rows"
Cohesion: 0.26
Nodes (13): API ↔ UI map (docs/design/API_UI_MAP.md), API_UI_MAP row: SP7 packages/engine, No UI, API_UI_MAP row: SP8 transport, No UI, API_UI_MAP row: SP9 OpenAICompatibleAdapter, No UI, Failed mutations re-read the server; submit disabled while pending, Rule: an SP with no HTTP API records "No UI" in its row, HttpTransportPort, Next step: M1 SP8 transport (HttpTransportPort, direct + timeout, no UI) (+5 more)

### Community 16 - "Responses API translation"
Cohesion: 0.23
Nodes (12): routing.responses-non-stream-answer, translator.openai-to-responses-request, translator.responses-to-openai-stream, API_UI_MAP row: SP14c Responses adapter (no new screen for perplexity-agent) and the API select on /providers/new, User decision 2026-09-26: SP14c corrects the non-stream answer, keeps 9router request drops and stream error handling, OpenAIResponsesAdapter — CIP <-> Responses API (extends OpenAICompatibleAdapter; 9router request and stream, corrected non-stream), OpenAI Responses provider contract (M2 SP14c), Non-streaming Responses answer: stream false, output[] read (reasoning, text, refusal, tool calls, incomplete, failed, usage) (+4 more)

### Community 17 - "Generated discovery outputs"
Cohesion: 0.20
Nodes (12): docs/capabilities.md (GENERATED capability specification), docs/discovery/coverage.md, docs/discovery/gaps.md (Gap register), docs/discovery/inventory.json, §14 Feature parity is not code parity, §27 Separate BUSINESS REQUIREMENT from IMPLEMENTATION ACCIDENT, IMPLEMENTATION_ACCIDENT label, 13-console-remote.yaml (+4 more)

### Community 18 - "Spec pre-implementation questions and golden scenarios"
Cohesion: 0.24
Nodes (12): §30 The 12 pre-implementation questions, §25 Golden scenarios (13 critical flows), Phase model A→F (Discovery, Behavior Extraction, Contract, Design, Implementation, Parity Verification), §24 Characterization/contract tests prove old ≈ new at contract level, Constraint — no Phase C contracts during discovery, Constraint — no AIGate product code in M-1 (only tools/discovery and docs), Phase A — Discovery, Phase B — Behavior Extraction (+4 more)

### Community 19 - "Anthropic Messages client protocol (SP15)"
Cohesion: 0.27
Nodes (10): routing.count-tokens-estimate, translator.claude-client-request, translator.openai-to-claude-client-response, protocols/anthropic-messages.ts — parse to CIP, anthropicRequestFor (passthrough for Anthropic, claude→openai rules otherwise), message, SSE encoder, count_tokens, API_UI_MAP row: SP15 Anthropic Messages client protocol, User decision 2026-09-27: SP15 Anthropic first; OpenAI-shaped errors and 9router non-stream/stream-default kept; real usage, live tool args, signature_delta corrected, Endpoint screen: OpenAI and Anthropic chips, Claude Code and Anthropic curl copy fields, SP15 tests: engine anthropic-protocol.test.mjs (7), server messages-lane.test.mjs; 52 mutations, 1 equivalent (+2 more)

### Community 20 - "Stream mode and OpenAI chat mapping"
Cohesion: 0.24
Nodes (10): routing.non-streaming-response, routing.stream-mode-decision, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), Finding: 9router 0.5.55 errors carry only { message } with its node id and the raw upstream body, Finding: omitted stream on 9router 0.5.55 → JSON body sent as text/event-stream + bare [DONE] (unparsable), Finding: 9router adds 2000 tokens to reported prompt/total usage (addBufferToUsage) — SUSPECTED_BUG, tools/parity/src/scenarios.mjs DEVIATIONS — intentional differences from 9router, each with entry, label, reason, tools/parity/tapes — 11 tapes from 9router 0.5.55 (JSON, stream, tool calls, omitted stream, 400/401/429/500, cut stream) (+2 more)

### Community 21 - "Anthropic adapter translation"
Cohesion: 0.36
Nodes (10): translator.claude-to-openai-response, translator.openai-to-claude-request, AnthropicAdapter — CIP <-> Messages (max_tokens rules, thinking budgets, tool_use, SSE events), packages/engine/test/anthropic-adapter.test.mjs (10) + apps/server/test/anthropic-lane.test.mjs (4); 23 mutations caught, Deviations not ported: stop/top_p kept, none stays none, no Claude Code line, stream errors fail, same stop/usage mapping, 403 invalid, Anthropic node descriptor: <base>/messages, x-api-key, Bearer for third-party hosts, anthropicNode { official }, createAdapter(provider, transport) — adapter chosen by protocol family, HttpProviderAdapter — shared auth headers, retry before first byte, error classification, redaction (+2 more)

### Community 22 - "Provider node API routes"
Cohesion: 0.29
Nodes (10): DELETE /api/provider-nodes/:id (cascades the connection), GET /api/provider-nodes, PATCH /api/provider-nodes/:id, POST /api/provider-nodes, UI error code: NODE_LIMIT (409), UI error code: PREFIX_RESERVED (409), UI error code: PREFIX_TAKEN (409), useProviderNodes / useCreateNode / useUpdateNode / useDeleteNode (features/providers/api.ts) (+2 more)

### Community 23 - "Command Code adapter"
Cohesion: 0.36
Nodes (9): connection.commandcode-key-test, translator.commandcode-to-openai-response, translator.openai-to-commandcode-request, API_UI_MAP row: SP14h Command Code adapter (no new screen), CommandCodeAdapter — envelope, NDJSON events via readJsonLines, peek with in-band error classification and 5xx retries, collapse for non-streaming clients, ping test, User decision 2026-09-27: SP14h keeps 9router request drops/defaults and stream error/end/finish/usage behavior; corrects the connection test; URL images refused and workingDir neutral for security, Command Code provider contract (M2 SP14h), SP14h tests: engine commandcode-adapter.test.mjs (8), server commandcode-lane.test.mjs; 39 mutations caught (+1 more)

### Community 24 - "Stream-only providers and JSON collapse"
Cohesion: 0.31
Nodes (9): routing.forced-stream-json-collapse, provider.codebuddy-request-quirks, API_UI_MAP row: SP14b stream-only providers (no new screen) and the protocol select on /providers/new, CodeBuddy quirks: reasoningSummary (cn, intl), neutralAgentPrompt (cn) via EXECUTOR_QUIRKS, User decision 2026-09-26: SP14b keeps 9router on every suspected bug asked, User decision 2026-09-26 (second ask): the stream-only collapse buffer is unbounded like 9router, SP14b — Anthropic-compatible custom providers, stream-only providers (49 connectable), OpenAICompatibleAdapter.execute collapse: stream:true upstream, SSE folded into one answer (reasoning dropped with content, cut-off = complete, no size limit) (+1 more)

### Community 25 - "Provider catalog API"
Cohesion: 0.22
Nodes (9): GET /api/providers/:id (chatUrl + models; 404 NOT_FOUND), GET /api/providers (all 121, connectable + reason), API_UI_MAP row: SP14a AnthropicAdapter — no new screen; /providers pills follow connectable, /providers → LlmProviders (catalog from GET /api/providers; Connected / Coming later pills), apps/server/test/catalog.test.mjs (catalog API) + chat-lane resolution tests, CatalogController — GET /api/providers, GET /api/providers/:id, useProvider(id) (features/providers/api.ts), useProviders (features/providers/api.ts) (+1 more)

### Community 26 - "Proxy chain, idle timeout and exec context"
Cohesion: 0.25
Nodes (8): transport.proxy-priority-chain, Idle timeout between chunks (AIGATE_STREAM_IDLE_TIMEOUT_MS, default 300 s) → TIMEOUT error event, ExecCtx (one shared client-cancel + deadline signal), AIProviderPort, Deferred: streaming idle timeout (gap between chunks) with SP12, Failure: caller ctx.signal aborts (client left, budget spent), HttpRequest (requires timeoutMs), Rule: every call states timeoutMs (1 to 600000 ms), bounding headers and body inside ctx.signal

### Community 27 - "Project map and API/UI rule"
Cohesion: 0.39
Nodes (8): docs/PROJECT_MAP.md (generated U-project ownership map), Rule: an API is done only when its UI screen is wired in the same SP, Decision: CLAUDE.md requires wiring the screen in the same SP as its API, AIGate progress handoff (docs/PROGRESS_HANDOFF.md), Decision (user): build the Stitch UI before connecting application logic, UI ownership handoff (docs/design/UI_HANDOFF.md), Claude's integration boundary (keep shell/screens markup, add feature api.ts hooks), UI_READY — visual layout implemented with demo data only

### Community 28 - "Discovery evidence and inventory counts"
Cohesion: 0.46
Nodes (8): Evidence with file:line — traced is a test, not a self-declaration, Fixed inventory counts (154 routes, 28 pages, 123 providers, 29 executors, 48 translators, 11 repos, 14 OAuth routes), cli.ts — validate | inventory | coverage | capabilities, coverage.ts — matrix vs inventory coverage report, gate.test.ts — M-1 exit gate test, inventory.ts — 9router surface scanner, paths.ts — 9router/repo root resolution, validate.ts — matrix + evidence validator

### Community 29 - "Anthropic-compatible nodes"
Cohesion: 0.29
Nodes (7): connection.anthropic-compatible-node, Claude Code anthropic-beta list for claude-* models on an Anthropic node (claude-code flag only on the official host), Anthropic node connection test: POST <base>/v1/messages, claude-3-haiku, only 401/403 invalid (9router), features/providers/node-rules.ts unreachable(): OpenAI-compatible prefixes win, then the oldest, apps/server/test/provider-nodes.test.mjs (5 tests; 15 mutations caught), /providers → Custom providers section (features/providers/custom.tsx): Connect, Edit, Delete, SP14b tests: engine adapter tests (8 new), server provider-nodes (2) + stream-only.test.mjs (3), web node-rules.test.mjs; 34 mutations caught

### Community 30 - "Ollama adapter"
Cohesion: 0.33
Nodes (7): translator.ollama-to-openai-response, translator.openai-to-ollama-request, User decision 2026-09-26: SP14d corrects the ollama request drops and the stream error/cut-off handling; gemini deferred, Fix: HttpProviderAdapter.clean no longer splits messages on an empty key (found by the ollama lane test), OllamaAdapter — CIP <-> /api/chat JSON and NDJSON (options, format, think; error lines and cut-offs fail), PROVIDER_PROTOCOLS: openai-compatible | anthropic; descriptor quirks, SP14d tests: engine ollama-adapter.test.mjs (7), server ollama-lane.test.mjs (3); 28 mutations caught

### Community 31 - "Registry extract and /v1 resolution"
Cohesion: 0.48
Nodes (7): API_UI_MAP row: M0 SP4 tools/extract + CATALOG, No UI yet (SP13 serves /providers), /v1 resolution: provider-or-alias/model; non-connectable prefix → provider_not_supported; bare id → first declaring provider with an active connection, Gap: M0 SP3 (parity harness) and SP4 (tools/extract) never built, Task board (PROGRESS_HANDOFF), registry.provider(idOrAlias) and registry.status(id), SP13 — catalog → runtime registry (41 connectable providers, /api/providers, /providers wired), SP4 — tools/extract: 9router registry data → AIGate schema

### Community 32 - "Spec behavioral questions and per-feature process"
Cohesion: 0.29
Nodes (7): §3 The 20 behavioral questions (trigger…edge cases), §29 Definition of Done — 13 checklist items, no self-declared DONE, §28 Per-feature process: DISCOVER→TRACE→DOCUMENT→…→REVIEW, Feature Matrix entry template (null never "" or "N/A"), parityStatus lifecycle (not-started → traced → contracted → implemented → verified), suspicion block — expected / actual / impact, schema.ts — Zod Feature Matrix entry schema

### Community 33 - "Latency and performance constraints"
Cohesion: 0.29
Nodes (7): §17 Latency — clean architecture must not add hot-path I/O, §16 Do not inherit performance issues; all large workloads bounded, Constraint — every filesystem scan uses fast-glob with an explicit ignore list, Rule 4 — Every workload must be BOUNDED, Rule 11 — Review questions beyond "does it run?" (10x/100x traffic, unbounded work), Rule 5 — Low latency: parallelize independent awaits, only when bounded, Rule 3 — Optimize performance at design time, not micro-optimization

### Community 34 - "Header extraction and OpenAI chat protocol"
Cohesion: 0.53
Nodes (6): endpoint.extract-header-order, API_UI_MAP row: SP10 OpenAI Chat protocol, No UI, /gateway/endpoint readiness pill (Ready / Connect a provider / Check connection) + curl test, POST /v1/chat/completions + GET /v1/models (/v1 Chat API), extractApiKey() (Authorization: Bearer first, then x-api-key), SP12 — routing: chat lane + Fastify raw streaming, backpressure, cancellation

### Community 35 - "Partial stream failure"
Cohesion: 0.53
Nodes (6): fallback.partial-stream-failure, Truncated stream or error event → PROVIDER_UNAVAILABLE with details.partial, Stream headers only after the first chunk: earlier failures are real JSON statuses, Golden scenario: partial stream failure, OpenAIChatStreamEncoder — StreamChunk → OpenAI SSE; fail() = error event, no [DONE], Usage chunk after the finish chunk, only with stream_options.include_usage

### Community 36 - "Business rules and fallback policy"
Cohesion: 0.33
Nodes (6): §8 Business rule beats old implementation, §19 Fallback as explicit policy with classified errors, Canonical error classification codes (8 values), 07-token-saver.yaml, Rule 7 — Error handling: never swallow, keep context and stack, bounded retry, Task 12 — Trace Token Saver

### Community 37 - "withRetry and lint rules"
Cohesion: 0.53
Nodes (6): withRetry() — bounded retry helper (≤10 attempts, capped backoff, abortable), tools/lint/check.test.mjs (lint:check 13/13), Lint rule aigate/fetch-through-transport, Lint rule aigate/fetch-timeout (accepts AbortSignal.any([..., AbortSignal.timeout(n)])), Lint rule aigate/retry-through-helper, SP0.1 — Mechanical lint/CI suite (§11.2)

### Community 38 - "Milestone M-1 discovery tasks"
Cohesion: 0.73
Nodes (6): Milestone M-1 · Discovery, Task 1 — Discovery tooling workspace, Task 2 — Feature Matrix schema and validator, Task 3 — Inventory extractor, Task 4 — Coverage checker, Task 5 — capabilities.md generator and CLI

### Community 39 - "Ollama local host connection"
Cohesion: 0.40
Nodes (5): connection.ollama-local-host, API_UI_MAP row: SP14d Ollama adapter and ollama-local connections, Catalog providers contract (M2 SP13), Ollama provider contract (M2 SP14d), assemblyai and deepgram (speech-to-text only) give the media reason; nanobanana left for SP22

### Community 40 - "Usage and quota tracing"
Cohesion: 0.40
Nodes (5): §21 Quota must be understood fully, not copied from the UI tracker, §22 Usage fields to trace per request (tokens, cost, latency, fallback attempts), 08-usage-quota.yaml, Rule 6 — Database discipline (N+1, pagination, no query in loop), Task 13 — Trace Usage, Quota Tracker

### Community 41 - "Skills and UI performance"
Cohesion: 0.40
Nodes (5): Split: machines block mechanics, skills teach judgement, Iron law: no skill without a failing test first (RED → GREEN → REFACTOR), UI performance constraints, Skill: writing-lean-bounded-code, SP0 — 2 skills + mechanical lint suite

### Community 42 - "Lean code rules"
Cohesion: 0.50
Nodes (4): §15 Code quality — shortest CLEAR implementation, not shortest possible, Rule 1 — Write LEAN code, no over-engineering, Rule 2 — Code must be maintainable, no magic values or hidden side effects, Rule 12 — Priority order: Correctness → Simplicity → Maintainability → Predictable resources → Latency → Throughput → Optimization

### Community 43 - "Core porting principles"
Cohesion: 0.50
Nodes (4): §2 Core principles — never port, rename, or translate 9router line by line, Final principle — 9router says WHAT, never HOW, §1 Goal — build a NEW AI gateway, 9router is reference only, 9router checkout (read-only behavioral reference at E:/9router)

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
- **Why does `Bounded context: routing (core)` connect `Endpoint lanes, combos and integrations` to `API keys, identity and dashboard auth`, `Dashboard screens and overview APIs`, `Header extraction and OpenAI chat protocol`, `Error taxonomy, parity harness and branding`, `Business rules and fallback policy`, `Request translation and pivot loss`, `API to UI map rows`, `Responses API translation`, `Anthropic Messages client protocol (SP15)`, `Proxy chain, idle timeout and exec context`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Why does `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` connect `Upstream error classification` to `Dashboard screens and overview APIs`, `Provider connections and per-connection data`, `Partial stream failure`, `Error taxonomy, parity harness and branding`, `withRetry and lint rules`, `Vertex, Google auth and qoder decision`, `Model listing, fallback and client disconnect`, `Retry budget and transport`, `Registry build and Anthropic provider auth`, `Custom provider nodes`, `Request translation and pivot loss`, `API to UI map rows`, `Responses API translation`, `Stream mode and OpenAI chat mapping`, `Anthropic adapter translation`, `Stream-only providers and JSON collapse`, `Proxy chain, idle timeout and exec context`, `Ollama adapter`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._