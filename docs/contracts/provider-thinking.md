# Provider thinking contract (2026-09-28)

A built-in provider can carry a default thinking level: the reasoning a request gets when it asks for none. Kept from 9router's `settings.providerThinking` (matrix `routing.provider-thinking-default`), with the differences listed below.

## Matrix entries

| Entry | Label | AIGate |
|---|---|---|
| `routing.provider-thinking-default` | `REFERENCE_BEHAVIOR` | See below. |
| same: only `reasoning_effort` is checked, so the level overrides a Claude client's thinking budget or a Responses client's `reasoning.effort` | `SUSPECTED_BUG`, not kept | Any thinking the client sends wins (effort, budget, or the OpenAI `reasoning_effort` field), which is 9router's own stated rule ("only if client hasn't set"). |
| same: modes `on` and `off` | `IMPLEMENTATION_ACCIDENT` | Not ported: 9router's picker never offers them. |
| same: the picked level adds a `(level)` suffix to copied model names | Not yet | Needs the `model(level)` suffix, which AIGate does not parse yet (part 2). |

## Levels

`none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, or `auto` (nothing stored, nothing sent). 9router offers the union of each model's levels (`thinkingLevels.js`); AIGate offers the levels of the provider's API family, from the same table:

| Family (protocol) | Levels |
|---|---|
| OpenAI-compatible, OpenAI Responses | none, minimal, low, medium, high, xhigh |
| Anthropic | none, low, medium, high, xhigh, max |
| Gemini, Vertex | none, minimal, low, medium, high |
| Ollama | none, low, medium, high |
| Command Code | none, low, medium, high, xhigh, max |

A provider none of whose catalog models reasons (`capabilities.reasoning`) has no levels, and the dashboard shows no picker. Custom providers have none (they declare no models).

## Storage and API

Table `provider_thinking` (migration `0012`): `provider` text primary key (a catalog id), `level` text (checked against the levels above), `updated_at` timestamp_ms. No row is `auto`. The rows are cached in memory and dropped on every write (they are read on every chat request).

- `GET /api/providers/:id` adds `thinking: { level: "auto" | <level>, levels: <level>[] | null }`.
- `PUT /api/providers/:id/thinking { level }` (dashboard session, `Cache-Control: no-store`) → 200 `{ level, levels }`; `auto` deletes the row. 404 `NOT_FOUND` for an id not in the catalog; 400 `INVALID_REQUEST` "<name> has no model that reasons, so it takes no thinking level", or "Send { level } with auto or one of <levels>" for another level, another field, or a body that is not an object.

## On /v1

After the client protocol's own preparation (so an Anthropic client's budget has already become an effort for an OpenAI-style provider), and for the per-model test too, a stored level is applied when all of these hold:

- the request carries no thinking of its own (no `reasoning`, no OpenAI `reasoning_effort`);
- the model is a catalog model of the provider that reasons (9router strips thinking from the others; an id the catalog does not know is left alone);
- the provider's family takes the level.

Then, as if the client had sent it: an Anthropic-family provider gets a thinking budget (9router `effortToBudget`: minimal 512, low 1024, medium 8192, high 24576, xhigh 32768, max 128000; `none` sends nothing, Claude's default), and any other family gets `reasoning_effort` (low, medium and high as CIP's typed effort, the others as the OpenAI field). A Claude model behind an OpenAI-style provider (Copilot's `/v1/messages`) takes only low, medium and high, the efforts the Anthropic adapter maps; another level is not sent.

## UI

The provider detail page (`/providers/detail?provider=<id>`) shows a **Thinking** panel with a Default thinking level select (Auto and the provider's levels) when the provider has levels. A change saves at once with a success toast; a refused change shows the server's message (`INVALID_REQUEST`) and reads the stored value again.
