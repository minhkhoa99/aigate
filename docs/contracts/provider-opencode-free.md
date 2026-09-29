# OpenCode Free provider contract (M2 SP18)

OpenCode is the first runtime keyless chat provider. It creates no provider
connection and uses the configured keyless proxy strategy on every request.

- The public upstream contract uses `Authorization: Bearer public`,
  `User-Agent: opencode/1.18.31`, a valid `x-opencode-session`, a fresh valid
  `x-opencode-request`, `x-opencode-client: desktop`, and project `global`.
  These are fixed protocol markers, not a stored user credential.
- The two Muse Spark free models use `/zen/v1/responses`; `union-alpha` uses
  `/zen/v1/messages`; other chat models use `/zen/v1/chat/completions`.
  Every request is streamed upstream; a non-streaming AIGate client receives a
  collected response.
- The endpoint requires the lowercase tool fingerprint `bash`, `glob`, `grep`,
  `read`. AIGate canonicalizes those four client tool names, drops duplicate
  variants, and adds only missing unavailable definitions. The 1.3 Muse model
  forces a non-auto tool choice to `auto`, as required upstream.
- Models remain the bounded static catalog. AIGate does not import the mutable
  live list from `/zen/v1/models` into persistent configuration.

`GET /api/proxy-pools/rotations` now returns OpenCode, and Network → Proxy
Pools can assign its fixed, round-robin, or random active-pool strategy.
