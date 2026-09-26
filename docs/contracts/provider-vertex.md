# Vertex AI provider contract (M2 SP14f)

Scope, per spec §9 (SP14, provider adapters by protocol family): `vertex` (Gemini models on Vertex AI, over the Gemini adapter) and `vertex-partner` (partner models on Vertex's OpenAI-compatible endpoint, over the OpenAI adapter), with Google Cloud credentials. `createAdapter` picks `VertexAdapter` for `protocol: "vertex"` and `VertexPartnerAdapter` for an OpenAI-compatible descriptor with `auth.googleCloud`.
- **Served:** `vertex` and `vertex-partner`. The catalog now has **55** connectable providers.
- **Not ported:** `qoder` and `qoder-cn` say "Not supported: needs Qoder CLI impersonation" (user decision 2026-09-26; matrix `provider.qoder-agent-transport`, traced only).
- **UI:** the Connections Add and Replace key modals take a service-account JSON or an API key for these two providers (`GOOGLE_CLOUD` in `features/providers/screens.tsx`); the row shows the service account's `client_email`.

**User decisions (2026-09-26).** Correct: thought signatures, token handling and the connection test, and the location (global). Keep: the project guess from the probe for a vertex-partner API key, with a bounded cache. The API key goes in a header, never the URL (AIGate security rule).

## Matrix entries

| Entry | Label | AIGate |
|---|---|---|
| `provider.vertex-google-auth` | `REFERENCE_BEHAVIOR` | See "Credentials" and "Tokens". |
| same: 401 retry reuses the cached token, cache by client_email, ADC refreshed per request, key in the URL | `SUSPECTED_BUG`, corrected | Forced re-mint, cache per credential, ADC cached to expiry, `x-goog-api-key` header. |
| `connection.vertex-credential-test` | `REFERENCE_BEHAVIOR` | See "Connection test". |
| same: Test "not supported", service account valid on field presence, any status but 401/403 valid | `SUSPECTED_BUG`, corrected | A real test. |
| `routing.vertex-endpoints` | `REFERENCE_BEHAVIOR` | See "Endpoints". |
| same: token path on `locations/us-central1` of the global host | `SUSPECTED_BUG`, corrected | `locations/global`. |
| `translator.openai-to-vertex-request` | `REFERENCE_BEHAVIOR` | The Gemini request (`provider-gemini.md`), then no call ids. |
| same: every thoughtSignature overwritten | `SUSPECTED_BUG`, corrected | Only a call without a cached real signature gets Vertex's borrowed one. |
| same: remote image URLs fetched server-side | `IMPLEMENTATION_ACCIDENT` | Sent as `fileData` like Gemini (Vertex reads public URLs); AIGate never fetches client URLs. |

## Credentials

The one `apiKey` field holds one of:

| Value | Kind | Project |
|---|---|---|
| JSON `type: "service_account"` with `client_email`, `private_key`, `project_id` | service account | `project_id` |
| JSON `type: "authorized_user"` with `client_id`, `client_secret`, `refresh_token`, `quota_project_id` | ADC user credential | `quota_project_id` |
| anything not starting with `{` | API key | none (vertex), or from the probe (vertex-partner) |

A JSON value of another type or with a missing field is refused when the connection is saved (400 naming the missing fields) and at request time (`AUTH_ERROR`). `parseGoogleCredential` (engine) is the one parser.

## Tokens

- Service account: an RS256 JWT `{ iss: client_email, scope: https://www.googleapis.com/auth/cloud-platform, aud: https://oauth2.googleapis.com/token, iat, exp: iat+3600 }` (header `{ alg: RS256, typ: JWT }`), signed with WebCrypto from the PKCS#8 `private_key` (literal `\n` sequences become line breaks), is exchanged at `POST https://oauth2.googleapis.com/token` (`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`, form-encoded).
- ADC: the same endpoint with `grant_type=refresh_token`, `client_id`, `client_secret`, `refresh_token`.
- **Cache (corrected):** in memory, keyed by the SHA-256 of the whole credential; reused while more than 5 minutes remain of `expires_in` (default 3600 s); at most 256 entries; expired entries dropped on write. No in-flight dedup (as 9router).
- Token endpoint 400/401/403 → `AUTH_ERROR` "Google's token endpoint answered <status> for the service-account key: <error>: <error_description>"; any other status → `PROVIDER_UNAVAILABLE`. A private key that is not PKCS#8 RSA → `AUTH_ERROR`.
- **401 (corrected):** when Vertex answers 401 to a token, the cached token is dropped and a new one minted once; the request is retried once (a stream only before its first chunk). A 403, or a 401 to an API key, is not retried.
- A token is sent as `Authorization: Bearer <token>`; an API key as `x-goog-api-key: <key>` (9router: `?key=`).

## Endpoints

| Provider | Credential | URL |
|---|---|---|
| vertex | token | `https://aiplatform.googleapis.com/v1/projects/<project>/locations/global/publishers/google/models/<model>:generateContent` or `:streamGenerateContent?alt=sse` |
| vertex | API key | `https://aiplatform.googleapis.com/v1/publishers/google/models/<model>:<action>` (express endpoint) |
| vertex-partner | any | `https://aiplatform.googleapis.com/v1/projects/<project>/locations/global/endpoints/openapi/chat/completions` |

- The project is URL-encoded. vertex-partner sends the OpenAI chat body of `provider-openai.md` unchanged (for example `model: "deepseek-ai/deepseek-v3.2-maas"`), and reads the answer the same way.
- **vertex-partner API key project (kept, bounded):** `POST https://aiplatform.googleapis.com/v1/publishers/google/models/__probe__:generateContent` with the key header and `{ contents: [{ role: "user", parts: [{ text: "ping" }] }] }`; the project is `/projects\/([^/]+)\//` in `error.message` (or `[0].error.message`). Cached per key for 1 hour, at most 256 keys; failures are not cached. No project → `AUTH_ERROR` "Google did not name the project of this Vertex Partner API key; connect with a service-account JSON instead" (or "Google rejected the … API key (<status>)" for 400/401/403).

## Request and answer

vertex uses the Gemini adapter unchanged (`provider-gemini.md`: safety settings off, thinking level/budget by model, the corrected tool-schema cleaner, the kept 9router answer and stream mapping), except:
- `functionCall` and `functionResponse` carry no `id`.
- The first call of a model turn carries its cached real signature, else Vertex's borrowed signature (`vertex-signature.ts`, 1672 characters); later calls carry only a cached one. Signatures seen in a Vertex stream are cached like Gemini's.

## Connection test (corrected)

- Service account or ADC: mint a fresh token (not the cached one); success is `active`, `AUTH_ERROR` is `invalid` with the message, anything else is `unreachable`.
- API key: the probe above. 400/401/403 → `invalid` ("Google rejected the … API key"); a named project → `active` (and cached); vertex: 404 without a project → `active`; vertex-partner: no project → `invalid`; any other status → `unreachable`.

## Models

`getModels` returns the catalog models (vertex 8, vertex-partner 4) without calling Google, as 9router lists its static registry.

## Other deviations

- Location is always `global` (no field; 9router has `providerSpecificData.location` with no UI).
- The express endpoint is used only by vertex with an API key; 9router does the same.

## Matrix

`provider.vertex-google-auth`, `connection.vertex-credential-test`, `routing.vertex-endpoints`, and `translator.openai-to-vertex-request` are `implemented`; `provider.qoder-agent-transport` is `traced`.
