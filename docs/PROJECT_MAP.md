# AIGate — Project Map

> **GENERATED** by `graphify-out/build_project_map.py` from the knowledge graph
> (`graphify-out/graph.json`). Do not hand-edit — change the source docs, re-run
> `/graphify docs --update`, then `python graphify-out/build_project_map.py`.
>
> `?` = edge marked AMBIGUOUS in the graph (the source docs do not settle it).

Đọc file này trước khi làm bất kỳ màn UI hay bounded context nào. Nó trả lời:
màn này thuộc U-project nào, lấy dữ liệu từ context backend nào, phải chờ SP
backend nào xong, map về feature nào của 9router, dùng component design nào,
và audit Stitch đã bắt lỗi gì ở nó.

Nguồn: `docs/superpowers/specs/2026-09-22-aigate-design.md` (spec — thắng khi mâu thuẫn),
`docs/design/stitch-briefs.md`, `docs/design/DESIGN.md`, `docs/design/stitch-audit.md`,
`docs/superpowers/plans/2026-09-22-m1-discovery.md`, `docs/governance/*.md`.

## 1 · Lộ trình

`M-1 Discovery → M0 Foundation → M1 Walking skeleton → M2 Scale-out → M3 UI`

| Milestone | Sub-project |
|---|---|
| Milestone M-1 · Discovery | T01, T02, T03, T04, T05, T06, T07, T08, T09, T10, T11, T12, T13, T14, T15, T17, T18, T19, T16 |
| Milestone M0 · Foundation | SP0, SP1, SP2, SP3, SP4 |
| Milestone M1 · Walking skeleton (thin end-to-end slice) | SP5, SP6, SP7, SP8, SP9, SP10, SP11, SP12 |
| Milestone M2 · Scale-out (parallel branches) | SP13, SP14, SP15, SP16, SP17, SP18, SP19, SP20, SP21, SP22, SP23, SP24, SP25 |
| Milestone M3 · UI | U0, U1, U2, U3, U4, U5, U6, U7, U8, U9, U10, U11 |

## 2 · UI sub-project (M3) — thứ tự dựng

| U | Nội dung | Màn | Phụ thuộc U | Chờ context | Chờ SP backend |
|---|---|---|---|---|---|
| U0 | U0 — Design system (tokens, Radix primitives, light/dark theme, standard states, a11y baseline) | — | — | — | — |
| U1 | U1 — Shell (router tree, query client, layout, 7-group sidebar, SSE client, error boundary, i18n) | — | U0 | — | — |
| U2 | U2 — Auth + Onboarding + Settings | onboarding, login, callback, settings_general, settings_auth, settings_developer | U1 | settings, identity, settings, identity | SP5, SP6 |
| U3 | U3 — Endpoint & Keys | endpoint_keys | U1 | apikeys, apikeys | SP6 |
| U4 | U4 — Providers + AuthFlow + Connections (heaviest SP) | llm_providers, connections, provider_detail, authflow | U1 | connections, connections | SP11, SP16, SP17 |
| U5 | U5 — Media Providers | media_providers | U4, U1 | — | SP23 |
| U6 | U6 — Routing & Fallback + Simulator | routing_fallback, token_saver? | U1 | routing, routing | SP19, SP20 |
| U7 | U7 — Usage + Quota + Requests | usage, quota, requests, request_detail | U1 | usage, usage | SP24 |
| U8 | U8 — Overview | overview | U3, U4, U5, U6, U7, U1 | — | — |
| U9 | U9 — Network: Proxy Pools + Tunnel + MITM | proxy_pools, tunnel, mitm, deploy_wizard | U1 | transport, transport | SP18 |
| U10 | U10 — Integrations: CLI Tools + Skills + MCP | cli_tools, skills, mcp, cli_tool_detail | U1 | tooling, tooling | SP25 |
| U11 | U11 — Console + dev mode | console | U1 | — | — |

## 3 · Màn hình → backend → feature → design

| Màn | U | Context backend | Feature 9router | Component design | Tái dùng pattern của | Lỗi audit |
|---|---|---|---|---|---|---|
| **AuthFlow modal (7 step bodies)** | U4 | connections | oauth_providers, apikey_providers | secret_field, copy_field, state_error | — | credential_scan_pass, showcase_screens |
| **OAuth callback (/callback)** | U2 | identity | — | state_error | login | showcase_screens |
| **CLI Tool detail (/integrations/cli-tools/:toolId)** | U10 | tooling | cli_tools | copy_field | — | — |
| **CLI Tools — /integrations/cli-tools, /:toolId** | U10 | tooling | cli_tools | — | — | — |
| **Connections & AuthFlow — /providers/connections** | U4 | connections | provider_account_management, provider_authentication, multi_account | status_pill | llm_providers | happy_path_only |
| **Console — /traffic/console (dev only)** | U11 | tooling | console_log | color_tokens, type_scale | — | console_visibility |
| **Relay deploy wizard (3 steps)** | U9 | transport | proxy_pools | secret_field, state_error | — | happy_path_only, showcase_screens |
| **Endpoint & Keys — /gateway/endpoint** | U3 | apikeys | endpoint_apikey | copy_field, secret_field, status_pill | — | credential_scan_pass |
| **LLM Providers — /providers, /:id, /new** | U4 | catalog, connections | providers | health_dot, density_rules | — | — |
| **Login (/login)** | U2 | identity | — | warning_banner | — | sidebar_drift, showcase_screens |
| **MCP — /integrations/mcp** | U10 | tooling | mcp | type_scale | cli_tool_detail | happy_path_only |
| **Media Providers — /providers/media/:kind, /:kind/:id** | U5 | media | media_providers | copy_field, color_tokens | llm_providers | — |
| **MITM — /network/mitm** | U9 | transport, tooling | — | warning_banner, destructive_confirm | tunnel | mitm_button_spacing |
| **Onboarding — /welcome** | U2 | identity, connections, apikeys | — | state_loading | authflow | sidebar_drift |
| **Overview — /** | U8 | usage, connections, catalog | quota_tracker | metric_card, health_dot, copy_field, state_empty | — | sidebar_drift, happy_path_only, console_visibility |
| **Provider detail (/providers/:id)** | U4 | catalog, connections | model_registry, model_mapping | status_pill | llm_providers | — |
| **Proxy Pools — /network/proxy-pools** | U9 | transport | proxy_pools | warning_banner, status_pill | — | happy_path_only |
| **Quota — /providers/quota** | U7 | usage | quota_tracker | color_tokens | overview | happy_path_only |
| **Request detail (/traffic/requests/:id)** | U7 | usage | — | copy_field, no_credential_rule | — | credential_scan_pass |
| **Requests — /traffic/requests, /:id** | U7 | usage | — | status_pill, density_rules | — | happy_path_only |
| **Routing & Fallback — /gateway/routing** | U6 | routing | request_routing, auto_fallback, combo_vision_adapter | warning_banner, health_dot | — | routing_tab_merge |
| **Settings · Auth & Access (/settings/auth)** | U2 | identity, apikeys | settings | secret_field, no_credential_rule | — | sidebar_drift, settings_auth_regen |
| **Settings · Developer (/settings/developer)** | U2 | settings | settings | destructive_confirm | — | console_visibility |
| **Settings · General (/settings/general)** | U2 | settings | translation_language | status_pill | — | — |
| **Skills — /integrations/skills** | U10 | tooling | skills | copy_field | — | happy_path_only |
| **Token Saver — /gateway/token-saver** | U6? | routing | token_saver | status_pill, metric_card | overview | — |
| **Tunnel — /network/tunnel** | U9 | tooling | remote_functionality | warning_banner, copy_field | deploy_wizard | — |
| **Usage — /traffic/usage** | U7 | usage | usage | type_scale | — | happy_path_only |

## 4 · Bounded context → ai dùng nó

| Context | Gánh gì | SP backend dựng nó | Màn hiển thị nó | Port |
|---|---|---|---|---|
| `apikeys` | issue / validate / revoke API keys. | SP6, SP6 | endpoint_keys, settings_auth, onboarding | — |
| `catalog` | provider registry, model, capabilities, alias, pricing. | SP4, SP13, SP7, SP13 | llm_providers, provider_detail, overview | — |
| `connections` | multi-account credentials, OAuth flow + refresh, AccountLock. | SP11, SP16, SP17, SP11, SP16, SP17 | connections, llm_providers, provider_detail, authflow, onboarding, overview | credential_store, secret_cipher |
| `identity` | login, JWT cookie, password, OIDC, SAML, Local Mode. | SP6, SP6 | onboarding, settings_auth, login, callback | — |
| `media` | 9 media kinds, voice list. | SP23, SP23 | media_providers | — |
| `routing` | The core context: 8 lanes, CIP, combo, capacity adapter, token saver. | SP12, SP20, SP22, SP7, SP9, SP10, SP14, SP15, SP17, SP19, SP21, SP12, SP19, SP20 | routing_fallback, token_saver | ai_provider |
| `settings` | settings + guard against mass-assignment. | SP5, SP5 | settings_general, settings_developer | — |
| `tooling` | CLI tools writer, skills, console log, tunnel, MITM control, MCP. | SP25, SP25 | console, tunnel, mitm, mcp, cli_tools, cli_tool_detail, skills | — |
| `transport` | proxy pool, relay deploy, outbound proxy, MITM bypass DNS. | SP8, SP18, SP8, SP18 | proxy_pools, mitm, deploy_wizard | http_transport |
| `usage` | history/daily, quota tracker, request detail, live SSE. | SP24, SP24 | overview, quota, usage, requests, request_detail | clock, event_bus |

## 5 · Lỗi / khoảng trống đã biết

- **Audit PASS: no credential leaked across 27 HTML exports** — màn: endpoint_keys, authflow, request_detail
- **Audit FAIL: sidebar not identical across screens** — màn: overview, settings_auth, login, onboarding — sửa ở: U1
- **Audit FAIL: only the happy path was drawn (state rules §10.7)** — màn: overview, requests, usage, quota, mcp, skills, proxy_pools, connections, deploy_wizard — sửa ở: U0
- **Audit finding: MITM CA buttons adjacent, type-to-confirm modal missing** — màn: mitm — sửa ở: U1
- **Audit finding: Console shown in sidebar regardless of Developer mode** — màn: console, overview, settings_developer — sửa ở: U1
- **Audit finding: settings-auth regenerated as settings-auth-v2** — màn: settings_auth
- **Audit finding: routing-fallback merged 4 tabs into one 3886px screen** — màn: routing_fallback — sửa ở: U1
- **Audit finding: login-callback / deploy-wizard / authflow-modals are showcases, not routes** — màn: callback, login, deploy_wizard, authflow
- **GAP: Token Saver screen missing from the U0–U11 table** — màn: token_saver — sửa ở: U6

Cạnh AMBIGUOUS cần người quyết: **5**

- Feature group — MCP (API with no UI, found during spec work) → The 23 feature groups required by behavioral.md §5 (`conceptually_related_to`, Task 17 — MCP is an extra group found during spec work, not one of the 23)
- GAP: Token Saver screen missing from the U0–U11 table → U6 — Routing & Fallback + Simulator (`references`, §10.10)
- U6 — Routing & Fallback + Simulator → Token Saver — /gateway/token-saver (`implements`, §10.8 vs §10.10)
- Open decision (user confirmation pending): scan every message + system prompt for required capabilities → detectRequiredCapabilities() (`rationale_for`, User confirmation pending)
- ErrorCode: TIMEOUT → UI error code: TIMEOUT (`conceptually_related_to`, )

## 6 · Tra cứu sâu hơn

```bash
/graphify query "màn Connections cần backend nào"      # BFS quanh một khái niệm
/graphify path "U4" "SP16"                            # đường nối giữa hai node
/graphify explain "routing"                            # giải thích một node
```

Graph trực quan: mở `graphify-out/graph.html`. Báo cáo cụm: `graphify-out/GRAPH_REPORT.md`.
