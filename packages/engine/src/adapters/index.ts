import type { AIProviderPort, HttpTransportPort } from "../ports.js";
import type { ProviderDescriptor } from "../registry.js";
import { AnthropicAdapter } from "./anthropic.js";
import { AntigravityAdapter } from "./antigravity.js";
import { CommandCodeAdapter } from "./commandcode.js";
import { OpenAICompatibleAdapter } from "./openai-compatible.js";
import { GeminiAdapter } from "./gemini.js";
import { GeminiCliAdapter } from "./gemini-cli.js";
import { GithubAdapter } from "./github.js";
import { OllamaAdapter } from "./ollama.js";
import { OpenAIResponsesAdapter } from "./openai-responses.js";
import { GrokCliAdapter } from "./grok-cli.js";
import { IFlowAdapter } from "./iflow.js";
import { KimiAdapter } from "./kimi.js";
import { StreamRetryAdapter } from "./stream-retry.js";
import { VertexAdapter, VertexPartnerAdapter } from "./vertex.js";

// Adapters are chosen by protocol family, never per vendor (spec §4.2). A custom provider may ask for its stream
// failures to be retried (docs/contracts/custom-providers.md).
export function createAdapter(provider: ProviderDescriptor, transport: HttpTransportPort): AIProviderPort {
  const adapter = familyAdapter(provider, transport);
  return provider.retryStreamErrors ? new StreamRetryAdapter(adapter, provider.streamRetryDelayMs) : adapter;
}

function familyAdapter(provider: ProviderDescriptor, transport: HttpTransportPort): AIProviderPort {
  // provider.github-copilot-oauth: Copilot routes each model to one of three families (9router GithubExecutor).
  if (provider.quirks?.includes("copilot")) return new GithubAdapter(provider, transport);
  // provider.gemini-cli-oauth: the Gemini protocol inside Cloud Code's envelope.
  if (provider.quirks?.includes("geminiCli")) return new GeminiCliAdapter(provider, transport);
  if (provider.quirks?.includes("antigravity")) return new AntigravityAdapter(provider, transport);
  if (provider.quirks?.includes("grokCli")) return new GrokCliAdapter(provider, transport);
  if (provider.quirks?.includes("kimi")) return new KimiAdapter(provider, transport);
  if (provider.quirks?.includes("iflow")) return new IFlowAdapter(provider, transport);
  switch (provider.protocol) {
    case "anthropic": return new AnthropicAdapter(provider, transport);
    case "openai-responses": return new OpenAIResponsesAdapter(provider, transport);
    case "ollama": return new OllamaAdapter(provider, transport);
    case "gemini": return new GeminiAdapter(provider, transport);
    case "vertex": return new VertexAdapter(provider, transport);
    case "commandcode": return new CommandCodeAdapter(provider, transport);
    // vertex-partner: the OpenAI chat protocol with Google Cloud credentials (routing.vertex-endpoints).
    default: return provider.auth.googleCloud ? new VertexPartnerAdapter(provider, transport) : new OpenAICompatibleAdapter(provider, transport);
  }
}
