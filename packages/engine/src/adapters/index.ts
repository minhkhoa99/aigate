import type { AIProviderPort, HttpTransportPort } from "../ports.js";
import type { ProviderDescriptor } from "../registry.js";
import { AnthropicAdapter } from "./anthropic.js";
import { OpenAICompatibleAdapter } from "./openai-compatible.js";
import { GeminiAdapter } from "./gemini.js";
import { OllamaAdapter } from "./ollama.js";
import { OpenAIResponsesAdapter } from "./openai-responses.js";
import { VertexAdapter, VertexPartnerAdapter } from "./vertex.js";

// Adapters are chosen by protocol family, never per vendor (spec §4.2).
export function createAdapter(provider: ProviderDescriptor, transport: HttpTransportPort): AIProviderPort {
  switch (provider.protocol) {
    case "anthropic": return new AnthropicAdapter(provider, transport);
    case "openai-responses": return new OpenAIResponsesAdapter(provider, transport);
    case "ollama": return new OllamaAdapter(provider, transport);
    case "gemini": return new GeminiAdapter(provider, transport);
    case "vertex": return new VertexAdapter(provider, transport);
    // vertex-partner: the OpenAI chat protocol with Google Cloud credentials (routing.vertex-endpoints).
    default: return provider.auth.googleCloud ? new VertexPartnerAdapter(provider, transport) : new OpenAICompatibleAdapter(provider, transport);
  }
}
