# Combo contract (M2 SP19)

A combo is a named list of models that a client sends as its `model`. The combo decides which members answer: one after another (fallback), starting from a rotating member (round-robin), or all at once with a judge that writes the final answer (fusion). Matrix: `docs/discovery/feature-matrix/06-combo-capacity-adapter.yaml` (`combo.*`), `routing.combo-dispatch`, `settings.combo-rotation-reset`.

Out of scope: the capability auto-switch (`combo.reorder-by-capabilities-tiers`) and the capacity adapter come with SP20; combo presets (`combo.source-presets`, hidden in 9router's dashboard) and media/search combos (`kind`) are not ported.

## Rules from the reference

| Rule | Label | AIGate |
|---|---|---|
| `routing.combo-dispatch`: a `model` without `/` that names a combo is dispatched as that combo, before catalog lookup | `REFERENCE_BEHAVIOR` | Kept for every client lane (`/v1/chat/completions`, `/v1/messages`, `/v1/responses`, `/v1beta/models/*`). A name with `/` is never a combo. |
| `combo.mode-fallback`: members in order; the next member on a fallback-eligible failure, the failure itself when not | `REFERENCE_BEHAVIOR` | Kept. Eligible: HTTP 401, 402, 403, 404, 429, any 5xx, or a message containing `no credentials`, `request not allowed`, `improperly formed request`, `rate limit`, `too many requests`, `quota exceeded`, `capacity`, `overloaded`. Any other 4xx (a client error) is returned at once. A 502–504 whose message matches a rate or capacity rule waits 2 s (5 s for `request not allowed`) before the next member. Each member keeps its full multi-account fallback (`multi-account.md`). |
| `combo.aggregate-status-first-failure`: all failed → status of the first failure, message of the last | `SUSPECTED_BUG` | Corrected: the last member's error (status, type, code, message) is returned. `no_active_connection` becomes 503 `provider_unavailable`, as 9router's `no credentials` rule does. `Retry-After` is the earliest any member reported. |
| `combo.mode-round-robin`: the starting member rotates per combo; `comboStickyRoundRobinLimit` requests per member (default 1); every member stays in the fallback chain | `REFERENCE_BEHAVIOR` | Kept, with the global setting `comboStickyLimit` (1–1000). |
| `combo.rotation-state-lifecycle`, `settings.combo-rotation-reset`: in memory only; reset on combo update/delete and on a strategy setting change | `REFERENCE_BEHAVIOR` | Kept: process memory, keyed by combo id; an update or delete resets that combo; a changed sticky limit restarts every combo's rotation. |
| `combo.strategy-keyed-by-name`: strategy, judge, fusion tuning in `settings.comboStrategies[name]`; a rename orphans them; the global `comboStrategy` is the default | `SUSPECTED_BUG` | Corrected: strategy, judge, and tuning are columns of the combo row, so a rename keeps them. There is no global default strategy: a new combo is `fallback` unless the form says otherwise. |
| `combo.mode-fusion-panel-completion`: quorum `minPanel` (clamped to 2..panel), straggler grace after quorum, hard timeout; late answers ignored | `REFERENCE_BEHAVIOR` | Kept. Defaults 2, 8000 ms, 90000 ms, editable per combo. Stragglers are **cancelled** when the panel closes (9router lets them run: `IMPLEMENTATION_ACCIDENT`). |
| `combo.fusion-panel-concurrency-unbounded` | `IMPLEMENTATION_ACCIDENT` | Replaced: at most **4** panel calls in flight per request (a fixed worker list); a combo has at most 16 members. A member waiting for a worker still counts against the hard timeout. |
| `combo.mode-fusion-degrade`: 1 member → plain call; panel calls non-streaming without tools; 0 answers → 503; 1 answer → that member again with the original request | `REFERENCE_BEHAVIOR` | Kept. 0 answers is 503 `provider_unavailable` "All fusion panel models failed." |
| `combo.tool-history-flatten`: tool calls and results become prose for the panel | `REFERENCE_BEHAVIOR` | Kept on CIP: a message with tool calls or results keeps its text, then `[Called tools: a, b]`, then `[Tool result: …]`; a `tool` message becomes an assistant message. Tool choice and parallel-tool flags are dropped from the panel request. |
| `combo.judge-prompt-synthesis`: anonymized `[Source N]` answers appended as a user turn to the original request; judge = `judgeModel` or the first member | `REFERENCE_BEHAVIOR` | Kept, with 9router's judge prompt. The judge call streams and keeps tools when the client asked for them. |
| `combo.nested-member-recursion`: a member naming a combo runs that combo; no cycle guard | `SUSPECTED_BUG` | Kept nesting, bounded: at most 3 combos deep. Deeper, or a combo that reaches itself, is 400 `combo_too_deep`. Saving a combo that lists its own name is refused. |
| `combo.storage-shape`, `combo.api-crud`: unique name `[A-Za-z0-9_.-]+`; duplicate → 400; a raced duplicate → 500 | `REFERENCE_BEHAVIOR` / corrected race | The database's unique index decides (schema rule 6): a duplicate is always 409 `COMBO_EXISTS`. `kind` is not stored. |

## Storage

Table `combos` (migration 0018): `id` (UUID), `name` (unique, 1–64 of `A-Z a-z 0-9 _ . -`), `models` (JSON array, read and written whole), `strategy` (`fallback` | `round-robin` | `fusion`), `judge_model` (nullable), `min_panel`, `straggler_grace_ms`, `panel_timeout_ms`, `created_at`, `updated_at`. At most 200 combos. Settings gain `combo_sticky_limit` (default 1). The lane reads combos from a cache that every write replaces (single-writer assumption, as settings).

## API (dashboard session)

| Method | Path | Body | Answer |
|---|---|---|---|
| GET | `/api/combos` | — | `{ combos: Combo[] }`, by name |
| POST | `/api/combos` | `{ name, models, strategy?, judgeModel?, minPanel?, stragglerGraceMs?, panelTimeoutMs? }` | 201 `{ combo }` |
| GET | `/api/combos/:id` | — | `{ combo }` |
| PATCH | `/api/combos/:id` | any subset of the create fields | `{ combo }` |
| DELETE | `/api/combos/:id` | — | 204 |

`Combo`: `{ id, name, models, strategy, judgeModel, minPanel, stragglerGraceMs, panelTimeoutMs, createdAt, updatedAt }`.

Validation (400 `INVALID_REQUEST`, message names the field): unknown field; `name` format; `models` 1–16 distinct strings of 1–200 characters, none equal to the combo's name; `strategy` value; `judgeModel` up to 200 characters (empty = first member); `minPanel` 2–16; `stragglerGraceMs` 0–60000; `panelTimeoutMs` 1000–300000. Other errors: 404 `NOT_FOUND`; 409 `COMBO_EXISTS` (name taken); 409 `COMBO_LIMIT` (the 201st combo).

`PATCH /api/settings` accepts `comboStickyLimit` (integer 1–1000; `settings.md`).

## Chat lanes

- `GET /v1/models` lists combos first: `{ id: <name>, object: "model", created: 0, owned_by: "combo" }`.
- Errors keep the lane's OpenAI shape. New codes: 400 `combo_too_deep`; 503 `provider_unavailable` for an exhausted fusion panel.
- A member that fails after the response started (mid-stream) is not replaced: the stream ends with its error event, as a single model does.
- Fusion cost: every request calls each panel member plus the judge (N+1 calls, N+2 when one answer survives).

## UI

`/gateway/routing` → `Routing`, Combo tab: live list (name with Copy, strategy, members, Edit, Delete with type-to-confirm) and the round-robin sticky limit. `/gateway/routing/new` → `ComboCreate` creates; `?combo=<id>` edits. Members are ordered with ↑/↓; each non-combo member has Test (`POST /api/models/test`). Fusion shows minimum panel, judge model, straggler grace, hard timeout, and the fixed parallel limit. Every code above reaches the user through `apps/web/src/shared/errors.ts`.
