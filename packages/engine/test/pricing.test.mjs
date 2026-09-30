// Contract: docs/contracts/usage.md "Cost" — price resolution and the cost formula.
import { test } from "node:test";
import assert from "node:assert/strict";
import { costOf, resolvePrice } from "../dist/index.js";

test("resolvePrice: provider table, canonical model, vendor prefix, pattern, none, field-wise override", () => {
  assert.equal(resolvePrice("openai", "gpt-4o").source, "model");
  assert.deepEqual(resolvePrice("openai", "gpt-4o").price, { input: 2.5, output: 10, cached: 1.25, reasoning: 15, cache_creation: 2.5 });
  assert.equal(resolvePrice("openrouter", "openai/gpt-4o").source, "model");
  assert.equal(resolvePrice("anthropic", "claude-sonnet-9-new").source, "pattern");
  assert.equal(resolvePrice("anthropic", "CLAUDE-SONNET-9-NEW").source, "pattern", "patterns ignore case");
  assert.deepEqual(resolvePrice("x", "unknown-model"), { price: null, source: "none" });
  assert.equal(resolvePrice("tokenrouter", "MiniMax-M3").source, "provider");
  const merged = resolvePrice("openai", "gpt-4o", { output: 12 });
  assert.deepEqual([merged.source, merged.price.input, merged.price.output], ["override", 2.5, 12]);
  assert.deepEqual(resolvePrice("x", "unknown-model", { input: 1 }).price, { input: 1, output: 0 });
});

test("costOf bills cache and reasoning at their own rates, once", () => {
  const price = { input: 2, output: 10, cached: 0.5, reasoning: 20, cache_creation: 3 };
  // 1M each: input 2 + cacheRead 0.5 + cacheWrite 3 + (2M output - 1M reasoning) 10 + reasoning 20.
  assert.equal(costOf({ inputTokens: 1e6, outputTokens: 2e6, cacheReadTokens: 1e6, cacheWriteTokens: 1e6, reasoningTokens: 1e6 }, price), 35.5);
  assert.equal(costOf({ inputTokens: 1e6, outputTokens: 1e6 }, { input: 1, output: 4 }), 5);
  assert.equal(costOf({ inputTokens: 0, outputTokens: 1e6, cacheReadTokens: 1e6, reasoningTokens: 5e6 }, { input: 1, output: 4 }), 5, "missing rates fall back; reasoning never exceeds output");
});
