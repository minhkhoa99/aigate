// Contract: docs/contracts/provider-thinking.md — the provider's thinking level on a request that carries none.
import { test } from "node:test";
import assert from "node:assert/strict";
import { builtinRegistry, isThinkingLevel, splitThinkingSuffix, thinkingLevels, withThinking } from "../dist/index.js";

const provider = (id) => builtinRegistry.provider(id);
const ask = (model, extra = {}) => ({ model, messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }], ...extra });

test("the picker offers the family's levels, and nothing for a provider whose models do not reason", () => {
  assert.deepEqual(thinkingLevels(provider("openai")), ["none", "minimal", "low", "medium", "high", "xhigh"]);
  assert.deepEqual(thinkingLevels(provider("anthropic")), ["none", "low", "medium", "high", "xhigh", "max"]);
  assert.deepEqual(thinkingLevels(provider("gemini")), ["none", "minimal", "low", "medium", "high"]);
  assert.equal(thinkingLevels({ ...provider("openai"), models: provider("openai").models.filter((m) => !m.capabilities.reasoning) }), null);
  assert.deepEqual([isThinkingLevel("xhigh"), isThinkingLevel("auto"), isThinkingLevel("ultra"), isThinkingLevel(3)], [true, false, false, false]);
});

test("OpenAI-style providers get the level as reasoning_effort: the three known efforts typed, the rest as the OpenAI field", () => {
  const openai = provider("openai");
  assert.deepEqual(withThinking(ask("gpt-5.5"), openai, "high").reasoning, { effort: "high" });
  const xhigh = withThinking(ask("gpt-5.5", { vendorExtensions: { openai: { user: "u" } } }), openai, "xhigh");
  assert.deepEqual([xhigh.reasoning, xhigh.vendorExtensions], [undefined, { openai: { user: "u", reasoning_effort: "xhigh" } }], "other OpenAI fields kept");
  assert.equal(withThinking(ask("gpt-5.5"), openai, "none").vendorExtensions.openai.reasoning_effort, "none");
  const untouched = ask("gpt-5.5");
  assert.equal(withThinking(untouched, openai, "max"), untouched, "max is not an OpenAI level");
});

test("the Anthropic family gets a thinking budget; none sends nothing", () => {
  const anthropic = provider("anthropic");
  const model = "claude-sonnet-4-20250514";
  assert.deepEqual(["low", "medium", "high", "xhigh", "max"].map((level) => withThinking(ask(model), anthropic, level).reasoning),
    [{ budgetTokens: 1024 }, { budgetTokens: 8192 }, { budgetTokens: 24576 }, { budgetTokens: 32768 }, { budgetTokens: 128000 }]);
  const plain = ask(model);
  assert.equal(withThinking(plain, anthropic, "none"), plain);
  assert.equal(withThinking(plain, anthropic, "minimal"), plain, "not an Anthropic level");
});

test("the client's own thinking wins, a model that does not reason is left alone, and a Claude model behind Copilot takes only low, medium, high", () => {
  const openai = provider("openai");
  const own = ask("gpt-5.5", { reasoning: { effort: "low" } });
  assert.equal(withThinking(own, openai, "high"), own);
  const ownBudget = ask("gpt-5.5", { reasoning: { budgetTokens: 2000 } });
  assert.equal(withThinking(ownBudget, openai, "high"), ownBudget);
  const ownField = ask("gpt-5.5", { vendorExtensions: { openai: { reasoning_effort: "minimal" } } });
  assert.equal(withThinking(ownField, openai, "high"), ownField);
  const plain = ask("gpt-4o");
  assert.equal(withThinking(plain, openai, "high"), plain, "gpt-4o does not reason");
  const unknown = ask("some-new-model");
  assert.equal(withThinking(unknown, openai, "high"), unknown, "an id the catalog does not know is left alone");
  const github = provider("github");
  const claudeModel = github.models.find((m) => /claude/i.test(m.id) && m.capabilities.reasoning)?.id;
  assert.ok(claudeModel, "the catalog has a reasoning Claude model on Copilot");
  assert.deepEqual(withThinking(ask(claudeModel), github, "medium").reasoning, { effort: "medium" });
  const copilotClaude = ask(claudeModel);
  assert.equal(withThinking(copilotClaude, github, "xhigh"), copilotClaude);
});

test("a model(level) suffix resolves the base model and overrides default or client thinking", () => {
  const openai = provider("openai");
  assert.deepEqual(splitThinkingSuffix("gpt-5.5(high)"), { model: "gpt-5.5", level: "high", auto: false });
  assert.deepEqual(splitThinkingSuffix("gpt-5.5(future)"), { model: "gpt-5.5", auto: false }, "9router still strips an unknown suffix");
  const override = withThinking(ask("gpt-5.5(xhigh)", { reasoning: { effort: "low" } }), openai, "medium");
  assert.equal(override.model, "gpt-5.5");
  assert.deepEqual(override.reasoning, undefined);
  assert.equal(override.vendorExtensions.openai.reasoning_effort, "xhigh");
  const disabled = withThinking(ask("gpt-5.5(none)", { reasoning: { effort: "high" } }), openai, "medium");
  assert.equal(disabled.reasoning, undefined);
  assert.equal(disabled.vendorExtensions.openai.reasoning_effort, "none");
  const plain = withThinking(ask("gpt-5.5(auto)", { reasoning: { effort: "high" } }), openai, "medium");
  assert.deepEqual([plain.model, plain.reasoning, plain.vendorExtensions], ["gpt-5.5", undefined, undefined]);
});
