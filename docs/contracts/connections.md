# Connections contract (M1 SP11)

Scope, per spec §9: the `connections` context with **one API-key account per provider**, and only providers in the engine registry (today: `openai`). OAuth comes in SP16; multi-account, priority order, and account locks in SP17; quota in SP24.

- **UI:** the `/providers` screens, wired in this SP: `Connections`, `ProviderDetail`, and connected pills in `LlmProviders`.
- **Decisions (user, 2026-09-25):**
  - Keys are encrypted with AES-256-GCM, using a key file, with an env override.
  - SP11 connected OpenAI only; since SP13 any connectable catalog provider (`catalog-providers.md`), and since SP13b any custom provider (`custom-providers.md`), whose connection test calls `GET <baseUrl>/models`.

## Rules from the reference

| Entry | Rule in 9router | Label | AIGate |
|---|---|---|---|
| `connection.storage-shape-json-blob` | 9 real columns; the API key, test status, and errors sit in an unchecked JSON `data` blob in plaintext. | `IMPLEMENTATION_ACCIDENT` (blob), `SUSPECTED_BUG` (plaintext key) | Typed columns (`SCHEMA_CONVENTIONS` rule 1). The key is sealed with `SecretCipherPort` (rule 9); only its last 4 characters are stored in clear, for display. Status: `implemented`. |
| `connection.create-dedup-and-priority-assignment` | API-key connections are deduplicated by exact name; priority is appended. | `REFERENCE_BEHAVIOR` | SP11 allows one connection per provider, through a unique index. A second create is 409 `ALREADY_CONNECTED`, never a silent upsert (rule 6). Priority comes with multi-account (SP17). Status: `contracted`. |
| `catalog.connection-listing` | Secrets are stripped by deleting four named keys, so a new secret field would leak. | `SUSPECTED_BUG` | The view is a positive allowlist; the sealed key never leaves the repository. Status: `implemented`. |
| `connection.client-listing-sanitized` | The usage listing uses a `SAFE_FIELDS` allowlist. | `REFERENCE_BEHAVIOR` | Same approach, for every read. |
| `catalog.connection-detail-crud` | `PUT` accepts `lastError` from the client; the key is overwritten only for `apikey` rows. | `SUSPECTED_BUG` (client-writable error state) | Test status and errors are written only by the server's test. `PATCH` takes `name`, `apiKey`, and `isActive`, and anything else is 400. A new key resets the status to `untested`. Status: `implemented`. |
| `connection.test-single-connection` | Most providers treat any status other than 401/403 as valid. The result is written back to the row. | `SUSPECTED_BUG` (non-auth failures count as valid) | Only a 2xx is `active`. `AUTH_ERROR` → `invalid`, `QUOTA_EXHAUSTED` → `no_quota`, and anything else (network, timeout, 5xx, 429) → `unreachable`, which means "not checked". The result is written back. Status: `implemented`. |
| `connection.delete-and-reorder` | Delete, then renumber priorities. | `REFERENCE_BEHAVIOR` | Delete only. There is no priority until SP17. |

## Secret storage (`SecretCipherPort`)

- **Code:** the port and its AES-256-GCM implementation are in `apps/server/src/secret-cipher.ts`.
- **Format:** `v1.` + base64url(12-byte IV ‖ 16-byte tag ‖ ciphertext).
- **AAD:** `provider_connections:<id>:api_key`, so a sealed value copied into another row does not decrypt.
- **Where the 32-byte key comes from:**
  1. `AIGATE_SECRET_KEY`, as 64 hex characters or base64 of 32 bytes. Anything else stops startup.
  2. Otherwise `secret.key` next to the database (`$AIGATE_DATA_DIR/secret.key`), in base64. If it is missing, it is created once with mode `0600`, through an exclusive create, so two processes cannot write different keys. A file with the wrong length stops startup, and it is **never overwritten**.
- **Threat model:** a leaked database or backup does not reveal provider keys. Someone who can read the data directory can still decrypt them. The OS keychain is a later `SecretCipherPort` implementation.
- **Key file lost or replaced:** every stored key becomes unreadable. Listing still works. A test gives 409 `CREDENTIAL_UNREADABLE`, and the UI asks for the key again. Saving a new key through `PATCH` fixes the row.

## Table `provider_connections`

| Column | Type |
|---|---|
| `id` | text PK (UUID) |
| `provider` | text, **unique** (SP11: one per provider) |
| `name` | text, 1–64 characters |
| `api_key_sealed` | text |
| `key_hint` | text (last 4 characters) |
| `is_active` | boolean, default true |
| `test_status` | text, CHECK `untested \| active \| invalid \| no_quota \| unreachable`, default `untested` |
| `last_error` | text, null (at most 300 characters, already redacted by the adapter) |
| `last_error_code` | text, null (an `ErrorCode`) |
| `last_tested_at` | timestamp_ms, null |
| `created_at`, `updated_at` | timestamp_ms |

## API (dashboard session required)

Every response is `Cache-Control: no-store`. The view is `{ id, provider, providerName, name, keyHint, baseUrl, deployment, apiVersion, organization, accountId, isActive, testStatus, lastError, lastErrorCode, lastTestedAt, createdAt, updatedAt }`, where `keyHint` looks like `••••abcd` (`no key` for a keyless ollama-local connection; the service-account `client_email`, or `user credential`, for a Google Cloud JSON credential, SP14f) and `baseUrl` is the connection's own host or `null` (SP14d, `provider-ollama.md`). It never contains the key.

| Method and path | Body | Success | Errors |
|---|---|---|---|
| `GET /api/connections` | — | 200 `View[]` | — |
| `POST /api/connections` | `{ provider, apiKey, name?, baseUrl?, deployment?, apiVersion?, organization?, accountId? }` (`apiKey` optional for ollama-local; the fields per `provider-connection-data.md`) | 201 `View` | 400 `INVALID_REQUEST` (names the field); 400 `PROVIDER_NOT_SUPPORTED` (the catalog reason, or "is not in the catalog"); 409 `ALREADY_CONNECTED` |
| `PATCH /api/connections/:id` | any of `{ name, apiKey, isActive, baseUrl, deployment, apiVersion, organization, accountId }` (`""` or `null` clears a field; a required one cannot be cleared) | 200 `View` | 400 `INVALID_REQUEST`; 404 `NOT_FOUND` |
| `DELETE /api/connections/:id` | — | 204 | 404 `NOT_FOUND` |
| `POST /api/connections/:id/test` | — | 200 `View`, with the new `testStatus` | 404 `NOT_FOUND`; 409 `CREDENTIAL_UNREADABLE` |

Validation:
- `apiKey` is trimmed, then must be 8–4096 printable ASCII characters with no spaces. A value starting with `{` is a Google Cloud JSON credential (at most 16384 characters): only vertex and vertex-partner take one, and it must be a complete service_account or authorized_user JSON; otherwise 400 `apiKey is not a usable Google Cloud credential: …` (`provider-vertex.md`, SP14f). It may be left out (or `""`) only for a provider whose auth is optional (ollama-local, SP14d); elsewhere that is 400 naming `apiKey`.
- `baseUrl` (SP14d): only for a provider that declares a connection host (ollama-local); elsewhere 400 "baseUrl cannot be set on a <provider> connection". It must be https, or http to this machine, without credentials, query, or fragment (the custom-provider rule).
- `name` is trimmed to 1–64 characters, and defaults to the provider's name.
- Unknown body keys are 400.

The test:
- It decrypts the key, then calls `OpenAICompatibleAdapter.validateCredential`: one `GET /models`, 15 s, no retry. That call runs **outside** any transaction.
- It writes the result only if the sealed key is still the one it tested. If the key was changed during the test, the stale result is dropped and the current row is returned.
- If a custom endpoint's `/models` returns AIGate's own `invalid_api_key` message, the URL points back to this gateway (including through the Vite proxy). The test records `unreachable` / `INVALID_REQUEST` and tells the user to edit the custom provider Base URL. It does not blame the provider key.

## UI

| Screen | What is wired |
|---|---|
| `/providers/connections` → `Connections` | Table of real connections: provider, name, key hint, status, last tested, and actions (Test, Replace key, Disable/Enable, Delete). "Needs attention" filters to `invalid`, `no_quota`, `unreachable`, `untested`, and disabled rows. Add connection: provider select (the connectable providers from `GET /api/providers`, SP13), name, API key; for Ollama Local a Host field and an optional key (SP14d). Save, then test automatically. An Ollama Local row shows its host, and its Replace key button is Edit (host and an optional new key). |
| `/providers/detail?provider=…` → `ProviderDetail` | Connection status for the provider, with Add or Manage. Providers that are not supported show "Not supported yet; the full catalog comes with SP13". |
| `/providers` → `LlmProviders` | A "Connected" pill on connected cards. |
| Removed, because nothing backs them | Sample account rows, the "Strategies" tab, and the Quota column. Strategies return with SP17 and quota with SP24. |

Precise messages:
- **API errors**, via `shared/errors.ts`: `PROVIDER_NOT_SUPPORTED`, `ALREADY_CONNECTED`, `CREDENTIAL_UNREADABLE`, plus the existing `INVALID_REQUEST` and `NOT_FOUND`.
- **Test results**, each with a toast:
  - `active`: "Key works"
  - `invalid`: the upstream's redacted reason, with advice to check the endpoint and key
  - `no_quota`: "no quota or credit"
  - `unreachable`: "could not reach; the key was not checked", plus the provider's message

## Tests

- `apps/server/test/connections.test.mjs` runs over Fastify inject, with a fake `HttpTransportPort` passed to `createServer`.
- `apps/server/test/secret-cipher.test.mjs` covers the cipher and key loading.
