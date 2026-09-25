# Engine contract (M1 SP7)

Scope, per spec §9: the CIP core, the registry schema, capability resolution, and one registry entry. The deferred SP0.1 retry helper is also here.

`packages/engine` is pure TypeScript with no npm imports. The dependency-cruiser rule `engine-framework-free` enforces this, and a `lint:check` fixture proves the rule fires. SP7 has **no HTTP API and no UI**: `docs/design/API_UI_MAP.md` lists it as "No UI". The first screen that can show engine work is the `/v1` endpoint in SP12.

## Rules from the reference

| Entry | Rule in 9router | Label | AIGate |
|---|---|---|---|
| `catalog.model-registry-global` | One static, per-process table of models, indexed by provider alias. | `REFERENCE_BEHAVIOR` | Keep. `builtinRegistry` is static data checked once by `defineRegistry()`. A bad entry fails at load, not on a request. Status: `contracted`, because SP13 adds the full catalog. |
| `catalog.capability-tier-fallback` | A 4-tier chain: provider override, exact id, pattern, default. The first match wins and tiers are never merged. | `REFERENCE_BEHAVIOR` | Tier 1 is the registry model's declared capabilities, which are final. Tier 4 is the default floor. Tiers 2–3 (exact-id and pattern tables) arrive with SP4/SP13. Status: `contracted`. |
| `catalog.capability-refine-additive-only` | The name heuristic and synced catalog can only turn a capability on. | `REFERENCE_BEHAVIOR` | Keep. It applies only to undeclared models. |
| `catalog.capability-vision-pattern-order` | `NOT_VISION` (embedding, image generation, audio, …) is checked before `VISION_NAME`. | `REFERENCE_BEHAVIOR` | Keep, with 9router's regexes. Tests include the `nvidia/…-embed-vl-…` case from the matrix. |
| `combo.detect-required-capabilities` | Modality needs are read from content blocks; a file with no media type counts as a document. | `REFERENCE_BEHAVIOR` | Keep. CIP files always carry `mediaType`: `image/*`, `audio/*`, and `video/*` map to their capability, and anything else needs `pdf` (document input). |
| `combo.detect-required-capabilities` | Only the trailing user turn is scanned. An image from an earlier turn, or in the system prompt, is invisible even though it is sent upstream. | `SUSPECTED_BUG` (labeled here; the matrix records it as an edge case) | Scan every message, the system prompt, and nested tool results, because everything is sent upstream. **Confirmed by the user on 2026-09-25.** |
| `combo.detect-required-capabilities` | The `search` capability is detected but disabled. | `IMPLEMENTATION_ACCIDENT` | Left out until search is a feature. |

Spec rules applied directly:
- CIP is a superset. `vendorExtensions` carries what is not modelled yet, and `UnsupportedFeatureError` replaces a silent drop (§3.1).
- The 8 error codes and their fallback decisions are data in `FALLBACK_POLICY` (§5).
- `AIProviderPort` and `ExecCtx` have one shared signal (§4.2). `getModels` and `validateCredential` also take the context, so every I/O call stays inside the request deadline. This widens the spec signature on purpose.

## Behavior

**`withRetry(operation(attempt, signal), { signal, maxAttempts, baseDelayMs, maxDelayMs, shouldRetry })`**
- `maxAttempts` must be an integer from 1 to 10. Delays must be finite, with `maxDelayMs >= baseDelayMs`. Anything else is a `RangeError` before the first attempt.
- The wait between attempts is `min(maxDelayMs, baseDelayMs · 2^(attempt-1))`. An abort ends the wait at once, with the abort reason.
- It stops without retrying on these conditions:
  - the signal is already aborted, so no attempt runs
  - the signal aborts during an attempt
  - `shouldRetry` returns false
  - the attempts are used up
- Callers must use it only for operations that are safe to repeat, and never after a stream's first chunk.

**`assertModelSupports(request, providerId, model, modelId)`**
- A non-chat model gives `MODEL_UNAVAILABLE`.
- A missing capability gives `MODEL_UNAVAILABLE` with `details.missing`. This is recoverable, so routing can try a capable candidate.
- `maxOutputTokens` above the model limit gives `INVALID_REQUEST` with `details.limit`. It is not recoverable, and the message names the limit.

**Registry entry** (the only one): `openai`, with `gpt-5`, `gpt-4.1`, `gpt-4.1-mini`, and `gpt-4o-mini`. Data comes from 9router `registry/openai.js` and `capabilities.js:302-304`. The base URL is the API root `https://api.openai.com/v1`; the SP9 adapter appends `/chat/completions`.

## Tests

`packages/engine/test/engine.test.mjs` has 15 tests, run in `pnpm test`. Each of these ten mutations made at least one test fail:
- an abort mid-attempt being retried
- no attempt ceiling
- a wait that cannot be aborted
- uncapped backoff
- `VISION_NAME` checked before `NOT_VISION`
- scanning only the trailing turn
- ignoring the system prompt
- no output-limit check
- `INVALID_REQUEST` made recoverable
- `http` base URLs accepted

## Deferred

- Enforcing "retry only through `withRetry`" in lint waits for real adapter code (SP8/SP9). The SP0.1 fetch rule already rejects `fetch` without `AbortSignal.timeout` in `packages/`.
