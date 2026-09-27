// Contract: docs/contracts/custom-models.md — the live model list, custom models, /v1/models, and the model test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { completion, fakeUpstream, json, ready, SECRET } from "./lane-helpers.mjs";

const custom = (dash) => ({
  add: (body) => dash({ method: "POST", url: "/api/models/custom", body }),
  list: (query = "") => dash({ url: `/api/models/custom${query}` }),
  remove: (query) => dash({ method: "DELETE", url: `/api/models/custom${query}` }),
});

test("custom models: add skips stored ids, list is oldest first, delete always succeeds; bad input is 400", () =>
  withTempDb(async (file) => {
    const { app, call, dash } = await ready(file, fakeUpstream());
    const models = custom(dash);
    assert.equal((await call({ url: "/api/models/custom" })).statusCode, 401, "behind the dashboard session");
    const first = await models.add({ provider: "openai", ids: ["ft-one", "ft-two", "ft-one"] });
    assert.equal(first.statusCode, 200);
    assert.equal(first.headers["cache-control"], "no-store");
    assert.deepEqual(first.json(), { success: true, added: 2 }, "a repeated id in one call is added once");
    assert.deepEqual((await models.add({ provider: "openai", ids: ["ft-two", "ft three"] })).json(), { success: true, added: 1 }, "any string is an id (kept)");
    assert.deepEqual((await models.add({ provider: "not-a-provider", ids: ["x"] })).json().added, 1, "the provider is not checked (kept)");
    const listed = (await models.list("?provider=openai")).json().models;
    assert.deepEqual(listed.map((m) => [m.provider, m.id]), [["openai", "ft-one"], ["openai", "ft-two"], ["openai", "ft three"]]);
    assert.ok(!Number.isNaN(Date.parse(listed[0].createdAt)));
    assert.equal((await models.list()).json().models.length, 4, "no provider: every custom model");
    await models.add({ provider: "groq", ids: ["ft-one"] });
    assert.equal((await models.remove("?provider=openai&id=ft-one")).statusCode, 204);
    assert.deepEqual((await models.list("?provider=groq")).json().models.map((m) => m.id), ["ft-one"], "only that provider's row goes");
    assert.equal((await models.remove("?provider=openai&id=never-added")).statusCode, 204, "nothing matched is still a success");
    assert.deepEqual((await models.list("?provider=openai")).json().models.map((m) => m.id), ["ft-two", "ft three"]);
    for (const body of [{}, { provider: "", ids: ["x"] }, { provider: "openai" }, { provider: "openai", ids: [] }, { provider: "openai", ids: ["x", ""] }, { provider: "openai", ids: [1] }, { provider: 1, ids: ["x"] }]) {
      const bad = await models.add(body);
      assert.deepEqual([bad.statusCode, bad.json().code, bad.json().message], [400, "INVALID_REQUEST", "provider and ids required"], JSON.stringify(body));
    }
    const many = await models.add({ provider: "openai", ids: Array.from({ length: 1001 }, (_, i) => `m${i}`) });
    assert.deepEqual([many.statusCode, many.json().message], [400, "At most 1000 ids per request"]);
    assert.deepEqual((await models.add({ provider: "openai", ids: Array.from({ length: 1000 }, (_, i) => `m${i}`) })).json().added, 1000);
    for (const query of ["", "?provider=openai", "?id=x", "?provider=&id=x"]) assert.equal((await models.remove(query)).statusCode, 400, query);
    await app.close();
  }));

test("live model list: the connection's upstream ids with inCatalog; a failure shows only the status", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(
      json(200, { data: [{ id: "gpt-4.1" }, { id: "brand-new" }, { id: "has space" }, { object: "model" }] }),
      json(401, { error: { message: "Incorrect API key provided", code: "invalid_api_key" } }),
      json(404, { error: { message: "Not here" } }),
      (_request, ctx) => ({ status: 200, headers: { "content-type": "application/json" }, body: new Response("not json").body, ctx }),
    );
    const { app, call, dash, connection } = await ready(file, upstream);
    const fetchModels = (id = connection.id) => dash({ url: `/api/connections/${id}/models` });
    assert.equal((await call({ url: `/api/connections/${connection.id}/models` })).statusCode, 401, "behind the dashboard session");
    const res = await fetchModels();
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["cache-control"], "no-store");
    assert.deepEqual(res.json(), { provider: "openai", connectionId: connection.id, models: [{ id: "gpt-4.1", inCatalog: true }, { id: "brand-new", inCatalog: false }] });
    const sent = upstream.calls[0].request;
    assert.deepEqual([sent.method, sent.url, sent.headers.authorization], ["GET", "https://api.openai.com/v1/models", `Bearer ${SECRET}`]);
    for (const message of ["Failed to fetch models: 401", "Failed to fetch models: 404", "Failed to fetch models"]) {
      const failed = await fetchModels();
      assert.deepEqual([failed.statusCode, failed.json()], [502, { code: "MODELS_FETCH_FAILED", message }], "the provider's reason is not shown (kept)");
    }
    assert.deepEqual([(await fetchModels("nope")).statusCode, (await fetchModels("nope")).json().code], [404, "NOT_FOUND"]);
    await app.close();
  }));

test("a custom provider lists its models at <base URL>/models; /v1/models adds custom models of connected providers", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(json(200, { data: [{ id: "llama-3" }] }));
    const { app, dash, key, call } = await ready(file, upstream);
    const node = (await dash({ method: "POST", url: "/api/provider-nodes", body: { name: "Local", prefix: "local", baseUrl: "https://llm.example.com/v1/" } })).json();
    const idle = (await dash({ method: "POST", url: "/api/provider-nodes", body: { name: "Idle", prefix: "idle", baseUrl: "https://idle.example.com/v1" } })).json();
    const nodeConnection = (await dash({ method: "POST", url: "/api/connections", body: { provider: node.id, apiKey: "sk-node-key-1234" } })).json();
    const listed = (await dash({ url: `/api/connections/${nodeConnection.id}/models` })).json();
    assert.deepEqual(listed.models, [{ id: "llama-3", inCatalog: false }]);
    assert.equal(upstream.calls[0].request.url, "https://llm.example.com/v1/models");
    const models = custom(dash);
    await models.add({ provider: node.id, ids: ["llama-3"] });
    await models.add({ provider: idle.id, ids: ["unlisted"] });
    await models.add({ provider: "openai", ids: ["gpt-4.1", "my-finetune"] });
    await models.add({ provider: "anthropic", ids: ["not-connected"] });
    // A custom provider whose prefix is a catalog id cannot be reached on /v1, so its models are not listed.
    const shadowed = (await dash({ method: "POST", url: "/api/provider-nodes", body: { name: "Shadow", prefix: "gemini", baseUrl: "https://shadow.example.com/v1" } })).json();
    await dash({ method: "POST", url: "/api/connections", body: { provider: shadowed.id, apiKey: "sk-shadow-key-1234" } });
    await models.add({ provider: shadowed.id, ids: ["shadow-model"] });
    const ids = (await call({ url: "/v1/models", headers: { authorization: `Bearer ${key}` } })).json().data.map((m) => m.id);
    assert.ok(ids.includes("openai/my-finetune"), "a custom model of a built-in provider");
    assert.equal(ids.filter((id) => id === "openai/gpt-4.1").length, 1, "a catalog id added again is listed once");
    assert.ok(ids.indexOf("openai/my-finetune") > ids.indexOf("openai/gpt-4.1"), "custom models after the catalog ones");
    assert.equal(ids.at(-1), "local/llama-3", "a custom provider under its prefix");
    assert.ok(!ids.some((id) => id.startsWith("idle/") || id.startsWith("anthropic/")), "providers without an active connection are not listed");
    assert.ok(!ids.includes("gemini/shadow-model"), "an unreachable custom provider is not listed");
    const entry = (await call({ url: "/v1/models", headers: { authorization: `Bearer ${key}` } })).json().data.at(-1);
    assert.deepEqual(entry, { id: "local/llama-3", object: "model", created: 0, owned_by: "local" });
    await app.close();
  }));

test("model test: one real 1024-token request through the /v1 resolution; failures carry the lane's status and message", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(
      json(200, completion),
      json(200, { ...completion, choices: [{ message: { content: "", reasoning_content: "Let me think" }, finish_reason: "length" }] }),
      json(200, { ...completion, choices: [{ message: { content: "" }, finish_reason: "length" }] }),
      json(200, { ...completion, choices: [{ message: { content: "Hi", reasoning_content: "Let me think" }, finish_reason: "length" }] }),
      json(400, { error: { message: "bad things", type: "invalid_request_error" } }),
    );
    const { app, call, dash } = await ready(file, upstream);
    const probe = (body) => dash({ method: "POST", url: "/api/models/test", body });
    assert.equal((await call({ method: "POST", url: "/api/models/test", body: { model: "openai/gpt-4.1" } })).statusCode, 401, "behind the dashboard session");
    const ok = await probe({ model: "openai/gpt-4.1" });
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.headers["cache-control"], "no-store");
    const result = ok.json();
    assert.deepEqual([result.ok, result.status, result.error, "note" in result], [true, 200, null, false]);
    assert.equal(typeof result.latencyMs, "number");
    const sent = JSON.parse(upstream.calls[0].request.body);
    assert.deepEqual([sent.model, sent.max_completion_tokens, sent.stream, sent.messages], ["gpt-4.1", 1024, false, [{ role: "user", content: "hi" }]]);
    assert.equal((await probe({ model: "openai/gpt-4.1" })).json().note, "reasoning-only response (length-limited)");
    for (const why of ["no reasoning either", "an answer came too"]) {
      const cut = (await probe({ model: "openai/gpt-4.1" })).json();
      assert.deepEqual([cut.ok, "note" in cut], [true, false], why);
    }
    const failed = (await probe({ model: "openai/gpt-4.1" })).json();
    assert.deepEqual([failed.ok, failed.status], [false, 400]);
    assert.match(failed.error, /^HTTP 400: OpenAI answered 400: bad things/);
    const unknown = (await probe({ model: "no-such-model-anywhere" })).json();
    assert.deepEqual([unknown.ok, unknown.status], [false, 404]);
    assert.match(unknown.error, /^HTTP 404: The model "no-such-model-anywhere" is not in the catalog/);
    assert.equal(upstream.calls.length, 5, "the unknown model never reached a provider");
    for (const body of [{}, { model: "" }, { model: 1 }]) {
      const bad = await probe(body);
      assert.deepEqual([bad.statusCode, bad.json().code, bad.json().message], [400, "INVALID_REQUEST", "Model required"]);
    }
    await app.close();
  }));
