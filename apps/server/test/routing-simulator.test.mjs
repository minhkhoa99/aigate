import { test } from "node:test";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { withTempDb } from "./helpers.mjs";
import { fakeUpstream, ready, hello } from "./lane-helpers.mjs";
import { RoutingSimulator } from "../dist/modules/routing/infrastructure/routing-simulator.js";

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

test("simulation deadline returns sanitized 504 and a departed client cancels local inspection", () => withTempDb(async file => {
  const { app, dash } = await ready(file, fakeUpstream());
  const planner = app.get(RoutingSimulator), original = planner.explain;
  try {
    planner.explain = (_input, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
    const timeout = await dash({ method: "POST", url: "/api/routing/simulate", body: { request: hello } });
    assert.deepEqual([timeout.statusCode, timeout.json().code, timeout.json().timeoutSeconds], [504, "TIMEOUT", 5]);
    assert.equal(timeout.headers["cache-control"], "no-store");

    let started;
    const entered = new Promise(resolve => { started = resolve; });
    let cancelled;
    const left = new Promise(resolve => { cancelled = resolve; });
    planner.explain = (_input, signal) => new Promise((_resolve, reject) => {
      started();
      signal.addEventListener("abort", () => { cancelled(); reject(signal.reason); }, { once: true });
    });
    await app.listen(0, "127.0.0.1");
    const port = app.getHttpServer().address().port;
    const login = await dash({ method: "POST", url: "/api/auth/login", body: { password: "correct horse battery" } });
    const cookie = login.headers["set-cookie"].split(";")[0];
    const req = httpRequest({ host: "127.0.0.1", port, method: "POST", path: "/api/routing/simulate",
      headers: { cookie, "content-type": "application/json" } });
    req.on("error", () => undefined);
    req.end(JSON.stringify({ request: hello }));
    await entered;
    req.destroy();
    await Promise.race([left, new Promise((_resolve, reject) => setTimeout(() => reject(new Error("client abort was not propagated")), 1000))]);
  } finally { planner.explain = original; await app.close(); }
}));
