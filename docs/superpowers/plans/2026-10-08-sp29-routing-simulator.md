# SP29 Routing Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sample Simulator tab with a bounded server explanation
of chat model/combo/capacity/account selection, without executing a request.

**Architecture:** Reuse concrete pure live-routing decisions, and add narrow
read-only repository projections/rotation peeks. A routing-owned planner
builds an allowlisted parent-linked tree; one authenticated controller and
one existing-dashboard tab expose it. Keep live I/O and mutations at their
current owners, not behind a generic routing framework.

**Tech Stack:** Existing TypeScript, NestJS/Fastify, Drizzle/SQLite, React,
TanStack Query, static EN/VI catalogs, Node test runner and discovery Vitest.

**Spec:** `docs/superpowers/specs/2026-10-08-sp29-routing-simulator-design.md`

Status: spec/plan approved on 2026-10-08; user selected Native. Tasks 1–4 are
implemented and committed; Task 5 acceptance is still open. Targeted/browser
authorization is pending; one fresh review attempt failed on service usage
limit. Checklists below retain planned steps, not claims of executed tests.
Planning baseline: clean `feat/m1-discovery` at `c87c0c8`; execution base `1a79f15`.

## Global Constraints

- `POST /api/routing/simulate`; existing dashboard guard/`requireLogin` policy.
- JSON envelope `{ request: <OpenAI Chat body>, tokenSaverOptOut?: boolean }`;
  optional flag defaults false; no other client protocol/lane in this slice.
- `64 KiB UTF-8`; JSON nesting `32` levels; local deadline `5 seconds`.
- `512 total nodes (accounts included)`; `32 distinct inspected providers`.
- Existing ceilings: `200 combos`, `16 members per combo/pool`, `four capacity
  pools`, `three nested combos`, `100 accounts per provider`.
- HTTP `200` / `Cache-Control: no-store` for explanations, including blocked
  routes; malformed 400, oversized 413, non-JSON 415 `INVALID_REQUEST`;
  parser feature refusal 400 `UNSUPPORTED_FEATURE`; deadline 504 `TIMEOUT`.
- No provider/Headroom/PXPIPE execution, decryption, token refresh, usage
  write, lock cleanup/write or combo/pool/account rotation advance.
- New Simulator copy uses existing EN/VI; raw IDs stay literal; no request
  rerun on locale change. Other Routing previews remain labeled.
- Mutation `gcTime: 0`, retries disabled; one user-driven request at a time.
  No prompt draft in URLs/localStorage/query cache/downloads/logs.
- No dependency, migration, generic graph/store/cache/queue, install/upgrade,
  OS mutation, remote push or broad `pnpm test`.
- Read both repo skills before product work. Existing labeled deviations
  remain unchanged. An uncovered suspected bug must be recorded/held, not
  silently copied or fixed during the extraction.
- Run targeted tests/browser only after explicit SP29 authorization. Build,
  lint, discovery validation and diff checks are allowed project gates.
- Preserve user changes/index. Stage exact task files only. If normal git
  writes fail, retain files and report the actual `.git` blocker.

Commands in task steps use `pnpm --filter @aigate/server build` for “server
build”, `pnpm web:build` for “web build”, `pnpm lint` for lint, and
`pnpm discovery validate` for discovery validation. All commands run from
`D:/aigate` in PowerShell. New server/web test files must be added explicitly
to their existing package test scripts so subsequent CI does not omit them;
this does not authorize running those broader scripts in this SP.

## Review Focus

1. A custom provider with encrypted headers must be inspectable without
   calling `byPrefix()`/`nodeDescriptor()` and decrypting them (Task 1/3).
2. More than 100 global active rows or duplicate lock rows must not produce
   a confident false “no account”; capped sources are inconclusive (Task 1/2).
3. A catalog model's deterministic INVALID_REQUEST (e.g. output-token limit)
   terminates a chain; a later eligible member must not imply success (Task 2).
4. Editing during an in-flight run must not relabel its response as belonging
   to the edited draft; unmount must not retain settled payloads (Task 4).
5. Unknown reason codes and hostile-looking literal IDs must not crash,
   become translated identifiers or execute markup (Task 4/5).

Each focus has a concrete check below; reviewers must not treat the spec's
silence about an input as permission for that input to break the workflow.

## File responsibilities and interfaces

Create only the named units that serve actual consumers:

| File | Responsibility |
|---|---|
| `connections/domain/account-selection.ts` | Pure fill-first/sticky choice over already eligible metadata |
| `routing/domain/model-resolution.ts` | Shared model target/known refusal, no credentials or I/O |
| `routing/domain/routing-simulator.ts` | Wire types/codes/constants and input envelope/depth validation |
| `routing/infrastructure/routing-simulator.ts` | Concrete planner and call-local bounded reads/traversal |
| `routing/infrastructure/routing-simulator.controller.ts` | Management HTTP/deadline/cancellation/error boundary |
| `web/src/features/gateway/routing-simulator.tsx` | Draft/run/result/staleness/tree rendering |
| `web/src/features/gateway/simulation-result.ts` | Web wire types, owned reason-key lookup, parent adjacency |

Server paths above are under `apps/server/src/modules/`; web paths under
`apps/`. Keep controller under the existing 200-nonblank-line lint ceiling.
Do not split unrelated live lane/media code. There is no new engine package
dependency or cross-feature web import.

Exact shared interfaces to establish in Tasks 1/2:

```ts
// connections/domain/account-selection.ts
export interface AccountCandidate {
  id: string; priority: number;
  lastUsedAt: Date | null; consecutiveUseCount: number;
}
export function chooseAccount<T extends AccountCandidate>(
  available: readonly T[], strategy: "fill-first" | "round-robin",
): { account: T; nextUseCount: number | null } | undefined;

// routing/domain/model-resolution.ts
export type ModelResolution =
  | { ok: true; providerId: string; modelId: string; catalogModelId: string }
  | { ok: false; status: number; type: string; code: string; message: string };
export function resolveModelTarget(
  ref: string, prefixedProviderId: string | undefined,
  active: ReadonlySet<string>,
): ModelResolution;
```

`resolveModelTarget` owns bare-ID catalog ordering, empty/unknown target,
thinking-suffix catalog key and no-active declared-provider refusal. Keep
prefix discovery at the existing I/O boundary; both callers apply the same
built-in/status/reserved-prefix rules before supplying `prefixedProviderId`.
Return the existing live error prose in the shared result, but serialize
only its code into simulator nodes. Live still obtains its complete provider
descriptor and calls `assertModelSupports`/credential/proxy handling as now.

```ts
// Existing repositories; narrow projection names must match these.
type RoutingAccount = AccountCandidate & { isActive: boolean };
type RoutingLock = { connectionId: string; model: string; until: Date };
type RoutingNode = { id: string; type: "openai-compatible" |
  "anthropic-compatible"; prefix: string };
type BoundedRows<T> = { rows: T[]; truncated: boolean };

ConnectionsRepository.routingActivity():
  Promise<{ providers: Set<string>; truncated: boolean }>;
ConnectionsRepository.routingAccounts(provider: string):
  Promise<BoundedRows<RoutingAccount>>;
ConnectionsRepository.routingLocks(provider: string, model: string, now: Date):
  Promise<BoundedRows<RoutingLock>>;
ProviderNodesRepository.routingNodeByPrefix(prefix: string):
  Promise<RoutingNode | undefined>;
CombosRepository.peekOrder(combo: Combo, stickyLimit: number): readonly string[];
CapacityPoolsRepository.peekOrder(capability: CapacityCapability,
  models: readonly string[]): readonly string[];
```

Export projection types from their owning repository modules, reusing
`AccountCandidate`; these are real result types, not one-implementation ports.
`routingActivity()` mirrors the current global active-row read with a 101st
sentinel; first 100 rows define the observed set, truncation is explicit.
Include built-in keyless providers at the caller as the live lane does.
Account reads use 101-row sentinels per provider. Lock reads batch all
matching accounts for a provider/model plus `__all`, with a 201-row sentinel;
overflow is unknown, never a silently incomplete eligibility calculation.
Use the same strict expiry boundary as live cleanup (`until < now` expires).

## Task 1: Contracted shared decisions and read-only inspection

**Files:** Create `docs/contracts/routing-simulator.md`, the two domain
decision files above and `apps/server/test/routing-decisions.test.mjs`.
Modify the five existing repositories named above, `chat-lane.ts`,
`docs/discovery/feature-matrix/05-request-routing-fallback.yaml`,
`tools/discovery/src/{paths,validate}.ts`,
`tools/discovery/test/{paths,validate}.test.ts`, and server package test script.
Tests use existing `helpers.mjs`, `lane-helpers.mjs` and built `dist` imports.

**Interfaces:** Produces the exact choice/resolution/projection/peek contracts
above; consumes current `rotate`, registry, model suffix and DB schema.

- [ ] Record the wire contract and owned codes from the approved spec before
  product code. Add `routing.simulator-dry-run` as a local AIGate extension:
  `labels: []` (schema supports this; do not invent reference behavior),
  business-rule prose prefixed `AIGATE_EXTENSION`, `newModule: routing`,
  `parityStatus: contracted`, no persistence/provider interaction. Use
  `aigate:docs/superpowers/specs/2026-10-08-sp29-routing-simulator-design.md`
  evidence with real current line numbers. Link dependencies to existing
  IDs `routing.model-resolution`, `routing.combo-dispatch`,
  `routing.capacity-adapter-solo`, `account.select-fill-first-default`,
  `account.select-round-robin-sticky`, `account.select-locked-and-excluded-filter`,
  `combo.mode-fallback`, `combo.mode-round-robin`,
  `combo.mode-fusion-panel-completion`, `capacity.augment-models-priority-prepend`.
- [ ] Add the minimal local-evidence resolver and its checks. Existing
  `resolveRef` remains reference-only; only the new explicit `aigate:` scheme
  permits a repo-relative path. Reject absolute suffixes and root escapes.
  Make validator line-count/errors use it; do not change label/schema enums.

```ts
// tools/discovery/src/paths.ts; import isAbsolute from node:path.
export function resolveEvidence(path: string): string {
  if (!path.startsWith("aigate:")) return resolveRef(path);
  const relative = path.slice("aigate:".length);
  if (!relative || isAbsolute(relative)) throw new Error("Evidence escapes AIGate root");
  const full = resolve(REPO_ROOT, relative);
  if (!full.startsWith(REPO_ROOT + sep)) throw new Error("Evidence escapes AIGate root");
  return full;
}
// Add to paths.test.ts, importing resolveEvidence:
expect(resolveEvidence("aigate:docs/PROGRESS_HANDOFF.md"))
  .toBe(`${REPO_ROOT}${sep}docs${sep}PROGRESS_HANDOFF.md`);
for (const path of ["aigate:../outside", "aigate:/outside", "aigate:C:/outside", "aigate:"])
  expect(() => resolveEvidence(path)).toThrow();
// validate.test.ts: reuse entry() and temp-dir setup already in that file.
writeFileSync(join(dir, "a.yaml"), JSON.stringify([entry({
  evidence: [{ file: "aigate:docs/PROGRESS_HANDOFF.md", line: 1, note: "local contract" }],
})]));
expect(validateMatrix(dir).ok).toBe(true);
```

- [ ] Write failing pure-choice tests and live equivalence checks, then run
  the narrow commands below if authorized. For a new test file that imports
  dist, build server first; a missing export must be the observed RED cause,
  not an unrelated stale compilation/import failure.

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseAccount } from "../dist/modules/connections/domain/account-selection.js";
test("choice preserves sticky three-use policy without modifying metadata", () => {
  const rows = [
    { id: "a", priority: 1, lastUsedAt: new Date(2000), consecutiveUseCount: 2 },
    { id: "b", priority: 2, lastUsedAt: new Date(1000), consecutiveUseCount: 0 },
  ];
  const before = structuredClone(rows);
  assert.equal(chooseAccount(rows, "fill-first").account.id, "a");
  assert.deepEqual(chooseAccount(rows, "round-robin"), { account: rows[0], nextUseCount: 3 });
  assert.deepEqual(rows, before);
  rows[0].consecutiveUseCount = 3;
  assert.equal(chooseAccount(rows, "round-robin").account.id, "b");
  assert.equal(chooseAccount([], "fill-first"), undefined);
});
```

- [ ] Extract only the live choice over eligible rows. Preserve lock filtering,
  transaction scope, decryption and round-robin update in `selectActive`.
  Implement the concrete pure choice without new policy/configuration:

```ts
if (!available.length) return undefined;
if (strategy === "fill-first") return { account: available[0], nextUseCount: null };
const recent = [...available].sort((a, b) =>
  (b.lastUsedAt?.getTime() ?? -1) - (a.lastUsedAt?.getTime() ?? -1) || a.priority - b.priority)[0];
const account = recent.lastUsedAt && recent.consecutiveUseCount < 3 ? recent
  : [...available].sort((a, b) =>
    (a.lastUsedAt?.getTime() ?? -1) - (b.lastUsedAt?.getTime() ?? -1) || a.priority - b.priority)[0];
return { account, nextUseCount: account.id === recent.id && recent.lastUsedAt
  ? recent.consecutiveUseCount + 1 : 1 };
```

- [ ] Extract `resolveModelTarget` from the current `ChatLane.resolve` portion
  between model-ID parsing and `upstream` creation. Keep its exact existing
  statuses/prose and provider catalog order; live converts its refusal to the
  existing `GatewayError`. Simulator uses only the approved error code.
  Pin `openai/gpt-4.1`, a registry-selected alias, a declared bare ID, an
  unknown slash-containing ID, custom `providerId`, empty model and thinking
  suffix. Alias fixture selection is explicit, not assumed shorthand:

```js
const providerWithAlias = builtinRegistry.providers.find(p => p.aliases.length > 0 && p.models.length > 0);
assert.ok(providerWithAlias);
const ref = `${providerWithAlias.aliases[0]}/${providerWithAlias.models[0].id}`;
const prefixed = builtinRegistry.provider(ref.slice(0, ref.indexOf("/")));
assert.equal(resolveModelTarget(ref, prefixed.id, new Set([prefixed.id])).providerId, prefixed.id);
```
- [ ] Add narrow read projections and pure rotation peeks. Do not reuse
  `ProviderNodesRepository.byPrefix`/`stored`/`list`: these can open headers.
  Prefix metadata lookup keeps the same OpenAI-first, oldest-first ordering.
  Account projections never select `secret` or hints/URL/email/header fields.
  Locks are SELECT-only with bounded batched account membership; no DELETE.

```ts
// CombosRepository; this produces the current order, not the next state.
peekOrder(combo: Combo, stickyLimit: number): readonly string[] {
  return rotate(combo.models, this.rotations.get(combo.id), stickyLimit).order;
}
// CapacityPoolsRepository.
peekOrder(capability: CapacityCapability, models: readonly string[]): readonly string[] {
  return rotate(models, this.rotations.get(capability), 1).order;
}
```

- [ ] Add metadata tests against a reopened DB with a different secret key,
  including a custom node with sealed headers; reads/peeks work without
  decrypting. Seed expired/model/`__all`/duplicate locks and 101 active global
  rows across providers. Assert sentinels and no row changes; compare peek
  before/after repeated reads, then one actual order call advances once.
- [ ] Run (only authorized targeted tests): server build, then
  `node --test --test-timeout=30000 apps/server/test/routing-decisions.test.mjs apps/server/test/chat-lane.test.mjs apps/server/test/combos.test.mjs apps/server/test/capacity.test.mjs`;
  `pnpm --filter @aigate/discovery exec vitest run test/paths.test.ts test/validate.test.ts`.
  Run discovery validate and diff check; commit exact Task 1 files as
  `refactor: share routing choices and add read-only inspection`.

## Task 2: Bounded decision planner

**Files:** Create `apps/server/src/modules/routing/domain/routing-simulator.ts`,
`apps/server/src/modules/routing/infrastructure/routing-simulator.ts`,
`apps/server/test/routing-simulator-planner.test.mjs`.
Modify `routing.module.ts` provider registration and contract if clarifying
non-policy details; server test script adds the new targeted file.

**Interfaces:** Consumes Task 1 repository methods and existing settings,
combos, pools, registry/capability/token-saver pure helpers. Produces:

```ts
// Types/codes match the approved spec verbatim, including fusion metadata.
export const SIMULATION_BODY_BYTES = 64 * 1024;
export const SIMULATION_DEPTH = 32;
export const SIMULATION_NODES = 512;
export const SIMULATION_PROVIDERS = 32;
export const SIMULATION_DEADLINE_MS = 5_000;
export interface SimulationInput { request: CanonicalRequest; tokenSaverOptOut: boolean }
export function parseSimulationInput(input: unknown): SimulationInput;
// Injectable concrete orchestrator, not a generic graph service.
RoutingSimulator.explain(input: SimulationInput, signal: AbortSignal,
  observedAt?: Date): Promise<SimulationResult>;
```

Define/export `DecisionNode`, `SimulationResult`, reason/warning union types
and constants together in the domain file using the spec's complete wire
shape. `observedAt` defaults once to `new Date()`; fixed-time tests supply it.
The HTTP owner supplies the deadline signal; no planner-owned timer.

- [ ] Write a first failing planner test using the existing temp boot and
  `app.get(RoutingSimulator)` after registration, with `parseSimulationInput`
  from built dist. This is local inspection, no simulated transport answers:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { fakeUpstream, ready, hello } from "./lane-helpers.mjs";
import { RoutingSimulator } from "../dist/modules/routing/infrastructure/routing-simulator.js";
import { parseSimulationInput } from "../dist/modules/routing/domain/routing-simulator.js";
test("direct plan leaves transport and rotations unchanged", () => withTempDb(async file => {
  const upstream = fakeUpstream();
  const { app, connection } = await ready(file, upstream);
  try {
    const planner = app.get(RoutingSimulator);
    const input = parseSimulationInput({ request: { ...hello, model: "openai/gpt-4.1" } });
    const first = await planner.explain(input, new AbortController().signal);
    const selected = first.nodes.find(n => n.reason === "account-selected");
    assert.equal(first.outcome, "candidate");
    assert.equal(selected.connectionId, connection.id);
    assert.equal(upstream.calls.length, 0);
    const second = await planner.explain(input, new AbortController().signal);
    assert.deepEqual(second.nodes, first.nodes);
  } finally { await app.close(); }
}));
```

- [ ] Implement envelope/depth validation before `parseOpenAIChatRequest`.
  Iterate an explicit stack; count container nesting, reject depth 33. Known
  envelope keys and boolean opt-out only. Use typed `EngineError` for invalid
  fields, preserve existing parser limits and `UnsupportedFeatureError`.
  Never put raw unknown keys/types into HTTP prose; Task 3 sanitizes errors.
- [ ] Implement `explain` with call-local maps keyed by provider, provider+
  model, prefix and combo ID. Fetch settings/combos/pools/activity once with
  an explicit literal `Promise.all` if independent. Include keyless activity.
  Follow only encountered branches. Before every read/visit and after await,
  `signal.throwIfAborted()`; stop traversal at node/provider/source caps.
  No network/credential/refresher/usage/proxy dependencies on this class.
- [ ] Apply local Token Saver stages with `{ ...settings, headroomEnabled: false }`,
  passing an unreachable throwing Headroom callback and the same signal;
  record skipped-stage warnings from original settings/opt-out and
  `headroomInput`. Do not use text results or input values as node metadata.
- [ ] Implement direct and conditional fallback planning in the same order
  as `route`/`adapted`/`member`. Call `peekOrder`, `widen`, stable capability
  sort and `trimHistory` only in their original positions. Resolve each
  target via shared helper; assert capabilities using stripped catalog key.
  Catch only known routing/engine refusals for `route-rejected`; unexpected
  failures propagate. Use `toOpenAIError` to classify known engine refusals
  and `memberFailover(status, message)` locally, never serialize raw messages.
  A deterministic terminal client refusal stops the current chain; blocked
  recoverable members may lead to later candidates. Future vendor errors
  leave alternatives conditional, not certain executions.
- [ ] Use an append guard that stops work, not merely output serialization:

```ts
const append = (node: Omit<DecisionNode, "id">): number | undefined => {
  signal.throwIfAborted();
  if (nodes.length >= SIMULATION_NODES) { truncated = true; return undefined; }
  const id = nodes.length;
  nodes.push({ ...node, id });
  return id;
};
// Every caller checks undefined (id 0 is valid) before expanding children.
// If truncated, outcome is inconclusive regardless of an earlier candidate.
```

- [ ] Inspect accounts only for admitted providers, combining active/expired
  lock filtering with the shared `chooseAccount` over eligible rows. Emit
  disabled/locked/selected/conditional alternatives in priority order; no
  token-expiry/test-status exclusion. `lockUntil` denotes the latest
  applicable live lock for that account, not a reserved retry promise; do
  not refactor live `Retry-After` calculation in this task. Incomplete rows
  suppress confident choice/refusal and set inconclusive/truncated.
- [ ] Implement fusion metadata and branch plans with `panelRequest`, no
  widening of fusion. One member delegates to plain routing. More members
  show conditional panel/judge and zero/one-answer degradation. Generated
  judge request contents/success/quorum are unknown. Independent hypothetical
  branches never consume each other's state. Always warn snapshot-not-reserved,
  credentials-unchecked and provider-preparation-unchecked as applicable.
- [ ] Add assertions for fixed-time lock boundaries, capabilities in earlier
  turns/tool results, tool stripping in fusion, pool deduplication/rotation,
  trim count, nested cycles/depth, keyless, custom unknown floors, terminal
  max-output refusal, all-blocked and partial source/node/provider limits.

```js
test("catalog output limit refuses before dispatch", () => withTempDb(async file => {
  const upstream = fakeUpstream();
  const { app } = await ready(file, upstream);
  try {
    const refused = parseSimulationInput({ request: {
      model: "openai/gpt-4.1", messages: hello.messages, max_tokens: 1_000_000,
    } });
    const result = await app.get(RoutingSimulator).explain(refused, new AbortController().signal, new Date(0));
    assert.equal(result.outcome, "blocked");
    assert.ok(result.nodes.some(n => n.reason === "route-rejected"));
    assert.equal(upstream.calls.length, 0);
  } finally { await app.close(); }
}));
// Also seed a combo with this first member and a second locally eligible
// member; terminal INVALID_REQUEST must prevent a claimed winning second hop.
```

- [ ] Run server build and
  `node --test --test-timeout=30000 apps/server/test/routing-decisions.test.mjs apps/server/test/routing-simulator-planner.test.mjs apps/server/test/token-saver.test.mjs`
  when authorized. Check exact output-field allowlist and deep comparison of
  seeded metadata before/after repeated plans; commit as
  `feat: add bounded read-only routing planner`.

## Task 3: Protected HTTP boundary and no-side-effect contract

**Files:** Create `apps/server/src/modules/routing/infrastructure/routing-simulator.controller.ts`
and `apps/server/test/routing-simulator.test.mjs`. Modify `server.ts`,
`routing.module.ts`, server test script, contract and API↔UI planned row.

**Interfaces:** Consumes `parseSimulationInput`, `RoutingSimulator.explain`
and constants from Task 2. Produces the spec's single POST endpoint; it is
not Public and never invokes `ChatLane.probe` or `serve`.

- [ ] Write the first failing authenticated endpoint/no-store test. Use the
  existing synthetic setup; no real keys or vendor expectations:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { fakeUpstream, ready, hello } from "./lane-helpers.mjs";
test("management simulation is protected and writes no traffic", () => withTempDb(async file => {
  const upstream = fakeUpstream();
  const { app, call, dash } = await ready(file, upstream);
  try {
    const url = "/api/routing/simulate", body = { request: hello };
    assert.equal((await call({ method: "POST", url, body })).statusCode, 401);
    const res = await dash({ method: "POST", url, body });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.headers["cache-control"], "no-store");
    assert.equal(res.json().outcome, "candidate");
    assert.equal(upstream.calls.length, 0);
  } finally { await app.close(); }
}));
```

- [ ] Register a thin Nest controller with `@Post("simulate")`, explicit
  `@HttpCode(HttpStatus.OK)` and no-store. Reuse the existing clearable
  `deadline()` from `chat-lane.ts` with 5000ms, combined with client-close
  signal. Clear its timer/remove the close listener in finally; skip writing
  response for a departed client. Do not start an orphan Promise.race job.
  Already-running SQLite work cannot be interrupted; classify expiration
  after the awaited read, before any additional traversal.
- [ ] Add one URL-specific `onRoute` hook before app init to enforce raw
  `bodyLimit` and map Fastify malformed JSON/oversize errors. Do not use
  `@RouteConfig({ bodyLimit })`: installed Nest puts it inside Fastify
  `config`, not the top-level route option. Do not change global/v1 limits.

```ts
fastify.addHook("onRoute", options => {
  if (options.url !== "/api/routing/simulate" || options.method !== "POST") return;
  options.bodyLimit = SIMULATION_BODY_BYTES;
  options.errorHandler = (error, _request, reply) => {
    reply.header("cache-control", "no-store");
    if (error.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
      return reply.code(413).send({ code: "INVALID_REQUEST", message: "Simulation JSON must be at most 64 KiB." });
    }
    if (error.code === "FST_ERR_CTP_INVALID_JSON_BODY" || error.code === "FST_ERR_CTP_EMPTY_JSON_BODY") {
      return reply.code(400).send({ code: "INVALID_REQUEST", message: "Send a valid simulation JSON object." });
    }
    if (error.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
      return reply.code(415).send({ code: "INVALID_REQUEST", message: "Send simulation input as application/json." });
    }
    throw error; // Parent Nest/Fastify error handling owns other failures.
  };
});
```

- [ ] Reject non-JSON explicitly with 415 INVALID_REQUEST; map parser
  unsupported features to static `UNSUPPORTED_FEATURE` prose. For invalid
  fields, allow only known param paths (model/messages/tools and numeric
  indices, max_tokens/etc.) as message context. Never return raw error
  messages containing unknown part types, tool names or payload snippets.
  Map the budget's existing EngineError TIMEOUT (without reflecting its raw
  message) to `{ code: "TIMEOUT", timeoutSeconds: 5 }`.
- [ ] Add raw-byte 65536/65537 and multibyte/whitespace/chunked payload cases,
  depth 32/33, malformed JSON, non-JSON, unknown envelope keys, wrong opt-out,
  unsupported protocol/part, blocked model and synthetic sensitive input
  tests. Verify content-type/status/no-store/errors precisely; no accidental
  Nest 201 or raw Fastify/engine message leaks.
- [ ] Snapshot relevant tables through `app.get(DATABASE).db`: connection
  timestamps/counts/sealed bytes, locks including expired rows, settings,
  usage events/requests. Use explicit columns and LIMIT in fixture helpers.
  Repeat simulation under round-robin, combo, pool and sealed-header node;
  compare persisted state and peek order, then make one scripted live call
  to prove the same next account/member still wins. Close in finally.
- [ ] Test an already-aborted planner signal and a gated local read that
  crosses the deadline; no new reads occur afterward, HTTP timeout is precise.
  Use a real loopback socket for client-close acceptance; inspect listener
  cleanup and no post-close writes without claiming SQLite interruption.
- [ ] Run server build, then authorized
  `node --test --test-timeout=30000 apps/server/test/routing-simulator.test.mjs apps/server/test/chat-lane.test.mjs apps/server/test/combos.test.mjs apps/server/test/capacity.test.mjs apps/server/test/provider-nodes.test.mjs`.
  Commit `feat: expose protected routing simulation endpoint`. API row stays
  waiting for UI, not “done”, until Task 4 lands.

## Task 4: Live Simulator tab, owned EN/VI and draft lifecycle

**Files:** Create `apps/web/src/features/gateway/{routing-simulator.tsx,simulation-result.ts,simulation-result.test.mjs}`.
Modify gateway `api.ts`, `screens.tsx`, `shared/errors.ts`,
`shared/errors.test.mjs`, `shared/locales/{en,vi}.json`, web package test script,
`styles.css` only for scoped necessary wrapping, and API↔UI map.

**Interfaces:** Web `SimulationResult`/`DecisionNode` copy the HTTP contract
(no import from server/features). Add `useRoutingSimulation()` to gateway
api with `{ request: unknown; tokenSaverOptOut: boolean }` variables and the
spec's response. `RoutingSimulatorTab()` is rendered only for tab Simulator.
Export pure `reasonMessageKey(reason: string): MessageKey` and
`simulationChildren(nodes: readonly DecisionNode[]): Map<number | null, DecisionNode[]>`
from `simulation-result.ts`; unknown codes map to `simulator.reasonUnknown`.
Export `SimulationResultView({ result, stale }: { result: SimulationResult;
stale: boolean })` from the TSX file for actual render checks; it is also the
tab's result view, not a production-only test component.

- [ ] Add failing pure view tests, including unknown codes/literal identifiers.
  Use Node's existing TS support for the .ts helper and the already installed
  Vite SSR path from `i18n.test.mjs` for TSX; no new renderer/test dependency.

```js
import assert from "node:assert/strict";
import { reasonMessageKey, simulationChildren } from "./simulation-result.ts";
assert.equal(reasonMessageKey("account-selected"), "simulator.reasonAccountSelected");
assert.equal(reasonMessageKey("__proto__"), "simulator.reasonUnknown");
const raw = "raw-model/x <tag>";
const nodes = [{ id: 0, parentId: null, kind: "model", status: "candidate",
  reason: "model-resolved", model: raw }];
assert.equal(simulationChildren(nodes).get(null)[0].model, raw);
// SSR the actual result component/providers in EN/VI; raw appears escaped,
// owned reason changes, unknown reason remains visible as literal code.
```

- [ ] Implement the one-shot mutation, with no success toast or automatic
  rerun/invalidation. Existing client deadline is 10s; server owns its 5s.

```ts
export const useRoutingSimulation = () => useMutation({
  mutationFn: (body: { request: unknown; tokenSaverOptOut: boolean }) =>
    api<SimulationResult>("/api/routing/simulate", { method: "POST", body }),
  retry: false, gcTime: 0,
});
```

- [ ] Implement native textarea/sample JSON/opt-out/Run. Validate UTF-8
  envelope size before POST using `TextEncoder`; JSON syntax failure stays
  inline and sends nothing. No sample expected account or input-token field.
  Reuse existing shared defaults for loading/error; explicit copy is localized.
  Input is ephemeral state. Maintain submitted draft string+opt-out identity;
  an in-flight result belongs to that identity, even if current draft changed.

```ts
const isStale = submitted !== null &&
  (submitted.text !== draft || submitted.optOut !== tokenSaverOptOut);
// Run captures current text/opt-out. Retry is an explicit new run using the
// current valid draft. Locale is never part of mutation variables/dependencies.
```

- [ ] Render outcome, observation time, reasons/warnings, order, lock times,
  missing capabilities, trim counts and fusion tuning using the allowlisted
  response. Build adjacency once and render semantic lists/disclosures; no
  graph dependency or HTML injection. Bound visible nesting by the known
  tree and wrap literal code. If an invalid parent/cycle is detected in a
  malformed response, show BAD_RESPONSE rather than recurse indefinitely.
- [ ] Add complete EN/VI keys for controls, statuses, fifteen reason codes,
  eight warning codes, invalid JSON/size/stale/unknown framing and accessible
  labels. Use validated own-key mapping, not dynamic `as MessageKey`.
  `UNSUPPORTED_FEATURE` gets safe actionable shared error guidance, separate
  from internal templates to preserve SP28's wire-code collision boundary.
- [ ] Mount only Simulator and remove its preview warning. Keep Overview and
  Fallback warnings/sample scopes untouched; Combo/Capacity tab keys unchanged.
  Keep drafts/results mounted across locale changes but release settled
  mutation variables/results on tab unmount (`gcTime: 0`). No timers or
  asynchronous callbacks that show a toast after unmount.
- [ ] Run authorized
  `node --test apps/web/src/features/gateway/simulation-result.test.mjs apps/web/src/shared/i18n.test.mjs apps/web/src/shared/errors.test.mjs`,
  web build/lint/diff; wire API map as implemented, not browser-verified yet.
  Commit `feat: wire localized routing simulator tab`.

## Task 5: Isolated acceptance, final gates and handoff

**Files:** Update `CLAUDE.md`, `docs/PROGRESS_HANDOFF.md`,
`docs/contracts/routing-simulator.md`, `docs/design/API_UI_MAP.md`, matrix and
existing `graphify-out`/`docs/PROJECT_MAP.md` generated outputs only when changed.
Temporary QA fixture source uses apply_patch and must not ship.

**Interfaces:** Consumes the finished HTTP/UI contract, shared decisions and
targeted suites. Produces evidence of approved scope, clean fixture teardown,
review resolution and a scoped local completion checkpoint.

- [ ] After explicit browser authorization, start current built app on a
  free loopback port using synthetic data and a transport that records then
  throws on vendor calls. Use existing helpers or a task-owned PTY fixture;
  never bind a real user's database, keys or provider environment.
- [ ] Exercise actual draft→Run→tree for direct/blocked/combo/capacity/fusion;
  literal hostile-looking IDs, unknown reason injected test-only, malformed
  JSON, 64KiB UTF-8 boundary, errors/Retry, stale edits during pending response,
  opt-out, truncation and tab unmount/cache disposal. EN/VI switching preserves
  draft/result and changes no request count; one click is one POST/no retry.
- [ ] Capture EN/VI at 1440/929/390, inspect tree/textarea/error wrapping and
  keyboard labels/disclosures. Verify no horizontal page overflow or JS error.
  Basic accessibility/layout only, not a full WCAG/performance certification.
- [ ] Confirm persisted before/after rows/expired locks/rotations and zero
  vendor/refresh/Headroom/PXPIPE/usage activity attributable to simulation.
  Native checks certify rules; browser checks certify effects/lifecycle.
- [ ] Stop task servers and close task browser contexts/tabs. Resolve exact
  run-prefixed synthetic directories inside the intended fixture folder
  before native removal; never delete older SP/user directories. Remove
  temporary source via apply_patch. Retain ignored screenshots if useful.
- [ ] Run `pnpm build`, `pnpm lint`, `pnpm discovery validate`, diff checks,
  then rerun only the authorized final suites against the final build:

```powershell
node --test --test-timeout=30000 apps/server/test/routing-decisions.test.mjs apps/server/test/routing-simulator-planner.test.mjs apps/server/test/routing-simulator.test.mjs apps/server/test/chat-lane.test.mjs apps/server/test/combos.test.mjs apps/server/test/capacity.test.mjs apps/server/test/token-saver.test.mjs apps/server/test/provider-nodes.test.mjs
node --test apps/web/src/features/gateway/simulation-result.test.mjs apps/web/src/shared/i18n.test.mjs apps/web/src/shared/errors.test.mjs
pnpm --filter @aigate/discovery exec vitest run test/paths.test.ts test/validate.test.ts
git diff --check
git diff --cached --check
```

- [ ] Obtain the agreed fresh review (Native: one whole-range read-only review;
  subagent-driven: task gates plus final review). Review actual base-to-final
  diff and shared live callers; fix critical/important findings and rerun
  their scoped checks. Do not dispatch reviewers during planning.
- [ ] Refresh existing AST-only graph after fixture removal using installed
  `graphify update . --no-cluster`, then
  `python graphify-out/build_project_map.py`, following the graphify skill.
  No dependency install/new semantic extraction; retain existing warnings.
- [ ] Record exact commands/counts, browser/mock boundaries, cleanup and any
  real blocker in handoff. Only then mark matrix `verified`, API row verified,
  and task board SP29 done. State excluded protocols/other Routing previews
  explicitly, not as unimplemented items in this approved slice.
- [ ] Stage exact completed files and commit `feat: complete SP29 routing simulator`;
  verify git status/hash. If git is refused, do not reset/unstage user files
  or claim a commit; report preserved changes. No push/merge.

## Plan self-review and execution handoff

Spec coverage: Tasks 1–3 cover shared choices, metadata/privacy, parser/HTTP,
bounded traversal and no side effects; Task 4 covers actual UI/EN/VI/state;
Task 5 covers effect/layout evidence, review, cleanup and completion docs.
Review Focus checks are placed in their owning tasks. Planned interfaces
are defined before consumers; inherited wire fields/codes are the approved
spec, not newly invented response shapes. No product changes in this plan.

Recommend **Native**: one implementer keeps the tightly coupled extraction,
planner and wire types consistent, followed by one fresh whole-range review.
**Subagent-driven** remains available if chosen, at higher per-task context
cost. User must review this plan, choose the method and explicitly authorize
SP29 targeted tests/browser acceptance before those steps run. Do not reuse
SP28's method/test authorization as approval of this new plan. Method is now
Native; only test/browser authorization and final review/acceptance remain open.
