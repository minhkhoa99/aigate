// Contract: docs/contracts/usage.md "UI" — the Usage page's number, series and color rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { assignSlots, bucketLabel, chartSeries, errorRate, formatCost, formatTokens } from "./usage-format.ts";

test("numbers read at a glance and small costs keep their cents", () => {
  assert.deepEqual([formatTokens(999), formatTokens(1234), formatTokens(2_500_000)], ["999", "1.2K", "2.5M"]);
  assert.deepEqual([formatCost(0), formatCost(0.0042), formatCost(1234.5)], ["$0.00", "$0.0042", "$1,234.50"]);
  assert.deepEqual([errorRate(0, 0), errorRate(0, 5), errorRate(1, 3)], ["—", "0%", "33.3%"]);
});

test("the chart names five providers and folds the rest into Other", () => {
  assert.deepEqual(chartSeries({ a: 5, b: 9, c: 1, d: 0 }), { named: ["b", "a", "c"], other: false });
  assert.deepEqual(chartSeries({ a: 6, b: 5, c: 4, d: 3, e: 2, f: 1 }), { named: ["a", "b", "c", "d", "e"], other: true });
});

test("a provider keeps its color while it stays on screen", () => {
  const first = assignSlots(new Map(), ["openai", "anthropic", "gemini"]);
  assert.deepEqual([...first], [["openai", 0], ["anthropic", 1], ["gemini", 2]]);
  const next = assignSlots(first, ["gemini", "deepseek", "openai"]);
  assert.deepEqual([next.get("gemini"), next.get("openai"), next.get("deepseek")], [2, 0, 1], "survivors keep theirs, the newcomer takes a freed slot");
});

test("bucket labels use the usage zone", () => {
  const at = Date.UTC(2026, 8, 30, 17, 0);
  assert.equal(bucketLabel(at, "hour", "Asia/Ho_Chi_Minh"), "00:00");
  assert.equal(bucketLabel(at, "day", "Asia/Ho_Chi_Minh"), "Oct 1");
});

test("Vietnamese display keeps the server zone and USD precision", () => {
  const at = Date.UTC(2026, 8, 30, 17, 0);
  assert.equal(bucketLabel(at, "hour", "Asia/Ho_Chi_Minh", "vi-VN"), "00:00");
  assert.match(bucketLabel(at, "day", "Asia/Ho_Chi_Minh", "vi-VN"), /1.*10/);
  assert.match(formatCost(0.0042, "vi-VN"), /0,0042.*US\$/);
  assert.match(errorRate(1, 3, "vi-VN"), /33,3/);
});
