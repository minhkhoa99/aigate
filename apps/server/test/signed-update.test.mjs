import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { boot, setUp, withTempDb } from "./helpers.mjs";
import { compareVersion, SignedUpdate } from "../dist/modules/settings/infrastructure/signed-update.js";

const URL = "https://releases.example.test/aigate-0.1.0-dev.1.manifest.json";
const body = value => new ReadableStream({ start(controller) { controller.enqueue(Buffer.from(value)); controller.close(); } });
function signed(version, privateKey) {
  const unsigned = { format: "aigate-release", version, artifact: `aigate-${version}.tar.gz`, bytes: 1234, sha256: "a".repeat(64) };
  return { ...unsigned, signature: sign(null, Buffer.from(JSON.stringify(unsigned)), privateKey).toString("base64url") };
}

test("full SemVer ordering includes prerelease and rejects malformed numeric identifiers", () => {
  assert.equal(compareVersion("0.1.0-dev.1", "0.1.0-dev.0"), 1);
  assert.equal(compareVersion("0.1.0", "0.1.0-dev.99"), 1);
  assert.equal(compareVersion("0.1.0-alpha.2", "0.1.0-alpha.10"), -1);
  assert.equal(compareVersion("0.1.0", "0.1.1"), -1);
  assert.throws(() => compareVersion("0.1.0-dev.01", "0.1.0"), /invalid/);
});

test("signed update API is guarded, explicit, bounded and retains the last good check", () => withTempDb(async file => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyFile = join(dirname(file), "release-key.pem");
  await writeFile(publicKeyFile, publicKey.export({ format: "pem", type: "spki" }));
  let answer = { status: 200, body: JSON.stringify(signed("0.1.0-dev.1", privateKey)) };
  const requests = [];
  const transport = { send: async (request, ctx) => {
    requests.push({ request, signal: ctx.signal });
    if (answer.hang) await new Promise((_resolve, reject) => {
      if (ctx.signal.aborted) reject(ctx.signal.reason);
      else ctx.signal.addEventListener("abort", () => reject(ctx.signal.reason), { once: true });
    });
    return { status: answer.status, headers: {}, body: body(answer.body) };
  } };
  const { app, call } = await boot(file, { transport, updateConfig: { manifestUrl: URL, publicKeyFile } });
  try {
    const path = "/api/settings/update";
    assert.equal((await call({ url: path })).statusCode, 401);
    assert.equal((await call({ method: "POST", url: `${path}/check` })).statusCode, 401);
    const cookie = await setUp(call);
    const status = (await call({ url: path, cookie })).json();
    assert.deepEqual([status.currentVersion, status.channel, status.lastCheck, requests.length], ["0.1.0-dev.0", "ready", null, 0]);
    const invalidBody = await call({ method: "POST", url: `${path}/check`, cookie, body: {} });
    assert.deepEqual([invalidBody.statusCode, invalidBody.json().code, requests.length], [400, "UPDATE_INVALID_REQUEST", 0]);
    const good = await call({ method: "POST", url: `${path}/check`, cookie });
    assert.equal(good.statusCode, 200, good.body);
    assert.equal(good.json().lastCheck.latestVersion, "0.1.0-dev.1");
    assert.equal(good.json().lastCheck.hasUpdate, true);
    assert.equal(good.json().checking, false);
    assert.deepEqual([requests.length, requests[0].request.url, requests[0].request.timeoutMs], [1, URL, 4000]);
    assert.equal(requests[0].signal.aborted, false);
    answer = { status: 200, body: JSON.stringify({ ...signed("0.1.0-dev.2", privateKey), bytes: 99 }) };
    const tampered = await call({ method: "POST", url: `${path}/check`, cookie });
    assert.deepEqual([tampered.statusCode, tampered.json().code], [502, "UPDATE_MANIFEST_INVALID"]);
    assert.equal((await call({ url: path, cookie })).json().lastCheck.latestVersion, "0.1.0-dev.1");
    answer = { status: 200, body: "x".repeat(4097) };
    assert.equal((await call({ method: "POST", url: `${path}/check`, cookie })).json().code, "UPDATE_MANIFEST_INVALID");
    answer = { status: 302, body: "redirect" };
    assert.equal((await call({ method: "POST", url: `${path}/check`, cookie })).json().code, "UPDATE_CHECK_FAILED");
    answer = { status: 200, body: JSON.stringify(signed("0.1.0-dev.0", privateKey)) };
    assert.equal((await call({ method: "POST", url: `${path}/check`, cookie })).json().lastCheck.hasUpdate, false);
    answer = { status: 200, body: JSON.stringify(signed("0.0.9", privateKey)) };
    assert.equal((await call({ method: "POST", url: `${path}/check`, cookie })).json().lastCheck.hasUpdate, false);
    answer = { hang: true };
    const expired = await call({ method: "POST", url: `${path}/check`, cookie });
    assert.deepEqual([expired.statusCode, expired.json().code], [502, "UPDATE_CHECK_FAILED"]);
    assert.equal(requests.at(-1).signal.aborted, true);
    assert.equal((await call({ url: path, cookie })).json().lastCheck.latestVersion, "0.0.9");
    assert.equal(requests.length, 7, "one configured manifest request per explicit check and zero archive requests");
  } finally { await app.close(); }
}));

test("unconfigured and invalid channel never contact the network", () => withTempDb(async file => {
  let calls = 0;
  const transport = { send: async () => { calls++; throw new Error("unexpected network"); } };
  const unconfigured = await boot(file, { transport, updateConfig: {} });
  try {
    const cookie = await setUp(unconfigured.call);
    assert.equal((await unconfigured.call({ url: "/api/settings/update", cookie })).json().channel, "unconfigured");
    const denied = await unconfigured.call({ method: "POST", url: "/api/settings/update/check", cookie });
    assert.deepEqual([denied.statusCode, denied.json().code], [409, "UPDATE_CHANNEL_UNCONFIGURED"]);
  } finally { await unconfigured.app.close(); }
  const invalid = await boot(file, { transport, updateConfig: { manifestUrl: "http://localhost/release.manifest.json", publicKeyFile: "relative.pem" } });
  try {
    const cookie = await (async () => {
      const login = await invalid.call({ method: "POST", url: "/api/auth/login", body: { password: "correct horse battery" } });
      return login.headers["set-cookie"].split(";")[0];
    })();
    assert.equal((await invalid.call({ url: "/api/settings/update", cookie })).json().channel, "invalid");
    assert.equal((await invalid.call({ method: "POST", url: "/api/settings/update/check", cookie })).json().code, "UPDATE_CHANNEL_INVALID");
    assert.equal(calls, 0);
  } finally { await invalid.app.close(); }
}));

test("one in-flight check owns cancellation and releases its slot", () => withTempDb(async file => {
  const { publicKey } = generateKeyPairSync("ed25519");
  const publicKeyFile = join(dirname(file), "release-key.pem");
  await writeFile(publicKeyFile, publicKey.export({ format: "pem", type: "spki" }));
  let started;
  const startedPromise = new Promise(resolve => { started = resolve; });
  const transport = { send: async (_request, ctx) => {
    started();
    return new Promise((_resolve, reject) => ctx.signal.addEventListener("abort", () => reject(ctx.signal.reason), { once: true }));
  } };
  const updates = new SignedUpdate({ manifestUrl: URL, publicKeyFile }, transport);
  const controller = new AbortController();
  const pending = updates.check(controller.signal);
  await startedPromise;
  await assert.rejects(updates.check(AbortSignal.timeout(1000)), error => error.code === "UPDATE_BUSY");
  controller.abort();
  await assert.rejects(pending, error => error.code === "UPDATE_CHECK_FAILED");
  assert.equal((await updates.status()).checking, false);
  assert.equal((await updates.status()).lastCheck, null);
}));

test("a stalled manifest body is cancelled when the caller aborts", () => withTempDb(async file => {
  const { publicKey } = generateKeyPairSync("ed25519");
  const publicKeyFile = join(dirname(file), "release-key.pem");
  await writeFile(publicKeyFile, publicKey.export({ format: "pem", type: "spki" }));
  let cancelled = false, started;
  const entered = new Promise(resolve => { started = resolve; });
  const transport = { send: async () => ({ status: 200, headers: {}, body: new ReadableStream({
    start() { started(); }, cancel() { cancelled = true; },
  }) }) };
  const updates = new SignedUpdate({ manifestUrl: URL, publicKeyFile }, transport);
  const controller = new AbortController();
  const pending = updates.check(controller.signal);
  await entered;
  controller.abort();
  await assert.rejects(pending, error => error.code === "UPDATE_CHECK_FAILED");
  assert.equal(cancelled, true);
  assert.equal((await updates.status()).checking, false);
}));
