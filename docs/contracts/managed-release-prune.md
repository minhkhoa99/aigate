# SP53 managed release cleanup

`pnpm release:prune <managed-root>` lists the release directories in a managed
installation. The current, previous rollback and pending versions are
protected. `pnpm release:prune <managed-root> <version> --apply` explicitly
removes only that named unreferenced version. Both commands take the existing
`.update.lock` and re-read `state.json`; a concurrent stage or rollback causes
a busy refusal. Launcher activation may update state without this lock, but
its next current/previous versions are already protected as pending/current
in the state snapshot. The tool cannot restart or change the running version.
Run the command from this checkout after `pnpm build`, or from a release
package that includes SP53; an older installed stable launcher does not gain
a new command automatically.

The root must contain a regular managed `state.json`, stable `launcher.mjs` and
regular `releases` directory with a valid current release marker. The scan
stops above 256 direct entries. Only direct SemVer-named release directories
with a matching small server package
manifest and release launcher are eligible. Top-level symlink/junction entries,
unknown entries and paths outside `<root>/releases` are never selected. Nested
dependency junctions are unlinked with the selected release; their targets
remain intact. The exact current, previous and pending versions cannot be
selected even if their files are incomplete.
The tool does not inspect or change application data, signing keys or the
release channel.

An interrupted deletion may leave a partial unreferenced directory and a
stale lock. An operator must confirm no managed operation is running and
inspect that directory before removing the lock or finishing cleanup. There
is no automatic pruning or retention count in SP53.
