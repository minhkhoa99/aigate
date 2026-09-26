# Stream-only providers contract (M2 SP14b)

Scope: the catalog providers that refuse non-streaming chat (9router `transport.forceStream`), reached through the OpenAI-compatible adapter. **codebuddy-cn, codebuddy-intl, and api-airforce** become connectable (the catalog now has **49** connectable providers). OpenAI keeps its SP13 exception: it answers `stream: false`, so it is not stream-only.
- **UI:** no new screen. `/providers` pills, `ProviderDetail`, and the Connections Add modal follow `connectable` from `GET /api/providers`.
- **Not here:** the other forceStream providers stay blocked by their own reason (codex and grok-cli need the Responses adapter and OAuth, commandcode its own adapter, opencode is keyless, zed needs OAuth).

**User decision (2026-09-26): keep the 9router behavior**, including the rules labeled `SUSPECTED_BUG` in `routing.forced-stream-json-collapse` and `provider.codebuddy-request-quirks`. The dashboard and the API docs say where this differs from the streaming path.

## Matrix entries

| Entry | Label | AIGate |
|---|---|---|
| `routing.forced-stream-json-collapse` | `REFERENCE_BEHAVIOR` | A non-streaming client of a stream-only provider gets one `chat.completion`. |
| same: reasoning dropped when there is content, a cut-off stream answered as complete, malformed lines skipped | `SUSPECTED_BUG`, kept by decision | Kept (see "Collapse"). |
| same: unbounded buffering | `SUSPECTED_BUG` | Bounded at 4 MiB, the cap of every JSON answer (`DEFAULT_MAX_BODY_BYTES`); a larger stream is `PROVIDER_UNAVAILABLE`. |
| `provider.codebuddy-request-quirks` | `REFERENCE_BEHAVIOR` | `reasoning_summary: "auto"` with any effort; effort `none`/`off` removed. |
| same: codebuddy-cn system prompt rewrite | `SUSPECTED_BUG`, kept by decision | Kept (see "CodeBuddy"). |

## Registry

`ProviderDescriptor.streamOnly: true` for a catalog provider with `forceStream`, except OpenAI. CodeBuddy's executor behavior becomes descriptor quirks: `reasoningSummary` (both) and `neutralAgentPrompt` (codebuddy-cn only). Catalog headers (CodeBuddy's CLI/IDE identity, api-airforce's `HTTP-Referer`/`X-Title`) are sent as for any provider.

## Upstream call

- A **streaming** client: unchanged (`provider-openai.md` "Stream"; a cut-off stream is an error there).
- A **non-streaming** client of a stream-only provider: `execute()` posts `stream: true` with `stream_options.include_usage` and `accept: text/event-stream`, reads the body (at most 4 MiB), and:
  - if the answer's content-type contains `text/event-stream`, collapses it (below);
  - otherwise reads it as a normal chat-completions JSON answer (9router falls through to its JSON handler the same way).
- Retries, timeouts, and HTTP error classification are the adapter's (`provider-openai.md`).

## Collapse (SSE → CIP response)

| Rule | Behavior |
|---|---|
| Lines | Each line starting with `data:` is trimmed and parsed; empty payloads and `[DONE]` are skipped; a line that is not a JSON object is **skipped silently**. |
| Error event | A chunk with an `error` field is not content; the last one wins. Its `status`, when an integer 400–599, is classified like an HTTP status (`429` → `RATE_LIMIT` → client 429); otherwise `PROVIDER_UNAVAILABLE` (502). The message is `error.message`, else "Upstream SSE stream failed", bounded and with the key redacted. |
| No content chunk | `PROVIDER_UNAVAILABLE` ("sent an SSE response without data to a non-streaming request"). |
| id, model | From the first chunk; model falls back to the requested one; an empty id makes the renderer use its own `chatcmpl-…` id. `created` is AIGate's. |
| Text | `delta.content` concatenated. |
| Reasoning | `delta.reasoning_content` concatenated, **kept only when there is no content** (9router). The streaming path always keeps it. |
| Tool calls | Merged by `index` (missing → 0): a later `id` replaces, `name` and `arguments` are concatenated; sorted by index. |
| finish_reason | The last non-empty one. **None at all (a cut-off stream) is a complete answer** with `stop`. A tool call makes it `tool_calls` (the CIP rule, as for JSON answers). |
| usage | The last `usage` object. |

## CodeBuddy

| Quirk | Behavior |
|---|---|
| `reasoningSummary` (cn, intl) | After the body is built: `reasoning_effort` `none` or `off` is removed; any other effort adds `reasoning_summary: "auto"`. |
| `neutralAgentPrompt` (cn) | A system message whose text (a string, or text blocks joined by `\n`) is longer than 2000 characters or matches 9router's agent-identity pattern (`you are claude code`, `you are cursor/windsurf/cline/aider/continue/copilot/cody`, `you are an ai coding agent`, `cc_entrypoint=`, `<agent-identity>`, …) is replaced by "You are a helpful AI assistant that helps with software engineering tasks.", keeping the string or block shape. The client is not told. |

The connection test is the adapter's (`GET <modelsUrl>`; 9router's generic chat-probe fallback is not ported, as for every catalog provider since SP13).

## Matrix

`routing.forced-stream-json-collapse` and `provider.codebuddy-request-quirks` are `implemented`.
