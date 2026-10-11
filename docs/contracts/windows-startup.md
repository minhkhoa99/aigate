# SP48 Windows sign-in startup

SP48 adds an explicit, current-user Windows sign-in registration for a built
AIGate server. It does not start, stop, update, or install the running process.
The reference has no matching OS registration; this is an AIGate extension.
The reference's `/api/version` and updater depend on a published `9router` npm
package and are separate from this feature. AIGate currently has no release
channel or package version to compare, so SP48 does not claim auto-update.

`GET /api/settings/startup` returns `{supported,enabled,reason}`. `supported`
requires Windows, `%APPDATA%`, built `apps/server/dist/main.js`, built web
assets, and no active `AIGATE_SECRET_KEY` environment override. `reason` is a
stable code and no local path is returned. An existing foreign or changed file
at the owned Startup filename is reported as a conflict and never overwritten.

`POST /api/settings/startup` accepts exactly `{enabled:boolean,password:string}`
and requires dashboard authorization plus a fresh dashboard password. Local
Mode permits only loopback callers and still requires the fresh password.
Password attempts use the bounded login limiter.
Enable creates a bounded VBScript in the current user's Startup folder with an
exclusive file create. It launches this installation's Node executable and
`dist/main.js` hidden on the next Windows sign-in. Disable removes only the
exact script this installation generated. Both actions are idempotent.
The script contains executable paths, no keys or passwords. It inherits the
login environment and loads AIGate's repository `.env`; process-only overrides
may not be present at the next sign-in. Existing running AIGate processes are
not detected or stopped, so the operator should close any duplicate instance.

The UI in `/settings/general` shows enabled, disabled, unsupported and conflict
states in EN/VI, with a fresh password field for changes. Failures preserve the
current state and show the stable code. `STARTUP_UNSUPPORTED`,
`STARTUP_CONFLICT`, `STARTUP_IO_ERROR`, `UNAUTHENTICATED`,
`INVALID_CREDENTIALS`, `RATE_LIMITED`, and `STARTUP_INVALID_REQUEST` reach the UI.

Acceptance uses a temporary synthetic Startup folder, synthetic executable
and fake service configuration. No real Windows Startup folder or user data is
modified by tests.

Verified 2026-10-11: scoped startup/identity/settings checks 20/20 and
app/bootstrap, backup and startup cross-module checks 8/8, including
Local Mode fresh-password enforcement, conflict preservation and Windows
`cscript` execution of a synthetic Node entry; shared i18n 8/8. Isolated Edge
fixture covered EN→VI draft retention without mutation replay, one explicit
POST and 390px layout. Full build, lint, discovery, AST graph and diff gates
passed. Actual sign-in launch of this installation is an operator action and
was not enabled during acceptance.
