import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { fakeUpstream, ready, hello } from "./lane-helpers.mjs";

test("simulation endpoint is protected, explicit 200/no-store and no vendor execution", () => withTempDb(async file => {
  const upstream = fakeUpstream();
  const { app, call, dash } = await ready(file, upstream);
  try {
    const url = "/api/routing/simulate", body = { request: hello };
    assert.equal((await call({ method: "POST", url, body })).statusCode, 401);
    const result = await dash({ method: "POST", url, body });
    assert.equal(result.statusCode, 200, result.body);
    assert.equal(result.headers["cache-control"], "no-store");
    assert.equal(result.json().outcome, "candidate");
    const blocked = await dash({ method: "POST", url, body: { request: { ...hello, model: "missing-model" } } });
    assert.equal(blocked.statusCode, 200);
    assert.equal(blocked.json().outcome, "blocked");
    assert.equal(upstream.calls.length, 0);
  } finally { await app.close(); }
}));

test("HTTP byte/content/envelope/parser failures are precise and do not echo payloads", () => withTempDb(async file => {
  const { app, dash } = await ready(file, fakeUpstream());
  try {
    const url = "/api/routing/simulate";
    const setupCookie = (await dash({ method: "POST", url: "/api/auth/login", body: { password: "correct horse battery" } })).headers["set-cookie"].split(";")[0];
    const raw = (payload, type = "application/json") => app.getHttpAdapter().getInstance().inject({ method: "POST", url, payload,
      headers: { cookie: setupCookie, "content-type": type } });
    for (const [payload, type, status] of [["{", "application/json", 400], ["", "application/json", 400], ["{}", "text/plain", 415], ["data", "image/png", 415]]) {
      const res = await raw(payload, type);
      assert.deepEqual([res.statusCode, res.json().code], [status, "INVALID_REQUEST"], res.body);
    }
    const encoded = JSON.stringify({ request: hello });
    const exact = encoded + " ".repeat(65536 - Buffer.byteLength(encoded));
    assert.equal((await raw(exact)).statusCode, 200);
    const large = await raw(exact + " ");
    assert.deepEqual([large.statusCode, large.json().code], [413, "INVALID_REQUEST"]);
    for (const body of [{ request: hello, secret: "synthetic-secret" }, { request: hello, tokenSaverOptOut: "synthetic-secret" },
      { request: { model: "openai/gpt-4.1", messages: [{ role: "user", content: [{ type: "synthetic-secret" }] }] } }]) {
      const res = await dash({ method: "POST", url, body });
      assert.equal(res.statusCode, 400, res.body);
      assert.equal(res.body.includes("synthetic-secret"), false, res.body);
    }
  } finally { await app.close(); }
}));
