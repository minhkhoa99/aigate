# SP52 local static release channel

An operator creates an empty local directory, then runs `pnpm release:publish
<signed-manifest> <public-key.pem> <existing-channel-dir>`. The source files are
an SP49 signed manifest and its same-directory archive. The command verifies
the pinned Ed25519 signature, exact archive length and SHA-256 before writing.
The public key must be a regular file no larger than 4 KiB.
It stages and verifies the copy inside the channel, moves the immutable archive
into place, and finally atomically changes `latest.manifest.json`. The fixed
manifest and archive are served from the same HTTPS directory; managed clients
pin that URL and the public key independently. A real host, TLS setup and
signing keys are operator-owned and are not configured by this SP.

An existing channel must verify with the same public key. A new version must
sort above the current one by full SemVer; an existing archive basename is
never overwritten. Old archives remain available. The publisher refuses
symlinked channel files/directories and concurrent writers with an exclusive
`.publish.lock`; a stale lock after a crash requires operator inspection.
Failed publication leaves the last manifest intact. No dashboard API, UI
mutation, vendor call, process restart or user-data access is involved.

SP54 adds explicit rollback of the fixed channel manifest using a retained
older signed manifest; see `static-channel-rollback.md`.
SP55 adds explicit cleanup of one archive no longer referenced by that
manifest; see `static-channel-prune.md`.
