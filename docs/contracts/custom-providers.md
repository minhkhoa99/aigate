# Custom providers contract (M2 SP13b)

Scope: user-defined **OpenAI-compatible** providers (9router "provider nodes"). A custom provider is a name, a prefix, and a base URL. It gets one API-key connection like a built-in provider, and `/v1` reaches it as `<prefix>/<model>`.
- **UI:** `/providers` (Custom providers section), `/providers/new` (create and edit form), and the Connections Add modal, wired in this SP.
- **Not in SP13b:** Anthropic-compatible nodes (SP14, with the Anthropic adapter), `apiType: responses` (the Responses protocol, SP15), custom-embedding nodes (SP22), custom model lists (`catalog.model-custom-registration`), and a separate validate endpoint. The connection test (`GET {baseUrl}/models` with the key) checks the endpoint and the key together.

## Matrix entries

| Entry | 9router | Label | AIGate |
|---|---|---|---|
| `connection.provider-node-create-list` | name and prefix required; id is `openai-compatible-<apiType>-<id>`; `<prefix>/<model>` reaches the node; built-in ids and aliases win | `REFERENCE_BEHAVIOR` | Kept. The id is `openai-compatible-<12 hex>`. |
| same | A missing `baseUrl` becomes `https://api.openai.com/v1` | `SUSPECTED_BUG` | Not ported: `baseUrl` is required, so a custom key never goes to OpenAI by accident. |
| same | A pasted `/chat/completions` is kept, so the request path doubles | `SUSPECTED_BUG` | Not ported: trailing `/` and a trailing `/chat/completions` are removed, like the sibling node types do for `/messages` and `/embeddings`. |
| same | A reserved, duplicate, or slash-containing prefix is stored, then silently unreachable | `SUSPECTED_BUG` | Not ported: refused when saved (409 `PREFIX_RESERVED`, 409 `PREFIX_TAKEN`, 400 for the format). |
| `connection.provider-node-update-delete` | Update changes name, prefix, base URL, never the type; delete also deletes the node's connections | `REFERENCE_BEHAVIOR` | Kept. The delete confirmation in the UI says the connection and its key go too. |
| same | Update copies the node's fields onto every connection | `IMPLEMENTATION_ACCIDENT` | Dropped: connections store only the node id, and the descriptor is built from the node on each request, so a change applies at once. |
| `connection.provider-node-repo-storage` | id/type/name columns, everything else in a JSON blob | `REFERENCE_BEHAVIOR` (shape) | Typed columns only (SCHEMA_CONVENTIONS rule 1). |
| `connection.provider-node-validate-partial-ssrf` | A literal-only SSRF check for non-local callers | `SUSPECTED_BUG` | No validate route. The base URL must be `https`, or `http` to this machine (the transport rule), and the dashboard is session-only on `127.0.0.1`. |

## Table `provider_nodes` (migration `0003`)

| Column | Type |
|---|---|
| `id` | text primary key, `openai-compatible-<12 hex>` |
| `name` | text, 1–64 characters |
| `prefix` | text, **unique** |
| `base_url` | text, normalized |
| `created_at`, `updated_at` | timestamp_ms |

At most **100** custom providers (409 `NODE_LIMIT`); the count and the insert run in one transaction.

## Validation

- `name`: trimmed, 1–64 characters.
- `prefix`: trimmed, `^[a-z0-9][a-z0-9-]{0,31}$`. It may not be a catalog provider id or alias, connectable or not (409 `PREFIX_RESERVED`), or another custom provider's prefix (409 `PREFIX_TAKEN`, from the unique index).
- `baseUrl`: trimmed, at most 2048 characters, then trailing `/` and a trailing `/chat/completions` are removed. It must parse as a URL with `https:`, or `http:` to `localhost`, `127.0.0.1`, or `[::1]`. It may not carry a username, password, query, or fragment.
- Unknown body keys are 400. `type` and `apiType` are not accepted yet.

The descriptor: `chatUrl` = `<baseUrl>/chat/completions`, `modelsUrl` = `<baseUrl>/models`, `Authorization: Bearer <key>`, no static headers, no declared models.

## API (dashboard session)

Every response is `Cache-Control: no-store`. The view is `{ id, name, prefix, baseUrl, createdAt, updatedAt }`.

| Method and path | Body | Success | Errors |
|---|---|---|---|
| `GET /api/provider-nodes` | — | 200 `View[]`, oldest first | — |
| `POST /api/provider-nodes` | `{ name, prefix, baseUrl }` | 201 `View` | 400 `INVALID_REQUEST` (names the field); 409 `PREFIX_RESERVED`, `PREFIX_TAKEN`, `NODE_LIMIT` |
| `PATCH /api/provider-nodes/:id` | any of `{ name, prefix, baseUrl }` | 200 `View` | 400; 404 `NOT_FOUND`; 409 `PREFIX_RESERVED`, `PREFIX_TAKEN` |
| `DELETE /api/provider-nodes/:id` | — | 204; the node's connection is deleted in the same transaction | 404 `NOT_FOUND` |

Connections (`connections.md`) accept a custom provider id. Its connection test calls `GET <baseUrl>/models`.

## `/v1` (changes to `catalog-providers.md` resolution)

`x/y`, where `x` is not a built-in id or alias and not a catalog provider: if a custom provider has prefix `x`, it serves model `y` as given (no declared models, so default capabilities). Otherwise the whole string is a bare model id, as before. Custom providers never serve a bare id, and `GET /v1/models` does not list them, since they declare no models.

## UI

| Screen | Wired |
|---|---|
| `/providers` → `LlmProviders`, Custom providers section | Cards from `GET /api/provider-nodes`: name, `<prefix>/…`, base URL, a Connected or Not connected pill, and Connect, Edit, Delete. Delete asks for the name and says the connection and its key are deleted too. |
| `/providers/new` → `ProviderDetail isNew` | A real form: name, prefix (the hint shows `<prefix>/<model>`), protocol (OpenAI compatible; Anthropic compatible is disabled until SP14), base URL. Save goes to `/providers/connections?provider=<id>` to add the key. `?id=` edits an existing provider. |
| `Connections` Add modal | Lists the connectable built-in providers and the custom providers without a connection. |

## Matrix

`connection.provider-node-create-list`, `connection.provider-node-update-delete`, and `connection.provider-node-repo-storage` become `implemented`. `connection.provider-node-validate-partial-ssrf` stays `traced`: there is no validate route.
