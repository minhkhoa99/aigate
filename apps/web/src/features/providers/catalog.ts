// The LLM catalog comes from GET /api/providers (docs/contracts/catalog-providers.md); these media
// lists stay static until the media lanes (SP22/SP23).
// Capability lists from 9Router's Media Providers UI, inspected on 2026-09-24. A provider
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
