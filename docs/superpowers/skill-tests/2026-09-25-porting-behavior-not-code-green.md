# `porting-behavior-not-code` GREEN and micro-tests

Date: 2026-09-25. The skill was written only after the [RED baseline](2026-09-25-porting-behavior-not-code-red.md). It targets the one observed failure: scenario A reproduced a traced `SUSPECTED_BUG` while translating line by line.

Setup:
- Guided agents read `.agents/skills/porting-behavior-not-code/SKILL.md` and may open its three references.
- Controls got the same prompt without the skill.
- Both groups could read only `.reference/9router`, and no agent could edit files. After the run, `git status` showed no file changes other than the new skill folder.
- Prompts were verbatim copies of the RED prompts.

Pass criteria for A:
- Do not ship `validTypes` without `deno` by default.
- Label the omission or ask about it before implementing that rule.
- Do not write a test that asserts the silent coercion to `http`.

| Prompt | Guided | Control | What the result shows |
|---|---:|---:|---|
| A. "Port this file to TS — keep it the same" | 5/5 pass | 0/5 pass | Every control kept `const VALID_TYPES = ["http", "vercel", "cloudflare"]` and never mentioned `deno`. Every guided answer traced the create route (`proxy-pools/route.js:10`), called the omission a bug, held that rule, and asked. |
| B. "Trivial, skip the Feature Matrix" (rerun) | 2/2 pass | — | Both refused and traced the reference, as in RED. No regression. |
| C. "Keep `global._*` exactly" (rerun) | 2/2 pass | — | Both identified the guards as Next.js workarounds and proposed dropping them. No regression. |

A representative control opening: "Here's the TS port. The handler logic matches the JS line for line."

A representative guided opening: "I haven't written the TS file yet. Our porting rule says no code until this endpoint has a Feature Matrix entry with every rule labelled, and "keep it the same" doesn't waive that."

A-guided-2 closed with "No test will lock in the current buggy behavior." A-guided-5 closed with "The tests won't assert any of the old buggy behavior." Guided answers also surfaced suspected bugs the prompt did not mention:
- the check-then-delete race in DELETE
- PUT returning 200 `{ proxyPool: null }` after a concurrent delete
- malformed bodies returning 500
- DELETE missing pools referenced through `settings.providerStrategies` (A-guided-2 only)

Each was labeled and held for a decision rather than ported.

## Observations

- None of the 9 guided answers wrote product code in this single turn. That is the iron law working as specified, but it means the next turn has to produce the Feature Matrix entry before any code. The micro-tests do not measure that second turn.
- Two of the five guided A answers wrote "Suspected bugs" as a heading rather than the literal `SUSPECTED_BUG` label. The behavior matched; the label wording varied.
- No new loophole appeared, so there was no REFACTOR edit.

Validation: `skill-creator/scripts/quick_validate.py` passed with UTF-8 enabled on Windows. `SKILL.md` has 442 whitespace-separated words, including frontmatter, below the 450-word target. The references are `feature-matrix.md`, `golden-scenarios.md`, and `error-taxonomy.md`. The fallback table in `error-taxonomy.md` is a proposed default: spec §5 names the eight codes but does not define which are recoverable.
