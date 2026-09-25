# Parity harness contract (M0 SP3) and the M1 acceptance gate

The harness implements spec §8: tapes, replay, a normalizer, the three tiers, and a coverage report. It lives in `tools/parity/` and is dev-only: it is excluded from the build and never published. **SP3 has no UI.** The latest gate report is `docs/parity/m1-gate-report.md`, which `pnpm parity gate --out docs/parity/m1-gate-report.md` writes.

## Commands

| Command | What it does | Network |
|---|---|---|
| `pnpm parity record [--only ids]` | Records one tape per scenario from a running 9router (`NINEROUTER_URL`, default `http://localhost:20128`; `NINEROUTER_PASSWORD`, default the 9router default) | Local only: 9router and a scripted vendor |
| `pnpm parity replay` | Replays every tape against AIGate. Tier 1 PASS/FAIL, tier 3 warnings. | None |
| `pnpm parity live` | Tier 2: sends AIGate's upstream requests to the real OpenAI API (`OPENAI_API_KEY`, never stored) | OpenAI, one request per success tape, at most 16 output tokens |
| `pnpm parity gate [--out file]` | Runs replay, the 13 golden scenarios, and coverage, plus tier 2 when a key is set; prints the report | None without a key |

`pnpm test` runs `tools/parity/test/parity.test.mjs`, so CI replays every committed tape.

## How a tape is recorded

```
recorder ──> 9router :20128 ──> scripted vendor (tools/parity/src/vendor.mjs, 127.0.0.1)
                                  └─ records the upstream request
```

- **9router's code is not changed.** Recording creates a temporary OpenAI-compatible provider node, a connection with a fake key, and a client key, all named `AIGate parity (temporary)`. `cleanup()` deletes everything with that name before and after each run, so nothing of the user's is touched. No real vendor is called.
- **Deviation from spec §8.2.** The spec points 9router's `outboundProxyUrl` at a recording proxy. Upstream traffic is HTTPS, so a forward proxy would see only an encrypted tunnel unless it ran a MITM CA that 9router trusted. Pointing an OpenAI-compatible node's `baseUrl` at a local scripted vendor records the same request in plain HTTP, with no CA and no change to 9router's settings. A real-vendor recording proxy returns with M2, when tapes need vendor behaviour that a script cannot know.
- **One model id per scenario** (`aigateparity/parity-<id>`), because 9router locks a failing account per model; without it, an error tape would poison the next tape.
- **Token Saver bypass.** Each recording request sends `x-9router-token-saver: off`. The recorded instance had Token Saver on, which injects a system prompt and changes usage. AIGate has no Token Saver until SP21. Only that request is affected; 9router's settings are unchanged.
- **Secrets.** The vendor masks `Authorization` and similar headers to their scheme (`Bearer ***`). The test "tapes never hold a credential" enforces it.

A tape records: `{ id, title, gateway, recordedAt, covers, clientRequest, upstreamRequest, upstreamCalls, upstreamResponse, clientResponse }`.

## How a tape is judged

- **Normalizer** (`normalize.mjs`, spec §8.3):
  - Frozen: ids, `created`, `system_fingerprint`, header order, SSE chunk boundaries, and error prose.
  - Compared: `kind`, `status`, the joined text and reasoning, tool calls by index (`id`, `name`, joined `arguments`), `finishReason`, `usage`, the terminal (`done` / `error` / `none`), and the error `type` and `code`.
- **Tier 1** (`judge`): every difference from 9router must be a **declared deviation** in `scenarios.mjs`, with its path, the expected AIGate value, the matrix entry, a label, and the reason. It fails in three cases: an undeclared difference, a declared deviation where AIGate shows another value, or (in the test) a stale deviation.
- **Tier 2**: the upstream request AIGate produced is sent to OpenAI. It passes on a 2xx of the right class: a finished SSE stream for a stream request, a `chat.completion` otherwise.
- **Tier 3**: the semantic difference of the upstream request body, with the model id ignored. It only warns.

## What recording 9router 0.5.55 showed

The running reference is 0.5.55; the Feature Matrix was traced at 0.5.86. Findings, now in the matrix and declared as deviations:

| Tape | 9router | AIGate | Entry and label |
|---|---|---|---|
| `normal-json`, `json-tool-call` | usage +2000 (`addBufferToUsage`: 12/17 becomes 2012/2017) | the vendor's numbers | `routing.non-streaming-response`, now `SUSPECTED_BUG` |
| `stream-tool-call` | an invented usage estimate, +2000, sent without `include_usage` | no usage chunk unless asked | `routing.streaming-pipeline`, `SUSPECTED_BUG` |
| `omitted-stream` | no `stream` sent upstream; the JSON answer is sent as `text/event-stream` followed by a bare `data: [DONE]`, so it is readable as neither | JSON, the OpenAI default | `routing.stream-mode-decision`, `SUSPECTED_BUG` |
| `stream-cut` | the stream ends silently, with no error and no `[DONE]` | an error event, no `[DONE]` | `fallback.partial-stream-failure`, `SUSPECTED_BUG` |
| 4xx/5xx tapes | `{ error: { message } }` only; the message holds the internal node id and the raw upstream body | the OpenAI shape with `type` and `code` | `fallback.upstream-error-result` |
| `upstream-401` | 401 | 502 `upstream_auth_error` | `fallback.upstream-error-result`, `SUSPECTED_BUG` |
| `upstream-500` | 500 | 502 `provider_unavailable` | `fallback.error-classification` (gateway semantics, `protocol-openai.md`) |

`stream-text` matches 9router exactly. Tier 3 has 3 warnings, all expected:
- AIGate always sends `stream_options.include_usage` when streaming.
- AIGate always sends `stream: false` for JSON; 9router omits it.

## M1 acceptance gate (spec §9)

| Criterion | Result |
|---|---|
| Tier 1 clean | **11/11 tapes PASS** |
| Tier 2 clean | Needs an OpenAI key: `pnpm parity live`. Not run in CI. |
| 13 golden scenarios | **10 pass, 0 fail**. Deferred: 3, because they need several accounts or providers (SP17, SP19) or OAuth (SP16). They are skipped with that reason in `apps/server/test/golden.test.mjs`. |
| Coverage | 11/284 capabilities are covered by tapes. The M2 threshold is still open (spec §12). |

Golden scenarios at M1 scope:
- **Rate limit and quota:** the right code, with no blind retry.
- **All providers unavailable:** attempts bounded by the in-place retry budget.
- **Usage:** asserted on the response, since persistence is SP24.

## Tests

- `tools/parity/test/parity.test.mjs`:
  - every tape passes tier 1 with no stale deviation
  - tapes hold no credential
  - SSE is compared by meaning
  - `judge` fails on an undeclared difference or a wrong AIGate value
  - coverage ids are real capabilities
- `apps/server/test/golden.test.mjs`: the 13 golden scenarios.
- Mutations caught:
  - AIGate buffering usage like 9router
  - an upstream 401 passed through as 401
  - the normalizer ignoring the terminal
