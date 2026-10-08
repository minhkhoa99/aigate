# Routing simulator (SP29 / M3 U6)

Status: implemented, UI wired; targeted/browser acceptance and independent
review pending. Build/lint are not runtime acceptance. Spec:
`docs/superpowers/specs/2026-10-08-sp29-routing-simulator-design.md`.
This is an AIGate extension, not reference simulator parity.

## HTTP

`POST /api/routing/simulate` uses the existing dashboard guard and requireLogin
policy. JSON `{ request: <OpenAI Chat Completions body>, tokenSaverOptOut?: boolean }`.
Only those envelope keys; opt-out defaults false. Maximum 65536 UTF-8 bytes
including whitespace/envelope, nesting 32 containers, existing chat parser
limits. Other protocols and non-chat lanes are not supported.

200/no-store returns `{ observedAt, outcome, requiredCapabilities, nodes,
warnings, truncated }`, even for a locally blocked route. Outcomes: candidate,
blocked, conditional, inconclusive. Candidate is not vendor health, credential
readability or a reserved next request. Capped reads/traversal are inconclusive.

Each node has `id`, `parentId`, `kind` (request/combo/capacity/model/account/judge),
`status` (candidate/fallback/blocked/conditional/unknown), `reason`; optional
`model`, `provider`, `connectionId`, `priority`, `lockUntil`, `errorCode`,
`missingCapabilities`, `strategy`, `order`, `trimmedMessages`, and
`fusion: { minPanel, stragglerGraceMs, panelTimeoutMs, concurrency: 4 }`.
IDs are response-local; parents precede children. Optional strings ≤256 chars.
Capability enum: vision, pdf, audioInput, videoInput, tools, reasoning.

Reasons: input-accepted, combo-fallback, combo-round-robin, fusion-panel,
fusion-judge, fusion-single-member, capacity-prepended, model-resolved,
keyless-provider, account-selected, account-fallback, account-disabled,
account-locked, route-rejected, inspection-limit.

Warnings: snapshot-not-reserved, credentials-unchecked, headroom-skipped,
pxpipe-skipped, provider-preparation-unchecked, conditional-fallback,
conditional-fusion, inspection-truncated.

Errors `{ code, message }`: 400 INVALID_REQUEST (known field/context only),
400 UNSUPPORTED_FEATURE (CIP parser refusal), 413 INVALID_REQUEST (size),
415 INVALID_REQUEST (content type), existing 401 UNAUTHENTICATED,
504 TIMEOUT with timeoutSeconds 5. Unexpected errors are sanitized. Raw
prompt/tool/media/unknown type/key values never enter output or error prose.
All endpoint errors reach inline UI via shared/errors.ts.

## Decisions, bounds and privacy

Use existing catalog/custom-prefix precedence, thinking suffix, capability
checks, combo/capacity ordering/history trimming and sticky account selection.
Undeclared/imported/custom models use the shared open-capability rule; declared
catalog capabilities remain final. Reordering prefers declared fully-capable
models before undeclared candidates (see engine.md and capacity-adapter.md).
Shared pure choices preserve live behavior; live transaction/decryption/refresh
remain at their original owners. Read-only custom node metadata never opens
sealed headers. Do not call selectActive, mutating order, byPrefix/stored,
adapter/transport/refresher, Headroom or PXPIPE.

Apply only local RTK/Caveman/Ponytail stages, honoring opt-out; skipped remote
stages and provider preparation are explicit. Hypothetical branches each use
captured state, without consuming another branch's rotation. Future vendor
failures, fusion panel answers/quorum/degradation/judge success are conditional.
Deterministic terminal client refusals stop the current chain.

At most 512 nodes, 32 inspected providers, 200 combos, 16 members per combo/
pool, four pools and three combo depth. Metadata uses 100 accounts/provider
plus overflow sentinels; lock rows are filtered to provider/model/__all and
bounded with a sentinel. No per-account query or repeated model query.
No cross-request cache, queue or retained payload. Deadline/cancellation is
checked around local reads/traversal; an in-flight SQLite read is not
interruptible. No SQL/usage/lock/rotation writes or secrets decrypted.

## UI / acceptance

Existing `/gateway/routing` Simulator tab: native ephemeral JSON draft,
opt-out, one explicit Run, localized EN/VI explanation/disclosures and precise
loading/error/Retry/stale/truncated framing. No polling/SSE/retry/locale rerun.
Mutation gcTime 0, no draft URL/storage/download/query cache; task-owned cache
and GC timers are removed after observer teardown on tab departure. Pending input
exists only until bounded settlement. IDs render literally; unknown reason
codes get generic copy plus literal code. Other Routing previews stay labeled.

Build/lint/discovery/diff and authorized targeted/native/browser acceptance
are recorded in PROGRESS_HANDOFF.md; implemented is not verified.
