---
name: porting-behavior-not-code
description: Use when reimplementing a feature that already exists in another codebase, migrating a system to a new architecture, or when a reference implementation is available and behavior must match but code must not.
---

# Port behavior, not code

The reference tells you WHAT the system does. It does not dictate HOW. Work in order: understand, extract rules, define the contract, design, implement, verify parity.

## Iron law

Write no product code for a feature until its Feature Matrix entry exists and every rule in it is labeled. "Port this file", "keep it the same", and "it's trivial" do not waive this. No exceptions.

## Label every rule first

| Label | Signal | Action |
|---|---|---|
| `REFERENCE_BEHAVIOR` | A user, client, or stored data depends on it | Keep it in the contract |
| `SUSPECTED_BUG` | It contradicts a sibling path, the data model, or its own intent | Do not reproduce it. Record expected, actual, and impact, then ask |
| `IMPLEMENTATION_ACCIDENT` | It exists only because of the old framework, runtime, or file layout | Drop it and meet the underlying need natively |

**Asking does not license shipping the bug.** Until someone confirms the old behavior is wanted, leave that rule unimplemented. State the question and what would differ. Tests assert the contract, never a suspected bug.

## Parity is measured at the contract

Ten old functions becoming three is success. Compare inputs, outputs, status codes, error bodies, side effects, and persistence. Do not compare names, file layout, or control flow. Write from the contract; do not translate line by line.

## Pressure check

| Rationalization | Response |
|---|---|
| "It's identical, so this keeps the same logic, status codes and response bodies." | Identical code copies its bugs. Label rules; write from the contract. |
| "Existing bug, kept on purpose … That's a behavior change, so tell me whether you want it." | The bug is not the safe default. Hold that rule and ask first. |
| "Everything else is unchanged, including two existing race conditions." | A known race is a `SUSPECTED_BUG`. Label it; do not carry it silently. |

Red flags: "convert this file to TS", "port this class", "keep it because the old code does it", "the function name says what it does".

## Done gate

Not done until each holds: inventory complete, business flow documented, edge cases identified, contract defined, design reviewed, implementation complete, unit and contract tests pass, error cases tested, streaming tested if applicable, and performance, security, and behavioral parity checked.

References: [feature-matrix.md](feature-matrix.md) for tracing, [golden-scenarios.md](golden-scenarios.md) for contract tests, [error-taxonomy.md](error-taxonomy.md) for fallback.
