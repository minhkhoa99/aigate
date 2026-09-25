# Parity report (M1 gate)

Generated 2026-09-25T18:39:18.977Z by `pnpm parity gate`. Tapes recorded from 9router@0.5.55.

| Check | Result |
|---|---|
| Tier 1, client contract | 11/11 tapes PASS |
| Tier 2, vendor acceptance | not run (set OPENAI_API_KEY and run `pnpm parity live`) |
| Tier 3, upstream drift | 3 warnings (non-blocking) |
| Golden scenarios | 10 pass, 0 fail, 3 deferred |
| Coverage (tapes / docs/capabilities.md) | 11/284 |
| Matrix parityStatus | traced 236, implemented 33, contracted 15 |

## Tapes

| Tape | Tier 1 | Intentional deviations | Tier 3 warnings |
|---|---|---|---|
| json-tool-call | PASS | `usage` (SUSPECTED_BUG, routing.non-streaming-response) | none |
| normal-json | PASS | `usage` (SUSPECTED_BUG, routing.non-streaming-response) | none |
| omitted-stream | PASS | `*` (SUSPECTED_BUG, routing.stream-mode-decision) | stream |
| stream-cut | PASS | `terminal` (SUSPECTED_BUG, fallback.partial-stream-failure)<br>`error` (SUSPECTED_BUG, fallback.partial-stream-failure) | stream_options |
| stream-text | PASS | none | none |
| stream-tool-call | PASS | `usage` (SUSPECTED_BUG, routing.streaming-pipeline) | stream_options |
| upstream-400-context | PASS | `error` (REFERENCE_BEHAVIOR, fallback.upstream-error-result) | none |
| upstream-401 | PASS | `status` (SUSPECTED_BUG, fallback.upstream-error-result)<br>`error` (REFERENCE_BEHAVIOR, fallback.upstream-error-result) | none |
| upstream-429-quota | PASS | `error` (REFERENCE_BEHAVIOR, fallback.upstream-error-result) | none |
| upstream-429-rate | PASS | `error` (REFERENCE_BEHAVIOR, fallback.upstream-error-result) | none |
| upstream-500 | PASS | `status` (REFERENCE_BEHAVIOR, fallback.error-classification)<br>`error` (REFERENCE_BEHAVIOR, fallback.upstream-error-result) | none |

## Deferred golden scenarios

- golden: token refresh — needs OAuth credentials (SP16): M1 has API-key accounts only
- golden: account failover — needs several accounts per provider (SP17)
- golden: provider fallback — needs several providers and a fallback policy (SP17, SP19)
