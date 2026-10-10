# CLI Tools discovery and core adapters EN/VI (SP43 / M3 U10)

SP43 localizes owned copy on `/integrations/cli-tools` and the Claude Code,
Codex, OpenCode and Cline detail screens. Discovery remains a read-only report
of the AIGate server host's PATH and standard config paths. Tool names, paths,
model IDs, base URLs, API codes, permitted server diagnostics and server-authored
diff lines remain literal. The other CLI adapter detail screens retain their
existing presentation and behavior.

These four detail screens retain the SP25 server-owned Preview→Apply flow:
five-minute one-use preview ID, redacted bounded diff, stale-file refusal,
backup and atomic write. The UI does not read saved secrets. Changing locale
while mounted does not fetch, create/apply/reset a preview, erase form input,
or replace the reviewed preview. An explicit new Preview clears the old review.
While Preview or Apply is pending, other preview/reset/apply/cancel actions are
disabled. `PREVIEW_EXPIRED` and `CONFIG_CHANGED` clear stale review and show
their code with localized advice to review a fresh diff. Read failures show
code, permitted diagnostic and Retry. Mutation failures preserve form input;
success clears the typed API key. Expiry time uses the selected browser locale.

Acceptance uses synthetic same-origin API replies in an isolated browser. It
does not call a vendor, access a real credential or touch a user's CLI files.
