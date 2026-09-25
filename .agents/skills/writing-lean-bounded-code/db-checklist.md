# Database checks

1. If the caller wants a total, count, minimum, maximum, or grouped value, compute it in SQL. `WHERE account_id = ?` can still return millions of rows. `LIMIT` changes a total; it is not a performance fix for an aggregate.
2. If the caller needs rows, select only required columns and use cursor pagination or streaming. A page size is an explicit product limit, not an arbitrary large number.
3. For each loop that touches the database, check for N+1 queries. Batch by key when it preserves semantics.
4. Check whether predicates and sort columns have suitable indexes. Confirm with the query plan for large or hot tables.
5. Keep transactions short; avoid network calls or large scans while holding one.
6. Bound concurrent queries and result memory. A filtered query may still produce an unbounded result.

For a total, the shape is `SELECT COALESCE(SUM(tokens), 0) FROM usage WHERE account_id = ?`; map the one returned value to the domain type. For a history view, use an indexed cursor and a fixed page size instead.
