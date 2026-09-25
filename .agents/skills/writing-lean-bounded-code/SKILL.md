---
name: writing-lean-bounded-code
description: Use when writing or reviewing code for request traffic, database reads, external APIs, streaming, retries, caching, or concurrency where input size or load can grow.
---

# Write lean, bounded code

Use the minimum code that is correct, clear, and predictable under load. Prefer correctness, then simplicity, maintainability, bounded resources, latency, and throughput.

## Shape

Put validation and guard clauses first. Give each function one responsibility. Keep business decisions separate from I/O, and dependencies pointed toward the domain. Reuse an existing helper before adding one.

Before writing a loop, query, cache, or network call, name the quantity that can grow. Choose its bound:

| Work | Required bound |
|---|---|
| Fan-out | Fixed concurrency as a literal worker list; validate the input maximum; batch or stream large inputs |
| Rows | Aggregate in SQL for totals; paginate or stream rows callers need |
| Upstream call | Deadline and cancellation propagated through response body |
| Retry | Finite attempts, capped backoff, cancellation, retryable errors only |
| Queue | Capacity and backpressure |
| Cache | TTL, maximum entries, and invalidation on failure/change |

**A `WHERE` clause does not bound result size.** If the caller wants a count, sum, or other aggregate, calculate it in the database. A large `LIMIT` silently corrupts totals; JS `reduce` over every matching row still loads an unbounded account history.

## Pressure check

| Rationalization | Response |
|---|---|
| “Filtering in SQL avoids loading every account’s rows while preserving the existing sum.” | One account may still have millions of rows. Aggregate in SQL. |
| “This usually has fewer than 10 items.” | Validate the maximum or bound concurrency independently of tenant input. |
| “We can deal with invalidation later.” | Set TTL and size cap before introducing a cache. |

Stop if the only argument for a new abstraction is future flexibility. Preserve input validation, security, accessibility, and error handling. Mark any deliberate throughput ceiling with a `ponytail:` comment and its upgrade path.

For concrete async patterns read [bounded-patterns.md](bounded-patterns.md). For database decisions read [db-checklist.md](db-checklist.md). Before delivery use [review-gate.md](review-gate.md). Let lint enforce syntax rules; do not repeat them here.
