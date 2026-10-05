# Graph Report - aigate  (2026-09-30)

## Corpus Check
- 435 files · ~759,194 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 3, .example 1, .css 1)

## Summary
- 4877 nodes · 12067 edges · 197 communities (173 shown, 14 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 549 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a79f70f9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Credential
- record
- ConnectionsRepository
- OAuth sign-in contract (M2 SP16)
- auth.controller.ts
- provider-node.ts
- chat-lane.ts
- @nestjs/common
- ChatLane
- gateway/screens.tsx
- providers/screens.tsx
- OpenAICompatibleAdapter (AIProviderPort for openai-compatible)
- openai-compatible.ts
- providers/api.ts
- useToast
- engine/src/index.ts
- EngineError
- replay.mjs
- anthropic.ts
- ConnectionsController — /api/connections CRUD + POST /:id/test (validateCredential outside any transaction)
- app/screens.tsx
- Milestone M-1 · Discovery
- AnthropicAdapter — CIP <-> Messages (max_tokens rules, thinking budgets, tool_use, SSE events)
- isRecord
- speech-lane.ts
- Bounded context: transport
- SP13 — catalog → runtime registry (41 connectable providers, /api/providers, /providers wired)
- quota.service.ts
- provider-nodes.repo.ts
- vertex.ts
- Identity and API keys contract (M1 SP6)
- pricing.repo.ts
- database/src/index.ts
- Bounded context: routing (core)
- api-keys.repo.ts
- scripts
- ChatLane (modules/routing/infrastructure/chat-lane.ts)
- cursor.ts
- Request routing
- Feature Matrix — mandatory 17-column artifact
- registry.ts
- OAuthController
- lane-helpers.mjs
- Overview — /
- GeminiAdapter — CIP <-> generateContent / streamGenerateContent?alt=sse (x-goog-api-key, safety off, thinking level/budget, 400 key test = invalid)
- traffic/api.ts
- Bounded context: identity
- ProviderNodesController — /api/provider-nodes CRUD; PREFIX_RESERVED / PREFIX_TAKEN / NODE_LIMIT
- web/package.json
- usage.tsx
- openai-chat.ts
- OAuth providers
- combos.repo.ts
- API ↔ UI map (docs/design/API_UI_MAP.md)
- cursor.test.mjs
- Bounded context: tooling
- anthropic-messages.ts
- requests.controller.ts
- direct-transport.ts
- json
- AIGate — Capability Specification
- gemini.ts
- Parity verification — 3 tiers
- CommandCodeAdapter — envelope, NDJSON events via readJsonLines, peek with in-band error classification and 5xx retries, collapse for non-streaming clients, ping test
- OpenAIResponsesAdapter — CIP <-> Responses API (extends OpenAICompatibleAdapter; 9router request and stream, corrected non-stream)
- rtk.ts
- Providers
- protocols/openai-responses.ts
- .constructor
- helpers.mjs
- DirectTransport (direct branch implementation)
- Settings
- SettingsRepository
- builtin-registry.ts
- CustomModelsRepository
- usage.repo.ts
- network/api.ts
- CLI Tools
- database/package.json
- Model import and custom models contract (M2 SP16a)
- Descriptor connectionFields + withConnection(): {field} URL tokens filled per connection (encoded), OpenAI-Organization header, {model} filled per request
- clients.ts
- conformance.mjs
- catalog.controller.ts
- domain/usage.ts
- body
- discovery/package.json
- Translation
- Combo / Vision Adapter
- Translation / language functionality
- SP0 — 2 skills + mechanical lint suite
- ResponsesStreamEncoder
- src/schema.ts
- Port behavior, not code
- models.tsx
- 06-combo-capacity-adapter.yaml
- Usage
- UsageRecorder
- protocols/gemini-generate.ts — path parsing, text-only request, GenerateContentResponse, Gemini SSE encoder, model list, TTS request
- openai-adapter.test.mjs
- Media Providers
- gemini-generate.ts
- anthropic-adapter.test.mjs
- vertex-adapter.test.mjs
- inventory.ts
- Bounded patterns
- Proxy Pools
- database.ts
- compilerOptions
- Token Saver
- Provider authentication
- Milestone M1 · Walking skeleton (thin end-to-end slice)
- src/pricing.ts
- cli.ts
- coverage.ts
- ready
- compilerOptions
- compilerOptions
- engine/package.json
- OpenAIChatStreamEncoder
- thinking.ts
- gemini-adapter.test.mjs
- ollama-adapter.test.mjs
- openai-protocol.test.mjs
- compilerOptions
- dependencies
- .summary
- Endpoint & API Key
- Rule 4 — Every workload must be BOUNDED
- GithubAdapter
- AnthropicStreamEncoder
- commandcode-adapter.test.mjs
- connection-data.test.mjs
- github-copilot.test.mjs
- openai-responses-adapter.test.mjs
- Body
- parity/package.json
- .test
- Rule 1 — Write LEAN code, no over-engineering
- usage-meter.ts
- Model mapping
- Model registry
- Usage contract (M2 SP24a, SP24b)
- catalog/schema.ts
- claude-codex.test.mjs
- gemini-cli.test.mjs
- Remote functionality
- Multi-account
- compilerOptions
- `porting-behavior-not-code` RED baseline
- `writing-lean-bounded-code` RED baseline
- Database
- Provider account management
- AIGate — Project Map
- GeminiStreamEncoder
- engine.test.mjs
- responses-protocol.test.mjs
- scripts
- usage.test.mjs
- Quota Tracker
- Speech contract (M2 SP23)
- AIGate schema conventions
- .stream
- OAuthProvider
- anthropic-protocol.test.mjs
- antigravity.test.mjs
- SPIKE-1: SQLite drivers through Drizzle
- trae.test.mjs
- Hoàn thiện SP23: TTS lane + voice listing + preview
- SP24a: ghi usage, cost theo pricing, thống kê, SSE live, màn Usage và chỉnh giá
- SP24b: request detail (metadata + attempts), usage của media lanes, màn Requests
- DatabaseShutdown
- claude-codex-lane.test.mjs
- Token Saver contract (M2 SP21)
- Gap register
- SP0.6 skill discovery
- scripts
- Names
- AIGate
- Parity report (M1 gate)
- antigravity-config.ts
- toDescriptor
- Registry
- gemini-protocol.test.mjs
- secret-cipher.test.mjs
- provider
- web/CLAUDE.md

## God Nodes (most connected - your core abstractions)
1. `Credential` - 142 edges
2. `record()` - 111 edges
3. `text()` - 107 edges
4. `ExecCtx` - 106 edges
5. `CanonicalRequest` - 94 edges
6. `EngineError` - 78 edges
7. `api()` - 77 edges
8. `isRecord()` - 76 edges
9. `parseJson()` - 76 edges
10. `toProblem()` - 59 edges

## Surprising Connections (you probably didn't know these)
- `Keyless proxy strategy panel with empty state` --extends--> `Proxy Pools — /network/proxy-pools`  [EXTRACTED]
  apps/web/src/features/network/screens.tsx → docs/superpowers/specs/2026-09-22-aigate-design.md
- `Platform-specific hosted relay deploy wizard` --extends--> `Proxy Pools — /network/proxy-pools`  [EXTRACTED]
  apps/web/src/features/network/screens.tsx → docs/superpowers/specs/2026-09-22-aigate-design.md
- `Framework-free thinking suffix parser and override` --feeds--> `Model resolution: provider/model (any id) or a bare catalog id; 404 model_not_found / no_active_connection`  [EXTRACTED]
  packages/engine/src/thinking.ts → docs/contracts/chat-lane.md
- `Trae browser sign-in and callback/token import UI` --wires--> `Connections & AuthFlow — /providers/connections`  [EXTRACTED]
  apps/web/src/features/providers/sign-in.tsx → docs/superpowers/specs/2026-09-22-aigate-design.md
- `Durable account and model lock storage` --implements--> `AccountLock entity`  [EXTRACTED]
  packages/database/src/schema/connections.ts → docs/superpowers/specs/2026-09-22-aigate-design.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **SP10 round trip: parse → CIP → provider adapter → render / encode** — protocol_parse_openai_chat, concept_cip, adapter_openai_compatible, protocol_completion_renderer, protocol_stream_encoder [EXTRACTED 1.00]
- **SP11 test flow: UI Test → controller → decrypt → validateCredential → guarded write → toast** — web_test_result, docs_contracts_connections_controller, secret_cipher_aes_gcm, adapter_validate_credential, docs_contracts_connections_stale_test_guard [EXTRACTED 1.00]
- **SP12 request path: key gate → parse → resolve + capabilities → adapter → encode with backpressure** — docs_contracts_chat_lane_key_gate, protocol_parse_openai_chat, docs_contracts_chat_lane_model_resolution, adapter_openai_compatible, protocol_stream_encoder, docs_contracts_chat_lane_backpressure [EXTRACTED 1.00]
- **Anthropic-compatible custom providers: storage, descriptor, adapter headers, connection test, UI** — provider_nodes_type_column, anthropic_node_descriptor, anthropic_node_betas, anthropic_node_connection_test, node_rules_unreachable, anthropic_adapter [EXTRACTED 1.00]
- **OpenAI Responses family: adapter, non-stream read, 9router stream, apiType custom providers** — openai_responses_adapter, responses_non_stream_read, responses_stream_9router, provider_nodes_api_type_column, create_adapter [EXTRACTED 1.00]
- **Ollama family: adapter, NDJSON reader, per-connection host and optional key, connections UI** — ollama_adapter, read_json_lines, connection_base_url, screen_connections_ollama_host, create_adapter [EXTRACTED 1.00]
- **Gemini family: adapter, schema cleaner, signature cache, CIP image chunk and finish override** — gemini_adapter, gemini_schema_cleaner, gemini_signature_cache, cip_image_delta_finish_override, create_adapter [EXTRACTED 1.00]
- **Vertex family: Google Cloud auth, Vertex and partner adapters, JSON credential connections and field** — google_auth, vertex_adapter, vertex_partner_adapter, json_credential_connections, screen_connections_google_key [EXTRACTED 1.00]
- **Per-connection data: descriptor fields, withConnection, chat probe, migration 0008, connection fields UI** — connection_fields_descriptor, chat_probe_test, connection_data_columns, screen_connections_fields, clinepass_envelope_headers [EXTRACTED 1.00]
- **SP3 replay loop: tape → AIGate (stubbed vendor) → normalizer → judge against 9router with declared deviations** — docs_contracts_parity_tapes, docs_contracts_chat_lane_service, docs_contracts_parity_normalizer, docs_contracts_parity_judge, docs_contracts_parity_deviations [EXTRACTED 1.00]
- **SP4 loop: 9router registry → extract → CATALOG → verify diff (0) + validateCatalog** — extract_tool, catalog_generated, extract_verify, catalog_schema, rule_no_invented_limits [EXTRACTED 1.00]
- **SP9 adapter failure path: classify, retry transient, fail partial streams** — adapter_status_classification, adapter_retry_transient, adapter_partial_stream_error, docs_contracts_engine_fallback_policy_data, docs_contracts_engine_with_retry [EXTRACTED 1.00]
- **API key lifecycle (create once, list masked, enable/disable, revoke, validate for /v1)** — docs_design_api_ui_map_get_api_keys, docs_design_api_ui_map_post_api_keys, docs_design_api_ui_map_patch_api_keys_id, docs_design_api_ui_map_delete_api_keys_id, docs_design_api_ui_map_screen_endpoint_keys, docs_contracts_identity_apikeys_api_key_format, docs_contracts_identity_apikeys_is_valid, docs_contracts_identity_apikeys_extract_api_key [EXTRACTED 1.00]
- **Dashboard auth flow (status → setup/login → session → logout/password change)** — docs_design_api_ui_map_get_api_auth_status, docs_design_api_ui_map_post_api_auth_setup, docs_design_api_ui_map_post_api_auth_login, docs_design_api_ui_map_post_api_auth_logout, docs_design_api_ui_map_post_api_auth_password, docs_design_api_ui_map_screen_shell_gate, docs_design_api_ui_map_screen_welcome_onboarding, docs_design_api_ui_map_screen_login, docs_design_api_ui_map_screen_settings_auth, docs_contracts_identity_apikeys_session_store [EXTRACTED 1.00]
- **CIP request flow: ProtocolAdapter(in) → CanonicalRequest → RoutingEngine → ProviderAdapter → Vendor** — concept_cip, ctx_routing, port_ai_provider, port_http_transport, concept_vendor_extensions [EXTRACTED 1.00]
- **Discovery pipeline: inventory + matrix validation → coverage → capabilities** — tool_inventory, tool_validate, tool_coverage, tool_capabilities, tool_cli, artifact_capabilities_md [EXTRACTED 1.00]
- **M-1 exit gate: matrix valid, 23 groups, every route and repo cited** — task_19_exit_gate, tool_gate_test, concept_23_feature_groups, artifact_capabilities_md, docs_discovery_coverage, artifact_gaps_md [EXTRACTED 1.00]
- **M1 walking skeleton — one streaming chat completion end to end** — ms_m1, sp_sp5, sp_sp6, sp_sp7, sp_sp8, sp_sp9, sp_sp10, sp_sp11, sp_sp12, parity_tier1_client_contract, parity_tier2_vendor_acceptance [EXTRACTED 1.00]
- **Screens sharing the list/detail (master-detail) pattern** — screen_llm_providers, screen_provider_detail, screen_requests, screen_request_detail, screen_cli_tools, screen_cli_tool_detail, screen_media_providers, screen_routing_fallback [EXTRACTED 1.00]
- **Overview screen aggregates data 9router scattered across three places** — screen_overview, entity_account_lock, ctx_connections, ctx_usage, group_quota_tracker, sp_u8 [EXTRACTED 1.00]
- **The seven nav groups forming the identical sidebar shell owned by U1** — nav_group_overview, nav_group_gateway, nav_group_providers, nav_group_traffic, nav_group_network, nav_group_integrations, nav_group_settings, ds_sidebar_nav, sp_u1 [EXTRACTED 1.00]
- **The three required states contract that U0 must implement across every lane** — ds_state_loading, ds_state_empty, ds_state_error, sp_u0, audit_happy_path_only [EXTRACTED 1.00]
- **Tracing protocol labelling and evidence discipline** — concept_tracing_protocol, label_reference_behavior, label_suspected_bug, label_implementation_accident, concept_suspicion_block, concept_evidence_file_line, concept_parity_status [EXTRACTED 1.00]
- **Catalog → registry → /api/providers → /providers screens** — catalog_generated, builtin_registry_catalog, catalog_controller, hook_use_providers, docs_design_api_ui_map_screen_llm_providers_wired, docs_design_api_ui_map_screen_provider_detail_wired [EXTRACTED 1.00]
- **Custom provider: form → /api/provider-nodes → connection → /v1 <prefix>/<model>** — screen_custom_provider_form, hook_use_provider_nodes, provider_nodes_controller, provider_nodes_repo, docs_contracts_connections_controller, chat_lane_custom_prefix [EXTRACTED 1.00]
- **Adapters chosen by protocol family behind AIProviderPort** — create_adapter, adapter_openai_compatible, anthropic_adapter, http_provider_adapter, provider_protocols [EXTRACTED 1.00]
- **Deferred SP0.1 rules enforced in lint by SP8** — lint_fetch_through_transport, lint_retry_through_helper, lint_fetch_timeout, lint_check_tests, sp_sp0_1 [EXTRACTED 1.00]
- **SP8 transport stack: port, direct implementation, module, bounded reader** — port_http_transport, docs_contracts_transport_direct_transport, docs_contracts_transport_module, docs_contracts_transport_read_bounded_text, transport_http_request, transport_http_response [EXTRACTED 1.00]
- **UI error pipeline (ApiError → toProblem → toast/inline/redirect)** — docs_design_api_ui_map_shared_api_client, docs_design_api_ui_map_to_problem, apps_web_src_shared_errors_test, docs_design_ui_handoff_use_toast, docs_design_api_ui_map_err_unauthenticated, docs_design_api_ui_map_screen_shell_gate, docs_design_api_ui_map_rule_failed_mutation_rereads [EXTRACTED 1.00]

## Communities (197 total, 14 thin omitted)

### Community 0 - "Credential"
Cohesion: 0.06
Nodes (42): handleSubmit(), AntigravityAdapter, collected(), CommandCodeAdapter, eventOf(), GeminiCliAdapter, GeminiAdapter, MODELS_HEADERS (+34 more)

### Community 1 - "record"
Cohesion: 0.04
Nodes (105): nodeBetas(), cloakTools(), hoistToolResultImages(), cloudCodeCall(), codeAssistMetadata(), defaultTier(), discover(), errorMessage() (+97 more)

### Community 2 - "ConnectionsRepository"
Cohesion: 0.05
Nodes (54): ConnectionChanges, keyHint(), maskHint(), refreshContext(), sealContext(), checkForProvider(), ConnectionsController, credentialOf() (+46 more)

### Community 3 - "OAuth sign-in contract (M2 SP16)"
Cohesion: 0.05
Nodes (65): AntigravityAdapter - daily Cloud Code envelope, Gemini/Claude/image requests, Antigravity Google OAuth, userinfo, loadCodeAssist and onboarding, adapters/claude-code.ts (prepareClaudeRequest, billing header, user id, _ide + decoys), claude sign-in (claude.ai PKCE, code#state, 4 h lead), adapters/codex.ts (CodexExecutor body, compact URL, model list), codex sign-in (fixed localhost:1455 callback pasted back, id_token account, 5-day lead, 8-day age), adapters/collect.ts (stream collected into one response), copilotChatBody (Copilot part and parameter rules) (+57 more)

### Community 4 - "auth.controller.ts"
Cohesion: 0.06
Nodes (50): field(), givenPassword(), newPassword(), Parsed, parseLogin(), parsePasswordChange(), parseSetup(), validateInitialPassword() (+42 more)

### Community 5 - "provider-node.ts"
Cohesion: 0.05
Nodes (64): asBody(), ConnectionFields, DATA_FIELD_NAMES, DATA_FIELDS, DataField, fail(), isJsonCredential(), MAX_NAME (+56 more)

### Community 6 - "chat-lane.ts"
Cohesion: 0.04
Nodes (72): callsTools(), CapacityPool, fits(), HARD, hardNeeds(), isCapacityCapability(), LABEL, messagesLength() (+64 more)

### Community 7 - "@nestjs/common"
Cohesion: 0.04
Nodes (56): AppModule, Module, DATABASE, DatabaseModule, Global, Module, HealthController, Controller (+48 more)

### Community 8 - "ChatLane"
Cohesion: 0.08
Nodes (23): extractApiKey(), isReservedPrefix(), Widening, answerOf(), ChatLane, claudeCodePrompt(), ClientGone, deadline() (+15 more)

### Community 9 - "gateway/screens.tsx"
Cohesion: 0.06
Nodes (66): ApiKey, CapacityCapability, capacityKey, CapacityPool, CapacityPoolFields, ChatReadiness, Combo, ComboFields (+58 more)

### Community 10 - "providers/screens.tsx"
Cohesion: 0.06
Nodes (63): ApiType, Connection, HeaderInput, nodePath(), NodeType, ProviderNode, TestStatus, ThinkingLevel (+55 more)

### Community 11 - "OpenAICompatibleAdapter (AIProviderPort for openai-compatible)"
Cohesion: 0.08
Nodes (44): CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), OpenAICompatibleAdapter (AIProviderPort for openai-compatible), Truncated stream or error event → PROVIDER_UNAVAILABLE with details.partial, packages/engine/test/openai-adapter.test.mjs (15 tests, fake transport, SSE split every 3 bytes; 16 mutations caught), Refused before I/O: video, media by URL, assistant thinking, tool_result.isError, budgetTokens, foreign vendorExtensions, TokenUsage normalized: inputTokens excludes cache reads, outputTokens includes reasoning, OpenAI Chat cache_control on messages and text parts (CanonicalMessage.cacheControl), Canonical Internal Protocol (CIP) (+36 more)

### Community 12 - "openai-compatible.ts"
Cohesion: 0.06
Nodes (62): COMMIT_EVENTS, FINISH, finishOf(), GUESSES, joinText(), Opened, reasoningEffort(), Tally (+54 more)

### Community 13 - "providers/api.ts"
Cohesion: 0.08
Nodes (59): ConnectionField, ConnectionQuota, connectionsKey, cursorAutoImport, customKey(), CustomModel, customPath(), DeviceCode (+51 more)

### Community 14 - "useToast"
Cohesion: 0.07
Nodes (49): extraRoutes, navigation, ScreenView(), currentLabel(), Shell(), previewTtsVoice(), TtsVoice, useProvider() (+41 more)

### Community 15 - "engine/src/index.ts"
Cohesion: 0.06
Nodes (47): GoogleCredential, STREAM_RETRY_DELAY_MS, CATALOG, CatalogProvider, mediaService, mediaServiceDescriptor(), mediaServices, SERVICES (+39 more)

### Community 16 - "EngineError"
Cohesion: 0.06
Nodes (37): responseFrames(), HttpProviderAdapter, isTransient(), asBase64(), cache, catText(), clean(), crc32() (+29 more)

### Community 17 - "replay.mjs"
Cohesion: 0.08
Nodes (43): [command, ...args], golden(), main(), option(), report(), ROOT, capabilityIds(), coverage() (+35 more)

### Community 18 - "anthropic.ts"
Cohesion: 0.07
Nodes (42): AnthropicAdapter, assistantBlock(), CONTENT_BLOCKS, HEAVY_AGENT_BETAS, imageBlock(), NO_NAMES, NODE_BETAS, openaiExtensions() (+34 more)

### Community 19 - "ConnectionsController — /api/connections CRUD + POST /:id/test (validateCredential outside any transaction)"
Cohesion: 0.09
Nodes (36): Descriptor auth.optional + connectionBaseUrl; withConnectionBaseUrl(); provider_connections.base_url (migration 0007), Decision (user, 2026-09-25): AES-GCM with a key file and an env override; SP11 connects OpenAI only, Connections contract (M1 SP11), ConnectionsController — /api/connections CRUD + POST /:id/test (validateCredential outside any transaction), ConnectionsRepository — allowlisted view, onConflictDoNothing → 409, stale-test guard on sealed key, Rule: a test result is written only if the sealed key is unchanged, Test outcomes: active · invalid (AUTH_ERROR) · no_quota (QUOTA_EXHAUSTED) · unreachable (not checked), apps/server/test/connections.test.mjs (7) + secret-cipher.test.mjs (3); 16 mutations caught; live OpenAI smoke (+28 more)

### Community 20 - "app/screens.tsx"
Cohesion: 0.10
Nodes (47): Member, modeDetails, Probe, Routing(), CliToolDetail(), CliTools(), Mcp(), Skills() (+39 more)

### Community 21 - "Milestone M-1 · Discovery"
Cohesion: 0.06
Nodes (58): docs/capabilities.md (GENERATED capability specification), docs/discovery/inventory.json, Feature Matrix entry template (null never "" or "N/A"), Evidence with file:line — traced is a test, not a self-declaration, Fixed inventory counts (154 routes, 28 pages, 123 providers, 29 executors, 48 translators, 11 repos, 14 OAuth routes), parityStatus lifecycle (not-started → traced → contracted → implemented → verified), suspicion block — expected / actual / impact, Constraint — no Phase C contracts during discovery (+50 more)

### Community 22 - "AnthropicAdapter — CIP <-> Messages (max_tokens rules, thinking budgets, tool_use, SSE events)"
Cohesion: 0.08
Nodes (37): AnthropicAdapter — CIP <-> Messages (max_tokens rules, thinking budgets, tool_use, SSE events), packages/engine/test/anthropic-adapter.test.mjs (10) + apps/server/test/anthropic-lane.test.mjs (4); 23 mutations caught, Deviations not ported: stop/top_p kept, none stays none, no Claude Code line, stream errors fail, same stop/usage mapping, 403 invalid, Claude Code anthropic-beta list for claude-* models on an Anthropic node (claude-code flag only on the official host), Anthropic node connection test: POST <base>/v1/messages, claude-3-haiku, only 401/403 invalid (9router), Anthropic node descriptor: <base>/messages, x-api-key, Bearer for third-party hosts, anthropicNode { official }, CodeBuddy quirks: reasoningSummary (cn, intl), neutralAgentPrompt (cn) via EXECUTOR_QUIRKS, createAdapter(provider, transport) — adapter chosen by protocol family (+29 more)

### Community 23 - "isRecord"
Cohesion: 0.07
Nodes (49): imageAspect(), imageModel(), normalizeContents(), PROMPT_REWRITES, rewrite(), sanitize(), sessionId(), sessions (+41 more)

### Community 24 - "speech-lane.ts"
Cohesion: 0.07
Nodes (34): CHAT_LIMITS, fallbackCooldown(), mediaCooldown(), REQUEST_BUDGET_MS, audioType(), badRequest(), decodeFailure(), formatOf() (+26 more)

### Community 25 - "Bounded context: transport"
Cohesion: 0.14
Nodes (33): Audit PASS: no credential leaked across 27 HTML exports, Audit FAIL: only the happy path was drawn (state rules §10.7), Audit finding: MITM CA buttons adjacent, type-to-confirm modal missing, Minimal frontend state management, Web stack (Vite, TanStack Router/Query/Virtual, RHF+zod, Tailwind+Radix, Recharts, i18next), Hard constraint: tunnel requires 'Require API key' enabled, Bounded context: transport, Decision: do NOT clone 9Remote (+25 more)

### Community 26 - "SP13 — catalog → runtime registry (41 connectable providers, /api/providers, /providers wired)"
Cohesion: 0.12
Nodes (27): Adapter: catalog headers first, key last; raw or Bearer scheme; chatUrl/modelsUrl called directly, ListedModel { id, descriptor? } — getModels never invents limits (≤1000 ids), GET /api/providers/:id (chatUrl + models; 404 NOT_FOUND), GET /api/providers (all 121, connectable + reason), builtinRegistry built from CATALOG (41 connectable providers), apps/server/test/catalog.test.mjs (catalog API) + chat-lane resolution tests, CatalogController — GET /api/providers, GET /api/providers/:id, CATALOG — providers.generated.ts (121 providers, 935 models; never hand-edited) (+19 more)

### Community 27 - "quota.service.ts"
Cohesion: 0.11
Nodes (33): ConnectionView, QuotaController, Controller, Get, Header, Param, Post, CacheEntry (+25 more)

### Community 28 - "provider-nodes.repo.ts"
Cohesion: 0.06
Nodes (33): devDependencies, @types/node, typescript, @aigate/engine, drizzle-orm, @types/node, typescript, name (+25 more)

### Community 29 - "vertex.ts"
Cohesion: 0.09
Nodes (27): CLOUD_CODE, CLOUD_SHELL, LOOKUP_HEADERS, GEMINI_CLI_THOUGHT_SIGNATURE, b64url(), cacheKey(), googleAccessToken(), jsonPart() (+19 more)

### Community 30 - "Identity and API keys contract (M1 SP6)"
Cohesion: 0.05
Nodes (101): apikey.delete-key, apikey.generate-key, apikey.legacy-format-unenforced, apikey.list-keys, apikey.update-key-status, apikey.validate-lookup, identity.auth-status-disclosure, identity.machine-id-derivation (+93 more)

### Community 31 - "pricing.repo.ts"
Cohesion: 0.09
Nodes (26): isField(), isObject(), MAX_OVERRIDES, MAX_PATCH_MODELS, parsePricingPatch(), PriceEdit, validId(), invalid() (+18 more)

### Community 32 - "database/src/index.ts"
Cohesion: 0.09
Nodes (34): apiKeys, customModels, providerThinking, THINKING_LEVEL_VALUES, accountLocks, AUTH_TYPES, AuthType, providerConnections (+26 more)

### Community 33 - "Bounded context: routing (core)"
Cohesion: 0.13
Nodes (33): docs/discovery/gaps.md (Gap register), Routing → Capacity adapter tab (Vision, Audio input pools), Routing → Combo tab + ComboCreate create/edit, sticky limit, Canonical Internal Protocol, Routing simulator (decision-tree dry run), Bounded context: routing (core), /gateway/routing*, /gateway/token-saver → Routing (Combo and Capacity adapter tabs wired), ComboCreate, TokenSaver, Create-combo form — UI-only local draft shape (name, strategy, models, fusion) (+25 more)

### Community 34 - "api-keys.repo.ts"
Cohesion: 0.09
Nodes (27): Headers, isWellFormedKey(), KEY_PREFIX, maskKey(), MAX_KEYS, onlyKey(), Parsed, parseKeyName() (+19 more)

### Community 35 - "scripts"
Cohesion: 0.06
Nodes (35): devDependencies, dependency-cruiser, eslint, eslint-plugin-boundaries, typescript-eslint, engines, node, name (+27 more)

### Community 36 - "ChatLane (modules/routing/infrastructure/chat-lane.ts)"
Cohesion: 0.07
Nodes (43): endpoint.extract-header-order, endpoint.rewrite-lanes, settings.combo-rotation-reset, Durable account and model lock storage, readSseData() — bounded SSE reader (1 Mi chars per line/event, cancels body), ChatLane.adapted / widening / member: solo and combo widening, trimmed pool calls, CapacityPoolsRepository: four cached pools, per-pool rotation, capacity_pools table (migration 0019) (+35 more)

### Community 37 - "cursor.ts"
Cohesion: 0.12
Nodes (29): agentBody(), agentValue(), checksum(), CursorAdapter, cursorHeaders(), decode(), decodeAgentValue(), decoder (+21 more)

### Community 38 - "Request routing"
Cohesion: 0.06
Nodes (36): A copied provider/model(level) id resolves the base catalog model and makes the suffix override request and provider-default thinking, A forceStream provider in the chat completions format answering a client that did not ask to stream: the SSE body is collapsed into one chat.completion, AWS CodeWhisperer/Amazon Q request shaping and binary EventStream response decoding, Body parse, 1M-context marker strip, API-key gate, missing-model check, Cancelling the upstream request when the client goes away, Chat-lane route handlers that hand the request to handleChat, Choosing forced SSE-to-JSON, plain JSON, or streaming handling for a 2xx response, Choosing the upstream format and endpoint (runtime transport) (+28 more)

### Community 39 - "Feature Matrix — mandatory 17-column artifact"
Cohesion: 0.10
Nodes (52): validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, The 23 feature groups required by behavioral.md §5, AuthFlow — declarative, data-driven auth step framework, 9router as Behavioral Source of Truth (not a template to port), Definition of Done — 13 items, not self-awarded, AIGate domain model (Provider, Credential, RoutingPolicy, AccountLock, …), Feature Matrix — mandatory 17-column artifact, IMPLEMENTATION_ACCIDENT — debt not inherited from 9router (+44 more)

### Community 40 - "registry.ts"
Cohesion: 0.09
Nodes (19): deviceModel(), KimiAdapter, OAuthFlow, OAuthIO, HttpTransportPort, checkProvider(), checkUrl(), CONNECTION_FIELDS (+11 more)

### Community 41 - "OAuthController"
Cohesion: 0.15
Nodes (14): flowError(), invalid(), OAuthController, objectRecord(), stringifyQuery(), strings(), Controller, Get (+6 more)

### Community 42 - "lane-helpers.mjs"
Cohesion: 0.12
Nodes (19): encoder, streamed(), audio, stream, chunk(), completion, encoder, events() (+11 more)

### Community 43 - "Overview — /"
Cohesion: 0.09
Nodes (43): usage.write-not-synchronous, Audit finding: Console shown in sidebar regardless of Developer mode, Audit finding: routing-fallback merged 4 tabs into one 3886px screen, New IA — 7 groups organised by user job, Critique of 9router's information architecture, Port law — a port exists only with a real second implementation or a mandatory I/O fake boundary, Quota provenance — vendor-reported vs self-derived, Screen state conventions (loading, refetch, empty, error, live, destructive, optimistic) (+35 more)

### Community 44 - "GeminiAdapter — CIP <-> generateContent / streamGenerateContent?alt=sse (x-goog-api-key, safety off, thinking level/budget, 400 key test = invalid)"
Cohesion: 0.13
Nodes (26): CIP image_delta chunk (delta.images) and vendorExtensions.openai.finish_reason honoured by the OpenAI renderer, User decision 2026-09-26: SP14e keeps 9router's Gemini request drops and answer mapping; only the schema cleaner is corrected, User decision 2026-09-26: SP14f scope vertex only; qoder not ported; correct signatures, tokens, test, location; keep bounded project probe, Gemini provider contract (M2 SP14e), Vertex AI provider contract (M2 SP14f), API_UI_MAP row: SP14e Gemini adapter (no new screen; Key rejected on a 400), API_UI_MAP row: SP14f Vertex adapters and the JSON credential field, connection.vertex-credential-test (+18 more)

### Community 45 - "traffic/api.ts"
Cohesion: 0.08
Nodes (32): useProviderNodes(), Attempt, ChartBucket, chartKey, Counters, LiveUsage, MAX_REQUEST_ROWS, PeriodQuery (+24 more)

### Community 46 - "Bounded context: identity"
Cohesion: 0.23
Nodes (23): Audit finding: settings-auth regenerated as settings-auth-v2, Audit finding: login-callback / deploy-wizard / authflow-modals are showcases, not routes, Audit FAIL: sidebar not identical across screens, The Tracing Protocol (6 steps, applied by Tasks 6–18), Bounded context: apikeys, Bounded context: identity, Bounded context: settings, /settings/auth OIDC and SAML tabs (+15 more)

### Community 47 - "ProviderNodesController — /api/provider-nodes CRUD; PREFIX_RESERVED / PREFIX_TAKEN / NODE_LIMIT"
Cohesion: 0.08
Nodes (39): DELETE /api/provider-nodes/:id (cascades the connection), GET /api/provider-nodes, PATCH /api/provider-nodes/:id, POST /api/provider-nodes, /v1: <prefix>/<model> reaches a custom provider after built-in ids, aliases, and catalog prefixes, Custom headers - sealed values, hints, validation and merge, Custom provider thinking level, Custom providers contract (M2 SP13b) (+31 more)

### Community 48 - "web/package.json"
Cohesion: 0.06
Nodes (31): dependencies, @radix-ui/react-dialog, react, react-dom, @tanstack/react-query, @tanstack/react-router, devDependencies, tailwindcss (+23 more)

### Community 49 - "usage.tsx"
Cohesion: 0.15
Nodes (28): periodParams(), useLiveUsage(), useUsageChart(), useUsageSummary(), CostChart(), Frame(), Legend(), PAD (+20 more)

### Community 50 - "openai-chat.ts"
Cohesion: 0.22
Nodes (31): array(), AUDIO_MEDIA_TYPES, cacheMark(), ERROR_SHAPES, FINISH_REASONS, invalid(), mediaSource(), messageMark() (+23 more)

### Community 51 - "OAuth providers"
Cohesion: 0.06
Nodes (31): antigravity: Google OAuth with the public Antigravity client, the IDE's Cloud Code endpoint daily-cloudcode-pa.googleapis.com, Gemini and Claude models in one envelope, image generation, IDE request ids, Browser-assisted desktop login start and status polling, Browser login through GetLoginGuidance and loopback callback, plus Cloud-IDE-JWT token import, claude: PKCE sign-in at claude.ai, Messages at api.anthropic.com with Claude Code headers and, for sk-ant-oat tokens, cloaking, Cline and ClinePass sign-in, token format, refresh, and request headers, CodeBuddy browser state flow, OAuth token refresh, and stream-only OpenAI chat, codex: PKCE sign-in at auth.openai.com with a fixed 1455 callback, Responses at chatgpt.com/backend-api/codex, gemini-cli: Google OAuth with the public Gemini CLI client, project discovery through loadCodeAssist, generateContent wrapped in the Cloud Code envelope at cloudcode-pa.googleapis.com/v1internal (+23 more)

### Community 52 - "combos.repo.ts"
Cohesion: 0.11
Nodes (23): Combo, ComboFields, selfReference(), CombosController, invalid(), missing(), taken(), Controller (+15 more)

### Community 53 - "API ↔ UI map (docs/design/API_UI_MAP.md)"
Cohesion: 0.08
Nodes (46): catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, transport.proxy-priority-chain, Engine contract (M1 SP7), ExecCtx (one shared client-cancel + deadline signal), dependency-cruiser rule engine-framework-free (+38 more)

### Community 54 - "cursor.test.mjs"
Cohesion: 0.09
Nodes (18): request(), transport, credential, ctx, encoder, f(), frame(), frames() (+10 more)

### Community 55 - "Bounded context: tooling"
Cohesion: 0.32
Nodes (16): CLI-tool config writes require diff preview + backup, Bounded context: tooling, /integrations/* → CliTools, CliToolDetail, Skills, Mcp, Feature group: CLI Tools, Feature group: Console Log, Feature group — MCP (API with no UI, found during spec work), Feature group: Skills, 12-integrations.yaml (+8 more)

### Community 56 - "anthropic-messages.ts"
Cohesion: 0.11
Nodes (28): ToolChoice, adjustMaxTokens(), AnthropicClientRequest, anthropicRequestFor(), BUDGET_PROTOCOLS, countBlock(), countChars(), effortFor() (+20 more)

### Community 57 - "requests.controller.ts"
Cohesion: 0.12
Nodes (18): decodeCursor(), encodeCursor(), instant(), invalid(), Query, RequestsController, text(), Controller (+10 more)

### Community 58 - "direct-transport.ts"
Cohesion: 0.13
Nodes (21): allowedUrl(), asErrno(), classifiedBody(), classify(), DirectTransport, dispatcher(), dnsCache, envProxy() (+13 more)

### Community 59 - "json"
Cohesion: 0.10
Nodes (13): image, limited(), said(), limited(), said(), tools, errorOf(), json() (+5 more)

### Community 60 - "AIGate — Capability Specification"
Cohesion: 0.07
Nodes (27): AIGate — Capability Specification, API-key providers, Auto fallback, BaseExecutor.execute — multi-baseUrl loop and connect timeout, Batched SSE flush timer and log line formatting (ANSI strip, arg serialization), Console Log, Console-log routes live under /api/translator/ instead of a dedicated /api/console-log path, GET /api/providers/kilo/free-models — live fetch plus a 1-hour server-side cache of Kilo's free-tier model list (+19 more)

### Community 61 - "gemini.ts"
Cohesion: 0.12
Nodes (26): applyThinking(), BodyOptions, budgetFloor(), cachedSignature(), familyOf(), FINISH, functionResponse(), Intent (+18 more)

### Community 62 - "Parity verification — 3 tiers"
Cohesion: 0.11
Nodes (32): Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Stated limits of tape-based parity, Parity verification — 3 tiers, Recording proxy + 4-part tape, Normalizer + semantic SSE diff (not chunk diff), pnpm parity record | replay | live | gate, Parity harness contract (M0 SP3) and the M1 acceptance gate (+24 more)

### Community 63 - "CommandCodeAdapter — envelope, NDJSON events via readJsonLines, peek with in-band error classification and 5xx retries, collapse for non-streaming clients, ping test"
Cohesion: 0.16
Nodes (19): protocols/anthropic-messages.ts — parse to CIP, anthropicRequestFor (passthrough for Anthropic, claude→openai rules otherwise), message, SSE encoder, count_tokens, CommandCodeAdapter — envelope, NDJSON events via readJsonLines, peek with in-band error classification and 5xx retries, collapse for non-streaming clients, ping test, User decision 2026-09-27: SP14h keeps 9router request drops/defaults and stream error/end/finish/usage behavior; corrects the connection test; URL images refused and workingDir neutral for security, User decision 2026-09-27: SP15 Anthropic first; OpenAI-shaped errors and 9router non-stream/stream-default kept; real usage, live tool args, signature_delta corrected, Anthropic Messages client protocol contract (M2 SP15), Command Code provider contract (M2 SP14h), API_UI_MAP row: SP14h Command Code adapter (no new screen), API_UI_MAP row: SP15 Anthropic Messages client protocol (+11 more)

### Community 64 - "OpenAIResponsesAdapter — CIP <-> Responses API (extends OpenAICompatibleAdapter; 9router request and stream, corrected non-stream)"
Cohesion: 0.14
Nodes (19): User decision 2026-09-26: SP14c corrects the non-stream answer, keeps 9router request drops and stream error handling, User decision 2026-09-27: SP15b keeps 9router on all four asks (request pivot drops/leaks, SSE shapes, non-stream answer, compact), OpenAI Responses client protocol contract (M2 SP15b), OpenAI Responses provider contract (M2 SP14c), API_UI_MAP row: SP14c Responses adapter (no new screen for perplexity-agent) and the API select on /providers/new, API_UI_MAP row: SP15b OpenAI Responses client protocol, routing.responses-non-stream-answer, translator.openai-to-responses-client-response (+11 more)

### Community 65 - "rtk.ts"
Cohesion: 0.11
Nodes (16): autodetect(), compact(), compressToolOutput(), Filter, filterFind(), filterSearchList(), groupPaths(), applyHeadroomResult() (+8 more)

### Community 66 - "Providers"
Cohesion: 0.07
Nodes (27): A provider exposing more than one wire format for the same account (transport.transports[]), Anthropic-compatible nodes: create and update rules, /v1 precedence, request URL and headers, and the connection test, apiType chat or responses on an OpenAI-compatible node: create, update, id, and the request URL, azure: an Azure OpenAI resource per connection (endpoint, deployment, api-version, organization) and its test, Build PROVIDERS / PROVIDER_OAUTH / PROVIDER_MEDIA from the per-provider registry at module load, Canonical per-provider registry entry contract (REGISTRY_TEMPLATE.js), clinepass with an API key: Cline client headers, the non-stream { success, data } envelope, and the test, cloudflare-ai: the Cloudflare account id per connection, filled into the Workers AI URL, and its test (+19 more)

### Community 67 - "protocols/openai-responses.ts"
Cohesion: 0.13
Nodes (23): CanonicalMessage, CompletionMeta, StreamMeta, CUSTOM_PARAMETERS, DETAILS, EFFORTS, inputItems(), invalid() (+15 more)

### Community 68 - ".constructor"
Cohesion: 0.11
Nodes (13): ProviderThinkingRepository, Inject, Injectable, Inject, PxpipeController, Controller, Get, Header (+5 more)

### Community 69 - "helpers.mjs"
Cohesion: 0.19
Nodes (14): signedIn(), reply, encoder, signedIn(), boot(), PASSWORD, sessionCookie(), setUp() (+6 more)

### Community 70 - "DirectTransport (direct branch implementation)"
Cohesion: 0.08
Nodes (35): transport.test.mjs: adapter streams end to end over DirectTransport, Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, Status → ErrorCode by status + error.code/type only (never message text), Error taxonomy (8 ErrorCodes), assertModelSupports() — MODEL_UNAVAILABLE / INVALID_REQUEST, FALLBACK_POLICY (8 error codes as data), DirectTransport (direct branch implementation) (+27 more)

### Community 71 - "Settings"
Cohesion: 0.08
Nodes (25): Combo rotation state invalidated when combo strategy settings change, Dashboard session cookie issuance, verification, and destruction (login/dashboardGuard/logout), DEFAULT_SETTINGS shape and migration-free merge with persisted data, GET /api/auth/saml/metadata — public SP metadata document, GET /api/auth/status — unauthenticated auth-configuration probe, GET /api/health and GET /api/init — liveness/init-ping endpoints, GET /api/settings/require-login — public pre-auth login-page context, GET /api/settings response shaping — secret stripping and env-only fields (+17 more)

### Community 72 - "SettingsRepository"
Cohesion: 0.15
Nodes (15): EDITABLE, parseSettingsPatch(), PatchResult, Settings, SettingsPatch, validHttpUrl(), SettingsController, Controller (+7 more)

### Community 73 - "builtin-registry.ts"
Cohesion: 0.08
Nodes (22): ANTHROPIC_VERSION, builtinRegistry, CLINE_HEADERS, CLOUD_CODE_PROTOCOLS, connectable, EXECUTOR_QUIRKS, EXTRA_HEADERS, GOOGLE_CLOUD (+14 more)

### Community 74 - "CustomModelsRepository"
Cohesion: 0.13
Nodes (13): CustomModelsController, filled(), invalid(), Controller, Delete, Get, Header, HttpCode (+5 more)

### Community 75 - "usage.repo.ts"
Cohesion: 0.13
Nodes (17): UsageRange, blankToNull(), ChartRow, Columns, Counters, Dimension, DIMENSIONS, GroupRow (+9 more)

### Community 76 - "network/api.ts"
Cohesion: 0.15
Nodes (22): key, mutation(), path(), ProxyPool, ProxyPoolInput, ProxyPoolType, ProxyRotation, rotationKey (+14 more)

### Community 77 - "CLI Tools"
Cohesion: 0.09
Nodes (23): all-statuses batches 13 per-tool GETs into one response, Array-based upsert into chatLanguageModels.json, and a missing install-detection step, auth.json write plus a best-effort, error-swallowed VS Code settings.json write, Both POST and DELETE replace the entire config.toml with a fixed template, discarding unrelated content, CLI Tools, CodeWhale and ForgeCode TOML configuration, confbox TOML provider entry plus a separate quoted-KEY=VALUE env file for the API key, Crush, Pi, and Smelt JSON configuration (+15 more)

### Community 78 - "database/package.json"
Cohesion: 0.09
Nodes (20): dependencies, better-sqlite3, drizzle-orm, sql.js, devDependencies, drizzle-kit, @types/better-sqlite3, @types/node (+12 more)

### Community 79 - "Model import and custom models contract (M2 SP16a)"
Cohesion: 0.21
Nodes (13): GET /api/connections/:id/models (adapter getModels, MODELS_FETCH_FAILED), SP16a user decisions (pick list, all providers, keep 9router bugs), Model import and custom models contract (M2 SP16a), CustomModelsRepository + /api/models/custom, API_UI_MAP row SP16a, catalog.provider-models-live-fetch, catalog.compatible-models-import-ui, catalog.custom-models-orphan-on-node-delete (+5 more)

### Community 80 - "Descriptor connectionFields + withConnection(): {field} URL tokens filled per connection (encoded), OpenAI-Organization header, {model} filled per request"
Cohesion: 0.18
Nodes (15): Descriptor chatProbe: connection test by a one-token chat (azure 401/403, cloudflare 401/403/404, clinepass 401/403), ClinePass: Cline headers naming AIGate, non-stream { success, data } unwrapped, provider_connections.deployment, api_version, organization, account_id (migration 0008); POST/PATCH validation per field, Descriptor connectionFields + withConnection(): {field} URL tokens filled per connection (encoded), OpenAI-Organization header, {model} filled per request, User decisions 2026-09-26: SP14g keeps 9router for Azure, refuses Cloudflare images, gives ClinePass a real test (chat probe after live GET /models returned 200 to a fake key), Per-connection data providers contract (M2 SP14g), API_UI_MAP row: SP14g per-connection data and ClinePass, connection.azure-openai-deployment (+7 more)

### Community 81 - "clients.ts"
Cohesion: 0.15
Nodes (13): FILE_PRAGMAS, Method, openBetterSqlite(), openBunSqlite(), openers, openNodeSqlite(), openSqlJs(), SqlValue (+5 more)

### Community 82 - "conformance.mjs"
Cohesion: 0.11
Nodes (8): dir, drivers, file, migrationsFolder, results, migrationsFolder, accounts, usage

### Community 83 - "catalog.controller.ts"
Cohesion: 0.17
Nodes (13): CatalogController, find(), levelsOf(), mediaSummary(), ProviderSummary, routeKinds(), summary(), ThinkingView (+5 more)

### Community 84 - "domain/usage.ts"
Cohesion: 0.21
Nodes (17): addDays(), csvField(), dayKey(), daysBetween(), formatters, InvalidPeriod, MAX_CUSTOM_DAYS, offsetAt() (+9 more)

### Community 85 - "body"
Cohesion: 0.14
Nodes (13): answer, ndjson(), send(), body(), ndjson(), reply, bytes(), jsonAnswer() (+5 more)

### Community 86 - "discovery/package.json"
Cohesion: 0.10
Nodes (19): fast-glob, tsx, yaml, dependencies, fast-glob, yaml, zod, devDependencies (+11 more)

### Community 87 - "Translation"
Cohesion: 0.11
Nodes (19): Anthropic Messages client request to the OpenAI pivot (claudeToOpenAIRequest), or near passthrough to an Anthropic provider, Anthropic Messages response (JSON and SSE) to OpenAI chat completions, and upstream error handling, cloudflare-ai: every message content array is flattened to a string, Command Code NDJSON AI SDK v5 events to OpenAI chunks, and the collapsed answer for non-streaming clients, Gemini generateContent client request to the OpenAI chat body (convertGeminiToInternal), then the ordinary chat pipeline, Gemini SSE chunks and generateContent JSON to OpenAI chat completion chunks and body, Ollama NDJSON stream and JSON body to OpenAI chat completion chunks and body, OpenAI chat answer back to the Gemini client: SSE chunks (transformOpenAISSEToGeminiSSE) and the GenerateContentResponse (convertOpenAIResponseToGemini) (+11 more)

### Community 88 - "Combo / Vision Adapter"
Cohesion: 0.11
Nodes (19): /api/combos CRUD routes — name validation, a duplicate pre-check race, and reuse outside the chat lane, augmentModelsWithCapacityAdapter prepends adapter models first — the file's own header comment says the opposite, Combo persistence shape — id / unique name / kind / models(JSON) / timestamps, Combo / Vision Adapter, comboRotationState Map — ownership, every reset trigger, and non-durability across restart, detectRequiredCapabilities scans only the trailing user turn for modality requirements, "Fallback" strategy — sequential try-until-success across combo members, Flattened deduped adapter pool across all 4 capabilities, and active-strategy resolution (+11 more)

### Community 89 - "Translation / language functionality"
Cohesion: 0.11
Nodes (19): api/translator/console-logs and console-logs/stream — buffered + live console output for the playground UI, api/translator/translate, load, save, send — step through and manually fire the pivot, Base64 data-URI encode/parse shared by every image-capable translator, Claude OAuth anti-ban tool cloaking and fingerprint injection, Every registered source:target request/response pair, filterToOpenAIFormat: what happens to a client's cache_control on the way to an OpenAI-format provider, How Kiro EventStream, Cursor protobuf, and CommandCode NDJSON avoid the translator's pivot dispatch, Literal-keyed runtime DOM text substitution (not a conventional key-based i18n library) (+11 more)

### Community 90 - "SP0 — 2 skills + mechanical lint suite"
Cohesion: 0.16
Nodes (14): Canonical error classification codes (8 values), Split: machines block mechanics, skills teach judgement, Iron law: no skill without a failing test first (RED → GREEN → REFACTOR), UI performance constraints, §8 Business rule beats old implementation, §19 Fallback as explicit policy with classified errors, tools/lint/check.test.mjs (lint:check 13/13), Lint rule aigate/fetch-through-transport (+6 more)

### Community 92 - "src/schema.ts"
Cohesion: 0.15
Nodes (15): vitest, zod, cell(), renderCapabilities(), BOUNDED_CONTEXTS, ERROR_CODES, ErrorCase, Evidence (+7 more)

### Community 93 - "Port behavior, not code"
Cohesion: 0.11
Nodes (14): Error taxonomy and fallback, Rules, Before implementing, Checks for suspected bugs, Columns, Feature Matrix entry, Trace questions, Golden scenarios (+6 more)

### Community 94 - "models.tsx"
Cohesion: 0.23
Nodes (14): ListedModel, ModelProbe, ProviderModel, testModel(), describeProbe(), DUPLICATE, ImportChoice, importChoices() (+6 more)

### Community 95 - "06-combo-capacity-adapter.yaml"
Cohesion: 0.11
Nodes (23): combo.detect-required-capabilities, Capacity rules: pool validation, model capability lookup, widen, 3-tier reorder, trimHistory: 80% window budget, first 6 older turns, tool calls kept with results, Combo rules: validation, rotation, member failover, panel/judge requests, collectPanel: 4 literal workers, quorum-grace, hard timeout, straggler cancel, Capacity adapter contract (SP20), Corrected 9router capacity bugs: default free-model pools, orphaned tool calls, rotation keyed by model, Corrected 9router combo bugs: first-failure status, unbounded nesting, strategy keyed by name (+15 more)

### Community 96 - "Usage"
Cohesion: 0.11
Nodes (18): aggregateEntryToDay — per-day rollup by provider/model/account/apiKey/endpoint, /api/pricing — GET merged pricing, PATCH validated overrides, DELETE reset-to-default, /api/usage/history is not a history-rows endpoint — it returns the same aggregate shape as /api/usage/stats, appendRequestLog is an empty no-op; the log view is derived read-side from usageHistory, calculateCost — pricing lookup and cache-inclusive token math, Every field recorded for one request, in the order it becomes known, GET /api/usage/providers — distinct-provider filter list for the request-details tab, GET /api/usage/request-details — pagination plus mandatory content redaction (+10 more)

### Community 97 - "UsageRecorder"
Cohesion: 0.20
Nodes (3): emptyTally(), Injectable, UsageRecorder

### Community 98 - "protocols/gemini-generate.ts — path parsing, text-only request, GenerateContentResponse, Gemini SSE encoder, model list, TTS request"
Cohesion: 0.24
Nodes (12): User decision 2026-09-27: SP15c keeps 9router on request, response and auth/path; TTS passthrough ported now, Gemini client protocol contract (M2 SP15c), API_UI_MAP row: SP15c Gemini client protocol, catalog.v1beta-generate-content-dispatch, catalog.v1beta-models-listing, translator.gemini-client-request, translator.openai-to-gemini-client-response, protocols/gemini-generate.ts — path parsing, text-only request, GenerateContentResponse, Gemini SSE encoder, model list, TTS request (+4 more)

### Community 99 - "openai-adapter.test.mjs"
Cohesion: 0.14
Nodes (12): airforce, body(), credential, encoder, hello, isCode(), json(), noSecret() (+4 more)

### Community 100 - "Media Providers"
Cohesion: 0.12
Nodes (16): COMBO_KINDS is a permanently-empty Set — combo creation/listing UI for image and tts kinds is unreachable, and the code that would render it is dead, getEffectiveStatus displays a stale "unavailable" testStatus as "active" once its lock has actually expired, imageToText has no dedicated request lane — it is a catalog label for vision-capable chat models, served entirely through /v1/chat/completions, MEDIA_PROVIDER_KINDS — the 9 kinds, their labels/icons, and each kind's declared REST endpoint, Media Providers, POST /v1/audio/speech — combo expansion + account-selection loop + ttsCore provider dispatch, POST /v1/audio/transcriptions — noAuth bypass, then account-selection loop + sttCore provider dispatch, POST /v1/embeddings — account-selection loop + embeddingsCore provider dispatch (+8 more)

### Community 101 - "gemini-generate.ts"
Cohesion: 0.19
Nodes (13): FINISH, FINISH_OF, GEMINI_TTS_TIMEOUT_MS, GeminiRoute, GeminiStreamMeta, geminiTtsRequest(), invalid(), isGeminiTtsRequest() (+5 more)

### Community 102 - "anthropic-adapter.test.mjs"
Cohesion: 0.14
Nodes (11): anthropic, body(), credential, encoder, gateway, hello, json(), minimax (+3 more)

### Community 103 - "vertex-adapter.test.mjs"
Cohesion: 0.16
Nodes (10): encoder, hello, json(), partner, { privateKey, publicKey }, reply(), sse(), stream() (+2 more)

### Community 104 - "inventory.ts"
Cohesion: 0.21
Nodes (11): basename(), buildInventory(), glob(), IGNORE, settingsKeys(), here, NINEROUTER_ROOT, REPO_ROOT (+3 more)

### Community 105 - "Bounded patterns"
Cohesion: 0.13
Nodes (11): Bounded patterns, Cache with a TTL and a size cap, Circuit breaker and cursor pagination, Four concurrent calls at most, Queue, stream, and SSE backpressure, Retry within one deadline, Database checks, Review gate (+3 more)

### Community 106 - "Proxy Pools"
Cohesion: 0.13
Nodes (15): A real (non-noAuth) connection is bound to a proxy pool via its own create/update body, Cached undici ProxyAgent dispatchers, keyed by normalized proxy URL, GET/POST /api/proxy-pools — list (with optional usage enrichment) and create, GET/PUT/DELETE /api/proxy-pools/[id], MITM_BYPASS_HOSTS — manual DNS resolution + raw-socket TLS to dodge local DNS/hosts poisoning, pickProxyPoolId() rotation for free/noAuth providers, keyed by settings.providerStrategies, POST /api/proxy-pools/cloudflare-deploy — uploads a Worker relay script and resolves its workers.dev URL, POST /api/proxy-pools/deno-deploy — creates a Deno Deploy app, deploys the relay, polls status, and rolls back on 2 of its 3 failure paths (+7 more)

### Community 107 - "database.ts"
Cohesion: 0.22
Nodes (12): DriverName, Database, DatabaseHandle, fallbackOrder(), MIGRATIONS_FOLDER, openClient(), openDatabase(), call() (+4 more)

### Community 108 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, emitDecoratorMetadata, experimentalDecorators, module, moduleResolution, outDir, rootDir, skipLibCheck (+5 more)

### Community 109 - "Token Saver"
Cohesion: 0.14
Nodes (14): 6 api/headroom/* routes: process lifecycle for headroom, an external (not library-mode) proxy, 8 api/pxpipe/* routes: install, lifecycle, and observability for the in-process PXPIPE module, Caveman + Ponytail stages: inject a terse-style system prompt via a shared, format-dispatching injector, Five-stage pipeline run once per chat request, just before dispatch, Headroom stage: send messages to an external compression proxy, fail open on any failure, Only PXPIPE's savings are persisted; RTK and headroom stats are console-log only and discarded, 'PXPIPE is running' means the transform module is loaded in-process, not that a port is listening, PXPIPE stage: render bulky Claude-format tool context as dense PNGs via an in-process transform (+6 more)

### Community 110 - "Provider authentication"
Cohesion: 0.14
Nodes (14): BaseExecutor's own buildHeaders fallback — used by dedicated-executor providers that don't override header construction, Config-driven generic OAuth refresh (REFRESH_GRANTS / refreshFromGrant) for the standard refresh_token grant shape, Find local desktop API key and optional session identity, Hand-written per-provider refresh methods for providers whose token endpoint doesn't fit the generic grant shape, Import an API key or session credential, OAUTH_INJECT_FIELDS — clientId/clientSecret/tokenUrl injected from the oauth block, not stored per connection, POST /api/provider-nodes/validate — probe a user-supplied baseUrl+apiKey before a custom provider node is saved, POST /api/providers/[id]/test — probe one connection's credential validity against its provider and persist the result (+6 more)

### Community 111 - "Milestone M1 · Walking skeleton (thin end-to-end slice)"
Cohesion: 0.17
Nodes (16): Feature-based frontend structure with import boundaries, Hexagonal architecture, granularity = bounded context, Monorepo layout (apps/server, apps/web, apps/cli, packages/engine, contracts, database, tools), Open decisions not settled by this spec, AIGate Design Spec (2026-09-22), Decision 1 (user, 2026-09-25): API keys are random and stored as a hash, Decision 3 (user, 2026-09-25): sessions stored in the database, not a JWT, GET /health (+8 more)

### Community 112 - "src/pricing.ts"
Cohesion: 0.20
Nodes (12): builtin(), costOf(), PATTERNS, Price, PRICE_FIELDS, PriceField, PriceOverride, PriceSource (+4 more)

### Community 113 - "cli.ts"
Cohesion: 0.22
Nodes (9): loadOrExit(), MATRIX_DIR, OUT_DIR, countLines(), lineCount(), lineCounts, validateMatrix(), ValidationResult (+1 more)

### Community 114 - "coverage.ts"
Cohesion: 0.19
Nodes (11): computeCoverage(), CoverageReport, Dimension, EVIDENCE_PATH, renderCoverage(), Inventory, base, entries (+3 more)

### Community 115 - "ready"
Cohesion: 0.24
Nodes (9): ask, message, withAnthropic(), textOf(), answer, frames(), hello, ready() (+1 more)

### Community 116 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, skipLibCheck (+4 more)

### Community 117 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, module, moduleResolution, outDir, rootDir, skipLibCheck, sourceMap (+4 more)

### Community 118 - "engine/package.json"
Cohesion: 0.15
Nodes (12): devDependencies, @types/node, typescript, exports, @types/node, typescript, name, private (+4 more)

### Community 119 - "OpenAIChatStreamEncoder"
Cohesion: 0.27
Nodes (5): errorBody(), frame(), OpenAIChatStreamEncoder, toOpenAIError(), usageJson()

### Community 120 - "thinking.ts"
Cohesion: 0.21
Nodes (10): ProviderProtocol, CLAUDE_BUDGET, FAMILY_LEVELS, isThinkingLevel(), KNOWN_EFFORTS, reasons(), splitThinkingSuffix(), THINKING_LEVELS (+2 more)

### Community 121 - "gemini-adapter.test.mjs"
Cohesion: 0.18
Nodes (7): body(), credential, encoder, gemini, hello, json(), sse()

### Community 122 - "ollama-adapter.test.mjs"
Cohesion: 0.18
Nodes (9): answer, body(), cloud, credential, encoder, hello, json(), local (+1 more)

### Community 123 - "openai-protocol.test.mjs"
Cohesion: 0.18
Nodes (10): body(), credential, ctx, enc, meta, openai, response, send() (+2 more)

### Community 124 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, module, moduleResolution, outDir, rootDir, skipLibCheck, sourceMap (+4 more)

### Community 125 - "dependencies"
Cohesion: 0.17
Nodes (12): dependencies, @aigate/database, @aigate/engine, drizzle-orm, fastify, @fastify/static, @nestjs/common, @nestjs/core (+4 more)

### Community 126 - ".summary"
Cohesion: 0.27
Nodes (7): counters(), Query, Controller, Get, Header, Res, UsageController

### Community 127 - "Endpoint & API Key"
Cohesion: 0.17
Nodes (12): Create a new API key (POST /api/keys), Derive the stable per-install machineId embedded in new API keys, Endpoint & API Key, Extract the inbound API key from request headers, Gate chat requests behind settings.requireApiKey, Legacy sk-{random8} keys and the never-invoked CRC/format validation, List all API keys (GET /api/keys), Permanently remove a key (DELETE /api/keys/[id]) (+4 more)

### Community 128 - "Rule 4 — Every workload must be BOUNDED"
Cohesion: 0.29
Nodes (7): Constraint — every filesystem scan uses fast-glob with an explicit ignore list, §17 Latency — clean architecture must not add hot-path I/O, §16 Do not inherit performance issues; all large workloads bounded, Rule 4 — Every workload must be BOUNDED, Rule 11 — Review questions beyond "does it run?" (10x/100x traffic, unbounded work), Rule 5 — Low latency: parallelize independent awaits, only when bounded, Rule 3 — Optimize performance at design time, not micro-optimization

### Community 129 - "GithubAdapter"
Cohesion: 0.45
Nodes (3): GithubAdapter, isClaude(), servesResponses()

### Community 131 - "commandcode-adapter.test.mjs"
Cohesion: 0.20
Nodes (7): commandcode, credential, encoder, hello, json(), ndjson(), stream()

### Community 132 - "connection-data.test.mjs"
Cohesion: 0.20
Nodes (8): answer(), azure, clinepass, cloudflare, credential, encoder, json(), stream()

### Community 133 - "github-copilot.test.mjs"
Cohesion: 0.18
Nodes (6): chatAnswer, credential, ctx, github, responsesStream(), sse()

### Community 134 - "openai-responses-adapter.test.mjs"
Cohesion: 0.20
Nodes (8): body(), credential, encoder, hello, json(), pplx, reply, sse()

### Community 135 - "Body"
Cohesion: 0.06
Nodes (44): Body, body(), bool(), fail(), name(), NewProxyPool, noProxy(), Parsed (+36 more)

### Community 136 - "parity/package.json"
Cohesion: 0.17
Nodes (11): @aigate/server, description, devDependencies, @aigate/engine, @aigate/server, @aigate/engine, name, private (+3 more)

### Community 137 - ".test"
Cohesion: 0.18
Nodes (8): ModelProbe, ModelTestController, Controller, Get, Header, HttpCode, Post, Res

### Community 138 - "Rule 1 — Write LEAN code, no over-engineering"
Cohesion: 0.50
Nodes (4): §15 Code quality — shortest CLEAR implementation, not shortest possible, Rule 1 — Write LEAN code, no over-engineering, Rule 2 — Code must be maintainable, no magic values or hidden side effects, Rule 12 — Priority order: Correctness → Simplicity → Maintainability → Predictable resources → Latency → Throughput → Optimization

### Community 139 - "usage-meter.ts"
Cohesion: 0.25
Nodes (7): abortCode(), codeOf(), meter(), meteredSend(), NONE, usageOfBody(), estimateTokens()

### Community 140 - "Model mapping"
Cohesion: 0.18
Nodes (11): A user-defined model alias resolves to a real provider/model pair before any capability lookup or dispatch happens, Background models.dev sync — daily refresh, cross-gateway majority vote, tolerance band, fail-open, Disabling a model only hides it from listing endpoints — an alias (or a direct provider/model string) pointing at a disabled model still routes normally, GET /api/tags — fixed two-entry fixture list mimicking Ollama's model-discovery response, used by Ollama-compatible tools before they call the ollama chat lane (05's routing.ollama-lane-transform), GET /v1beta/models — Gemini-format static model catalog for Gemini-native clients (e.g. Gemini CLI, the @google/genai SDK), getCapabilitiesForModel's 4-tier priority chain — first match wins, no cross-tier merge, Model mapping, NOT_VISION is tested before VISION_NAME in looksLikeVisionModel, and can only turn vision on (+3 more)

### Community 141 - "Model registry"
Cohesion: 0.18
Nodes (11): /api/models/availability — dashboard-facing, model-centric aggregation of per-connection cooldown/unavailable locks, plus a manual clear-cooldown action, /api/models/custom — operator-added custom models, atomic upsert that preserves unset fields, /api/models/disabled — per-provider disable/enable list with an atomic merge inside a DB transaction, /api/models/test — synchronous per-model connectivity probe, self-dispatched through 9router's own /v1/* endpoints, Deleting a custom provider node leaves its customModels rows behind, GET /v1/models/{kind} and GET /v1/models/{provider}/{model} — kind-filtered listing and single-model lookup on the OpenAI-compatible lane, Model registry, Provider detail 'Available Models' — add a model id by hand, or 'Import from /models' every id the connection's upstream lists, each shown as <prefix>/<id> with Copy, Test and Delete (+3 more)

### Community 142 - "Usage contract (M2 SP24a, SP24b)"
Cohesion: 0.18
Nodes (10): Cost, Dashboard API (session), Days, periods, retention, Deviations from 9router, Requests (SP24b), UI, Usage contract (M2 SP24a, SP24b), Vendor quota (SP24c) (+2 more)

### Community 143 - "catalog/schema.ts"
Cohesion: 0.24
Nodes (10): AuthKind, CATALOG_PROTOCOLS, CatalogAuth, CatalogModel, CatalogProtocol, checkUrl(), LOOPBACK, positiveOrNull() (+2 more)

### Community 144 - "claude-codex.test.mjs"
Cohesion: 0.18
Nodes (5): claude, codex, ctx, message, ok

### Community 145 - "gemini-cli.test.mjs"
Cohesion: 0.20
Nodes (5): ctx, json(), METADATA, provider, send()

### Community 146 - "Remote functionality"
Cohesion: 0.20
Nodes (10): 9Remote button + promo modal — zero backend, zero routes, zero persistence, Full state machine across the 7 /api/tunnel/* routes for both the Cloudflare quick-tunnel and Tailscale Funnel lanes, GET /api/tunnel/status — coalesced polling across both lanes plus download progress, Hosts-file DNS entries — atomic write+rollback on Windows vs direct overwrite on macOS/Linux, and unconditional cleanup on stop, POST /api/tunnel/enable and /api/tunnel/disable — Cloudflare quick-tunnel lifecycle, POST /api/tunnel/tailscale-enable and /api/tunnel/tailscale-disable — daemon start, login, Funnel activation, POST /api/tunnel/tailscale-install (SSE) and GET /api/tunnel/tailscale-check, Remote functionality (+2 more)

### Community 147 - "Multi-account"
Cohesion: 0.20
Nodes (10): Distinguishing 'no accounts configured' from 'all accounts temporarily locked', with retry-after computed from the earliest lock, fill-first strategy — the default when no round-robin override applies, Filtering candidates by exclude-set, active model lock, and (Antigravity only) cached live quota before any strategy runs, In-memory Antigravity live-quota cache that pre-filters accounts before a request is even attempted, Multi-account, Mutex scope around getProviderCredentials, options.preferredConnectionId pins selection to one connection, bypassing fill-first/round-robin, "Public" virtual connection injected for noAuth providers (+2 more)

### Community 148 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, module, moduleResolution, noUncheckedIndexedAccess, skipLibCheck, strict, target, types (+1 more)

### Community 149 - "`porting-behavior-not-code` RED baseline"
Cohesion: 0.22
Nodes (7): Observations, `porting-behavior-not-code` GREEN and micro-tests, A. Port a 9Router file to TS, B. "Trivial, skip the Feature Matrix", C. "Keep `global._*` exactly, to be safe", `porting-behavior-not-code` RED baseline, Skill target

### Community 150 - "`writing-lean-bounded-code` RED baseline"
Cohesion: 0.22
Nodes (7): Fan-out and cache micro-tests, `writing-lean-bounded-code` GREEN and micro-tests, A. Urgent connection fan-out, B. Sunk-cost usage report, C. Senior-requested permanent cache, Skill target, `writing-lean-bounded-code` RED baseline

### Community 151 - "Database"
Cohesion: 0.22
Nodes (3): bun:sqlite, Database, Statement

### Community 152 - "Provider account management"
Cohesion: 0.25
Nodes (8): clearAccountError — lazy cleanup of expired locks and conditional error-state reset on a successful request, createProviderConnection — identity-based dedup on re-import, and automatic priority assignment for new connections, deleteProviderConnection — row removal followed by a priority renumber for the remaining accounts of that provider, Every distinct reason markAccountUnavailable() locks an account+model pair, and that reason's expiry rule, Provider account management, The providerConnections row shape — fixed SQL columns vs. an open-ended JSON blob for everything else, updateProviderConnection — atomic read-merge-write per connection, and priority reorder triggered by a priority change, Where modelLock_* (and all other per-connection state) is stored, and whether it survives a restart

### Community 153 - "AIGate — Project Map"
Cohesion: 0.25
Nodes (7): 1 · Lộ trình, 2 · UI sub-project (M3) — thứ tự dựng, 3 · Màn hình → backend → feature → design, 4 · Bounded context → ai dùng nó, 5 · Lỗi / khoảng trống đã biết, 6 · Tra cứu sâu hơn, AIGate — Project Map

### Community 156 - "responses-protocol.test.mjs"
Cohesion: 0.25
Nodes (6): anthropic, base, codebuddy, gemini, openai, perplexity

### Community 157 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, dev:node, dev:tsc, start, test

### Community 158 - "usage.test.mjs"
Cohesion: 0.33
Nodes (3): get(), OPTIONS, recorderOf()

### Community 159 - "Quota Tracker"
Cohesion: 0.29
Nodes (7): Antigravity's locally-counted/inferred quota — RAM cache plus a strike-based trust override, Codex reset credits — a redeemable pool that manually ends the current 5h window early, Quota Tracker, quotaAutoPing scheduler — opt-in pings that start a new quota window right after reset, The /dashboard/quota page — auto-refresh cadence, per-provider throttling, client cache, visibility settings, The four categories behavioral.md §21 asks about — which exist in 9router and how, Vendor-reported quota fetch mechanics — per-provider windows, caching, cooldowns

### Community 160 - "Speech contract (M2 SP23)"
Cohesion: 0.29
Nodes (6): Dashboard API (session), `GET /v1/audio/voices?provider=<id>[&model=<id>][&lang=<code>]` (API key), `POST /v1/audio/speech` (API key, as every `/v1` route), Providers, Speech contract (M2 SP23), UI

### Community 161 - "AIGate schema conventions"
Cohesion: 0.29
Nodes (6): AIGate schema conventions, Growth and hot paths, Integrity, Secrets, Shape, Where things live

### Community 164 - "anthropic-protocol.test.mjs"
Cohesion: 0.29
Nodes (5): anthropic, base, codebuddy, gemini, openai

### Community 167 - "SPIKE-1: SQLite drivers through Drizzle"
Cohesion: 0.33
Nodes (5): Findings, Recommendation, Results, SPIKE-1: SQLite drivers through Drizzle, What "works" means

### Community 170 - "Hoàn thiện SP23: TTS lane + voice listing + preview"
Cohesion: 0.33
Nodes (5): Context, Critical Files, Hoàn thiện SP23: TTS lane + voice listing + preview, Implementation steps, Verification

### Community 171 - "SP24a: ghi usage, cost theo pricing, thống kê, SSE live, màn Usage và chỉnh giá"
Cohesion: 0.33
Nodes (5): Context, Implementation steps, Quyết định cần duyệt (mặc định tôi đề xuất), SP24a: ghi usage, cost theo pricing, thống kê, SSE live, màn Usage và chỉnh giá, Verification

### Community 172 - "SP24b: request detail (metadata + attempts), usage của media lanes, màn Requests"
Cohesion: 0.33
Nodes (5): Context, Implementation steps, Quyết định cần duyệt (mặc định tôi đề xuất), SP24b: request detail (metadata + attempts), usage của media lanes, màn Requests, Verification

### Community 173 - "DatabaseShutdown"
Cohesion: 0.40
Nodes (3): DatabaseShutdown, Inject, Injectable

### Community 175 - "Token Saver contract (M2 SP21)"
Cohesion: 0.40
Nodes (4): Decisions, Out of scope, Runtime guarantees, Token Saver contract (M2 SP21)

### Community 176 - "Gap register"
Cohesion: 0.40
Nodes (4): Behavior 9router does not have — AIGate must add, Gap register, Implementation accidents — behavior required, mechanism not, Suspected bugs — analyse before deciding

### Community 177 - "SP0.6 skill discovery"
Cohesion: 0.40
Nodes (4): Limits, SP0.6 skill discovery, Test, Wiring

### Community 178 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, generate, test, test:bun

### Community 180 - "AIGate"
Cohesion: 0.50
Nodes (3): AIGate, Repository map, Verify (PowerShell)

### Community 181 - "Parity report (M1 gate)"
Cohesion: 0.50
Nodes (3): Deferred golden scenarios, Parity report (M1 gate), Tapes

### Community 182 - "antigravity-config.ts"
Cohesion: 0.50
Nodes (3): ANTIGRAVITY_IDE_BASE_URL, ANTIGRAVITY_IDE_USER_AGENT, ANTIGRAVITY_MODELS_URL

### Community 183 - "toDescriptor"
Cohesion: 0.67
Nodes (4): isProtocol(), protocolOf(), toDescriptor(), unsupportedReason()

### Community 185 - "gemini-protocol.test.mjs"
Cohesion: 0.50
Nodes (3): meta, route, usage

## Ambiguous Edges - Review These
- `UI error code: TIMEOUT` → `ErrorCode: TIMEOUT`  [AMBIGUOUS]
  docs/design/API_UI_MAP.md · relation: conceptually_related_to
- `Token Saver — /gateway/token-saver` → `U6 — Routing & Fallback + Simulator`  [AMBIGUOUS]
  docs/superpowers/specs/2026-09-22-aigate-design.md · relation: implements
- `U6 — Routing & Fallback + Simulator` → `GAP: Token Saver screen missing from the U0–U11 table`  [AMBIGUOUS]
  docs/superpowers/specs/2026-09-22-aigate-design.md · relation: references
- `The 23 feature groups required by behavioral.md §5` → `Feature group — MCP (API with no UI, found during spec work)`  [AMBIGUOUS]
  docs/superpowers/plans/2026-09-22-m1-discovery.md · relation: conceptually_related_to
- `detectRequiredCapabilities()` → `Open decision (user confirmation pending): scan every message + system prompt for required capabilities`  [AMBIGUOUS]
  docs/contracts/engine.md · relation: rationale_for

## Knowledge Gaps
- **1206 isolated node(s):** `name`, `private`, `type`, `build`, `dev` (+1201 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1638 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `UI error code: TIMEOUT` and `ErrorCode: TIMEOUT`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Token Saver — /gateway/token-saver` and `U6 — Routing & Fallback + Simulator`?**
  _Edge tagged AMBIGUOUS (relation: implements) - confidence is low._
- **What is the exact relationship between `U6 — Routing & Fallback + Simulator` and `GAP: Token Saver screen missing from the U0–U11 table`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `The 23 feature groups required by behavioral.md §5` and `Feature group — MCP (API with no UI, found during spec work)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `detectRequiredCapabilities()` and `Open decision (user confirmation pending): scan every message + system prompt for required capabilities`?**
  _Edge tagged AMBIGUOUS (relation: rationale_for) - confidence is low._
- **Why does `shared/errors.ts toProblem() — the one code-to-message table` connect `Identity and API keys contract (M1 SP6)` to `ConnectionsController — /api/connections CRUD + POST /:id/test (validateCredential outside any transaction)`, `API ↔ UI map (docs/design/API_UI_MAP.md)`, `useToast`, `ProviderNodesController — /api/provider-nodes CRUD; PREFIX_RESERVED / PREFIX_TAKEN / NODE_LIMIT`?**
  _High betweenness centrality (0.294) - this node is a cross-community bridge._
- **Why does `toProblem()` connect `providers/screens.tsx` to `gateway/screens.tsx`, `network/api.ts`, `providers/api.ts`, `useToast`, `traffic/api.ts`, `usage.tsx`, `app/screens.tsx`, `models.tsx`?**
  _High betweenness centrality (0.240) - this node is a cross-community bridge._