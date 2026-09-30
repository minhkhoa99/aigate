// Contract: docs/contracts/combos.md — /api/combos and combo dispatch on /v1, with a fake upstream answering per model.
import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { withTempDb } from "./helpers.mjs";
import { chunk, completion, errorOf, frames, hello, json, ready, sse } from "./lane-helpers.mjs";

// Planned answers per upstream model (the OpenAI connection serves any "openai/<model>"); records the peak in flight.
function byModel(plan) {
  const calls = [];
  let inFlight = 0;
  const upstream = {
    calls,
    peak: 0,
    async send(request, ctx) {
      const sent = JSON.parse(request.body);
      calls.push({ model: sent.model, sent, ctx });
      const next = plan[sent.model]?.shift();
      if (!next) throw new Error(`unexpected upstream call for ${sent.model}`);
      inFlight += 1;
      upstream.peak = Math.max(upstream.peak, inFlight);
      try {
        return await next(request, ctx);
      } finally {
        inFlight -= 1;
      }
    },
  };
  return upstream;
}
const said = (content) => json(200, { ...completion, choices: [{ message: { content }, finish_reason: "stop" }] });
const limited = () => json(429, { error: { message: "rate limit" } });
const later = (ms, answer) => async (request, ctx) => {
  await sleep(ms, undefined, { signal: ctx.signal });
  return answer(request, ctx);
};
// Never answers; rejects when the lane cancels the call.
const hang = () => (_request, ctx) => new Promise((_resolve, reject) => {
  if (ctx.signal.aborted) reject(ctx.signal.reason);
  ctx.signal.addEventListener("abort", () => reject(ctx.signal.reason), { once: true });
});
const streamed = (text) => sse([chunk({ role: "assistant" }), chunk({ content: text }), chunk({}, { finish_reason: "stop" }), "[DONE]"]);
const textOf = (res) => frames(res.body).filter((f) => f !== "[DONE]").map((f) => f.choices?.[0]?.delta?.content ?? "").join("");
const contentOf = (res) => res.json().choices[0].message.content;
const tools = [{ type: "function", function: { name: "get_weather", parameters: { type: "object", properties: {} } } }];

async function combo(dash, body) {
  const res = await dash({ method: "POST", url: "/api/combos", body });
  assert.equal(res.statusCode, 201, res.body);
  return res.json().combo;
}

test("combos CRUD: validation, duplicate names, self reference, missing ids; /v1/models lists combos first", () =>
  withTempDb(async (file) => {
    const { app, call, dash, key } = await ready(file, byModel({}));
    assert.equal((await call({ url: "/api/combos" })).statusCode, 401, "behind the dashboard session");
    const post = (body) => dash({ method: "POST", url: "/api/combos", body });
    for (const body of [{ name: "bad name!", models: ["openai/m1"] }, { name: "empty", models: [] }, { name: "twice", models: ["openai/m1", "openai/m1"] },
      { name: "loop", models: ["loop"] }, { name: "odd", models: ["openai/m1"], kind: "x" }, { name: "panel", models: ["openai/m1"], minPanel: 1 }]) {
      const res = await post(body);
      assert.deepEqual([res.statusCode, res.json().code], [400, "INVALID_REQUEST"], body.name);
    }
    const fast = await combo(dash, { name: "fast", models: ["openai/m1", "openai/m2"] });
    assert.deepEqual([fast.strategy, fast.judgeModel, fast.minPanel, fast.stragglerGraceMs, fast.panelTimeoutMs], ["fallback", null, 2, 8000, 90000]);
    const again = await post({ name: "fast", models: ["openai/m3"] });
    assert.deepEqual([again.statusCode, again.json().code], [409, "COMBO_EXISTS"]);
    const slow = await combo(dash, { name: "slow", models: ["openai/m3"], strategy: "round-robin" });
    const patch = (id, body) => dash({ method: "PATCH", url: `/api/combos/${id}`, body });
    assert.deepEqual([(await patch(slow.id, { name: "fast" })).statusCode, (await patch(slow.id, { name: "fast" })).json().code], [409, "COMBO_EXISTS"]);
    assert.equal((await patch(slow.id, { models: ["slow"] })).json().code, "INVALID_REQUEST", "a rename or member change cannot reach itself");
    assert.equal((await patch(slow.id, {})).json().code, "INVALID_REQUEST");
    assert.deepEqual([(await patch("missing", { strategy: "fusion" })).statusCode, (await patch("missing", { strategy: "fusion" })).json().code], [404, "NOT_FOUND"]);
    const renamed = (await patch(slow.id, { name: "steady" })).json().combo;
    assert.deepEqual([renamed.name, renamed.strategy], ["steady", "round-robin"], "the strategy stays with the combo (combo.strategy-keyed-by-name)");
    assert.deepEqual((await dash({ url: "/api/combos" })).json().combos.map((c) => c.name), ["fast", "steady"]);
    assert.equal((await dash({ url: `/api/combos/${fast.id}` })).json().combo.name, "fast");
    const models = (await call({ url: "/v1/models", headers: { authorization: `Bearer ${key}` } })).json().data;
    assert.deepEqual(models.slice(0, 2), [{ id: "fast", object: "model", created: 0, owned_by: "combo" }, { id: "steady", object: "model", created: 0, owned_by: "combo" }]);
    assert.equal((await dash({ method: "DELETE", url: `/api/combos/${fast.id}` })).statusCode, 204);
    assert.equal((await dash({ method: "DELETE", url: `/api/combos/${fast.id}` })).json().code, "NOT_FOUND");
    assert.equal((await dash({ url: `/api/combos/${fast.id}` })).statusCode, 404);
    assert.deepEqual((await dash({ url: "/api/combos" })).json().combos.map((c) => c.name), ["steady"]);
    await app.close();
  }));

test("fallback: a rate-limited member hands over, a client error is the answer, and the last member's error ends it", () =>
  withTempDb(async (file) => {
    const upstream = byModel({
      m1: [limited(), json(400, { error: { message: "bad things", type: "invalid_request_error" } }), limited(), limited()],
      m2: [said("from m2"), streamed("streamed m2"), json(401, { error: { message: "Incorrect API key provided" } })],
    });
    const { app, dash, chat } = await ready(file, upstream);
    await combo(dash, { name: "fast", models: ["openai/m1", "openai/m2"] });
    const ok = await chat({ ...hello, model: "fast" });
    assert.deepEqual([ok.statusCode, contentOf(ok)], [200, "from m2"]);
    assert.deepEqual(upstream.calls.map((c) => c.model), ["m1", "m2"]);
    const client = await chat({ ...hello, model: "fast" });
    assert.equal(client.statusCode, 400, "a client error is not tried on the next member");
    assert.equal(upstream.calls.length, 3);
    const stream = await chat({ ...hello, model: "fast", stream: true });
    assert.deepEqual([stream.statusCode, textOf(stream)], [200, "streamed m2"]);
    const all = await chat({ ...hello, model: "fast" });
    assert.deepEqual(errorOf(all), { status: 502, code: "upstream_auth_error", type: "upstream_auth_error" }, "the last member's error (combo.aggregate-status-first-failure)");
    assert.equal(upstream.calls.length, 7);
    await app.close();
  }));

test("fallback: a member without a connection is skipped; none anywhere is 503", () =>
  withTempDb(async (file) => {
    const upstream = byModel({ m1: [said("from m1")] });
    const { app, dash, chat } = await ready(file, upstream);
    await combo(dash, { name: "mixed", models: ["deepseek/deepseek-chat", "openai/m1"] });
    await combo(dash, { name: "nowhere", models: ["deepseek/deepseek-chat", "ds/deepseek-reasoner"] });
    const mixed = await chat({ ...hello, model: "mixed" });
    assert.deepEqual([mixed.statusCode, contentOf(mixed)], [200, "from m1"]);
    assert.deepEqual(errorOf(await chat({ ...hello, model: "nowhere" })), { status: 503, code: "provider_unavailable", type: "api_error" });
    assert.equal(upstream.calls.length, 1);
    await app.close();
  }));

test("round-robin rotates by the sticky limit; a changed limit or an edited combo starts over", () =>
  withTempDb(async (file) => {
    const answers = () => Array.from({ length: 5 }, () => said("ok"));
    const upstream = byModel({ m1: answers(), m2: answers(), m3: answers() });
    const { app, dash, chat } = await ready(file, upstream);
    const rr = await combo(dash, { name: "rr", models: ["openai/m1", "openai/m2", "openai/m3"], strategy: "round-robin" });
    const run = async (n) => {
      for (let i = 0; i < n; i += 1) assert.equal((await chat({ ...hello, model: "rr" })).statusCode, 200);
    };
    await run(4);
    assert.deepEqual(upstream.calls.map((c) => c.model), ["m1", "m2", "m3", "m1"]);
    const set = await dash({ method: "PATCH", url: "/api/settings", body: { comboStickyLimit: 2 } });
    assert.equal(set.json().comboStickyLimit, 2);
    assert.equal((await dash({ method: "PATCH", url: "/api/settings", body: { comboStickyLimit: 0 } })).statusCode, 400);
    await run(3);
    assert.deepEqual(upstream.calls.slice(4).map((c) => c.model), ["m1", "m1", "m2"]);
    assert.equal((await dash({ method: "PATCH", url: `/api/combos/${rr.id}`, body: { strategy: "round-robin" } })).statusCode, 200);
    await run(1);
    assert.equal(upstream.calls.at(-1).model, "m1");
    await app.close();
  }));

test("nested combos resolve three deep; deeper, or a cycle, is combo_too_deep before any upstream call", () =>
  withTempDb(async (file) => {
    const upstream = byModel({ m1: [said("deep")] });
    const { app, dash, chat } = await ready(file, upstream);
    await combo(dash, { name: "c1", models: ["c2"] });
    await combo(dash, { name: "c2", models: ["c3"] });
    await combo(dash, { name: "c3", models: ["openai/m1"] });
    await combo(dash, { name: "c0", models: ["c1"] });
    await combo(dash, { name: "a", models: ["b"] });
    await combo(dash, { name: "b", models: ["a"], strategy: "fusion" });
    const ok = await chat({ ...hello, model: "c1" });
    assert.deepEqual([ok.statusCode, contentOf(ok)], [200, "deep"]);
    for (const model of ["c0", "a", "b"]) {
      const res = await chat({ ...hello, model });
      assert.deepEqual(errorOf(res), { status: 400, code: "combo_too_deep", type: "invalid_request_error" }, model);
      assert.match(res.json().error.message, /Gateway → Routing/);
    }
    assert.equal(upstream.calls.length, 1);
    await app.close();
  }));

test("fusion: the panel answers without tools or streaming, four at once; the first member judges anonymized answers", () =>
  withTempDb(async (file) => {
    const members = ["m1", "m2", "m3", "m4", "m5", "m6"];
    const plan = Object.fromEntries(members.map((m) => [m, [later(40, said(`answer ${m}`))]]));
    plan.m1.push(said("final"));
    const upstream = byModel(plan);
    const { app, dash, chat } = await ready(file, upstream);
    await combo(dash, { name: "fuse", models: members.map((m) => `openai/${m}`), strategy: "fusion" });
    const res = await chat({ ...hello, model: "fuse", tools, tool_choice: "auto" });
    assert.deepEqual([res.statusCode, contentOf(res)], [200, "final"]);
    assert.equal(upstream.peak, 4, "at most four panel calls in flight");
    const panel = upstream.calls.slice(0, 6);
    assert.deepEqual(panel.map((c) => c.model).sort(), members);
    for (const { sent } of panel) assert.deepEqual([sent.stream, "tools" in sent, "tool_choice" in sent], [false, false, false]);
    const judge = upstream.calls[6];
    assert.equal(judge.model, "m1", "no judgeModel: the first member judges");
    assert.deepEqual([judge.sent.tools?.[0]?.function?.name, judge.sent.tool_choice], ["get_weather", "auto"], "the judge gets the client's tools");
    const prompt = judge.sent.messages.at(-1);
    assert.equal(prompt.role, "user");
    assert.match(prompt.content, /6 expert models/);
    assert.match(prompt.content, /\[Source 1\]\nanswer m1\n\n\[Source 2\]\nanswer m2/);
    assert.match(prompt.content, /\[Source 6\]\nanswer m6/);
    assert.ok(!/openai\/m|\bm2\b/.test(prompt.content.replace(/answer m\d/g, "")), "sources are anonymized");
    assert.equal(upstream.calls.length, 7);
    await app.close();
  }));

test("fusion quorum: after minPanel answers and the grace, stragglers are cancelled; judgeModel judges", () =>
  withTempDb(async (file) => {
    const upstream = byModel({ m1: [said("a1")], m2: [said("a2")], m3: [hang()], judge: [said("final")] });
    const { app, dash, chat } = await ready(file, upstream);
    await combo(dash, { name: "q", models: ["openai/m1", "openai/m2", "openai/m3"], strategy: "fusion", minPanel: 2, stragglerGraceMs: 0, judgeModel: "openai/judge" });
    const res = await chat({ ...hello, model: "q" });
    assert.deepEqual([res.statusCode, contentOf(res)], [200, "final"]);
    assert.equal(upstream.calls.find((c) => c.model === "m3").ctx.signal.aborted, true, "the straggler was cancelled");
    assert.match(upstream.calls.at(-1).sent.messages.at(-1).content, /2 expert models/);
    await app.close();
  }));

test("fusion degrade: one answer by the hard timeout asks that member the client's own request; no answer is 503", () =>
  withTempDb(async (file) => {
    const upstream = byModel({ m1: [hang()], m2: [said("panel"), streamed("streamed m2")], m3: [hang()], m4: [limited()], m5: [limited()] });
    const { app, dash, chat } = await ready(file, upstream);
    await combo(dash, { name: "d", models: ["openai/m1", "openai/m2", "openai/m3"], strategy: "fusion", panelTimeoutMs: 1000 });
    await combo(dash, { name: "e", models: ["openai/m4", "openai/m5"], strategy: "fusion" });
    const started = Date.now();
    const res = await chat({ ...hello, model: "d", stream: true });
    assert.deepEqual([res.statusCode, textOf(res)], [200, "streamed m2"]);
    assert.ok(Date.now() - started >= 900, "the panel waited for its hard timeout");
    const again = upstream.calls.at(-1);
    assert.deepEqual([again.model, again.sent.stream], ["m2", true], "the only member answers the original, streaming request");
    for (const model of ["m1", "m3"]) assert.equal(upstream.calls.find((c) => c.model === model).ctx.signal.aborted, true, model);
    const none = await chat({ ...hello, model: "e" });
    assert.deepEqual(errorOf(none), { status: 503, code: "provider_unavailable", type: "api_error" });
    assert.match(none.json().error.message, /"e"/);
    await app.close();
  }));
