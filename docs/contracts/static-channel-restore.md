# SP56 static release channel archive restore

`pnpm release:channel-restore <signed-manifest> <public-key.pem>
<channel-dir>` previews restoration of exactly one missing archive. Add
`--apply` to copy it from the retained SP49 signed release into the local SP52
channel. The archive must be in the same directory as the supplied manifest.

The command takes the channel's `.publish.lock`, verifies the current
`latest.manifest.json` signature, then checks the source signed manifest and
archive against the same pinned Ed25519 public key, exact byte count and
SHA-256. The current channel archive can be missing, so this also repairs a
missing current archive. Version ordering is irrelevant: the command never
changes the manifest. A target path that already exists is refused, even if
damaged. The operator must investigate or remove that file separately.

Preview creates and removes only the lock file. Apply copies into a temporary
channel directory, verifies the staged archive, and creates the final immutable
archive name with an exclusive hard link. It cleans the stage and lock; a crash
may leave them for operator inspection. The fixed manifest, all other channel
files, managed installations and application data remain untouched. The
operator controls hosting, TLS and signing keys; no real channel is configured
or contacted by this command.
