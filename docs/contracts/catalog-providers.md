# Catalog providers contract (M2 SP13)

Scope, per spec §9 ("SP13 | the 123-provider registry"): the SP4 `CATALOG` becomes the runtime registry. Every provider the existing OpenAI-compatible adapter (SP9) can serve can be connected and called on `/v1`. The dashboard lists the whole catalog from the API.
- **UI:** `/providers`, `/providers/detail`, and the Connections Add modal, wired in this SP.
- **Custom providers:** SP13b, `docs/contracts/custom-providers.md`.

## Which providers are connectable

`packages/engine/src/builtin-registry.ts` derives the answer from catalog data alone. The same rule also produces the reason shown in the UI.

| Condition | Otherwise the reason is… |
|---|---|
| `protocol` is `openai-compatible` | "Needs the \<protocol\> adapter (SP14)"; for `service`: "Media and search services come with SP22/SP23" |
| `auth.kinds` includes `api-key` | "Needs OAuth sign-in (SP16)", "Needs a web session", or "Keyless providers come later" |
| not `hidden` | "Hidden in the 9router catalog" |
| `chatUrl` is set, has no `{placeholder}`, and ends in `/chat/completions` | "Each connection needs its own endpoint URL", "The endpoint needs per-account data", or "Non-standard endpoint (SP14)" |
| no blocking quirk: `clineEnvelope` | "Needs a provider-specific request envelope (SP14)" |
| (SP14b) `forceStream` providers are connectable: a non-streaming client gets the collapsed stream (`stream-only-providers.md`) | — |

- **Result:** 41 of the 121 catalog providers are connectable (46 since SP14a added the `anthropic` family, `provider-anthropic.md`; 49 since SP14b added the stream-only providers, `stream-only-providers.md`; 50 since SP14c added perplexity-agent, `provider-openai-responses.md`; 52 since SP14d added ollama and ollama-local, `provider-ollama.md`, and moved the speech-to-text assemblyai and deepgram to the media reason).
- **The OpenAI exception.** 9router forces streaming for OpenAI. The OpenAI API answers non-streaming requests, and SP3 tier 1 replays that way, so AIGate does not force it. It is labeled `IMPLEMENTATION_ACCIDENT` for OpenAI.
- **Ignored fields.** `transport.usage`, `modelsFetcher`, `thinkingFormat`, `reasoningInject`, `regions`, and multi-`transports` do not stop a plain chat call. They stay in `unmodelled` for their SPs, and the default region URL is used.

## Registry and adapter changes

- `ProviderDescriptor` has `chatUrl`, `modelsUrl`, static `headers`, `aliases`, and `auth { header, scheme }`.
  - `baseUrl` is gone: the adapter calls `chatUrl` directly.
  - `modelsUrl` defaults to `chatUrl` with `/chat/completions` replaced by `/models`, which is the OpenAI layout.
- `ModelDescriptor.contextWindow` and `maxOutputTokens` may be `null` (not declared).
  - `assertModelSupports` checks the output limit only when it is known.
  - `kind` is the catalog kind, with `llm` read as `chat`. Non-chat models are refused on the chat lane, as before.
- **Static headers** from the catalog (for example OpenRouter's `HTTP-Referer` and `X-Title`, or Kimchi's `User-Agent`) go on every request. The auth header is set last, so a catalog header can never replace the key.
- **The auth header** uses the provider's header name and scheme (`Bearer <key>` or the raw key).
- `registry.provider(idOrAlias)` resolves aliases (`ds` → `deepseek`), and `registry.status(id)` gives `{ connectable, reason }` for every catalog id.

## `/v1` model resolution (changes to `chat-lane.md`)

1. `x/y` where `x` is a registry id **or alias**: provider `x`, with any model id `y`.
2. `x/y` where `x` is a catalog provider that is not connectable: 400 `provider_not_supported`, with its reason.
3. A bare id (a `/` whose prefix names no provider is part of the id): among the registry providers that **declare** it, the first one in catalog order **with an active connection** serves it. If none has one, the answer is 404 `no_active_connection`, naming up to three providers that offer the model.
4. Otherwise: 404 `model_not_found`.

Rule 3 replaces "the first provider that declares it". With 41 providers, `glm-5` is declared by six (Alibaba Coding, Alibaba, GLM (China), …), and picking one without a key would fail although another is connected.

## API (dashboard session)

| Method and path | Response |
|---|---|
| `GET /api/providers` | `[{ id, name, category, protocol, authKinds, hidden, connectable, reason, modelCount }]`, all 121 catalog entries |
| `GET /api/providers/:id` | The summary plus `chatUrl` and `models: [{ id, name, kind, capabilities, contextWindow, maxOutputTokens }]`; 404 `NOT_FOUND` |

`GET /api/connections/providers` (SP11) is removed. Connections accept any connectable registry id.
- A provider that is not connectable: 400 `PROVIDER_NOT_SUPPORTED`, with its reason.
- An unknown id: the same code, with "is not in the catalog".

## UI

| Screen | Wired |
|---|---|
| `/providers` → `LlmProviders` | The catalog comes from `GET /api/providers`. `service` and hidden entries are excluded, since they belong to the media screens. Cards are grouped by category (OAuth, Free Tier, API Key, Web account). Pills show "Connected", "Coming later" (the reason as the card title), or nothing when the provider can be connected. An unknown category goes to "Other providers" instead of being dropped. |
| `/providers/detail?provider=…` → `ProviderDetail` | Data from `GET /api/providers/:id`. The connection panel, or the reason it is not connectable. A models table: id, kind, context window, max output (or "not declared"), capabilities. |
| `Connections` Add modal | Lists the connectable providers. A `?provider=` that is not connectable shows its reason. |

The static `features/providers/catalog.ts` stays for the media screens (SP23).

## Matrix

- `catalog.registry-build`, `catalog.registry-entry-shape`, and `catalog.connection-listing` are `implemented`.
- `routing.model-resolution` gains alias resolution; its status stays `contracted`, since combos come in SP19.
