# Media Providers dashboard (SP31 / M3 U5)

Status: verified for Native completion on 2026-10-09. This SP uses existing dashboard APIs;
it adds no server route, database table, dependency or vendor request.

`GET /api/providers` supplies `serviceKinds` (catalog claim) and `routeKinds`
(AIGate implementation). `GET /api/connections` supplies saved accounts and
their enabled/test state. A media kind is **configured** only when a provider
has that route kind and at least one enabled account. A catalog route without
an account is **ready to connect**, not active or healthy. A provider that
advertises a kind without an AIGate route is **route unavailable** even if an
account is saved. Disabled accounts do not make a kind configured. Loading or
failed connection data must not be rendered as zero accounts.

The nine kind names/endpoints remain in `features/providers/catalog.ts`.
The root shows live catalog-route and configured-provider counts separately.
Every kind remains browsable; a kind with no configured provider is visually
marked, with a clear empty or connection action. The kind page lists each
catalog provider and its route/account state. An invalid kind or a provider
not belonging to the requested kind gets a Not found state with a route back.
Provider detail lists all its saved accounts and their actual test status.
No endpoint copy is offered on a provider detail without a working route.

TTS keeps the existing voice list/preview contract in `speech.md`. The voice
browser mounts only after both catalog and connection reads succeed. Opening
TTS can fetch a live voice list through the existing dashboard endpoint, which
may contact that provider; playback remains user-initiated. Existing voice
fetch/preview cancellation, limits and error messages remain owned by
`voice-browser.tsx`; SP31 adds no vendor path.

Acceptance: empty/configured/unsupported combinations, disabled accounts,
loading/error/Retry, wrong links, TTS voice gating and mobile layout are
verified with synthetic state and, where needed, an isolated browser fixture.
No full test suite or real provider credential is required.

SP32 extends this dashboard with EN/VI copy through `shared/locale.tsx`. Its
nine route IDs and endpoints remain stable while kind labels, cards, account
status, empty/not-found/read-error states and actions re-render in the chosen
language. Provider names/IDs, account names, provider reasons and stored account
errors remain literal. The route/account decision logic and fetch keys are
unchanged. See `i18n.md` for locale lifecycle and `speech.md` for voice limits.

Evidence: media/catalog/connection-status web checks 5/5, selected server
catalog/voice checks 4/4, isolated Edge acceptance for route/account states,
TTS, wrong links, network Retry and 390px layout. The disposable fixture made
zero calls to its fake upstream transport. Build, lint and discovery validation
passed; the latter accepted 364 matrix entries.
