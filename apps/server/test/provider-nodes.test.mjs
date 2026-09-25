// Contract: docs/contracts/custom-providers.md — custom OpenAI-compatible providers, their connection, and /v1.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { completion, fakeUpstream, hello, json, ready } from "./lane-helpers.mjs";

const body = { name: "Local LLM", prefix: "local", baseUrl: "https://llm.example.com/v1/" };

test("create normalizes the base URL; bad fields, reserved and taken prefixes name the problem", () =>
  withTempDb(async (file) => {
    const { app, call, dash } = await ready(file, fakeUpstream());
    const create = (payload) => dash({ method: "POST", url: "/api/provider-nodes", body: payload });
    assert.equal((await call({ method: "POST", url: "/api/provider-nodes", body })).statusCode, 401, "behind the dashboard session");
    const res = await create({ ...body, baseUrl: "https://llm.example.com/v1/chat/completions/" });
    assert.equal(res.statusCode, 201);
    assert.equal(res.headers["cache-control"], "no-store");
    const node = res.json();
    assert.match(node.id, /^openai-compatible-[0-9a-f]{12}$/);
    assert.deepEqual([node.name, node.prefix, node.baseUrl], ["Local LLM", "local", "https://llm.example.com/v1"], "a pasted endpoint loses /chat/completions and the slash");
    assert.deepEqual(Object.keys(node).sort(), ["baseUrl", "createdAt", "id", "name", "prefix", "updatedAt"]);
    for (const [payload, pattern] of [
      [{ name: "x", prefix: "p1" }, /baseUrl is required/],
      [{ ...body, prefix: "a/b" }, /prefix must be/],
      [{ ...body, prefix: "Upper" }, /prefix must be/],
      [{ ...body, prefix: "p2", baseUrl: "http://llm.example.com/v1" }, /https/],
      [{ ...body, prefix: "p3", baseUrl: "https://user:pw@llm.example.com" }, /username or password/],
      [{ ...body, prefix: "p4", baseUrl: "https://llm.example.com/v1?key=1" }, /query or fragment/],
      [{ ...body, prefix: "p5", baseUrl: "not a url" }, /baseUrl/],
      [{ ...body, prefix: "p6", type: "anthropic-compatible" }, /type is not a field/],
      [{ ...body, prefix: "p7", name: "" }, /name must be/],
    ]) {
      const bad = await create(payload);
      assert.deepEqual([bad.statusCode, bad.json().code], [400, "INVALID_REQUEST"], JSON.stringify(payload));
      assert.match(bad.json().message, pattern);
    }
    assert.equal((await create({ ...body, prefix: "p8", baseUrl: "http://127.0.0.1:11434/v1" })).statusCode, 201, "http to this machine");
    for (const prefix of ["openai", "ds", "claude"]) {
      const clash = await create({ ...body, prefix });
      assert.deepEqual([clash.statusCode, clash.json().code], [409, "PREFIX_RESERVED"], prefix);
    }
    const again = await create({ ...body, name: "Second" });
    assert.deepEqual([again.statusCode, again.json().code], [409, "PREFIX_TAKEN"]);
    assert.match(again.json().message, /"local"/);
    const list = (await dash({ url: "/api/provider-nodes" })).json();
    assert.deepEqual(list.map((n) => n.prefix), ["local", "p8"], "oldest first");
    await app.close();
  }));

test("at most 100 custom providers", () =>
  withTempDb(async (file) => {
    const { app, dash } = await ready(file, fakeUpstream());
    for (let i = 0; i < 100; i++) {
      assert.equal((await dash({ method: "POST", url: "/api/provider-nodes", body: { ...body, prefix: `n${i}` } })).statusCode, 201);
    }
    const over = await dash({ method: "POST", url: "/api/provider-nodes", body: { ...body, prefix: "n100" } });
    assert.deepEqual([over.statusCode, over.json().code], [409, "NODE_LIMIT"]);
    await app.close();
  }));

test("update changes name, prefix, base URL with the same rules; unknown ids are 404", () =>
  withTempDb(async (file) => {
    const { app, dash } = await ready(file, fakeUpstream());
    const a = (await dash({ method: "POST", url: "/api/provider-nodes", body })).json();
    await dash({ method: "POST", url: "/api/provider-nodes", body: { ...body, prefix: "other" } });
    const patch = (id, payload) => dash({ method: "PATCH", url: `/api/provider-nodes/${id}`, body: payload });
    const renamed = await patch(a.id, { name: "Renamed", baseUrl: "https://new.example.com/api/" });
    assert.equal(renamed.statusCode, 200);
    assert.deepEqual([renamed.json().name, renamed.json().baseUrl, renamed.json().prefix], ["Renamed", "https://new.example.com/api", "local"]);
    assert.equal((await patch(a.id, { prefix: "local" })).statusCode, 200, "its own prefix is not a clash");
    assert.equal((await patch(a.id, { prefix: "other" })).json().code, "PREFIX_TAKEN");
    assert.equal((await patch(a.id, { prefix: "openai" })).json().code, "PREFIX_RESERVED");
    assert.equal((await patch(a.id, {})).json().code, "INVALID_REQUEST");
    const missing = await patch("nope", { name: "x" });
    assert.deepEqual([missing.statusCode, missing.json().code], [404, "NOT_FOUND"]);
    await app.close();
  }));

test("a custom provider gets a connection, is tested at its own URL, and serves <prefix>/<model> on /v1", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(json(200, { data: [{ id: "llama-3" }] }), json(200, completion));
    const { app, call, key, dash, chat } = await ready(file, upstream);
    const node = (await dash({ method: "POST", url: "/api/provider-nodes", body })).json();
    const before = await chat({ ...hello, model: "local/llama-3" });
    assert.deepEqual([before.statusCode, before.json().error.code], [404, "no_active_connection"]);
    assert.match(before.json().error.message, /Local LLM/);
    const created = await dash({ method: "POST", url: "/api/connections", body: { provider: node.id, apiKey: "sk-local-key-1234" } });
    assert.equal(created.statusCode, 201);
    assert.equal(created.json().providerName, "Local LLM");
    assert.equal((await dash({ url: "/api/connections" })).json().find((c) => c.provider === node.id).providerName, "Local LLM");
    const tested = (await dash({ method: "POST", url: `/api/connections/${created.json().id}/test` })).json();
    assert.equal(tested.testStatus, "active");
    assert.equal(upstream.calls[0].request.url, "https://llm.example.com/v1/models");
    const res = await chat({ ...hello, model: "local/llama-3" });
    assert.equal(res.statusCode, 200);
    assert.equal(upstream.calls[1].request.url, "https://llm.example.com/v1/chat/completions");
    assert.equal(upstream.calls[1].request.headers.authorization, "Bearer sk-local-key-1234");
    assert.equal(JSON.parse(upstream.calls[1].request.body).model, "llama-3");
    // A custom provider declares no models, so it never serves a bare id and /v1/models does not list it.
    assert.equal((await chat({ ...hello, model: "llama-3" })).json().error.code, "model_not_found");
    const listed = (await call({ url: "/v1/models", headers: { authorization: `Bearer ${key}` } })).json().data;
    assert.ok(listed.length > 0 && listed.every((m) => m.owned_by === "openai"));
    await app.close();
  }));

test("deleting a custom provider deletes its connection; the prefix then routes nowhere", () =>
  withTempDb(async (file) => {
    const { app, dash, chat } = await ready(file, fakeUpstream());
    const node = (await dash({ method: "POST", url: "/api/provider-nodes", body })).json();
    await dash({ method: "POST", url: "/api/connections", body: { provider: node.id, apiKey: "sk-local-key-1234" } });
    assert.equal((await dash({ url: "/api/connections" })).json().length, 2, "OpenAI and the custom provider");
    assert.equal((await dash({ method: "DELETE", url: `/api/provider-nodes/${node.id}` })).statusCode, 204);
    assert.deepEqual((await dash({ url: "/api/connections" })).json().map((c) => c.provider), ["openai"]);
    assert.equal((await dash({ method: "DELETE", url: `/api/provider-nodes/${node.id}` })).statusCode, 404);
    assert.equal((await chat({ ...hello, model: "local/llama-3" })).json().error.code, "model_not_found");
    const orphan = await dash({ method: "POST", url: "/api/connections", body: { provider: node.id, apiKey: "sk-local-key-1234" } });
    assert.deepEqual([orphan.statusCode, orphan.json().code], [400, "PROVIDER_NOT_SUPPORTED"]);
    await app.close();
  }));
