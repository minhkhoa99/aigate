// Contract: docs/contracts/settings.md
import { test } from "node:test";
import assert from "node:assert/strict";
import { boot, setUp, withTempDb } from "./helpers.mjs";

async function signedIn(file, run) {
  const { app, call } = await boot(file);
  try {
    const status = (await call({ url: "/api/auth/status" })).json();
    const cookie = status.setupRequired
      ? await setUp(call)
      : (await call({ method: "POST", url: "/api/auth/login", body: { password: "correct horse battery" } })).headers["set-cookie"].split(";")[0];
    const request = (method, payload) => call({ method, url: "/api/settings", cookie, body: payload });
    await run(request);
  } finally {
    await app.close();
  }
}

test("GET returns every setting with its default and no-store", () =>
  withTempDb((file) => signedIn(file, async (request) => {
    const res = await request("GET");
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { requireLogin: true, requireApiKey: true });
    assert.equal(res.headers["cache-control"], "no-store");
  })));

test("PATCH applies, shows on the next GET, and survives a restart", () =>
  withTempDb(async (file) => {
    await signedIn(file, async (request) => {
      const res = await request("PATCH", { requireApiKey: false });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.json(), { requireLogin: true, requireApiKey: false });
      assert.equal((await request("GET")).json().requireApiKey, false);
      assert.deepEqual((await request("PATCH", {})).json(), { requireLogin: true, requireApiKey: false }, "empty patch is a no-op");
    });
    await signedIn(file, async (request) => {
      assert.deepEqual((await request("GET")).json(), { requireLogin: true, requireApiKey: false });
    });
  }));

test("PATCH rejects unknown, secret, and wrongly typed keys without changing anything", () =>
  withTempDb((file) => signedIn(file, async (request) => {
    const cases = [
      [{ requireApiKey: false, password: "x" }, ["password"]],
      [{ mitmSudoEncrypted: "x" }, ["mitmSudoEncrypted"]],
      [{ requireLogin: "false" }, ["requireLogin"]],
      [{ somethingNew: 1 }, ["somethingNew"]],
      // Boolean values, so only the allowlist (not the type check) can reject these.
      [{ somethingNew: true }, ["somethingNew"]],
      [{ id: true }, ["id"]],
      [[{ requireLogin: false }], []],
      ["true", []],
    ];
    for (const [body, keys] of cases) {
      const res = await request("PATCH", body);
      assert.equal(res.statusCode, 400, JSON.stringify(body));
      assert.equal(res.json().code, "INVALID_REQUEST");
      assert.deepEqual(res.json().keys, keys, JSON.stringify(body));
    }
    assert.deepEqual((await request("GET")).json(), { requireLogin: true, requireApiKey: true }, "nothing changed");
  })));
