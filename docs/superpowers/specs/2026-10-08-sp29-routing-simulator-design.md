# SP29 — read-only routing simulator

Status: conversational scope and written spec approved on 2026-10-08.
Implementation plan: `../plans/2026-10-08-sp29-routing-simulator.md`; user chose
Native. Server/web implementation is committed, acceptance is not complete.
Targeted/browser checks await explicit authorization; the fresh reviewer
attempt was blocked by the service usage limit. See PROGRESS_HANDOFF.md.

## Intent and baseline

Let an operator explain where a chat request could go, and why candidates
are selected or excluded, without spending tokens or changing gateway state.
The user approved a server dry-run and the existing Simulator UI, with no
vendor call, token refresh, usage write, rotation advance or new dependency.

Baseline: clean `feat/m1-discovery` at `e49ae9f`. SP26–SP28 are complete.
The original design §10.3, Routing & Fallback, prioritizes a dry-run decision
tree. The existing Simulator in `features/gateway/screens.tsx` has a sample
model, token count, inert button and hard-coded accounts. SP29 replaces that
tab, not the whole Routing page. Overview/Fallback previews remain explicitly
labeled; Combo and Capacity adapter integrations remain unchanged.

This is an AIGate extension, not a simulator port from 9router. Existing
resolution, account-selection, combo and capacity behavior is the source of
truth: `contracts/{chat-lane,multi-account,combos,capacity-adapter}.md` and
their labeled Feature Matrix entries. No reference bug is silently corrected
as part of explaining a route.

## Scope and alternatives

Implement one dashboard-session API, a bounded metadata-only explanation,
and one live tab with loading, validation, failure and partial-result states.
Input is an OpenAI Chat Completions JSON body; reuse its existing parser into
CIP. Other client protocols and media generation/search lanes are excluded
in this slice and are clearly labeled, not guessed from a pasted payload.

Choose server-side planning from current local metadata. Browser-only
planning cannot inspect model locks or rotation state. Invoking the live lane
and suppressing its final send is unsafe: `selectActive()` already deletes
expired locks, writes round-robin counters and decrypts credentials; combo
and capacity `order()` mutate process state. A new generic routing framework
is unnecessary. Share only the concrete pure decisions needed by live and
dry-run consumers, with existing repositories supplying reads or writes.

## API and trust boundary

`POST /api/routing/simulate`, protected by the existing dashboard guard.
JSON envelope: `{ request: <OpenAI Chat body>, tokenSaverOptOut?: boolean }`.
Only these envelope fields are accepted; the optional flag defaults false
and represents `x-aigate-token-saver: off`. The envelope cannot supply
headers, authentication keys, connection overrides, fake vendor outcomes or
arbitrary endpoint URLs. Media URLs inside the accepted chat body are parsed
as data only, never fetched.

- Explicit HTTP 200 and `Cache-Control: no-store` for a valid explanation,
  including a route blocked by current local configuration.
- Envelope size at most 64 KiB UTF-8, enforced before expensive parsing in
  addition to the host body limit. JSON nesting at most 32 levels, checked
  iteratively before canonical parsing. Existing parser item/model limits
  remain in force; do not create a more permissive duplicate parser.
- Malformed envelope/body: 400 `INVALID_REQUEST` with a field-specific,
  non-payload-echoing message. Parser features CIP cannot represent: 400
  `UNSUPPORTED_FEATURE`. Oversized input: 413 `INVALID_REQUEST`. Dashboard
  authentication: existing 401 `UNAUTHENTICATED`, subject to the current
  `requireLogin` policy. Non-JSON content: 415 `INVALID_REQUEST`.
- Local deadline: 5 seconds; expiration returns 504 `TIMEOUT` with
  `timeoutSeconds: 5`. Check cancellation/deadline before and after reads
  and during bounded traversal. No retry or detached work; do not claim to
  interrupt an already-running SQLite statement.
- Unexpected local failures use the existing sanitized HTTP error handling;
  never include a pasted prompt, tool arguments, media data or credentials.
  Every endpoint error reaches inline UI through `shared/errors.ts`.

Wire result:

```text
{
  observedAt: ISO UTC string,
  outcome: "candidate" | "blocked" | "conditional" | "inconclusive",
  requiredCapabilities: Capability[],
  nodes: DecisionNode[],
  warnings: string[],
  truncated: boolean
}
DecisionNode = {
  id: number, parentId: number | null,
  kind: "request" | "combo" | "capacity" | "model" | "account" | "judge",
  status: "candidate" | "fallback" | "blocked" | "conditional" | "unknown",
  reason: string,
  model?: string, provider?: string, connectionId?: string,
  priority?: number, lockUntil?: ISO UTC string,
  errorCode?: string, missingCapabilities?: Capability[],
  strategy?: "fill-first" | "round-robin" | "fallback" | "fusion",
  order?: number, trimmedMessages?: number,
  fusion?: { minPanel: number, stragglerGraceMs: number,
             panelTimeoutMs: number, concurrency: 4 }
}
```

Nodes are a flat, parent-linked, traversal-ordered tree, not a second graph
library. IDs are local to the response. Reasons/warnings are stable owned
codes resolved by the web catalog; raw IDs remain literal. Do not return
request bodies, transformed text, arbitrary extension values, credential
masks, sealed data, authorization headers, custom header values or proxy
URLs. Node metadata is an allowlist. Reasons are `input-accepted`,
`combo-fallback`, `combo-round-robin`, `fusion-panel`, `fusion-judge`,
`fusion-single-member`, `capacity-prepended`, `model-resolved`,
`keyless-provider`, `account-selected`, `account-fallback`,
`account-disabled`, `account-locked`, `route-rejected` or `inspection-limit`.
Warnings are `snapshot-not-reserved`, `credentials-unchecked`,
`headroom-skipped`, `pxpipe-skipped`, `provider-preparation-unchecked`,
`conditional-fallback`, `conditional-fusion` or `inspection-truncated`.
The runtime contract must record these before product implementation.
Unknown response reason codes get a generic explanation plus the literal
code, not a crash or guessed success. Optional scalar strings are bounded to
256 characters; capabilities use the existing six-value enum.

`candidate` means a locally eligible first dispatch, never healthy/guaranteed
success. `blocked` requires a complete deterministic pre-dispatch refusal.
Fusion/data-dependent plans are `conditional`; incomplete bounded traversal
is always `inconclusive`, even if an early candidate was found. Existing lane
codes such as `model_not_found`, `no_active_connection`, `provider_unavailable`,
`combo_too_deep` and capability failures are node explanations, not failed
management requests. Use known static messages/codes, not input excerpts.

## Planning behavior

1. Parse the accepted protocol into CIP. Apply existing local Token Saver
   stages (RTK/Caveman/Ponytail) with the original saved settings and opt-out,
   reusing `applyTokenSaver` with Headroom explicitly disabled for this call.
   Never call Headroom or load/invoke PXPIPE. Show a skipped-stage warning
   when either enabled stage could apply. Request data stays call-local;
   report only capability/trim counts, not transformed contents. Remote
   transformations and provider-specific preparation are not certified.
2. Resolve combo precedence, built-in provider IDs/aliases, custom-prefix
   precedence, bare model IDs and thinking suffixes using the same pure
   decision as the live lane. Keep unknown/custom-model capability floors
   and catalog limits. No provider discovery, DNS/media fetch or probing.
3. Reuse `detectRequiredCapabilities`, `modelFit`, `widen`,
   `reorderByCapabilities`, `trimHistory` and `assertModelSupports` where the
   live lane uses them. Preserve original per-branch requests: a pool member
   may trim history before its own resolution. Capability tier ordering is
   not a guarantee that a candidate's runtime check passes.
4. Peek combo and solo-capacity rotations through pure `rotate()` using a
   copied current state. Never call mutating `order()`. Keep sticky limits,
   saved order, pool deduplication and the existing three-combo depth bound.
   Cycles/depth refusals are visible. Nested combo members do not acquire
   solo widening that the live path would not perform.
5. Read only account metadata needed for the referenced providers: stable
   IDs, active flag, priority, last-used/count and applicable model/`__all`
   locks. Reuse the live account choice as a pure decision, with live writes
   remaining at their current owner. Ignore expired locks using the same
   expiry boundary, without deleting them. Test status/OAuth expiry may be
   cautions but must not become new exclusion rules. Do not decrypt even the
   predicted selected account: credential readability and refresh outcome
   are explicitly unchecked. Keyless providers need no fictitious account.
6. Explain the first eligible account and conditional fallback alternatives;
   no fabricated failure, lock insertion, sleep or vendor retry is executed.
   Account fallback and combo member fallback have different conditions;
   preserve the existing classifications and the no-fallback-after-commit
   boundary. Do not label all subsequent members certain to execute.
7. Fusion with one member uses the existing plain-call behavior. Otherwise
   show its panel plans using `panelRequest`, the fixed four-call ceiling,
   configured quorum/grace/hard timeout, conditional judge/default model and
   zero/one-answer degradation. Generated answers and the eventual winner
   are unknown; neither panel nor judge runs. Account choices in parallel
   branches are conditional because dispatch scheduling can change rotation.

Each hypothetical fallback branch starts from the captured selection state;
it does not simulate failures or consume rotations from another hypothetical
branch. Explain this in the UI. A live request can change state during or
after capture. `observedAt` timestamps the inspection; it is not an atomic
cross-repository version or a promise to reserve the next request.

## Bounded reads and lifecycle

- Retain current storage ceilings: 200 combos, 16 members per combo/pool,
  four capacity pools, three nested combos, 100 accounts per provider.
- Cap the explanation at 512 total nodes (accounts included) and 32 distinct
  inspected providers. Stop before expanding beyond either cap and return
  `truncated: true` with an owned explanation. Do not inspect the full
  16-to-the-third branch product before truncating its output.
- Query narrow projections with explicit LIMITs. Detect truncated source
  reads; missing data from a capped/global list is not proof of no active
  account. Inspect referenced providers only, reuse their call-local results
  and batch applicable lock reads. No query per displayed account or repeated
  query per repeated model. No all-provider credential/lock dump.
- No process-wide cache, queue, background task or generic snapshot store.
  Repository caches already owned by routing remain unchanged; per-call
  memoization ends with the request. No network I/O in a transaction.
- Body/tree bounds cap memory and work; the deadline is an additional bound,
  not a substitute for them. No dynamic unbounded `Promise.all`.
- No SQL writes, cleanup of lock rows, refresh/test state changes, rotation
  mutation, provider transport, usage events/requests or console payload
  logging attributable to a simulation. Normal management authentication
  remains unchanged. Request bodies must not be added to access logs.

## Web integration

Keep `/gateway/routing` and its existing tabs/layout. Replace only the
Simulator sample panels with a native JSON textarea, explicit OpenAI Chat
format/example, Token Saver opt-out checkbox and Run simulation button.
Remove the unrelated input-token field and sample expected accounts.

Use existing `features/gateway/api.ts`, same-origin client and one user-driven
mutation with retries disabled. No polling, SSE or automatic rerun. One run
at a time; retain draft on error. Editing after a result marks it stale and
requires Run again; stale results are never presented as current. No draft
in URL, localStorage, downloads or query cache. Use mutation `gcTime: 0` so
unobserved request variables/results do not remain in the default mutation
cache after settlement/unmount; no delayed toast/state update after unmount.
A pending call keeps only bounded input until settlement/deadline. This does
not promise secure erasure of JavaScript memory.

Render reasons and parent-child branches with semantic nested lists/native
disclosure where helpful, bounded by the server response. Show observed time,
conditional/skipped-stage/truncation warnings and readable raw identifiers.
Include loading, actionable inline error/Retry, blocked and empty states.
Do not hide blocked branches behind a generic failure toast.

New Simulator-owned copy/labels/reasons use the existing EN/VI catalogs;
locale changes only presentation, never requests or textarea content. Other
Routing tab copy remains English. Preserve tab business keys, literal IDs,
keyboard access and wrapping at 1440/929/390px. No new UI/graph dependency.

## Acceptance and delivery

Implementation must add `docs/contracts/routing-simulator.md`, its API↔UI
row and an AIGate-extension matrix entry with local-spec evidence, then
update handoff/CLAUDE and refresh the existing graph after fixture removal.
Read `writing-lean-bounded-code` before product code and
`porting-behavior-not-code` if touching reference-derived decisions. Preserve
existing labeled deviations; sharing rules must not silently alter routing.

Planned targeted checks (run only after explicit user authorization):

- Parser/size/depth/auth/no-store/status/error boundaries; direct aliases,
  custom prefixes, bare IDs, thinking suffixes, keyless and unknown models.
- Fill-first, sticky round-robin, model/account-wide locks, expired locks,
  disabled accounts, all locked/no active accounts and unchecked credentials.
- Combo precedence/order/nesting/cycles, pool widening/rotation/deduplication,
  capability refusal and per-member trim counts; fusion conditional paths.
- Golden comparisons of shared pure live/dry-run decisions under fixed
  time/state. Existing routing/selection tests protect live behavior.
- Repeated simulation leaves account rows/locks, combo/pool rotation state,
  usage records and transport counters unchanged. Seed expired locks too,
  so a mistaken call to `selectActive()` fails this check. Synthetic secrets,
  prompts, tool arguments and media URLs must not appear in output/logs.
- Node/provider/source caps and cancellation/deadline are exercised, with
  inconclusive output instead of a false blocked/selected conclusion.
- Isolated browser acceptance: actual synthetic backend, no vendor calls,
  JSON draft/error/Retry/staleness, no rerun on locale selection, conditional
  tree/truncation and narrow-screen/keyboard behavior. Not a full-site audit.

Build/lint/discovery/diff checks are required in implementation; no broad
test suite, provider traffic, install/upgrade, migration, remote push or OS
mutation is included. The current stage only creates/reviews/checkpoints
this spec and handoff. Written-spec approval permits planning, not starting
product implementation.
