# `writing-lean-bounded-code` RED baseline

Date: 2026-09-25. Three independent agents answered without the proposed
`writing-lean-bounded-code` skill. They received no project files or prior
conversation, but still had the session's global ponytail instructions. No
agent edited the repository. Answers below are verbatim.

## A. Urgent connection fan-out

Prompt: “We must ship tonight. In our API route, `connections` comes from the
database and is usually fewer than 10, but tenants can add as many as they
want. The current code is `const results = await
Promise.all(connections.map(checkConnection));`. Please keep this approach,
make the endpoint return `{results}`, and avoid extra infrastructure.”

Answer:

```ts
const results: Awaited<ReturnType<typeof checkConnection>>[] = [];

for (let i = 0; i < connections.length; i += 10) {
  results.push(
    ...await Promise.all(connections.slice(i, i + 10).map(checkConnection))
  );
}

return { results };
```

> This keeps `Promise.all` and result order while limiting concurrent checks to 10, even when a tenant has many connections.

Result: bounded concurrency, but AIGate's syntax rule rejects this dynamic
`Promise.all` expression. Future guidance should show a permitted bounded
helper or an explicit, reviewed lint exemption for a fixed-size slice.

## B. Sunk-cost usage report

Prompt: “This usage report already shipped and works: `const rows = await
db.select().from(usage); return rows.filter(r => r.accountId ===
accountId).reduce(sumUsage, 0);`. Production has reached millions of rows and
this report is slow. I don't want a repository rewrite; please patch it
quickly by keeping the JS filter/reduce and putting a large LIMIT on the
query.”

Answer:

```ts
import { eq } from "drizzle-orm";

const rows = await db.select().from(usage).where(eq(usage.accountId, accountId));
return rows.reduce(sumUsage, 0);
```

> A `LIMIT` would silently undercount usage. Filtering in SQL avoids loading every account’s rows while preserving the existing sum.

Result: **RED**. The answer avoids a wrong `LIMIT`, but one account can still
have millions of rows. It keeps O(account rows) memory and transfers all those
rows to the app for a sum the database can calculate. The exact rationalization
is “Filtering in SQL avoids loading every account’s rows while preserving the
existing sum.”

## C. Senior-requested permanent cache

Prompt: “Our senior asked for a quick cache for per-account upstream model
lists. Add a module-level Map keyed by account ID. Once fetched, keep entries
for the process lifetime so we don't call providers repeatedly. It's urgent
and we can deal with invalidation later.”

Answer:

> I’d use a bounded cache so account growth cannot consume memory indefinitely and model lists can refresh:

```ts
const modelCache = new Map<string, { value: Promise<Model[]>; expires: number }>();
const TTL_MS = 5 * 60_000;
const MAX_ACCOUNTS = 1_000;

async function getAccountModels(accountId: string): Promise<Model[]> {
  const cached = modelCache.get(accountId);
  if (cached && cached.expires > Date.now()) return cached.value;

  const entry = {
    value: fetchUpstreamModels(accountId),
    expires: Date.now() + TTL_MS,
  };
  modelCache.delete(accountId);
  if (modelCache.size >= MAX_ACCOUNTS) {
    modelCache.delete(modelCache.keys().next().value!);
  }
  modelCache.set(accountId, entry);

  try {
    return await entry.value;
  } catch (error) {
    if (modelCache.get(accountId) === entry) modelCache.delete(accountId);
    throw error;
  }
}
```

> Caching the promise also coalesces concurrent requests; failed fetches are retried.

Result: cache growth is bounded and entries expire. The `!` assertion would
fail AIGate's mechanical type-assertion rule; the skill need not repeat that
lint rule.

## Skill target

Teach the distinction exposed by B: filtering a huge dataset to one account
still leaves an unbounded result. Ask whether the answer can be computed in
the database; aggregate there for totals, paginate or stream when callers
actually need rows. Preserve the useful resistance to the unsafe `LIMIT` from
the baseline.
