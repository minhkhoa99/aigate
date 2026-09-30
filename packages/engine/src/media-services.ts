import type { ProviderDescriptor } from "./registry.js";

export type MediaService = {
  readonly id: string;
  readonly name: string;
  readonly authHeader: string;
  readonly search?: { readonly url: string; readonly format: "brave" | "tavily" | "exa" | "ollama" | "serper" | "linkup" | "searchapi" | "youcom" | "xquik" | "glm" };
  readonly fetch?: { readonly url: string; readonly format: "firecrawl" | "jina" | "tavily" | "exa" | "ollama" };
  // SP23 TTS-only services; synthesis and voice lists live in tts.ts, this is only their credential.
  readonly tts?: { readonly url: string };
  readonly credentialProviderId?: string;
};

// SP22's dedicated HTTP services. Chat providers keep their protocol adapters; these only own search/fetch/TTS credentials.
const SERVICES: readonly MediaService[] = [
  { id: "brave-search", name: "Brave Search", authHeader: "x-subscription-token", search: { url: "https://api.search.brave.com/res/v1", format: "brave" } },
  { id: "tavily", name: "Tavily", authHeader: "authorization", search: { url: "https://api.tavily.com/search", format: "tavily" }, fetch: { url: "https://api.tavily.com/extract", format: "tavily" } },
  { id: "exa", name: "Exa", authHeader: "x-api-key", search: { url: "https://api.exa.ai/search", format: "exa" }, fetch: { url: "https://api.exa.ai/contents", format: "exa" } },
  { id: "serper", name: "Serper", authHeader: "x-api-key", search: { url: "https://google.serper.dev", format: "serper" } },
  { id: "linkup", name: "Linkup", authHeader: "authorization", search: { url: "https://api.linkup.so/v1/search", format: "linkup" } },
  { id: "searchapi", name: "SearchAPI", authHeader: "x-api-key", search: { url: "https://www.searchapi.io/api/v1/search", format: "searchapi" } },
  { id: "youcom", name: "You.com", authHeader: "x-api-key", search: { url: "https://ydc-index.io/v1/search", format: "youcom" } },
  { id: "xquik", name: "Xquik", authHeader: "x-api-key", search: { url: "https://xquik.com/api/v1/x/tweets/search", format: "xquik" } },
  { id: "glm", name: "GLM", authHeader: "authorization", search: { url: "https://api.z.ai/api/mcp/web_search_prime/mcp", format: "glm" } },
  { id: "firecrawl", name: "Firecrawl", authHeader: "authorization", fetch: { url: "https://api.firecrawl.dev/v1/scrape", format: "firecrawl" } },
  { id: "jina-reader", name: "Jina Reader", authHeader: "authorization", fetch: { url: "https://r.jina.ai/", format: "jina" } },
  { id: "ollama", name: "Ollama Cloud", authHeader: "authorization", fetch: { url: "https://ollama.com/api/web_fetch", format: "ollama" } },
  { id: "elevenlabs", name: "ElevenLabs", authHeader: "xi-api-key", tts: { url: "https://api.elevenlabs.io/v1/text-to-speech" } },
  { id: "inworld", name: "Inworld TTS", authHeader: "authorization", tts: { url: "https://api.inworld.ai/tts/v1/voice" } },
  { id: "fish-audio", name: "Fish Audio", authHeader: "authorization", tts: { url: "https://api.fish.audio/v1/tts" } },
  { id: "ollama-search", name: "Ollama Search", authHeader: "authorization", credentialProviderId: "ollama", search: { url: "https://ollama.com/api/web_search", format: "ollama" } },
];

export const mediaServices: readonly MediaService[] = SERVICES;
export const mediaService = (id: string): MediaService | undefined => SERVICES.find((service) => service.id === id);

// Connections need the normal descriptor validation, but these endpoints never enter a chat adapter.
export const mediaServiceDescriptor = (id: string): ProviderDescriptor | undefined => {
  const service = mediaService(id);
  if (!service) return undefined;
  const url = service.search?.url ?? service.fetch?.url ?? service.tts?.url;
  if (!url) return undefined;
  return { id: service.id, name: service.name, protocol: "openai-compatible", chatUrl: url, modelsUrl: url, headers: {}, aliases: [], auth: { kind: "api-key", header: service.authHeader, scheme: "bearer" }, models: [] };
};
