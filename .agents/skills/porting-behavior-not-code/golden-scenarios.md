# Golden scenarios

Before replacing a critical flow, write contract tests that fail against a wrong implementation. Each test states given, when, and then at the contract level: the request and its sequence of upstream results go in, and the response, error code, persisted usage, and side effects come out.

Test outcomes, never calls. Do not assert that function X was called. Assert what a client or stored record can observe.

| Scenario | Given | Then |
|---|---|---|
| Normal completion | One healthy candidate | 200, translated body, usage recorded once |
| Stream completion | Upstream streams to the end | Every chunk in order, a terminal event, usage recorded once |
| Provider timeout | Candidate exceeds the deadline | `TIMEOUT`; fallback only if no chunk was sent |
| Rate limit | Candidate returns 429 | `RATE_LIMIT`; the next eligible candidate is tried |
| Quota exhausted | Account has no quota | `QUOTA_EXHAUSTED`; the account is skipped until reset |
| Invalid credentials | Upstream rejects the credential | `AUTH_ERROR`; no retry with the same credential |
| Token refresh | Access token expired, refresh token valid | One refresh, the request succeeds, the new token persists |
| Account failover | Account 1 fails recoverably | Account 2 of the same provider serves the request |
| Provider fallback | Every account of provider A fails recoverably | Provider B serves it; each attempt is recorded |
| Client cancellation | Client disconnects mid-request | Upstream aborted, no further attempts, partial usage recorded |
| Partial stream failure | Upstream fails after the first chunk | Stream ends with an error event; no retry or fallback |
| Model unavailable | No candidate offers the model | `MODEL_UNAVAILABLE` without calling any upstream |
| All providers unavailable | Every candidate fails recoverably | Last classified error returned; attempts bounded by the candidate list |

Scripted fakes for each provider port make these cases deterministic. Characterize the reference first where you can. A test must not encode a `SUSPECTED_BUG` as expected behavior; write the expected behavior and link the open question.
