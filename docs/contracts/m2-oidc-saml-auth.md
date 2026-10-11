# M2 OIDC/SAML authentication contract

This contract adds functional OIDC and SAML dashboard authentication to the
existing AIGate identity/session system. It is a native implementation of the
behavior traced in `01-endpoint-apikey-settings.yaml`; it does not copy the
reference framework or its SAML replay gap.

## Configuration API

`GET /api/settings` returns `authMode`, non-secret OIDC/SAML fields and boolean
`oidcConfigured`/`samlConfigured`; it never returns the OIDC client secret or
certificate. `PATCH /api/settings` accepts validated auth fields. OIDC secret is
sealed with the existing `SecretCipherPort`; SAML certificate is sealed as
well. Empty secret/certificate on PATCH preserves the current value, while an
explicit clear is rejected until a future reset contract exists.
`ssoPublicOrigin` supplies the HTTPS origin for reverse-proxy callback and
metadata URLs; loopback HTTP is accepted for local development. Remote HTTP,
URL credentials, fragments, and a path on the public origin are rejected.
Portable settings export/import excludes every SSO field and credential.

`POST /api/auth/oidc/test` requires the existing dashboard session when
`requireLogin` is true. It accepts issuer/client/scopes/secret overrides,
performs bounded discovery and an invalid-code token probe, and returns no
secret. `POST /api/auth/saml/test` has the same gate but performs only URL,
issuer and certificate-shape validation.
OIDC test reports `clientSecretValid: false` for `invalid_client`, `true` for
`invalid_grant`/`invalid_code`, and `null` when the IdP response is inconclusive.

## Login flows

- `GET /api/auth/oidc/start` is public and returns 302 only when OIDC is
  enabled/configured. It stores state, nonce and PKCE verifier in a bounded,
  one-use process-local pending record for 10 minutes, sets an HttpOnly state
  cookie, and sends S256 authorization parameters.
- `GET /api/auth/oidc/callback` requires code/state and matching live cookies,
  exchanges code, validates ID-token signature/issuer/audience/nonce, creates
  the normal AIGate session, clears transient cookies and redirects to `/`.
- `GET /api/auth/saml/start` is public and returns 302 only when configured.
  It creates a bounded in-memory one-use pending request and state cookie.
- `POST /api/auth/saml/acs` accepts only a bounded form body, requires and
  consumes a matching pending request/state, verifies signed SAML, extracts a
  bounded subject/email/name values, creates the normal AIGate session and
  redirects to `/`. The current opaque session stores no IdP profile claims.
  Missing, expired, mismatched or replayed state is rejected.
- `GET /api/auth/saml/metadata` is public and returns generated XML only after
  configuration is present.

Failures redirect browser login flows to `/login?error=<stable-code>` and API
test/configuration failures return `{code,message}` through the existing error
boundary. Raw IdP diagnostics are bounded and never include client secrets.
SSO session cookies are `Secure` when the configured public origin uses HTTPS,
including when Fastify receives plain HTTP behind a TLS reverse proxy.

## Verified evidence

Synthetic IdP tests cover OIDC discovery/PKCE/JWKS/issuer/audience/nonce,
client-probe outcomes and 64 KiB response bound; signed SAML login/metadata,
one-use replay refusal, tamper/config/state failures and the ACS-only 256 KiB
form boundary. The focused identity/settings/SSO run passes 21/21, database
migration conformance 6/6, and shared web i18n checks 10/10. An isolated Edge
fixture verified Auth settings EN/VI draft preservation, save/test feedback,
saved ACS origin, login error rendering and 390px layout without a real IdP.
