# Model import and custom models contract (M2 SP16a)

A provider's catalog lists the models 9router shipped with; the provider itself may serve more. This SP lets the operator see the ids the connection's upstream really lists, add them (or any id by hand) as custom models, copy the id to call on `/v1`, and test one model with a real request.

**User decisions (2026-09-27).** The import shows the fetched list to pick from (9router adds every new id at once). The import is offered for every connected provider, built-in or custom (9router: custom providers, cline/clinepass and qoder). Kept from 9router on the ask: a failed fetch shows only `Failed to fetch models: <status>`; model ids are stored as given (any non-empty string); deleting a custom provider leaves its custom models behind. The per-model Test ships in this SP.

## Matrix entries

| Entry | Label | AIGate |
|---|---|---|
| `catalog.provider-models-live-fetch` | `REFERENCE_BEHAVIOR` | See "Live model list". |
| `catalog.model-custom-registration` | `REFERENCE_BEHAVIOR` | See "Custom models". |
| `catalog.compatible-models-import-ui` | `REFERENCE_BEHAVIOR`, `SUSPECTED_BUG` kept | See "Dashboard". |
| `catalog.custom-models-orphan-on-node-delete` | `SUSPECTED_BUG` kept | A custom provider's delete does not touch `custom_models`. |
| `catalog.model-connectivity-test` | `REFERENCE_BEHAVIOR` | See "Model test". |
| `catalog.model-listing-live-override` | `REFERENCE_BEHAVIOR` (in part) | `/v1/models` adds custom models; see "/v1/models". |

## Live model list

`GET /api/connections/{id}/models` (session required, `Cache-Control: no-store`):

- Reads the connection's key (an oauth token about to expire is refreshed first, as for the connection test) and calls the provider adapter's model list with the connection's data (`withConnection`): OpenAI-compatible `GET <modelsUrl>` `data[].id`, Anthropic `data[].id`, Gemini `models[].name`, Ollama `/api/tags`; Vertex and Command Code answer with their catalog without calling out. Ids that are not model ids are skipped; at most 1000.
- `200 { provider, connectionId, models: [{ id, inCatalog }] }`, where `inCatalog` says the provider's catalog already declares the id.
- Errors `{ code, message }`: 404 `NOT_FOUND`, 400 `PROVIDER_NOT_SUPPORTED`, 409 `CREDENTIAL_UNREADABLE`, 502 `MODELS_FETCH_FAILED` with `Failed to fetch models: <upstream status>`, or `Failed to fetch models` when there was no answer (network, timeout, unreadable body). Kept from 9router: the provider's reason is not shown. 9router passes the upstream status through as its own; AIGate answers 502 so that an upstream 401 is not read as the dashboard session ending.
- The adapter's own 15 s limit applies (every upstream call goes through an adapter; 9router's custom-provider fetch has none).

## Custom models

Table `custom_models` (migration 0010): `provider` (a catalog provider id or a custom provider id), `model_id`, `created_at`; primary key `(provider, model_id)`. Only chat models (9router's `type: llm`).

- `GET /api/models/custom[?provider=<id>]` → `{ models: [{ provider, id, createdAt }] }`, oldest first (at most 10 000).
- `POST /api/models/custom { provider, ids: string[] }` → `{ success: true, added: <new rows> }`. An id already stored is skipped. 400 `INVALID_REQUEST` "provider and ids required" when `provider` is not a non-empty string or `ids` is not a non-empty array of non-empty strings; at most 1000 ids per call. As in 9router neither the provider nor the id is checked further.
- `DELETE /api/models/custom?provider=&id=` → 204, also when nothing matched (9router answers success). 400 when either is missing.

## /v1/models

Each provider with an active connection lists its catalog chat models and then its custom models not already listed: a built-in provider as `<provider>/<id>`, a custom provider as `<prefix>/<id>` (custom providers list only their custom models). A request for any listed id reaches the provider; `<provider>/<id>` already accepted ids outside the catalog.

## Model test

`POST /api/models/test { model }` (session required) sends one real, metered chat request through the `/v1` resolution and adapter, without the API-key gate (the dashboard session stands in for it; 9router calls its own `/v1` with the first active key): `max_tokens: 1024` (reasoning models need the room, 9router #3010), `stream: false`, one user message `hi`, 15 s.

- `200 { ok: true, latencyMs, status: 200, error: null }`, with `note: "reasoning-only response (length-limited)"` when the answer stopped at the limit with reasoning and no text.
- `200 { ok: false, latencyMs, status, error: "HTTP <status>: <message, at most 500 characters>" }` when the lane refused the model or the provider failed (the status and message the lane would have answered).
- 400 `INVALID_REQUEST` "Model required".

## Dashboard

- **Provider detail** (`/providers/detail?provider=<id>`), built-in and now custom providers: the Models panel lists the catalog models and the custom models, each with its full id to copy and a Test action (ok with latency, or the error). A Model ID field adds one by hand (an id already listed is refused in the browser, "Model already exists for this provider."). **Import from /models** fetches the connection's list into a dialog: filter, tick ids (ids already listed are marked and cannot be ticked), **Add selected** or **Add all new**. With no active connection the button is disabled: "Add a connection to enable importing models." An empty answer says "No models returned from /models."; nothing new to add says "No new models were added." Custom models have a Delete action.
- **Custom providers** cards link to their detail page.
- Errors reach the user through `shared/errors.ts`: `MODELS_FETCH_FAILED` shows the server message.
