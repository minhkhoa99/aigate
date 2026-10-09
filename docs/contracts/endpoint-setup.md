# Endpoint & Keys client setup (SP33 / M3 U3)

`/gateway/endpoint` uses the existing session-protected key/settings/connection
queries and the four already-implemented client protocol lanes. SP33 changes
dashboard presentation only; it adds no API, dependency, storage key or vendor
call. A fixed protocol selector shows one setup at a time:

| Selection | Displayed URL | Setup command | Test route |
|---|---|---|---|
| OpenAI Chat | `<origin>/v1` | `OPENAI_BASE_URL` and `OPENAI_API_KEY` | `POST /v1/chat/completions` |
| Anthropic Messages | `<origin>` | `ANTHROPIC_BASE_URL` and `ANTHROPIC_API_KEY` | `POST /v1/messages` |
| OpenAI Responses / Codex | `<origin>/v1` | `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `codex -m` | `POST /v1/responses` |
| Gemini generateContent | full `<origin>/v1beta/models/<provider>/<model>:generateContent` | no invented SDK environment variable | `POST /v1beta/models/*` |

The protocol selector changes only local component state. It must not reset the
one-time plaintext key modal, the revoke confirmation, any pending mutation or
the TanStack Query cache. Switching EN/VI likewise preserves the selection and
does not refetch. The setup command and curl body remain literal executable
examples; surrounding labels, readiness, key table, security controls and
errors use the shared EN/VI catalogs. The placeholder API key is quoted in
shell commands so `<...>` is not interpreted as shell redirection. Never insert
a real key into an example or persist the one-time plaintext key.

Readiness is based on saved connection state, not a live provider probe. If its
read fails, the status is unknown and Retry is available. A failed key/settings
read shows its stable API code and localized or raw diagnostic. The API key
list is bounded by the existing 100-key server cap. Existing create,
activate/deactivate, type-to-confirm revoke and require-key mutations remain
unchanged; their notices resolve the selected language at render time.

Acceptance: verify each selected URL/command/request path against the actual
server routes, the one-time key and mutation behavior, EN/VI selection while
mounted, read-error/Retry states, copied strings, 390px layout, and zero
unexpected network calls on a protocol/locale switch. Use synthetic local API
responses and no real credentials or upstream requests.
