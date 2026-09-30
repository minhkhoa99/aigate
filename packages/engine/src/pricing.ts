import type { TokenUsage } from "./cip.js";
import { MODEL_PRICING, PATTERN_PRICING, PROVIDER_PRICING } from "./pricing-table.js";

// docs/contracts/usage.md "Cost": USD per 1M tokens (pricing.cost-calculation-cache-inclusive).

export const PRICE_FIELDS = ["input", "output", "cached", "reasoning", "cache_creation"] as const;
export type PriceField = (typeof PRICE_FIELDS)[number];
export interface Price {
  readonly input: number;
  readonly output: number;
  readonly cached?: number;
  readonly reasoning?: number;
  readonly cache_creation?: number;
}
export type PriceOverride = Readonly<Partial<Record<PriceField, number>>>;
export type PriceSource = "override" | "provider" | "model" | "pattern" | "none";

// matchPattern: "*" matches anything, the rest literally, case-insensitive (registry ids mix casing).
const PATTERNS = PATTERN_PRICING.map(({ pattern, price }) => ({
  regex: new RegExp(`^${pattern.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`, "i"),
  price,
}));

function builtin(provider: string, model: string): { price: Price; source: PriceSource } | undefined {
  const own = PROVIDER_PRICING[provider]?.[model];
  if (own) return { price: own, source: "provider" };
  // "deepseek/deepseek-chat" is priced as "deepseek-chat".
  const base = model.includes("/") ? model.slice(model.lastIndexOf("/") + 1) : model;
  const canonical = MODEL_PRICING[base] ?? MODEL_PRICING[model];
  if (canonical) return { price: canonical, source: "model" };
  const pattern = PATTERNS.find(({ regex }) => regex.test(base) || regex.test(model));
  return pattern ? { price: pattern.price, source: "pattern" } : undefined;
}

// The user's override wins field by field; an override of an unpriced model prices what it sets and 0 for the rest of
// input/output (9router replaced the whole entry, so a partial override billed NaN).
export function resolvePrice(provider: string, model: string, override?: PriceOverride): { price: Price | null; source: PriceSource } {
  const found = builtin(provider, model);
  if (!override || Object.keys(override).length === 0) return found ?? { price: null, source: "none" };
  const base: Price = found?.price ?? { input: 0, output: 0 };
  return { price: { ...base, ...override }, source: "override" };
}

// AIGate's usage convention: inputTokens excludes cache reads and writes, outputTokens includes reasoning, so reasoning
// is billed once at its own rate (calculateCostFromTokens adds it on top of a reasoning-free completion count).
export function costOf(usage: TokenUsage, price: Price): number {
  const reasoning = Math.min(usage.reasoningTokens ?? 0, usage.outputTokens);
  return (usage.inputTokens * price.input
    + (usage.cacheReadTokens ?? 0) * (price.cached ?? price.input)
    + (usage.cacheWriteTokens ?? 0) * (price.cache_creation ?? price.input)
    + (usage.outputTokens - reasoning) * price.output
    + reasoning * (price.reasoning ?? price.output)) / 1_000_000;
}
