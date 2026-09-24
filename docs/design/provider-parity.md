# Provider parity with 9Router

The AIGate catalog must include every **visible, non-hidden** 9Router provider, using the same stable provider ID and an equivalent connection method. A matching name or tile alone is not functional parity: each provider also needs its auth flow, credential fields, model discovery, transport settings, connection test, and request adapter where applicable. User-created custom providers are data, not built-in registry entries.

## UI reference captured 2026-09-24

The local 9Router v0.5.50 Providers page at `http://localhost:20128/dashboard/providers` displayed 68 built-in LLM entries: 14 OAuth, 15 Free Tier, and 39 API Key. Their IDs, names, and display groups are recorded in [`apps/web/src/features/providers/catalog.ts`](../../apps/web/src/features/providers/catalog.ts). The page also displayed 10 user-created custom instances; AIGate must offer OpenAI-compatible and Anthropic-compatible creation flows but must not ship those private instances as fixtures.

The same 9Router instance displayed 78 media capability entries across Embedding (15), Image (20), TTS (14), STT (7), Video (1), Web Search (17), and Web Fetch (4). Providers can occur in several capabilities. AIGate's separate Image Understanding and Music lanes currently have no provider list on this reference page.

The source registry at `D:\9router\open-sse\providers\registry\index.js` was also inspected on 2026-09-24. It imports 121 entries: 111 are visible and 10 declare `hidden: true`. Another 3 are commented out of the import list. Nine visible entries were absent from the older running UI: `grok-web`, `ollama-search`, `opencode-zen`, `perplexity-web`, `qoder-cn`, `zed`, `fish-audio`, `alitp-intl`, and `xquik`. These are included in AIGate's catalog.

The current AIGate UI therefore covers **all 111 visible source registry IDs**: 74 LLM entries and 81 media capability entries, with overlap between media kinds and LLM. IDs, names, and display groups are recorded in [`apps/web/src/features/providers/catalog.ts`](../../apps/web/src/features/providers/catalog.ts). Its connection form remains a non-saving preview. The Free Tier group records 9Router's UI classification; it does not promise that every provider grants free access without conditions.

## Full registry acceptance

The older discovery snapshot counted 119 active entries plus 3 disabled imports in [`02-providers-auth.yaml`](../discovery/feature-matrix/02-providers-auth.yaml). Counts changed with the source snapshot; compare IDs at sync time. The full functional parity gate must verify auth, models, and request behavior per provider. Entries flagged `hidden: true` or commented out of the registry must remain outside the connectable UI until enabled upstream.

The active 9Router registry is the source for future syncs. The UI snapshot is a visual baseline, not the final implementation count. A provider is complete only after a real connection can be saved, tested, and used for a request through AIGate.
