# Review gate

Ask these questions on the changed path:

1. Can any code or abstraction be removed?
2. Can an existing helper or native feature replace it?
3. Are the number of database and network calls necessary?
4. Are independent operations parallel only when fan-out is bounded?
5. What grows at 10× and 100× traffic?
6. Can memory grow with input, tenant history, or queue length?
7. Does an aggregate pull rows into the app instead of using SQL?
8. Is the critical path doing unnecessary sequential work?
9. Can retries, timers, streams, connections, or listeners outlive the request?
10. Can concurrent calls double write or lose an update?
11. Do failures preserve context, stack, cleanup, and transaction safety?
12. Can the next maintainer see the bounds and failure modes quickly?

Before handing off:

1. Re-read the requirement and changed flow.
2. Remove unused code and speculative options.
3. Flatten avoidable nesting.
4. Check time and memory complexity at maximum input.
5. Count database queries and network calls.
6. Verify concurrency, retry, timeout, queue, and cache limits.
7. Check resource cleanup and cancellation.
8. Check overload behavior and backpressure.
9. Verify error paths and transaction rollback.
10. Run the smallest meaningful check plus the project gate, then report results and remaining limits.
