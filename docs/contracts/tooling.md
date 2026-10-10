# Tooling

## CLI tool discovery (SP25 slice)

`GET /api/tooling/cli-tools` returns the server machine's known CLI integrations. Each row contains `id`, `name`, `installed`, `configExists`, `status` (`configured`, `available`, or `not_detected`), and `configPath` when the standard config file exists. Detection is read-only: it checks `PATH` for the known executable and checks standard config paths under the server process user's home directory. It does not parse config contents, inspect secrets, or write files. Supported adapters open a separate Preview/Apply flow.

The dashboard distinguishes a present config file from an installed command. A config file's existence does not imply it points to AIGate. Results describe the machine running AIGate, which can differ from the machine displaying the browser.

SP43 localizes the discovery list and Claude Code, Codex, OpenCode and Cline
detail screens in EN/VI over these existing APIs. It adds no host actions:
Preview and Apply remain explicit, separate requests. Expired or changed
previews clear the review and require a new diff. See `cli-core-ui-i18n.md`.

### Codex config

`GET /api/tooling/cli-tools/codex` returns install/configuration status, target path, and current model only; it never returns the saved key or raw TOML. `POST .../preview` accepts `{ action: "configure", baseUrl, apiKey, model, subagentModel? }` or `{ action: "reset" }` and returns a five-minute, one-use preview ID plus a redacted diff. `POST .../apply` accepts that ID, checks the config has not changed since review, saves a recoverable `.aigate.bak`, and atomically replaces `~/.codex/config.toml`. Config and diff inputs are bounded to 1 MiB and 200 diff lines; at most 20 previews exist per process. POSIX config permissions are restricted to owner read/write. A custom existing `[model_providers.9router]` section is a conflict unless it is named `9Router`.

The bearer key must be stored in Codex's local TOML because Codex custom providers do not use its auth file. It is never returned by AIGate; the UI warns before review and masks secrets in the diff. Reset removes the AIGate provider and root model selection, and removes only the subagent field tagged as AIGate-managed. It leaves `auth.json` and unmarked subagent values untouched.

### Claude Code config

`GET /api/tooling/cli-tools/claude` returns install/configuration status, target path, and base URL only. `POST .../preview` accepts `{ action: "configure", baseUrl, apiKey }` or `{ action: "reset" }`; `POST .../apply` accepts the returned five-minute, one-use preview ID. Configure normalizes the URL to end in `/v1` and merges `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` into `~/.claude/settings.json` without replacing unrelated environment variables. Reset removes only those two AIGate variables. Existing content must be a JSON object; AIGate refuses to edit JSONC or malformed files rather than risk discarding their content. Apply verifies staleness, creates `.aigate.bak`, atomically replaces the file, and never returns the key. It does not alter `~/.claude.json` or MCP entries.

### OpenCode config

`GET /api/tooling/cli-tools/opencode` returns install/configuration status, target path, saved 9router models, and active AIGate model only. `POST .../preview` accepts `{ action: "configure", baseUrl, apiKey, model }` or `{ action: "reset" }`; `POST .../apply` accepts the returned five-minute, one-use preview ID. Configure normalizes the URL to `/v1`, merges the selected model into `provider.9router.models`, updates only that provider's endpoint and key, and selects `9router/<model>` as the active model. Reset removes the AIGate provider and only clears the active model if it points to AIGate. Existing content must be a JSON object. Apply verifies staleness, creates `.aigate.bak`, atomically replaces the file, and never returns the key. It does not touch OpenCode agents or subagents.

### Cline config

`GET /api/tooling/cli-tools/cline` returns install/configuration status, both target paths, base URL, and model only. `POST .../preview` accepts `{ action: "configure", baseUrl, apiKey, model }` or `{ action: "reset" }`; `POST .../apply` accepts the returned five-minute, one-use preview ID. Configure stores provider/model fields in `~/.cline/data/globalState.json` and the API key in `secrets.json`, normalizing the base URL without `/v1` because Cline expects its OpenAI base at the root. Reset returns both mode providers to `cline` only when both are AIGate's OpenAI provider and removes the separate API key. The two files are previewed together, verified for staleness, backed up, and atomically replaced. If the secret write fails, AIGate attempts to restore the state file; a crash between the two OS-level replacements still needs manual recovery from the `.aigate.bak` files.

### Droid config

`GET /api/tooling/cli-tools/droid` returns installation status, target path, and AIGate model names only. `POST .../preview` accepts `{ action: "configure", baseUrl, apiKey, model }` or `{ action: "reset" }`; `POST .../apply` accepts its five-minute, one-use preview ID. Configure replaces only `custom:9Router*` entries in `~/.factory/settings.json` and preserves other custom models and settings. Reset removes only those entries. Existing content must be a JSON object. Apply verifies staleness, creates `.aigate.bak`, atomically replaces the file, and never returns the key.

### Copilot, Crush, Pi, and Smelt config

Copilot config uses `GET/POST /api/tooling/cli-tools/copilot` plus `/preview` and `/apply`. It manages only the `9Router` entry in VS Code's OS-specific `chatLanguageModels.json`, with the Azure model-picker endpoint suffix. Unlike the reference, installation is detected from the actual command or config file.

Crush, Pi, and Smelt use `GET/POST /api/tooling/cli-tools/json/:tool` plus `/preview` and `/apply`. Crush and Pi manage only `providers.9router`; Smelt manages only its top-level AIGate fields. Every adapter validates the endpoint, key, and model; rejects malformed files; returns a five-minute redacted preview; checks the source has not changed; backs it up; and atomically replaces it.

### OpenClaw config

OpenClaw needs one reviewed change spanning `~/.openclaw/openclaw.json` and each listed agent's `models.json`. Configure manages only the `9router` provider, the matching default-model allowlist entries, and explicitly selected agent overrides. Reset removes only those AIGate-owned fields. The preview must enumerate every target file, cap the agent-file count, and reject malformed input or symlinks. Apply verifies every file is unchanged, writes atomic backups, and restores already-written files if a later replacement fails.

### DeepSeek TUI config

DeepSeek TUI uses `GET/POST /api/tooling/cli-tools/toml/deepseek-tui` plus `/preview` and `/apply`. Configure selects `provider = "openai"` and supplies the matching `[providers.openai]` AIGate model block in `~/.deepseek/config.toml`. Before replacing an existing provider line or OpenAI table, it stores their exact content in AIGate-owned TOML comments. Reset removes the AIGate block and restores that prior content, or restores DeepSeek's default provider for a newly created file. This avoids the reference implementation's full-file overwrite. The standard five-minute, redacted preview, stale-file refusal, backup, and atomic replace rules apply.

### Hermes config

Hermes uses `GET/POST /api/tooling/cli-tools/hermes` plus `/preview` and `/apply` to manage `~/.hermes/config.yaml` and `~/.hermes/.env` as one reviewed change. Configure writes the custom model block with `${OPENAI_API_KEY}` and stores the key only in `.env`. It records any prior model block and `OPENAI_API_KEY` in AIGate-owned comments, so Reset restores them rather than deleting user configuration or leaving an obsolete key. Apply verifies both files are unchanged, backs them up, atomically writes both, and restores an already-written file if the second replacement fails.

### JCode, Oh My Pi, and Grok Build config

JCode uses `GET/POST /api/tooling/cli-tools/jcode` plus `/preview` and `/apply`. It writes only the `providers.9router` TOML entry in `~/.jcode/config.toml`; the key remains in `$XDG_CONFIG_HOME/jcode/provider-9router.env`. Reset restores any prior provider and key captured by the first Apply.

Oh My Pi uses `GET/POST /api/tooling/cli-tools/omp` plus `/preview` and `/apply` to manage only its `9router` provider entry in `~/.omp/agent/models.yml`. Grok Build uses the corresponding `grok-build` route to manage model slot `9router`, the default model mapping, and optional general-purpose, explore, and plan subagent slots. It records and restores prior mappings on Reset. Both use the standard preview, stale-file, backup, and atomic replace flow.

## Skills catalogue

The Skills page lists the eight repository skills and copies each raw `SKILL.md` URL on request. URLs target `decolua/9router`'s `master` branch. Skills are not installed by the dashboard.

SP42 localizes the Skills page's owned text in EN/VI while copied URLs, skill
IDs and endpoint paths remain literal. See `integrations-skills-mcp-ui-i18n.md`.

## Console log

`GET /api/tooling/logs` returns up to 200 recent request metadata events. `GET /api/tooling/logs/stream` sends new events over SSE; at most eight streams may be open. `DELETE /api/tooling/logs` clears the in-memory buffer and tells open streams to clear their local view. Events derive from completed usage records and contain the request ID, provider, model, status, error code, and token count. Request and response bodies, provider credentials, and API keys are not captured. The buffer is process-local and resets on restart.

SP39 localizes the existing Developer Console's owned UI and its closed gate in
EN/VI. It adds no API or log fields; see `console-ui-i18n.md` for read/Clear
error, filter, locale switch and SSE lifecycle acceptance.

## Tunnel

`GET /api/tooling/tunnel` reports Tailscale installation, Funnel status, the public URL for the AIGate route, and access readiness. `POST .../enable` requires dashboard login, a configured dashboard password, required API-key enforcement, and at least one active key. It starts `tailscale funnel --https=443 --bg --yes` for AIGate's loopback port. Before starting, it refuses an active unrelated Funnel route or an unverifiable status. `POST .../disable` disables only AIGate's loopback route. AIGate does not install Tailscale. Funnel is public internet access and must be enabled deliberately.

## MCP registry

`GET/POST /api/tooling/mcp/servers`, `PATCH/DELETE /api/tooling/mcp/servers/:id` manage up to 100 server endpoint records in `mcp-servers.json` under `AIGATE_DATA_DIR`. Records are explicitly scoped to `user` or `project`. HTTPS is required except localhost; URL credentials, query strings, and fragments are rejected. Writes use an atomic replacement and a `.bak` copy. The UI copies enabled entries as Claude Code or Cursor JSON; it does not write workstation files. AIGate does not connect to or probe remote servers or implement MCP transport.

`GET /api/tooling/mcp/marketplace` reads direct HTTPS entries from the fixed Anthropic MCP registry through AIGate's transport, with an eight-second deadline, 1 MiB response cap, and one-hour in-memory cache. Entries routed through Claude-hosted intermediaries are excluded. Adding a marketplace entry creates an ordinary user-scoped registry record; OAuth remains the selected client's responsibility.

SP42 localizes the MCP registry/marketplace/storage UI in EN/VI without
changing these limits or server validation. Failed reads show code, permitted
diagnostic and Retry; locale changes preserve tabs, drafts and pending actions.
See `integrations-skills-mcp-ui-i18n.md`.

## Local interception

`GET /api/tooling/mitm` reports the local CA, leaf certificate, listener state, and the supported IDE API hosts. `POST /api/tooling/mitm/preview` and `POST /api/tooling/mitm/apply` use the same five-minute reviewed action flow for `generate`, `install`, `start`, `stop`, and `remove`. Start creates a leaf certificate for the supported hosts, binds a TLS listener to `127.0.0.1:443`, and adds only AIGate-marked hosts-file records. It proxies those requests to AIGate's local `PORT` (default `20200`). Stop and process shutdown close the listener and remove the marked records. CA installation/removal is implemented with Windows `certutil`; unsupported platforms report a typed error. The hosts file is backed up under `AIGATE_DATA_DIR/mitm` before every replacement.

SP41 localizes the existing Tunnel and MITM dashboards in EN/VI without
changing their system actions. See `network-safety-ui-i18n.md` for confirmation,
preview, error and locale-switch boundaries.
