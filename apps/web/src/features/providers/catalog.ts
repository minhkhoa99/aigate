// Built-in LLM catalog from 9Router's visible UI and active, non-hidden registry
// entries inspected on 2026-09-24. Custom providers are user data.
export const providerGroups = [
  { id: "oauth", title: "OAuth providers", providers: [
    ["claude", "Claude Code"], ["antigravity", "Antigravity"], ["codex", "OpenAI Codex"],
    ["qoder", "Qoder"], ["github", "GitHub Copilot"], ["cursor", "Cursor IDE"],
    ["kilocode", "Kilo Code"], ["cline", "Cline"], ["clinepass", "ClinePass"],
    ["codebuddy-intl", "CodeBuddy"], ["codebuddy-cn", "CodeBuddy CN"], ["kimi", "Kimi"],
    ["grok-cli", "Grok CLI (Grok Build)"], ["xai", "xAI (Grok)"],
    ["qoder-cn", "Qoder CN"], ["zed", "Zed"],
  ] },
  { id: "free", title: "Free Tier providers", providers: [
    ["opencode", "OpenCode Free"], ["gemini-cli", "Gemini CLI"], ["kiro", "Kiro AI"],
    ["openrouter", "OpenRouter"], ["nvidia", "NVIDIA NIM"], ["ollama", "Ollama Cloud"],
    ["vertex", "Vertex AI"], ["gemini", "Gemini"], ["cloudflare-ai", "Cloudflare"],
    ["poolside", "Poolside"], ["byteplus", "BytePlus ModelArk"], ["kimchi", "Kimchi"],
    ["api-airforce", "API.airforce"], ["bazaarlink", "Bazaarlink"], ["kilo-gateway", "Kilo Gateway"],
  ] },
  { id: "apikey", title: "API Key providers", providers: [
    ["alicode", "Alibaba"], ["alicode-intl", "Alibaba Coding"], ["alims-intl", "Alibaba Studio"],
    ["anthropic", "Anthropic"], ["azure", "Azure OpenAI"], ["baidu", "Baidu Qianfan"],
    ["blackbox", "Blackbox AI"], ["cerebras", "Cerebras"], ["chutes", "Chutes AI"],
    ["cohere", "Cohere"], ["commandcode", "Command Code"], ["deepseek", "DeepSeek"],
    ["featherless", "Featherless"], ["fireworks", "Fireworks AI"], ["glm-cn", "GLM (China)"],
    ["glm", "GLM Coding"], ["groq", "Groq"], ["hyperbolic", "Hyperbolic"],
    ["llm7", "LLM7"], ["minimax-cn", "Minimax (China)"], ["minimax", "Minimax Coding"],
    ["mistral", "Mistral"], ["morph", "Morph"], ["nebius", "Nebius AI"],
    ["ollama-local", "Ollama Local"], ["openai", "OpenAI"], ["opencode-go", "OpenCode Go"],
    ["perplexity", "Perplexity"], ["perplexity-agent", "Perplexity Agent"], ["siliconflow", "SiliconFlow"],
    ["tencent", "Tencent Hunyuan"], ["together", "Together AI"], ["tokenrouter", "TokenRouter"],
    ["venice", "Venice AI"], ["vercel-ai-gateway", "Vercel AI Gateway"],
    ["vertex-partner", "Vertex Partner"], ["volcengine-ark", "Volcengine Ark"],
    ["xiaomi-mimo", "Xiaomi MiMo"], ["xiaomi-tokenplan", "Xiaomi MiMo (Token Plan)"],
    ["opencode-zen", "OpenCode Zen"], ["alitp-intl", "Alibaba Token Plan"],
  ] },
  { id: "webCookie", title: "Web account providers", providers: [
    ["grok-web", "Grok Web (Subscription)"],
    ["perplexity-web", "Perplexity Web (Pro/Max)"],
  ] },
] as const;

export const providers = providerGroups.flatMap((group) => group.providers.map(([id, name]) => ({ id, name, group: group.id })));

// Capability lists from 9Router's Media Providers UI on the same date. A provider
// may appear in several lists because each list represents a different lane.
export const mediaGroups = [
  { id: "embedding", title: "Embeddings", providers: [
    ["openrouter", "OpenRouter"], ["nvidia", "NVIDIA NIM"], ["openai", "OpenAI"],
    ["github", "GitHub Copilot"], ["voyage-ai", "Voyage AI"], ["gemini", "Gemini"],
    ["fireworks", "Fireworks AI"], ["selfhosted-embedding", "Self-hosted Embedding"],
    ["together", "Together AI"], ["nebius", "Nebius AI"], ["mistral", "Mistral"],
    ["venice", "Venice AI"], ["vercel-ai-gateway", "Vercel AI Gateway"],
    ["jina-ai", "Jina AI"], ["tokenrouter", "TokenRouter"],
  ] },
  { id: "image", title: "Image generation", providers: [
    ["antigravity", "Antigravity"], ["codex", "OpenAI Codex"], ["openai", "OpenAI"],
    ["gemini", "Gemini"], ["black-forest-labs", "Black Forest Labs"],
    ["cloudflare-ai", "Cloudflare"], ["stability-ai", "Stability AI"],
    ["huggingface", "HuggingFace"], ["recraft", "Recraft"], ["nanobanana", "NanoBanana API"],
    ["runwayml", "Runway ML"], ["fal-ai", "Fal.ai"], ["minimax", "Minimax Coding"],
    ["sdwebui", "SD WebUI"], ["venice", "Venice AI"], ["comfyui", "ComfyUI"],
    ["vercel-ai-gateway", "Vercel AI Gateway"], ["xai", "xAI (Grok)"],
    ["topaz", "Topaz"], ["tokenrouter", "TokenRouter"],
  ] },
  { id: "tts", title: "Text to speech", providers: [
    ["edge-tts", "Edge TTS"], ["google-tts", "Google TTS"], ["local-device", "Local Device"],
    ["openrouter", "OpenRouter"], ["nvidia", "NVIDIA NIM"], ["openai", "OpenAI"],
    ["gemini", "Gemini"], ["selfhosted-tts", "Self-hosted TTS"],
    ["minimax", "Minimax Coding"], ["minimax-cn", "Minimax (China)"],
    ["xiaomi-mimo", "Xiaomi MiMo"], ["aws-polly", "AWS Polly"],
    ["elevenlabs", "ElevenLabs"], ["inworld", "Inworld TTS"], ["fish-audio", "Fish Audio"],
  ] },
  { id: "stt", title: "Speech to text", providers: [
    ["deepgram", "Deepgram"], ["assemblyai", "AssemblyAI"], ["openai", "OpenAI"],
    ["gemini", "Gemini"], ["selfhosted-stt", "Self-hosted STT"],
    ["groq", "Groq"], ["huggingface", "HuggingFace"],
  ] },
  { id: "video", title: "Video", providers: [["xai", "xAI (Grok)"]] },
  { id: "webSearch", title: "Web search", providers: [
    ["openai", "OpenAI"], ["gemini", "Gemini"], ["minimax", "Minimax Coding"],
    ["vercel-ai-gateway", "Vercel AI Gateway"], ["kimi", "Kimi"],
    ["perplexity", "Perplexity"], ["perplexity-agent", "Perplexity Agent"],
    ["xai", "xAI (Grok)"], ["searxng", "SearXNG"], ["brave-search", "Brave Search"],
    ["exa", "Exa"], ["google-pse", "Google PSE"], ["linkup", "Linkup"],
    ["searchapi", "SearchAPI"], ["serper", "Serper"], ["tavily", "Tavily"],
    ["youcom", "You.com Search"], ["ollama-search", "Ollama Search"], ["xquik", "Xquik"],
  ] },
  { id: "webFetch", title: "Web fetch", providers: [
    ["exa", "Exa"], ["firecrawl", "Firecrawl"], ["jina-reader", "Jina Reader"], ["tavily", "Tavily"],
  ] },
] as const;

export const mediaOnlyProviders = mediaGroups.flatMap((group) => group.providers.map(([id, name]) => ({ id, name, group: "media" })))
  .filter((provider, index, items) => !providers.some((item) => item.id === provider.id) && items.findIndex((item) => item.id === provider.id) === index);

export const allProviders: { id: string; name: string; group: string }[] = [...providers, ...mediaOnlyProviders];
