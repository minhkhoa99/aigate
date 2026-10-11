# SP49 — release foundation

Base: clean `1c51f00`. SP48 is verified. This slice makes versioned, relocatable
built artifacts and a signed channel manifest. It does not download, install,
restart or publish an update.

## Contract and bounds

1. Set one server package SemVer prerelease version. `GET /api/settings/runtime`
   exposes that installed version and General displays it in EN/VI.
2. Package only explicit built server/web/engine/database files, database
   migrations, workspace manifests and frozen lockfile. No source, tests,
   `node_modules`, `.env`, secret, database or user data. The recipient runs
   `pnpm install --prod --frozen-lockfile`; `node apps/server/dist/main.js`
   then serves the built web. No auto-install in the dashboard.
3. Build a tar.gz and a canonical manifest with exact version, artifact name,
   byte count and SHA-256. Sign the manifest with a supplied Ed25519 private
   key. The signing key and channel URL are operator-owned, never generated or
   committed by the product. Verification pins a separate public key, checks
   signature and artifact hash before the package may be trusted.
4. Release CLI rejects invalid version/artifact paths, missing builds, external
   links and unsigned output. Local tests use a generated synthetic signing key
   and isolated temporary paths. No vendor or release service is contacted.

## Work and gates

- [x] Implement bounded packaging and verification commands.
- [x] Add installed version to runtime and General.
- [x] Test tamper, wrong key, relocation and startup from a synthetic extracted
      release. The CLI checks missing builds; no destructive live-build removal
      was needed to test that guard.
- [x] Run focused checks, build, lint, discovery, diff and AST graph refresh.
- [x] Update contract, API/UI map, matrix and handoff; local checkpoint only.

SP50 may add a pinned release channel and opt-in check/install flow after an
actual publisher/key distribution policy is decided.
