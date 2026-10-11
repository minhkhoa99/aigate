# SP51 managed release installation

SP51 adds a managed installation in a new root separate from application data. An operator first
builds and signs an SP49 release, then runs `pnpm release:install <manifest>
<public-key.pem> <new-install-root>`. The root must not exist. The installer
verifies the manifest and archive with the pinned key, validates the archive
entries, installs frozen production dependencies and writes a stable
`launcher.mjs` plus `state.json`. Start the application with
`node <install-root>/launcher.mjs`. The application data directory remains
outside the release root and is never copied or replaced.

The launcher sets `AIGATE_MANAGED_ROOT` and starts the selected release. It
activates a pending version only after that process reports listening and
survives a short startup grace period. An early failure clears the pending
version and starts the previous version. A later failure can be handled with
`node <install-root>/launcher.mjs rollback` or the General Settings rollback
action, followed by a launcher restart. The launcher and prior releases are
retained. SP51 does not kill or restart the running process automatically.
Managed stage and rollback use an exclusive `.update.lock` to avoid competing
writes. If a process is forcibly terminated during installation, an operator
must confirm it has stopped before removing that stale lock.
The release channel and any custom data-directory setting must be supplied
through the environment or an external `AIGATE_ENV_FILE` when launching;
release directories intentionally contain no `.env`. If an older SP48 Startup
entry points directly at a source build, disable that owned entry before
enabling Startup from the managed instance.

For a managed instance with the SP50 channel configured, dashboard sessions
guard `POST /api/settings/update/stage` and
`POST /api/settings/update/rollback`. Both require the current dashboard
password. Stage also requires `expectedVersion` from the last signed check.
It re-fetches and verifies the fixed HTTPS manifest, derives the archive URL
from the signed basename in the same directory, rejects redirects, streams at
most 512 MiB with cancellation/deadline, checks exact length and SHA-256,
validates/extracts only release files, installs frozen production dependencies,
then records the pending version. It never accepts a URL from the browser or
manifest. Rollback schedules the retained previous release. Requests do not
touch AI vendors, credentials or user data.

`GET /api/settings/update` also reports `installation: "source"|"managed"|"invalid"`,
`activeVersion`, `pendingVersion`, and `rollbackVersion`. On an unmanaged
instance stage/rollback return `UPDATE_NOT_MANAGED` (409). Other errors:
`UPDATE_INVALID_REQUEST` (400), `INVALID_CREDENTIALS` (401),
`RATE_LIMITED` (429), `UPDATE_BUSY`, `UPDATE_STALE`, `UPDATE_ALREADY_STAGED`,
`UPDATE_NO_ROLLBACK` (409), `UPDATE_DOWNLOAD_FAILED`,
`UPDATE_ARTIFACT_INVALID`, `UPDATE_INSTALL_FAILED` (502). A failed stage
retains the active release and cleans only its own temporary directory.
General Settings presents the states, explicit stage/rollback actions,
pending/restart instructions and precise EN/VI errors.

The manifest request retains SP50's 4 KiB/4 s bound. Archive transfer is
capped at its signed length and 512 MiB, with a 120 s transport timeout and
300 s overall stage deadline; dependency installation is capped at 180 s.
The browser waits at most 310 s for the stage response. Only one stage or
rollback can write managed state at a time.
