# Custom providers contract (M2 SP13b, SP14b)

Scope: user-defined **OpenAI-compatible** (SP13b) and **Anthropic-compatible** (SP14b) providers (9router "provider nodes"). A custom provider is a type, a name, a prefix, and a base URL. It gets one API-key connection like a built-in provider, and `/v1` reaches it as `<prefix>/<model>`.
- **UI:** `/providers` (Custom providers section), `/providers/new` (create and edit form, both protocols), and the Connections Add modal.
- **Not here:** `apiType: responses` (the Responses protocol, SP15), custom-embedding nodes (SP22), custom model lists (`catalog.model-custom-registration`), and a separate validate endpoint. The connection test checks the endpoint and the key together (OpenAI: `GET {baseUrl}/models`; Anthropic: see "Anthropic-compatible").

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

## Table `provider_nodes` (migrations `0003`, `0004`, `0005`)

| Column | Type |
|---|---|
| `id` | text primary key, `<type>-<12 hex>` |
| `type` | text, `openai-compatible` (default, so rows from before `0005` keep working) or `anthropic-compatible`; fixed at creation |
| `name` | text, 1–64 characters |
| `prefix` | text, indexed with `created_at` (not unique; `0004` dropped the unique index of `0003`) |
| `base_url` | text, trimmed |
| `created_at`, `updated_at` | timestamp_ms |

At most **100** custom providers (409 `NODE_LIMIT`); the count and the insert run in one transaction.

## Validation

- `type`: create only, `openai-compatible` (default) or `anthropic-compatible`; anything else is 400 "type must be openai-compatible or anthropic-compatible". A `type` in a PATCH body is 400 "type cannot be changed; add a new custom provider instead" (9router never changes it).
- `name`: trimmed, 1–64 characters.
- `prefix`: trimmed, 1–200 characters. No format, reserved, or uniqueness check (9router).
- `baseUrl`: optional on create, default `https://api.openai.com/v1` (OpenAI) or `https://api.anthropic.com/v1` (Anthropic). Trimmed, at most 2048 characters, no spaces. It must parse as a URL with `https:`, or `http:` to `localhost`, `127.0.0.1`, or `[::1]`, and may not carry a username, password, query, or fragment. These checks are AIGate security rules, not 9router's. For an Anthropic-compatible provider, one trailing `/` and then a trailing `/messages` are removed before it is stored, on create and update.
- Unknown body keys are 400. `apiType` is not accepted yet.

The OpenAI descriptor: with one trailing `/` removed from the base URL, `chatUrl` = `<base>/chat/completions` and `modelsUrl` = `<base>/models`; `Authorization: Bearer <key>`, no static headers, no declared models. The Anthropic descriptor is under "Anthropic-compatible".

## API (dashboard session)

Every response is `Cache-Control: no-store`. The view is `{ id, type, name, prefix, baseUrl, createdAt, updatedAt }`.

| Method and path | Body | Success | Errors |
|---|---|---|---|
| `GET /api/provider-nodes` | — | 200 `View[]`, oldest first | — |
| `POST /api/provider-nodes` | `{ type?, name, prefix, baseUrl? }` | 201 `View` | 400 `INVALID_REQUEST` (names the field); 409 `NODE_LIMIT` |
| `PATCH /api/provider-nodes/:id` | any of `{ name, prefix, baseUrl }` | 200 `View` | 404 `NOT_FOUND` (checked first); 400 |
| `DELETE /api/provider-nodes/:id` | — | 204; the node's connection is deleted in the same transaction | 404 `NOT_FOUND` |

`GET /api/providers` summaries also carry `aliases`, so the dashboard can tell a reserved prefix. Connections (`connections.md`) accept a custom provider id. Its connection test calls `GET <base>/models`.

## `/v1` (changes to `catalog-providers.md` resolution)

`x/y`, where `x` is not a catalog id or alias (connectable or not): if custom providers have prefix `x`, one serves model `y` as given (no declared models, so default capabilities): OpenAI-compatible providers are searched first, then Anthropic-compatible ones, and the oldest wins within a type (9router `src/sse/services/model.js`). Otherwise the whole string is a bare model id, as before. Custom providers never serve a bare id, and `GET /v1/models` does not list them, since they declare no models.

## Anthropic-compatible (SP14b, `connection.anthropic-compatible-node`)

**User decision (2026-09-26): keep the 9router behavior**, including the rules the entry labels `SUSPECTED_BUG`.

| Rule | AIGate |
|---|---|
| Requests | The Anthropic adapter (`provider-anthropic.md`: request, response, stream, errors), at `chatUrl` = `<base without one trailing />/messages`, `modelsUrl` = `<base>/models`. |
| Auth | `x-api-key: <key>` (raw) and `anthropic-version: 2023-06-01`; no catalog headers. |
| Official host | A stored base URL that **contains the substring** `api.anthropic.com` (kept by decision). Any other host also gets `Authorization: Bearer <key>`. |
| Beta header | When the upstream model id starts with `claude-`: `anthropic-beta` is 9router's Claude Code list (`claude-code-20250219`, `oauth-2025-04-20`, `interleaved-thinking-2025-05-14`, `context-management-2025-06-27`, `prompt-caching-scope-2026-01-05`, `structured-outputs-2025-12-15`, `fast-mode-2026-02-01`, `redact-thinking-2026-02-12`, `token-efficient-tools-2026-03-28`), plus `advanced-tool-use-2025-11-20` and `effort-2025-11-24` for `claude-opus*`/`claude-sonnet*`; `claude-code-20250219` is left out off the official host (kept by decision). Other models get no beta header. |
| Connection test | `POST <base>/v1/messages` (so `…/v1/v1/messages` with the default base) with `x-api-key`, `anthropic-version`, `Authorization: Bearer`, body `{ model: "claude-3-haiku-20240307", max_tokens: 1, messages: [{ role: "user", content: "test" }] }`. 401 or 403 → invalid (`AUTH_ERROR`); **any other status → active** (kept by decision). A network failure or timeout → unreachable. |
| Not ported | The Claude Code cloaking of an `sk-ant-oat` OAuth token pasted as a key (a billing header and a fake `metadata.user_id`): AIGate never disguises its traffic as another client; OAuth sign-in is SP16. The default thinking signature and the tool-result image hoisting only apply to Claude-format clients, and AIGate has only the OpenAI inbound protocol (`IMPLEMENTATION_ACCIDENT` for now). |

## UI

| Screen | Wired |
|---|---|
| `/providers` → `LlmProviders`, Custom providers section | Cards from `GET /api/provider-nodes`: name, `<prefix>/…` and the protocol, base URL, a Connected pill or Connect, Edit, Delete. **Unreachable** pill with the reason (`features/providers/node-rules.ts`): the prefix contains `/`, is a built-in id or alias, or another custom provider wins it (an OpenAI-compatible one, else an older one of the same type). Delete asks for the name and says the connection and its key are deleted too. `+ Anthropic compatible` opens `/providers/new?type=anthropic-compatible`. |
| `/providers/new` → `ProviderDetail isNew` | A real form: name, prefix (the hint says which prefixes are unreachable), protocol (OpenAI or Anthropic compatible; fixed when editing), base URL (the hint and placeholder follow the protocol; empty means its 9router default). "How it works" says how the key is tested, including 9router's lenient Anthropic test. Save goes to `/providers/connections?provider=<id>` to add the key. `?id=` edits an existing provider. Server messages (`INVALID_REQUEST`, `NODE_LIMIT`, `NOT_FOUND`) are toasts through `shared/errors.ts`. |
| `Connections` Add modal | Lists the connectable built-in providers and the custom providers without a connection. |

## Matrix

`connection.provider-node-create-list`, `connection.provider-node-update-delete`, `connection.provider-node-repo-storage`, and (SP14b) `connection.anthropic-compatible-node` are `implemented`. `connection.provider-node-validate-partial-ssrf` stays `traced`: there is no validate route.
