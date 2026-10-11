# SP55 static release channel archive cleanup

`pnpm release:channel-prune <signed-manifest> <public-key.pem>
<channel-dir>` previews removal of one archive; append `--apply` to remove it.
The manifest is a retained SP49 signed manifest for that archive. Preview
changes no release file, though it briefly creates the SP52 `.publish.lock`.

Under that lock, the command verifies the current `latest.manifest.json` and
its archive, plus the selected manifest and its archive in the channel, using
the same pinned Ed25519 key, exact byte count and SHA-256. The selected version
must differ from the current version. The signed artifact basename fixes the
only path eligible for removal. Invalid/symlinked paths, a missing or damaged
archive, wrong key, invalid current channel or busy lock refuse. Apply performs
the same verification immediately before removing that single regular archive. The current
manifest/archive and all other channel files remain intact.

This is an explicit operator action for a local channel directory. It never
contacts hosting, clients or AI vendors and never changes a managed install or
application data. Removing an archive makes a retained manifest for it unusable
for SP54 rollback until a valid archive is restored; operators must check
hosting/download needs before applying. A concurrently served download may
fail if its host reads the removed file after deletion.
