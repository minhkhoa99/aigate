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
| `fallbackStrategy` | `"fill-first"` \| `"round-robin"` | `"fill-first"` | routing, account selection (SP17, `multi-account.md`) |
| `comboStickyLimit` | integer 1–1000 | `1` | routing, round-robin combos: requests per member before rotating (SP19, `combos.md`; 9router `comboStickyRoundRobinLimit`) |
| `tokenSaverEnabled`, `rtkEnabled`, `headroomEnabled`, `headroomUrl`, `headroomCompressUserMessages`, `headroomTimeoutMs`, `cavemanEnabled`, `cavemanLevel`, `ponytailEnabled`, `ponytailLevel`, `pxpipeEnabled`, `pxpipeMinChars`, `pxpipeTimeoutMs` | typed stage flags, URL, bounded timeouts/thresholds, or `lite`/`full`/`ultra` level | documented in migrations 0020–0021 | Token Saver request pipeline (SP21, `token-saver.md`) |

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

## SP27 / M3 U2 — General, runtime and portable settings

The numbered M2 roadmap ends at SP25; this slice follows SP26 Overview and
wires General according to design §10.9.18. It is a portable settings transfer,
not a database backup. Its v1 export contains 16 transferable keys. Connections,
passwords, sessions, keys, proxy credentials,
usage, combos and environment variables never enter the document. Service URLs
(`headroomUrl`) are also excluded because their query strings may carry secrets.

All routes below require the dashboard session and use `Cache-Control: no-store`.
Successful responses are HTTP 200, including preview/apply: neither creates a
new resource.

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/settings/runtime` | Actual listener address/port (null before listen), data directory, Node version, SQLite driver, uptime, stream idle timeout, usage timezone/retention, daily retention, and writer counters. No environment dump or credentials. |
| GET | `/api/settings/export` | Download `aigate-settings.json`: `{ format: "aigate-settings", version: 1, settings: { ... } }`, containing only transferable typed settings, excluding service URLs. |
| POST | `/api/settings/import/preview` | Validate the document; return `{ version, changes: [{ key, before, after }], settings }`. `version` is an opaque SHA-256 fingerprint of current settings. No writes. |
| POST | `/api/settings/import` | `{ document, expectedVersion }`: revalidate, compare the reviewed version, and atomically merge the document's provided keys. Return the full current settings. Missing keys are preserved. |

Documents are at most 64 KiB, have exactly the three envelope keys above, and
contain at least one transferable setting. Unknown keys, secrets, service URLs,
wrong field types and unsupported versions/formats are 400
`INVALID_REQUEST`; no setting changes. Values reuse `parseSettingsPatch` bounds.
Import uses a conditional SQL update matching every current setting, so a PATCH
racing a reviewed import results in 409 `SETTINGS_CHANGED`, with no overwrite.
No preview cache, disk staging, migration or new dependency is needed. Applied
settings take effect on the next request through the existing write-through cache.

`/settings/general` shows runtime information with loading/error/Retry and
download, links to the existing controls for auth/routing/Token Saver/proxy pools,
and export/import actions. A bounded local file read submits the document for
preview; a table shows each real before/after value, and a type-to-confirm IMPORT
dialog precedes Apply. Failures re-read settings; stale previews require a new
preview. Export is available before importing so a user can keep the prior values.
No fake Save, instance-name/default-model, startup or observability controls remain.
The runtime table wraps long startup labels and data-directory paths so running
values remain readable on narrow screens without horizontal table scrolling.

Theme uses the shell's existing local state/localStorage and applies immediately
in this browser. `/settings/developer` keeps its browser-local developer-mode
toggle, shows actual usage retention/writer status, and downloads the same runtime
metadata instead of a fake seven-day diagnostic archive. Retention, port and data
directory are startup settings; the UI identifies their environment variables
and restart requirement. Whole-dashboard i18n, automatic updates, OS startup registration
and complete installation backup remain separate features.

`SETTINGS_CHANGED` reaches `shared/errors.ts` with a precise re-preview instruction;
other errors reuse the existing validation, session and transport mappings.
Runnable check: the settings transfer case in `apps/server/test/settings.test.mjs`.
It covers route auth/status/no-store, export redaction, preview-only behavior,
validation, merge and stale-import refusal. The shared web error check covers
the actionable `SETTINGS_CHANGED` message.

## SP28 browser presentation

General adds EN/VI selection under browser-local `aigate-language`; Auth,
General and Developer resolve owned labels/notices/errors at render time.
See `i18n.md`. Human counts/durations use native Intl; port, Node/driver/path,
environment names, settings keys and raw before/after values remain literal.
The language preference is not a server setting or settings export key.
The 64 KiB limit, original import document/fingerprint and exact `IMPORT`
confirmation guards are unchanged. OIDC/SAML remain existing visual previews.
