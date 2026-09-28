# Provider thinking contract (2026-09-28)

A built-in provider can carry a default thinking level: the reasoning a request gets when it asks for none. Kept from 9router's `settings.providerThinking` (matrix `routing.provider-thinking-default`), with the differences listed below.

## Matrix entries

| Entry | Label | AIGate |
|---|---|---|
| `routing.provider-thinking-default` | `REFERENCE_BEHAVIOR` | See below. |
| same: only `reasoning_effort` is checked, so the level overrides a Claude client's thinking budget or a Responses client's `reasoning.effort` | `SUSPECTED_BUG`, not kept | Any thinking the client sends wins (effort, budget, or the OpenAI `reasoning_effort` field), which is 9router's own stated rule ("only if client hasn't set"). |
| same: modes `on` and `off` | `IMPLEMENTATION_ACCIDENT` | Not ported: 9router's picker never offers them. |
| `routing.model-thinking-suffix`: the picked level adds a `(level)` suffix to copied model names | `REFERENCE_BEHAVIOR`, `SUSPECTED_BUG` | Implemented: the suffix selects the effective level and is removed before catalog lookup and upstream dispatch. |

## Levels

`none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, or `auto` (nothing stored, nothing sent). 9router offers the union of each model's levels (`thinkingLevels.js`); AIGate offers the levels of the provider's API family, from the same table:

| Family (protocol) | Levels |
|---|---|
| OpenAI-compatible, OpenAI Responses | none, minimal, low, medium, high, xhigh |
| Anthropic | none, low, medium, high, xhigh, max |
| Gemini, Vertex | none, minimal, low, medium, high |
| Ollama | none, low, medium, high |
| Command Code | none, low, medium, high, xhigh, max |

A provider none of whose catalog models reasons (`capabilities.reasoning`) has no levels, and the dashboard shows no picker.

**Custom providers** (user request, 2026-09-28; 9router shows a picker for a custom provider only when its added models reason): a custom provider declares no models, so AIGate cannot tell which ones reason. Its own level, picked in its form, goes to **every** model it serves. The levels are its family's: OpenAI compatible (chat or Responses) none, minimal, low, medium, high, xhigh; Anthropic compatible none, low, medium, high, xhigh, max. It is stored on the node (`provider_nodes.thinking_level`, migration `0013`, null is auto), so it goes when the node goes. Note that a thinking request a client sends itself to a custom model the catalog does not know is still refused (`model_not_found` "does not support: reasoning", the existing capability check); the provider level is applied after that check.

## Storage and API

Custom providers: `thinking` (auto or a level of the family) on `POST`/`PATCH /api/provider-nodes`, and `thinking`, `thinkingLevels` in the view; a level the family does not take is 400 `INVALID_REQUEST` "thinking must be auto or one of <levels>" ("thinking must be auto or a thinking level" for a non-string). Built-in providers:

Table `provider_thinking` (migration `0012`): `provider` text primary key (a catalog id), `level` text (checked against the levels above), `updated_at` timestamp_ms. No row is `auto`. The rows are cached in memory and dropped on every write (they are read on every chat request).

- `GET /api/providers/:id` adds `thinking: { level: "auto" | <level>, levels: <level>[] | null }`.
- `PUT /api/providers/:id/thinking { level }` (dashboard session, `Cache-Control: no-store`) → 200 `{ level, levels }`; `auto` deletes the row. 404 `NOT_FOUND` for an id not in the catalog; 400 `INVALID_REQUEST` "<name> has no model that reasons, so it takes no thinking level", or "Send { level } with auto or one of <levels>" for another level, another field, or a body that is not an object.

## On /v1

After the client protocol's own preparation (so an Anthropic client's budget has already become an effort for an OpenAI-style provider), and for the per-model test too, a stored level is applied when all of these hold:

- the request carries no thinking of its own (no `reasoning`, no OpenAI `reasoning_effort`);
- the model is a catalog model of the provider that reasons (9router strips thinking from the others; an id the catalog does not know is left alone), or the provider is a custom one with its own level;
- the provider's family takes the level.

Then, as if the client had sent it: an Anthropic-family provider gets a thinking budget (9router `effortToBudget`: minimal 512, low 1024, medium 8192, high 24576, xhigh 32768, max 128000; `none` sends nothing, Claude's default), and any other family gets `reasoning_effort` (low, medium and high as CIP's typed effort, the others as the OpenAI field). A Claude model behind an OpenAI-style provider (Copilot's `/v1/messages`) takes only low, medium and high, the efforts the Anthropic adapter maps; another level is not sent.

## Model suffix (part 2)

When a provider has a non-auto level, its Models panel copies a catalog reasoning model as `<provider>/<model>(<level>)`. A custom provider copies every added model this way because it has no catalog capability list. Copy and Test use this exact id. Non-reasoning catalog models and an Auto setting keep the plain id.

On every client lane and the model test, `model(level)` resolves the base model for catalog lookup, capabilities, and the upstream request. A recognized suffix (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`; `off` is `none`) overrides both client reasoning and the stored default; `auto` clears them and selects the base model. The regular family conversion above then applies. This is why a suffix works for OpenAI Chat, Anthropic Messages, Responses, Gemini, and custom-provider calls without a new endpoint or error code.

**SUSPECTED_BUG, kept from 9router.** Any final parenthesized value is removed before lookup, even if it is not a known level. Therefore a literal future model id such as `foo(beta)` can become `foo` or fail. The UI never creates an unknown suffix, but direct callers can reach this behavior.

**IMPLEMENTATION_ACCIDENT.** 9router also recognizes numeric budgets and `ultra`; AIGate's level picker does not expose them. They follow the unknown-parenthesized suffix behavior above rather than becoming an explicit override.

## UI

The provider detail page (`/providers/detail?provider=<id>`) shows a **Thinking** panel with a Default thinking level select (Auto and the provider's levels) when the provider has levels. A change saves at once with a success toast; a refused change shows the server's message (`INVALID_REQUEST`) and reads the stored value again. Its Models panel immediately changes the **Use as**, Copy, and Test id for the applicable models to include the selected suffix.
