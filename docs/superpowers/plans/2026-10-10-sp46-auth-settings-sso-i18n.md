# SP46 / M3 U2 — Auth settings OIDC/SAML EN/VI

Base: clean `44146a9` on `feat/m1-discovery`. Localize the existing visual-only
OIDC and SAML tabs in `/settings/auth` without claiming the deferred M2 SSO
backend exists.

## Scope

- Localize the OIDC panel title/description, client-secret/issuer/client-ID
  presentation, Save control and the existing SAML panel description/warning.
- Keep `OIDC`, `SAML`, OpenID Connect, SAML 2.0, URLs, client IDs, certificates,
  assertion URLs and technical protocol names literal where they identify a
  protocol or input value.
- Preserve the existing tabs, visual-only controls, `SecretField` behavior,
  `CopyField` value, local state and current no-op buttons.
- No OIDC/SAML HTTP route, API hook, payload, backend status, dependency,
  database field or error mapping is added. The waiting-for-backend boundary
  remains explicit in the map and handoff.

## Acceptance plan

1. Record this plan, contract and Feature Matrix extension before product edits.
2. Add matched EN/VI catalog keys and render the two existing panels through the
   shared locale at render time.
3. Run focused locale tests and isolated Edge acceptance with no backend calls:
   mount Auth settings, switch EN↔VI across OIDC/SAML, preserve tabs and literal
   SAML assertion URL, and check 390px no-overflow.
4. Run build, lint, discovery validation, AST-only graph/project-map refresh,
   staged/unstaged diff checks, then update docs and create a local checkpoint.

## Ledger

- [x] Scope, contract and Feature Matrix entry recorded before product edits.
- [x] Product implementation and focused checks (10/10 targeted locale/provider checks).
- [x] Isolated browser acceptance: OIDC/SAML tab state survived EN→VI, literal
  assertion URL remained, and the fixture made one existing settings read.
- [x] Build, lint, discovery (379 entries), AST graph/project-map refresh and diff gates.
- [x] Handoff, API↔UI map and local checkpoint created with this SP46 commit.
