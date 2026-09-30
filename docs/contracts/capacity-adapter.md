# Capacity adapter contract (M2 SP20)

When a request carries media that the requested model (or every member of a combo) cannot read, the capacity adapter puts models that can read it in front, from global per-capability pools the user configures. A pool model gets a trimmed history that fits its context window. Combos also float capable members to the front on their own. Matrix: `docs/discovery/feature-matrix/06-combo-capacity-adapter.yaml` (`capacity.*`, `combo.reorder-by-capabilities-tiers`), `routing.capacity-adapter-solo` (05).

Capabilities: the hard ones are the four input modalities `vision`, `pdf`, `audioInput`, `videoInput`; the soft ones are `tools` and `reasoning`. A request's required set is `detectRequiredCapabilities` (engine, `engine.md`): every message is scanned, not only the current turn, so AIGate's set can hold the soft ones too.

## Rules from the reference

| Rule | Label | AIGate |
|---|---|---|
| `routing.capacity-adapter-solo`: a single model lacking a required hard capability runs as an adapter chain | `REFERENCE_BEHAVIOR` | Kept for the client's own model on every lane. A combo member never widens on its own; its combo does. |
| `capacity.augment-models-priority-prepend`: when no original model satisfies every required hard capability, pool models that do (and are not already listed) go **first**; the originals follow as fallback | `REFERENCE_BEHAVIOR` | Kept. Pools are read in the fixed order vision, pdf, audioInput, videoInput; a model in two pools appears once, at its first place. Fusion combos are not widened (9router). |
| `combo.reorder-by-capabilities-tiers`: stable sort into tier 0 (all required), tier 1 (hard only), tier 2 (a hard one missing); nobody is dropped | `REFERENCE_BEHAVIOR` | Kept for fallback and round-robin combos, after rotation and widening. Tier 1 is reachable in AIGate because tools and reasoning can be required. |
| `capacity.capability-pool-config`: `{ enabled, roundRobin, models }` per capability; a legacy bare-array shape | `REFERENCE_BEHAVIOR` / `IMPLEMENTATION_ACCIDENT` | Kept the shape. The legacy array is not read: AIGate never stored it. |
| `capacity.default-pools-free-model`: vision and audio pools ship enabled and empty, so they send media to `oc/mimo-v2.6-flash-free` | `SUSPECTED_BUG` | Corrected: every pool starts off and empty, and there is no hard-coded model. Turning a pool on needs at least one model (400). |
| `capacity.pool-models-and-strategy`: the chain's strategy is the first required hard capability's pool (`roundRobin` → round-robin, else fallback), in `Set` insertion order | `REFERENCE_BEHAVIOR` / `IMPLEMENTATION_ACCIDENT` | Kept, with the fixed capability order instead of insertion order. |
| `capacity.solo-rotation-keyed-by-model`: the rotation state is named after the requested model | `SUSPECTED_BUG` | Corrected: one rotation per capability pool (at most four), one request per member (9router's solo run has no sticky limit), reset when that pool is saved. The rotation moves the pool part only; the requested model stays last. In a combo the pool keeps its saved order. |
| `capacity.wrap-stripping-per-model`: only models drawn from the pools get their history trimmed, each to its own context window | `REFERENCE_BEHAVIOR` | Kept; membership is by exact model string. A trimmed request goes to a Responses provider as CIP, not as the client's raw body (as fusion's rewritten requests). |
| `capacity.strip-history-budget-formula`: budget = (context window, else 200 000) × 0.8 × 4 characters; system kept; the current turn kept; of the older turns only the first 6 are candidates, then dropped from the sixth backward until the rest fits; nothing dropped → the request unchanged | `REFERENCE_BEHAVIOR` | Kept. Text parts count their length, a tool result the length of its text, any other part 50. The system prompt is CIP's `system`, always kept. |
| `capacity.strip-orphans-tool-calls`: the cut can separate a tool call from its results | `SUSPECTED_BUG` | Corrected: the kept tail starts at the last user message that is more than tool results (Anthropic clients send results as user messages), so tool results stay with the assistant turn that called them; a kept head that ends in a tool call loses that turn too. |

A model string's capabilities: `<provider or alias>/<model>` reads the catalog model; a bare id reads the first catalog provider that declares it; anything else (custom providers, custom models, unknown ids, combo names) gets the default floor plus the vision name heuristic, which is what the lane's own capability check uses. A `model(level)` suffix is ignored for the lookup. The context window comes from the same lookup (unknown: 200 000).

## Storage

Table `capacity_pools` (migration 0019): `capability` (primary key: `vision` | `pdf` | `audioInput` | `videoInput`), `enabled` and `round_robin` (booleans, default false), `models` (JSON array, read and written whole), `updated_at`. A missing row is an off, empty pool. The lane reads pools from a cache that every write replaces (single-writer assumption, as settings).

## API (dashboard session)

| Method | Path | Body | Answer |
|---|---|---|---|
| GET | `/api/capacity-pools` | — | `{ pools: CapacityPool[] }`, all four in the fixed order |
| PUT | `/api/capacity-pools/:capability` | `{ enabled, roundRobin, models }` | `{ pool }` |

`CapacityPool`: `{ capability, enabled, roundRobin, models, updatedAt }` (`updatedAt` null for a pool never saved).

Errors: 404 `NOT_FOUND` for another capability; 400 `INVALID_REQUEST` (message names the field) for a body that is not an object, an unknown field, `enabled` or `roundRobin` missing or not a boolean, `models` not 0–16 distinct strings of 1–200 characters, or `enabled: true` with no models.

## Chat lanes

- No new error codes. Pool members fail over like combo members (`combos.md`); when every model failed, the last one's error is returned.
- The answer names the model that produced it (the upstream `model`); no header marks a pool answer (9router).

## UI

`/gateway/routing` → `Routing`, Capacity adapter tab: one card each for Vision and Audio input (9router hides PDF and video; the API serves all four). Each card has an On switch (disabled until the pool has a model), Round-robin, the ordered model list (add with the connected-model list, ↑/↓, remove, Test through `POST /api/models/test`), and Save. Every code above reaches the user through `apps/web/src/shared/errors.ts`.
