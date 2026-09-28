// Contract: docs/contracts/provider-thinking.md — a provider's thinking level, set from its page and applied on /v1.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { completion, fakeUpstream, hello, json, ready } from "./lane-helpers.mjs";

const OPENAI_LEVELS = ["none", "minimal", "low", "medium", "high", "xhigh"];

test("the provider page shows the levels and the stored one; PUT stores it; bad levels and providers name the problem", () =>
  withTempDb(async (file) => {
    const { app, call, dash } = await ready(file, fakeUpstream());
    const put = (id, body) => dash({ method: "PUT", url: `/api/providers/${id}/thinking`, body });
    assert.deepEqual((await dash({ url: "/api/providers/openai" })).json().thinking, { level: "auto", levels: OPENAI_LEVELS });
    assert.equal((await call({ method: "PUT", url: "/api/providers/openai/thinking", body: { level: "high" } })).statusCode, 401, "behind the dashboard session");
    const saved = await put("openai", { level: "high" });
    assert.deepEqual([saved.statusCode, saved.headers["cache-control"], saved.json()], [200, "no-store", { level: "high", levels: OPENAI_LEVELS }]);
    assert.equal((await dash({ url: "/api/providers/openai" })).json().thinking.level, "high");
    assert.equal((await put("openai", { level: "xhigh" })).json().level, "xhigh", "a second PUT replaces it");
    for (const [body, pattern] of [[{ level: "max" }, /auto or one of none, minimal, low, medium, high, xhigh/], [{ level: 3 }, /Send \{ level \}/], [{ level: "high", extra: 1 }, /Send \{ level \}/], [[], /Send \{ level \}/]]) {
      const bad = await put("openai", body);
      assert.deepEqual([bad.statusCode, bad.json().code], [400, "INVALID_REQUEST"], JSON.stringify(body));
      assert.match(bad.json().message, pattern);
    }
    const none = await put("assemblyai", { level: "high" });
    assert.deepEqual([none.statusCode, none.json().code], [400, "INVALID_REQUEST"]);
    assert.match(none.json().message, /has no model that reasons/);
    assert.equal((await dash({ url: "/api/providers/assemblyai" })).json().thinking.levels, null, "no picker for it");
    assert.deepEqual([(await put("nope", { level: "high" })).statusCode, (await put("nope", { level: "high" })).json().code], [404, "NOT_FOUND"]);
    assert.equal((await put("openai", { level: "auto" })).json().level, "auto");
    assert.equal((await dash({ url: "/api/providers/openai" })).json().thinking.level, "auto", "auto clears it");
    await app.close();
  }));

test("a stored level reaches a reasoning model when the client sends none, as the family's field; the model test gets it too", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(...Array.from({ length: 7 }, () => json(200, completion)));
    const { app, dash, chat } = await ready(file, upstream);
    const sent = (i) => JSON.parse(upstream.calls[i].request.body);
    await dash({ method: "PUT", url: "/api/providers/openai/thinking", body: { level: "high" } });
    assert.equal((await chat({ ...hello, model: "openai/gpt-5.5" })).statusCode, 200);
    assert.equal(sent(0).reasoning_effort, "high");
    await chat({ ...hello, model: "openai/gpt-5.5", reasoning_effort: "low" });
    assert.equal(sent(1).reasoning_effort, "low", "the client's own effort wins");
    await chat({ ...hello, model: "openai/gpt-4o" });
    assert.equal(sent(2).reasoning_effort, undefined, "gpt-4o does not reason");
    await dash({ method: "PUT", url: "/api/providers/openai/thinking", body: { level: "xhigh" } });
    await chat({ ...hello, model: "openai/gpt-5.5" });
    assert.equal(sent(3).reasoning_effort, "xhigh");
    const probe = await dash({ method: "POST", url: "/api/models/test", body: { model: "openai/gpt-5.5" } });
    assert.equal(probe.json().ok, true);
    assert.equal(sent(4).reasoning_effort, "xhigh", "the per-model test uses the level too");
    await dash({ method: "PUT", url: "/api/providers/openai/thinking", body: { level: "auto" } });
    await chat({ ...hello, model: "openai/gpt-5.5" });
    assert.equal(sent(5).reasoning_effort, undefined, "auto sends nothing");
    await app.close();
  }));
