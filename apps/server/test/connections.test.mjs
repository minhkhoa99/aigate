// Contract: docs/contracts/connections.md — CRUD, sealed storage, and the connection test, over Fastify inject.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { EngineError } from "@aigate/engine";
import { boot, setUp, withTempDb } from "./helpers.mjs";

const SECRET = "sk-live-connection-secret-9f3a";
const encoder = new TextEncoder();
const streamOf = (text) => new ReadableStream({ start(c) { c.enqueue(encoder.encode(text)); c.close(); } });

// Plays back one answer per upstream call: { status, body }, an Error to throw, or a function.
function fakeTransport(...answers) {
  const calls = [];
  return {
    calls,
    async send(request, ctx) {
      calls.push(request);
      const next = answers.shift();
      if (next === undefined) throw new Error("unexpected upstream call");
      if (next instanceof Error) throw next;
      if (typeof next === "function") return next(request, ctx);
      return { status: next.status, headers: { "content-type": "application/json" }, body: streamOf(JSON.stringify(next.body ?? {})) };
    },
  };
}

async function signedIn(file, options) {
  const { app, call } = await boot(file, options);
  const cookie = await setUp(call);
  const as = (request) => call({ ...request, cookie });
  return { app, call, as };
}

const create = (as, body = { provider: "openai", apiKey: SECRET }) => as({ method: "POST", url: "/api/connections", body });

test("connections need a dashboard session", () =>
  withTempDb(async (file) => {
    const { app, call } = await boot(file);
    await setUp(call);
    assert.equal((await call({ url: "/api/connections" })).statusCode, 401);
    assert.equal((await call({ method: "POST", url: "/api/connections", body: { provider: "openai", apiKey: SECRET } })).statusCode, 401);
    await app.close();
  }));

test("create stores the key sealed and never returns it", () =>
  withTempDb(async (file) => {
    const { app, as } = await signedIn(file);
    const res = await create(as);
    assert.equal(res.statusCode, 201);
    assert.equal(res.headers["cache-control"], "no-store");
    const view = res.json();
    assert.equal(view.provider, "openai");
    assert.equal(view.providerName, "OpenAI");
    assert.equal(view.name, "OpenAI", "name defaults to the provider name");
    assert.equal(view.keyHint, "••••9f3a");
    assert.equal(view.testStatus, "untested");
    assert.equal(view.isActive, true);
    assert.ok(!res.body.includes(SECRET));
    assert.deepEqual(Object.keys(view).sort(), [
      "createdAt", "id", "isActive", "keyHint", "lastError", "lastErrorCode", "lastTestedAt", "name", "provider", "providerName", "testStatus", "updatedAt",
    ], "an allowlisted view: nothing sealed or secret");
    const list = await as({ url: "/api/connections" });
    assert.equal(list.json().length, 1);
    assert.ok(!list.body.includes(SECRET));
    await app.close();
    // Nothing in the data directory (database, WAL, key file) holds the plaintext key.
    for (const name of readdirSync(dirname(file))) assert.ok(!readFileSync(join(dirname(file), name)).includes(SECRET), name);
  }));

test("one connection per provider; unsupported providers and bad bodies name the problem", () =>
  withTempDb(async (file) => {
    const { app, as } = await signedIn(file);
    assert.equal((await create(as)).statusCode, 201);
    const again = await create(as, { provider: "openai", apiKey: "sk-another-key-1234" });
    assert.equal(again.statusCode, 409);
    assert.equal(again.json().code, "ALREADY_CONNECTED");
    const unsupported = await create(as, { provider: "claude", apiKey: SECRET });
    assert.equal(unsupported.statusCode, 400);
    assert.equal(unsupported.json().code, "PROVIDER_NOT_SUPPORTED");
    assert.match(unsupported.json().message, /claude cannot be connected yet: Needs OAuth sign-in \(SP16\)\.$/, "the catalog reason");
    const unknown = await create(as, { provider: "no-such-provider", apiKey: SECRET });
    assert.deepEqual([unknown.statusCode, unknown.json().code], [400, "PROVIDER_NOT_SUPPORTED"]);
    assert.match(unknown.json().message, /not in the catalog/);
    assert.equal((await create(as, { provider: "deepseek", apiKey: SECRET })).statusCode, 201, "any connectable catalog provider");
    for (const [body, pattern] of [
      [{ provider: "openai" }, /apiKey/],
      [{ provider: "openai", apiKey: "short" }, /apiKey/],
      [{ provider: "openai", apiKey: "sk has spaces inside" }, /apiKey/],
      [{ provider: "openai", apiKey: SECRET, name: "x".repeat(65) }, /name/],
      [{ provider: "openai", apiKey: SECRET, lastError: "forged" }, /lastError/],
      [{ apiKey: SECRET }, /provider/],
      [["not", "an", "object"], /object/],
    ]) {
      const res = await create(as, body);
      assert.equal(res.statusCode, 400, JSON.stringify(body));
      assert.equal(res.json().code, "INVALID_REQUEST");
      assert.match(res.json().message, pattern);
    }
    await app.close();
  }));

test("the test sends the decrypted key once and records only answers about the key as invalid", () =>
  withTempDb(async (file) => {
    const network = new EngineError("PROVIDER_UNAVAILABLE", "Could not reach api.openai.com", { host: "api.openai.com" });
    const transport = fakeTransport(
      { status: 200, body: { data: [] } },
      { status: 401, body: { error: { message: `Incorrect API key provided: ${SECRET}` } } },
      { status: 429, body: { error: { code: "insufficient_quota", message: "You exceeded your current quota" } } },
      { status: 503, body: {} },
      network,
    );
    const { app, as } = await signedIn(file, { transport });
    const { id } = (await create(as)).json();
    const run = async () => {
      const res = await as({ method: "POST", url: `/api/connections/${id}/test` });
      assert.equal(res.statusCode, 200);
      assert.ok(!res.body.includes(SECRET), "an echoed key is redacted");
      return res.json();
    };
    const ok = await run();
    assert.deepEqual([ok.testStatus, ok.lastError, ok.lastErrorCode], ["active", null, null]);
    assert.ok(ok.lastTestedAt);
    assert.equal(transport.calls[0].url, "https://api.openai.com/v1/models");
    assert.equal(transport.calls[0].headers.authorization, `Bearer ${SECRET}`);
    assert.deepEqual([(await run()).testStatus, transport.calls.length], ["invalid", 2]);
    const quota = await run();
    assert.deepEqual([quota.testStatus, quota.lastErrorCode], ["no_quota", "QUOTA_EXHAUSTED"]);
    const down = await run();
    assert.deepEqual([down.testStatus, down.lastErrorCode, transport.calls.length], ["unreachable", "PROVIDER_UNAVAILABLE", 4], "a 5xx is not retried");
    assert.equal((await run()).testStatus, "unreachable");
    assert.equal((await as({ url: "/api/connections" })).json()[0].testStatus, "unreachable", "the result is stored");
    await app.close();
  }));

test("a key replaced during a test keeps its untested state", () =>
  withTempDb(async (file) => {
    let as;
    let id;
    const transport = fakeTransport(async () => {
      const patched = await as({ method: "PATCH", url: `/api/connections/${id}`, body: { apiKey: "sk-replacement-key-7777" } });
      assert.equal(patched.statusCode, 200);
      return { status: 200, headers: { "content-type": "application/json" }, body: streamOf("{\"data\":[]}") };
    });
    const session = await signedIn(file, { transport });
    as = session.as;
    id = (await create(as)).json().id;
    const res = await as({ method: "POST", url: `/api/connections/${id}/test` });
    assert.equal(res.statusCode, 200);
    assert.deepEqual([res.json().testStatus, res.json().keyHint], ["untested", "••••7777"]);
    await session.app.close();
  }));

test("patch, disable, and delete; a new key resets the test result; unknown ids are 404", () =>
  withTempDb(async (file) => {
    const transport = fakeTransport({ status: 200, body: { data: [] } });
    const { app, as } = await signedIn(file, { transport });
    const { id } = (await create(as)).json();
    await as({ method: "POST", url: `/api/connections/${id}/test` });
    const renamed = (await as({ method: "PATCH", url: `/api/connections/${id}`, body: { name: "Work", isActive: false } })).json();
    assert.deepEqual([renamed.name, renamed.isActive, renamed.testStatus], ["Work", false, "active"]);
    const rekeyed = (await as({ method: "PATCH", url: `/api/connections/${id}`, body: { apiKey: "sk-new-key-abcd" } })).json();
    assert.deepEqual([rekeyed.keyHint, rekeyed.testStatus, rekeyed.lastTestedAt], ["••••abcd", "untested", null]);
    for (const body of [{}, { testStatus: "active" }, { isActive: "no" }]) {
      const res = await as({ method: "PATCH", url: `/api/connections/${id}`, body });
      assert.equal(res.statusCode, 400, JSON.stringify(body));
    }
    assert.equal((await as({ method: "PATCH", url: "/api/connections/missing", body: { name: "x" } })).json().code, "NOT_FOUND");
    assert.equal((await as({ method: "POST", url: "/api/connections/missing/test" })).statusCode, 404);
    assert.equal((await as({ method: "DELETE", url: `/api/connections/${id}` })).statusCode, 204);
    assert.equal((await as({ method: "DELETE", url: `/api/connections/${id}` })).statusCode, 404);
    assert.equal((await create(as)).statusCode, 201, "the provider can be connected again after delete");
    await app.close();
  }));

test("a changed secret key makes stored keys unreadable, and a new key fixes the row", () =>
  withTempDb(async (file) => {
    const first = await signedIn(file, { secretKey: "11".repeat(32) });
    const { id } = (await create(first.as)).json();
    await first.app.close();

    const transport = fakeTransport({ status: 200, body: { data: [] } });
    const { app, call } = await boot(file, { secretKey: "22".repeat(32), transport });
    const login = await call({ method: "POST", url: "/api/auth/login", body: { password: "correct horse battery" } });
    const cookie = login.headers["set-cookie"].split(";")[0];
    const as = (request) => call({ ...request, cookie });
    assert.equal((await as({ url: "/api/connections" })).json().length, 1, "listing never decrypts");
    const unreadable = await as({ method: "POST", url: `/api/connections/${id}/test` });
    assert.equal(unreadable.statusCode, 409);
    assert.equal(unreadable.json().code, "CREDENTIAL_UNREADABLE");
    assert.equal(transport.calls.length, 0);
    await as({ method: "PATCH", url: `/api/connections/${id}`, body: { apiKey: SECRET } });
    assert.equal((await as({ method: "POST", url: `/api/connections/${id}/test` })).json().testStatus, "active");
    await app.close();
  }));
