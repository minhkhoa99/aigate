import type { CanonicalRequest } from "./cip.js";
import type { ProviderDescriptor, ProviderProtocol } from "./registry.js";

// routing.provider-thinking-default (docs/contracts/provider-thinking.md): the thinking level a provider applies to a
// request that carries none, and the levels its picker offers. Kept from 9router (settings.providerThinking), with
// its levels by protocol family instead of per model format.

export const THINKING_LEVELS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

// 9router thinkingLevels.js FORMAT_LEVELS, by the family AIGate's adapter speaks: OpenAI effort, the Claude budget
// levels, Gemini's thinking level and budget together, Ollama's base set, Command Code's full set.
const FAMILY_LEVELS: Readonly<Record<ProviderProtocol, readonly ThinkingLevel[]>> = {
  "openai-compatible": ["none", "minimal", "low", "medium", "high", "xhigh"],
  "openai-responses": ["none", "minimal", "low", "medium", "high", "xhigh"],
  anthropic: ["none", "low", "medium", "high", "xhigh", "max"],
  gemini: ["none", "minimal", "low", "medium", "high"],
  vertex: ["none", "minimal", "low", "medium", "high"],
  ollama: ["none", "low", "medium", "high"],
  commandcode: ["none", "low", "medium", "high", "xhigh", "max"],
};
// 9router effortToBudget (LEVEL_TO_BUDGET), for the Claude budget.
const CLAUDE_BUDGET: Readonly<Record<string, number>> = { minimal: 512, low: 1_024, medium: 8_192, high: 24_576, xhigh: 32_768, max: 128_000 };
const KNOWN_EFFORTS = new Set(["low", "medium", "high"]);

export const isThinkingLevel = (value: unknown): value is ThinkingLevel => THINKING_LEVELS.some((level) => level === value);

const reasons = (provider: ProviderDescriptor, model: string): boolean =>
  provider.models.find((descriptor) => descriptor.id === model)?.capabilities.reasoning === true;

// The picker's levels, or null when none of the provider's models reasons (9router hides the picker then).
export function thinkingLevels(provider: ProviderDescriptor): readonly ThinkingLevel[] | null {
  return provider.models.some((model) => model.capabilities.reasoning) ? FAMILY_LEVELS[provider.protocol] : null;
}

// The request with the provider's level, as if the client had sent it: reasoning_effort for the OpenAI-style families,
// a thinking budget for the Anthropic family. Unchanged when the client sent its own thinking or effort (9router
// checks only reasoning_effort, so its level overrode a Claude budget or a Responses effort; AIGate keeps 9router's
// stated rule, "only if client hasn't set"), when the model does not reason (9router strips thinking from those), or
// when the family does not take the level.
export function withThinking(request: CanonicalRequest, provider: ProviderDescriptor, level: ThinkingLevel): CanonicalRequest {
  if (request.reasoning !== undefined || request.vendorExtensions?.openai?.reasoning_effort !== undefined) return request;
  if (!reasons(provider, request.model) || !FAMILY_LEVELS[provider.protocol].includes(level)) return request;
  if (provider.protocol === "anthropic") {
    // No thinking is Claude's default, so none sends nothing.
    const budget = CLAUDE_BUDGET[level];
    return budget === undefined ? request : { ...request, reasoning: { budgetTokens: budget } };
  }
  // A Claude model behind an OpenAI-style provider (Copilot's /v1/messages) takes only the three efforts it can map.
  if (/claude/i.test(request.model) && !KNOWN_EFFORTS.has(level)) return request;
  if (level === "low" || level === "medium" || level === "high") return { ...request, reasoning: { effort: level } };
  return { ...request, vendorExtensions: { ...request.vendorExtensions, openai: { ...request.vendorExtensions?.openai, reasoning_effort: level } } };
}
