# Skills registry

The `/integrations/skills` page manages agent skills saved on the AIGate host. It replaces the eight hardcoded 9router skill links (`skills.catalogue-raw-github-contract`). That replacement is a deliberate deviation, recorded as `integrations.skills-dynamic-registry` in the Feature Matrix. No skill is seeded.

## Storage

Table `skills` (migration `0026_skills`, schema `packages/database/src/schema/tooling.ts`):

| Column | Rule |
|---|---|
| `id` | Opaque UUID text primary key. |
| `name` | 1–64 characters after trim, unique ignoring case (`skills_name_nocase` on `lower(name)`). SQLite `lower()` folds ASCII only, so `Đ` and `đ` are distinct names. |
| `description` | 0–280 characters after trim, default `''`. |
| `source` | `link` or `file`. It cannot change after creation. |
| `url` | Present only for `link`. HTTPS, or HTTP for `localhost` / `127.0.0.1` / `[::1]`. No credentials, no fragment, at most 2048 characters. A query string is allowed. |
| `content` | Present only for `file`: the SKILL.md text. It must be non-empty, at most 262 144 UTF-8 bytes, and contain no NUL. |
| `enabled` | Boolean, default true. |
| `created_at`, `updated_at` | Epoch milliseconds. |

CHECK constraints enforce the source shape.

At most 200 skills exist. The count and the insert share one transaction. Skills are not part of the settings export.

## Dashboard API (session required)

| Route | Result |
|---|---|
| `GET /api/tooling/skills` | `Skill[]`, oldest first, at most 200: `{ id, name, description, source, url, bytes, enabled, createdAt, updatedAt }`. Never includes content; `bytes` is the UTF-8 size computed in SQL (0 for links). `Cache-Control: no-store`. |
| `GET /api/tooling/skills/:id` | The `Skill` plus `content` (`null` for links). 404 `NOT_FOUND` if missing. |
| `POST /api/tooling/skills` | Body `{ name, description?, source: "link", url }` or `{ name, description?, source: "file", content }`. 201 with the detail. |
| `PATCH /api/tooling/skills/:id` | Any of `name`, `description`, `enabled`, plus `url` (link only) or `content` (file only). Other fields, `source`, or an empty patch are 400. |
| `DELETE /api/tooling/skills/:id` | 204, or 404. |

Errors:
- 400 `INVALID_REQUEST`, with the validation message.
- 409 `SKILL_EXISTS` for a duplicate name.
- 409 `SKILL_LIMIT` when 200 skills already exist.
- 404 `NOT_FOUND`.

The web maps `SKILL_EXISTS` and `SKILL_LIMIT` to EN/VI advice through `shared/errors.ts`.

## Agent route

`GET /v1/skills/:id/SKILL.md` returns the content of an **enabled file skill** as `text/markdown; charset=utf-8` with `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.

It always needs an active AIGate API key, sent as `Authorization: Bearer <key>` or `x-api-key`. This holds even when the `/v1` lane runs keyless (`requireApiKey=false`), because Tailscale Funnel can expose the port.

| Case | Response |
|---|---|
| No key | 401 `MISSING_API_KEY` |
| Unknown or disabled key | 401 `INVALID_API_KEY` |
| Missing id, disabled skill, or link skill | 404 `NOT_FOUND` |

Fetches are not metered as usage.

A link skill is never fetched, proxied or validated for reachability by AIGate. The agent fetches it at its own URL, and its content is whatever that URL serves at fetch time.

## UI

- The table shows name and description, source (`Link` or `File · n KiB`), state, the agent URL with Copy, and the actions Enable/Disable, View (file only), Edit and Delete.
- For a link, the agent URL is the saved URL. For a file, it is `${origin}/v1/skills/<id>/SKILL.md`.
- The Add modal picks Link or Markdown file. The browser reads the chosen `.md` with `File.text()`, rejects files over 256 KiB or empty files before sending, and fills an empty name and description from plain one-line `name:` / `description:` pairs in the leading YAML frontmatter (`skill-rules.ts`). The content is sent as JSON, because the server parses only JSON bodies.
- Editing a file skill keeps its content unless a new file is chosen.
- View loads the detail and renders the content as text in `<pre>`, never as HTML. It also offers `curl -H "Authorization: Bearer $AIGATE_KEY" <url>`. No saved key is ever placed in the page.
- A failed read shows the code, the diagnostic and Retry. A failed mutation keeps the modal and draft. Actions are disabled while a mutation runs.
