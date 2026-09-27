# Graph Report - docs  (2026-09-27)

## Corpus Check
- 33 files · ~68,652 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 787 nodes · 2024 edges · 34 communities
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 261 edges (avg confidence: 0.87)
- Token cost: 574,916 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Dashboard screens, usage and overview APIs|Dashboard screens, usage and overview APIs]]
- [[_COMMUNITY_Registry build and capability resolution|Registry build and capability resolution]]
- [[_COMMUNITY_Provider adapters and connection tests|Provider adapters and connection tests]]
- [[_COMMUNITY_Provider connections and per-connection data|Provider connections and per-connection data]]
- [[_COMMUNITY_API_UI_MAP history and branding|API_UI_MAP history and branding]]
- [[_COMMUNITY_Outbound proxy, retry budget and transport|Outbound proxy, retry budget and transport]]
- [[_COMMUNITY_Generated discovery outputs and inventory|Generated discovery outputs and inventory]]
- [[_COMMUNITY_API keys|API keys]]
- [[_COMMUNITY_Custom provider nodes|Custom provider nodes]]
- [[_COMMUNITY_Client protocols Responses, Gemini, compact (SP15b-c)|Client protocols: Responses, Gemini, compact (SP15b-c)]]
- [[_COMMUNITY_Credential validation and provider screens|Credential validation and provider screens]]
- [[_COMMUNITY_Gap register and discovery principles|Gap register and discovery principles]]
- [[_COMMUNITY_Settings, combos and database export|Settings, combos and database export]]
- [[_COMMUNITY_Health, governance and frontend structure|Health, governance and frontend structure]]
- [[_COMMUNITY_Identity, auth settings and general settings|Identity, auth settings and general settings]]
- [[_COMMUNITY_Rewrite lanes, model listing and fallback|Rewrite lanes, model listing and fallback]]
- [[_COMMUNITY_Upstream error results and default executor|Upstream error results and default executor]]
- [[_COMMUNITY_Error classification and request translation|Error classification and request translation]]
- [[_COMMUNITY_Password lockout and session cookies|Password lockout and session cookies]]
- [[_COMMUNITY_Spec pre-implementation questions and definition of done|Spec pre-implementation questions and definition of done]]
- [[_COMMUNITY_Stream mode and OpenAI chat mapping|Stream mode and OpenAI chat mapping]]
- [[_COMMUNITY_Setup error codes|Setup error codes]]
- [[_COMMUNITY_UI transport error codes|UI transport error codes]]
- [[_COMMUNITY_Header extraction and OpenAI chat protocol|Header extraction and OpenAI chat protocol]]
- [[_COMMUNITY_Anthropic Messages client protocol (SP15)|Anthropic Messages client protocol (SP15)]]
- [[_COMMUNITY_Media providers|Media providers]]
- [[_COMMUNITY_Auth status disclosure|Auth status disclosure]]
- [[_COMMUNITY_Client disconnect and backpressure|Client disconnect and backpressure]]
- [[_COMMUNITY_Latency and performance constraints|Latency and performance constraints]]
- [[_COMMUNITY_Streaming pipeline and idle timeout|Streaming pipeline and idle timeout]]
- [[_COMMUNITY_Catalog bounded context|Catalog bounded context]]
- [[_COMMUNITY_Partial stream failure|Partial stream failure]]
- [[_COMMUNITY_Lean code rules|Lean code rules]]
- [[_COMMUNITY_Architecture independence principles|Architecture independence principles]]

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
- `§11 Providers reached only through a port (AIProviderPort)` --rationale_for--> `Bounded context: connections`  [INFERRED]
  docs/governance/behavioral.md → docs/superpowers/specs/2026-09-22-aigate-design.md
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

## Communities (34 total, 0 thin omitted)

### Community 0 - "Dashboard screens, usage and overview APIs"
Cohesion: 0.06
Nodes (96): usage.write-not-synchronous, GET /overview/summary, SSE /events/requests, /traffic/console → Console (Developer mode only), /integrations/* → CliTools, CliToolDetail, Skills, Mcp, /network/* → ProxyPools, DeployWizard, Tunnel, Mitm, / → Overview, /gateway/routing*, /gateway/token-saver → Routing, ComboCreate, TokenSaver (+88 more)

### Community 1 - "Registry build and capability resolution"
Cohesion: 0.05
Nodes (71): catalog.registry-build, catalog.registry-entry-shape, catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, routing.forced-stream-json-collapse, combo.detect-required-capabilities (+63 more)

### Community 2 - "Provider adapters and connection tests"
Cohesion: 0.05
Nodes (66): connection.commandcode-key-test, connection.ollama-local-host, connection.vertex-credential-test, provider.qoder-agent-transport (traced, not ported), provider.vertex-google-auth, routing.vertex-endpoints, routing.responses-non-stream-answer, translator.claude-to-openai-response (+58 more)

### Community 3 - "Provider connections and per-connection data"
Cohesion: 0.07
Nodes (49): catalog.connection-detail-crud, catalog.connection-listing, connection.azure-openai-deployment, connection.client-listing-sanitized, connection.cloudflare-account-id, connection.test-single-connection, provider.clinepass-headers-envelope, connection.create-dedup-and-priority-assignment (+41 more)

### Community 4 - "API_UI_MAP history and branding"
Cohesion: 0.08
Nodes (46): API_UI_MAP row: M0 SP3 parity harness, No UI, Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Definition of Done — 13 items, not self-awarded, AIGate domain model (Provider, Credential, RoutingPolicy, AccountLock, …), Error taxonomy (8 ErrorCodes), IMPLEMENTATION_ACCIDENT — debt not inherited from 9router, Stated limits of tape-based parity (+38 more)

### Community 5 - "Outbound proxy, retry budget and transport"
Cohesion: 0.07
Nodes (44): settings.outbound-proxy-live-apply, settings.proxy-test-outbound-probe, fallback.executor-retry-budget, transport.proxy-priority-chain, transport.test.mjs: adapter streams end to end over DirectTransport, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, §8 Business rule beats old implementation, §19 Fallback as explicit policy with classified errors (+36 more)

### Community 6 - "Generated discovery outputs and inventory"
Cohesion: 0.11
Nodes (35): docs/capabilities.md (GENERATED capability specification), docs/discovery/coverage.md, docs/discovery/inventory.json, §3 The 20 behavioral questions (trigger…edge cases), §2 Core principles — never port, rename, or translate 9router line by line, §14 Feature parity is not code parity, Final principle — 9router says WHAT, never HOW, §1 Goal — build a NEW AI gateway, 9router is reference only (+27 more)

### Community 7 - "API keys"
Cohesion: 0.13
Nodes (31): apikey.delete-key, apikey.generate-key, apikey.legacy-format-unenforced, apikey.list-keys, apikey.update-key-status, apikey.validate-lookup, endpoint.enforce-require-api-key, identity.reset-password-local-only (+23 more)

### Community 8 - "Custom provider nodes"
Cohesion: 0.11
Nodes (31): connection.anthropic-compatible-node, connection.provider-node-api-type, connection.provider-node-create-list, connection.provider-node-repo-storage, connection.provider-node-update-delete, connection.provider-node-validate-partial-ssrf (stays traced: no validate route), Claude Code anthropic-beta list for claude-* models on an Anthropic node (claude-code flag only on the official host), Anthropic node connection test: POST <base>/v1/messages, claude-3-haiku, only 401/403 invalid (9router) (+23 more)

### Community 9 - "Client protocols: Responses, Gemini, compact (SP15b-c)"
Cohesion: 0.11
Nodes (25): catalog.v1beta-generate-content-dispatch, catalog.v1beta-models-listing, routing.responses-compact-lane, translator.gemini-client-request, translator.openai-to-gemini-client-response, translator.openai-to-responses-client-response, translator.responses-client-request, API_UI_MAP row: SP14c Responses adapter (no new screen for perplexity-agent) and the API select on /providers/new (+17 more)

### Community 10 - "Credential validation and provider screens"
Cohesion: 0.20
Nodes (25): validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, /providers/quota → Quota; custom provider form; multi-account, §6 Feature Matrix requirement — nothing is understood until fully traced, AuthFlow — declarative, data-driven auth step framework, Feature Matrix — mandatory 17-column artifact, Bounded context: connections, Feature group: API-key providers, Feature group: Multi-account (+17 more)

### Community 11 - "Gap register and discovery principles"
Cohesion: 0.13
Nodes (25): docs/discovery/gaps.md (Gap register), §5 Feature discovery — inventory every group, do not trust the UI menu, §20 No blind fallback — fallback follows error semantics, §12 Router is its own business engine, not controller logic, §7 Trace the behavior — never conclude from a function name, §13 Translator/protocol separation — canonical vs vendor formats, The 23 feature groups required by behavioral.md §5, Canonical Internal Protocol (+17 more)

### Community 12 - "Settings, combos and database export"
Cohesion: 0.17
Nodes (23): settings.combo-rotation-reset, settings.database-export-import, settings.defaults-and-merge, settings.get-secret-stripping, settings.hot-path-read-no-cache, settings.patch-protected-keys, settings.require-login-public-status, GET /api/settings (+15 more)

### Community 13 - "Health, governance and frontend structure"
Cohesion: 0.12
Nodes (21): GET /health, 9router as Behavioral Source of Truth (not a template to port), Feature-based frontend structure with import boundaries, Hexagonal architecture, granularity = bounded context, Split: machines block mechanics, skills teach judgement, Monorepo layout (apps/server, apps/web, apps/cli, packages/engine, contracts, database, tools), Open decisions not settled by this spec, Iron law: no skill without a failing test first (RED → GREEN → REFACTOR) (+13 more)

### Community 14 - "Identity, auth settings and general settings"
Cohesion: 0.25
Nodes (19): identity.machine-id-derivation, /settings/auth OIDC and SAML tabs, /settings/general → SettingsGeneral, Audit finding: settings-auth regenerated as settings-auth-v2, Audit finding: login-callback / deploy-wizard / authflow-modals are showcases, not routes, Audit FAIL: sidebar not identical across screens, Bounded context: identity, Bounded context: settings (+11 more)

### Community 15 - "Rewrite lanes, model listing and fallback"
Cohesion: 0.17
Nodes (17): endpoint.rewrite-lanes, catalog.model-listing-live-override, fallback.accounts-exhausted-response, routing.lane-entry-routes, routing.model-resolution, routing.request-preflight, Chat lane contract (M1 SP12), Keyless mode serves this machine only (loopback socket, Host, Origin) → 403 api_key_required (+9 more)

### Community 16 - "Upstream error results and default executor"
Cohesion: 0.18
Nodes (17): fallback.upstream-error-result, routing.default-executor-openai-fallback, Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O, OpenAICompatibleAdapter (AIProviderPort for openai-compatible), packages/engine/test/openai-adapter.test.mjs (15 tests, fake transport, SSE split every 3 bytes; 16 mutations caught), Refused before I/O: video, media by URL, assistant thinking, tool_result.isError, budgetTokens, foreign vendorExtensions, TokenUsage normalized: inputTokens excludes cache reads, outputTokens includes reasoning, Canonical Internal Protocol (CIP) (+9 more)

### Community 17 - "Error classification and request translation"
Cohesion: 0.17
Nodes (16): fallback.error-classification, routing.request-translation, routing.source-format-detection, translator.pivot-loss, translator.tool-id-normalization, Status → ErrorCode by status + error.code/type only (never message text), FALLBACK_POLICY (8 error codes as data), toOpenAIChatCompletion() — CanonicalResponse → chat.completion JSON (+8 more)

### Community 18 - "Password lockout and session cookies"
Cohesion: 0.22
Nodes (15): identity.password-login-lockout, identity.session-cookie-lifecycle, UI error code: INVALID_CREDENTIALS (401), UI error code: RATE_LIMITED (429), UI error code: SETUP_REQUIRED (409), useChangePassword (features/settings/api.ts), useLogin (features/settings/api.ts), useLogout (features/settings/api.ts) (+7 more)

### Community 19 - "Spec pre-implementation questions and definition of done"
Cohesion: 0.18
Nodes (15): §30 The 12 pre-implementation questions, §29 Definition of Done — 13 checklist items, no self-declared DONE, §28 Per-feature process: DISCOVER→TRACE→DOCUMENT→…→REVIEW, §25 Golden scenarios (13 critical flows), Phase model A→F (Discovery, Behavior Extraction, Contract, Design, Implementation, Parity Verification), §24 Characterization/contract tests prove old ≈ new at contract level, parityStatus lifecycle (not-started → traced → contracted → implemented → verified), Constraint — no Phase C contracts during discovery (+7 more)

### Community 20 - "Stream mode and OpenAI chat mapping"
Cohesion: 0.24
Nodes (10): routing.non-streaming-response, routing.stream-mode-decision, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), Finding: 9router 0.5.55 errors carry only { message } with its node id and the raw upstream body, Finding: omitted stream on 9router 0.5.55 → JSON body sent as text/event-stream + bare [DONE] (unparsable), Finding: 9router adds 2000 tokens to reported prompt/total usage (addBufferToUsage) — SUSPECTED_BUG, tools/parity/src/scenarios.mjs DEVIATIONS — intentional differences from 9router, each with entry, label, reason, tools/parity/tapes — 11 tapes from 9router 0.5.55 (JSON, stream, tool calls, omitted stream, 400/401/429/500, cut stream) (+2 more)

### Community 21 - "Setup error codes"
Cohesion: 0.33
Nodes (10): UI error code: ALREADY_SET_UP (409), UI error code: NOT_LOCAL (403), useSetup (features/settings/api.ts), POST /api/auth/setup, /welcome → Onboarding (one step), AIGATE_INITIAL_PASSWORD (first password at boot), Decision 2 (user, 2026-09-25): first password set from the local machine; no default password, Decision (user, 2026-09-25, option A): on shared machines rely on AIGATE_INITIAL_PASSWORD (+2 more)

### Community 22 - "UI transport error codes"
Cohesion: 0.36
Nodes (10): UI error code: BAD_RESPONSE, UI error code: HTTP_5xx, UI error code: NETWORK_ERROR, UI error code: any other code (fallback), UI error code: TIMEOUT, UI error code: UNAUTHENTICATED (401), shared/errors.test.mjs, shared/api.ts — same-origin JSON client, ApiError with stable code, 10 s timeout (+2 more)

### Community 23 - "Header extraction and OpenAI chat protocol"
Cohesion: 0.33
Nodes (9): endpoint.extract-header-order, API_UI_MAP row: SP10 OpenAI Chat protocol, No UI, API_UI_MAP row: SP9 OpenAICompatibleAdapter, No UI, /gateway/endpoint readiness pill (Ready / Connect a provider / Check connection) + curl test, POST /v1/chat/completions + GET /v1/models (/v1 Chat API), extractApiKey() (Authorization: Bearer first, then x-api-key), Milestone M1 · Walking skeleton (thin end-to-end slice), SP12 — routing: chat lane + Fastify raw streaming, backpressure, cancellation (+1 more)

### Community 24 - "Anthropic Messages client protocol (SP15)"
Cohesion: 0.31
Nodes (9): routing.count-tokens-estimate, translator.claude-client-request, translator.openai-to-claude-client-response, protocols/anthropic-messages.ts — parse to CIP, anthropicRequestFor (passthrough for Anthropic, claude→openai rules otherwise), message, SSE encoder, count_tokens, API_UI_MAP row: SP15 Anthropic Messages client protocol, User decision 2026-09-27: SP15 Anthropic first; OpenAI-shaped errors and 9router non-stream/stream-default kept; real usage, live tool args, signature_delta corrected, Endpoint screen: OpenAI and Anthropic chips, Claude Code and Anthropic curl copy fields, SP15 tests: engine anthropic-protocol.test.mjs (7), server messages-lane.test.mjs; 52 mutations, 1 equivalent (+1 more)

### Community 25 - "Media providers"
Cohesion: 0.39
Nodes (9): /providers/media* → MediaProviders, Bounded context: media, Feature group: Media Providers, 09-media-providers.yaml, Media Providers — /providers/media/:kind, /:kind/:id, SP23 — media: 9 kinds, voice list, U5 — Media Providers, Task 14 — Trace Media Providers (+1 more)

### Community 26 - "Auth status disclosure"
Cohesion: 0.38
Nodes (7): identity.auth-status-disclosure, GET /api/auth/status, useAuthStatus (features/settings/api.ts), Shell gate (app/shell.tsx) — redirects to /welcome or /login, DashboardAuthGuard (global APP_GUARD, @Public()), Deny-by-default /api/* access (only status/login/logout/setup are public), SP6 — identity + apikeys (password login + key validation only)

### Community 27 - "Client disconnect and backpressure"
Cohesion: 0.33
Nodes (7): routing.client-disconnect-propagation, §18 Streaming is first-class (TTFT, cancellation, backpressure), Backpressure: a false write() waits for drain; the upstream read pauses with it, One ExecCtx signal: client disconnect + 600 s budget (TIMEOUT) + idle watchdog, ExecCtx (one shared client-cancel + deadline signal), Golden scenario: client cancellation, Failure: caller ctx.signal aborts (client left, budget spent)

### Community 28 - "Latency and performance constraints"
Cohesion: 0.29
Nodes (7): §17 Latency — clean architecture must not add hot-path I/O, §16 Do not inherit performance issues; all large workloads bounded, Constraint — every filesystem scan uses fast-glob with an explicit ignore list, Rule 4 — Every workload must be BOUNDED, Rule 11 — Review questions beyond "does it run?" (10x/100x traffic, unbounded work), Rule 5 — Low latency: parallelize independent awaits, only when bounded, Rule 3 — Optimize performance at design time, not micro-optimization

### Community 29 - "Streaming pipeline and idle timeout"
Cohesion: 0.33
Nodes (6): routing.streaming-pipeline, readSseData() — bounded SSE reader (1 Mi chars per line/event, cancels body), Idle timeout between chunks (AIGATE_STREAM_IDLE_TIMEOUT_MS, default 300 s) → TIMEOUT error event, readJsonLines() — bounded NDJSON reader (1 MiB per line, blank lines skipped), Deferred: streaming idle timeout (gap between chunks) with SP12, readBoundedText() (bounded body reader, default 4 MiB)

### Community 30 - "Catalog bounded context"
Cohesion: 0.80
Nodes (5): Bounded context: catalog, Feature group: Model mapping, Feature group: Model registry, Provider detail (/providers/:id), Task 9 — Trace Model registry, Model mapping

### Community 31 - "Partial stream failure"
Cohesion: 0.83
Nodes (4): fallback.partial-stream-failure, Truncated stream or error event → PROVIDER_UNAVAILABLE with details.partial, Stream headers only after the first chunk: earlier failures are real JSON statuses, Golden scenario: partial stream failure

### Community 32 - "Lean code rules"
Cohesion: 0.50
Nodes (4): §15 Code quality — shortest CLEAR implementation, not shortest possible, Rule 1 — Write LEAN code, no over-engineering, Rule 2 — Code must be maintainable, no magic values or hidden side effects, Rule 12 — Priority order: Correctness → Simplicity → Maintainability → Predictable resources → Latency → Throughput → Optimization

### Community 33 - "Architecture independence principles"
Cohesion: 0.67
Nodes (3): §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra), §9 Build an explicit domain model (Provider, Quota, RoutingPolicy…), §11 Providers reached only through a port (AIProviderPort)

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
- **Why does `Bounded context: routing (core)` connect `Gap register and discovery principles` to `Dashboard screens, usage and overview APIs`, `Registry build and capability resolution`, `Provider adapters and connection tests`, `Generated discovery outputs and inventory`, `API keys`, `Credential validation and provider screens`, `Settings, combos and database export`, `Rewrite lanes, model listing and fallback`, `Upstream error results and default executor`, `Error classification and request translation`, `Header extraction and OpenAI chat protocol`, `Anthropic Messages client protocol (SP15)`, `Media providers`, `Catalog bounded context`?**
  _High betweenness centrality (0.125) - this node is a cross-community bridge._
- **Why does `OpenAICompatibleAdapter (AIProviderPort for openai-compatible)` connect `Upstream error results and default executor` to `Registry build and capability resolution`, `Provider adapters and connection tests`, `Provider connections and per-connection data`, `Outbound proxy, retry budget and transport`, `Custom provider nodes`, `Credential validation and provider screens`, `Rewrite lanes, model listing and fallback`, `Error classification and request translation`, `Stream mode and OpenAI chat mapping`, `Streaming pipeline and idle timeout`, `Partial stream failure`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._