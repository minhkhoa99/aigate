# SP47 installation backup and restore

SP47 adds an encrypted backup of AIGate-owned persistent state. The existing
portable settings document remains a separate, non-secret 16-field transfer.
The reference's plaintext credential bundle and partial-payload table wipe are
rejected. The backup captures a consistent SQLite snapshot, its matching
secret key, the MCP registry, and bounded MITM certificate/key files. It does
not alter OS trust, hosts entries, external CLI configuration or installed
PXPIPE binaries; those are runtime or external state, not AIGate-owned records.

## API and review

All routes require a valid dashboard session **and** fresh dashboard password,
even if local `requireLogin` is disabled. They return `Cache-Control: no-store`.
The passphrase (12–1024 characters) never persists. The versioned JSON archive
uses scrypt and AES-256-GCM; its authenticated content is a complete snapshot,
not row-by-row JSON. A 64 MiB database-image cap and fixed file allowlist bound
memory and upload size; a larger installation receives `BACKUP_TOO_LARGE` and
must use an offline operational backup until a streamed format exists.

| Method | Path | Behavior |
|---|---|---|
| POST | `/api/settings/backup/export` | `{password,passphrase}` → encrypted downloadable document. |
| POST | `/api/settings/backup/preview` | `{password,passphrase,document}` → integrity/schema check, redacted included-file list, size and current-state fingerprint; no writes. |
| POST | `/api/settings/backup/apply` | Same input plus `expectedVersion` and `confirmation:"RESTORE"` → revalidates and stages files; returns `restartRequired:true`. |

Preview/apply never expose decrypted key, credentials, API keys or session rows.
Preview checks the encrypted content and exact local migration history in a
temporary SQLite image without changing installation data. It rejects a partial,
older or newer schema rather than running migrations during review.
Apply refuses a stale fingerprint, a pending restore, and an archive whose key
conflicts with an active `AIGATE_SECRET_KEY` override. On the next server start,
before loading the key or opening SQLite, staging is validated and applied.
Prior owned files and SQLite WAL sidecars are copied for rollback. An interrupted
or failed apply restores the prior files on the next boot; no partial installation
is treated as successful. Existing sessions are cleared from the restored image.
The stage holds plaintext DB/key/material under the protected AIGate data
directory until restart. File permissions are restricted, but the host account
and filesystem administrators can read them. Writes made after staging and
before restart are replaced at restart; the UI warns the owner before apply.

`INVALID_REQUEST`, `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `BACKUP_INVALID`,
`BACKUP_TOO_LARGE`, `BACKUP_CHANGED`, `BACKUP_PENDING` and
`BACKUP_KEY_CONFLICT` reach the Settings UI with actionable EN/VI copy.

## Verification gate

Use isolated temporary data directories and synthetic credentials. Cover
export/decrypt/restore of settings, sealed connection and SSO state, MCP data;
wrong password/passphrase, tamper, oversized/partial documents, stale preview,
pending staging, startup rollback, session invalidation and mobile UI. Run
targeted tests, build, lint, discovery, graph AST refresh and diff checks.

Verified locally with synthetic data on 2026-10-11: database conformance 6/6;
backup/settings/identity/SSO focused checks 23/23, including a partial image,
wrong passphrase, tamper, stale preview, pending stage, interrupted rollback and
a preview payload above Fastify's default 1 MiB cap. Isolated Edge/CDP fixture
exercised export, preview, EN→VI, typed confirmation, apply, and 390px layout
with five same-origin fake API requests and no vendor/real credentials.
