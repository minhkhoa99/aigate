# Auth settings OIDC/SAML EN/VI (SP46 / M3 U2)

SP46 localizes the existing visual-only OIDC and SAML panels in
`/settings/auth`. The M2 OIDC/SAML backend remains deferred; these controls do
not save, test, or authenticate anything in this slice.

## Presentation boundary

Owned headings, descriptions, labels, warnings and button copy use the shared
browser-local EN/VI catalog. `OIDC`, `SAML`, OpenID Connect, SAML 2.0, issuer and
assertion terminology, URLs, client IDs, certificates and copied assertion URLs
remain literal protocol/input data. The existing `SecretField`, `CopyField`,
tabs and visual-only buttons remain unchanged in behavior.

## Lifecycle and safety

- Switching language only rerenders copy; it does not change the selected tab,
  input values, copied URL, query state or submit behavior.
- No OIDC/SAML API is called, no credentials are created or sent, and no vendor
  or identity provider is contacted.
- This presentation slice does not mark the deferred SSO backend as wired.

Acceptance uses an isolated browser with no backend/vendor calls and synthetic
local state only. The result is a UI localization verification, not an SSO
functional or accessibility certification.
