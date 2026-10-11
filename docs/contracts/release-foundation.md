# SP49 release foundation

The installed version is the `version` in `apps/server/package.json`. Release
versions use SemVer core and optional prerelease identifiers (no build
metadata); this is a prerelease until a release is published. Authenticated
`GET /api/settings/runtime` includes `appVersion`; General displays it.

`pnpm release:pack <new-output-dir> <private-key.pem>` requires a prior `pnpm build`
and creates `aigate-<version>.tar.gz` plus `aigate-<version>.manifest.json` in
a new output directory. It refuses to replace an existing path. The package contains only built app files, database
migrations, package manifests, `pnpm-workspace.yaml` and `pnpm-lock.yaml`.
It excludes `node_modules`, source, tests, data, `.env` and signing keys. A
recipient installs production dependencies from the frozen lockfile before
launching `node apps/server/dist/main.js`. Node >=22 and pnpm are required.

Manifest v1 fields: `format`, `version`, `artifact`, `bytes`, `sha256`,
`signature`. The Ed25519 signature covers UTF-8 JSON of the first five fields
in that exact order, without whitespace. `pnpm release:verify <manifest>
<public-key.pem>` verifies the pinned public key, manifest shape, artifact
basename, file size and SHA-256. Both files must be in the same directory.
The manifest does not carry a public key or arbitrary download URL. A release
publisher must distribute the public key and channel URL independently.

SP49 performs no remote request or installation. No channel is configured by
default; automatic update and recovery belong to a later SP. The 9router npm
global updater is intentionally not reused because this project has no npm
release channel and its process-kill behavior is outside this contract.
