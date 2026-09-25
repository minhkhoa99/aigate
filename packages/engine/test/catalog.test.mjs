// Contract: docs/contracts/registry-extract.md — the generated catalog is valid AIGate data on its own.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOG, CATALOG_PROTOCOLS, validateCatalog } from "../dist/index.js";

test("the generated catalog passes validateCatalog", () => {
  assert.deepEqual(validateCatalog(CATALOG), []);
  assert.ok(CATALOG.length >= 120, `${CATALOG.length} providers`);
});

test("no invented limits: an undeclared model carries none, a declared one carries at least one", () => {
  for (const provider of CATALOG) {
    for (const model of provider.models) {
      if (model.capabilitySource === "default") assert.deepEqual([model.contextWindow, model.maxOutputTokens], [null, null], `${provider.id}/${model.id}`);
      else assert.ok(model.contextWindow !== null || model.maxOutputTokens !== null, `${provider.id}/${model.id}`);
    }
  }
});

test("every provider has a protocol family and an auth kind; OpenAI is openai-compatible with a bearer key", () => {
  for (const provider of CATALOG) {
    assert.ok(CATALOG_PROTOCOLS.includes(provider.protocol), provider.id);
    assert.ok(provider.auth.kinds.length > 0, provider.id);
  }
  const openai = CATALOG.find((p) => p.id === "openai");
  assert.equal(openai.protocol, "openai-compatible");
  assert.deepEqual(openai.auth, { kinds: ["api-key"], header: "authorization", scheme: "bearer" });
  assert.ok(openai.models.some((m) => m.id === "gpt-4.1"));
});

test("validateCatalog reports each broken rule", () => {
  const good = CATALOG.find((p) => p.id === "openai");
  const broken = [
    { ...good, id: "Bad Id" },
    { ...good, chatUrl: "http://api.example.com/v1/chat/completions" },
    { ...good, models: [good.models[0], good.models[0]] },
    { ...good, models: [{ ...good.models[0], capabilitySource: "default", contextWindow: 200000 }] },
  ];
  for (const provider of broken) assert.ok(validateCatalog([provider]).length > 0, JSON.stringify(provider).slice(0, 80));
  assert.equal(validateCatalog([good, good]).length, 1, "duplicate provider id");
});
