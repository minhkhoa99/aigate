# Graph Report - aigate  (2026-10-10)

SP43 provenance: installed `graphify update . --no-cluster` refreshed AST
structure only (474 files, zero new LLM tokens). The semantic portion remains
merge-derived; this is not a fresh semantic extraction. All 11,145 prior
node IDs, 24,790 prior link identities and 29 hyperedges remain. The tracked
HTML was retained because visualization is capped at 5,000 nodes.

## Corpus Check
- 474 files · ~806,471 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 11168 nodes · 24867 edges · 453 communities (393 shown, 60 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 823 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ccb8e27b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Credential|Credential]]
- [[_COMMUNITY_record|record]]
- [[_COMMUNITY_ConnectionsRepository|ConnectionsRepository]]
- [[_COMMUNITY_OAuth sign-in contract (M2 SP16)|OAuth sign-in contract (M2 SP16)]]
- [[_COMMUNITY_auth.controller.ts|auth.controller.ts]]
- [[_COMMUNITY_provider-node.ts|provider-node.ts]]
- [[_COMMUNITY_chat-lane.ts|chat-lane.ts]]
- [[_COMMUNITY_@nestjscommon|@nestjs/common]]
- [[_COMMUNITY_ChatLane|ChatLane]]
- [[_COMMUNITY_gatewayscreens.tsx|gateway/screens.tsx]]
- [[_COMMUNITY_providersscreens.tsx|providers/screens.tsx]]
- [[_COMMUNITY_OpenAICompatibleAdapter (AIProviderPort for openai-compatible)|OpenAICompatibleAdapter (AIProviderPort for openai-compatible)]]
- [[_COMMUNITY_openai-compatible.ts|openai-compatible.ts]]
- [[_COMMUNITY_providersapi.ts|providers/api.ts]]
- [[_COMMUNITY_useToast|useToast]]
- [[_COMMUNITY_enginesrcindex.ts|engine/src/index.ts]]
- [[_COMMUNITY_EngineError|EngineError]]
- [[_COMMUNITY_replay.mjs|replay.mjs]]
- [[_COMMUNITY_anthropic.ts|anthropic.ts]]
- [[_COMMUNITY_ConnectionsController — apiconnections CRUD + POST idtest (validateCredential outside any transaction)|ConnectionsController — /api/connections CRUD + POST /:id/test (validateCredential outside any transaction)]]
- [[_COMMUNITY_appscreens.tsx|app/screens.tsx]]
- [[_COMMUNITY_Milestone M-1 · Discovery|Milestone M-1 · Discovery]]
- [[_COMMUNITY_AnthropicAdapter — CIP - Messages (max_tokens rules, thinking budgets, tool_use, SSE events)|AnthropicAdapter — CIP <-> Messages (max_tokens rules, thinking budgets, tool_use, SSE events)]]
- [[_COMMUNITY_isRecord|isRecord]]
- [[_COMMUNITY_speech-lane.ts|speech-lane.ts]]
- [[_COMMUNITY_Bounded context transport|Bounded context: transport]]
- [[_COMMUNITY_SP13 — catalog → runtime registry (41 connectable providers, apiproviders, providers wired)|SP13 — catalog → runtime registry (41 connectable providers, /api/providers, /providers wired)]]
- [[_COMMUNITY_quota.service.ts|quota.service.ts]]
- [[_COMMUNITY_provider-nodes.repo.ts|provider-nodes.repo.ts]]
- [[_COMMUNITY_vertex.ts|vertex.ts]]
- [[_COMMUNITY_Identity and API keys contract (M1 SP6)|Identity and API keys contract (M1 SP6)]]
- [[_COMMUNITY_pricing.repo.ts|pricing.repo.ts]]
- [[_COMMUNITY_databasesrcindex.ts|database/src/index.ts]]
- [[_COMMUNITY_Bounded context routing (core)|Bounded context: routing (core)]]
- [[_COMMUNITY_api-keys.repo.ts|api-keys.repo.ts]]
- [[_COMMUNITY_scripts|scripts]]
- [[_COMMUNITY_ChatLane (modulesroutinginfrastructurechat-lane.ts)|ChatLane (modules/routing/infrastructure/chat-lane.ts)]]
- [[_COMMUNITY_cursor.ts|cursor.ts]]
- [[_COMMUNITY_Request routing|Request routing]]
- [[_COMMUNITY_Feature Matrix — mandatory 17-column artifact|Feature Matrix — mandatory 17-column artifact]]
- [[_COMMUNITY_registry.ts|registry.ts]]
- [[_COMMUNITY_OAuthController|OAuthController]]
- [[_COMMUNITY_lane-helpers.mjs|lane-helpers.mjs]]
- [[_COMMUNITY_Overview —|Overview — /]]
- [[_COMMUNITY_GeminiAdapter — CIP - generateContent  streamGenerateContentalt=sse (x-goog-api-key, safety off, thinking levelbudget, 400 key test = invalid)|GeminiAdapter — CIP <-> generateContent / streamGenerateContent?alt=sse (x-goog-api-key, safety off, thinking level/budget, 400 key test = invalid)]]
- [[_COMMUNITY_trafficapi.ts|traffic/api.ts]]
- [[_COMMUNITY_Bounded context identity|Bounded context: identity]]
- [[_COMMUNITY_ProviderNodesController — apiprovider-nodes CRUD; PREFIX_RESERVED  PREFIX_TAKEN  NODE_LIMIT|ProviderNodesController — /api/provider-nodes CRUD; PREFIX_RESERVED / PREFIX_TAKEN / NODE_LIMIT]]
- [[_COMMUNITY_webpackage.json|web/package.json]]
- [[_COMMUNITY_usage.tsx|usage.tsx]]
- [[_COMMUNITY_openai-chat.ts|openai-chat.ts]]
- [[_COMMUNITY_OAuth providers|OAuth providers]]
- [[_COMMUNITY_combos.repo.ts|combos.repo.ts]]
- [[_COMMUNITY_API ↔ UI map (docsdesignAPI_UI_MAP.md)|API ↔ UI map (docs/design/API_UI_MAP.md)]]
- [[_COMMUNITY_cursor.test.mjs|cursor.test.mjs]]
- [[_COMMUNITY_Bounded context tooling|Bounded context: tooling]]
- [[_COMMUNITY_anthropic-messages.ts|anthropic-messages.ts]]
- [[_COMMUNITY_requests.controller.ts|requests.controller.ts]]
- [[_COMMUNITY_direct-transport.ts|direct-transport.ts]]
- [[_COMMUNITY_json|json]]
- [[_COMMUNITY_AIGate — Capability Specification|AIGate — Capability Specification]]
- [[_COMMUNITY_gemini.ts|gemini.ts]]
- [[_COMMUNITY_Parity verification — 3 tiers|Parity verification — 3 tiers]]
- [[_COMMUNITY_CommandCodeAdapter — envelope, NDJSON events via readJsonLines, peek with in-band error classification and 5xx retries, collapse for non-streaming clients, ping test|CommandCodeAdapter — envelope, NDJSON events via readJsonLines, peek with in-band error classification and 5xx retries, collapse for non-streaming clients, ping test]]
- [[_COMMUNITY_OpenAIResponsesAdapter — CIP - Responses API (extends OpenAICompatibleAdapter; 9router request and stream, corrected non-stream)|OpenAIResponsesAdapter — CIP <-> Responses API (extends OpenAICompatibleAdapter; 9router request and stream, corrected non-stream)]]
- [[_COMMUNITY_rtk.ts|rtk.ts]]
- [[_COMMUNITY_Providers|Providers]]
- [[_COMMUNITY_protocolsopenai-responses.ts|protocols/openai-responses.ts]]
- [[_COMMUNITY_.constructor|.constructor]]
- [[_COMMUNITY_helpers.mjs|helpers.mjs]]
- [[_COMMUNITY_DirectTransport (direct branch implementation)|DirectTransport (direct branch implementation)]]
- [[_COMMUNITY_Settings|Settings]]
- [[_COMMUNITY_SettingsRepository|SettingsRepository]]
- [[_COMMUNITY_builtin-registry.ts|builtin-registry.ts]]
- [[_COMMUNITY_CustomModelsRepository|CustomModelsRepository]]
- [[_COMMUNITY_usage.repo.ts|usage.repo.ts]]
- [[_COMMUNITY_networkapi.ts|network/api.ts]]
- [[_COMMUNITY_CLI Tools|CLI Tools]]
- [[_COMMUNITY_databasepackage.json|database/package.json]]
- [[_COMMUNITY_Model import and custom models contract (M2 SP16a)|Model import and custom models contract (M2 SP16a)]]
- [[_COMMUNITY_Descriptor connectionFields + withConnection() {field} URL tokens filled per connection (encoded), OpenAI-Organization header, {model} filled per request|Descriptor connectionFields + withConnection(): {field} URL tokens filled per connection (encoded), OpenAI-Organization header, {model} filled per request]]
- [[_COMMUNITY_clients.ts|clients.ts]]
- [[_COMMUNITY_conformance.mjs|conformance.mjs]]
- [[_COMMUNITY_catalog.controller.ts|catalog.controller.ts]]
- [[_COMMUNITY_domainusage.ts|domain/usage.ts]]
- [[_COMMUNITY_body|body]]
- [[_COMMUNITY_discoverypackage.json|discovery/package.json]]
- [[_COMMUNITY_Translation|Translation]]
- [[_COMMUNITY_Combo  Vision Adapter|Combo / Vision Adapter]]
- [[_COMMUNITY_Translation  language functionality|Translation / language functionality]]
- [[_COMMUNITY_SP0 — 2 skills + mechanical lint suite|SP0 — 2 skills + mechanical lint suite]]
- [[_COMMUNITY_ResponsesStreamEncoder|ResponsesStreamEncoder]]
- [[_COMMUNITY_srcschema.ts|src/schema.ts]]
- [[_COMMUNITY_Port behavior, not code|Port behavior, not code]]
- [[_COMMUNITY_models.tsx|models.tsx]]
- [[_COMMUNITY_06-combo-capacity-adapter.yaml|06-combo-capacity-adapter.yaml]]
- [[_COMMUNITY_Usage|Usage]]
- [[_COMMUNITY_UsageRecorder|UsageRecorder]]
- [[_COMMUNITY_protocolsgemini-generate.ts — path parsing, text-only request, GenerateContentResponse, Gemini SSE encoder, model list, TTS request|protocols/gemini-generate.ts — path parsing, text-only request, GenerateContentResponse, Gemini SSE encoder, model list, TTS request]]
- [[_COMMUNITY_openai-adapter.test.mjs|openai-adapter.test.mjs]]
- [[_COMMUNITY_Media Providers|Media Providers]]
- [[_COMMUNITY_gemini-generate.ts|gemini-generate.ts]]
- [[_COMMUNITY_anthropic-adapter.test.mjs|anthropic-adapter.test.mjs]]
- [[_COMMUNITY_vertex-adapter.test.mjs|vertex-adapter.test.mjs]]
- [[_COMMUNITY_inventory.ts|inventory.ts]]
- [[_COMMUNITY_Bounded patterns|Bounded patterns]]
- [[_COMMUNITY_Proxy Pools|Proxy Pools]]
- [[_COMMUNITY_database.ts|database.ts]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_Token Saver|Token Saver]]
- [[_COMMUNITY_Provider authentication|Provider authentication]]
- [[_COMMUNITY_Milestone M1 · Walking skeleton (thin end-to-end slice)|Milestone M1 · Walking skeleton (thin end-to-end slice)]]
- [[_COMMUNITY_srcpricing.ts|src/pricing.ts]]
- [[_COMMUNITY_cli.ts|cli.ts]]
- [[_COMMUNITY_coverage.ts|coverage.ts]]
- [[_COMMUNITY_ready|ready]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_enginepackage.json|engine/package.json]]
- [[_COMMUNITY_OpenAIChatStreamEncoder|OpenAIChatStreamEncoder]]
- [[_COMMUNITY_thinking.ts|thinking.ts]]
- [[_COMMUNITY_gemini-adapter.test.mjs|gemini-adapter.test.mjs]]
- [[_COMMUNITY_ollama-adapter.test.mjs|ollama-adapter.test.mjs]]
- [[_COMMUNITY_openai-protocol.test.mjs|openai-protocol.test.mjs]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_dependencies|dependencies]]
- [[_COMMUNITY_.summary|.summary]]
- [[_COMMUNITY_Endpoint & API Key|Endpoint & API Key]]
- [[_COMMUNITY_Rule 4 — Every workload must be BOUNDED|Rule 4 — Every workload must be BOUNDED]]
- [[_COMMUNITY_GithubAdapter|GithubAdapter]]
- [[_COMMUNITY_AnthropicStreamEncoder|AnthropicStreamEncoder]]
- [[_COMMUNITY_commandcode-adapter.test.mjs|commandcode-adapter.test.mjs]]
- [[_COMMUNITY_connection-data.test.mjs|connection-data.test.mjs]]
- [[_COMMUNITY_github-copilot.test.mjs|github-copilot.test.mjs]]
- [[_COMMUNITY_openai-responses-adapter.test.mjs|openai-responses-adapter.test.mjs]]
- [[_COMMUNITY_Body|Body]]
- [[_COMMUNITY_paritypackage.json|parity/package.json]]
- [[_COMMUNITY_.test|.test]]
- [[_COMMUNITY_Rule 1 — Write LEAN code, no over-engineering|Rule 1 — Write LEAN code, no over-engineering]]
- [[_COMMUNITY_usage-meter.ts|usage-meter.ts]]
- [[_COMMUNITY_Model mapping|Model mapping]]
- [[_COMMUNITY_Model registry|Model registry]]
- [[_COMMUNITY_Usage contract (M2 SP24a, SP24b)|Usage contract (M2 SP24a, SP24b)]]
- [[_COMMUNITY_catalogschema.ts|catalog/schema.ts]]
- [[_COMMUNITY_claude-codex.test.mjs|claude-codex.test.mjs]]
- [[_COMMUNITY_gemini-cli.test.mjs|gemini-cli.test.mjs]]
- [[_COMMUNITY_Remote functionality|Remote functionality]]
- [[_COMMUNITY_Multi-account|Multi-account]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_`porting-behavior-not-code` RED baseline|`porting-behavior-not-code` RED baseline]]
- [[_COMMUNITY_`writing-lean-bounded-code` RED baseline|`writing-lean-bounded-code` RED baseline]]
- [[_COMMUNITY_Database|Database]]
- [[_COMMUNITY_Provider account management|Provider account management]]
- [[_COMMUNITY_AIGate — Project Map|AIGate — Project Map]]
- [[_COMMUNITY_GeminiStreamEncoder|GeminiStreamEncoder]]
- [[_COMMUNITY_engine.test.mjs|engine.test.mjs]]
- [[_COMMUNITY_responses-protocol.test.mjs|responses-protocol.test.mjs]]
- [[_COMMUNITY_scripts|scripts]]
- [[_COMMUNITY_usage.test.mjs|usage.test.mjs]]
- [[_COMMUNITY_Quota Tracker|Quota Tracker]]
- [[_COMMUNITY_Speech contract (M2 SP23)|Speech contract (M2 SP23)]]
- [[_COMMUNITY_AIGate schema conventions|AIGate schema conventions]]
- [[_COMMUNITY_.stream|.stream]]
- [[_COMMUNITY_OAuthProvider|OAuthProvider]]
- [[_COMMUNITY_anthropic-protocol.test.mjs|anthropic-protocol.test.mjs]]
- [[_COMMUNITY_antigravity.test.mjs|antigravity.test.mjs]]
- [[_COMMUNITY_oauth-lane.test.mjs|oauth-lane.test.mjs]]
- [[_COMMUNITY_SPIKE-1 SQLite drivers through Drizzle|SPIKE-1: SQLite drivers through Drizzle]]
- [[_COMMUNITY_oauth.test.mjs|oauth.test.mjs]]
- [[_COMMUNITY_trae.test.mjs|trae.test.mjs]]
- [[_COMMUNITY_Hoàn thiện SP23 TTS lane + voice listing + preview|Hoàn thiện SP23: TTS lane + voice listing + preview]]
- [[_COMMUNITY_SP24a ghi usage, cost theo pricing, thống kê, SSE live, màn Usage và chỉnh giá|SP24a: ghi usage, cost theo pricing, thống kê, SSE live, màn Usage và chỉnh giá]]
- [[_COMMUNITY_SP24b request detail (metadata + attempts), usage của media lanes, màn Requests|SP24b: request detail (metadata + attempts), usage của media lanes, màn Requests]]
- [[_COMMUNITY_DatabaseShutdown|DatabaseShutdown]]
- [[_COMMUNITY_claude-codex-lane.test.mjs|claude-codex-lane.test.mjs]]
- [[_COMMUNITY_Token Saver contract (M2 SP21)|Token Saver contract (M2 SP21)]]
- [[_COMMUNITY_Gap register|Gap register]]
- [[_COMMUNITY_SP0.6 skill discovery|SP0.6 skill discovery]]
- [[_COMMUNITY_scripts|scripts]]
- [[_COMMUNITY_Names|Names]]
- [[_COMMUNITY_AIGate|AIGate]]
- [[_COMMUNITY_Parity report (M1 gate)|Parity report (M1 gate)]]
- [[_COMMUNITY_antigravity-config.ts|antigravity-config.ts]]
- [[_COMMUNITY_toDescriptor|toDescriptor]]
- [[_COMMUNITY_Registry|Registry]]
- [[_COMMUNITY_gemini-protocol.test.mjs|gemini-protocol.test.mjs]]
- [[_COMMUNITY_secret-cipher.test.mjs|secret-cipher.test.mjs]]
- [[_COMMUNITY_provider|provider]]
- [[_COMMUNITY_app.test.mjs|app.test.mjs]]
- [[_COMMUNITY_webCLAUDE|web/CLAUDE.md]]
- [[_COMMUNITY_tts.test.mjs|tts.test.mjs]]
- [[_COMMUNITY_.dependency-cruiser.cjs|.dependency-cruiser.cjs]]
- [[_COMMUNITY_audit.py|audit.py]]
- [[_COMMUNITY_nav.py|nav.py]]
- [[_COMMUNITY_enginetestcatalog.test.mjs|engine/test/catalog.test.mjs]]
- [[_COMMUNITY_pricing.test.mjs|pricing.test.mjs]]
- [[_COMMUNITY_vitest.config.ts|vitest.config.ts]]
- [[_COMMUNITY_Community 197|Community 197]]
- [[_COMMUNITY_Community 198|Community 198]]
- [[_COMMUNITY_Community 199|Community 199]]
- [[_COMMUNITY_Community 200|Community 200]]
- [[_COMMUNITY_Community 201|Community 201]]
- [[_COMMUNITY_Community 202|Community 202]]
- [[_COMMUNITY_Community 203|Community 203]]
- [[_COMMUNITY_Community 204|Community 204]]
- [[_COMMUNITY_Community 205|Community 205]]
- [[_COMMUNITY_Community 206|Community 206]]
- [[_COMMUNITY_Community 207|Community 207]]
- [[_COMMUNITY_Community 208|Community 208]]
- [[_COMMUNITY_Community 209|Community 209]]
- [[_COMMUNITY_Community 210|Community 210]]
- [[_COMMUNITY_Community 211|Community 211]]
- [[_COMMUNITY_Community 212|Community 212]]
- [[_COMMUNITY_Community 213|Community 213]]
- [[_COMMUNITY_Community 214|Community 214]]
- [[_COMMUNITY_Community 215|Community 215]]
- [[_COMMUNITY_Community 216|Community 216]]
- [[_COMMUNITY_Community 217|Community 217]]
- [[_COMMUNITY_Community 218|Community 218]]
- [[_COMMUNITY_Community 219|Community 219]]
- [[_COMMUNITY_Community 220|Community 220]]
- [[_COMMUNITY_Community 221|Community 221]]
- [[_COMMUNITY_Community 222|Community 222]]
- [[_COMMUNITY_Community 223|Community 223]]
- [[_COMMUNITY_Community 224|Community 224]]
- [[_COMMUNITY_Community 225|Community 225]]
- [[_COMMUNITY_Community 226|Community 226]]
- [[_COMMUNITY_Community 227|Community 227]]
- [[_COMMUNITY_Community 228|Community 228]]
- [[_COMMUNITY_Community 229|Community 229]]
- [[_COMMUNITY_Community 230|Community 230]]
- [[_COMMUNITY_Community 231|Community 231]]
- [[_COMMUNITY_Community 232|Community 232]]
- [[_COMMUNITY_Community 233|Community 233]]
- [[_COMMUNITY_Community 234|Community 234]]
- [[_COMMUNITY_Community 235|Community 235]]
- [[_COMMUNITY_Community 236|Community 236]]
- [[_COMMUNITY_Community 237|Community 237]]
- [[_COMMUNITY_Community 238|Community 238]]
- [[_COMMUNITY_Community 239|Community 239]]
- [[_COMMUNITY_Community 240|Community 240]]
- [[_COMMUNITY_Community 241|Community 241]]
- [[_COMMUNITY_Community 242|Community 242]]
- [[_COMMUNITY_Community 243|Community 243]]
- [[_COMMUNITY_Community 244|Community 244]]
- [[_COMMUNITY_Community 245|Community 245]]
- [[_COMMUNITY_Community 246|Community 246]]
- [[_COMMUNITY_Community 247|Community 247]]
- [[_COMMUNITY_Community 248|Community 248]]
- [[_COMMUNITY_Community 249|Community 249]]
- [[_COMMUNITY_Community 250|Community 250]]
- [[_COMMUNITY_Community 251|Community 251]]
- [[_COMMUNITY_Community 252|Community 252]]
- [[_COMMUNITY_Community 253|Community 253]]
- [[_COMMUNITY_Community 254|Community 254]]
- [[_COMMUNITY_Community 255|Community 255]]
- [[_COMMUNITY_Community 256|Community 256]]
- [[_COMMUNITY_Community 257|Community 257]]
- [[_COMMUNITY_Community 258|Community 258]]
- [[_COMMUNITY_Community 259|Community 259]]
- [[_COMMUNITY_Community 260|Community 260]]
- [[_COMMUNITY_Community 261|Community 261]]
- [[_COMMUNITY_Community 262|Community 262]]
- [[_COMMUNITY_Community 263|Community 263]]
- [[_COMMUNITY_Community 264|Community 264]]
- [[_COMMUNITY_Community 265|Community 265]]
- [[_COMMUNITY_Community 266|Community 266]]
- [[_COMMUNITY_Community 267|Community 267]]
- [[_COMMUNITY_Community 268|Community 268]]
- [[_COMMUNITY_Community 269|Community 269]]
- [[_COMMUNITY_Community 270|Community 270]]
- [[_COMMUNITY_Community 271|Community 271]]
- [[_COMMUNITY_Community 272|Community 272]]
- [[_COMMUNITY_Community 273|Community 273]]
- [[_COMMUNITY_Community 274|Community 274]]
- [[_COMMUNITY_Community 275|Community 275]]
- [[_COMMUNITY_Community 276|Community 276]]
- [[_COMMUNITY_Community 277|Community 277]]
- [[_COMMUNITY_Community 278|Community 278]]
- [[_COMMUNITY_Community 279|Community 279]]
- [[_COMMUNITY_Community 280|Community 280]]
- [[_COMMUNITY_Community 281|Community 281]]
- [[_COMMUNITY_Community 282|Community 282]]
- [[_COMMUNITY_Community 283|Community 283]]
- [[_COMMUNITY_Community 284|Community 284]]
- [[_COMMUNITY_Community 285|Community 285]]
- [[_COMMUNITY_Community 286|Community 286]]
- [[_COMMUNITY_Community 287|Community 287]]
- [[_COMMUNITY_Community 288|Community 288]]
- [[_COMMUNITY_Community 289|Community 289]]
- [[_COMMUNITY_Community 290|Community 290]]
- [[_COMMUNITY_Community 291|Community 291]]
- [[_COMMUNITY_Community 292|Community 292]]
- [[_COMMUNITY_Community 293|Community 293]]
- [[_COMMUNITY_Community 294|Community 294]]
- [[_COMMUNITY_Community 295|Community 295]]
- [[_COMMUNITY_Community 296|Community 296]]
- [[_COMMUNITY_Community 297|Community 297]]
- [[_COMMUNITY_Community 298|Community 298]]
- [[_COMMUNITY_Community 299|Community 299]]
- [[_COMMUNITY_Community 300|Community 300]]
- [[_COMMUNITY_Community 301|Community 301]]
- [[_COMMUNITY_Community 302|Community 302]]
- [[_COMMUNITY_Community 303|Community 303]]
- [[_COMMUNITY_Community 304|Community 304]]
- [[_COMMUNITY_Community 305|Community 305]]
- [[_COMMUNITY_Community 306|Community 306]]
- [[_COMMUNITY_Community 307|Community 307]]
- [[_COMMUNITY_Community 308|Community 308]]
- [[_COMMUNITY_Community 309|Community 309]]
- [[_COMMUNITY_Community 310|Community 310]]
- [[_COMMUNITY_Community 311|Community 311]]
- [[_COMMUNITY_Community 312|Community 312]]
- [[_COMMUNITY_Community 313|Community 313]]
- [[_COMMUNITY_Community 314|Community 314]]
- [[_COMMUNITY_Community 315|Community 315]]
- [[_COMMUNITY_Community 316|Community 316]]
- [[_COMMUNITY_Community 317|Community 317]]
- [[_COMMUNITY_Community 318|Community 318]]
- [[_COMMUNITY_Community 319|Community 319]]
- [[_COMMUNITY_Community 320|Community 320]]
- [[_COMMUNITY_Community 321|Community 321]]
- [[_COMMUNITY_Community 322|Community 322]]
- [[_COMMUNITY_Community 323|Community 323]]
- [[_COMMUNITY_Community 324|Community 324]]
- [[_COMMUNITY_Community 325|Community 325]]
- [[_COMMUNITY_Community 326|Community 326]]
- [[_COMMUNITY_Community 327|Community 327]]
- [[_COMMUNITY_Community 328|Community 328]]
- [[_COMMUNITY_Community 329|Community 329]]
- [[_COMMUNITY_Community 330|Community 330]]
- [[_COMMUNITY_Community 331|Community 331]]
- [[_COMMUNITY_Community 332|Community 332]]
- [[_COMMUNITY_Community 333|Community 333]]
- [[_COMMUNITY_Community 334|Community 334]]
- [[_COMMUNITY_Community 335|Community 335]]
- [[_COMMUNITY_Community 336|Community 336]]
- [[_COMMUNITY_Community 337|Community 337]]
- [[_COMMUNITY_Community 338|Community 338]]
- [[_COMMUNITY_Community 339|Community 339]]
- [[_COMMUNITY_Community 340|Community 340]]
- [[_COMMUNITY_Community 341|Community 341]]
- [[_COMMUNITY_Community 342|Community 342]]
- [[_COMMUNITY_Community 343|Community 343]]
- [[_COMMUNITY_Community 344|Community 344]]
- [[_COMMUNITY_Community 345|Community 345]]
- [[_COMMUNITY_Community 346|Community 346]]
- [[_COMMUNITY_Community 347|Community 347]]
- [[_COMMUNITY_Community 348|Community 348]]
- [[_COMMUNITY_Community 349|Community 349]]
- [[_COMMUNITY_Community 350|Community 350]]
- [[_COMMUNITY_Community 351|Community 351]]
- [[_COMMUNITY_Community 352|Community 352]]
- [[_COMMUNITY_Community 353|Community 353]]
- [[_COMMUNITY_Community 354|Community 354]]
- [[_COMMUNITY_Community 355|Community 355]]
- [[_COMMUNITY_Community 356|Community 356]]
- [[_COMMUNITY_Community 357|Community 357]]
- [[_COMMUNITY_Community 358|Community 358]]
- [[_COMMUNITY_Community 359|Community 359]]
- [[_COMMUNITY_Community 360|Community 360]]
- [[_COMMUNITY_Community 361|Community 361]]
- [[_COMMUNITY_Community 362|Community 362]]
- [[_COMMUNITY_Community 363|Community 363]]
- [[_COMMUNITY_Community 364|Community 364]]
- [[_COMMUNITY_Community 367|Community 367]]
- [[_COMMUNITY_Community 368|Community 368]]
- [[_COMMUNITY_Community 369|Community 369]]
- [[_COMMUNITY_Community 370|Community 370]]
- [[_COMMUNITY_Community 371|Community 371]]
- [[_COMMUNITY_Community 372|Community 372]]
- [[_COMMUNITY_Community 373|Community 373]]
- [[_COMMUNITY_Community 374|Community 374]]
- [[_COMMUNITY_Community 375|Community 375]]
- [[_COMMUNITY_Community 376|Community 376]]
- [[_COMMUNITY_Community 377|Community 377]]
- [[_COMMUNITY_Community 378|Community 378]]
- [[_COMMUNITY_Community 379|Community 379]]
- [[_COMMUNITY_Community 380|Community 380]]
- [[_COMMUNITY_Community 381|Community 381]]
- [[_COMMUNITY_Community 382|Community 382]]
- [[_COMMUNITY_Community 383|Community 383]]
- [[_COMMUNITY_Community 384|Community 384]]
- [[_COMMUNITY_Community 385|Community 385]]
- [[_COMMUNITY_Community 386|Community 386]]
- [[_COMMUNITY_Community 387|Community 387]]
- [[_COMMUNITY_Community 388|Community 388]]
- [[_COMMUNITY_Community 389|Community 389]]
- [[_COMMUNITY_Community 390|Community 390]]
- [[_COMMUNITY_Community 391|Community 391]]
- [[_COMMUNITY_Community 392|Community 392]]
- [[_COMMUNITY_Community 393|Community 393]]
- [[_COMMUNITY_Community 394|Community 394]]
- [[_COMMUNITY_Community 395|Community 395]]
- [[_COMMUNITY_Community 396|Community 396]]
- [[_COMMUNITY_Community 397|Community 397]]
- [[_COMMUNITY_Community 398|Community 398]]
- [[_COMMUNITY_Community 399|Community 399]]
- [[_COMMUNITY_Community 400|Community 400]]
- [[_COMMUNITY_Community 401|Community 401]]
- [[_COMMUNITY_Community 402|Community 402]]
- [[_COMMUNITY_Community 403|Community 403]]
- [[_COMMUNITY_Community 405|Community 405]]
- [[_COMMUNITY_Community 406|Community 406]]
- [[_COMMUNITY_Community 407|Community 407]]
- [[_COMMUNITY_Community 408|Community 408]]
- [[_COMMUNITY_Community 409|Community 409]]
- [[_COMMUNITY_Community 410|Community 410]]
- [[_COMMUNITY_Community 411|Community 411]]
- [[_COMMUNITY_Community 412|Community 412]]
- [[_COMMUNITY_Community 413|Community 413]]
- [[_COMMUNITY_Community 414|Community 414]]
- [[_COMMUNITY_Community 415|Community 415]]
- [[_COMMUNITY_Community 416|Community 416]]
- [[_COMMUNITY_Community 417|Community 417]]
- [[_COMMUNITY_Community 418|Community 418]]
- [[_COMMUNITY_Community 419|Community 419]]
- [[_COMMUNITY_Community 420|Community 420]]
- [[_COMMUNITY_Community 421|Community 421]]
- [[_COMMUNITY_Community 422|Community 422]]
- [[_COMMUNITY_Community 423|Community 423]]
- [[_COMMUNITY_Community 424|Community 424]]
- [[_COMMUNITY_Community 425|Community 425]]
- [[_COMMUNITY_Community 426|Community 426]]
- [[_COMMUNITY_Community 427|Community 427]]
- [[_COMMUNITY_Community 428|Community 428]]
- [[_COMMUNITY_Community 429|Community 429]]
- [[_COMMUNITY_Community 430|Community 430]]
- [[_COMMUNITY_Community 431|Community 431]]
- [[_COMMUNITY_Community 432|Community 432]]
- [[_COMMUNITY_Community 433|Community 433]]
- [[_COMMUNITY_Community 434|Community 434]]
- [[_COMMUNITY_Community 435|Community 435]]
- [[_COMMUNITY_Community 438|Community 438]]
- [[_COMMUNITY_Community 439|Community 439]]
- [[_COMMUNITY_Community 440|Community 440]]
- [[_COMMUNITY_Community 450|Community 450]]

## God Nodes (most connected - your core abstractions)
1. `Credential` - 142 edges
2. `api()` - 135 edges
3. `record()` - 111 edges
4. `text()` - 107 edges
5. `integrations/screens.tsx` - 106 edges
6. `ExecCtx` - 106 edges
7. `engine/src/index.ts` - 105 edges
8. `@nestjs/common` - 102 edges
9. `CanonicalRequest` - 94 edges
10. `toProblem()` - 93 edges

## Surprising Connections (you probably didn't know these)
- `Usage()` --calls--> `Cost`  [INFERRED]
  apps/web/src/features/traffic/usage.tsx → docs/contracts/usage.md
- `Keyless proxy strategy panel with empty state` --extends--> `Proxy Pools — /network/proxy-pools`  [EXTRACTED]
  apps/web/src/features/network/screens.tsx → docs/superpowers/specs/2026-09-22-aigate-design.md
- `Platform-specific hosted relay deploy wizard` --extends--> `Proxy Pools — /network/proxy-pools`  [EXTRACTED]
  apps/web/src/features/network/screens.tsx → docs/superpowers/specs/2026-09-22-aigate-design.md
- `Framework-free thinking suffix parser and override` --feeds--> `Model resolution: provider/model (any id) or a bare catalog id; 404 model_not_found / no_active_connection`  [EXTRACTED]
  packages/engine/src/thinking.ts → docs/contracts/chat-lane.md
- `Trae browser sign-in and callback/token import UI` --wires--> `Connections & AuthFlow — /providers/connections`  [EXTRACTED]
  apps/web/src/features/providers/sign-in.tsx → docs/superpowers/specs/2026-09-22-aigate-design.md

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

## Communities (453 total, 60 thin omitted)

### Community 0 - "Credential"
Cohesion: 0.04
Nodes (127): CONTENT_BLOCKS, HEAVY_AGENT_BETAS, NO_NAMES, NODE_BETAS, STOP_REASONS, THINKING_BUDGETS, collected(), COMMIT_EVENTS (+119 more)

### Community 1 - "record"
Cohesion: 0.03
Nodes (119): ApiType, ConnectionField, ConnectionQuota, connectionsKey, CursorAutoImport, customKey(), CustomModel, DeviceCode (+111 more)

### Community 2 - "ConnectionsRepository"
Cohesion: 0.04
Nodes (114): nodeBetas(), stopReasonOf(), usageOf(), hoistToolResultImages(), CLOUD_CODE, cloudCodeCall(), codeAssistMetadata(), defaultTier() (+106 more)

### Community 3 - "OAuth sign-in contract (M2 SP16)"
Cohesion: 0.02
Nodes (70): IdentityModule, Module, SettingsModule, Module, CONFIG, Draft, ConsoleEvent, ConsoleLogService (+62 more)

### Community 4 - "auth.controller.ts"
Cohesion: 0.06
Nodes (90): PROMPT_REWRITES, sessions, lookupProject(), pending, projects, randomProjectId(), TEST_BODY, collected() (+82 more)

### Community 5 - "provider-node.ts"
Cohesion: 0.04
Nodes (115): ClaudePreview, ClaudeStatus, ClinePreview, ClineStatus, CliToolStatus, CodexPreview, CodexStatus, CopilotPreview (+107 more)

### Community 6 - "chat-lane.ts"
Cohesion: 0.05
Nodes (120): apikey.delete-key, apikey.generate-key, apikey.legacy-format-unenforced, apikey.list-keys, apikey.update-key-status, apikey.validate-lookup, identity.auth-status-disclosure, identity.machine-id-derivation (+112 more)

### Community 7 - "@nestjs/common"
Cohesion: 0.05
Nodes (32): AnthropicAdapter, AntigravityAdapter, copilotMessagesBody(), CommandCodeAdapter, eventOf(), finishOf(), toEnvelope(), CursorAdapter (+24 more)

### Community 8 - "ChatLane"
Cohesion: 0.05
Nodes (48): extractApiKey(), isReservedPrefix(), Widening, answerOf(), ANTHROPIC_MESSAGES, Call, ChatLane, claudeCodePrompt() (+40 more)

### Community 9 - "gateway/screens.tsx"
Cohesion: 0.05
Nodes (106): integrations/api.ts, ClaudePreview, ClaudeStatus, ClinePreview, ClineStatus, CliToolStatus, CodexPreview, CodexStatus (+98 more)

### Community 10 - "providers/screens.tsx"
Cohesion: 0.03
Nodes (105): AnthropicAdapter — CIP <-> Messages (max_tokens rules, thinking budgets, tool_use, SSE events), packages/engine/test/anthropic-adapter.test.mjs (10) + apps/server/test/anthropic-lane.test.mjs (4); 23 mutations caught, Deviations not ported: stop/top_p kept, none stays none, no Claude Code line, stream errors fail, same stop/usage mapping, 403 invalid, Claude Code anthropic-beta list for claude-* models on an Anthropic node (claude-code flag only on the official host), Anthropic node connection test: POST <base>/v1/messages, claude-3-haiku, only 401/403 invalid (9router), Anthropic node descriptor: <base>/messages, x-api-key, Bearer for third-party hosts, anthropicNode { official }, builtinRegistry built from CATALOG (41 connectable providers), CIP image_delta chunk (delta.images) and vendorExtensions.openai.finish_reason honoured by the OpenAI renderer (+97 more)

### Community 11 - "OpenAICompatibleAdapter (AIProviderPort for openai-compatible)"
Cohesion: 0.03
Nodes (88): CATALOG, AuthKind, CATALOG_PROTOCOLS, CatalogAuth, CatalogModel, CatalogProtocol, CatalogProvider, checkUrl() (+80 more)

### Community 12 - "openai-compatible.ts"
Cohesion: 0.03
Nodes (86): ANTIGRAVITY_IDE_BASE_URL, ANTIGRAVITY_IDE_USER_AGENT, ANTIGRAVITY_MODELS_URL, imageAspect(), imageModel(), normalizeContents(), PROMPT_REWRITES, rewrite() (+78 more)

### Community 13 - "providers/api.ts"
Cohesion: 0.05
Nodes (95): settings.outbound-proxy-live-apply, usage.write-not-synchronous, Audit finding: Console shown in sidebar regardless of Developer mode, Audit PASS: no credential leaked across 27 HTML exports, Audit FAIL: only the happy path was drawn (state rules §10.7), Audit finding: MITM CA buttons adjacent, type-to-confirm modal missing, Audit finding: routing-fallback merged 4 tabs into one 3886px screen, Audit finding: settings-auth regenerated as settings-auth-v2 (+87 more)

### Community 14 - "useToast"
Cohesion: 0.03
Nodes (95): transport.proxy-priority-chain, CIP ↔ chat completions mapping (max_completion_tokens, tool messages, data: URLs), transport.test.mjs: adapter streams end to end over DirectTransport, Upstream message ≤300 chars, credential redacted, HTML pages dropped; bad API key → AUTH_ERROR before I/O, OpenAICompatibleAdapter (AIProviderPort for openai-compatible), Truncated stream or error event → PROVIDER_UNAVAILABLE with details.partial, In-place retry: 502/503/504 + unreachable host, ≤3 attempts via withRetry, before first chunk, readSseData() — bounded SSE reader (1 Mi chars per line/event, cancels body) (+87 more)

### Community 15 - "engine/src/index.ts"
Cohesion: 0.05
Nodes (78): reasoningEffort(), budgetToLevel(), children(), cleanGeminiSchema(), constToEnum(), eachSchema(), enumToStrings(), flattenTypeArray() (+70 more)

### Community 16 - "EngineError"
Cohesion: 0.04
Nodes (63): domain/usage.ts, addDays(), csvField(), dayKey(), daysBetween(), formatters, InvalidPeriod, MAX_CUSTOM_DAYS (+55 more)

### Community 17 - "replay.mjs"
Cohesion: 0.04
Nodes (44): errorMessage(), probeCodeAssist(), codexModelIds(), GeminiCliAdapter, modelIds(), GeminiAdapter, streamUsage(), asBase64() (+36 more)

### Community 18 - "anthropic.ts"
Cohesion: 0.04
Nodes (51): addDays(), csvField(), dayKey(), daysBetween(), estimateTokens(), formatters, InvalidPeriod, offsetAt() (+43 more)

### Community 19 - "ConnectionsController — /api/connections CRUD + POST /:id/test (validateCredential outside any transaction)"
Cohesion: 0.05
Nodes (52): field(), givenPassword(), newPassword(), Parsed, parseLogin(), parsePasswordChange(), parseSetup(), validateInitialPassword() (+44 more)

### Community 20 - "app/screens.tsx"
Cohesion: 0.04
Nodes (68): callsTools(), CapacityPool, fits(), HARD, hardNeeds(), isCapacityCapability(), LABEL, messagesLength() (+60 more)

### Community 21 - "Milestone M-1 · Discovery"
Cohesion: 0.03
Nodes (71): cloudCodeCall(), codeAssistMetadata(), defaultTier(), discover(), onboard(), platformEnum(), projectOf(), send() (+63 more)

### Community 22 - "AnthropicAdapter — CIP <-> Messages (max_tokens rules, thinking budgets, tool_use, SSE events)"
Cohesion: 0.04
Nodes (73): ALLOWED, CODEX_MODELS, codexBody(), codexUrl(), DROPPED, EFFORT_SUFFIXES, HOSTED_TOOLS, CODEX_DEFAULT_INSTRUCTIONS (+65 more)

### Community 23 - "isRecord"
Cohesion: 0.08
Nodes (80): app/screens.tsx, ScreenView(), currentLabel(), Shell(), ComboCreate(), Member, modeDetails, Probe (+72 more)

### Community 24 - "speech-lane.ts"
Cohesion: 0.06
Nodes (86): validateCredential(): one call; valid:false only for AUTH_ERROR / QUOTA_EXHAUSTED, docs/discovery/gaps.md (Gap register), Routing → Capacity adapter tab (Vision, Audio input pools), Routing → Combo tab + ComboCreate create/edit, sticky limit, The 23 feature groups required by behavioral.md §5, AuthFlow — declarative, data-driven auth step framework, Canonical Internal Protocol, Definition of Done — 13 items, not self-awarded (+78 more)

### Community 25 - "Bounded context: transport"
Cohesion: 0.04
Nodes (83): catalog.capability-refine-additive-only, catalog.capability-tier-fallback, catalog.capability-vision-pattern-order, catalog.model-registry-global, Adapter: catalog headers first, key last; raw or Bearer scheme; chatUrl/modelsUrl called directly, ListedModel { id, descriptor? } — getModels never invents limits (≤1000 ids), GET /api/providers/:id (chatUrl + models; 404 NOT_FOUND), GET /api/providers (all 121, connectable + reason) (+75 more)

### Community 26 - "SP13 — catalog → runtime registry (41 connectable providers, /api/providers, /providers wired)"
Cohesion: 0.04
Nodes (57): callsTools(), CapacityPool, fits(), HARD, hardNeeds(), isCapacityCapability(), LABEL, messagesLength() (+49 more)

### Community 27 - "quota.service.ts"
Cohesion: 0.06
Nodes (74): providers/api.ts, ApiType, ConnectionQuota, connectionsKey, cursorAutoImport, customKey(), CustomModel, customPath() (+66 more)

### Community 28 - "provider-nodes.repo.ts"
Cohesion: 0.05
Nodes (71): Connection, ConnectionField, HeaderInput, nodePath(), NodeType, path(), ProviderNode, TestStatus (+63 more)

### Community 29 - "vertex.ts"
Cohesion: 0.04
Nodes (32): ApiKeysModule, CatalogModule, ConnectionsModule, IdentityModule, ChatLimits, PxpipeController, isPxpipeTransform(), PXPIPE_DATA_DIR (+24 more)

### Community 30 - "Identity and API keys contract (M1 SP6)"
Cohesion: 0.05
Nodes (68): ApiKey, CapacityCapability, capacityKey, CapacityPool, CapacityPoolFields, ChatReadiness, Combo, ComboFields (+60 more)

### Community 31 - "pricing.repo.ts"
Cohesion: 0.06
Nodes (61): array(), AUDIO_MEDIA_TYPES, cacheMark(), ERROR_SHAPES, errorBody(), FINISH_REASONS, frame(), invalid() (+53 more)

### Community 32 - "database/src/index.ts"
Cohesion: 0.06
Nodes (70): gateway/api.ts, ApiKey, CapacityCapability, capacityKey, CapacityPool, CapacityPoolFields, ChatReadiness, Combo (+62 more)

### Community 33 - "Bounded context: routing (core)"
Cohesion: 0.05
Nodes (56): settings.combo-rotation-reset, parsePool(), ACCOUNT_STATUSES, answerText(), assign(), collectPanel(), worker(), Combo (+48 more)

### Community 34 - "api-keys.repo.ts"
Cohesion: 0.08
Nodes (68): ConsoleGate(), ScreenView(), currentLabel(), Shell(), useCombos(), PoolCard(), ComboCreate(), RoutingSimulatorTab() (+60 more)

### Community 35 - "scripts"
Cohesion: 0.05
Nodes (49): AppModule, Module, DATABASE, DatabaseModule, DatabaseShutdown, Global, Inject, Injectable (+41 more)

### Community 36 - "ChatLane (modules/routing/infrastructure/chat-lane.ts)"
Cohesion: 0.05
Nodes (53): auth, body, encoder, last, list, out, started, upstream (+45 more)

### Community 37 - "cursor.ts"
Cohesion: 0.04
Nodes (57): extraRoutes, navigation, Metrics, OverviewSummary, useOverview(), @tanstack/react-query, apiBlob(), ApiError (+49 more)

### Community 38 - "Request routing"
Cohesion: 0.08
Nodes (48): useRoutingSimulation(), EXAMPLE, KIND, OUTCOME, STATUS, bars(), rate(), TONES (+40 more)

### Community 39 - "Feature Matrix — mandatory 17-column artifact"
Cohesion: 0.05
Nodes (70): AntigravityAdapter - daily Cloud Code envelope, Gemini/Claude/image requests, Antigravity Google OAuth, userinfo, loadCodeAssist and onboarding, adapters/claude-code.ts (prepareClaudeRequest, billing header, user id, _ide + decoys), claude sign-in (claude.ai PKCE, code#state, 4 h lead), adapters/codex.ts (CodexExecutor body, compact URL, model list), codex sign-in (fixed localhost:1455 callback pasted back, id_token account, 5-day lead, 8-day age), adapters/collect.ts (stream collected into one response), copilotChatBody (Copilot part and parameter rules) (+62 more)

### Community 40 - "registry.ts"
Cohesion: 0.08
Nodes (24): extractApiKey(), needsMedia(), ChatLane, claudeCodePrompt(), deadline(), errorOf(), exhausted(), googleKey() (+16 more)

### Community 41 - "OAuthController"
Cohesion: 0.05
Nodes (55): useLiveUsage(), Attempt, ChartBucket, chartKey, ConsoleEvent, consoleKey, Counters, periodParams() (+47 more)

### Community 42 - "lane-helpers.mjs"
Cohesion: 0.09
Nodes (41): array(), AUDIO_MEDIA_TYPES, cacheMark(), CompletionMeta, ERROR_SHAPES, errorBody(), FINISH_REASONS, frame() (+33 more)

### Community 43 - "Overview — /"
Cohesion: 0.06
Nodes (60): useProviders(), MediaProviders(), traffic/api.ts, Attempt, ChartBucket, chartKey, ConsoleEvent, consoleKey (+52 more)

### Community 44 - "GeminiAdapter — CIP <-> generateContent / streamGenerateContent?alt=sse (x-goog-api-key, safety off, thinking level/budget, 400 key test = invalid)"
Cohesion: 0.05
Nodes (65): docs/capabilities.md (GENERATED capability specification), docs/discovery/inventory.json, Feature Matrix entry template (null never "" or "N/A"), Evidence with file:line — traced is a test, not a self-declaration, Fixed inventory counts (154 routes, 28 pages, 123 providers, 29 executors, 48 translators, 11 repos, 14 OAuth routes), parityStatus lifecycle (not-started → traced → contracted → implemented → verified), suspicion block — expected / actual / impact, Constraint — every filesystem scan uses fast-glob with an explicit ignore list (+57 more)

### Community 45 - "traffic/api.ts"
Cohesion: 0.05
Nodes (38): ACCOUNT_STATUSES, answerText(), assign(), collectPanel(), Combo, ComboFields, DEFAULTS, fail() (+30 more)

### Community 46 - "Bounded context: identity"
Cohesion: 0.06
Nodes (25): hostnameOf(), isLocalRequest(), isLoopbackIp(), LOCAL_HOSTNAMES, RequestOrigin, Entry, LOCK_STEPS_MS, LockState (+17 more)

### Community 47 - "ProviderNodesController — /api/provider-nodes CRUD; PREFIX_RESERVED / PREFIX_TAKEN / NODE_LIMIT"
Cohesion: 0.06
Nodes (46): [command, ...args], golden(), main(), option(), report(), ROOT, capabilityIds(), coverage() (+38 more)

### Community 48 - "web/package.json"
Cohesion: 0.05
Nodes (44): { id }, { id, key }, { key, ...view }, repo, signedIn(), as(), create(), encoder (+36 more)

### Community 49 - "usage.tsx"
Cohesion: 0.07
Nodes (48): extraRoutes, navigation, useRoutingSimulation(), EXAMPLE, KIND, OUTCOME, RoutingSimulatorTab(), SimulationResultView() (+40 more)

### Community 50 - "openai-chat.ts"
Cohesion: 0.08
Nodes (43): [command, ...args], golden(), main(), option(), report(), ROOT, capabilityIds(), coverage() (+35 more)

### Community 51 - "OAuth providers"
Cohesion: 0.05
Nodes (57): endpoint.extract-header-order, endpoint.rewrite-lanes, combo.detect-required-capabilities, Durable account and model lock storage, Capacity rules: pool validation, model capability lookup, widen, 3-tier reorder, trimHistory: 80% window budget, first 6 older turns, tool calls kept with results, Combo rules: validation, rotation, member failover, panel/judge requests, collectPanel: 4 literal workers, quorum-grace, hard timeout, straggler cancel (+49 more)

### Community 52 - "combos.repo.ts"
Cohesion: 0.07
Nodes (39): AnthropicAdapter, assistantBlock(), CONTENT_BLOCKS, documentBlock(), HEAVY_AGENT_BETAS, imageBlock(), NO_NAMES, NODE_BETAS (+31 more)

### Community 53 - "API ↔ UI map (docs/design/API_UI_MAP.md)"
Cohesion: 0.07
Nodes (35): adjustMaxTokens(), AnthropicClientRequest, anthropicRequestFor(), AnthropicStreamEncoder, blocksOf(), blockText(), BUDGET_PROTOCOLS, countBlock() (+27 more)

### Community 54 - "cursor.test.mjs"
Cohesion: 0.06
Nodes (51): Descriptor chatProbe: connection test by a one-token chat (azure 401/403, cloudflare 401/403/404, clinepass 401/403), ClinePass: Cline headers naming AIGate, non-stream { success, data } unwrapped, Descriptor auth.optional + connectionBaseUrl; withConnectionBaseUrl(); provider_connections.base_url (migration 0007), provider_connections.deployment, api_version, organization, account_id (migration 0008); POST/PATCH validation per field, Descriptor connectionFields + withConnection(): {field} URL tokens filled per connection (encoded), OpenAI-Organization header, {model} filled per request, Decision (user, 2026-09-25): AES-GCM with a key file and an env override; SP11 connects OpenAI only, User decisions 2026-09-26: SP14g keeps 9router for Azure, refuses Cloudflare images, gives ClinePass a real test (chat probe after live GET /models returned 200 to a fake key), Connections contract (M1 SP11) (+43 more)

### Community 55 - "Bounded context: tooling"
Cohesion: 0.06
Nodes (51): DELETE /api/provider-nodes/:id (cascades the connection), GET /api/provider-nodes, PATCH /api/provider-nodes/:id, POST /api/provider-nodes, /v1: <prefix>/<model> reaches a custom provider after built-in ids, aliases, and catalog prefixes, GET /api/connections/:id/models (adapter getModels, MODELS_FETCH_FAILED), Custom headers - sealed values, hints, validation and merge, Custom provider thinking level (+43 more)

### Community 56 - "anthropic-messages.ts"
Cohesion: 0.04
Nodes (38): bad, call, combo(), image, models, pool(), put(), tools (+30 more)

### Community 57 - "requests.controller.ts"
Cohesion: 0.09
Nodes (30): ApiType, MAX_NODES, NodeChanges, NodeFields, NodeType, checkThinking(), invalid(), notFound() (+22 more)

### Community 58 - "direct-transport.ts"
Cohesion: 0.06
Nodes (35): applyThinking(), BodyOptions, budgetFloor(), cachedSignature(), familyOf(), FINISH, functionResponse(), Intent (+27 more)

### Community 59 - "json"
Cohesion: 0.08
Nodes (31): memberFailover(), CHAT_LIMITS, ClientGone, fallbackCooldown(), GatewayError, mediaCooldown(), audioType(), badRequest() (+23 more)

### Community 60 - "AIGate — Capability Specification"
Cohesion: 0.05
Nodes (39): server/package.json, devDependencies, @types/node, typescript, @aigate/engine, drizzle-orm, @types/node, typescript (+31 more)

### Community 61 - "gemini.ts"
Cohesion: 0.08
Nodes (37): Parsed, API_TYPES, ApiType, asBody(), DEFAULT_BASE_URLS, fail(), HeaderInput, isApiType() (+29 more)

### Community 62 - "Parity verification — 3 tiers"
Cohesion: 0.07
Nodes (20): AccountCandidate, chooseAccount(), ConnectionFields, maskHint(), refreshContext(), sealContext(), columns, ConnectionData (+12 more)

### Community 63 - "CommandCodeAdapter — envelope, NDJSON events via readJsonLines, peek with in-band error classification and 5xx retries, collapse for non-streaming clients, ping test"
Cohesion: 0.05
Nodes (41): airforce, bare, bearer, big, body(), cases, check(), chunk() (+33 more)

### Community 64 - "OpenAIResponsesAdapter — CIP <-> Responses API (extends OpenAICompatibleAdapter; 9router request and stream, corrected non-stream)"
Cohesion: 0.08
Nodes (47): Status → ErrorCode by status + error.code/type only (never message text), Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Error taxonomy (8 ErrorCodes), Stated limits of tape-based parity, Parity verification — 3 tiers, Recording proxy + 4-part tape, Normalizer + semantic SSE diff (not chunk diff) (+39 more)

### Community 65 - "rtk.ts"
Cohesion: 0.05
Nodes (41): adapter, bare, before, body, chunks, claude, client, clientBody (+33 more)

### Community 66 - "Providers"
Cohesion: 0.08
Nodes (28): Headers, isWellFormedKey(), KEY_PREFIX, maskKey(), MAX_KEYS, onlyKey(), Parsed, parseKeyName() (+20 more)

### Community 67 - "protocols/openai-responses.ts"
Cohesion: 0.1
Nodes (24): AccountCandidate, chooseAccount(), keyHint(), maskHint(), refreshContext(), sealContext(), BoundedRows, columns (+16 more)

### Community 68 - ".constructor"
Cohesion: 0.1
Nodes (29): domain/settings.ts, EDITABLE, MAX_SETTINGS_DOCUMENT_BYTES, parseSettingsDocument(), parseSettingsPatch(), PatchResult, Settings, settingsDocument (+21 more)

### Community 69 - "helpers.mjs"
Cohesion: 0.13
Nodes (30): agentBody(), agentValue(), bytes(), checksum(), CursorAdapter, cursorHeaders(), decode(), decodeAgentValue() (+22 more)

### Community 70 - "DirectTransport (direct branch implementation)"
Cohesion: 0.09
Nodes (27): domain/pricing.ts, isField(), isObject(), MAX_OVERRIDES, MAX_PATCH_MODELS, parsePricingPatch(), PriceEdit, validId() (+19 more)

### Community 71 - "Settings"
Cohesion: 0.09
Nodes (38): database/src/index.ts, apiKeys, schema/catalog.ts, customModels, providerThinking, THINKING_LEVEL_VALUES, accountLocks, AUTH_TYPES (+30 more)

### Community 72 - "SettingsRepository"
Cohesion: 0.07
Nodes (17): HttpProviderAdapter, asBase64(), catText(), clean(), errorFor(), KiroAdapter, requestBody(), stopReason() (+9 more)

### Community 73 - "builtin-registry.ts"
Cohesion: 0.06
Nodes (19): DisplayNames, Names, Alert, empty(), Metrics, OverviewController, OverviewRepository, QuotaLine (+11 more)

### Community 74 - "CustomModelsRepository"
Cohesion: 0.12
Nodes (38): key, MitmPreview, MitmStatus, mutation(), ProxyPool, ProxyPoolInput, ProxyPoolType, ProxyRotation (+30 more)

### Community 75 - "usage.repo.ts"
Cohesion: 0.06
Nodes (35): devDependencies, dependency-cruiser, eslint, eslint-plugin-boundaries, typescript-eslint, engines, node, name (+27 more)

### Community 76 - "network/api.ts"
Cohesion: 0.1
Nodes (7): GrokBuildSettingsController, Draft, FILE, GrokBuildSettingsService, hash(), Subagents, TYPES

### Community 77 - "CLI Tools"
Cohesion: 0.09
Nodes (29): CHAT_LIMITS, REQUEST_BUDGET_MS, audioType(), badRequest(), decodeFailure(), formatOf(), isObject(), optionalText() (+21 more)

### Community 78 - "database/package.json"
Cohesion: 0.05
Nodes (39): 10.9 Đặc tả từng màn hình, 11 · Console — `/traffic/console` (dev only), 12 · Proxy Pools — `/network/proxy-pools`, 13 · Tunnel — `/network/tunnel`, 14 · MITM — `/network/mitm`, 15 · CLI Tools — `/integrations/cli-tools`, `/:toolId`, 16 · Skills — `/integrations/skills`, 17 · MCP — `/integrations/mcp` (mới) (+31 more)

### Community 79 - "Model import and custom models contract (M2 SP16a)"
Cohesion: 0.08
Nodes (18): Inject, abortCode(), codeOf(), meter(), meteredSend(), NONE, usageOfBody(), RuntimeController (+10 more)

### Community 80 - "Descriptor connectionFields + withConnection(): {field} URL tokens filled per connection (encoded), OpenAI-Organization header, {model} filled per request"
Cohesion: 0.1
Nodes (30): overview/api.ts, Metrics, OverviewSummary, UsageSummary, shared/api.ts, apiBlob(), ApiError, apiStream() (+22 more)

### Community 81 - "clients.ts"
Cohesion: 0.08
Nodes (15): b64url(), cacheKey(), googleAccessToken(), jsonPart(), parseGoogleCredential(), remember(), signedAssertion(), authorize() (+7 more)

### Community 82 - "conformance.mjs"
Cohesion: 0.05
Nodes (37): AIGate progress handoff, Cline recommended models (2026-10-08), Codex sign-in fix — 1455 callback relay (2026-10-08), Codex usage-limit reset (2026-10-08), Completed and verified, Custom-provider media mapping (2026-10-08), M0 SP0.1 in progress, Next concrete work (+29 more)

### Community 83 - "catalog.controller.ts"
Cohesion: 0.17
Nodes (26): ConnectionView, CacheEntry, claude(), codebuddy(), codex(), deepseek(), endpoint(), github() (+18 more)

### Community 84 - "domain/usage.ts"
Cohesion: 0.12
Nodes (6): GrokBuildSettingsController, Controller, Get, Post, GrokBuildSettingsService, Injectable

### Community 85 - "body"
Cohesion: 0.16
Nodes (24): CacheEntry, claude(), codebuddy(), codex(), deepseek(), endpoint(), github(), glm() (+16 more)

### Community 86 - "discovery/package.json"
Cohesion: 0.06
Nodes (33): answer, approved, cbPoll, cbStart, cline, code, ctx, exchanged (+25 more)

### Community 87 - "Translation"
Cohesion: 0.05
Nodes (37): A copied provider/model(level) id resolves the base catalog model and makes the suffix override request and provider-default thinking, A forceStream provider in the chat completions format answering a client that did not ask to stream: the SSE body is collapsed into one chat.completion, AWS CodeWhisperer/Amazon Q request shaping and binary EventStream response decoding, Body parse, 1M-context marker strip, API-key gate, missing-model check, Cancelling the upstream request when the client goes away, Chat-lane route handlers that hand the request to handleChat, Choosing forced SSE-to-JSON, plain JSON, or streaming handling for a 2xx response, Choosing the upstream format and endpoint (runtime transport) (+29 more)

### Community 88 - "Combo / Vision Adapter"
Cohesion: 0.14
Nodes (15): flowError(), invalid(), NO_PKCE, OAuthController, objectRecord(), stringifyQuery(), strings(), Controller (+7 more)

### Community 89 - "Translation / language functionality"
Cohesion: 0.12
Nodes (10): GithubAdapter, isClaude(), servesResponses(), GoogleCloud, isKeyAnswer(), rememberProject(), staleToken(), OAuthIO (+2 more)

### Community 90 - "SP0 — 2 skills + mechanical lint suite"
Cohesion: 0.08
Nodes (34): anthropic, bad, bare, body(), bodyOf(), cases, check(), collect() (+26 more)

### Community 91 - "ResponsesStreamEncoder"
Cohesion: 0.12
Nodes (7): MitmController, Controller, Get, Post, MitmService, Inject, Injectable

### Community 92 - "src/schema.ts"
Cohesion: 0.07
Nodes (31): answer, anthropicSent, anthropicTransport, bare, base, body(), cases, chat (+23 more)

### Community 93 - "Port behavior, not code"
Cohesion: 0.13
Nodes (21): ConnectionChanges, DATA_FIELD_NAMES, checkForProvider(), ConnectionsController, credentialOf(), invalid(), Named, notFound() (+13 more)

### Community 94 - "models.tsx"
Cohesion: 0.09
Nodes (35): network/api.ts, key, MitmPreview, MitmStatus, mutation(), path(), ProxyPool, ProxyPoolInput (+27 more)

### Community 95 - "06-combo-capacity-adapter.yaml"
Cohesion: 0.12
Nodes (20): createAdapter(), familyAdapter(), ConnectionChanges, DATA_FIELD_NAMES, checkForProvider(), ConnectionsController, credentialOf(), invalid() (+12 more)

### Community 96 - "Usage"
Cohesion: 0.12
Nodes (7): OpenClawSettingsController, Draft, FILE, hash(), object(), OpenClawSettingsService, Target

### Community 97 - "UsageRecorder"
Cohesion: 0.06
Nodes (27): adapter, body, chain, chatAnswer, chunks, credential, ctx, denied (+19 more)

### Community 98 - "protocols/gemini-generate.ts — path parsing, text-only request, GenerateContentResponse, Gemini SSE encoder, model list, TTS request"
Cohesion: 0.07
Nodes (27): adapter, adc, call, credential, encoder, escaped, form, [header, claims, signature] (+19 more)

### Community 99 - "openai-adapter.test.mjs"
Cohesion: 0.09
Nodes (25): computeCoverage(), CoverageReport, Dimension, EVIDENCE_PATH, renderCoverage(), buildInventory(), glob(), IGNORE (+17 more)

### Community 100 - "Media Providers"
Cohesion: 0.06
Nodes (32): 10. ARCHITECTURE MỚI KHÔNG PHỤ THUỘC 9ROUTER, 11. PROVIDER PHẢI QUA PORT, 12. ROUTER PHẢI LÀ BUSINESS ENGINE RIÊNG, 13. TRANSLATOR / PROTOCOL, 14. FEATURE PARITY KHÔNG CÓ NGHĨA CODE PARITY, 15. CODE QUALITY, 16. PERFORMANCE, 17. LATENCY (+24 more)

### Community 101 - "gemini-generate.ts"
Cohesion: 0.06
Nodes (32): web/package.json, dependencies, @radix-ui/react-dialog, react, react-dom, @tanstack/react-query, @tanstack/react-router, devDependencies (+24 more)

### Community 102 - "anthropic-adapter.test.mjs"
Cohesion: 0.14
Nodes (28): agentBody(), agentValue(), checksum(), cursorHeaders(), decode(), decodeAgentValue(), decoder, digest() (+20 more)

### Community 103 - "vertex-adapter.test.mjs"
Cohesion: 0.12
Nodes (5): ManagedTomlSettingsController, Draft, hash(), ManagedTomlSettingsService, ManagedTomlTool

### Community 104 - "inventory.ts"
Cohesion: 0.11
Nodes (6): JcodeSettingsController, CONFIG, Draft, ENV, hash(), JcodeSettingsService

### Community 105 - "Bounded patterns"
Cohesion: 0.12
Nodes (11): CodexSettingsController, Controller, Get, Post, CodexSettingsService, CONFIG, digest(), Draft (+3 more)

### Community 106 - "Proxy Pools"
Cohesion: 0.13
Nodes (7): ManagedTomlSettingsController, Controller, Get, Param, Post, ManagedTomlSettingsService, Injectable

### Community 107 - "database.ts"
Cohesion: 0.09
Nodes (11): CustomModelsController, filled(), invalid(), CustomModelsRepository, CustomModelView, RUNTIME_CONFIG, RuntimeConfig, RuntimeController (+3 more)

### Community 108 - "compilerOptions"
Cohesion: 0.12
Nodes (16): EDITABLE, parseSettingsDocument(), parseSettingsPatch(), PatchResult, Settings, SettingsDocument, SettingsPatch, validHttpUrl() (+8 more)

### Community 109 - "Token Saver"
Cohesion: 0.06
Nodes (31): antigravity: Google OAuth with the public Antigravity client, the IDE's Cloud Code endpoint daily-cloudcode-pa.googleapis.com, Gemini and Claude models in one envelope, image generation, IDE request ids, Browser-assisted desktop login start and status polling, Browser login through GetLoginGuidance and loopback callback, plus Cloud-IDE-JWT token import, claude: PKCE sign-in at claude.ai, Messages at api.anthropic.com with Claude Code headers and, for sk-ant-oat tokens, cloaking, Cline and ClinePass sign-in, token format, refresh, and request headers, CodeBuddy browser state flow, OAuth token refresh, and stream-only OpenAI chat, codex: PKCE sign-in at auth.openai.com with a fixed 1455 callback, Responses at chatgpt.com/backend-api/codex, gemini-cli: Google OAuth with the public Gemini CLI client, project discovery through loadCodeAssist, generateContent wrapped in the Cloud Code envelope at cloudcode-pa.googleapis.com/v1internal (+23 more)

### Community 110 - "Provider authentication"
Cohesion: 0.15
Nodes (7): OpenClawSettingsController, Controller, Get, Post, object(), OpenClawSettingsService, Injectable

### Community 111 - "Milestone M1 · Walking skeleton (thin end-to-end slice)"
Cohesion: 0.13
Nodes (17): encoder, streamed(), audio, stream, chunk(), completion, encoder, errorOf() (+9 more)

### Community 112 - "src/pricing.ts"
Cohesion: 0.11
Nodes (15): Headers, isWellFormedKey(), maskKey(), onlyKey(), Parsed, parseKeyName(), parseKeyStatus(), ApiKeysController (+7 more)

### Community 113 - "cli.ts"
Cohesion: 0.11
Nodes (21): loadOrExit(), MATRIX_DIR, OUT_DIR, r, defaultReference, here, NINEROUTER_ROOT, referenceCandidates (+13 more)

### Community 114 - "coverage.ts"
Cohesion: 0.13
Nodes (6): JcodeSettingsController, Controller, Get, Post, JcodeSettingsService, Injectable

### Community 115 - "ready"
Cohesion: 0.19
Nodes (8): Access, flowError(), invalid(), NO_PKCE, OAuthController, objectRecord(), stringifyQuery(), strings()

### Community 116 - "compilerOptions"
Cohesion: 0.09
Nodes (18): request(), transport, credential, ctx, encoder, f(), frame(), frames() (+10 more)

### Community 117 - "compilerOptions"
Cohesion: 0.13
Nodes (7): CodexSettingsController, CodexSettingsService, CONFIG, digest(), Draft, objectOf(), quote()

### Community 118 - "engine/package.json"
Cohesion: 0.08
Nodes (22): audio, body, frames, post(), sent, tts(), ttsBody, upstream (+14 more)

### Community 119 - "OpenAIChatStreamEncoder"
Cohesion: 0.07
Nodes (27): Active account quota rows, refresh, and visible error state, AIGate — Capability Specification, Antigravity's locally-counted/inferred quota — RAM cache plus a strike-based trust override, API-key providers, Batched SSE flush timer and log line formatting (ANSI strip, arg serialization), Bounded server reads for active saved connections, Codex reset credits — a redeemable pool that manually ends the current 5h window early, Console Log (+19 more)

### Community 120 - "thinking.ts"
Cohesion: 0.07
Nodes (27): code:ts (export type Language = "en" | "vi";), code:js (await page.getByRole("button", { name: "Show timeout" }).cli), code:tsx (const [failure, setFailure] = useState<{ error: unknown } | ), code:js (await page.getByLabel(/^Import settings JSON/).setInputFiles), code:tsx (const { language, t } = useLocale();), code:js (test("Overview comparison signs and compact values are local), code:js (const activity = { summary:0, stream:0 };), code:powershell (node --test apps/web/src/shared/i18n.test.mjs apps/web/src/s) (+19 more)

### Community 121 - "gemini-adapter.test.mjs"
Cohesion: 0.07
Nodes (28): code:ts (// connections/domain/account-selection.ts), code:ts (const append = (node: Omit<DecisionNode, "id">): number | un), code:js (test("catalog output limit refuses before dispatch", () => w), code:js (import { test } from "node:test";), code:ts (fastify.addHook("onRoute", options => {), code:js (import assert from "node:assert/strict";), code:ts (export const useRoutingSimulation = () => useMutation({), code:ts (const isStale = submitted !== null &&) (+20 more)

### Community 122 - "ollama-adapter.test.mjs"
Cohesion: 0.12
Nodes (12): ClineSettingsController, Controller, Get, Post, ClineSettingsService, digest(), DIR, Draft (+4 more)

### Community 123 - "openai-protocol.test.mjs"
Cohesion: 0.13
Nodes (6): HermesSettingsController, Controller, Get, Post, HermesSettingsService, Injectable

### Community 124 - "compilerOptions"
Cohesion: 0.18
Nodes (16): ProxyPoolView, cloudflareId(), multipart(), pause(), project(), record(), RelayDeployError, RelayDeployService (+8 more)

### Community 125 - "dependencies"
Cohesion: 0.09
Nodes (22): drizzle-orm/sqlite-proxy/migrator, lockedProxy(), drizzle-orm/sqlite-proxy, DriverName, FILE_PRAGMAS, Method, openBetterSqlite(), openBunSqlite() (+14 more)

### Community 126 - ".summary"
Cohesion: 0.07
Nodes (21): answer, anthropicAnswer, approved, begun, body, connection, device, exchange (+13 more)

### Community 127 - "Endpoint & API Key"
Cohesion: 0.11
Nodes (19): CommandCodeAdapter, COMMIT_EVENTS, eventOf(), FINISH, finishOf(), GUESSES, joinText(), Opened (+11 more)

### Community 128 - "Rule 4 — Every workload must be BOUNDED"
Cohesion: 0.07
Nodes (23): controller, earlierImage, embedding, error, everything, fast, final, gpt41 (+15 more)

### Community 129 - "GithubAdapter"
Cohesion: 0.13
Nodes (11): McpController, Controller, Delete, Get, Param, Patch, Post, Res (+3 more)

### Community 130 - "AnthropicStreamEncoder"
Cohesion: 0.13
Nodes (21): allowedUrl(), asErrno(), classifiedBody(), classify(), DirectTransport, dispatcher(), dnsCache, envProxy() (+13 more)

### Community 131 - "commandcode-adapter.test.mjs"
Cohesion: 0.08
Nodes (24): all, at, call, chart, database, detail, { dropped, failed, queued }, extra (+16 more)

### Community 132 - "connection-data.test.mjs"
Cohesion: 0.11
Nodes (19): ALLOWED, CODEX_MODELS, codexBody(), codexUrl(), DROPPED, EFFORT_SUFFIXES, HOSTED_TOOLS, normalizeEffort() (+11 more)

### Community 133 - "github-copilot.test.mjs"
Cohesion: 0.07
Nodes (19): adapter, bare, body, chunks, ctx, legacy, lookupThrows, METADATA (+11 more)

### Community 134 - "openai-responses-adapter.test.mjs"
Cohesion: 0.07
Nodes (27): Combo rotation state invalidated when combo strategy settings change, Dashboard session cookie issuance, verification, and destruction (login/dashboardGuard/logout), DEFAULT_SETTINGS shape and migration-free merge with persisted data, GET /api/auth/saml/metadata — public SP metadata document, GET /api/auth/status — unauthenticated auth-configuration probe, GET /api/health and GET /api/init — liveness/init-ping endpoints, GET /api/settings/require-login — public pre-auth login-page context, GET /api/settings response shaping — secret stripping and env-only fields (+19 more)

### Community 135 - "Body"
Cohesion: 0.07
Nodes (27): A provider exposing more than one wire format for the same account (transport.transports[]), Anthropic-compatible nodes: create and update rules, /v1 precedence, request URL and headers, and the connection test, apiType chat or responses on an OpenAI-compatible node: create, update, id, and the request URL, azure: an Azure OpenAI resource per connection (endpoint, deployment, api-version, organization) and its test, Build PROVIDERS / PROVIDER_OAUTH / PROVIDER_MEDIA from the per-provider registry at module load, Canonical per-provider registry entry contract (REGISTRY_TEMPLATE.js), clinepass with an API key: Cline client headers, the non-stream { success, data } envelope, and the test, cloudflare-ai: the Cloudflare account id per connection, filled into the Workers AI URL, and its test (+19 more)

### Community 136 - "parity/package.json"
Cohesion: 0.07
Nodes (26): 10 · Media Providers — `/providers/media/:kind`, 11 · Proxy Pools — `/network/proxy-pools`, 12 · Tunnel — `/network/tunnel`, 13 · MITM — `/network/mitm`, 14 · CLI Tools — `/integrations/cli-tools` and `/:toolId`, 15 · MCP — `/integrations/mcp`, 16 · Skills — `/integrations/skills`, 17 · Settings — `/settings/general`, `/auth`, `/developer` (+18 more)

### Community 137 - ".test"
Cohesion: 0.14
Nodes (6): OmpSettingsController, Controller, Get, Post, OmpSettingsService, Injectable

### Community 138 - "Rule 1 — Write LEAN code, no over-engineering"
Cohesion: 0.14
Nodes (10): DroidSettingsController, Controller, Get, Post, Draft, DroidSettingsService, FILE, managed() (+2 more)

### Community 139 - "usage-meter.ts"
Cohesion: 0.11
Nodes (16): Alert, empty(), lowQuota(), Metrics, OverviewController, Controller, Get, Header (+8 more)

### Community 140 - "Model mapping"
Cohesion: 0.07
Nodes (26): database/package.json, dependencies, better-sqlite3, drizzle-orm, sql.js, devDependencies, drizzle-kit, @types/better-sqlite3 (+18 more)

### Community 141 - "Model registry"
Cohesion: 0.13
Nodes (8): ClineSettingsController, ClineSettingsService, digest(), DIR, Draft, object(), SECRETS, STATE

### Community 143 - "catalog/schema.ts"
Cohesion: 0.12
Nodes (19): FINISH, FINISH_OF, GeminiRoute, GeminiStreamEncoder, GeminiStreamMeta, geminiTtsRequest(), invalid(), isGeminiTtsRequest() (+11 more)

### Community 144 - "claude-codex.test.mjs"
Cohesion: 0.09
Nodes (13): accounts, usage, client, dir, drivers, failing, file, migrationsFolder (+5 more)

### Community 145 - "gemini-cli.test.mjs"
Cohesion: 0.16
Nodes (7): ManagedJsonSettingsController, Controller, Get, Param, Post, ManagedJsonSettingsService, Injectable

### Community 146 - "Remote functionality"
Cohesion: 0.12
Nodes (17): FINISH, FINISH_OF, GEMINI_TTS_TIMEOUT_MS, GeminiRoute, GeminiStreamEncoder, GeminiStreamMeta, geminiTtsRequest(), invalid() (+9 more)

### Community 147 - "Multi-account"
Cohesion: 0.09
Nodes (21): aborted, adapter, answer(), azure, byModel, cline, clinepass, cloudflare (+13 more)

### Community 148 - "compilerOptions"
Cohesion: 0.08
Nodes (23): answer, anthropic, base, claude, codebuddy, cut, empty, encoder (+15 more)

### Community 149 - "`porting-behavior-not-code` RED baseline"
Cohesion: 0.08
Nodes (25): A combo member that names another combo is routed as that combo, with no depth or cycle bound, /api/combos CRUD routes — name validation, a duplicate pre-check race, and reuse outside the chat lane, augmentModelsWithCapacityAdapter prepends adapter models first — the file's own header comment says the opposite, Combo persistence shape — id / unique name / kind / models(JSON) / timestamps, Combo / Vision Adapter, comboRotationState Map — ownership, every reset trigger, and non-durability across restart, detectRequiredCapabilities scans only the trailing user turn for modality requirements, "Fallback" strategy — sequential try-until-success across combo members (+17 more)

### Community 150 - "`writing-lean-bounded-code` RED baseline"
Cohesion: 0.13
Nodes (16): CatalogController, find(), levelsOf(), mediaSummary(), ProviderSummary, routeKinds(), summary(), ThinkingView (+8 more)

### Community 151 - "Database"
Cohesion: 0.15
Nodes (7): DroidSettingsController, Draft, DroidSettingsService, FILE, hash(), managed(), obj()

### Community 152 - "Provider account management"
Cohesion: 0.16
Nodes (6): OpenCodeSettingsController, CONFIG, Draft, hash(), object(), OpenCodeSettingsService

### Community 153 - "AIGate — Project Map"
Cohesion: 0.12
Nodes (23): adapter, body(), collect(), credential, ctx(), deep, encoded, encoder (+15 more)

### Community 154 - "GeminiStreamEncoder"
Cohesion: 0.11
Nodes (20): cell(), renderCapabilities(), BOUNDED_CONTEXTS, ERROR_CODES, ErrorCase, Evidence, FeatureEntry, FeatureEntrySchema (+12 more)

### Community 155 - "engine.test.mjs"
Cohesion: 0.15
Nodes (7): KiloSettingsController, AUTH, Draft, hash(), KiloSettingsService, object(), VSCODE

### Community 156 - "responses-protocol.test.mjs"
Cohesion: 0.08
Nodes (24): code:bash (git add docs/discovery/), code:bash (git add docs/discovery/), code:bash (git add docs/discovery/), code:bash (git add docs/discovery/), code:bash (git add docs/discovery/), code:bash (git add docs/discovery/), code:bash (git add docs/discovery/), code:bash (git add docs/discovery/) (+16 more)

### Community 157 - "scripts"
Cohesion: 0.23
Nodes (12): Body, invalid(), missing(), ProxyPoolsController, Controller, Delete, Get, Header (+4 more)

### Community 158 - "usage.test.mjs"
Cohesion: 0.21
Nodes (14): signedIn(), server/test/catalog.test.mjs, encoder, signedIn(), boot(), PASSWORD, sessionCookie(), setUp() (+6 more)

### Community 159 - "Quota Tracker"
Cohesion: 0.15
Nodes (5): CopilotSettingsController, CopilotSettingsService, Draft, Entry, hash()

### Community 160 - "Speech contract (M2 SP23)"
Cohesion: 0.15
Nodes (17): allowedUrl(), classifiedBody(), classify(), DirectTransport, dispatcher(), dnsCache, envProxy(), fetchBody() (+9 more)

### Community 161 - "AIGate schema conventions"
Cohesion: 0.17
Nodes (4): Draft, FILE, hash(), OmpSettingsService

### Community 162 - ".stream"
Cohesion: 0.09
Nodes (23): all-statuses batches 13 per-tool GETs into one response, Array-based upsert into chatLanguageModels.json, and a missing install-detection step, auth.json write plus a best-effort, error-swallowed VS Code settings.json write, Both POST and DELETE replace the entire config.toml with a fixed template, discarding unrelated content, CLI Tools, CodeWhale and ForgeCode TOML configuration, confbox TOML provider entry plus a separate quoted-KEY=VALUE env file for the API key, Crush, Pi, and Smelt JSON configuration (+15 more)

### Community 163 - "OAuthProvider"
Cohesion: 0.17
Nodes (7): OpenCodeSettingsController, Controller, Get, Post, object(), OpenCodeSettingsService, Injectable

### Community 164 - "anthropic-protocol.test.mjs"
Cohesion: 0.17
Nodes (7): ClaudeSettingsController, Controller, Get, Post, ClaudeSettingsService, object(), Injectable

### Community 165 - "antigravity.test.mjs"
Cohesion: 0.13
Nodes (13): CustomModelsController, filled(), invalid(), Controller, Delete, Get, Header, HttpCode (+5 more)

### Community 166 - "oauth-lane.test.mjs"
Cohesion: 0.13
Nodes (12): PxpipeController, Controller, Get, Header, HttpCode, Post, isPxpipeTransform(), PXPIPE_DATA_DIR (+4 more)

### Community 167 - "SPIKE-1: SQLite drivers through Drizzle"
Cohesion: 0.15
Nodes (12): isField(), isObject(), parsePricingPatch(), PriceEdit, validId(), id(), invalid(), PricingController (+4 more)

### Community 168 - "oauth.test.mjs"
Cohesion: 0.1
Nodes (19): approved, { authUrl, callbackUrl, state }, begun, chat(), connection, device, expiresAt, hello() (+11 more)

### Community 169 - "trae.test.mjs"
Cohesion: 0.11
Nodes (19): adapter, calls, context, credential, ctx, encoder, f(), frame() (+11 more)

### Community 170 - "Hoàn thiện SP23: TTS lane + voice listing + preview"
Cohesion: 0.17
Nodes (7): KiloSettingsController, Controller, Get, Post, KiloSettingsService, object(), Injectable

### Community 171 - "SP24a: ghi usage, cost theo pricing, thống kê, SSE live, màn Usage và chỉnh giá"
Cohesion: 0.17
Nodes (6): CopilotSettingsController, Controller, Get, Post, CopilotSettingsService, Injectable

### Community 172 - "SP24b: request detail (metadata + attempts), usage của media lanes, màn Requests"
Cohesion: 0.19
Nodes (8): Controller, Get, Post, TunnelController, publicUrl(), run, Injectable, TunnelService

### Community 174 - "claude-codex-lane.test.mjs"
Cohesion: 0.25
Nodes (9): cloudflareId(), multipart(), pause(), project(), record(), RelayDeployService, required(), string() (+1 more)

### Community 175 - "Token Saver contract (M2 SP21)"
Cohesion: 0.1
Nodes (18): customModels, providerThinking, THINKING_LEVEL_VALUES, accountLocks, AUTH_TYPES, AuthType, providerConnections, providerNodes (+10 more)

### Community 176 - "Gap register"
Cohesion: 0.2
Nodes (20): adapter, collect(), commandcode, credential, ctx(), done(), early(), effortOf() (+12 more)

### Community 177 - "SP0.6 skill discovery"
Cohesion: 0.1
Nodes (15): adapter, badTransport, bytes, crc32(), ctx, encoder, eventFrame(), join() (+7 more)

### Community 178 - "scripts"
Cohesion: 0.1
Nodes (21): aws-polly has no synthesis handler; local-device synthesis only works on macOS, Browser voice catalog, filters, and audible preview, COMBO_KINDS is a permanently-empty Set — combo creation/listing UI for image and tts kinds is unreachable, and the code that would render it is dead, Deepgram voices are listed although Deepgram cannot synthesize speech, getEffectiveStatus displays a stale "unavailable" testStatus as "active" once its lock has actually expired, imageToText has no dedicated request lane — it is a catalog label for vision-capable chat models, served entirely through /v1/chat/completions, MEDIA_PROVIDER_KINDS — the 9 kinds, their labels/icons, and each kind's declared REST endpoint, Media Providers (+13 more)

### Community 179 - "Names"
Cohesion: 0.19
Nodes (20): Parsed, API_TYPES, asBody(), DEFAULT_BASE_URLS, fail(), HeaderInput, isApiType(), isNodeType() (+12 more)

### Community 180 - "AIGate"
Cohesion: 0.17
Nodes (7): ProxyPoolChanges, Inject, ProxyPoolsRepository, Inject, Injectable, view(), Inject

### Community 181 - "Parity report (M1 gate)"
Cohesion: 0.1
Nodes (14): answer, created, events, reply, tested, upstream, calls, fake (+6 more)

### Community 183 - "toDescriptor"
Cohesion: 0.1
Nodes (19): antigravity (SP16c2), claude (SP16b), codebuddy (SP16d), codex (SP16b), Dashboard, gemini-cli (SP16c), github (SP16b2), grok-cli (SP16d) (+11 more)

### Community 184 - "Registry"
Cohesion: 0.14
Nodes (13): answer, ndjson(), send(), body(), ndjson(), reply, bytes(), jsonAnswer() (+5 more)

### Community 185 - "gemini-protocol.test.mjs"
Cohesion: 0.18
Nodes (19): CLAUDE_CODE_PROMPT, claudeCodeBody(), cloak(), cloakTools(), decode(), DECOY_NAMES, DECOYS, derivedUuid() (+11 more)

### Community 186 - "secret-cipher.test.mjs"
Cohesion: 0.1
Nodes (20): tsx, yaml, zod, discovery/package.json, dependencies, fast-glob, yaml, zod (+12 more)

### Community 187 - "provider"
Cohesion: 0.23
Nodes (5): ClaudeSettingsService, CONFIG, Draft, hash(), object()

### Community 188 - "app.test.mjs"
Cohesion: 0.2
Nodes (4): TunnelController, publicUrl(), run, TunnelService

### Community 189 - "web/CLAUDE.md"
Cohesion: 0.15
Nodes (9): CatalogController, find(), levelsOf(), ProviderSummary, routeKinds(), summary(), ThinkingView, ProviderThinkingRepository (+1 more)

### Community 190 - "tts.test.mjs"
Cohesion: 0.11
Nodes (8): again, members, panel, plan, prompt, started, tools, upstream

### Community 191 - ".dependency-cruiser.cjs"
Cohesion: 0.11
Nodes (17): anthropic, base, body, choiceOf(), codebuddy, empty, encoder, events (+9 more)

### Community 192 - "audit.py"
Cohesion: 0.11
Nodes (19): Anthropic Messages client request to the OpenAI pivot (claudeToOpenAIRequest), or near passthrough to an Anthropic provider, Anthropic Messages response (JSON and SSE) to OpenAI chat completions, and upstream error handling, cloudflare-ai: every message content array is flattened to a string, Command Code NDJSON AI SDK v5 events to OpenAI chunks, and the collapsed answer for non-streaming clients, Gemini generateContent client request to the OpenAI chat body (convertGeminiToInternal), then the ordinary chat pipeline, Gemini SSE chunks and generateContent JSON to OpenAI chat completion chunks and body, Ollama NDJSON stream and JSON body to OpenAI chat completion chunks and body, OpenAI chat answer back to the Gemini client: SSE chunks (transformOpenAISSEToGeminiSSE) and the GenerateContentResponse (convertOpenAIResponseToGemini) (+11 more)

### Community 193 - "nav.py"
Cohesion: 0.11
Nodes (19): api/translator/console-logs and console-logs/stream — buffered + live console output for the playground UI, api/translator/translate, load, save, send — step through and manually fire the pivot, Base64 data-URI encode/parse shared by every image-capable translator, Claude OAuth anti-ban tool cloaking and fingerprint injection, Every registered source:target request/response pair, filterToOpenAIFormat: what happens to a client's cache_control on the way to an OpenAI-format provider, How Kiro EventStream, Cursor protobuf, and CommandCode NDJSON avoid the translator's pivot dispatch, Literal-keyed runtime DOM text substitution (not a conventional key-based i18n library) (+11 more)

### Community 194 - "engine/test/catalog.test.mjs"
Cohesion: 0.11
Nodes (19): aggregateEntryToDay — per-day rollup by provider/model/account/apiKey/endpoint, /api/pricing — GET merged pricing, PATCH validated overrides, DELETE reset-to-default, /api/usage/history is not a history-rows endpoint — it returns the same aggregate shape as /api/usage/stats, appendRequestLog is an empty no-op; the log view is derived read-side from usageHistory, calculateCost — pricing lookup and cache-inclusive token math, Every field recorded for one request, in the order it becomes known, GET /api/usage/providers — distinct-provider filter list for the request-details tab, GET /api/usage/request-details — pagination plus mandatory content redaction (+11 more)

### Community 195 - "pricing.test.mjs"
Cohesion: 0.17
Nodes (7): Inject, StoredCredential, TokenRefresher, Inject, Injectable, Target, Inject

### Community 196 - "vitest.config.ts"
Cohesion: 0.13
Nodes (9): limited(), said(), textOf(), tools, answer, frames(), hello, body (+1 more)

### Community 197 - "Community 197"
Cohesion: 0.13
Nodes (9): dir, drivers, file, migrationsFolder, results, migrationsFolder, fixture/schema.ts, accounts (+1 more)

### Community 198 - "Community 198"
Cohesion: 0.27
Nodes (17): asBody(), Body, DATA_FIELDS, DataField, fail(), isJsonCredential(), keyHint(), NewConnection (+9 more)

### Community 199 - "Community 199"
Cohesion: 0.12
Nodes (4): RecentEvent, ConsoleEvent, ConsoleLogService, ToolingController

### Community 200 - "Community 200"
Cohesion: 0.16
Nodes (16): bad(), CAPABILITIES, capabilitiesValid(), Capability, DecisionNode, reasonMessageKey(), REASONS, simulationChildren() (+8 more)

### Community 201 - "Community 201"
Cohesion: 0.13
Nodes (8): AntigravityAdapter, imageAspect(), imageModel(), normalizeContents(), rewrite(), sanitize(), sessionId(), toolsOf()

### Community 202 - "Community 202"
Cohesion: 0.16
Nodes (17): adapter, answer, body(), cloud, collect(), credential, ctx(), encoder (+9 more)

### Community 203 - "Community 203"
Cohesion: 0.11
Nodes (17): Claude Code config, CLI tool discovery (SP25 slice), Cline config, Codex config, Console log, Copilot, Crush, Pi, and Smelt config, DeepSeek TUI config, Droid config (+9 more)

### Community 204 - "Community 204"
Cohesion: 0.27
Nodes (17): asBody(), ConnectionFields, DATA_FIELDS, DataField, fail(), isJsonCredential(), MAX_NAME, NewConnection (+9 more)

### Community 205 - "Community 205"
Cohesion: 0.14
Nodes (9): image, limited(), said(), json(), send(), upstream(), { privateKey }, SERVICE_ACCOUNT (+1 more)

### Community 206 - "Community 206"
Cohesion: 0.16
Nodes (16): vitest, discovery/src/capabilities.ts, cell(), renderCapabilities(), src/schema.ts, BOUNDED_CONTEXTS, ERROR_CODES, ErrorCase (+8 more)

### Community 207 - "Community 207"
Cohesion: 0.11
Nodes (15): Error taxonomy and fallback, Rules, Before implementing, Checks for suspected bugs, Columns, Feature Matrix entry, Trace questions, Golden scenarios (+7 more)

### Community 208 - "Community 208"
Cohesion: 0.11
Nodes (17): Claude Code config, CLI tool discovery (SP25 slice), Cline config, Codex config, Console log, Copilot, Crush, Pi, and Smelt config, DeepSeek TUI config, Droid config (+9 more)

### Community 209 - "Community 209"
Cohesion: 0.19
Nodes (9): autodetect(), compact(), compressToolOutput(), Filter, filterFind(), filterSearchList(), filterStatus(), filterTree() (+1 more)

### Community 210 - "Community 210"
Cohesion: 0.15
Nodes (10): assertTimeZone(), registerSimulationBoundary(), registerV1Routes(), port, API_PREFIXES, createServer(), ServerOptions, database (+2 more)

### Community 211 - "Community 211"
Cohesion: 0.12
Nodes (16): a, answer, body, claudeReply, connection, db, failing, gateway (+8 more)

### Community 212 - "Community 212"
Cohesion: 0.15
Nodes (7): autodetect(), compact(), compressToolOutput(), Filter, filterFind(), filterSearchList(), groupPaths()

### Community 213 - "Community 213"
Cohesion: 0.21
Nodes (13): FILE_PRAGMAS, Method, openBetterSqlite(), openBunSqlite(), openers, openNodeSqlite(), openSqlJs(), SqlValue (+5 more)

### Community 214 - "Community 214"
Cohesion: 0.14
Nodes (12): airforce, body(), credential, encoder, hello, isCode(), json(), noSecret() (+4 more)

### Community 215 - "Community 215"
Cohesion: 0.12
Nodes (12): adapter, chunks, early, events, late, provider, proxy, server (+4 more)

### Community 216 - "Community 216"
Cohesion: 0.23
Nodes (3): invalid(), missing(), ProxyPoolsController

### Community 217 - "Community 217"
Cohesion: 0.12
Nodes (15): answer, audio, bare, body, encoder, meta, { models }, names (+7 more)

### Community 218 - "Community 218"
Cohesion: 0.18
Nodes (15): adapter, body(), collect(), credential, ctx(), encoder, fakeTransport(), hello (+7 more)

### Community 219 - "Community 219"
Cohesion: 0.12
Nodes (13): anthropic, copilotClaude, disabled, github, openai, override, own, ownBudget (+5 more)

### Community 221 - "Community 221"
Cohesion: 0.12
Nodes (16): A real (non-noAuth) connection is bound to a proxy pool via its own create/update body, Cached undici ProxyAgent dispatchers, keyed by normalized proxy URL, GET/POST /api/proxy-pools — list (with optional usage enrichment) and create, GET/PUT/DELETE /api/proxy-pools/[id], MITM_BYPASS_HOSTS — manual DNS resolution + raw-socket TLS to dodge local DNS/hosts poisoning, OpenCode Free uses persisted fixed/round-robin/random pool selection on real chat traffic, pickProxyPoolId() rotation for free/noAuth providers, keyed by settings.providerStrategies, POST /api/proxy-pools/cloudflare-deploy — uploads a Worker relay script and resolves its workers.dev URL (+8 more)

### Community 222 - "Community 222"
Cohesion: 0.12
Nodes (14): 1 · Lộ trình, 1 · Lộ trình, 2 · UI sub-project (M3) — thứ tự dựng, 2 · UI sub-project (M3) — thứ tự dựng, 3 · Màn hình → backend → feature → design, 3 · Màn hình → backend → feature → design, 4 · Bounded context → ai dùng nó, 4 · Bounded context → ai dùng nó (+6 more)

### Community 223 - "Community 223"
Cohesion: 0.12
Nodes (15): 0. Tóm tắt, 12. Branding, 13. Những gì spec này CHƯA quyết, 1.1 Rủi ro kỹ thuật cần spike trước, 1. Quyết định kiến trúc đã khoá, 2. Layout monorepo, 3.1 Hai luật bắt buộc của CIP, 3. Canonical Internal Protocol (CIP) (+7 more)

### Community 224 - "Community 224"
Cohesion: 0.14
Nodes (11): anthropic, body(), credential, encoder, gateway, hello, json(), minimax (+3 more)

### Community 225 - "Community 225"
Cohesion: 0.16
Nodes (10): encoder, hello, json(), partner, { privateKey, publicKey }, reply(), sse(), stream() (+2 more)

### Community 226 - "Community 226"
Cohesion: 0.19
Nodes (11): fast-glob, loadOrExit(), MATRIX_DIR, OUT_DIR, resolveEvidence(), countLines(), lineCount(), lineCounts (+3 more)

### Community 228 - "Community 228"
Cohesion: 0.35
Nodes (12): body(), bool(), fail(), name(), noProxy(), Parsed, parseNewProxyPool(), parseProxyPoolChanges() (+4 more)

### Community 230 - "Community 230"
Cohesion: 0.29
Nodes (4): withClaudeCodePrompt(), GithubAdapter, isClaude(), servesResponses()

### Community 231 - "Community 231"
Cohesion: 0.22
Nodes (12): DriverName, Database, DatabaseHandle, fallbackOrder(), MIGRATIONS_FOLDER, openClient(), openDatabase(), call() (+4 more)

### Community 232 - "Community 232"
Cohesion: 0.2
Nodes (5): asRecord(), events(), partsText(), TraeAdapter, usageOf()

### Community 233 - "Community 233"
Cohesion: 0.13
Nodes (12): Bounded patterns, Cache with a TTL and a size cap, Circuit breaker and cursor pagination, Four concurrent calls at most, Queue, stream, and SSE backpressure, Retry within one deadline, Database checks, Review gate (+4 more)

### Community 234 - "Community 234"
Cohesion: 0.14
Nodes (12): blocked, broken, claude, detail, good, grok, kilo, list (+4 more)

### Community 235 - "Community 235"
Cohesion: 0.14
Nodes (9): adapter, body, chunks, ctx, descriptor, exchange, guidance, login (+1 more)

### Community 236 - "Community 236"
Cohesion: 0.14
Nodes (14): BaseExecutor's own buildHeaders fallback — used by dedicated-executor providers that don't override header construction, Config-driven generic OAuth refresh (REFRESH_GRANTS / refreshFromGrant) for the standard refresh_token grant shape, Find local desktop API key and optional session identity, Hand-written per-provider refresh methods for providers whose token endpoint doesn't fit the generic grant shape, Import an API key or session credential, OAUTH_INJECT_FIELDS — clientId/clientSecret/tokenUrl injected from the oauth block, not stored per connection, POST /api/provider-nodes/validate — probe a user-supplied baseUrl+apiKey before a custom provider node is saved, POST /api/providers/[id]/test — probe one connection's credential validity against its provider and persist the result (+6 more)

### Community 237 - "Community 237"
Cohesion: 0.14
Nodes (14): 6 api/headroom/* routes: process lifecycle for headroom, an external (not library-mode) proxy, 8 api/pxpipe/* routes: install, lifecycle, and observability for the in-process PXPIPE module, Caveman + Ponytail stages: inject a terse-style system prompt via a shared, format-dispatching injector, Five-stage pipeline run once per chat request, just before dispatch, Headroom stage: send messages to an external compression proxy, fail open on any failure, Only PXPIPE's savings are persisted; RTK and headroom stats are console-log only and discarded, 'PXPIPE is running' means the transform module is loaded in-process, not that a port is listening, PXPIPE stage: render bulky Claude-format tool context as dense PNGs via an in-process transform (+6 more)

### Community 238 - "Community 238"
Cohesion: 0.14
Nodes (13): AIGate — Design System, code:block1 (Overview), Color, Components, Density, Destructive actions, Hard rule, Layout (+5 more)

### Community 239 - "Community 239"
Cohesion: 0.22
Nodes (7): ask, message, withAnthropic(), reply, fakeUpstream(), ready(), withProvider()

### Community 240 - "Community 240"
Cohesion: 0.14
Nodes (14): server/tsconfig.json, compilerOptions, emitDecoratorMetadata, experimentalDecorators, module, moduleResolution, outDir, rootDir (+6 more)

### Community 241 - "Community 241"
Cohesion: 0.14
Nodes (14): web/tsconfig.json, compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 242 - "Community 242"
Cohesion: 0.19
Nodes (11): computeCoverage(), CoverageReport, Dimension, EVIDENCE_PATH, renderCoverage(), Inventory, base, entries (+3 more)

### Community 243 - "Community 243"
Cohesion: 0.22
Nodes (11): builtin(), PATTERNS, Price, PRICE_FIELDS, PriceField, PriceOverride, PriceSource, resolvePrice() (+3 more)

### Community 244 - "Community 244"
Cohesion: 0.18
Nodes (9): Connection, ProviderSummary, mediaAvailability(), providersForMediaKind(), catalog, routed, saved, snapshot (+1 more)

### Community 245 - "Community 245"
Cohesion: 0.23
Nodes (3): asRecord(), TraeAdapter, usageOf()

### Community 246 - "Community 246"
Cohesion: 0.15
Nodes (8): adapter, body, capped, chunks, ctx, provider, streamTransport, url

### Community 247 - "Community 247"
Cohesion: 0.36
Nodes (12): body(), bool(), fail(), name(), NewProxyPool, noProxy(), Parsed, parseNewProxyPool() (+4 more)

### Community 248 - "Community 248"
Cohesion: 0.15
Nodes (13): database/tsconfig.json, compilerOptions, declaration, module, moduleResolution, outDir, rootDir, skipLibCheck (+5 more)

### Community 249 - "Community 249"
Cohesion: 0.15
Nodes (13): engine/package.json, devDependencies, @types/node, typescript, exports, @types/node, typescript, name (+5 more)

### Community 250 - "Community 250"
Cohesion: 0.28
Nodes (8): format(), OllamaAdapter, textOf(), toBody(), toMessages(), toolArguments(), unsupported(), usageOf()

### Community 251 - "Community 251"
Cohesion: 0.18
Nodes (7): body(), credential, encoder, gemini, hello, json(), sse()

### Community 252 - "Community 252"
Cohesion: 0.18
Nodes (9): answer, body(), cloud, credential, encoder, hello, json(), local (+1 more)

### Community 253 - "Community 253"
Cohesion: 0.18
Nodes (10): body(), credential, ctx, enc, meta, openai, response, send() (+2 more)

### Community 254 - "Community 254"
Cohesion: 0.15
Nodes (13): engine/tsconfig.json, compilerOptions, declaration, module, moduleResolution, outDir, rootDir, skipLibCheck (+5 more)

### Community 256 - "Community 256"
Cohesion: 0.26
Nodes (12): applyQuirks(), assistantMessage(), compact(), copilotChatBody(), kimchiBody(), messageMark(), textJson(), textParts() (+4 more)

### Community 257 - "Community 257"
Cohesion: 0.17
Nodes (10): eleven, fish, gemini, mimo, minimax, nvidia, openai, router (+2 more)

### Community 258 - "Community 258"
Cohesion: 0.17
Nodes (12): Create a new API key (POST /api/keys), Derive the stable per-install machineId embedded in new API keys, Endpoint & API Key, Extract the inbound API key from request headers, Gate chat requests behind settings.requireApiKey, Legacy sk-{random8} keys and the never-invoked CRC/format validation, List all API keys (GET /api/keys), Permanently remove a key (DELETE /api/keys/[id]) (+4 more)

### Community 259 - "Community 259"
Cohesion: 0.17
Nodes (11): code:block1 (cost = input × input + cacheRead × (cached ?? input) + cache), Cost, Dashboard API (session), Days, periods, retention, Deviations from 9router, Requests (SP24b), UI, Usage contract (M2 SP24a, SP24b) (+3 more)

### Community 260 - "Community 260"
Cohesion: 0.17
Nodes (12): 10.10 Chẻ sub-project UI (M3), 10.1 Phê bình IA hiện tại của 9router, 10.2 IA mới — 7 nhóm theo *việc*, 10.3 Stack web, 10.4 Cấu trúc feature-based, 10.5 Quản lý state — tối thiểu, 10.6 Ràng buộc performance UI (`rules.md` mục 4), 10.7 Quy ước trạng thái cho mọi màn hình (+4 more)

### Community 261 - "Community 261"
Cohesion: 0.17
Nodes (12): 11.1 Nguyên tắc chia: theo *kiểu thất bại*, không theo *file nguồn*, 11.2 Phân tuyến: máy chặn vs skill dạy, 11.3 Skill 1 — `writing-lean-bounded-code`, 11.4 Skill 2 — `porting-behavior-not-code`, 11.5 Hai skill khớp nhau, 11.6 Iron Law — skill không được viết trước khi có test đỏ, 11.7 SP0 chẻ nhỏ, 11. Hai skill (SP0) (+4 more)

### Community 262 - "Community 262"
Cohesion: 0.17
Nodes (11): Acceptance and verification, Architecture and ownership, Errors and notifications, Intent and baseline, Language state and storage, Lifecycle and resource bounds, Number, time and money presentation, Review and next gate (+3 more)

### Community 263 - "Community 263"
Cohesion: 0.17
Nodes (12): dependencies, @aigate/database, @aigate/engine, drizzle-orm, fastify, @fastify/static, @nestjs/common, @nestjs/core (+4 more)

### Community 264 - "Community 264"
Cohesion: 0.3
Nodes (11): assistantBlock(), imageBlock(), openaiExtensions(), source(), textBlock(), toMessages(), toolChoice(), toolInput() (+3 more)

### Community 265 - "Community 265"
Cohesion: 0.2
Nodes (7): commandcode, credential, encoder, hello, json(), ndjson(), stream()

### Community 266 - "Community 266"
Cohesion: 0.2
Nodes (8): answer(), azure, clinepass, cloudflare, credential, encoder, json(), stream()

### Community 267 - "Community 267"
Cohesion: 0.18
Nodes (6): chatAnswer, credential, ctx, github, responsesStream(), sse()

### Community 268 - "Community 268"
Cohesion: 0.2
Nodes (8): body(), credential, encoder, hello, json(), pplx, reply, sse()

### Community 269 - "Community 269"
Cohesion: 0.17
Nodes (12): @aigate/server, parity/package.json, description, devDependencies, @aigate/engine, @aigate/server, @aigate/engine, name (+4 more)

### Community 270 - "Community 270"
Cohesion: 0.17
Nodes (11): File ownership and order, Global Constraints, Plan self-review and execution gate, Review Focus, SP28 Core Dashboard Localization Implementation Plan, Task 1: Translation, storage and formatting contract, Task 2: Root locale, General selection and translated shell, Task 3: Render-time errors, toast and shared defaults (+3 more)

### Community 271 - "Community 271"
Cohesion: 0.17
Nodes (11): Acceptance and verification, Architecture and ownership, Errors and notifications, Intent and baseline, Language state and storage, Lifecycle and resource bounds, Number, time and money presentation, Review and next gate (+3 more)

### Community 272 - "Community 272"
Cohesion: 0.18
Nodes (9): ask, bad, body, events, message, ok, out, sent (+1 more)

### Community 273 - "Community 273"
Cohesion: 0.29
Nodes (8): aigateRules, findInScope(), FUNCTION_TYPES, isBoundedSignal(), isFetch(), isMember(), isRetryShapedTry(), isTimeoutCall()

### Community 274 - "Community 274"
Cohesion: 0.18
Nodes (11): /api/models/availability — dashboard-facing, model-centric aggregation of per-connection cooldown/unavailable locks, plus a manual clear-cooldown action, /api/models/custom — operator-added custom models, atomic upsert that preserves unset fields, /api/models/disabled — per-provider disable/enable list with an atomic merge inside a DB transaction, /api/models/test — synchronous per-model connectivity probe, self-dispatched through 9router's own /v1/* endpoints, Deleting a custom provider node leaves its customModels rows behind, GET /v1/models/{kind} and GET /v1/models/{provider}/{model} — kind-filtered listing and single-model lookup on the OpenAI-compatible lane, Model registry, Provider detail 'Available Models' — add a model id by hand, or 'Import from /models' every id the connection's upstream lists, each shown as <prefix>/<id> with Copy, Test and Delete (+3 more)

### Community 275 - "Community 275"
Cohesion: 0.18
Nodes (11): A user-defined model alias resolves to a real provider/model pair before any capability lookup or dispatch happens, Background models.dev sync — daily refresh, cross-gateway majority vote, tolerance band, fail-open, Disabling a model only hides it from listing endpoints — an alias (or a direct provider/model string) pointing at a disabled model still routes normally, GET /api/tags — fixed two-entry fixture list mimicking Ollama's model-discovery response, used by Ollama-compatible tools before they call the ollama chat lane (05's routing.ollama-lane-transform), GET /v1beta/models — Gemini-format static model catalog for Gemini-native clients (e.g. Gemini CLI, the @google/genai SDK), getCapabilitiesForModel's 4-tier priority chain — first match wins, no cross-tier merge, Model mapping, NOT_VISION is tested before VISION_NAME in looksLikeVisionModel, and can only turn vision on (+3 more)

### Community 276 - "Community 276"
Cohesion: 0.18
Nodes (10): Answer (non-streaming), Anthropic Messages client protocol contract (M2 SP15), count_tokens, Matrix, Matrix entries, Other deviations, Request (Anthropic body → CIP), Routes and auth (+2 more)

### Community 277 - "Community 277"
Cohesion: 0.18
Nodes (10): Anthropic Messages provider contract (M2 SP14a), Connection test and models, Deviations from 9router (not ported, user decision), Errors, Matrix, Matrix entries, Registry changes, Request (CIP → Messages) (+2 more)

### Community 278 - "Community 278"
Cohesion: 0.18
Nodes (10): Answer (JSON body, kept 9router), Gemini provider contract (M2 SP14e), Matrix, Matrix entries, Models and connection test, Other forced deviations, Request (CIP → generateContent), Stream (SSE → StreamChunk, kept 9router) (+2 more)

### Community 279 - "Community 279"
Cohesion: 0.18
Nodes (10): Connection test (corrected), Credentials, Endpoints, Matrix, Matrix entries, Models, Other deviations, Request and answer (+2 more)

### Community 280 - "Community 280"
Cohesion: 0.18
Nodes (11): 8.1 Ba tầng, chỉ tầng 1–2 là cổng chặn, 8.2 Thu tape — lợi dụng chính tính năng của 9router, 8.3 Chuẩn hoá trước khi diff, 8.4 Golden scenarios (`§25`) — 13 kịch bản, áp cho **mọi** lane, 8.5 Đo coverage, 8.6 Giới hạn phải nói thẳng, 8. Parity verification, code:block11 (client ──> 9router :20128 ──> recording proxy ──> vendor thậ) (+3 more)

### Community 281 - "Community 281"
Cohesion: 0.18
Nodes (5): claude, codex, ctx, message, ok

### Community 282 - "Community 282"
Cohesion: 0.2
Nodes (5): ctx, json(), METADATA, provider, send()

### Community 283 - "Community 283"
Cohesion: 0.27
Nodes (8): basename(), buildInventory(), glob(), IGNORE, settingsKeys(), resolveRef(), inv, KEYS

### Community 284 - "Community 284"
Cohesion: 0.18
Nodes (10): Cost, Dashboard API (session), Days, periods, retention, Deviations from 9router, Requests (SP24b), UI, Usage contract (M2 SP24a, SP24b), Vendor quota (SP24c) (+2 more)

### Community 285 - "Community 285"
Cohesion: 0.18
Nodes (10): File responsibilities and interfaces, Global Constraints, Plan self-review and execution handoff, Review Focus, SP29 Routing Simulator Implementation Plan, Task 1: Contracted shared decisions and read-only inspection, Task 2: Bounded decision planner, Task 3: Protected HTTP boundary and no-side-effect contract (+2 more)

### Community 286 - "Community 286"
Cohesion: 0.2
Nodes (4): HermesSettingsController, CONFIG, Draft, ENV

### Community 287 - "Community 287"
Cohesion: 0.2
Nodes (8): edge, edgeGender, gemini, geminiFemale, mimo, openaiFull, openaiStandard, TtsVoice

### Community 288 - "Community 288"
Cohesion: 0.2
Nodes (7): NewProxyPool, ProxyPoolChanges, columns, ProxyPoolView, rotateState, Row, TransportModule

### Community 289 - "Community 289"
Cohesion: 0.2
Nodes (10): 9Remote button + promo modal — zero backend, zero routes, zero persistence, Full state machine across the 7 /api/tunnel/* routes for both the Cloudflare quick-tunnel and Tailscale Funnel lanes, GET /api/tunnel/status — coalesced polling across both lanes plus download progress, Hosts-file DNS entries — atomic write+rollback on Windows vs direct overwrite on macOS/Linux, and unconditional cleanup on stop, POST /api/tunnel/enable and /api/tunnel/disable — Cloudflare quick-tunnel lifecycle, POST /api/tunnel/tailscale-enable and /api/tunnel/tailscale-disable — daemon start, login, Funnel activation, POST /api/tunnel/tailscale-install (SSE) and GET /api/tunnel/tailscale-check, Remote functionality (+2 more)

### Community 290 - "Community 290"
Cohesion: 0.2
Nodes (10): Distinguishing 'no accounts configured' from 'all accounts temporarily locked', with retry-after computed from the earliest lock, fill-first strategy — the default when no round-robin override applies, Filtering candidates by exclude-set, active model lock, and (Antigravity only) cached live quota before any strategy runs, In-memory Antigravity live-quota cache that pre-filters accounts before a request is even attempted, Multi-account, Mutex scope around getProviderCredentials, options.preferredConnectionId pins selection to one connection, bypassing fill-first/round-robin, "Public" virtual connection injected for noAuth providers (+2 more)

### Community 291 - "Community 291"
Cohesion: 0.2
Nodes (9): Anthropic-compatible (SP14b, `connection.anthropic-compatible-node`), API (dashboard session), Custom providers contract (M2 SP13b, SP14b; custom headers and stream retries 2026-09-28), Matrix, Matrix entries, Table `provider_nodes` (migrations `0003`, `0004`, `0005`, `0006`), UI, `/v1` (changes to `catalog-providers.md` resolution) (+1 more)

### Community 292 - "Community 292"
Cohesion: 0.2
Nodes (9): Answer (non-streaming), Matrix, Matrix entries, OpenAI Responses client protocol contract (M2 SP15b), Other deviations, Request (9router's Responses → chat pivot, in CIP), Routes and auth, Stream (+1 more)

### Community 293 - "Community 293"
Cohesion: 0.2
Nodes (9): code:block1 ({ threadId: <uuid>, memory: "", config: { workingDir: "/", d), Command Code provider contract (M2 SP14h), Connection test (corrected), Matrix, Matrix entries, Models, Non-streaming clients, Request (CIP → envelope) (+1 more)

### Community 294 - "Community 294"
Cohesion: 0.2
Nodes (9): code:block1 (tools/discovery/), code:ts (import { describe, expect, it } from "vitest";), code:ts (import type { Inventory } from "./inventory.js";), code:bash (git add tools/discovery/src/coverage.ts tools/discovery/test), File Structure, Fixed inventory counts (measured 2026-09-22 against `E:\9router`), Global Constraints, M-1 Discovery Implementation Plan (+1 more)

### Community 295 - "Community 295"
Cohesion: 0.2
Nodes (10): code:ts (import { resolve, sep } from "node:path";), code:bash (git add .gitattributes package.json pnpm-workspace.yaml tool), code:block3 (* text=auto eol=lf), code:yaml (packages:), code:json ({), code:json ({), code:json ({), code:ts (import { defineConfig } from "vitest/config";) (+2 more)

### Community 296 - "Community 296"
Cohesion: 0.2
Nodes (9): Acceptance and delivery, API and trust boundary, Bounded reads and lifecycle, code:text ({), Intent and baseline, Planning behavior, Scope and alternatives, SP29 — read-only routing simulator (+1 more)

### Community 297 - "Community 297"
Cohesion: 0.27
Nodes (6): QuotaController, Controller, Get, Header, Param, Post

### Community 298 - "Community 298"
Cohesion: 0.2
Nodes (10): discovery/tsconfig.json, compilerOptions, module, moduleResolution, noUncheckedIndexedAccess, skipLibCheck, strict, target (+2 more)

### Community 300 - "Community 300"
Cohesion: 0.22
Nodes (7): body, encoded, entered, left, planner, req, upstream

### Community 301 - "Community 301"
Cohesion: 0.28
Nodes (6): base, bytes(), jsonAnswer(), pcm, setUp(), upstream()

### Community 302 - "Community 302"
Cohesion: 0.22
Nodes (9): Auto fallback, BaseExecutor.execute — multi-baseUrl loop and connect timeout, In-place retry (tryRetry) and computeRetryDelay, and the end-to-end retry ceiling, Per-provider account loop — select, execute, classify, exclude, repeat, Reactive 401/403 handling — refresh credentials, re-execute once, Turning an executor exception or non-2xx response into an error result, Upstream failure after tokens have already reached the client, What the client receives when the account loop runs out (+1 more)

### Community 303 - "Community 303"
Cohesion: 0.22
Nodes (8): API (dashboard session), Catalog providers contract (M2 SP13), Matrix, Registry and adapter changes, SP23 media and TTS voices, UI, `/v1` model resolution (changes to `chat-lane.md`), Which providers are connectable

### Community 304 - "Community 304"
Cohesion: 0.22
Nodes (8): code:block1 (recorder ──> 9router :20128 ──> scripted vendor (tools/parit), Commands, How a tape is judged, How a tape is recorded, M1 acceptance gate (spec §9), Parity harness contract (M0 SP3) and the M1 acceptance gate, Tests, What recording 9router 0.5.55 showed

### Community 305 - "Community 305"
Cohesion: 0.22
Nodes (8): Answer (non-streaming), Gemini client protocol contract (M2 SP15c), Matrix, Matrix entries, Model list, Path, key and request, Stream, TTS passthrough

### Community 306 - "Community 306"
Cohesion: 0.22
Nodes (8): code:block1 (body ─▶ parseOpenAIChatRequest ─▶ { request: CanonicalReques), Errors: `toOpenAIError(error)`, Inbound: `parseOpenAIChatRequest(body)`, OpenAI Chat Completions protocol adapter contract (M1 SP10), Outbound: `toOpenAIChatCompletion(response, { created, fallbackId })`, Rules from the reference, Streaming: `OpenAIChatStreamEncoder`, Tests

### Community 307 - "Community 307"
Cohesion: 0.22
Nodes (8): Answer (JSON body), Matrix, Matrix entries, Models, ollama-local, Ollama provider contract (M2 SP14d), Request (CIP → /api/chat), Stream (NDJSON → StreamChunk)

### Community 308 - "Community 308"
Cohesion: 0.22
Nodes (8): OpenAI-compatible provider adapter contract (M1 SP9), Other methods, Request mapping (CIP → chat completions), Response mapping, Rules from the reference, Status classification, Streaming (SSE) bounds, Tests

### Community 309 - "Community 309"
Cohesion: 0.22
Nodes (8): Discovery coverage, Entries per bounded context, Labels, Missing — executors, Missing — pages, Missing — providers, Missing — settingsKeys, Missing — translators

### Community 310 - "Community 310"
Cohesion: 0.22
Nodes (8): A. Urgent connection fan-out, B. Sunk-cost usage report, C. Senior-requested permanent cache, code:ts (const results: Awaited<ReturnType<typeof checkConnection>>[]), code:ts (import { eq } from "drizzle-orm";), code:ts (const modelCache = new Map<string, { value: Promise<Model[]>), Skill target, `writing-lean-bounded-code` RED baseline

### Community 311 - "Community 311"
Cohesion: 0.22
Nodes (9): 4.1 Domain model (`behavioral.md §9`), 4.2 Port — đúng 6, cho 154 endpoint, 4.3 Cấu trúc một bounded context, 4.4 Mười bounded context, 4. Domain model & Port, code:block3 (Provider · ProviderAccount · Credential · Model · ModelCapab), code:ts (type AccountLock = {), code:ts (interface AIProviderPort {) (+1 more)

### Community 312 - "Community 312"
Cohesion: 0.22
Nodes (3): bun:sqlite, Database, Statement

### Community 313 - "Community 313"
Cohesion: 0.22
Nodes (7): Observations, `porting-behavior-not-code` GREEN and micro-tests, A. Port a 9Router file to TS, B. "Trivial, skip the Feature Matrix", C. "Keep `global._*` exactly, to be safe", `porting-behavior-not-code` RED baseline, Skill target

### Community 314 - "Community 314"
Cohesion: 0.22
Nodes (7): Fan-out and cache micro-tests, `writing-lean-bounded-code` GREEN and micro-tests, A. Urgent connection fan-out, B. Sunk-cost usage report, C. Senior-requested permanent cache, Skill target, `writing-lean-bounded-code` RED baseline

### Community 315 - "Community 315"
Cohesion: 0.28
Nodes (7): Context, Implementation steps, Quyết định cần duyệt (mặc định tôi đề xuất), Quyết định cần duyệt (mặc định tôi đề xuất), SP24a: ghi usage, cost theo pricing, thống kê, SSE live, màn Usage và chỉnh giá, SP24a: ghi usage, cost theo pricing, thống kê, SSE live, màn Usage và chỉnh giá, Verification

### Community 316 - "Community 316"
Cohesion: 0.28
Nodes (7): Context, Implementation steps, Quyết định cần duyệt (mặc định tôi đề xuất), Quyết định cần duyệt (mặc định tôi đề xuất), SP24b: request detail (metadata + attempts), usage của media lanes, màn Requests, SP24b: request detail (metadata + attempts), usage của media lanes, màn Requests, Verification

### Community 317 - "Community 317"
Cohesion: 0.22
Nodes (8): Acceptance and delivery, API and trust boundary, Bounded reads and lifecycle, Intent and baseline, Planning behavior, Scope and alternatives, SP29 — read-only routing simulator, Web integration

### Community 318 - "Community 318"
Cohesion: 0.25
Nodes (7): boundary, cipher, disabled, fresh, now, status, upstream

### Community 320 - "Community 320"
Cohesion: 0.25
Nodes (8): clearAccountError — lazy cleanup of expired locks and conditional error-state reset on a successful request, createProviderConnection — identity-based dedup on re-import, and automatic priority assignment for new connections, deleteProviderConnection — row removal followed by a priority renumber for the remaining accounts of that provider, Every distinct reason markAccountUnavailable() locks an account+model pair, and that reason's expiry rule, Provider account management, The providerConnections row shape — fixed SQL columns vs. an open-ended JSON blob for everything else, updateProviderConnection — atomic read-merge-write per connection, and priority reorder triggered by a priority change, Where modelLock_* (and all other per-connection state) is stored, and whether it survives a restart

### Community 321 - "Community 321"
Cohesion: 0.25
Nodes (7): Chat lane contract (M1 SP12), Model resolution, Request flow and limits, Rules from the reference, Streaming, Tests, UI

### Community 322 - "Community 322"
Cohesion: 0.25
Nodes (7): API (dashboard session required), Connections contract (M1 SP11), Rules from the reference, Secret storage (`SecretCipherPort`), Table `provider_connections`, Tests, UI

### Community 323 - "Community 323"
Cohesion: 0.25
Nodes (7): Custom models, Dashboard, Live model list, Matrix entries, Model import and custom models contract (M2 SP16a), Model test, /v1/models

### Community 324 - "Community 324"
Cohesion: 0.25
Nodes (7): azure (kept 9router), clinepass, cloudflare-ai, Connection fields, Matrix, Matrix entries, Per-connection data providers contract (M2 SP14g)

### Community 325 - "Community 325"
Cohesion: 0.25
Nodes (7): Matrix, Matrix entries, Models and connection test, Non-streaming answer (corrected), OpenAI Responses provider contract (M2 SP14c), Request (CIP → Responses, 9router), Stream (Responses SSE → StreamChunk, 9router)

### Community 326 - "Community 326"
Cohesion: 0.25
Nodes (7): Levels, Matrix entries, Model suffix (part 2), On /v1, Provider thinking contract (2026-09-28), Storage and API, UI

### Community 327 - "Community 327"
Cohesion: 0.25
Nodes (7): HTTP contract, Keys in SP5, Rules from the reference, Settings contract (M1 SP5), SP27 / M3 U2 — General, runtime and portable settings, SP28 browser presentation, Tests that prove it

### Community 328 - "Community 328"
Cohesion: 0.25
Nodes (7): CodeBuddy, Collapse (SSE → CIP response), Matrix, Matrix entries, Registry, Stream-only providers contract (M2 SP14b), Upstream call

### Community 329 - "Community 329"
Cohesion: 0.25
Nodes (7): A. Port a 9Router file to TS, B. "Trivial, skip the Feature Matrix", C. "Keep `global._*` exactly, to be safe", code:ts (const VALID_TYPES = ["http", "vercel", "cloudflare"] as cons), code:ts (assert.deepEqual(normalizeProxyPoolUpdate({ type: 'socks', i), `porting-behavior-not-code` RED baseline, Skill target

### Community 331 - "Community 331"
Cohesion: 0.25
Nodes (6): anthropic, base, codebuddy, gemini, openai, perplexity

### Community 332 - "Community 332"
Cohesion: 0.36
Nodes (6): Context, Critical Files, Hoàn thiện SP23: TTS lane + voice listing + preview, Hoàn thiện SP23: TTS lane + voice listing + preview, Implementation steps, Verification

### Community 333 - "Community 333"
Cohesion: 0.29
Nodes (6): before, now, provider, repo, rows, upstream

### Community 334 - "Community 334"
Cohesion: 0.29
Nodes (6): CAPACITY_CAPABILITIES, CapacityCapability, capacityPools, COMBO_STRATEGIES, combos, ComboStrategy

### Community 335 - "Community 335"
Cohesion: 0.29
Nodes (6): pricingOverrides, USAGE_STATUSES, usageDaily, usageEvents, usageRequests, UsageStatus

### Community 338 - "Community 338"
Cohesion: 0.29
Nodes (6): API (dashboard session), Capacity adapter contract (M2 SP20), Chat lanes, Rules from the reference, Storage, UI

### Community 339 - "Community 339"
Cohesion: 0.29
Nodes (6): API (dashboard session), Chat lanes, Combo contract (M2 SP19), Rules from the reference, Storage, UI

### Community 340 - "Community 340"
Cohesion: 0.29
Nodes (6): Access to `/api/*`, HTTP contract, Identity and API keys contract (M1 SP6), Rules from the reference, Shared machines (decided 2026-09-25: option A), Who counts as local

### Community 341 - "Community 341"
Cohesion: 0.29
Nodes (6): Mapping (labels per `porting-behavior-not-code`), Registry extraction contract (M0 SP4), Result (2026-09-26), Source and output, Tests, Verification (spec exit criterion: "verified by diff")

### Community 342 - "Community 342"
Cohesion: 0.29
Nodes (6): Dashboard API (session), `GET /v1/audio/voices?provider=<id>[&model=<id>][&lang=<code>]` (API key), `POST /v1/audio/speech` (API key, as every `/v1` route), Providers, Speech contract (M2 SP23), UI

### Community 343 - "Community 343"
Cohesion: 0.29
Nodes (6): API ↔ UI map, Engine and non-HTTP work, Error handling, Rule: an API is done only when its screen is wired, Waiting for backend, Wired

### Community 344 - "Community 344"
Cohesion: 0.29
Nodes (6): 1 · Credential / key / token — PASS, 2 · Sidebar đồng nhất — FAIL (nghiêm trọng), 3 · State rules (§10.7) — FAIL (chỉ vẽ happy path), 4 · Lệch brief khác (mức thấp, ghi để sửa ở U1+), AIGate — Stitch output audit, Việc cần làm trước khi vào U0/U1

### Community 345 - "Community 345"
Cohesion: 0.29
Nodes (6): AIGate schema conventions, Growth and hot paths, Integrity, Secrets, Shape, Where things live

### Community 346 - "Community 346"
Cohesion: 0.33
Nodes (3): get(), OPTIONS, recorderOf()

### Community 347 - "Community 347"
Cohesion: 0.43
Nodes (3): FixedCallbackRelay, parseUrl(), Waiting

### Community 348 - "Community 348"
Cohesion: 0.29
Nodes (5): anthropic, base, codebuddy, gemini, openai

### Community 350 - "Community 350"
Cohesion: 0.38
Nodes (5): defaultReference, here, NINEROUTER_ROOT, referenceCandidates, REPO_ROOT

### Community 351 - "Community 351"
Cohesion: 0.29
Nodes (6): Dashboard API (session), `GET /v1/audio/voices?provider=<id>[&model=<id>][&lang=<code>]` (API key), `POST /v1/audio/speech` (API key, as every `/v1` route), Providers, Speech contract (M2 SP23), UI

### Community 352 - "Community 352"
Cohesion: 0.29
Nodes (6): AIGate schema conventions, Growth and hot paths, Integrity, Secrets, Shape, Where things live

### Community 354 - "Community 354"
Cohesion: 0.33
Nodes (4): { privateKey }, SERVICE_ACCOUNT, tested, upstream

### Community 355 - "Community 355"
Cohesion: 0.4
Nodes (5): post(), refused(), reply, tested, upstream

### Community 357 - "Community 357"
Cohesion: 0.33
Nodes (5): Behavior, Deferred, Engine contract (M1 SP7), Rules from the reference, Tests

### Community 358 - "Community 358"
Cohesion: 0.33
Nodes (5): Hosted relay deploy, Pool data and management, Proxy pools contract (M2 SP18), Reference deviations, Request dispatch

### Community 359 - "Community 359"
Cohesion: 0.33
Nodes (5): Behavior: every failure has one mapping, Deferred, Rules from the reference, Tests, Transport contract (M1 SP8)

### Community 360 - "Community 360"
Cohesion: 0.33
Nodes (5): Architecture and source of truth, Claude's integration boundary, UI ownership handoff, Visual implementation status, Work completed on 2026-09-24 for Claude

### Community 361 - "Community 361"
Cohesion: 0.33
Nodes (6): code:ts (import { describe, expect, it } from "vitest";), code:ts (import { z } from "zod";), code:ts (import { describe, expect, it, beforeEach, afterAll } from "), code:ts (import { readFileSync, existsSync } from "node:fs";), code:bash (git add tools/discovery/src/schema.ts tools/discovery/src/va), Task 2: Feature Matrix schema and validator

### Community 362 - "Community 362"
Cohesion: 0.33
Nodes (6): code:ts (import { describe, expect, it } from "vitest";), code:ts (import type { FeatureEntry } from "./schema.js";), code:ts (import { mkdirSync, writeFileSync } from "node:fs";), code:bash (mkdir -p docs/discovery/feature-matrix && touch docs/discove), code:bash (git add tools/discovery/src/capabilities.ts tools/discovery/), Task 5: capabilities.md generator and CLI

### Community 363 - "Community 363"
Cohesion: 0.33
Nodes (6): 9. Lộ trình, M0 · Nền, M1 · Lát mỏng xuyên suốt (walking skeleton), M2 · Nhân rộng (nhiều nhánh song song), M3 · UI, M-1 · DISCOVERY

### Community 364 - "Community 364"
Cohesion: 0.33
Nodes (5): Findings, Recommendation, Results, SPIKE-1: SQLite drivers through Drizzle, What "works" means

### Community 368 - "Community 368"
Cohesion: 0.33
Nodes (5): Findings, Recommendation, Results, SPIKE-1: SQLite drivers through Drizzle, What "works" means

### Community 371 - "Community 371"
Cohesion: 0.4
Nodes (3): eslint, featuresDir, fixture

### Community 372 - "Community 372"
Cohesion: 0.4
Nodes (4): AIGate, code:powershell (pnpm install --frozen-lockfile), Repository map, Verify (PowerShell)

### Community 373 - "Community 373"
Cohesion: 0.4
Nodes (4): API and UI, Fallback and locks, Multi-account routing contract (M2 SP17), Selection

### Community 374 - "Community 374"
Cohesion: 0.4
Nodes (4): Decisions, bounds and privacy, HTTP, Routing simulator (SP29 / M3 U6), UI / acceptance

### Community 375 - "Community 375"
Cohesion: 0.4
Nodes (4): Behavior 9router does not have — AIGate must add, Gap register, Implementation accidents — behavior required, mechanism not, Suspected bugs — analyse before deciding

### Community 376 - "Community 376"
Cohesion: 0.4
Nodes (5): code:ts (import { describe, expect, it } from "vitest";), code:bash (pnpm discovery inventory), code:markdown (# Gap register), code:bash (git add docs/ tools/discovery/test/gate.test.ts), Task 19: M-1 exit gate

### Community 377 - "Community 377"
Cohesion: 0.4
Nodes (4): Limits, SP0.6 skill discovery, Test, Wiring

### Community 378 - "Community 378"
Cohesion: 0.4
Nodes (5): 6.1 IMPLEMENTATION ACCIDENT — không mang sang, 6.2 SUSPECTED BUG — không tự động tái tạo (`§26`), 6.3 Feature KHÔNG clone, 6.4 Feature phải quyết dứt điểm ở Phase C, 6. Technical debt KHÔNG được thừa kế

### Community 379 - "Community 379"
Cohesion: 0.4
Nodes (5): 7.1 Feature Matrix — artifact bắt buộc (`§6`), 7.2 Definition of Done (`§29`) — 13 mục, không tự phong, 7. Quy trình bắt buộc cho mỗi feature, code:block10 ([ ] Feature inventory complete      [ ] Unit tests passed), code:block9 (Feature · Sub-feature · Trigger · Input · Output · Business )

### Community 381 - "Community 381"
Cohesion: 0.4
Nodes (4): Decisions, Out of scope, Runtime guarantees, Token Saver contract (M2 SP21)

### Community 382 - "Community 382"
Cohesion: 0.4
Nodes (4): Behavior 9router does not have — AIGate must add, Gap register, Implementation accidents — behavior required, mechanism not, Suspected bugs — analyse before deciding

### Community 383 - "Community 383"
Cohesion: 0.4
Nodes (4): Limits, SP0.6 skill discovery, Test, Wiring

### Community 384 - "Community 384"
Cohesion: 0.4
Nodes (4): Decisions, bounds and privacy, HTTP, Routing simulator (SP29 / M3 U6), UI / acceptance

### Community 385 - "Community 385"
Cohesion: 0.5
Nodes (3): Request, Response, Trae SOLO provider

### Community 386 - "Community 386"
Cohesion: 0.5
Nodes (3): Full registry acceptance, Provider parity with 9Router, UI reference captured 2026-09-24

### Community 387 - "Community 387"
Cohesion: 0.5
Nodes (3): Deferred golden scenarios, Parity report (M1 gate), Tapes

### Community 388 - "Community 388"
Cohesion: 0.5
Nodes (4): code:ts (import { describe, expect, it } from "vitest";), code:ts (import { readFileSync } from "node:fs";), code:bash (git add tools/discovery/src/inventory.ts tools/discovery/tes), Task 3: Inventory extractor

### Community 389 - "Community 389"
Cohesion: 0.5
Nodes (4): code:yaml (- id: apikey.validate), Mapping of `behavioral.md` questions to schema fields, The entry template, The Tracing Protocol

### Community 390 - "Community 390"
Cohesion: 0.5
Nodes (3): Ledger, Scope and gates, SP42 / M3 U10 — Integrations Skills and MCP EN/VI

### Community 391 - "Community 391"
Cohesion: 0.5
Nodes (3): Acceptance plan, Ledger, SP43 / M3 U10 — CLI Tools discovery and core adapters EN/VI

### Community 392 - "Community 392"
Cohesion: 0.5
Nodes (3): code:ts (const rows = await db.select().from(usage).where(eq(usage.ac), Fan-out and cache micro-tests, `writing-lean-bounded-code` GREEN and micro-tests

### Community 393 - "Community 393"
Cohesion: 0.5
Nodes (3): meta, route, usage

### Community 394 - "Community 394"
Cohesion: 0.5
Nodes (3): AIGate, Repository map, Verify (PowerShell)

### Community 395 - "Community 395"
Cohesion: 0.5
Nodes (3): Deferred golden scenarios, Parity report (M1 gate), Tapes

### Community 396 - "Community 396"
Cohesion: 0.5
Nodes (4): §15 Code quality — shortest CLEAR implementation, not shortest possible, Rule 1 — Write LEAN code, no over-engineering, Rule 2 — Code must be maintainable, no magic values or hidden side effects, Rule 12 — Priority order: Correctness → Simplicity → Maintainability → Predictable resources → Latency → Throughput → Optimization

### Community 402 - "Community 402"
Cohesion: 0.67
Nodes (3): code:block32 (model resolution → provider selection → account selection → ), code:bash (git add docs/discovery/), Task 10: Trace — Request routing, Auto fallback

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
- **3386 isolated node(s):** `port`, `API_PREFIXES`, `ServerOptions`, `Parsed`, `Headers` (+3381 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **60 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

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
- **Why does `@nestjs/common` connect `OAuth sign-in contract (M2 SP16)` to `AnthropicStreamEncoder`, `ChatLane`, `Rule 1 — Write LEAN code, no over-engineering`, `usage-meter.ts`, `EngineError`, `ConnectionsController — /api/connections CRUD + POST /:id/test (validateCredential outside any transaction)`, `app/screens.tsx`, ``writing-lean-bounded-code` RED baseline`, `Bounded context: routing (core)`, `scripts`, `antigravity.test.mjs`, `oauth-lane.test.mjs`, `SP24b: request detail (metadata + attempts), usage của media lanes, màn Requests`, `requests.controller.ts`, `AIGate — Capability Specification`, `Providers`, `protocols/openai-responses.ts`, `.constructor`, `DirectTransport (direct branch implementation)`, `CLI Tools`, `catalog.controller.ts`, `Combo / Vision Adapter`, `Port behavior, not code`, `Bounded patterns`, `ollama-adapter.test.mjs`, `compilerOptions`?**
  _High betweenness centrality (0.191) - this node is a cross-community bridge._
- **Why does `toProblem()` connect `database/src/index.ts` to `gateway/screens.tsx`, `Overview — /`, `Descriptor connectionFields + withConnection(): {field} URL tokens filled per connection (encoded), OpenAI-Organization header, {model} filled per request`, `usage.tsx`, `isRecord`, `quota.service.ts`, `provider-nodes.repo.ts`, `models.tsx`?**
  _High betweenness centrality (0.125) - this node is a cross-community bridge._
