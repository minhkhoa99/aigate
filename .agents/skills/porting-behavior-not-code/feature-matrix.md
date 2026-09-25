# Feature Matrix entry

Write one entry per sub-feature before designing the replacement. Cite `file:line` for every claim. Read the code; do not infer behavior from names. If a step calls another function, trace it until you know the final behavior.

In AIGate, entries live in `docs/discovery/feature-matrix/*.yaml`. `pnpm discovery validate` checks them, and a `SUSPECTED_BUG` entry must carry `suspicion: { expected, actual, impact }`.

## Columns

| # | Column | # | Column |
|---|---|---|---|
| 1 | Feature | 10 | Fallback |
| 2 | Sub-feature | 11 | Error cases |
| 3 | Trigger | 12 | Side effects |
| 4 | Input | 13 | Persistence |
| 5 | Output | 14 | Performance concerns |
| 6 | Business rules | 15 | Old implementation location |
| 7 | State | 16 | New target module |
| 8 | Dependencies | 17 | Parity status |
| 9 | Provider interaction | | |

Add a label to every business rule: `REFERENCE_BEHAVIOR`, `SUSPECTED_BUG`, or `IMPLEMENTATION_ACCIDENT`.

## Trace questions

Ask what problem the feature solves, not how to convert the file.

1. What triggers it?
2. What is the input?
3. What is the output?
4. Which state is read?
5. Which state changes?
6. Which business rules decide the behavior?
7. Which providers take part?
8. Is there a fallback?
9. Is there a retry?
10. Is there a timeout?
11. Is there a quota or rate limit?
12. How are errors classified?
13. What happens on partial failure?
14. Does it stream?
15. Can it be cancelled?
16. Does anything run concurrently?
17. How do credentials and token refresh work?
18. Which data must persist?
19. Which data exists only at runtime?
20. What are the edge cases?

## Before implementing

Answer all twelve before writing product code:

1. What does the feature do in the reference?
2. What behavior can users see?
3. What are the business rules?
4. What is the actual execution flow?
5. Which source files prove it?
6. What are the edge cases?
7. Which parts are business logic?
8. Which parts are only reference implementation detail?
9. What should the new contract be?
10. How does the new architecture implement it?
11. Is there something simpler than the old implementation?
12. Which test proves parity?

## Checks for suspected bugs

Compare each rule against:

- sibling paths that handle the same data, such as the create route against the update route, or one allow-list against another
- the data model's valid values
- the code's own comments and names

A mismatch is a `SUSPECTED_BUG` until someone confirms otherwise.
