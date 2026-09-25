import type { ModelCapabilities, ProviderDescriptor } from "../registry.js";

// The single SP7 registry entry. Data comes from 9router open-sse/providers/registry/openai.js
// (ids, names) and capabilities.js:302-304 (modalities, limits; tools default on at :53).
// ponytail: four chat models only; tools/extract (SP4) generates the full catalog for SP13.
const base: ModelCapabilities = { vision: true, pdf: false, audioInput: false, videoInput: false, tools: true, reasoning: false };

export const openai: ProviderDescriptor = {
  id: "openai",
  name: "OpenAI",
  protocol: "openai-compatible",
  baseUrl: "https://api.openai.com/v1",
  auth: { kind: "api-key", header: "authorization", scheme: "Bearer" },
  models: [
    { id: "gpt-5", name: "GPT-5", kind: "chat", capabilities: { ...base, reasoning: true }, contextWindow: 400_000, maxOutputTokens: 128_000 },
    { id: "gpt-4.1", name: "GPT-4.1", kind: "chat", capabilities: base, contextWindow: 1_000_000, maxOutputTokens: 32_768 },
    { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", kind: "chat", capabilities: base, contextWindow: 1_000_000, maxOutputTokens: 32_768 },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", kind: "chat", capabilities: base, contextWindow: 128_000, maxOutputTokens: 16_384 },
  ],
};
