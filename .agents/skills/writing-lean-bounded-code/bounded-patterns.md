# Bounded patterns

Choose the native feature or an existing helper first. These snippets show the required bounds; adapt names and types to the codebase.

## Four concurrent calls at most

Reject the tenant input that exceeds a declared maximum before starting work, then run the rest through a fixed worker list:

```ts
const MAX_ITEMS = 50;

async function mapFour<T, R>(items: T[], run: (item: T) => Promise<R>): Promise<R[]> {
  if (items.length > MAX_ITEMS) throw new RangeError(`at most ${MAX_ITEMS} items`);
  const result: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      result[i] = await run(items[i]);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  return result;
}
```

**Write the worker list out; do not compute it.** Concurrency must be a literal array a reader and the lint rule can both count. To change the limit, add or delete workers in that list. These rewrites all look bounded and are all rejected, because the count is no longer in the source:

```ts
await Promise.all(Array.from({ length: concurrency }, worker));   // rejected
await Promise.all([...items.map(run)]);                            // rejected
await Promise.all(items.slice(i, i + 10).map(run));                // rejected
```

Batching a dynamic slice through `Promise.all` is the same violation: it bounds in-flight calls but hides the count from the rule. Take the concurrency value from a module constant, not from a caller or tenant.

This bounds network concurrency, but keeps O(items) output. If the caller does not need every result at once, page or stream instead. Use a task-specific concurrency value when measured upstream limits require it.

## Retry within one deadline

```ts
import { setTimeout as delay } from "node:timers/promises";

async function retry<T>(
  run: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
  maxAttempts: number,
  shouldRetry: (error: unknown) => boolean,
): Promise<T> {
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) {
    throw new RangeError("maxAttempts must be 1..5");
  }
  for (let attempt = 1; ; attempt++) {
    signal.throwIfAborted();
    try { return await run(signal); }
    catch (error) {
      if (attempt >= maxAttempts || !shouldRetry(error)) throw error;
      await delay(Math.min(2_000, 100 * 2 ** (attempt - 1)), undefined, { signal });
    }
  }
}
```

Create the deadline once at request entry, combine it with client cancellation, and pass the same signal to each attempt and response-body read. Never retry after sending the first stream chunk. Only operations safe to repeat may use this helper.

## Queue, stream, and SSE backpressure

Prefer a native `Writable` with a finite `highWaterMark` to a custom in-memory queue. If `write()` returns `false`, wait for `drain` before producing more:

```ts
import { once } from "node:events";

async function writeSse(out: NodeJS.WritableStream, chunk: string, signal: AbortSignal) {
  signal.throwIfAborted();
  if (!out.write(chunk)) await once(out, "drain", { signal });
}
```

Close or cancel the producer when the client disconnects. Do not enqueue events without a capacity limit.

## Cache with a TTL and a size cap

```ts
interface Entry<V> { value: V; expiresAt: number; }

const TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 500;
const cache = new Map<string, Entry<readonly string[]>>();

function read(key: string): readonly string[] | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function write(key: string, value: readonly string[]): void {
  if (cache.size >= MAX_ENTRIES && !cache.has(key)) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
}
```

Evict with the `undefined` check above. Do not write `cache.keys().next().value!`: lint does not catch the non-null assertion, but it claims a fact the compiler cannot see and hides the empty-map case. Write only after a successful fetch, and expose a per-key invalidation function so callers can drop an entry on upstream change.

## Circuit breaker and cursor pagination

Add a circuit breaker only when repeated upstream failures demonstrably amplify load. Bound open time and half-open probes; do not add one by default. For a growing list, query `WHERE id > ? ORDER BY id LIMIT ?` on an indexed stable key and return the last ID as the next cursor. Avoid offset scans and fetching all rows to slice in memory.
