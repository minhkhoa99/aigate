# Providers, AuthFlow and Connections EN/VI (SP45 / M3 U4)

SP45 extends the existing browser-local EN/VI system to the already-wired U4
dashboard screens: `/providers`, `/providers/detail`, `/providers/new`,
`/providers/connections`, custom-provider forms, Models panels, and the existing
OAuth/token AuthFlow. It adds no API, dependency, database field or browser
preference. The existing `LocaleProvider`, `aigate-language` storage, fallback,
render-time interpolation and `shared/errors.ts` boundary remain authoritative.

## Owned copy and literal data

Owned headings, descriptions, labels, hints, buttons, tabs, status labels,
empty/loading/error/retry states, mutation notices and AuthFlow instructions
use the selected EN/VI catalog. Provider/model/account names and IDs, custom
prefixes, URLs/endpoints, callback addresses, protocol/wire values, API error
codes, server/vendor diagnostics, raw OAuth tokens/codes and credential payload
values remain literal. Technical names such as `/models`, `/v1`, `state.vscdb`,
`kiro://`, `Cloud-IDE-JWT`, `AWS`, `GitLab`, `Cursor` and `Kiro` are not
translated when they identify a protocol, product, file, field or provider.

## Lifecycle invariants

- EN↔VI changes update visible U4 copy without changing query keys, refetching
  catalog/connections/models, reopening OAuth/device polling, restarting a
  callback session, clearing a typed form, replacing a reviewed/pending action,
  or replaying a mutation.
- Existing explicit actions remain explicit: Add/Save and test, Test, Import,
  model Test, OAuth authorization/device approval, token import, Enable/Disable,
  priority, Replace/Edit and Delete. No locale effect performs any action.
- Existing `ApiError` codes remain visible and use `toProblem`; permitted raw
  diagnostics stay verbatim. Read failures retain Retry and mutation failures
  retain their current toast/error boundary.
- Credential values are never added to copy, catalogs, logs or test fixtures.
  Existing one-time/import behavior is unchanged.

## Acceptance boundary

Focused native checks cover matched EN/VI catalogs and provider status/test
messages. Isolated browser acceptance uses synthetic same-origin API responses,
fake transport and disposable state only. It checks provider/catalog/detail,
custom provider, Connections, AuthFlow branches, retained state and 390px
layout; it makes zero real vendor calls, uses no real credential and writes no
user or host configuration data.
