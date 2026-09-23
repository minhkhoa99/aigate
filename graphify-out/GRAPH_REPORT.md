# Graph Report - docs  (2026-09-23)

## Corpus Check
- 7 files · ~27,739 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 319 nodes · 822 edges · 12 communities
- Extraction: 82% EXTRACTED · 18% INFERRED · 0% AMBIGUOUS · INFERRED: 147 edges (avg confidence: 0.87)
- Token cost: 251,553 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_M-1 Discovery Tooling|M-1 Discovery Tooling]]
- [[_COMMUNITY_Parity, Errors & Fallback|Parity, Errors & Fallback]]
- [[_COMMUNITY_Walking Skeleton & Ports (M1)|Walking Skeleton & Ports (M1)]]
- [[_COMMUNITY_Providers & Connections (U4)|Providers & Connections (U4)]]
- [[_COMMUNITY_Overview —|Overview — /]]
- [[_COMMUNITY_Identity, Keys & Settings (U2U3)|Identity, Keys & Settings (U2/U3)]]
- [[_COMMUNITY_Design System & Network (U0U9)|Design System & Network (U0/U9)]]
- [[_COMMUNITY_Shell, Overview & Usage (U1U7U8)|Shell, Overview & Usage (U1/U7/U8)]]
- [[_COMMUNITY_Tooling & Integrations (U10)|Tooling & Integrations (U10)]]
- [[_COMMUNITY_Foundation & Architecture (M0)|Foundation & Architecture (M0)]]
- [[_COMMUNITY_Phase Model A-F & DoD|Phase Model A-F & DoD]]
- [[_COMMUNITY_Lean Code Rules|Lean Code Rules]]

## God Nodes (most connected - your core abstractions)
1. `Bounded context: routing (core)` - 31 edges
2. `Feature Matrix — mandatory 17-column artifact` - 27 edges
3. `Milestone M-1 · Discovery` - 26 edges
4. `The 23 feature groups required by behavioral.md §5` - 26 edges
5. `Bounded context: connections` - 25 edges
6. `Parity verification — 3 tiers` - 20 edges
7. `Overview — /` - 19 edges
8. `U1 — Shell (router tree, query client, layout, 7-group sidebar, SSE client, error boundary, i18n)` - 19 edges
9. `The Tracing Protocol (6 steps, applied by Tasks 6–18)` - 19 edges
10. `Bounded context: tooling` - 18 edges

## Surprising Connections (you probably didn't know these)
- `MITM — /network/mitm` --semantically_similar_to--> `Settings · Developer (/settings/developer)`  [INFERRED] [semantically similar]
  docs/superpowers/specs/2026-09-22-aigate-design.md → docs/design/stitch-briefs.md
- `Rule 4 — Every workload must be BOUNDED` --semantically_similar_to--> `§16 Do not inherit performance issues; all large workloads bounded`  [INFERRED] [semantically similar]
  docs/governance/rules.md → docs/governance/behavioral.md
- `§11 Providers reached only through a port (AIProviderPort)` --rationale_for--> `Bounded context: connections`  [INFERRED]
  docs/governance/behavioral.md → docs/superpowers/specs/2026-09-22-aigate-design.md
- `§12 Router is its own business engine, not controller logic` --rationale_for--> `Bounded context: routing (core)`  [INFERRED]
  docs/governance/behavioral.md → docs/superpowers/specs/2026-09-22-aigate-design.md
- `§23 Observability per request; never log keys, tokens or secrets` --rationale_for--> `Bounded context: usage`  [INFERRED]
  docs/governance/behavioral.md → docs/superpowers/specs/2026-09-22-aigate-design.md

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

## Communities (12 total, 0 thin omitted)

### Community 0 - "M-1 Discovery Tooling"
Cohesion: 0.07
Nodes (50): docs/capabilities.md (GENERATED capability specification), docs/discovery/coverage.md, docs/discovery/gaps.md (Gap register), docs/discovery/inventory.json, §3 The 20 behavioral questions (trigger…edge cases), §8 Business rule beats old implementation, §2 Core principles — never port, rename, or translate 9router line by line, §19 Fallback as explicit policy with classified errors (+42 more)

### Community 1 - "Parity, Errors & Fallback"
Cohesion: 0.07
Nodes (38): Branding sweep to the bottom of the stack, capabilities.md — parity coverage denominator, Definition of Done — 13 items, not self-awarded, AIGate domain model (Provider, Credential, RoutingPolicy, AccountLock, …), Error taxonomy (8 ErrorCodes), IMPLEMENTATION_ACCIDENT — debt not inherited from 9router, Stated limits of tape-based parity, Parity verification — 3 tiers (+30 more)

### Community 2 - "Walking Skeleton & Ports (M1)"
Cohesion: 0.09
Nodes (37): §20 No blind fallback — fallback follows error semantics, §12 Router is its own business engine, not controller logic, §18 Streaming is first-class (TTFT, cancellation, backpressure), §13 Translator/protocol separation — canonical vs vendor formats, Canonical Internal Protocol, Canonical Internal Protocol (CIP), vendorExtensions — typed carry-through field, Bounded context: media (+29 more)

### Community 3 - "Providers & Connections (U4)"
Cohesion: 0.14
Nodes (35): §10 New architecture independent of 9router (API/Application/Domain/Ports/Infra), §9 Build an explicit domain model (Provider, Quota, RoutingPolicy…), §6 Feature Matrix requirement — nothing is understood until fully traced, §11 Providers reached only through a port (AIProviderPort), AuthFlow — declarative, data-driven auth step framework, Feature Matrix — mandatory 17-column artifact, Bounded context: catalog, Bounded context: connections (+27 more)

### Community 4 - "Overview — /"
Cohesion: 0.11
Nodes (31): Audit finding: Console shown in sidebar regardless of Developer mode, §23 Observability per request; never log keys, tokens or secrets, §21 Quota must be understood fully, not copied from the UI tracker, §22 Usage fields to trace per request (tokens, cost, latency, fallback attempts), Port law — a port exists only with a real second implementation or a mandatory I/O fake boundary, Quota provenance — vendor-reported vs self-derived, Server-side secret redaction in request details, Bounded context: usage (+23 more)

### Community 5 - "Identity, Keys & Settings (U2/U3)"
Cohesion: 0.16
Nodes (29): Audit PASS: no credential leaked across 27 HTML exports, Audit finding: settings-auth regenerated as settings-auth-v2, Audit finding: login-callback / deploy-wizard / authflow-modals are showcases, not routes, Audit FAIL: sidebar not identical across screens, §26 When the old code has a bug — label, analyse, do not auto-reproduce, §7 Trace the behavior — never conclude from a function name, The Tracing Protocol (6 steps, applied by Tasks 6–18), Hard constraint: tunnel requires 'Require API key' enabled (+21 more)

### Community 6 - "Design System & Network (U0/U9)"
Cohesion: 0.15
Nodes (28): Audit FAIL: only the happy path was drawn (state rules §10.7), Audit finding: MITM CA buttons adjacent, type-to-confirm modal missing, Minimal frontend state management, Web stack (Vite, TanStack Router/Query/Virtual, RHF+zod, Tailwind+Radix, Recharts, i18next), Bounded context: transport, Decision: do NOT clone 9Remote, Status color tokens (green/amber/red/grey), Destructive-action rule: type-to-confirm modal (+20 more)

### Community 7 - "Shell, Overview & Usage (U1/U7/U8)"
Cohesion: 0.20
Nodes (18): Audit finding: routing-fallback merged 4 tabs into one 3886px screen, New IA — 7 groups organised by user job, Critique of 9router's information architecture, Routing simulator (decision-tree dry run), Screen state conventions (loading, refetch, empty, error, live, destructive, optimistic), Metric card component, GAP: Token Saver screen missing from the U0–U11 table, Feature group: Request routing (+10 more)

### Community 8 - "Tooling & Integrations (U10)"
Cohesion: 0.25
Nodes (18): §5 Feature discovery — inventory every group, do not trust the UI menu, The 23 feature groups required by behavioral.md §5, CLI-tool config writes require diff preview + backup, Bounded context: tooling, Feature group: CLI Tools, Feature group: Console Log, Feature group — MCP (API with no UI, found during spec work), Feature group: Remote functionality (+10 more)

### Community 9 - "Foundation & Architecture (M0)"
Cohesion: 0.15
Nodes (16): 9router as Behavioral Source of Truth (not a template to port), Feature-based frontend structure with import boundaries, Hexagonal architecture, granularity = bounded context, Split: machines block mechanics, skills teach judgement, Monorepo layout (apps/server, apps/web, apps/cli, packages/engine, contracts, database, tools), Open decisions not settled by this spec, Iron law: no skill without a failing test first (RED → GREEN → REFACTOR), UI performance constraints (+8 more)

### Community 10 - "Phase Model A-F & DoD"
Cohesion: 0.18
Nodes (15): §30 The 12 pre-implementation questions, §29 Definition of Done — 13 checklist items, no self-declared DONE, §28 Per-feature process: DISCOVER→TRACE→DOCUMENT→…→REVIEW, §25 Golden scenarios (13 critical flows), Phase model A→F (Discovery, Behavior Extraction, Contract, Design, Implementation, Parity Verification), §24 Characterization/contract tests prove old ≈ new at contract level, parityStatus lifecycle (not-started → traced → contracted → implemented → verified), Constraint — no Phase C contracts during discovery (+7 more)

### Community 11 - "Lean Code Rules"
Cohesion: 0.50
Nodes (4): §15 Code quality — shortest CLEAR implementation, not shortest possible, Rule 1 — Write LEAN code, no over-engineering, Rule 2 — Code must be maintainable, no magic values or hidden side effects, Rule 12 — Priority order: Correctness → Simplicity → Maintainability → Predictable resources → Latency → Throughput → Optimization

## Ambiguous Edges - Review These
- `Token Saver — /gateway/token-saver` → `U6 — Routing & Fallback + Simulator`  [AMBIGUOUS]
  docs/superpowers/specs/2026-09-22-aigate-design.md · relation: implements
- `U6 — Routing & Fallback + Simulator` → `GAP: Token Saver screen missing from the U0–U11 table`  [AMBIGUOUS]
  docs/superpowers/specs/2026-09-22-aigate-design.md · relation: references
- `The 23 feature groups required by behavioral.md §5` → `Feature group — MCP (API with no UI, found during spec work)`  [AMBIGUOUS]
  docs/superpowers/plans/2026-09-22-m1-discovery.md · relation: conceptually_related_to

## Knowledge Gaps
- **19 isolated node(s):** `ErrorCode: INTERNAL_ERROR`, `Parity tier 2 — Vendor acceptance (PASS/FAIL)`, `Parity tier 3 — Upstream shape drift (warning only)`, `Golden scenario: normal completion`, `Golden scenario: stream completion` (+14 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Token Saver — /gateway/token-saver` and `U6 — Routing & Fallback + Simulator`?**
  _Edge tagged AMBIGUOUS (relation: implements) - confidence is low._
- **What is the exact relationship between `U6 — Routing & Fallback + Simulator` and `GAP: Token Saver screen missing from the U0–U11 table`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `The 23 feature groups required by behavioral.md §5` and `Feature group — MCP (API with no UI, found during spec work)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Milestone M-1 · Discovery` connect `M-1 Discovery Tooling` to `Parity, Errors & Fallback`, `Walking Skeleton & Ports (M1)`, `Providers & Connections (U4)`, `Overview — /`, `Identity, Keys & Settings (U2/U3)`, `Design System & Network (U0/U9)`, `Tooling & Integrations (U10)`, `Foundation & Architecture (M0)`, `Phase Model A-F & DoD`?**
  _High betweenness centrality (0.193) - this node is a cross-community bridge._
- **Why does `Bounded context: routing (core)` connect `Walking Skeleton & Ports (M1)` to `M-1 Discovery Tooling`, `Parity, Errors & Fallback`, `Providers & Connections (U4)`, `Overview — /`, `Identity, Keys & Settings (U2/U3)`, `Shell, Overview & Usage (U1/U7/U8)`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **Why does `The Tracing Protocol (6 steps, applied by Tasks 6–18)` connect `Identity, Keys & Settings (U2/U3)` to `M-1 Discovery Tooling`, `Walking Skeleton & Ports (M1)`, `Providers & Connections (U4)`, `Overview — /`, `Design System & Network (U0/U9)`, `Tooling & Integrations (U10)`, `Phase Model A-F & DoD`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Are the 17 inferred relationships involving `Bounded context: routing (core)` (e.g. with `§12 Router is its own business engine, not controller logic` and `Bounded context: media`) actually correct?**
  _`Bounded context: routing (core)` has 17 INFERRED edges - model-reasoned connections that need verification._