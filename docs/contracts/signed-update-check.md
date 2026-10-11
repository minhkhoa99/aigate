# SP50 signed release availability

An operator may set `AIGATE_UPDATE_MANIFEST_URL` and
`AIGATE_UPDATE_PUBLIC_KEY_FILE`. The URL must be HTTPS without credentials,
query or fragment; the file must be an absolute path to a regular Ed25519
public key no larger than 4 KiB. Both are required. Defaults are absent, so
there is no network call or implicit trust root.

The dashboard session guards both routes:

| Method | Path | Result |
|---|---|---|
| GET | `/api/settings/update` | `{ currentVersion, channel: "unconfigured"|"ready"|"invalid", checking, lastCheck }`; no network. `lastCheck` is null or `{ at, latestVersion, hasUpdate, artifactBytes }` from this process's last successful check. |
| POST | `/api/settings/update/check` | Explicitly fetch and verify the SP49 manifest at the configured URL, then return the same status. No body is accepted (`UPDATE_INVALID_REQUEST` 400). |

The check uses the shared transport, manual redirect handling, 4 s request
timeout, 5 s overall deadline, and a 4 KiB response bound. A client abort
cancels the operation. It reads one manifest, checks the exact v1 shape and
canonical Ed25519 signature, and compares full SemVer including prerelease.
It never downloads an archive, changes an installation, starts a vendor call,
or follows a URL from the manifest. The browser only receives version, time,
size and availability; the pinned key path and manifest URL are not returned.

Errors: `UPDATE_CHANNEL_UNCONFIGURED` (409), `UPDATE_CHANNEL_INVALID` (409),
`UPDATE_BUSY` (409), `UPDATE_CHECK_FAILED` (502) and
`UPDATE_MANIFEST_INVALID` (502). A failure leaves the previous successful
result visible and gives the user an explicit Retry action.
