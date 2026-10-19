import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EngineError, builtinRegistry, createAdapter, StreamRetryAdapter, withRetry } from "@aigate/engine";
import { boot, setUp, sessionCookie, withTempDb } from "./helpers.mjs";
import { fakeUpstream, json, ready, sse, chunk } from "./lane-helpers.mjs";
import { QoderOAuthController } from "../dist/modules/connections/infrastructure/qoder-oauth.controller.js";
import { ConnectionsRepository } from "../dist/modules/connections/infrastructure/connections.repo.js";
import { TokenRefresher } from "../dist/modules/connections/infrastructure/token-refresher.js";
import { fallbackCooldown } from "../dist/modules/routing/infrastructure/chat-lane.js";

const base = "/api/oauth/qoder/attempts";
const account = { id: "qoder-user-1", name: "Fixture user", email: "qoder@example.test" };
const tokens = (extra = {}) => ({ accessToken: "qoder-fixture-access", refreshToken: "qoder-fixture-refresh", expiresIn: 60, data: { userId: account.id, machineId: "machine-1" }, ...extra });
const save = (repo, extra) => repo.saveOAuth({ provider: "qoder", name: "Qoder", tokens: tokens(extra) });
const success = () => sse([chunk({ role: "assistant" }), chunk({ content: "Hello!" }), chunk({}, { finish_reason: "stop" }), "[DONE]"]);
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

async function flow(file, transport) {
  const { app, call } = await boot(file, { transport });
  const session = await setUp(call);
  let cookie = session;
  const own = (request) => call({ ...request, cookie });
  const start = async () => {
    const res = await own({ method: "POST", url: base, body: {} });
    if (res.statusCode === 200 && res.headers["set-cookie"]) cookie = `${session}; ${sessionCookie(res)}`;
    return res;
  };
  return { app, call, own, start, get cookie() { return cookie; } };
}

test("Qoder owned login verifies identity, freezes approval, confirms once and seals tokens", () => withTempDb(async (file) => {
  const upstream = fakeUpstream(json(200, { data: { token: "qoder-fixture-access", refresh_token: "qoder-fixture-refresh", expires_in: 3600 } }), json(200, { data: account }));
  const f = await flow(file, upstream);
  try {
    const start = await f.start(); assert.equal(start.statusCode, 200, start.body);
    assert.match(start.headers["set-cookie"], /HttpOnly; SameSite=Strict/);
    assert.equal(start.headers["cache-control"], "no-store");
    const attempt = start.json();
    assert.equal(new URL(attempt.authUrl).origin, "https://qoder.com");
    assert.ok(!/token|verifier/i.test(start.body));
    const url = `${base}/${attempt.id}`;
    assert.equal((await f.own({ method: "POST", url: `${url}/confirm` })).json().code, "QODER_NOT_APPROVED");
    assert.equal((await f.call({ method: "POST", url: `${url}/poll` })).statusCode, 401);
    const approved = await f.own({ method: "POST", url: `${url}/poll` });
    assert.deepEqual(approved.json().account, account);
    assert.ok(!approved.body.includes("qoder-fixture-access"));
    assert.equal((await f.own({ method: "POST", url: `${url}/poll` })).json().status, "approved");
    const confirmations = await Promise.all([f.own({ method: "POST", url: `${url}/confirm` }), f.own({ method: "POST", url: `${url}/confirm` })]);
    assert.equal(confirmations[0].statusCode, 200, confirmations[0].body);
    assert.deepEqual(confirmations[0].json(), confirmations[1].json());
    const list = (await f.own({ url: "/api/connections" })).json();
    assert.equal(list.length, 1); assert.equal(list[0].testStatus, "untested");
    assert.equal(upstream.calls.length, 2);
    assert.match(upstream.calls[0].request.url, /deviceToken\/poll\?/);
    assert.equal(upstream.calls[1].request.url, "https://openapi.qoder.sh/api/v1/userinfo");
    const bytes = await readFile(file); assert.ok(!bytes.includes(Buffer.from("qoder-fixture-access"))); assert.ok(!bytes.includes(Buffer.from("qoder-fixture-refresh")));
    const repo = f.app.get(ConnectionsRepository);
    const stored = await repo.readKey(list[0].id); assert.equal(stored.oauth.refreshToken, "qoder-fixture-refresh");
    const reconnected = await save(repo, { email: "changed@example.test", expiresIn: undefined });
    assert.equal(reconnected.id, list[0].id, "stable upstream ID matches even when email changes");
    assert.equal(reconnected.expiresAt, null);
  } finally { await f.app.close(); }
}));

test("Qoder attempts enforce owner, session, origin, limits, expiry and cancellation", () => withTempDb(async (file) => {
  const f = await flow(file, fakeUpstream(json(202, {})));
  try {
    const a = (await f.start()).json(); const url = `${base}/${a.id}`;
    assert.equal((await f.own({ method: "POST", url: `${url}/poll`, headers: { origin: "https://foreign.invalid" } })).statusCode, 403);
    assert.equal((await f.own({ method: "POST", url: base, body: { clientId: "bad client" } })).statusCode, 400);
    const other = await f.call({ method: "POST", url: "/api/auth/login", body: { password: "correct horse battery" } });
    const flowCookie = f.cookie.split("; ")[1];
    const foreign = await f.call({ method: "POST", url: `${url}/poll`, cookie: `${sessionCookie(other)}; ${flowCookie}` });
    assert.equal(foreign.json().code, "QODER_ATTEMPT_NOT_FOUND");
    assert.equal((await f.own({ method: "POST", url: `${url}/poll` })).json().status, "pending");
    assert.equal((await f.own({ method: "POST", url: `${url}/poll` })).json().code, "QODER_POLL_TOO_FAST");
    assert.equal((await f.start()).statusCode, 200);
    assert.equal((await f.start()).json().code, "QODER_ATTEMPT_LIMIT");
    const entry = f.app.get(QoderOAuthController).attempts.get(a.id); entry.expiresAt = Date.now() - 1;
    assert.equal((await f.own({ method: "POST", url: `${url}/confirm` })).json().code, "QODER_ATTEMPT_EXPIRED");
    const next = (await f.start()).json();
    assert.equal((await f.own({ method: "DELETE", url: `${base}/${next.id}` })).statusCode, 204);
    assert.equal((await f.own({ method: "POST", url: `${base}/${next.id}/poll` })).statusCode, 404);
    for (const action of ["poll", "exchange", "attempts-invalid"]) assert.equal((await f.own({ method: "POST", url: `/api/oauth/qoder/${action}`, body: {} })).statusCode, 400);
  } finally { await f.app.close(); }
}));

test("Qoder cancellation aborts a pending poll and cannot save a late candidate", () => withTempDb(async (file) => {
  const entered = deferred(); const finish = deferred(); let signal;
  const upstream = fakeUpstream(async (_request, ctx) => { signal = ctx.signal; entered.resolve(); await finish.promise; return json(202, {})(_request, ctx); });
  const f = await flow(file, upstream);
  try {
    const attempt = (await f.start()).json(); const url = `${base}/${attempt.id}`;
    const pending = f.own({ method: "POST", url: `${url}/poll` }); await entered.promise;
    assert.equal((await f.own({ method: "POST", url: `${url}/poll` })).json().code, "QODER_POLL_TOO_FAST");
    assert.equal((await f.own({ method: "DELETE", url })).statusCode, 204);
    assert.equal(signal.aborted, true); finish.resolve();
    assert.notEqual((await pending).statusCode, 200);
    assert.deepEqual((await f.own({ url: "/api/connections" })).json(), []);
  } finally { finish.resolve(); await f.app.close(); }
}));

test("Qoder keyless local dashboards remain owner-bound and globally limited", () => withTempDb(async (file) => {
  const f = await flow(file, fakeUpstream());
  try {
    await f.own({ method: "PATCH", url: "/api/settings", body: { requireLogin: false } });
    const a = await f.call({ method: "POST", url: base, body: {} }); assert.equal(a.statusCode, 200, a.body);
    const cookie = sessionCookie(a); const path = `${base}/${a.json().id}/confirm`;
    assert.equal((await f.call({ method: "POST", url: path })).json().code, "QODER_ATTEMPT_NOT_FOUND");
    assert.equal((await f.call({ method: "POST", url: path, cookie })).json().code, "QODER_NOT_APPROVED");
    for (let i = 1; i < 16; i++) assert.equal((await f.call({ method: "POST", url: base, body: {} })).statusCode, 200);
    assert.equal((await f.call({ method: "POST", url: base, body: {} })).json().code, "QODER_ATTEMPT_LIMIT");
  } finally { await f.app.close(); }
}));

test("Qoder poll ceiling and expired approved credentials cannot save a connection", () => withTempDb(async (file) => {
  const upstream = fakeUpstream(json(200, { token: "fixture-token", expires_in: 3600 }), json(200, account));
  const f = await flow(file, upstream);
  try {
    const a = (await f.start()).json(); const controller = f.app.get(QoderOAuthController);
    controller.attempts.get(a.id).polls = 150;
    assert.equal((await f.own({ method: "POST", url: `${base}/${a.id}/poll` })).json().code, "QODER_ATTEMPT_EXPIRED");
    const b = (await f.start()).json();
    assert.equal((await f.own({ method: "POST", url: `${base}/${b.id}/poll` })).json().status, "approved");
    controller.attempts.get(b.id).tokenExpiresAt = Date.now() - 1;
    assert.equal((await f.own({ method: "POST", url: `${base}/${b.id}/confirm` })).json().code, "QODER_AUTH_FAILED");
    assert.deepEqual((await f.own({ url: "/api/connections" })).json(), []);
    assert.equal(upstream.calls.length, 2);
  } finally { await f.app.close(); }
}));

test("Qoder mismatch and malformed responses are terminal and disclose no upstream secrets", () => withTempDb(async (file) => {
  const upstream = fakeUpstream(json(200, { data: { token: "qoder-fixture-access", user_id: "other-user" } }), json(200, { data: account }));
  const f = await flow(file, upstream);
  try {
    const a = (await f.start()).json(); const url = `${base}/${a.id}/poll`;
    const failed = await f.own({ method: "POST", url }); assert.equal(failed.json().code, "QODER_ACCOUNT_MISMATCH");
    assert.equal((await f.own({ method: "POST", url })).json().code, "QODER_AUTH_FAILED");
    assert.equal(upstream.calls.length, 2);
    assert.deepEqual((await f.own({ url: "/api/connections" })).json(), []);
  } finally { await f.app.close(); }
}));

test("Qoder refresh is single-flight, waiter cancellation is independent, and absent expiry becomes unknown", () => withTempDb(async (file) => {
  const entered = deferred(); const finish = deferred();
  const upstream = fakeUpstream(async (request, ctx) => { entered.resolve(); await finish.promise; return json(200, { token: "rotated-access", refresh_token: "rotated-refresh" })(request, ctx); });
  const { app } = await boot(file, { transport: upstream });
  try {
    const repo = app.get(ConnectionsRepository); const refresher = app.get(TokenRefresher);
    const view = await save(repo); const stored = await repo.activeCredentialById("qoder", view.id);
    const abort = new AbortController(); const a = refresher.fresh("qoder", stored, abort.signal); const b = refresher.fresh("qoder", stored);
    const cancelled = assert.rejects(a); await entered.promise; abort.abort(); await cancelled; finish.resolve();
    assert.equal((await b).apiKey, "rotated-access");
    assert.equal(upstream.calls.length, 1); assert.equal(upstream.calls[0].request.noReplay, true);
    assert.equal((await repo.get(view.id)).expiresAt, null);
    const fresh = await repo.activeCredentialById("qoder", view.id); assert.equal(fresh.oauth.refreshToken, "rotated-refresh");
  } finally { finish.resolve(); await app.close(); }
}));

for (const change of ["reconnect", "disable", "delete"]) test(`Qoder refresh cannot overwrite a concurrent ${change}`, () => withTempDb(async (file) => {
  const entered = deferred(); const finish = deferred();
  const upstream = fakeUpstream(async (request, ctx) => { entered.resolve(); await finish.promise; return json(200, { token: "stale-rotation", refresh_token: "stale-refresh" })(request, ctx); });
  const { app } = await boot(file, { transport: upstream });
  try {
    const repo = app.get(ConnectionsRepository); const view = await save(repo); const stored = await repo.activeCredentialById("qoder", view.id);
    const refresh = app.get(TokenRefresher).fresh("qoder", stored); const rejected = assert.rejects(refresh); await entered.promise;
    if (change === "reconnect") await save(repo, { accessToken: "new-login-access", refreshToken: "new-login-refresh", expiresIn: 3600 });
    if (change === "disable") await repo.update(view.id, { isActive: false });
    if (change === "delete") await repo.remove(view.id);
    finish.resolve(); await rejected;
    const current = await repo.readKey(view.id);
    if (change === "delete") assert.equal(current, undefined);
    else assert.equal(current.apiKey, change === "reconnect" ? "new-login-access" : stored.apiKey);
  } finally { finish.resolve(); await app.close(); }
}));

test("Qoder uncertain rotating refresh is never repeated by a later request or background refresh", () => withTempDb(async (file) => {
  const upstream = fakeUpstream(new Error("sensitive upstream transport detail"));
  const { app } = await boot(file, { transport: upstream });
  try {
    const repo = app.get(ConnectionsRepository); const view = await save(repo); const stored = await repo.activeCredentialById("qoder", view.id); const refresher = app.get(TokenRefresher);
    await assert.rejects(refresher.fresh("qoder", stored), (error) => !error.message.includes("sensitive"));
    await refresher.fresh("qoder", stored); await refresher.background();
    assert.equal(upstream.calls.length, 1);
    assert.equal((await repo.readKey(view.id)).oauth.refreshToken, undefined);
    assert.equal(await refresher.reactive("qoder", stored, 0), undefined);
  } finally { await app.close(); }
}));

for (const status of [401, 429, 503]) test(`Qoder HTTP ${status} cannot refresh/replay, rotate accounts or fall through a combo`, () => withTempDb(async (file) => {
  const upstream = fakeUpstream(json(status, { error: { message: "raw-sensitive-message" } }));
  const { app, dash, chat } = await ready(file, upstream);
  try {
    const repo = app.get(ConnectionsRepository); await save(repo, { expiresIn: 3600 });
    await save(repo, { accessToken: "other-access", data: { userId: "user-2", machineId: "machine-2" }, expiresIn: 3600 });
    assert.equal((await dash({ method: "POST", url: "/api/combos", body: { name: "qoder-fallback", models: ["qoder/ultimate", "openai/gpt-4.1"] } })).statusCode, 201);
    const result = await chat({ model: "qoder-fallback", messages: [{ role: "user", content: "hi" }] });
    assert.ok(result.statusCode >= 400, result.body); assert.ok(!result.body.includes("raw-sensitive-message"));
    assert.equal(upstream.calls.length, 1); assert.equal(upstream.calls[0].request.noReplay, true);
  } finally { await app.close(); }
}));

test("Qoder account test and catalog failure are distinct; text succeeds through the real factory", () => withTempDb(async (file) => {
  const upstream = fakeUpstream(json(200, { data: account }), json(403, { code: "101", message: "Signature invalid" }), success());
  const { app, dash, chat } = await ready(file, upstream);
  try {
    const created = await dash({ method: "POST", url: "/api/connections", body: { provider: "qoder", apiKey: "qoder-fixture-access" } }); assert.equal(created.statusCode, 201);
    const id = created.json().id;
    assert.equal((await dash({ method: "POST", url: `/api/connections/${id}/test` })).json().testStatus, "active");
    assert.equal((await dash({ url: `/api/connections/${id}/models` })).json().code, "QODER_SIGNATURE_REQUIRED");
    const response = await chat({ model: "qoder/ultimate", messages: [{ role: "user", content: "hi" }] });
    assert.equal(response.statusCode, 200, response.body); assert.equal(response.json().choices[0].message.content, "Hello!");
    assert.equal(upstream.calls.length, 3);
    assert.match(upstream.calls[2].request.url, /api2-v2\.qoder\.sh\/model\/v1\/chat\/completions$/);
  } finally { await app.close(); }
}));

test("noReplay also stops the shared retry helper and stream retry decorator", async () => {
  let calls = 0; const error = new EngineError("RATE_LIMIT", "Qoder error", { noReplay: true });
  const ctx = { signal: new AbortController().signal, requestId: "no-replay" };
  await assert.rejects(withRetry(async () => { calls++; throw error; }, { signal: ctx.signal, maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0, shouldRetry: () => true }), (e) => e === error);
  assert.equal(calls, 1); assert.equal(fallbackCooldown(error), undefined);
  const upstream = fakeUpstream(json(429, {}));
  const adapter = new StreamRetryAdapter(createAdapter(builtinRegistry.provider("qoder"), upstream), 0);
  await assert.rejects(adapter.execute({ model: "ultimate", messages: [], stream: false }, { kind: "api-key", apiKey: "fixture-token" }, ctx));
  assert.equal(upstream.calls.length, 1);
});
