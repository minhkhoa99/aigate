# M2 OIDC/SAML authentication — implementation plan

Baseline: `d7e9e8e`. User approved the M2 remainder after SP46 and explicitly
approved fixing the reference SAML replay gap.

## Contract decisions

- **REFERENCE_BEHAVIOR:** OIDC authorization-code + PKCE uses state, nonce,
  S256 verifier, discovery, token exchange, issuer/audience/nonce ID-token
  validation, and creates the existing AIGate session cookie.
- **REFERENCE_BEHAVIOR:** OIDC/SAML configuration is edited in Auth settings;
  secrets are never returned by GET. OIDC test discovers the issuer and probes
  the token endpoint with a bounded invalid code. SAML test is local shape
  validation and never contacts the IdP.
- **REFERENCE_BEHAVIOR:** SAML start creates an AuthnRequest and correlation
  state; ACS accepts a form POST, verifies a signed assertion, extracts a
  bounded identity and creates the existing session.
- **SUSPECTED_BUG rejected by user:** missing SAML state must not bypass replay
  protection. AIGate requires a live, one-use pending request and matching
  `InResponseTo`; replay, missing or expired state is rejected.
- **IMPLEMENTATION_BOUNDARY:** external calls go through the existing bounded
  `HTTP_TRANSPORT`; fake transport is injected in tests. No real IdP is used in
  verification.

## Ordered implementation

1. Add typed settings columns and migration for auth mode, OIDC/SAML metadata,
   sealed OIDC secret, and bounded pending SAML request records.
2. Add identity SSO service/controllers: status/config save, OIDC start/callback,
   SAML start/ACS/metadata, and protected OIDC/SAML test routes. Add precise
   `AUTH_ERROR`, `INVALID_REQUEST`, `RATE_LIMITED`, `OIDC_*`, `SAML_*` codes.
3. Wire Auth settings fields/actions and login buttons/callback handling; keep
   the existing locale and preserve literal protocol values/raw diagnostics.
4. Add targeted contract tests for settings secrecy, PKCE/state/nonce, fake
   token/JWKS, SAML test/metadata, missing/mismatched/expired/replayed state,
   session creation, and bounded failures. Add isolated browser acceptance.
5. Run build/lint/discovery/graph/diff gates and update docs from evidence.

## Security/resource bounds

- OIDC discovery/token/JWKS calls: 8s deadline, bounded 64 KiB JSON, no redirects
  accepted by transport policy, no cache before the first implementation pass.
- Pending SAML requests: max 100 per process, 10-minute expiry, single-use
  consume; request IDs and raw assertions are not persisted.
- SAML body: 256 KiB maximum; callback field and extracted display/email strings
  are bounded before session creation.
- No network/IdP activity occurs on locale change or page render.

## Ledger

- [x] Contract decisions and approved replay deviation recorded.
- [x] Backend schema/service/routes and UI wiring.
- [x] Targeted fake-IdP tests and isolated browser acceptance (21 server, 6 database, 10 web checks).
- [x] Build, lint, discovery, AST graph, staged/unstaged diff checks and docs evidence.
- [x] Local checkpoint, no push.
