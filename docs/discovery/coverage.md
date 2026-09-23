# Discovery coverage

Entries: 210

| Dimension | Covered | Missing (sample) |
|---|---|---|
| routes | 94/154 | api/auth/logout, api/auth/oidc/callback, api/auth/oidc/start, api/auth/oidc/test, api/auth/reset-password, api/auth/saml/acs, api/auth/saml/metadata, api/auth/saml/start … +52 |
| pages | 5/28 | (dashboard)/dashboard, (dashboard)/dashboard/basic-chat, (dashboard)/dashboard/cli-tools, (dashboard)/dashboard/cli-tools/[toolId], (dashboard)/dashboard/combos, (dashboard)/dashboard/console-log, (dashboard)/dashboard/endpoint, (dashboard)/dashboard/media-providers/[kind]/[id] … +15 |
| providers | 15/122 | alicode, alicode-intl, alims-intl, alitp-intl, anthropic, api-airforce, assemblyai, aws-polly … +99 |
| executors | 9/29 | azure, codebuddy-cn, codebuddy-intl, devin-cli, gemini-cli, github, grok-cli, grok-web … +12 |
| translators | 35/48 | open-sse/translator/concerns/chunk.js, open-sse/translator/concerns/json.js, open-sse/translator/concerns/kiroConversation.js, open-sse/translator/concerns/message.js, open-sse/translator/concerns/modality.js, open-sse/translator/concerns/paramSupport.js, open-sse/translator/concerns/prefetch.js, open-sse/translator/concerns/reasoning.js … +5 |
| repos | 10/11 | nodesRepo |
| settingsKeys | 32/52 | cloudEnabled, dnsToolEnabled, mitmRouterBaseUrl, oidcClientId, oidcIssuerUrl, oidcLoginLabel, oidcScopes, samlAttributeEmail … +12 |

## Entries per bounded context

- apikeys: 9
- catalog: 21
- connections: 38
- identity: 1
- media: 15
- routing: 79
- settings: 7
- tooling: 3
- transport: 14
- usage: 23

## Labels

- IMPLEMENTATION_ACCIDENT: 9
- REFERENCE_BEHAVIOR: 175
- SUSPECTED_BUG: 26

## Missing — routes

- api/auth/logout
- api/auth/oidc/callback
- api/auth/oidc/start
- api/auth/oidc/test
- api/auth/reset-password
- api/auth/saml/acs
- api/auth/saml/metadata
- api/auth/saml/start
- api/auth/saml/test
- api/auth/status
- api/cli-tools/all-statuses
- api/cli-tools/antigravity-mitm
- api/cli-tools/antigravity-mitm/alias
- api/cli-tools/claude-settings
- api/cli-tools/cline-settings
- api/cli-tools/codex-settings
- api/cli-tools/copilot-settings
- api/cli-tools/cowork-mcp-registry
- api/cli-tools/cowork-mcp-tools
- api/cli-tools/cowork-settings
- api/cli-tools/deepseek-tui-settings
- api/cli-tools/devin-settings
- api/cli-tools/droid-settings
- api/cli-tools/grok-build-settings
- api/cli-tools/hermes-settings
- api/cli-tools/jcode-settings
- api/cli-tools/kilo-settings
- api/cli-tools/openclaw-settings
- api/cli-tools/opencode-settings
- api/health
- api/init
- api/mcp/[plugin]/message
- api/mcp/[plugin]/sse
- api/provider-nodes/[id]
- api/provider-nodes/validate
- api/providers/[id]/models
- api/providers/[id]/test
- api/providers/[id]/test-models
- api/providers/client
- api/providers/kilo/free-models
- api/providers/suggested-models
- api/providers/test-batch
- api/settings/database
- api/settings/proxy-test
- api/settings/require-login
- api/shutdown
- api/tags
- api/tunnel/disable
- api/tunnel/enable
- api/tunnel/status
- api/tunnel/tailscale-check
- api/tunnel/tailscale-disable
- api/tunnel/tailscale-enable
- api/tunnel/tailscale-install
- api/v1/models/[...model]
- api/v1beta/models
- api/v1beta/models/[...path]
- api/version
- api/version/shutdown
- api/version/update

## Missing — pages

- (dashboard)/dashboard
- (dashboard)/dashboard/basic-chat
- (dashboard)/dashboard/cli-tools
- (dashboard)/dashboard/cli-tools/[toolId]
- (dashboard)/dashboard/combos
- (dashboard)/dashboard/console-log
- (dashboard)/dashboard/endpoint
- (dashboard)/dashboard/media-providers/[kind]/[id]
- (dashboard)/dashboard/media-providers/combo/[id]
- (dashboard)/dashboard/mitm
- (dashboard)/dashboard/providers
- (dashboard)/dashboard/providers/new
- (dashboard)/dashboard/proxy-pools
- (dashboard)/dashboard/pxpipe
- (dashboard)/dashboard/skills
- (dashboard)/dashboard/token-saver
- (dashboard)/dashboard/translator
- (dashboard)/dashboard/usage
- callback
- dashboard/settings/pricing
- landing
- login
- page.js

## Missing — providers

- alicode
- alicode-intl
- alims-intl
- alitp-intl
- anthropic
- api-airforce
- assemblyai
- aws-polly
- azure
- baidu
- bazaarlink
- black-forest-labs
- blackbox
- bluesminds
- brave-search
- byteplus
- cartesia
- cerebras
- chutes
- cline
- clinepass
- cloudflare-ai
- codebuddy-cn
- codebuddy-intl
- cohere
- comfyui
- commandcode
- coqui
- cursor
- deepgram
- devin-cli
- edge-tts
- elevenlabs
- exa
- fal-ai
- featherless
- firecrawl
- fireworks
- fish-audio
- gemini-cli
- github
- glm
- glm-cn
- google-pse
- google-tts
- grok-web
- groq
- huggingface
- hyperbolic
- iflow
- inworld
- jina-ai
- jina-reader
- kilo-gateway
- kilocode
- kimchi
- linkup
- llm7
- local-device
- mimo-free
- minimax
- minimax-cn
- mistral
- mmf
- morph
- nanobanana
- nebius
- nvidia
- ollama
- ollama-local
- ollama-search
- opencode
- opencode-go
- perplexity
- perplexity-agent
- perplexity-web
- playht
- poolside
- qoder
- recraft
- sambanova
- sdwebui
- searchapi
- searxng
- selfhosted-embedding
- selfhosted-stt
- selfhosted-tts
- serper
- siliconflow
- stability-ai
- tavily
- tencent
- together
- tokenrouter
- topaz
- tortoise
- venice
- vertex
- vertex-partner
- volcengine-ark
- voyage-ai
- windsurf
- xai
- xiaomi-mimo
- xiaomi-tokenplan
- xquik
- youcom

## Missing — executors

- azure
- codebuddy-cn
- codebuddy-intl
- devin-cli
- gemini-cli
- github
- grok-cli
- grok-web
- iflow
- kimchi
- mimo-free
- ollama-local
- opencode
- opencode-go
- perplexity-web
- qoder
- vertex
- windsurf
- xiaomi-tokenplan
- zed

## Missing — translators

- open-sse/translator/concerns/chunk.js
- open-sse/translator/concerns/json.js
- open-sse/translator/concerns/kiroConversation.js
- open-sse/translator/concerns/message.js
- open-sse/translator/concerns/modality.js
- open-sse/translator/concerns/paramSupport.js
- open-sse/translator/concerns/prefetch.js
- open-sse/translator/concerns/reasoning.js
- open-sse/translator/concerns/thinking.js
- open-sse/translator/formats/claude.js
- open-sse/translator/formats/gemini.js
- open-sse/translator/formats/maxTokens.js
- open-sse/translator/formats/responsesApi.js

## Missing — repos

- nodesRepo

## Missing — settingsKeys

- cloudEnabled
- dnsToolEnabled
- mitmRouterBaseUrl
- oidcClientId
- oidcIssuerUrl
- oidcLoginLabel
- oidcScopes
- samlAttributeEmail
- samlAttributeName
- samlCert
- samlEntryPoint
- samlIssuer
- samlLoginLabel
- ssoType
- tailscaleEnabled
- tailscaleUrl
- tunnelDashboardAccess
- tunnelEnabled
- tunnelProvider
- tunnelUrl
