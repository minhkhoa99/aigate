import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseAccount } from "../dist/modules/connections/domain/account-selection.js";
import { resolveModelTarget } from "../dist/modules/routing/domain/model-resolution.js";
import { builtinRegistry } from "@aigate/engine";
import { withTempDb } from "./helpers.mjs";
import { fakeUpstream, ready } from "./lane-helpers.mjs";
import { ConnectionsRepository } from "../dist/modules/connections/infrastructure/connections.repo.js";
import { ProviderNodesRepository } from "../dist/modules/connections/infrastructure/provider-nodes.repo.js";
import { DATABASE } from "../dist/database.provider.js";
import { accountLocks, providerConnections } from "@aigate/database";

test("eligible account choice preserves sticky three-use ordering without writes", () => {
  const rows = [
    { id: "a", priority: 1, lastUsedAt: new Date(2000), consecutiveUseCount: 2 },
    { id: "b", priority: 2, lastUsedAt: new Date(1000), consecutiveUseCount: 0 },
  ];
  const before = structuredClone(rows);
  assert.equal(chooseAccount(rows, "fill-first").account.id, "a");
  assert.deepEqual(chooseAccount(rows, "round-robin"), { account: rows[0], nextUseCount: 3 });
  assert.deepEqual(rows, before);
  rows[0].consecutiveUseCount = 3;
  assert.equal(chooseAccount(rows, "round-robin").account.id, "b");
  assert.equal(chooseAccount([], "fill-first"), undefined);
  assert.equal(chooseAccount(rows.map(r => ({ ...r, lastUsedAt: null })), "round-robin").account.id, "a");
});

test("model resolution preserves aliases, bare IDs, custom IDs and thinking keys", () => {
  assert.deepEqual(resolveModelTarget("openai/gpt-4.1(high)", "openai", new Set()),
    { ok: true, providerId: "openai", modelId: "gpt-4.1(high)", catalogModelId: "gpt-4.1" });
  assert.equal(resolveModelTarget("gpt-4.1", undefined, new Set(["openai"])).providerId, "openai");
  assert.equal(resolveModelTarget("gpt-4.1", undefined, new Set()).code, "no_active_connection");
  assert.equal(resolveModelTarget("not-real/slash-model", undefined, new Set()).code, "model_not_found");
  assert.equal(resolveModelTarget("custom/private-model", "custom-id", new Set()).providerId, "custom-id");
  assert.equal(resolveModelTarget("openai/", "openai", new Set()).code, "model_not_found");
  const provider = builtinRegistry.providers.find(p => p.aliases.length && p.models.length);
  assert.ok(provider);
  const ref = `${provider.aliases[0]}/${provider.models[0].id}`;
  assert.equal(resolveModelTarget(ref, builtinRegistry.provider(provider.aliases[0]).id, new Set()).providerId, provider.id);
});

test("routing projections retain expired locks, detect source overflow and omit secrets", () => withTempDb(async file => {
  const upstream = fakeUpstream();
  const { app, connection } = await ready(file, upstream);
  try {
    const db = app.get(DATABASE).db;
    const now = new Date();
    await db.insert(accountLocks).values([
      { connectionId: connection.id, model: "expired", until: new Date(now.getTime() - 1) },
      { connectionId: connection.id, model: "gpt-4.1", until: now },
    ]);
    const repo = app.get(ConnectionsRepository);
    const before = await db.select().from(accountLocks).limit(203);
    assert.equal((await repo.routingLocks("openai", "gpt-4.1", now)).rows.length, 1, "equal expiry is still locked");
    assert.deepEqual(await db.select().from(accountLocks).limit(203), before);
    const view = (await repo.routingAccounts("openai")).rows[0];
    assert.deepEqual(Object.keys(view).sort(), ["consecutiveUseCount", "id", "isActive", "lastUsedAt", "priority"].sort());
    const template = (await db.select().from(providerConnections).limit(1))[0];
    for (let i = 0; i < 100; i++) await db.insert(providerConnections).values({ ...template, id: `overflow-${i}`, provider: i === 99 ? "deepseek" : "openai", priority: i + 2 });
    assert.equal((await repo.routingActivity()).truncated, true);
    await db.insert(accountLocks).values(Array.from({ length: 201 }, () => ({ connectionId: connection.id, model: "gpt-4.1", until: new Date(now.getTime() + 1000) })));
    assert.equal((await repo.routingLocks("openai", "gpt-4.1", now)).truncated, true);
    assert.equal(upstream.calls.length, 0);
  } finally { await app.close(); }
}));

test("custom node metadata does not open its sealed headers", () => withTempDb(async file => {
  const { app, dash } = await ready(file, fakeUpstream());
  try {
    const created = await dash({ method: "POST", url: "/api/provider-nodes", body: {
      type: "openai-compatible", name: "Private", prefix: "private-test", baseUrl: "https://example.invalid/v1",
      customHeaders: [{ name: "x-private", value: "synthetic-header-secret" }],
    } });
    assert.equal(created.statusCode, 201, created.body);
    const repo = app.get(ProviderNodesRepository);
    const metadata = await repo.routingNodeByPrefix("private-test");
    assert.deepEqual(Object.keys(metadata).sort(), ["id", "prefix", "type"]);
    assert.equal(JSON.stringify(metadata).includes("synthetic-header-secret"), false);
  } finally { await app.close(); }
}));
