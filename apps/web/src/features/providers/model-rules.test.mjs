// docs/contracts/custom-models.md, "Dashboard": what the import dialog offers and what a model test reads as.
import { test } from "node:test";
import assert from "node:assert/strict";
import { describeProbe, importChoices, importMessage } from "./model-rules.ts";

test("only ids neither in the catalog nor already added can be picked", () => {
  const choices = importChoices([{ id: "gpt-4.1", inCatalog: true }, { id: "ft-a", inCatalog: false }, { id: "ft-b", inCatalog: false }], new Set(["gpt-4.1", "ft-a"]));
  assert.deepEqual(choices, [{ id: "gpt-4.1", state: "catalog" }, { id: "ft-a", state: "added" }, { id: "ft-b", state: "new" }]);
  assert.equal(importMessage(choices), null, "something to pick opens the dialog");
  assert.equal(importMessage([]), "No models returned from /models.");
  assert.equal(importMessage(choices.slice(0, 2)), "No new models were added.");
});

test("a model test reads as OK with its latency, or as the lane's error", () => {
  assert.deepEqual(describeProbe({ ok: true, latencyMs: 412, status: 200, error: null }), { tone: "healthy", label: "OK · 412 ms", detail: null });
  assert.equal(describeProbe({ ok: true, latencyMs: 9, status: 200, error: null, note: "reasoning-only response (length-limited)" }).detail, "reasoning-only response (length-limited)");
  assert.deepEqual(describeProbe({ ok: false, latencyMs: 30, status: 404, error: "HTTP 404: nope" }), { tone: "danger", label: "Failed", detail: "HTTP 404: nope" });
});
