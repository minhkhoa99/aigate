// Contract: docs/contracts/capacity-adapter.md — /api/capacity-pools and the capacity adapter on /v1, with a fake upstream
// answering per model. openai/gpt-4o, gpt-4.1, gpt-4o-mini read images in the catalog; o1-mini does not, so the lane
// refuses images for it. openai/m1 is not in the catalog: an undeclared model is open and takes the image itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { completion, errorOf, json, ready } from "./lane-helpers.mjs";

function byModel(plan) {
  const calls = [];
  return {
    calls,
    async send(request, ctx) {
      const sent = JSON.parse(request.body);
      calls.push({ model: sent.model, sent });
      const next = plan[sent.model]?.shift();
      if (!next) throw new Error(`unexpected upstream call for ${sent.model}`);
      return next(request, ctx);
    },
  };
}
const said = (content) => json(200, { ...completion, choices: [{ message: { content }, finish_reason: "stop" }] });
const limited = () => json(429, { error: { message: "rate limit" } });
const contentOf = (res) => res.json().choices[0].message.content;
const image = { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgo=" } };
const look = (model, before = []) => ({ model, messages: [...before, { role: "user", content: [{ type: "text", text: "what is this?" }, image] }] });
const text = (model) => ({ model, messages: [{ role: "user", content: "hi" }] });

async function pool(dash, capability, body) {
  const res = await dash({ method: "PUT", url: `/api/capacity-pools/${capability}`, body });
  assert.equal(res.statusCode, 200, res.body);
  return res.json().pool;
}

test("capacity pools API: four pools start off; validation; a pool cannot be turned on empty", () =>
  withTempDb(async (file) => {
    const { app, call, dash } = await ready(file, byModel({}));
    assert.equal((await call({ url: "/api/capacity-pools" })).statusCode, 401, "behind the dashboard session");
    const pools = (await dash({ url: "/api/capacity-pools" })).json().pools;
    assert.deepEqual(pools, ["vision", "pdf", "audioInput", "videoInput"].map((capability) => ({ capability, enabled: false, roundRobin: false, models: [], updatedAt: null })));
    const put = (capability, body) => dash({ method: "PUT", url: `/api/capacity-pools/${capability}`, body });
    assert.deepEqual([(await put("search", { enabled: false, roundRobin: false, models: [] })).statusCode, (await put("search", {})).json().code], [404, "NOT_FOUND"]);
    const bad = [
      { enabled: true, roundRobin: false, models: [] },
      { enabled: false, roundRobin: false, models: [], extra: 1 },
      { enabled: "yes", roundRobin: false, models: [] },
      { enabled: false, models: [] },
      { enabled: false, roundRobin: false, models: ["openai/gpt-4o", "openai/gpt-4o"] },
      { enabled: false, roundRobin: false, models: Array.from({ length: 17 }, (_, i) => `openai/m${i}`) },
      [],
    ];
    for (const body of bad) {
      const res = await put("vision", body);
      assert.deepEqual([res.statusCode, res.json().code], [400, "INVALID_REQUEST"], JSON.stringify(body));
    }
    assert.match((await put("vision", bad[0])).json().message, /Add at least one model before turning the Vision pool on/);
    const saved = await pool(dash, "vision", { enabled: true, roundRobin: true, models: [" openai/gpt-4o ", "openai/gpt-4.1"] });
    assert.deepEqual([saved.enabled, saved.roundRobin, saved.models, typeof saved.updatedAt], [true, true, ["openai/gpt-4o", "openai/gpt-4.1"], "string"]);
    const again = await pool(dash, "vision", { enabled: false, roundRobin: false, models: ["openai/gpt-4.1"] });
    assert.deepEqual([again.enabled, again.models], [false, ["openai/gpt-4.1"]], "a second save replaces the pool");
    assert.deepEqual((await dash({ url: "/api/capacity-pools" })).json().pools[0].models, ["openai/gpt-4.1"]);
    await app.close();
  }));

test("a model that cannot read the image: capable pool models first, the client's model last; off or text-only changes nothing", () =>
  withTempDb(async (file) => {
    const upstream = byModel({ "o1-mini": [said("text from o1-mini")], m1: [said("m1 saw it")], "gpt-4o": [limited()], "gpt-4.1": [said("seen by gpt-4.1")], "gpt-4o-mini": [said("seen by mini")] });
    const { app, dash, chat } = await ready(file, upstream);
    const refused = await chat(look("openai/o1-mini"));
    assert.deepEqual(errorOf(refused), { status: 404, code: "model_not_found", type: "not_found_error" }, "pools start off");
    assert.equal(contentOf(await chat(look("openai/m1"))), "m1 saw it", "an undeclared model is not refused (catalog.capability-undeclared-open)");
    assert.deepEqual(upstream.calls[0].sent.messages[0].content.find((part) => part.type === "image_url")?.image_url.url, image.image_url.url, "the image goes upstream");
    await pool(dash, "vision", { enabled: true, roundRobin: false, models: ["openai/o1-mini", "openai/gpt-4o", "openai/gpt-4.1"] });
    assert.equal(contentOf(await chat(text("openai/o1-mini"))), "text from o1-mini", "no media, no widening");
    assert.equal(contentOf(await chat(look("openai/gpt-4o-mini"))), "seen by mini", "a model that reads images is not widened");
    const widened = await chat(look("openai/o1-mini"));
    assert.deepEqual([widened.statusCode, contentOf(widened)], [200, "seen by gpt-4.1"]);
    assert.deepEqual(upstream.calls.map((c) => c.model), ["m1", "o1-mini", "gpt-4o-mini", "gpt-4o", "gpt-4.1"], "o1-mini is skipped in the pool: it cannot read images");
    await app.close();
  }));

test("a round-robin pool rotates per pool; saving the pool starts over", () =>
  withTempDb(async (file) => {
    const answers = () => Array.from({ length: 3 }, () => said("ok"));
    const upstream = byModel({ "gpt-4o": answers(), "gpt-4.1": answers() });
    const { app, dash, chat } = await ready(file, upstream);
    const models = ["openai/gpt-4o", "openai/gpt-4.1"];
    await pool(dash, "vision", { enabled: true, roundRobin: true, models });
    for (const model of ["openai/o1-mini", "openai/o1-mini", "openai/o1-mini"]) assert.equal((await chat(look(model))).statusCode, 200);
    assert.deepEqual(upstream.calls.map((c) => c.model), ["gpt-4o", "gpt-4.1", "gpt-4o"], "one rotation for the pool, whatever model the client named");
    await pool(dash, "vision", { enabled: true, roundRobin: true, models });
    assert.equal((await chat(look("openai/o1-mini"))).statusCode, 200);
    assert.equal(upstream.calls.at(-1).model, "gpt-4o");
    await app.close();
  }));

test("combos: a capable member floats to the front; with none, the pool goes first; text keeps the saved order", () =>
  withTempDb(async (file) => {
    const upstream = byModel({ "o1-mini": [said("text o1")], "gpt-4o-mini": [said("mini"), said("mini again")], "gpt-4.1": [said("pool")] });
    const { app, dash, chat } = await ready(file, upstream);
    const combo = (body) => dash({ method: "POST", url: "/api/combos", body });
    assert.equal((await combo({ name: "mix", models: ["openai/o1-mini", "openai/gpt-4o-mini"] })).statusCode, 201);
    assert.equal((await combo({ name: "plain", models: ["openai/o1-mini"] })).statusCode, 201);
    // A nested combo's name has no catalog entry, so it sorts behind a member that reads images.
    assert.equal((await combo({ name: "inner", models: ["openai/gpt-4.1"] })).statusCode, 201);
    assert.equal((await combo({ name: "outer", models: ["inner", "openai/gpt-4o-mini"] })).statusCode, 201);
    await pool(dash, "vision", { enabled: true, roundRobin: false, models: ["openai/gpt-4.1"] });
    assert.equal(contentOf(await chat(text("mix"))), "text o1");
    assert.equal(contentOf(await chat(look("mix"))), "mini", "combo.reorder-by-capabilities-tiers");
    assert.equal(contentOf(await chat(look("plain"))), "pool", "no member reads images: the pool is prepended");
    assert.equal(contentOf(await chat(look("outer"))), "mini again", "the capable member goes before the nested combo");
    assert.deepEqual(upstream.calls.map((c) => c.model), ["o1-mini", "gpt-4o-mini", "gpt-4.1", "gpt-4o-mini"]);
    await app.close();
  }));

test("a pool model gets the history trimmed to its window; the client's own model gets it whole; tool calls keep their results", () =>
  withTempDb(async (file) => {
    const upstream = byModel({ "gpt-4o-mini": [said("a"), said("b"), said("c")] });
    const { app, dash, chat } = await ready(file, upstream);
    await pool(dash, "vision", { enabled: true, roundRobin: false, models: ["openai/gpt-4o-mini"] });
    const turns = (n, size) => Array.from({ length: n }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `turn ${i} ${"x".repeat(size)}` }));
    const sentTexts = () => upstream.calls.at(-1).sent.messages.map((m) => (typeof m.content === "string" ? m.content : m.content?.find?.((p) => p.type === "text")?.text ?? "").slice(0, 7));

    // Eight short older turns: only the first six stay (capacity.strip-history-budget-formula).
    assert.equal((await chat(look("openai/o1-mini", [{ role: "system", content: "rules" }, ...turns(8, 10)]))).statusCode, 200);
    assert.deepEqual(sentTexts(), ["rules", "turn 0 ", "turn 1 ", "turn 2 ", "turn 3 ", "turn 4 ", "turn 5 ", "what is"]);

    // gpt-4o-mini has a 128 000-token window: 409 600 characters. Six turns of 80 000 do not fit, five do.
    assert.equal((await chat(look("openai/o1-mini", turns(8, 80_000)))).statusCode, 200);
    assert.deepEqual(sentTexts(), ["turn 0 ", "turn 1 ", "turn 2 ", "turn 3 ", "turn 4 ", "what is"]);

    // The sixth kept turn calls a tool whose result was dropped, so that call goes too (capacity.strip-orphans-tool-calls).
    const call = { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "get_weather", arguments: "{}" } }] };
    const withTools = [...turns(5, 10), call, { role: "tool", tool_call_id: "c1", content: "sunny" }, { role: "assistant", content: "It is sunny." }];
    const tools = [{ type: "function", function: { name: "get_weather", parameters: { type: "object", properties: {} } } }];
    assert.equal((await chat({ ...look("openai/o1-mini", withTools), tools })).statusCode, 200);
    const sent = upstream.calls.at(-1).sent.messages;
    assert.deepEqual(sent.map((m) => m.role), ["user", "assistant", "user", "assistant", "user", "user"]);
    assert.ok(sent.every((m) => !m.tool_calls), "no tool call without its result");
    await app.close();
  }));
