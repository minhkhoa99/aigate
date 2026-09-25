// Contract: docs/contracts/identity-apikeys.md, "API keys"
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { DATABASE } from "../dist/server.js";
import { extractApiKey } from "../dist/modules/apikeys/domain/api-key.js";
import { ApiKeysRepository } from "../dist/modules/apikeys/infrastructure/api-keys.repo.js";
import { boot, setUp, withTempDb } from "./helpers.mjs";

async function signedIn(run) {
  await withTempDb(async (file) => {
    const { app, call } = await boot(file);
    try {
      const cookie = await setUp(call);
      await run({ app, call: (req) => call({ cookie, ...req }), anonymous: call });
    } finally {
      await app.close();
    }
  });
}

test("a key is shown once, listed masked, and stored only as a hash", () =>
  signedIn(async ({ app, call, anonymous }) => {
    assert.equal((await anonymous({ method: "POST", url: "/api/keys", body: { name: "CI" } })).statusCode, 401);
    const created = await call({ method: "POST", url: "/api/keys", body: { name: "  Local dev  " } });
    assert.equal(created.statusCode, 201);
    const { key, ...view } = created.json();
    assert.match(key, /^aigate_[A-Za-z0-9_-]{43}$/);
    assert.equal(view.name, "Local dev", "name is trimmed");
    assert.equal(view.maskedKey, `aigate_••••${key.slice(-4)}`);
    assert.equal(view.isActive, true);

    const list = await call({ url: "/api/keys" });
    assert.equal(list.headers["cache-control"], "no-store");
    assert.deepEqual(list.json(), [view]);
    assert.ok(!list.body.includes(key.slice(7, 20)), "the list never carries the secret");

    const rows = await app.get(DATABASE).db.all(sql`select key_hash from api_keys`);
    const stored = rows[0].key_hash ?? rows[0][0];
    assert.equal(stored, createHash("sha256").update(key).digest("hex"));
  }));

test("validation follows the stored hash and the active flag", () =>
  signedIn(async ({ app, call }) => {
    const repo = app.get(ApiKeysRepository);
    const { id, key } = (await call({ method: "POST", url: "/api/keys", body: { name: "CI" } })).json();
    assert.equal(await repo.isValid(key), true);
    assert.equal(await repo.isValid(`${key.slice(0, -1)}${key.at(-1) === "A" ? "B" : "A"}`), false);
    assert.equal(await repo.isValid("sk-legacy-key"), false, "malformed keys never reach the database");

    const disabled = await call({ method: "PATCH", url: `/api/keys/${id}`, body: { isActive: false } });
    assert.equal(disabled.json().isActive, false);
    assert.equal(await repo.isValid(key), false);
    await call({ method: "PATCH", url: `/api/keys/${id}`, body: { isActive: true } });
    assert.equal(await repo.isValid(key), true);

    assert.equal((await call({ method: "DELETE", url: `/api/keys/${id}` })).statusCode, 204);
    assert.equal(await repo.isValid(key), false);
    assert.equal((await call({ method: "DELETE", url: `/api/keys/${id}` })).statusCode, 404);
    assert.equal((await call({ method: "PATCH", url: `/api/keys/${id}`, body: { isActive: true } })).statusCode, 404);
  }));

test("names, status bodies, and the key count are bounded", () =>
  signedIn(async ({ call }) => {
    for (const body of [{ name: "" }, { name: "   " }, { name: "x".repeat(65) }, { name: "ok", keyHash: "x" }, ["CI"], { name: 1 }]) {
      assert.equal((await call({ method: "POST", url: "/api/keys", body })).statusCode, 400, JSON.stringify(body));
    }
    const { id } = (await call({ method: "POST", url: "/api/keys", body: { name: "one" } })).json();
    for (const body of [{ isActive: "false" }, { isActive: false, name: "renamed" }, {}]) {
      assert.equal((await call({ method: "PATCH", url: `/api/keys/${id}`, body })).statusCode, 400, JSON.stringify(body));
    }
    for (let i = 1; i < 100; i++) assert.equal((await call({ method: "POST", url: "/api/keys", body: { name: `k${i}` } })).statusCode, 201);
    const full = await call({ method: "POST", url: "/api/keys", body: { name: "one too many" } });
    assert.equal(full.statusCode, 409);
    assert.equal(full.json().code, "LIMIT_REACHED");
    assert.equal((await call({ url: "/api/keys" })).json().length, 100);
  }));

test("the key is read from Bearer first, then x-api-key", () => {
  assert.equal(extractApiKey({ authorization: "Bearer aigate_a", "x-api-key": "aigate_b" }), "aigate_a");
  assert.equal(extractApiKey({ authorization: "Basic dXNlcg==", "x-api-key": "aigate_b" }), "aigate_b");
  assert.equal(extractApiKey({ authorization: "bearer aigate_a" }), undefined, "the scheme is case-sensitive, as in 9router");
  assert.equal(extractApiKey({ authorization: "Bearer   " }), undefined);
  assert.equal(extractApiKey({}), undefined);
});
