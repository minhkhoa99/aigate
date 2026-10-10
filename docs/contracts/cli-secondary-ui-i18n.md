# CLI adapter detail EN/VI (SP44 / M3 U10)

SP44 localizes the remaining 14 CLI detail routes: Droid, Copilot, Crush, Pi,
Smelt, CodeWhale, Forge, DeepSeek TUI, Kilo, Hermes, JCode, Oh My Pi, Grok
Build and OpenClaw. These screens retain their existing SP25 status, preview
and apply endpoints and payloads. Tool and agent names, paths, models, URLs,
API codes, permitted diagnostics and redacted server diffs remain literal.

`AIGATE_EXTENSION` UI rules: a mounted language change translates owned copy
and expiry time without fetching, submitting, clearing drafts or replacing a
review. Preview clears the previous review before requesting another. Pending
preview/apply blocks other mutations and cancel. Apply requires a nonempty
reviewed diff. Expired or changed previews clear review and require a new one;
other mutation errors preserve input. Read errors expose code, diagnostic and
Retry. Success clears the typed key. No browser action writes a CLI file before
explicit Apply. Server preview expiry, file backups and atomic writes are owned
by SP25 and unchanged.

Acceptance uses synthetic same-origin responses and an isolated browser, with
no vendor calls, real credentials or writes to host CLI configuration.
