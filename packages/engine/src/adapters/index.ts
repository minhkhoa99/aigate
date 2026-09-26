import type { AIProviderPort, HttpTransportPort } from "../ports.js";
import type { ProviderDescriptor } from "../registry.js";
import { AnthropicAdapter } from "./anthropic.js";
import { OpenAICompatibleAdapter } from "./openai-compatible.js";
import { OllamaAdapter } from "./ollama.js";
import { OpenAIResponsesAdapter } from "./openai-responses.js";

// Adapters are chosen by protocol family, never per vendor (spec §4.2).
export function createAdapter(provider: ProviderDescriptor, transport: HttpTransportPort): AIProviderPort {
  switch (provider.protocol) {
    case "anthropic": return new AnthropicAdapter(provider, transport);
    case "openai-responses": return new OpenAIResponsesAdapter(provider, transport);
    case "ollama": return new OllamaAdapter(provider, transport);
    default: return new OpenAICompatibleAdapter(provider, transport);
  }
}
