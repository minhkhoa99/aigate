// Contract: docs/contracts/identity-apikeys.md
import { test } from "node:test";
import assert from "node:assert/strict";
import { LoginLimiter } from "../dist/modules/identity/domain/login-limiter.js";
import { isLocalRequest } from "../dist/modules/identity/domain/local-request.js";
import { boot, PASSWORD, sessionCookie, setUp, withTempDb } from "./helpers.mjs";

const REMOTE = "192.168.1.20";

async function session(run) {
  await withTempDb(async (file) => {
    const { app, call } = await boot(file);
    try {
      await run(call, file);
    } finally {
      await app.close();
    }
  });
}

test("a fresh install reports that setup is required and nobody is signed in", () =>
  session(async (call) => {
    const res = await call({ url: "/api/auth/status" });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { setupRequired: true, authenticated: false, requireLogin: true });
    assert.equal(res.headers["cache-control"], "no-store");
  }));

test("the first password is set once, from this machine only", () =>
  session(async (call) => {
    const attempt = (extra) => call({ method: "POST", url: "/api/auth/setup", body: { password: PASSWORD }, ...extra });
    assert.equal((await attempt({ remoteAddress: REMOTE })).json().code, "NOT_LOCAL");
    assert.equal((await attempt({ headers: { host: "evil.example" } })).statusCode, 403, "DNS rebinding: loopback socket, foreign Host");
    assert.equal((await attempt({ headers: { origin: "https://evil.example" } })).statusCode, 403, "foreign Origin");
    assert.equal((await call({ method: "POST", url: "/api/auth/setup", body: { password: "short" } })).statusCode, 400);

    const res = await attempt({});
    assert.equal(res.statusCode, 200);
    const cookie = res.headers["set-cookie"];
    assert.match(cookie, /^aigate_session=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=86400$/);
    assert.equal((await attempt({})).json().code, "ALREADY_SET_UP");
  }));

test("every /api route needs a session unless it is public", () =>
  session(async (call) => {
    const cookie = await setUp(call);
    const denied = await call({ url: "/api/settings" });
    assert.equal(denied.statusCode, 401);
    assert.equal(denied.json().code, "UNAUTHENTICATED");
    assert.equal((await call({ url: "/api/keys", cookie: "aigate_session=not-a-real-token" })).statusCode, 401);
    assert.equal((await call({ url: "/api/settings", cookie })).statusCode, 200);
    assert.equal((await call({ url: "/api/settings", cookie, remoteAddress: REMOTE })).statusCode, 200, "a session works remotely");
    assert.equal((await call({ url: "/health" })).statusCode, 200);
    assert.equal((await call({ url: "/api/auth/status", cookie })).json().authenticated, true);
  }));

test("login checks the password and locks the client after five failures", () =>
  session(async (call) => {
    const login = (password) => call({ method: "POST", url: "/api/auth/login", body: { password } });
    assert.equal((await login(PASSWORD)).json().code, "SETUP_REQUIRED");
    await setUp(call);

    const ok = await login(PASSWORD);
    assert.equal(ok.statusCode, 200);
    assert.ok(sessionCookie(ok));
    const wrong = await login("wrong password");
    assert.equal(wrong.statusCode, 401);
    assert.deepEqual([wrong.json().code, wrong.json().remainingBeforeLock], ["INVALID_CREDENTIALS", 4]);
    for (let i = 0; i < 3; i++) assert.equal((await login("wrong password")).statusCode, 401);
    const locked = await login("wrong password");
    assert.equal(locked.statusCode, 429);
    assert.equal(locked.headers["retry-after"], "30");
    assert.equal(locked.json().code, "RATE_LIMITED");
    assert.equal((await login(PASSWORD)).statusCode, 429, "even the right password waits out the lock");
    assert.equal((await call({ method: "POST", url: "/api/auth/login", body: { password: "x".repeat(257) } })).statusCode, 429);
  }));

test("logout and password changes revoke sessions", () =>
  session(async (call) => {
    const first = await setUp(call);
    const second = sessionCookie(await call({ method: "POST", url: "/api/auth/login", body: { password: PASSWORD } }));

    const logout = await call({ method: "POST", url: "/api/auth/logout", cookie: first });
    assert.match(logout.headers["set-cookie"], /^aigate_session=; .*Max-Age=0/);
    assert.equal((await call({ url: "/api/settings", cookie: first })).statusCode, 401, "logged-out session is gone");
    assert.equal((await call({ url: "/api/settings", cookie: second })).statusCode, 200);

    const change = (body) => call({ method: "POST", url: "/api/auth/password", cookie: second, body });
    assert.equal((await change({ currentPassword: "wrong password", newPassword: "another horse" })).statusCode, 401);
    assert.equal((await change({ currentPassword: PASSWORD, newPassword: "short" })).statusCode, 400);
    const changed = await change({ currentPassword: PASSWORD, newPassword: "another horse battery" });
    assert.equal(changed.statusCode, 200);
    const fresh = sessionCookie(changed);
    assert.equal((await call({ url: "/api/settings", cookie: second })).statusCode, 401, "old sessions are revoked");
    assert.equal((await call({ url: "/api/settings", cookie: fresh })).statusCode, 200, "the caller is signed back in");
    assert.equal((await call({ method: "POST", url: "/api/auth/login", body: { password: PASSWORD } })).statusCode, 401);
    assert.equal((await call({ method: "POST", url: "/api/auth/login", body: { password: "another horse battery" } })).statusCode, 200);
    assert.equal((await call({ method: "POST", url: "/api/auth/password", body: { currentPassword: "a", newPassword: "bbbbbbbb" } })).statusCode, 401, "needs a session");
  }));

test("only JSON bodies are parsed, so cross-site HTML forms cannot drive the API", () =>
  session(async (call) => {
    const form = await call({ method: "POST", url: "/api/auth/login", headers: { "content-type": "application/x-www-form-urlencoded" }, body: undefined });
    const urlencoded = await call({ method: "POST", url: "/api/auth/setup", headers: { "content-type": "application/x-www-form-urlencoded" } });
    assert.equal(urlencoded.statusCode, 415);
    assert.equal(form.statusCode, 415);
    const plain = await call({ method: "POST", url: "/api/auth/setup", headers: { "content-type": "text/plain" } });
    assert.equal(plain.statusCode, 400, "a text/plain form body is a string, which no handler accepts");
    assert.equal((await call({ url: "/api/auth/status" })).json().setupRequired, true);
  }));

test("at most 20 sessions survive, newest first", () =>
  session(async (call) => {
    const oldest = await setUp(call);
    const cookies = [];
    for (let i = 0; i < 20; i++) cookies.push(sessionCookie(await call({ method: "POST", url: "/api/auth/login", body: { password: PASSWORD } })));
    assert.equal((await call({ url: "/api/settings", cookie: oldest })).statusCode, 401, "the 21st session pushed out the first");
    assert.equal((await call({ url: "/api/settings", cookie: cookies[0] })).statusCode, 200);
  }));

test("requireLogin=false exempts local clients only", () =>
  session(async (call) => {
    const cookie = await setUp(call);
    assert.equal((await call({ method: "PATCH", url: "/api/settings", cookie, body: { requireLogin: false } })).statusCode, 200);
    assert.equal((await call({ url: "/api/settings" })).statusCode, 200, "local client, no session");
    assert.equal((await call({ url: "/api/settings", remoteAddress: REMOTE })).statusCode, 401, "remote client still signs in");
    assert.equal((await call({ url: "/api/settings", headers: { host: "evil.example" } })).statusCode, 401, "DNS rebinding");
  }));

test("AIGATE_INITIAL_PASSWORD provisions the first password and AIGATE_RESET_PASSWORD clears it", () =>
  withTempDb(async (file) => {
    process.env.AIGATE_INITIAL_PASSWORD = PASSWORD;
    try {
      const { app, call } = await boot(file);
      assert.equal((await call({ url: "/api/auth/status" })).json().setupRequired, false);
      assert.equal((await call({ method: "POST", url: "/api/auth/login", body: { password: PASSWORD } })).statusCode, 200);
      await app.close();
    } finally {
      delete process.env.AIGATE_INITIAL_PASSWORD;
    }
    process.env.AIGATE_RESET_PASSWORD = "true";
    try {
      const { app, call } = await boot(file);
      assert.equal((await call({ url: "/api/auth/status" })).json().setupRequired, true);
      await app.close();
    } finally {
      delete process.env.AIGATE_RESET_PASSWORD;
    }
  }));

test("the lockout follows 30s, 2m steps, resets after an hour, and stays bounded", () => {
  let now = 0;
  const limiter = new LoginLimiter(() => now);
  const failTimes = (client, times) => { for (let i = 0; i < times; i++) limiter.fail(client); };
  failTimes("a", 5);
  assert.deepEqual(limiter.check("a"), { locked: true, retryAfterSeconds: 30 });
  now += 30_000;
  assert.deepEqual(limiter.check("a"), { locked: false });
  failTimes("a", 5);
  assert.deepEqual(limiter.check("a"), { locked: true, retryAfterSeconds: 120 });
  now += 60 * 60_000 + 1;
  failTimes("a", 4);
  assert.deepEqual(limiter.check("a"), { locked: false }, "an hour without failures starts over");

  failTimes("b", 5);
  for (let i = 0; i < 10_000; i++) limiter.fail(`client-${i}`);
  assert.deepEqual(limiter.check("b"), { locked: false }, "the oldest client is evicted at the cap");
});

test("only loopback sockets with a local Host and Origin count as local", () => {
  const cases = [
    [{ ip: "127.0.0.1", host: "localhost:20200", origin: undefined }, true],
    [{ ip: "::1", host: "[::1]:20200", origin: "http://[::1]:20200" }, true],
    [{ ip: "::ffff:127.0.0.1", host: "127.0.0.1", origin: "http://localhost:5173" }, true],
    [{ ip: "10.0.0.5", host: "localhost", origin: undefined }, false],
    [{ ip: "127.0.0.1", host: "attacker.example:20200", origin: undefined }, false],
    [{ ip: "127.0.0.1", host: "localhost", origin: "https://attacker.example" }, false],
    [{ ip: "127.0.0.1", host: undefined, origin: undefined }, false],
    [{ ip: "127.0.0.1", host: "localhost", origin: "null" }, false],
  ];
  for (const [input, expected] of cases) assert.equal(isLocalRequest(input), expected, JSON.stringify(input));
});

test("a stored hash with unexpected scrypt parameters never verifies", async () => {
  const { hashPassword, verifyPassword } = await import("../dist/modules/identity/infrastructure/password-hasher.js");
  const stored = await hashPassword(PASSWORD);
  assert.equal(await verifyPassword(PASSWORD, stored), true);
  assert.equal(await verifyPassword(PASSWORD, stored.replace("$32768$", "$1048576$")), false);
  assert.equal(await verifyPassword(PASSWORD, "bcrypt$whatever"), false);
});
