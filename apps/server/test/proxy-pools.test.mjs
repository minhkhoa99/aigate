// Contract: docs/contracts/proxy-pools.md — CRUD, connection binding, and a bounded probe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { boot, setUp, withTempDb } from "./helpers.mjs";

const SECRET = "sk-proxy-pool-test-secret";
const encoder = new TextEncoder();
const stream = (value) => new ReadableStream({ start(controller) { controller.enqueue(encoder.encode(value)); controller.close(); } });

test("proxy pools preserve all types, bind connections, and test through their resolved configuration", () =>
  withTempDb(async (file) => {
    const calls = [];
    const transport = { async send(request, ctx) { calls.push({ request, ctx }); return { status: 204, headers: {}, body: stream("") }; } };
    const { app, call } = await boot(file, { transport });
    const cookie = await setUp(call);
    const as = (request) => call({ ...request, cookie });
    const create = await as({ method: "POST", url: "/api/proxy-pools", body: { name: "Deno relay", proxyUrl: "https://relay.example.test", type: "deno", strictProxy: true } });
    assert.equal(create.statusCode, 201);
    const pool = create.json().proxyPool;
    assert.deepEqual([pool.type, pool.strictProxy, pool.testStatus], ["deno", true, "untested"]);
    const connection = await as({ method: "POST", url: "/api/connections", body: { provider: "openai", apiKey: SECRET, proxyPoolId: pool.id } });
    assert.equal(connection.statusCode, 201);
    assert.equal(connection.json().proxyPoolId, pool.id);
    const listed = await as({ url: "/api/proxy-pools" });
    assert.equal(listed.json().proxyPools[0].boundConnectionCount, 1);
    assert.equal((await as({ method: "DELETE", url: `/api/proxy-pools/${pool.id}` })).statusCode, 409);
    const probe = await as({ method: "POST", url: `/api/proxy-pools/${pool.id}/test` });
    assert.equal(probe.json().ok, true);
    assert.deepEqual(calls[0].ctx.proxy, { url: "https://relay.example.test", noProxy: [], relay: true, strict: true });
    const patched = await as({ method: "PATCH", url: `/api/proxy-pools/${pool.id}`, body: { name: "Deno relay 2" } });
    assert.equal(patched.json().proxyPool.type, "deno", "an edit does not downgrade a Deno relay to HTTP");
    await as({ method: "PATCH", url: `/api/connections/${connection.json().id}`, body: { proxyPoolId: "__none__" } });
    assert.equal((await as({ method: "DELETE", url: `/api/proxy-pools/${pool.id}` })).statusCode, 204);
    await app.close();
  }));
