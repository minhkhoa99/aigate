// Contract: docs/contracts/custom-providers.md — custom OpenAI-compatible providers, their connection, and /v1.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { completion, fakeUpstream, hello, json, ready } from "./lane-helpers.mjs";

const body = { name: "Local LLM", prefix: "local", baseUrl: "https://llm.example.com/v1/" };

test("create stores the fields as 9router does; bad fields name the problem", () =>
  withTempDb(async (file) => {
    const { app, call, dash } = await ready(file, fakeUpstream());
    const create = (payload) => dash({ method: "POST", url: "/api/provider-nodes", body: payload });
    assert.equal((await call({ method: "POST", url: "/api/provider-nodes", body })).statusCode, 401, "behind the dashboard session");
    const res = await create({ ...body, name: "  Local LLM ", prefix: " local " });
    assert.equal(res.statusCode, 201);
    assert.equal(res.headers["cache-control"], "no-store");
    const node = res.json();
    assert.match(node.id, /^openai-compatible-[0-9a-f]{12}$/);
    assert.deepEqual([node.name, node.prefix, node.baseUrl], ["Local LLM", "local", "https://llm.example.com/v1/"], "trimmed, otherwise as given");
    assert.deepEqual(Object.keys(node).sort(), ["baseUrl", "createdAt", "id", "name", "prefix", "updatedAt"]);
    const defaulted = await create({ name: "No URL", prefix: "nourl" });
    assert.deepEqual([defaulted.statusCode, defaulted.json().baseUrl], [201, "https://api.openai.com/v1"], "the 9router default base URL");
    // Stored even though /v1 can never reach them (connection.provider-node-create-list).
    for (const prefix of ["openai", "a/b", "local"]) assert.equal((await create({ ...body, prefix })).statusCode, 201, prefix);
    for (const [payload, pattern] of [
      [{ name: "x" }, /prefix is required/],
      [{ ...body, prefix: " " }, /prefix must be/],
      [{ ...body, baseUrl: "http://llm.example.com/v1" }, /https/],
      [{ ...body, baseUrl: "https://user:pw@llm.example.com" }, /username or password/],
      [{ ...body, baseUrl: "https://llm.example.com/v1?key=1" }, /query or fragment/],
      [{ ...body, baseUrl: "not a url" }, /baseUrl/],
      [{ ...body, type: "anthropic-compatible" }, /type is not a field/],
      [{ ...body, name: "" }, /name must be/],
    ]) {
      const bad = await create(payload);
      assert.deepEqual([bad.statusCode, bad.json().code], [400, "INVALID_REQUEST"], JSON.stringify(payload));
      assert.match(bad.json().message, pattern);
    }
    assert.equal((await create({ ...body, prefix: "ollama-box", baseUrl: "http://127.0.0.1:11434/v1" })).statusCode, 201, "http to this machine");
    const list = (await dash({ url: "/api/provider-nodes" })).json();
    assert.deepEqual(list.map((n) => n.prefix), ["local", "nourl", "openai", "a/b", "local", "ollama-box"], "oldest first");
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
    const patch = (id, payload) => dash({ method: "PATCH", url: `/api/provider-nodes/${id}`, body: payload });
    const renamed = await patch(a.id, { name: "Renamed", baseUrl: "https://new.example.com/api" });
    assert.equal(renamed.statusCode, 200);
    assert.deepEqual([renamed.json().name, renamed.json().baseUrl, renamed.json().prefix], ["Renamed", "https://new.example.com/api", "local"]);
    assert.equal((await patch(a.id, { prefix: "openai" })).statusCode, 200, "a reserved prefix is stored, as in 9router");
    assert.equal((await patch(a.id, { baseUrl: "ftp://x" })).json().code, "INVALID_REQUEST");
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
    assert.equal(upstream.calls[0].request.url, "https://llm.example.com/v1/models", "one trailing slash dropped");
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

test("9router routing quirks: built-in prefixes win, the oldest duplicate wins, a pasted endpoint doubles the path", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(json(200, completion), json(200, completion), json(200, completion));
    const { app, dash, chat } = await ready(file, upstream);
    const create = async (payload) => (await dash({ method: "POST", url: "/api/provider-nodes", body: payload })).json();
    const connect = (node) => dash({ method: "POST", url: "/api/connections", body: { provider: node.id, apiKey: "sk-node-key-1234" } });
    await connect(await create({ ...body, name: "Shadow", prefix: "openai" }));
    await connect(await create({ ...body, name: "First", baseUrl: "https://first.example.com/v1" }));
    await connect(await create({ ...body, name: "Second", baseUrl: "https://second.example.com/v1" }));
    await connect(await create({ ...body, name: "Pasted", prefix: "pasted", baseUrl: "https://p.example.com/v1/chat/completions" }));
    assert.equal((await chat({ ...hello, model: "openai/gpt-4.1" })).statusCode, 200);
    assert.equal(upstream.calls[0].request.url, "https://api.openai.com/v1/chat/completions", "the built-in provider, not the node");
    assert.equal((await chat({ ...hello, model: "local/llama-3" })).statusCode, 200);
    assert.equal(upstream.calls[1].request.url, "https://first.example.com/v1/chat/completions", "the oldest node with the prefix");
    assert.equal((await chat({ ...hello, model: "pasted/llama-3" })).statusCode, 200);
    assert.equal(upstream.calls[2].request.url, "https://p.example.com/v1/chat/completions/chat/completions", "kept as 9router builds it");
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
