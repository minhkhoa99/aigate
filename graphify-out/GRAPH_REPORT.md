# Graph Report - docs  (2026-09-26)

## Corpus Check
- 27 files · ~58,923 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 717 nodes · 1874 edges · 29 communities
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 261 edges (avg confidence: 0.87)
- Token cost: 574,916 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_API keys, identity and settings behavior|API keys, identity and settings behavior]]
- [[_COMMUNITY_Dashboard screens and overviewtraffic APIs|Dashboard screens and overview/traffic APIs]]
- [[_COMMUNITY_Endpoint lanes, credential test, and preview screens|Endpoint lanes, credential test, and preview screens]]
- [[_COMMUNITY_Catalog capabilities, model registry, and combos|Catalog capabilities, model registry, and combos]]
- [[_COMMUNITY_Error classification, parity harness, and governance docs|Error classification, parity harness, and governance docs]]
- [[_COMMUNITY_Provider connections CRUD and connection tests|Provider connections CRUD and connection tests]]
- [[_COMMUNITY_Custom provider nodes (OpenAIAnthropic, apiType)|Custom provider nodes (OpenAI/Anthropic, apiType)]]
- [[_COMMUNITY_Request translation, format detection, and JSON helpers|Request translation, format detection, and JSON helpers]]
- [[_COMMUNITY_Provider catalog API, adapter headers, ollama-local host|Provider catalog API, adapter headers, ollama-local host]]
- [[_COMMUNITY_Anthropic and Ollama adapters and their translators|Anthropic and Ollama adapters and their translators]]
- [[_COMMUNITY_Anthropic-compatible nodes and stream-only providers|Anthropic-compatible nodes and stream-only providers]]
- [[_COMMUNITY_Chat lane routing and model resolution|Chat lane routing and model resolution]]
- [[_COMMUNITY_Transport, retry budget, and upstream error redaction|Transport, retry budget, and upstream error redaction]]
- [[_COMMUNITY_Gemini adapter, schema cleaner, and signatures (SP14e)|Gemini adapter, schema cleaner, and signatures (SP14e)]]
- [[_COMMUNITY_Registry extraction and catalog build|Registry extraction and catalog build]]
- [[_COMMUNITY_OpenAI-compatible adapter and bounded SSE|OpenAI-compatible adapter and bounded SSE]]
- [[_COMMUNITY_Spec phases, golden scenarios, and constraints|Spec phases, golden scenarios, and constraints]]
- [[_COMMUNITY_Streaming, disconnects, and CIP|Streaming, disconnects, and CIP]]
- [[_COMMUNITY_Behavioral questions, definition of done, matrix template|Behavioral questions, definition of done, matrix template]]
- [[_COMMUNITY_Milestone M-1 discovery tasks and matrix files|Milestone M-1 discovery tasks and matrix files]]
- [[_COMMUNITY_Discovery inventory, gaps, quota and usage tracing|Discovery inventory, gaps, quota and usage tracing]]
- [[_COMMUNITY_Non-streaming answers and 9router findings|Non-streaming answers and 9router findings]]
- [[_COMMUNITY_OpenAI Responses adapter (SP14c)|OpenAI Responses adapter (SP14c)]]
- [[_COMMUNITY_Core principles and generated capabilities|Core principles and generated capabilities]]
- [[_COMMUNITY_Discovery coverage tooling and exit gate|Discovery coverage tooling and exit gate]]
- [[_COMMUNITY_Latency and bounded-workload rules|Latency and bounded-workload rules]]
- [[_COMMUNITY_Proxy chain, timeouts, and idle stream timeout|Proxy chain, timeouts, and idle stream timeout]]
- [[_COMMUNITY_Partial stream failure|Partial stream failure]]
- [[_COMMUNITY_Code quality rules|Code quality rules]]

## God Nodes (most connected - your core abstractions)
1. `Identity and API keys contract (M1 SP6)` - 37 edges
2. `Bounded context: routing (core)` - 35 edges
3. `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` - 34 edges
4. `Feature Matrix — mandatory 17-column artifact` - 27 edges
5. `Milestone M-1 · Discovery` - 27 edges
6. `Bounded context: connections` - 26 edges
7. `The 23 feature groups required by behavioral.md §5` - 26 edges
8. `SP6 — identity + apikeys (password login + key validation only)` - 25 edges
9. `ChatLane (modules/routing/infrastructure/chat-lane.ts)` - 25 edges
10. `shared/errors.ts toProblem() — the one code-to-message table` - 24 edges

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

## Communities (29 total, 0 thin omitted)

### Community 0 - "API keys, identity and settings behavior"
Cohesion: 0.05
Nodes (108): apikey.delete-key, apikey.generate-key, apikey.legacy-format-unenforced, apikey.list-keys, apikey.update-key-status, apikey.validate-lookup, endpoint.enforce-require-api-key, identity.auth-status-disclosure (+100 more)

### Community 1 - "Dashboard screens and overview/traffic APIs"
Cohesion: 0.06
Nodes (89): GET /overview/summary, SSE /events/requests, /traffic/console → Console (Developer mode only), /integrations/* → CliTools, CliToolDetail, Skills, Mcp, /network/* → ProxyPools, DeployWizard, Tunnel, Mitm, / → Overview, /traffic/usage, /traffic/requests* → Usage, Requests, RequestDetail, Audit finding: Console shown in sidebar regardless of Developer mode (+81 more)

### Community 2 - "Endpoint lanes, credential test, and preview screens"
Cohesion: 0.07
Nodes (75): endpoint.rewrite-lanes, validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, /providers/media* → MediaProviders, /providers/quota → Quota; custom provider form; multi-account, /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver, §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra), §9 Build an explicit domain model (Provider, Quota, RoutingPolicy…), §5 Feature discovery — inventory every group, do not trust the UI menu (+67 more)

### Community 3 - "Catalog capabilities, model registry, and combos"
Cohesion: 0.05
Nodes (74): endpoint.extract-header-order, catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, combo.detect-required-capabilities, usage.write-not-synchronous, API ↔ UI map (docs/design/API_UI_MAP.md) (+66 more)

### Community 4 - "Error classification, parity harness, and governance docs"
Cohesion: 0.06
Nodes (53): fallback.error-classification, Status → ErrorCode by status + error.code/type only (never message text), API_UI_MAP row: M0 SP3 parity harness, No UI, 9router as Behavioral Source of Truth (not a template to port), Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Definition of Done — 13 items, not self-awarded, Error taxonomy (8 ErrorCodes) (+45 more)

### Community 5 - "Provider connections CRUD and connection tests"
Cohesion: 0.08
Nodes (46): catalog.connection-detail-crud, catalog.connection-listing, connection.client-listing-sanitized, connection.test-single-connection, connection.create-dedup-and-priority-assignment, connection.delete-and-reorder, connection.storage-shape-json-blob, DELETE /api/connections/:id (+38 more)

### Community 6 - "Custom provider nodes (OpenAI/Anthropic, apiType)"
Cohesion: 0.18
Nodes (21): connection.provider-node-api-type, connection.provider-node-create-list, connection.provider-node-repo-storage, connection.provider-node-update-delete, connection.provider-node-validate-partial-ssrf (stays traced: no validate route), DELETE /api/provider-nodes/:id (cascades the connection), GET /api/provider-nodes, PATCH /api/provider-nodes/:id (+13 more)

### Community 7 - "Request translation, format detection, and JSON helpers"
Cohesion: 0.16
Nodes (19): routing.request-translation, routing.source-format-detection, routing.stream-mode-decision, translator.pivot-loss, translator.tool-id-normalization, src/json.ts — shared JSON narrowing (isRecord, record, text, list, parseJson), CIP gains image detail and tool strict (OpenAI → OpenAI trip keeps them), toOpenAIChatCompletion() — CanonicalResponse → chat.completion JSON (+11 more)

### Community 8 - "Provider catalog API, adapter headers, ollama-local host"
Cohesion: 0.15
Nodes (18): connection.ollama-local-host, Adapter: catalog headers first, key last; raw or Bearer scheme; chatUrl/modelsUrl called directly, GET /api/providers/:id (chatUrl + models; 404 NOT_FOUND), GET /api/providers (all 121, connectable + reason), API_UI_MAP row: SP14a AnthropicAdapter — no new screen; /providers pills follow connectable, API_UI_MAP row: SP14d Ollama adapter and ollama-local connections, /providers → LlmProviders (catalog from GET /api/providers; Connected / Coming later pills), builtinRegistry built from CATALOG (41 connectable providers) (+10 more)

### Community 9 - "Anthropic and Ollama adapters and their translators"
Cohesion: 0.18
Nodes (18): provider.anthropic-auth-and-headers, translator.claude-to-openai-response, translator.ollama-to-openai-response, translator.openai-to-claude-request, translator.openai-to-ollama-request, AnthropicAdapter — CIP <-> Messages (max_tokens rules, thinking budgets, tool_use, SSE events), packages/engine/test/anthropic-adapter.test.mjs (10) + apps/server/test/anthropic-lane.test.mjs (4); 23 mutations caught, Deviations not ported: stop/top_p kept, none stays none, no Claude Code line, stream errors fail, same stop/usage mapping, 403 invalid (+10 more)

### Community 10 - "Anthropic-compatible nodes and stream-only providers"
Cohesion: 0.16
Nodes (16): connection.anthropic-compatible-node, routing.forced-stream-json-collapse, provider.codebuddy-request-quirks, Claude Code anthropic-beta list for claude-* models on an Anthropic node (claude-code flag only on the official host), Anthropic node connection test: POST <base>/v1/messages, claude-3-haiku, only 401/403 invalid (9router), API_UI_MAP row: SP14b stream-only providers (no new screen) and the protocol select on /providers/new, CodeBuddy quirks: reasoningSummary (cn, intl), neutralAgentPrompt (cn) via EXECUTOR_QUIRKS, User decision 2026-09-26: SP14b keeps 9router on every suspected bug asked (+8 more)

### Community 11 - "Chat lane routing and model resolution"
Cohesion: 0.18
Nodes (15): catalog.model-listing-live-override, fallback.accounts-exhausted-response, routing.lane-entry-routes, routing.model-resolution, routing.request-preflight, Chat lane contract (M1 SP12), Keyless mode serves this machine only (loopback socket, Host, Origin) → 403 api_key_required, Model resolution: provider/model (any id) or a bare catalog id; 404 model_not_found / no_active_connection (+7 more)

### Community 12 - "Transport, retry budget, and upstream error redaction"
Cohesion: 0.16
Nodes (15): fallback.executor-retry-budget, transport.test.mjs: adapter streams end to end over DirectTransport, Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, ErrorCode: PROVIDER_UNAVAILABLE, DirectTransport (direct branch implementation), Upstream answers 4xx or 5xx, Failure: connection refused, DNS failure, TLS failure (+7 more)

### Community 13 - "Gemini adapter, schema cleaner, and signatures (SP14e)"
Cohesion: 0.23
Nodes (15): translator.gemini-to-openai-response, translator.openai-to-gemini-request, API_UI_MAP row: SP14e Gemini adapter (no new screen; Key rejected on a 400), CIP image_delta chunk (delta.images) and vendorExtensions.openai.finish_reason honoured by the OpenAI renderer, User decision 2026-09-26: SP14e keeps 9router's Gemini request drops and answer mapping; only the schema cleaner is corrected, GeminiAdapter — CIP <-> generateContent / streamGenerateContent?alt=sse (x-goog-api-key, safety off, thinking level/budget, 400 key test = invalid), cleanGeminiSchema() — corrected: walks schema positions only, no invented reason parameter, depth 64, Thought-signature cache (in memory, 1 h, 2000, same family) and the borrowed 9router signature on the first call (+7 more)

### Community 14 - "Registry extraction and catalog build"
Cohesion: 0.21
Nodes (12): catalog.registry-build, catalog.registry-entry-shape, ListedModel { id, descriptor? } — getModels never invents limits (≤1000 ids), CATALOG — providers.generated.ts (121 providers, 935 models; never hand-edited), CatalogProvider / CatalogModel / validateCatalog (packages/engine/src/catalog/schema.ts), Registry extraction contract (M0 SP4), tools/extract (deleted in SP13b; restorable from git d2783c1) — wrote the catalog from 9router, tools/extract verify (deleted in SP13b with the tool) (+4 more)

### Community 15 - "OpenAI-compatible adapter and bounded SSE"
Cohesion: 0.23
Nodes (12): routing.default-executor-openai-fallback, routing.streaming-pipeline, OpenAICompatibleAdapter (AIProviderPort for openai-compatible), readSseData() — bounded SSE reader (1 Mi chars per line/event, cancels body), packages/engine/test/openai-adapter.test.mjs (15 tests, fake transport, SSE split every 3 bytes; 16 mutations caught), Refused before I/O: video, media by URL, assistant thinking, tool_result.isError, budgetTokens, foreign vendorExtensions, TokenUsage normalized: inputTokens excludes cache reads, outputTokens includes reasoning, UnsupportedFeatureError (+4 more)

### Community 16 - "Spec phases, golden scenarios, and constraints"
Cohesion: 0.24
Nodes (12): §30 The 12 pre-implementation questions, §25 Golden scenarios (13 critical flows), Phase model A→F (Discovery, Behavior Extraction, Contract, Design, Implementation, Parity Verification), §24 Characterization/contract tests prove old ≈ new at contract level, Constraint — no Phase C contracts during discovery, Constraint — no AIGate product code in M-1 (only tools/discovery and docs), Phase A — Discovery, Phase B — Behavior Extraction (+4 more)

### Community 17 - "Streaming, disconnects, and CIP"
Cohesion: 0.20
Nodes (11): routing.client-disconnect-propagation, §18 Streaming is first-class (TTFT, cancellation, backpressure), Backpressure: a false write() waits for drain; the upstream read pauses with it, One ExecCtx signal: client disconnect + 600 s budget (TIMEOUT) + idle watchdog, Canonical Internal Protocol (CIP), vendorExtensions — typed carry-through field, ExecCtx (one shared client-cancel + deadline signal), Feature group: Translation / language functionality (+3 more)

### Community 18 - "Behavioral questions, definition of done, matrix template"
Cohesion: 0.18
Nodes (11): §3 The 20 behavioral questions (trigger…edge cases), §8 Business rule beats old implementation, §29 Definition of Done — 13 checklist items, no self-declared DONE, §19 Fallback as explicit policy with classified errors, §28 Per-feature process: DISCOVER→TRACE→DOCUMENT→…→REVIEW, Feature Matrix entry template (null never "" or "N/A"), Canonical error classification codes (8 values), parityStatus lifecycle (not-started → traced → contracted → implemented → verified) (+3 more)

### Community 19 - "Milestone M-1 discovery tasks and matrix files"
Cohesion: 0.33
Nodes (11): 07-token-saver.yaml, 10-proxy-pools.yaml, Milestone M-1 · Discovery, Rule 10 — Cache only with a reason: key, TTL, invalidation, max size, Task 1 — Discovery tooling workspace, Task 2 — Feature Matrix schema and validator, Task 3 — Inventory extractor, Task 4 — Coverage checker (+3 more)

### Community 20 - "Discovery inventory, gaps, quota and usage tracing"
Cohesion: 0.22
Nodes (10): docs/discovery/gaps.md (Gap register), docs/discovery/inventory.json, §21 Quota must be understood fully, not copied from the UI tracker, §22 Usage fields to trace per request (tokens, cost, latency, fallback attempts), 13-console-remote.yaml, Rule 6 — Database discipline (N+1, pagination, no query in loop), Rule 8 — Every resource has an explicit lifecycle, Task 13 — Trace Usage, Quota Tracker (+2 more)

### Community 21 - "Non-streaming answers and 9router findings"
Cohesion: 0.28
Nodes (9): fallback.upstream-error-result, routing.non-streaming-response, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), Finding: 9router 0.5.55 errors carry only { message } with its node id and the raw upstream body, Finding: omitted stream on 9router 0.5.55 → JSON body sent as text/event-stream + bare [DONE] (unparsable), Finding: 9router adds 2000 tokens to reported prompt/total usage (addBufferToUsage) — SUSPECTED_BUG, tools/parity/src/scenarios.mjs DEVIATIONS — intentional differences from 9router, each with entry, label, reason, tools/parity/tapes — 11 tapes from 9router 0.5.55 (JSON, stream, tool calls, omitted stream, 400/401/429/500, cut stream) (+1 more)

### Community 22 - "OpenAI Responses adapter (SP14c)"
Cohesion: 0.28
Nodes (9): routing.responses-non-stream-answer, translator.openai-to-responses-request, translator.responses-to-openai-stream, API_UI_MAP row: SP14c Responses adapter (no new screen for perplexity-agent) and the API select on /providers/new, User decision 2026-09-26: SP14c corrects the non-stream answer, keeps 9router request drops and stream error handling, OpenAIResponsesAdapter — CIP <-> Responses API (extends OpenAICompatibleAdapter; 9router request and stream, corrected non-stream), OpenAI Responses provider contract (M2 SP14c), Non-streaming Responses answer: stream false, output[] read (reasoning, text, refusal, tool calls, incomplete, failed, usage) (+1 more)

### Community 23 - "Core principles and generated capabilities"
Cohesion: 0.22
Nodes (9): docs/capabilities.md (GENERATED capability specification), §2 Core principles — never port, rename, or translate 9router line by line, §14 Feature parity is not code parity, Final principle — 9router says WHAT, never HOW, §1 Goal — build a NEW AI gateway, 9router is reference only, §27 Separate BUSINESS REQUIREMENT from IMPLEMENTATION ACCIDENT, IMPLEMENTATION_ACCIDENT label, 9router checkout (read-only behavioral reference at E:/9router) (+1 more)

### Community 24 - "Discovery coverage tooling and exit gate"
Cohesion: 0.39
Nodes (9): docs/discovery/coverage.md, Evidence with file:line — traced is a test, not a self-declaration, Fixed inventory counts (154 routes, 28 pages, 123 providers, 29 executors, 48 translators, 11 repos, 14 OAuth routes), cli.ts — validate | inventory | coverage | capabilities, coverage.ts — matrix vs inventory coverage report, gate.test.ts — M-1 exit gate test, inventory.ts — 9router surface scanner, paths.ts — 9router/repo root resolution (+1 more)

### Community 25 - "Latency and bounded-workload rules"
Cohesion: 0.29
Nodes (7): §17 Latency — clean architecture must not add hot-path I/O, §16 Do not inherit performance issues; all large workloads bounded, Constraint — every filesystem scan uses fast-glob with an explicit ignore list, Rule 4 — Every workload must be BOUNDED, Rule 11 — Review questions beyond "does it run?" (10x/100x traffic, unbounded work), Rule 5 — Low latency: parallelize independent awaits, only when bounded, Rule 3 — Optimize performance at design time, not micro-optimization

### Community 26 - "Proxy chain, timeouts, and idle stream timeout"
Cohesion: 0.40
Nodes (5): transport.proxy-priority-chain, Idle timeout between chunks (AIGATE_STREAM_IDLE_TIMEOUT_MS, default 300 s) → TIMEOUT error event, Deferred: streaming idle timeout (gap between chunks) with SP12, HttpRequest (requires timeoutMs), Rule: every call states timeoutMs (1 to 600000 ms), bounding headers and body inside ctx.signal

### Community 27 - "Partial stream failure"
Cohesion: 0.83
Nodes (4): fallback.partial-stream-failure, Truncated stream or error event → PROVIDER_UNAVAILABLE with details.partial, Stream headers only after the first chunk: earlier failures are real JSON statuses, Golden scenario: partial stream failure

### Community 28 - "Code quality rules"
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
- **Why does `Bounded context: routing (core)` connect `Endpoint lanes, credential test, and preview screens` to `API keys, identity and settings behavior`, `Dashboard screens and overview/traffic APIs`, `Catalog capabilities, model registry, and combos`, `Error classification, parity harness, and governance docs`, `Request translation, format detection, and JSON helpers`, `Gemini adapter, schema cleaner, and signatures (SP14e)`, `Streaming, disconnects, and CIP`, `Milestone M-1 discovery tasks and matrix files`?**
  _High betweenness centrality (0.119) - this node is a cross-community bridge._
- **Why does `Task board (PROGRESS_HANDOFF)` connect `Catalog capabilities, model registry, and combos` to `API keys, identity and settings behavior`, `Endpoint lanes, credential test, and preview screens`, `Error classification, parity harness, and governance docs`, `Request translation, format detection, and JSON helpers`, `Provider catalog API, adapter headers, ollama-local host`, `Milestone M-1 discovery tasks and matrix files`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._