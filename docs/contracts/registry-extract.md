# Registry extraction contract (M0 SP4)

Scope, per spec §9 ("SP4 | `tools/extract`: extract 9router registry data into the AIGate schema | the generated entries, verified by diff"): read 9router's provider registry once, write it as AIGate catalog data, and prove the copy is faithful.
- **SP4 does not change what AIGate can connect.** OpenAI stays the only runtime provider.
- SP13 turns the catalog into the runtime registry and the `/providers` screens. **SP4 has no UI.**

## Source and output

| | |
|---|---|
| Source | `.reference/9router/open-sse/providers/registry/*.js` at commit `39e36d3d` (0.5.86), imported as-is (plain ESM, no install), with 9router's own `getCapabilitiesForModel` |
| Tool | `tools/extract/src/extract.mjs` (generate) and `verify.mjs` (diff); run with `pnpm extract` / `pnpm extract verify` (`NINEROUTER_PATH`) |
| Output | `packages/engine/src/catalog/providers.generated.ts`: `CATALOG`, one `CatalogProvider` per registry entry. Never hand-edited; the header names the source commit. |
| Schema | `packages/engine/src/catalog/schema.ts`, with `validateCatalog` |

Spec §2 says to run `tools/extract` once and then delete it. It stayed through SP13, which added `headers`, `forceStream`, and `quirks` by regenerating, and was **deleted in SP13b**. To regenerate, restore it with `git checkout d2783c1 -- tools/extract`, add it back to the root `test` script and an `extract` script (`node --no-warnings tools/extract/src/cli.mjs`), then run `pnpm install`, `pnpm extract`, and `pnpm extract verify`.

## Mapping (labels per `porting-behavior-not-code`)

| 9router | AIGate `CatalogProvider` | Label and rule |
|---|---|---|
| `id`, `display.name`, `category`, `alias` + `aliases` | `id`, `name`, `category`, `aliases` | `REFERENCE_BEHAVIOR` |
| `transport.format` (missing → 9router's default `openai`); no `transport` → a media or search service | `protocol`: `openai-compatible`, `anthropic` (`claude`), `openai-responses`, `gemini`, `gemini-cli`, `vertex`, `antigravity`, `kiro`, `cursor`, `commandcode`, `ollama`, `grok-web`, `perplexity-web`, or `service` | `REFERENCE_BEHAVIOR`. Adapters are chosen by protocol family (spec §4.2). |
| `noAuth`, `category: webCookie`, `oauth` / `hasOAuth`, `authModes`, `transport.auth` | `auth.kinds` (`api-key`, `oauth`, `cookie`, `none`), plus the header and scheme | `REFERENCE_BEHAVIOR` |
| `transport.baseUrl` | `chatUrl` (the full request URL, as 9router uses it); `null` when it is empty, meaning the URL is per connection (Azure declares `""`) | `REFERENCE_BEHAVIOR` |
| `transport.modelsUrl` / `validateUrl` | `modelsUrl` | `REFERENCE_BEHAVIOR` |
| `serviceKinds` | `serviceKinds` | for SP22/SP23 |
| `hidden`, `display.deprecated` | `hidden`, `deprecated` | `REFERENCE_BEHAVIOR` |
| `models[]` via `normalizeModel` | `id`, `name`, `kind`, `upstreamModelId` | `REFERENCE_BEHAVIOR` |
| Capabilities from `getCapabilitiesForModel` | `capabilities` (`vision`, `pdf`, `audioInput`, `videoInput`, `tools`, `reasoning`), `capabilitySource` | `REFERENCE_BEHAVIOR`: 9router's tiers are materialized at extraction. |
| A model nothing declares gets `contextWindow 200000` and `maxOutput 64000` (9router `DEFAULT_CAPABILITIES`), even embedding models | `capabilitySource: "default"`, `contextWindow: null`, `maxOutputTokens: null` | `IMPLEMENTATION_ACCIDENT`. AIGate never invents limits (the same rule as SP9 `ListedModel`). |
| Every other field: quirks, headers, retry, reasoningInject, thinking config, OAuth settings, regions, multi-transports, media configs | `unmodelled`: the **names** of the fields, never their values | Nothing is dropped silently (the CIP rule 2 spirit). The SP that models a field removes its name. OAuth client secrets and other values are never copied. |

## Verification (spec exit criterion: "verified by diff")

`verify.mjs` re-reads the source and compares it with `CATALOG`, field by field:
- entry ids and count
- name, category, protocol, and the auth kinds
- `chatUrl` and `modelsUrl`
- model ids in order, `upstreamModelId`, and kind
- capabilities, and limits for declared models

`capabilitySource` is checked with an independent sentinel probe. With the floor's limits hidden, a tier that states limits still shows them. A value comparison could not do this: Claude Sonnet 4.5 declares 200000/64000, exactly the floor.

A difference exits 1. `validateCatalog` also checks:
- ids are unique; model ids are unique per `(kind, id)`, because one id may serve two lanes (Gemini 2.5 Pro, Flash, and Flash Lite are each both an `llm` and an `stt` model)
- ids match the id patterns
- URLs are `https`, or `http` to loopback
- a declared limit is a positive integer

The engine test runs `validateCatalog(CATALOG)`.

## Result (2026-09-26)

- **Source:** 9router 0.5.86 (`39e36d3d`).
- **Scale:** 121 providers and 935 models. Spec §9 said "123"; the registry array has 121 entries.
- **Verify:** `pnpm extract verify` found 0 differences, and `validateCatalog` found 0 problems.
- **Limits:** 254 models have no declared limits, so both limits are `null`.

Breakdown:

| | Count |
|---|---|
| By protocol | openai-compatible 63, service (media and search, no chat transport) 38, anthropic 6, openai-responses 3, ollama 2, and one each for gemini, gemini-cli, vertex, antigravity, kiro, cursor, commandcode, grok-web, perplexity-web |
| By auth | api-key 88, oauth 13, oauth + api-key 9, none 9, cookie 2 |
| By model kind | llm 744, image 92, embedding 34, tts 29, stt 22, video 10, systemone 4 |
| SP13 candidates | 46 providers: openai-compatible, API key, a standard `/chat/completions` URL, not hidden. The SP9 adapter serves them once it takes `chatUrl`. |

The unmodelled fields that appear most often, which are work for later SPs:
- `transport.headers` (36)
- `features` (25)
- `models[].params` (24)
- `oauth` (21, SP16)
- `transport.usage` (20)
- media configs (SP22/SP23)
- `transport.quirks` (13)

## Tests

- `tools/extract/test/extract.test.mjs` (until SP13b, when the tool was deleted):
  - the diff is 0
  - the committed file equals a fresh extraction, so nothing is hand-edited or stale
  - 9router's defaults are restored after the sentinel
  - it runs in CI, which checks out 9router at the reference commit
- `packages/engine/test/catalog.test.mjs`:
  - `validateCatalog` passes
  - no model carries invented limits
  - every provider has a protocol and an auth kind
  - the validator rejects each broken rule
- Six mutations were run and all were caught: `upstreamModelId` dropped, floor limits copied, claude mapped as openai, a client secret copied, model order changed, vision lost.
