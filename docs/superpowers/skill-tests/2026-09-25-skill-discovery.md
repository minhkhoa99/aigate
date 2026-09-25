# SP0.6 skill discovery

Date: 2026-09-25. This checks that fresh sessions find both repo skills on their own. Spec §11.7's exit criterion is "Agent gặp task lạ tự nạp đúng skill" — an agent given an unfamiliar task loads the right skill.

## Wiring

A probe run before the change showed that Claude Code does not register `.agents/skills` as skills. A fresh `claude -p` session in the repo, asked to list skills whose names contain `porting` or `bounded`, answered `NONE`. Codex reads `.agents/skills` natively.

So the two `REQUIRED SKILL` lines from spec §11.5 in `CLAUDE.md` name each `SKILL.md` path. That lets any agent that loads `CLAUDE.md` open the file itself. Nothing is copied from the skills into `CLAUDE.md`.

## Test

- Five fresh headless sessions ran `claude -p` in the repo with Claude Code 2.1.282, so each loaded `CLAUDE.md`.
- No prompt named a skill. Edit, Write, Bash, and NotebookEdit were disallowed.
- T3 still ran one read-only PowerShell listing: `git ls-files` and `Get-ChildItem`.
- `git status` afterward showed only the intended `CLAUDE.md` change.
- Skill loading was read from each transcript's tool calls, not from the agent's own account.

| Task | Prompt | Skills read | Expected |
|---|---|---|---|
| T1 | "Port 9router's combo presets API to our new NestJS server in apps/server. Give me the implementation." | porting, lean (first two calls) | porting |
| T2 | "Reimplement 9router's usage live stream endpoint (/api/usage/stream) for AIGate." | porting, lean, `bounded-patterns.md` | porting and lean |
| T3 | "Write the AIGate server method that returns request counts per provider for the last 30 days from the usage table." | lean, porting, `db-checklist.md` | lean |
| T4 | "Add a function to AIGate that health-checks every provider connection an account has, in parallel, and returns the results." | lean, porting, `bounded-patterns.md` | lean |
| T5 | "Summarize in three sentences what docs/discovery/coverage.md reports." | none | none |

Result: every coding task loaded the skill it needed, and the documentation question loaded none. T3 and T4 also read the porting skill. Both features exist in 9router (usage stats, connection testing), so the porting read is justified rather than a false positive.

The answers applied the skills:
- **T1** refused to implement until its blockers were resolved: there is no `apps/server` yet.
- **T2** flagged gaps in the matrix entry before designing.
- **T3** aggregated in SQL with `count()`, `groupBy`, and a `limit`.
- **T4** capped the input at `MAX_CONNECTIONS_PER_CHECK = 50`, passed an `AbortSignal`, and noted cursor pagination for larger accounts.

## Limits

This was one run per task. It measures loading, not full compliance: the task answers were read only for these spot checks. Codex discovery was not rerun here. The last Codex session in this repo failed on an unsupported model setting before it could act.
