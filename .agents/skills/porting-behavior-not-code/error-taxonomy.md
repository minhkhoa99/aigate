# Error taxonomy and fallback

Classify every upstream failure into exactly one code before deciding what happens next:

| Code | Meaning | Fallback |
|---|---|---|
| `AUTH_ERROR` | The credential is invalid or revoked | Next account only; never retry the same credential |
| `RATE_LIMIT` | Upstream throttled the caller | Yes, to the next eligible candidate |
| `QUOTA_EXHAUSTED` | The account has no remaining quota | Yes; skip the account until its reset time |
| `PROVIDER_UNAVAILABLE` | Upstream is down or returned 5xx | Yes, to the next candidate |
| `TIMEOUT` | The request deadline was exceeded | Only before the first stream chunk |
| `MODEL_UNAVAILABLE` | The candidate does not serve the model | Yes, to a candidate that does |
| `INVALID_REQUEST` | The request itself is malformed or unsupported | **No** — return it immediately |
| `INTERNAL_ERROR` | A bug or unexpected state on our side | **No** — return it and log it |

This table is the default for a first design. The real one belongs in the domain as data, so a change happens in one place.

## Rules

- Fall back only on a recoverable code. A malformed request sent to four providers wastes money and the user's time.
- Never fall back or retry after the first stream chunk reaches the client.
- Fallback is an explicit policy over a candidate list: resolve candidates, attempt one, classify the error, then continue or stop. Do not use nested `try/catch` or scattered `status === 429` checks.
- Bound attempts by the candidate list and the request deadline.
- Record each attempt with its classified code, so the fallback reason is visible.

If the reference treats every error as recoverable, or has no terminal path, label that rule `SUSPECTED_BUG`. Do not port it.
