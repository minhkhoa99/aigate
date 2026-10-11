# SP54 static release channel rollback

`pnpm release:channel-rollback <prior-signed-manifest> <public-key.pem>
<channel-dir>` previews an operator-selected earlier release. Add `--apply` to
replace the fixed `latest.manifest.json`. The operator must retain the older
SP49 signed manifest and its archive must already exist in the SP52 channel.
The command verifies the current manifest signature and the target manifest
plus its channel archive against the same pinned Ed25519 key, exact archive
size and SHA-256. A missing or damaged current archive does not block recovery.
The target must be strictly older by full SemVer. It refuses symlinked channel
paths, wrong keys, a tampered or missing target archive, an invalid current
manifest, same/newer versions and a concurrent `.publish.lock`.

Apply verifies again under that lock, copies the small signed manifest to a
temporary file in the channel, verifies the staged copy, then atomically
replaces only `latest.manifest.json`. Other manifests, archives, signing keys,
managed installations and user data are untouched. Preview creates and
removes only the lock file. This is an operator action; there is no dashboard
mutation, automatic rollback, hosting or real release key in SP54.
Clients already running a newer version will see no update to the older
channel version; their SP51 managed rollback remains a separate local action.
SP55 can explicitly remove an unreferenced archive. An operator must retain
the target archive in the channel to use this rollback command.
