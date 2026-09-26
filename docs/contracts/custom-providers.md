# Custom providers contract (M2 SP13b)

Scope: user-defined **OpenAI-compatible** providers (9router "provider nodes"). A custom provider is a name, a prefix, and a base URL. It gets one API-key connection like a built-in provider, and `/v1` reaches it as `<prefix>/<model>`.
- **UI:** `/providers` (Custom providers section), `/providers/new` (create and edit form), and the Connections Add modal, wired in this SP.
- **Not in SP13b:** Anthropic-compatible nodes (SP14, with the Anthropic adapter), `apiType: responses` (the Responses protocol, SP15), custom-embedding nodes (SP22), custom model lists (`catalog.model-custom-registration`), and a separate validate endpoint. The connection test (`GET {baseUrl}/models` with the key) checks the endpoint and the key together.

## Matrix entries

**User decision (2026-09-26): keep the 9router behavior** for the three rules `connection.provider-node-create-list` labels `SUSPECTED_BUG`. They are implemented as 9router has them, and the dashboard warns where 9router is silent.

| Entry | 9router | Label | AIGate |
|---|---|---|---|
| `connection.provider-node-create-list` | name and prefix required; id is `openai-compatible-<apiType>-<id>`; `<prefix>/<model>` reaches the node; built-in ids and aliases win | `REFERENCE_BEHAVIOR` | Kept. The id is `openai-compatible-<12 hex>`. |
| same | A missing `baseUrl` becomes `https://api.openai.com/v1` | `SUSPECTED_BUG`, kept by decision | Kept. The form hint says so. |
| same | A pasted `/chat/completions` is kept, so the request path doubles | `SUSPECTED_BUG`, kept by decision | Kept: the base URL is stored trimmed, and one trailing `/` is dropped when the URL is built (`routing.build-url`). |
| same | A reserved, duplicate, or slash-containing prefix is stored, then silently unreachable | `SUSPECTED_BUG`, kept by decision | Kept. Built-in ids and aliases win, and among duplicates the oldest node wins. The card shows an **Unreachable** pill with the exact reason. |
| `connection.provider-node-update-delete` | Update changes name, prefix, base URL, never the type; delete also deletes the node's connections | `REFERENCE_BEHAVIOR` | Kept. The delete confirmation in the UI says the connection and its key go too. |
| same | Update copies the node's fields onto every connection | `IMPLEMENTATION_ACCIDENT` | Dropped: connections store only the node id, and the descriptor is built from the node on each request, so a change applies at once. |
| `connection.provider-node-repo-storage` | id/type/name columns, everything else in a JSON blob | `REFERENCE_BEHAVIOR` (shape) | Typed columns only (SCHEMA_CONVENTIONS rule 1). |
| `connection.provider-node-validate-partial-ssrf` | A literal-only SSRF check for non-local callers | `SUSPECTED_BUG` | No validate route. The base URL must be `https`, or `http` to this machine (the transport rule), and the dashboard is session-only on `127.0.0.1`. |

## Table `provider_nodes` (migrations `0003`, `0004`)

| Column | Type |
|---|---|
| `id` | text primary key, `openai-compatible-<12 hex>` |
| `name` | text, 1–64 characters |
| `prefix` | text, indexed with `created_at` (not unique; `0004` dropped the unique index of `0003`) |
| `base_url` | text, trimmed |
| `created_at`, `updated_at` | timestamp_ms |

At most **100** custom providers (409 `NODE_LIMIT`); the count and the insert run in one transaction.

## Validation

- `name`: trimmed, 1–64 characters.
- `prefix`: trimmed, 1–200 characters. No format, reserved, or uniqueness check (9router).
- `baseUrl`: optional on create, default `https://api.openai.com/v1`. Trimmed, at most 2048 characters, no spaces. It must parse as a URL with `https:`, or `http:` to `localhost`, `127.0.0.1`, or `[::1]`, and may not carry a username, password, query, or fragment. These checks are AIGate security rules, not 9router's.
- Unknown body keys are 400. `type` and `apiType` are not accepted yet.

The descriptor: with one trailing `/` removed from the base URL, `chatUrl` = `<base>/chat/completions` and `modelsUrl` = `<base>/models`; `Authorization: Bearer <key>`, no static headers, no declared models.

## API (dashboard session)

Every response is `Cache-Control: no-store`. The view is `{ id, name, prefix, baseUrl, createdAt, updatedAt }`.

| Method and path | Body | Success | Errors |
|---|---|---|---|
| `GET /api/provider-nodes` | — | 200 `View[]`, oldest first | — |
| `POST /api/provider-nodes` | `{ name, prefix, baseUrl? }` | 201 `View` | 400 `INVALID_REQUEST` (names the field); 409 `NODE_LIMIT` |
| `PATCH /api/provider-nodes/:id` | any of `{ name, prefix, baseUrl }` | 200 `View` | 400; 404 `NOT_FOUND` |
| `DELETE /api/provider-nodes/:id` | — | 204; the node's connection is deleted in the same transaction | 404 `NOT_FOUND` |

`GET /api/providers` summaries also carry `aliases`, so the dashboard can tell a reserved prefix. Connections (`connections.md`) accept a custom provider id. Its connection test calls `GET <base>/models`.

## `/v1` (changes to `catalog-providers.md` resolution)

`x/y`, where `x` is not a catalog id or alias (connectable or not): if custom providers have prefix `x`, the oldest one serves model `y` as given (no declared models, so default capabilities). Otherwise the whole string is a bare model id, as before. Custom providers never serve a bare id, and `GET /v1/models` does not list them, since they declare no models.

## UI

| Screen | Wired |
|---|---|
| `/providers` → `LlmProviders`, Custom providers section | Cards from `GET /api/provider-nodes`: name, `<prefix>/…`, base URL, a Connected pill or Connect, Edit, Delete. **Unreachable** pill with the reason: the prefix contains `/`, is a built-in id or alias, or an older custom provider has it. Delete asks for the name and says the connection and its key are deleted too. |
| `/providers/new` → `ProviderDetail isNew` | A real form: name, prefix (the hint says which prefixes are unreachable), protocol (OpenAI compatible; Anthropic compatible is disabled until SP14), base URL (empty means the 9router default). Save goes to `/providers/connections?provider=<id>` to add the key. `?id=` edits an existing provider. |
| `Connections` Add modal | Lists the connectable built-in providers and the custom providers without a connection. |

## Matrix

`connection.provider-node-create-list`, `connection.provider-node-update-delete`, and `connection.provider-node-repo-storage` are `implemented`. `connection.provider-node-validate-partial-ssrf` stays `traced`: there is no validate route.
