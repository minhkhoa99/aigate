// Contract: docs/contracts/custom-providers.md — the Unreachable pill follows the /v1 prefix rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { unreachable } from "./node-rules.ts";

const node = (id, type, prefix) => ({ id, type, name: id, prefix, baseUrl: "https://x.example/v1", createdAt: "", updatedAt: "" });

test("a custom provider is unreachable when /v1 picks something else for its prefix", () => {
  const reserved = new Set(["openai", "ds"]);
  assert.match(unreachable(node("a", "openai-compatible", "x/y"), [], reserved), /contains "\/"/);
  assert.match(unreachable(node("a", "anthropic-compatible", "ds"), [], reserved), /built-in provider id or alias/);
  const olderAnthropic = node("old-anthropic", "anthropic-compatible", "gate");
  const newerOpenai = node("new-openai", "openai-compatible", "gate");
  const newestOpenai = node("newest-openai", "openai-compatible", "gate");
  const all = [olderAnthropic, newerOpenai, newestOpenai];
  assert.equal(unreachable(newerOpenai, all, reserved), null, "the oldest OpenAI-compatible provider wins");
  assert.match(unreachable(olderAnthropic, all, reserved), /^new-openai has the same prefix and wins: OpenAI compatible providers are matched first/);
  assert.match(unreachable(newestOpenai, all, reserved), /^new-openai has the same prefix and was added first/);
  const anthropics = [olderAnthropic, node("later-anthropic", "anthropic-compatible", "gate")];
  assert.equal(unreachable(olderAnthropic, anthropics, reserved), null);
  assert.match(unreachable(anthropics[1], anthropics, reserved), /^old-anthropic has the same prefix and was added first/);
});
