import type { AIProviderPort, HttpTransportPort } from "../ports.js";
import type { ProviderDescriptor } from "../registry.js";
import { AnthropicAdapter } from "./anthropic.js";
import { OpenAICompatibleAdapter } from "./openai-compatible.js";

// Adapters are chosen by protocol family, never per vendor (spec §4.2).
export function createAdapter(provider: ProviderDescriptor, transport: HttpTransportPort): AIProviderPort {
  return provider.protocol === "anthropic" ? new AnthropicAdapter(provider, transport) : new OpenAICompatibleAdapter(provider, transport);
}
