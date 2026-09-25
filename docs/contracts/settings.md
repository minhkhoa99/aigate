# Settings contract (M1 SP5)

Scope, per spec §9: read with defaults, and the mass-assignment guard. The source is four Feature Matrix entries in `docs/discovery/feature-matrix/01-endpoint-apikey-settings.yaml`. Each rule below carries a label. AIGate does not reproduce any rule labeled `IMPLEMENTATION_ACCIDENT` or `SUSPECTED_BUG`.

## Rules from the reference

| Entry | Rule in 9router | Label | AIGate |
|---|---|---|---|
| `settings.defaults-and-merge` | Every known key is present; persisted values win over defaults. | `REFERENCE_BEHAVIOR` | Keep. Defaults are column defaults in one typed row. |
| `settings.defaults-and-merge` | `outboundProxyEnabled` is inferred `true` when a URL exists but the flag was never stored. | `IMPLEMENTATION_ACCIDENT` | Drop. This backfills old 9router installs, and AIGate imports none (spec §1). |
| `settings.defaults-and-merge` | Unknown keys pass through the JSON blob, and a renamed key silently loses the user's value. | `IMPLEMENTATION_ACCIDENT` (untyped blob) | Replace with typed columns and versioned migrations (conventions §1, §8). Unknown keys are rejected. |
| `settings.hot-path-read-no-cache` | Every read runs a fresh `SELECT` and parses the JSON. | `IMPLEMENTATION_ACCIDENT` | An in-process cache, replaced on every write (conventions §11). |
| `settings.hot-path-read-no-cache` | A `PATCH` takes effect on the very next request. | `REFERENCE_BEHAVIOR` | Keep. The cache is write-through, and this process is the only writer. |
| `settings.get-secret-stripping` | `password` and `oidcClientSecret` are never returned. | `REFERENCE_BEHAVIOR` | Keep, by construction: secrets are not settings. Identity stores them hashed or encrypted (conventions §9). |
| `settings.get-secret-stripping` | `hasPassword`, `oidcConfigured`, `enableRequestLogs`, and `enableTranslator` are derived into the response. | `REFERENCE_BEHAVIOR` | Out of scope. They belong to identity (SP6) and usage/routing. |
| `settings.get-secret-stripping` | Responses carry `Cache-Control: no-store` (`route.js:10`). | `REFERENCE_BEHAVIOR` | Keep. |
| `settings.patch-protected-keys` | Secrets cannot be mass-assigned (CWE-915). | `REFERENCE_BEHAVIOR` | Keep the intent with an allowlist. Only editable keys of the right type are accepted. |
| `settings.patch-protected-keys` | Protection is a name blocklist (`password`, `mitmSudoEncrypted`) that silently drops matches; other keys, including unknown ones, are stored. | `IMPLEMENTATION_ACCIDENT` | Replace. Any key outside the editable set, including secret names, is a 400. |

Out of scope for SP5:
- `settings.patch-password-change` (`SUSPECTED_BUG`, hardcoded `'123456'`) and `settings.require-login-public-status` → identity, SP6.
- `settings.outbound-proxy-live-apply` and `settings.proxy-test-outbound-probe` → transport.
- `settings.combo-rotation-reset` → routing.
- `settings.database-export-import` → its own feature, later.

## Keys in SP5

SP5 has only the two keys the M1 walking skeleton needs. Each later context adds its keys, with a migration, in its own SP.

| Key | Type | Default | Read by |
|---|---|---|---|
| `requireLogin` | boolean | `true` | identity (SP6) |
| `requireApiKey` | boolean | `true` | apikeys and routing (SP6, SP12) |

Storage: a single row in table `settings` with `id = 1` enforced by a `CHECK`, one `NOT NULL` column per key with its default, created on first read.

## HTTP contract

`GET /api/settings`
- Returns `200` with every key and its value: `{ "requireLogin": true, "requireApiKey": true }`.
- Sets `Cache-Control: no-store`.

`PATCH /api/settings` with a JSON object of keys to change:
- Every key must be editable, and every value must have that key's type.
- On success: apply the changes in one write and return `200` with the full settings, as `GET` does. An empty object changes nothing and returns the current settings.
- On failure: return `400` and change nothing. The body is `{ "code": "INVALID_REQUEST", "message": "...", "keys": [...] }`, where `keys` lists the offending keys. This applies when:
  - the body is not a JSON object
  - a key is unknown, including any secret name such as `password`
  - a value has the wrong type

**Access.** Until identity lands in SP6, every `/api/*` route answers only loopback clients. Other clients get `403`. SP6 replaces this with the dashboard auth guard, which 9router applies to all of `/api/*` (`dashboardGuard.js`).

## Tests that prove it

Server tests call these routes through Fastify inject. They cover:
- defaults on a fresh database
- a `PATCH` that persists across restart and shows on the next `GET`
- `400` with no change for an unknown key, a secret name, a wrong type, and a non-object body
- `403` for a non-loopback client
- `Cache-Control: no-store`
