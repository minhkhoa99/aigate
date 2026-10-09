# Token Saver contract (M2 SP21)

The token saver transforms a chat request immediately before provider dispatch. It is a fixed, fail-open pipeline: RTK tool-result compression, optional Headroom compression, Caveman prompt injection, Ponytail prompt injection, then optional PXPIPE image conversion. The `x-aigate-token-saver: off` request header bypasses every stage. The header is case-insensitive; other values do not opt out. Compression can reduce input tokens, while Caveman and Ponytail add input tokens; total savings are request- and provider-dependent and are not currently measured by AIGate. See `docs/discovery/feature-matrix/07-token-saver.yaml` for the traced rules and evidence.

RTK only rewrites successful tool output between 500 B and 10 MiB. It detects common structured output (git diff/status/log, build logs, grep/find results, directory listings, and long numbered or noisy output), compresses it, and keeps the original whenever the result is empty or not shorter. Error tool results are never rewritten.

## Decisions

| Rule | Label | AIGate |
|---|---|---|
| Fixed five-stage order, with per-stage settings | `REFERENCE_BEHAVIOR` | Keep. |
| RTK compresses supported tool-result wire shapes, skips errors, and never grows or empties content | `REFERENCE_BEHAVIOR` | Keep. |
| Headroom is an optional bounded HTTP call; invalid or failed responses leave the request unchanged | `REFERENCE_BEHAVIOR` | Keep, with an explicit timeout and response-shape validation. |
| Caveman and Ponytail add idempotent system instructions | `REFERENCE_BEHAVIOR` | Keep for supported request protocols. |
| PXPIPE transforms eligible Anthropic Messages requests above the configured size threshold; failures and timeouts leave the request unchanged | `REFERENCE_BEHAVIOR` | Keep; explicit dashboard installation enables the optional transform. |
| `x-aigate-token-saver: off` does not gate PXPIPE | `SUSPECTED_BUG` | Correct: opt-out bypasses all five stages, as required by the product spec. |
| 9router process spawning, install shell commands, Next.js proxy routes, and console-only statistics | `IMPLEMENTATION_ACCIDENT` | Replace with native in-process services and AIGate settings/API patterns; do not add a child-process manager for Headroom. |

## Runtime guarantees

- Every stage receives the result of the preceding stage and runs in the order above.
- A disabled stage is a no-op. Optional services that are missing, time out, return malformed data, or throw fail open to the prior body.
- Headroom currently accepts only plain-text conversations without tools, media, or reasoning. It has a bounded timeout and 16 MiB response limit; user messages are protected unless `headroomCompressUserMessages` is enabled.
- Provider errors, client errors, and cancellation keep their existing behavior; the saver does not retry a request or alter the response.
- An opt-out request reaches the provider with the client's original parsed request and does not trigger external saver calls or image conversion.
- PXPIPE is installed on demand by the authenticated dashboard into the AIGate data directory's pxpipe folder, then loaded through the package's public transform export in-process. It is not an AIGate build dependency.
- PXPIPE is applied only to Anthropic Messages provider requests, after adapter serialization and before transport send; the configured character threshold and timeout are honored, with a 16 MiB request-body ceiling. Installation and transform failures do not prevent normal AIGate requests.
- Stage configuration is persisted through the typed settings API. The dashboard reports configuration and package availability; it must not show fabricated usage totals.

## Out of scope

Persisted savings analytics and historical token totals are not part of this request pipeline. PXPIPE remains optional; installation is explicit and isolated to the AIGate data directory.

## Dashboard EN/VI (SP35)

The existing `/gateway/token-saver` screen uses the shared EN/VI catalog for
owned labels, stage and PXPIPE status, validation/read errors and feedback.
Locale changes retain the mounted Headroom URL draft and pending operations;
they do not PATCH settings or install PXPIPE. A status read failure has code,
diagnostic and Retry, distinct from an absent package. An installed package
whose transform cannot load offers an explicit reinstall action. Stage IDs,
the opt-out header and persisted level values remain literal. See
`token-saver-ui-i18n.md` for the browser contract and acceptance boundary.
