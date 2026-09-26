# Per-connection data providers contract (M2 SP14g)

Scope, per spec §9 (SP14): three OpenAI-compatible providers that need more than a key. `azure` and `cloudflare-ai` take data per connection (stored in `provider_connections`, migration `0008`); `clinepass` needs Cline client headers and an answer envelope. All three use `OpenAICompatibleAdapter` (`provider-openai.md`).
- **Served:** `azure` (Azure OpenAI), `cloudflare-ai` (Cloudflare Workers AI), `clinepass` (ClinePass, API key). The catalog now has **58** connectable providers. `cline` (OAuth only) still needs SP16.
- **UI:** the Connections Add modal shows each provider's fields (`CONNECTION_FIELDS` in `features/providers/screens.tsx`); the Edit modal changes them and keeps the key unless a new one is typed; the row shows the endpoint, deployment, or account.

**User decisions (2026-09-26).** Azure: keep 9router (the test passes every status but 401/403; the form requires Organization). Cloudflare: correct (refuse images instead of dropping them). ClinePass: correct (a real connection test; the client headers name AIGate); a second ask, after the browser check showed `GET /api/v1/models` answering 200 to a fake key, made that test a one-token chat. Security, not a choice: an Azure connection must have an endpoint (9router falls back to api.openai.com), and every field is validated and URL-encoded.

## Matrix entries

| Entry | Label | AIGate |
|---|---|---|
| `connection.azure-openai-deployment` | `REFERENCE_BEHAVIOR` | See "azure". |
| same: test passes 404/400, Organization forced, endpoint falls back to api.openai.com | `SUSPECTED_BUG`, kept (the fallback refused for security) | As 9router, except an endpoint is required. |
| `connection.cloudflare-account-id` | `REFERENCE_BEHAVIOR` | See "cloudflare-ai". |
| `translator.cloudflare-content-flatten` | `REFERENCE_BEHAVIOR` | Text parts joined into one string. |
| same: images, audio, files silently dropped | `SUSPECTED_BUG`, corrected | `UnsupportedFeatureError` (`unsupported_feature` on `/v1`). |
| `provider.clinepass-headers-envelope` | `REFERENCE_BEHAVIOR` | See "clinepass". |
| same: Test "not supported"; validate's `GET /models` answers 200 without a key | `SUSPECTED_BUG`, corrected | A one-token chat. |
| same: the client names itself 9router | `IMPLEMENTATION_ACCIDENT` | It names AIGate. |

## Connection fields

| Field | Rule (trimmed; `""` or absent is no value) | Providers |
|---|---|---|
| `baseUrl` | the https-or-loopback base URL rule (`connections.md`) | azure (required, the endpoint), ollama-local (optional) |
| `deployment` | 1–64 letters, digits, `.`, `-`, `_` | azure (optional) |
| `apiVersion` | 1–32 letters, digits, `.`, `-`, `_` | azure (optional, default `2024-10-01-preview`) |
| `organization` | 1–128 printable characters, no spaces | azure (optional) |
| `accountId` | 1–64 letters, digits, `-` | cloudflare-ai (required) |

- A field the provider does not take → 400 "`<field>` cannot be set on a `<provider>` connection". A missing required field on create, or `null`/`""` for one on `PATCH` → 400 "`<field>` is required for a `<provider>` connection". An invalid value → 400 naming the rule.
- The descriptor declares them: `connectionFields { required, optional, defaults }`. `withConnection(provider, data)` fills the `{field}` tokens of `chatUrl`/`modelsUrl` (values URL-encoded, `baseUrl` with one trailing `/` removed, a default used as is), and adds `OpenAI-Organization` for an organization. The adapter replaces `{model}` with the request model (encoded); any token left is `INVALID_REQUEST` "The `<provider>` connection has no `<field>`; set it in AIGate: Providers → Connections".
- The view returns `baseUrl`, `deployment`, `apiVersion`, `organization`, `accountId` (null when unset); none is secret. `baseUrl` is stored as typed.

## azure (kept 9router)

- Chat: `POST <endpoint>/openai/deployments/<deployment>/chat/completions?api-version=<apiVersion>`; the deployment defaults to the request model (`azure/<model>`), the api version to `2024-10-01-preview`.
- Auth: `api-key: <key>` (no Authorization); `OpenAI-Organization: <organization>` when set. The body is the normal OpenAI chat body.
- Connection test: `POST` the chat URL (deployment, else `gpt-4`) with `{ messages: [{ role: "user", content: "test" }], max_completion_tokens: 1 }`; 401/403 → `invalid` ("Azure OpenAI answered 401: …"), **any other status → `active`** (kept: a wrong deployment still passes); a network failure → `unreachable`.
- No model listing; the catalog has no Azure models, so any `azure/<name>` is sent.
- The Add form requires endpoint, deployment, and organization (9router's form); the server requires only the endpoint.

## cloudflare-ai

- Chat: `https://api.cloudflare.com/client/v4/accounts/<accountId>/ai/v1/chat/completions`, `Authorization: Bearer <key>`.
- Every message content array becomes its text parts joined with no separator; **corrected:** an image, audio, or file part → `UnsupportedFeatureError` "openai-compatible cannot carry image_url content for a provider that takes text only".
- Connection test: `POST` `{ model: <first catalog model>, messages: [{ role: "user", content: "test" }], max_tokens: 1 }`; 401/403/404 → `invalid`, anything else `active`.

## clinepass

- Headers: `HTTP-Referer: https://cline.bot`, `X-Title: Cline`, `User-Agent: AIGate/0.1.0`, `X-PLATFORM: <process.platform>`, `X-PLATFORM-VERSION: <process.version>`, `X-CLIENT-TYPE: aigate`, `X-CLIENT-VERSION` / `X-CORE-VERSION: 0.1.0`, `X-IS-MULTIROOT: false`, `Authorization: Bearer <key>` (9router names itself `9Router/<version>` and `9router`).
- A non-streaming `{ success: true, data: {...} }` answer is read as `data`; `{ success: false, … }` and streams are read as they are (a failure envelope has no choices → `PROVIDER_UNAVAILABLE`).
- Connection test (corrected): `POST` the chat URL with `{ model: <first catalog model>, messages: [{ role: "user", content: "test" }], max_tokens: 1 }`; 401/403 → `invalid` with Cline's message (`{ error: "Unauthorized: …" }`), anything else `active`. Checked live on 2026-09-26: `GET /api/v1/models` answers 200 with no key (so 9router's validate passes any key), and the chat answers 401 to a fake key.

## Matrix

`connection.azure-openai-deployment`, `connection.cloudflare-account-id`, `translator.cloudflare-content-flatten`, and `provider.clinepass-headers-envelope` are `implemented`.
