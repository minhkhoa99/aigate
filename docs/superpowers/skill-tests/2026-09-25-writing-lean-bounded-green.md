# `writing-lean-bounded-code` GREEN and micro-tests

Date: 2026-09-25. The skill was written only after the [RED baseline](2026-09-25-writing-lean-bounded-red.md). Independent agents answered without editing the repo. Guided agents read `.agents/skills/writing-lean-bounded-code/SKILL.md`; controls did not read project files or skills. Both groups retained the session's global ponytail instructions.

Success criterion for usage prompts: compute the full account total in the database and return one aggregate value. A large `LIMIT` is incorrect; filtering by account then reducing all rows in JS is still unbounded.

| Prompt | Guided | Control | What the result shows |
|---|---:|---:|---|
| Original pressure: keep JS `filter/reduce`, add a large `LIMIT` | 5/5 | 2/5 | Three controls rejected `LIMIT` but still loaded every matching row; all guided answers used SQL aggregate. |
| Easier variant: existing SQL `WHERE`, lead suggests `LIMIT 50000` | 5/5 | 5/5 | Both groups already recognized the aggregate; this variant does not show added value from the skill. |

An exact failing control from the original prompt:

```ts
const rows = await db.select().from(usage).where(eq(usage.accountId, accountId));
return rows.reduce(sumUsage, 0);
```

Its rationale was: “A `LIMIT` would silently undercount usage. Filtering in SQL avoids loading every account’s rows while preserving the existing sum.” The account itself can have millions of rows.

The first guided answer on the same prompt used `sum(usage.amount)` with an account predicate and returned one value. Other guided answers used `coalesce(sum(...), 0)` with the same shape.

The first fan-out and cache reruns both bounded growth. Their free-form snippets still used `Promise.all` over a dynamic slice, which AIGate lint rejects, and a non-null `!` assertion. They were not applied to a repository or run through lint, so they demonstrate the bounded decision, not production-ready code.

## Fan-out and cache micro-tests

A second session ran 5 guided and 5 control agents on each of the original RED prompts A and C.

| Prompt | Guided | Control | What the result shows |
|---|---:|---:|---|
| A. Fan-out: declared input maximum | 5/5 | 0/5 | Every guided answer rejected oversized input, but all five wrote `Promise.all(Array.from({ length: n }, worker))`, which `aigate/bounded-promise-all` rejects. |
| C. Cache: TTL, size cap, invalidation seam | 5/5 | 0/5 | Controls kept an unbounded map and only warned about it. Two guided answers evicted with `cache.keys().next().value!`. |

The skill was then patched. `bounded-patterns.md` now requires a literal worker list, lists three rejected rewrites, and adds a TTL-plus-cap cache that evicts through an `undefined` check. The Fan-out row in `SKILL.md` names the literal worker list.

**Rerun of A after the patch (5 guided, no controls):** 5/5 used `Promise.all([worker(), worker(), worker(), worker()])` and rejected lists over `MAX_CONNECTIONS` with a 413 or 422. Each answer was transcribed into a temporary file under `apps/web/src/features/` and linted with the repo config. All five had zero findings, and the temporary files were deleted. Only one answer passed a deadline and client-cancel signal to `checkConnection`; the other four mentioned the timeout gap or left it out. Timeout remains a review-gate item, not something this skill currently enforces.

**Correction:** earlier notes, including the RED baseline, said lint rejects the `!` assertion. It does not: `aigate/no-type-assertion` checks `as` and angle-bracket casts only, matching spec §11's "`any` / `as`" row. A lint run confirmed that `cache.delete(cache.keys().next().value!)` passes. The skill still advises against it, but no longer says lint rejects it. The same lint run found 3/3 rejected fan-out rewrites flagged by `aigate/bounded-promise-all`. The accepted snippets had no `aigate/*` findings, only unused-variable findings because each snippet was linted standalone.

Validation: `skill-creator/scripts/quick_validate.py` passed on the patched skill with UTF-8 enabled on Windows. The patched `SKILL.md` has 364 whitespace-separated words, including frontmatter, below the 450-word target.
