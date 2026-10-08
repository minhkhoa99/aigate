import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { fakeUpstream, ready, hello } from "./lane-helpers.mjs";
import { RoutingSimulator } from "../dist/modules/routing/infrastructure/routing-simulator.js";
import { parseSimulationInput } from "../dist/modules/routing/domain/routing-simulator.js";
import { CombosRepository } from "../dist/modules/routing/infrastructure/combos.repo.js";
import { CapacityPoolsRepository } from "../dist/modules/routing/infrastructure/capacity-pools.repo.js";
import { DATABASE } from "../dist/database.provider.js";
import { accountLocks, providerConnections } from "@aigate/database";

const inspect = (app, request, at = new Date()) => app.get(RoutingSimulator).explain(parseSimulationInput({ request }), new AbortController().signal, at);
test("direct inspection leaves metadata, locks, transport and successive choices untouched", () => withTempDb(async file => {
  const upstream = fakeUpstream();
  const { app, dash, connection } = await ready(file, upstream);
  try {
    await dash({ method: "PATCH", url: "/api/settings", body: { fallbackStrategy: "round-robin" } });
    const db = app.get(DATABASE).db, at = new Date();
    await db.insert(accountLocks).values({ connectionId: connection.id, model: "expired", until: new Date(at.getTime() - 1) });
    const before = await db.select().from(providerConnections).limit(101);
    const locks = await db.select().from(accountLocks).limit(201);
    const first = await inspect(app, { ...hello, model: "openai/gpt-4.1" }, at);
    const second = await inspect(app, { ...hello, model: "openai/gpt-4.1" }, at);
    assert.equal(first.outcome, "candidate");
    assert.equal(first.nodes.find(n => n.reason === "account-selected").connectionId, connection.id);
    assert.deepEqual(first, second);
    assert.deepEqual(await db.select().from(providerConnections).limit(101), before);
    assert.deepEqual(await db.select().from(accountLocks).limit(201), locks);
    assert.equal(upstream.calls.length, 0);
    assert.equal(JSON.stringify(first).includes("sk-upstream-secret"), false);
  } finally { await app.close(); }
}));

test("deterministic client refusal stops a combo before its later eligible member", () => withTempDb(async file => {
  const { app, dash } = await ready(file, fakeUpstream());
  try {
    await dash({ method: "POST", url: "/api/combos", body: { name: "limit-test", models: ["openai/gpt-4.1", "openai/custom-model"] } });
    const result = await inspect(app, { model: "limit-test", messages: hello.messages, max_tokens: 1_000_000 });
    assert.equal(result.outcome, "blocked");
    assert.ok(result.nodes.some(n => n.errorCode === "invalid_request"));
    assert.equal(result.nodes.some(n => n.model === "openai/custom-model"), false);
  } finally { await app.close(); }
}));

test("combo and capacity peeks retain rotation and capability/history rules", () => withTempDb(async file => {
  const { app, dash } = await ready(file, fakeUpstream());
  try {
    const combo = (await dash({ method: "POST", url: "/api/combos", body: { name: "rotating", strategy: "round-robin", models: ["openai/gpt-4.1", "openai/gpt-4o"] } })).json().combo;
    const repo = app.get(CombosRepository), pools = app.get(CapacityPoolsRepository);
    repo.order(combo, 1);
    const order = [...repo.peekOrder(combo, 1)];
    const result = await inspect(app, { ...hello, model: "rotating" });
    assert.equal(result.nodes.find(n => n.kind === "model").model, "openai/gpt-4o");
    assert.deepEqual(repo.peekOrder(combo, 1), order);
    await dash({ method: "PUT", url: "/api/capacity-pools/vision", body: { enabled: true, roundRobin: true, models: ["openai/gpt-4o", "openai/gpt-4.1"] } });
    pools.order("vision", ["openai/gpt-4o", "openai/gpt-4.1"]);
    const looked = await inspect(app, { model: "openai/plain", messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "https://example.invalid/private-media" } }] }] });
    assert.equal(looked.nodes.find(n => n.kind === "model").model, "openai/gpt-4.1");
    assert.deepEqual(pools.peekOrder("vision", ["openai/gpt-4o", "openai/gpt-4.1"]), ["openai/gpt-4.1", "openai/gpt-4o"]);
    assert.equal(JSON.stringify(looked).includes("private-media"), false);
  } finally { await app.close(); }
}));

test("fusion is conditional, does not widen panel, and preserves its tuning", () => withTempDb(async file => {
  const { app, dash } = await ready(file, fakeUpstream());
  try {
    await dash({ method: "POST", url: "/api/combos", body: { name: "panel", strategy: "fusion", models: ["openai/gpt-4.1", "openai/gpt-4o"], minPanel: 2, stragglerGraceMs: 1000, panelTimeoutMs: 2000 } });
    const result = await inspect(app, { ...hello, model: "panel" });
    assert.equal(result.outcome, "conditional");
    assert.deepEqual(result.nodes.find(n => n.reason === "fusion-panel").fusion, { minPanel: 2, stragglerGraceMs: 1000, panelTimeoutMs: 2000, concurrency: 4 });
    assert.ok(result.nodes.some(n => n.reason === "fusion-judge"));
    assert.ok(result.warnings.includes("conditional-fusion"));
  } finally { await app.close(); }
}));

test("tree/source bounds become inconclusive and abort prevents inspection", () => withTempDb(async file => {
  const { app, dash } = await ready(file, fakeUpstream());
  try {
    for (let i = 0; i < 16; i++) {
      await dash({ method: "POST", url: "/api/combos", body: { name: `leaf-${i}`, models: Array.from({ length: 16 }, (_, m) => `openai/m${m}`) } });
      await dash({ method: "POST", url: "/api/combos", body: { name: `mid-${i}`, models: Array.from({ length: 16 }, (_, m) => `leaf-${m}`) } });
    }
    await dash({ method: "POST", url: "/api/combos", body: { name: "wide", models: Array.from({ length: 16 }, (_, m) => `mid-${m}`) } });
    const result = await inspect(app, { ...hello, model: "wide" });
    assert.equal(result.outcome, "inconclusive");
    assert.equal(result.truncated, true);
    assert.ok(result.nodes.length <= 512);
    const aborted = new AbortController(); aborted.abort(new Error("client gone"));
    await assert.rejects(app.get(RoutingSimulator).explain(parseSimulationInput({ request: hello }), aborted.signal), /client gone/);
  } finally { await app.close(); }
}));

test("input parser rejects envelope fields and excessive container depth", () => {
  for (const body of [{ request: hello, credential: "private" }, { request: hello, tokenSaverOptOut: "yes" }, null, []])
    assert.throws(() => parseSimulationInput(body));
  let nested = {};
  for (let i = 0; i < 33; i++) nested = { nested };
  assert.throws(() => parseSimulationInput({ request: { ...hello, extra: nested } }), /nesting/);
  assert.equal(parseSimulationInput({ request: hello }).tokenSaverOptOut, false);
});
