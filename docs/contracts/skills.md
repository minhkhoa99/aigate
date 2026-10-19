# Skills registry

The `/integrations/skills` page manages agent skills saved on the AIGate host. It replaces the eight hardcoded 9router skill links (`skills.catalogue-raw-github-contract`). That replacement is a deliberate deviation, recorded as `integrations.skills-dynamic-registry` in the Feature Matrix. No skill is seeded.

Saved skills serve two purposes:

1. Agents fetch them directly by URL.
2. **Automatic skills** (below) add the relevant skills to `/v1` requests, so a client never has to add a skill by hand.

## Storage

Table `skills` (migrations `0026_skills`, `0027_skills_auto`, `0028_skills_mode` and `0029_skills_drop_auto`, schema `packages/database/src/schema/tooling.ts`):

| Column | Rule |
|---|---|
| `id` | Opaque UUID text primary key. |
| `name` | 1–64 characters after trim, unique ignoring case (`skills_name_nocase` on `lower(name)`). SQLite `lower()` folds ASCII only, so `Đ` and `đ` are distinct names. |
| `description` | 0–280 characters after trim, default `''`. |
| `source` | `link` or `file`. It cannot change after creation. |
| `url` | Present only for `link`. HTTPS, or HTTP for `localhost` / `127.0.0.1` / `[::1]`. No credentials, no fragment, at most 2048 characters. A query string is allowed. A GitHub file page (`https://github.com/<owner>/<repo>/blob/<ref>/<path>`, or `/raw/`) is stored as its raw file, `https://raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>`, without the query. |
| `content` | Present only for `file`: the SKILL.md text. It must be non-empty, at most 262 144 UTF-8 bytes, and contain no NUL. |
| `enabled` | Boolean, default true. A disabled skill is never served or added. |
| `mode` | `auto` (default), `always` or `off`, checked by `skills_mode`. `auto` is added when it matches a request; `always` is added to every request; `off` is never added. At most 3 skills are `always`. 0028 carried the 0027 boolean `auto` forward (false became `off`) with `ALTER TABLE ADD`, not a table rebuild: migrations run in one transaction, where `PRAGMA foreign_keys=OFF` has no effect, so dropping `skills` would cascade-delete `skill_index`. 0029 dropped `auto`. |
| `created_at`, `updated_at` | Epoch milliseconds. |

CHECK constraints enforce the source shape and the mode.

Table `skill_index` (0027) has one row per skill, deleted with the skill (`ON DELETE CASCADE`):

| Column | Rule |
|---|---|
| `link_content` | A link skill's cached document, under the same rules as `content`. |
| `fetched_at` / `fetch_error` | When the cached copy was fetched, and the last fetch error (at most 500 characters). |
| `document` | The lexical index (JSON, read and written whole), rebuilt on every write to the skill or its cached copy. A skill saved before 0027 is indexed and stored the first time the graph is built. |

At most 200 skills exist, and at most 3 are `always`. Both counts, the insert and the index row share one transaction; a mode change to `always` counts the others in the update's transaction. Skills are not part of the settings export; the five automatic-skill settings are (see `settings.md`).

## Dashboard API (session required)

| Route | Result |
|---|---|
| `GET /api/tooling/skills` | `Skill[]`, oldest first, at most 200: `{ id, name, description, source, url, bytes, enabled, mode, fetchedAt, fetchError, createdAt, updatedAt }`. Never includes content. `bytes` is the UTF-8 size of the file, or of a link's cached copy (0 when none), computed in SQL. `Cache-Control: no-store`. |
| `GET /api/tooling/skills/:id` | The `Skill` plus `content`: the file, a link's cached copy, or `null`. 404 `NOT_FOUND` if missing. |
| `POST /api/tooling/skills` | Body `{ name, description?, mode?, source: "link", url }` or `{ name, description?, mode?, source: "file", content }`. A link is fetched once before the 201 reply. A failed fetch is recorded in `fetchError` and does not fail the save. |
| `PATCH /api/tooling/skills/:id` | Any of `name`, `description`, `enabled`, `mode`, plus `url` (link only) or `content` (file only). Other fields (including the removed `auto`), `source`, or an empty patch are 400. A changed URL drops the cached copy and fetches the new one. |
| `POST /api/tooling/skills/:id/refresh` | Fetches a link skill again: 200 with the detail. A link saved before GitHub URLs were rewritten is first moved to its raw URL, which drops the cached page. On failure it returns 502 `SKILL_FETCH_FAILED` with the reason; the previous copy is kept and `fetchError` is set. 400 for a file skill. |
| `POST /api/tooling/skills/preview` | Body `{ text }` (1–16 384 characters). Returns `{ selection, candidates, always, selected, block, chars, hybrid }`. The top-level fields are the lexical selection, which every target can take: the top 10 scored auto skills, the always-on skills, the matched ones, the system text and its length. `hybrid` (null under `skillsSelection: "lexical"`) is what a target that calls tools gets: `{ preloaded, loadable, block, chars }`, the skills added up front, the names the model may load, and the block. Uses the current settings whether or not automatic selection is on; a preview has no conversation, so nothing loaded earlier is preloaded. No vendor call. |
| `DELETE /api/tooling/skills/:id` | 204, or 404. |

**Link fetch:** `HTTP_TRANSPORT` GET with an 8 s deadline and a 256 KiB bounded read, no retry, and never inside a transaction. Only a 2xx response whose `Content-Type` is `text/*` other than `text/html`, markdown or `application/octet-stream` (or absent) is accepted, and a body that starts with `<!doctype html` or `<html` is refused too. An HTML page fails with "The link returned an HTML web page, not a markdown file", pointing to the raw URL.

Errors:
- 400 `INVALID_REQUEST`, with the validation message.
- 409 `SKILL_EXISTS` for a duplicate name.
- 409 `SKILL_LIMIT` when 200 skills already exist.
- 409 `SKILL_ALWAYS_LIMIT` when 3 other skills are already `always`.
- 404 `NOT_FOUND`.
- 502 `SKILL_FETCH_FAILED`.

The web maps `SKILL_EXISTS`, `SKILL_LIMIT` and `SKILL_ALWAYS_LIMIT` to EN/VI advice, and passes the `SKILL_FETCH_FAILED` reason through, via `shared/errors.ts`.

## Agent route

`GET /v1/skills/:id/SKILL.md` returns the content of an **enabled file skill** as `text/markdown; charset=utf-8` with `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.

It always needs an active AIGate API key, sent as `Authorization: Bearer <key>` or `x-api-key`. This holds even when the `/v1` lane runs keyless (`requireApiKey=false`), because Tailscale Funnel can expose the port.

| Case | Response |
|---|---|
| No key | 401 `MISSING_API_KEY` |
| Unknown or disabled key | 401 `INVALID_API_KEY` |
| Missing id, disabled skill, or link skill | 404 `NOT_FOUND` |

A link skill is not served here; agents fetch its original URL. Fetches are not metered as usage.

## Automatic skills

**Switch.** Setting `skillsAutoEnabled` (default off). When on, every chat request on the `/v1` gate may receive skills:
- clients: OpenAI Chat, Anthropic `/v1/messages`, Responses (`/v1/responses`, `/responses`, `/codex/*`) and Gemini `/v1beta`;
- providers: any, built-in or custom, including combos and fallback targets.

A client opts one request out with the header `x-aigate-skills: off`. The switch and the header cover both matched and always-on skills.

**Where it runs.** `ChatLane.serve()` builds the request's skill session after parsing, then runs Token Saver on the client's own messages. The skills are added per target in `ChatLane.single()`, after `resolve()` and around the metered adapter (`routing/infrastructure/skill-rounds.ts`), so Headroom never sees them and a hidden tool never makes a model fail the `tools` capability check. Embeddings, speech, images and the Gemini TTS passthrough are untouched.

**Graph (lexical GraphRAG, `skills/domain/skill-graph.ts`, no model call).** Built from the enabled `auto` skills only.

- **Tokens:** text is lowercased and folded (diacritics removed, `đ`→`d`, so `lập trình` matches `lap trinh`). English and Vietnamese stop words and bare numbers are dropped. Unigrams and adjacent bigrams are kept.
- **Document:** each skill keeps up to 400 weighted terms. Name, description and frontmatter `tags:` / `keywords:` count ×3. Up to 32 markdown-heading sections are kept, with their top terms.
- **Edges:**
  - skill↔term weights;
  - skill↔skill edges for frontmatter `related:` names (weight 1);
  - up to three nearest skills by TF-IDF cosine ≥ 0.2.
- **Query:** the two latest user texts (tool results skipped), at most 4 KiB / 200 terms.
- **Scoring:** BM25 (k1 1.2, b 0.75), plus 0.3 × the best neighbour's score (one hop). A skill is chosen when its score is ≥ max(1, 0.35 × best). At most `skillsMaxSelected` skills (1–5, default 2) are chosen.

**Always-on skills.** Every enabled `always` skill (at most 3) is added to every request without scoring. This suits general guidelines, such as a coding-behaviour `CLAUDE.md`, that never share words with a task. They share a fixed 4000-character budget equally (`ALWAYS_BUDGET_CHARS`), separate from `skillsBudgetChars`, and do not count towards `skillsMaxSelected`. Each one is cut the same way as a matched skill. An always-on link with no cached copy is skipped.

**Text added.** Each chosen skill gets an equal share of `skillsBudgetChars` (1000–32 000, default 8000):
- the whole body if it fits;
- otherwise the opening section, then the sections sharing the most query terms, in document order.

A chosen link skill with no cached copy is skipped.

The block is appended to the request's system text after the separator `--- AIGate Skills ---`. In order, it contains:
1. a framing line: the user's and system instructions take precedence over any skill;
2. when any exist, the always-on skills, under "follow them on every request";
3. when a skill matched and `skillsCatalogEnabled` (default on), a catalogue of up to 40 auto skills (`name — description`, 120 characters max, selected ones marked);
4. the matched skills, under "apply one only when it fits the current task".

Every skill is wrapped as `<skill name="…">…</skill>`, with `<skill` / `</skill` inside skill text neutralised.

If nothing matches and no skill is always on, nothing is added. Always-on skills alone add no catalogue. A request whose system text already contains the separator is left alone.

**Response header.** `x-aigate-skills: <ids>` is set on the response (JSON and streamed) when skills were added: always-on ids first, then matched, preloaded or loaded ones. The header leaves with the first byte of the reply, so it lists skills loaded in later rounds only when the answer is held whole (a non-streamed reply from a non-streamed provider call). Every streamed reply carries only the skills added up front, and so does a whole answer on the Messages and Responses lanes, which stream from the provider. The request row (`usage_requests.skills`, at most 8 comma-separated ids, see `usage.md`) always has every skill the request used.

**Cache and failure.** The graph and the always-on list are cached in memory per repository write version (one writer process). A request reads the text of at most 8 skills (5 matched plus 3 always-on). Any selection error fails open: the request continues unchanged and a warning is logged.

## Model-loaded skills

Setting `skillsSelection`: `hybrid` (default) or `lexical`. Lexical is the selection above. Hybrid fixes its weak point, a lexical match that misses or picks the wrong skill, by letting the model choose (`skills/domain/skill-tool.ts`, `skills/infrastructure/skill-context.ts`, `routing/infrastructure/skill-rounds.ts`).

**Which targets.** A target takes hybrid when all hold:
- its adapter family carries tool calls natively: `openai-compatible`, `anthropic`, `openai-responses`, `ollama`, `gemini`, `vertex` (`TOOL_PROTOCOLS`; custom providers use these). The `antigravity`, `commandcode`, `cursor`, `kiro` and `trae` families get lexical;
- the model's capabilities allow tools (an undeclared model does);
- the client's `tool_choice` is absent or `auto`, and no client tool is named `aigate_load_skill`;
- it is not a fusion panel member (the panel gets lexical; the combo's final call can take hybrid).

Every other target, and every target under `lexical`, gets the lexical block.

**Added up front.** The always-on skills (as above, outside the maximum), then the skills this conversation loaded on earlier turns and the single best lexical match, together at most `skillsMaxSelected`. Each gets `skillsBudgetChars / skillsMaxSelected` characters, cut as above.

**Offered.** While the maximum leaves room, the other auto skills (by score, then name, at most 40) are listed under "Skills you can load: when one fits the current task, call the aigate_load_skill tool with its name before answering", and the request gets one more tool, `aigate_load_skill({ name })`, whose `name` is an enum of exactly those names. The catalogue is listed whether or not a skill matched; `skillsCatalogEnabled` applies to lexical only.

**Rounds.** When the model calls the tool, AIGate answers it and calls the same provider, account and model again with the model's turn (its text, reasoning and skill calls) and one tool message holding every answer:
- a listed skill is answered with its text, cut to the per-skill share;
- an unknown name, a skill already added, or one past the maximum is answered in words so the model can go on;
- a client tool called in the same turn is dropped, since nothing ran it; the model calls it again later;
- at most 2 extra rounds (`MAX_SKILL_ROUNDS`); after that the turn ends as the model left it;
- a failure reading a skill is answered "The skill could not be loaded; answer without it." (fail open).

Each round is one metered attempt, so `usage_events` and the request's attempt count include them; the client's usage is the sum of every round.

**What the client sees.** One answer without the hidden calls. Non-streamed: the last round's content; a `tool_use` stop with no client call left becomes `end_turn`. Streamed: one stream. `start` is sent once; text, reasoning and image deltas pass through as they arrive; tool-call deltas, usage and the stop wait for the end of each round. After the last round the client's own calls are sent, renumbered from 0, then the summed usage, then the stop. A failure in a later round reaches the client as the lane's usual mid-stream error.

**Conversation memory.** Clients resend history without the hidden rounds, so AIGate remembers what a conversation loaded: an in-memory LRU of 1000 conversations for 30 minutes, keyed by sha256 of the AIGate key id and the first user text (at most 4096 characters), holding at most 5 skill ids. They are added up front on the next turns. The memory is lost on restart.

**Costs.** A request that loads a skill makes one more provider call (about twice the latency) and resends the conversation. The catalogue and tool cost input tokens on every hybrid request. A weak model may load too much or too little; switch to `lexical` for it.

**Effects to know.**
- Adding text marks the request as rewritten, exactly as Token Saver does. A Responses client routed to a Responses provider (for example codex) is then sent the canonical conversion instead of its raw body, and codex's default instructions are not added because `instructions` is no longer empty.
- Added text costs input tokens and can change a provider's prompt-cache prefix. An always-on skill costs them on every request.
- Linked documents come from remote URLs; the operator decides which sources to trust.
- The routing simulator no longer adds skills: they are added per target after routing and never change which target is chosen.

## UI

**Table.** Columns:
- name and description;
- source: `File · n KiB`, or `Link` with the cached size, "not fetched", or the fetch error;
- state;
- Use: a select of Auto / Always / Off (`mode`), saved on change;
- agent URL with Copy;
- actions: Enable/Disable, View (files and cached links), Refresh (links), Edit, Delete.

For a link, the agent URL is the saved URL. For a file, it is `${origin}/v1/skills/<id>/SKILL.md`.

**Automatic skills panel.** The switch, the selection (Hybrid / Lexical, with its latency and token cost), the catalogue toggle (lexical only), skills per request (1–5), and the budget (validated 1000–32 000 and saved on blur/Enter), all saved through `PATCH /api/settings`, plus the opt-out header and a token/cache/trust warning.

**Test selection panel.** Posts sample text to the preview route and shows the always-on skills, the matched skills, the top candidates with scores, and the exact block with its length. Under hybrid it first shows what a tool-calling model gets: the skills added up front, the names it can load, and that block.

**Requests detail.** The metadata panel lists the skill ids the request used (`skills` on `/api/requests`).

**Add modal.**
- Picks Link or Markdown file.
- Picks the Use mode (Auto by default), with a hint explaining Always and its limits.
- For a file, the browser reads the chosen `.md` with `File.text()` and rejects files over 256 KiB or empty files before sending.
- Empty name and description fields are filled from plain one-line `name:` / `description:` pairs in the leading YAML frontmatter (`skill-rules.ts`).
- The content is sent as JSON, because the server parses only JSON bodies.
- Editing a file skill keeps its content unless a new file is chosen.

**View.** Loads the detail and renders the content as text in `<pre>`, never as HTML. For a file it also offers `curl -H "Authorization: Bearer $AIGATE_KEY" <url>`. No saved key is ever placed in the page.

**States.** A failed read shows the code, the diagnostic and Retry. A failed mutation keeps the modal and draft. Actions are disabled while a mutation runs.
