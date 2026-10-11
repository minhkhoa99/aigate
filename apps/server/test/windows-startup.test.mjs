// SP48 uses a synthetic Startup folder and executable paths; it never touches the Windows user profile.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { PASSWORD, boot, setUp, withTempDb } from "./helpers.mjs";
import { WindowsStartup } from "../dist/modules/settings/infrastructure/windows-startup.js";

const folder = dir => join(dir, "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
const entry = dir => join(folder(dir), "AIGate-startup.vbs");
const run = promisify(execFile);

test("Windows Startup script is explicit, bounded, idempotent and never replaces foreign content", () => withTempDb(async file => {
  const dir = dirname(file), appData = join(dir, "Roaming"), nodePath = join(dir, "node.exe"), serverEntry = join(dir, "main.js"), webIndex = join(dir, "index.html");
  await mkdir(folder(appData), { recursive: true });
  await writeFile(nodePath, "synthetic node"); await writeFile(serverEntry, "synthetic server"); await writeFile(webIndex, "synthetic web");
  const config = { platform: "win32", appData, nodePath, serverEntry, webIndex, secretKeyOverride: false };
  const service = new WindowsStartup(config);
  assert.equal((await new WindowsStartup({ ...config, webIndex: join(dir, "missing.html") }).status()).reason, "BUILD_REQUIRED");
  assert.equal((await new WindowsStartup({ ...config, secretKeyOverride: true }).status()).reason, "SECRET_KEY_OVERRIDE");
  assert.equal((await new WindowsStartup({ ...config, appData: undefined }).status()).reason, "APPDATA_UNAVAILABLE");
  assert.deepEqual(await service.status(), { supported: true, enabled: false, reason: null });
  assert.deepEqual(await service.setEnabled(true), { supported: true, enabled: true, reason: null });
  const script = await readFile(entry(appData), "utf8");
  assert.match(script, /shell\.Run/); assert.match(script, /, 0, False/);
  assert.ok(script.includes(nodePath) && script.includes(serverEntry));
  assert.equal(script.includes(PASSWORD), false);
  await service.setEnabled(true);
  assert.equal(await readFile(entry(appData), "utf8"), script);
  await writeFile(entry(appData), "foreign script");
  assert.deepEqual(await service.status(), { supported: false, enabled: false, reason: "STARTUP_CONFLICT" });
  await assert.rejects(service.setEnabled(true), error => error.code === "STARTUP_CONFLICT");
  await assert.rejects(service.setEnabled(false), error => error.code === "STARTUP_CONFLICT");
  assert.equal(await readFile(entry(appData), "utf8"), "foreign script");
  assert.equal((await new WindowsStartup({ ...config, platform: "linux" }).status()).reason, "WINDOWS_ONLY");
  assert.equal((await new WindowsStartup({ ...config, secretKeyOverride: true }).status()).reason, "STARTUP_CONFLICT");
}));

test("generated Windows script launches the configured Node entry hidden", { skip: process.platform !== "win32" }, () => withTempDb(async file => {
  const dir = dirname(file), appData = join(dir, "Roaming"), marker = join(dir, "launched.txt");
  const serverEntry = join(dir, "synthetic-main.cjs"), webIndex = join(dir, "index.html");
  await mkdir(folder(appData), { recursive: true });
  await writeFile(serverEntry, `require('node:fs').writeFileSync(${JSON.stringify(marker)},'ok')`);
  await writeFile(webIndex, "web");
  await new WindowsStartup({ platform: "win32", appData, nodePath: process.execPath, serverEntry, webIndex, secretKeyOverride: false }).setEnabled(true);
  await run("cscript.exe", ["//nologo", entry(appData)], { windowsHide: true, timeout: 5_000 });
  let launched = false;
  for (let i = 0; i < 30; i++) {
    try { launched = (await readFile(marker, "utf8")) === "ok"; } catch { /* the launched process has not written yet */ }
    if (launched) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(launched, true);
}));

test("startup API requires dashboard authorization and fresh password; disable removes only its own script", () => withTempDb(async file => {
  const dir = dirname(file), appData = join(dir, "Roaming"), nodePath = join(dir, "node.exe"), serverEntry = join(dir, "main.js"), webIndex = join(dir, "index.html");
  await mkdir(folder(appData), { recursive: true });
  await writeFile(nodePath, "node"); await writeFile(serverEntry, "server"); await writeFile(webIndex, "web");
  const startupConfig = { platform: "win32", appData, nodePath, serverEntry, webIndex, secretKeyOverride: false };
  const server = await boot(file, { startupConfig });
  try {
    const { call } = server, path = "/api/settings/startup";
    const cookie = await setUp(call);
    assert.equal((await call({ url: path })).statusCode, 401);
    assert.equal((await call({ method: "PATCH", url: "/api/settings", cookie, body: { requireLogin: false } })).statusCode, 200);
    const localWrong = await call({ method: "POST", url: path, body: { enabled: true, password: "wrong" } });
    assert.deepEqual([localWrong.statusCode, localWrong.json().code], [401, "INVALID_CREDENTIALS"], "local bypass still needs the password");
    const initial = await call({ url: path, cookie });
    assert.deepEqual(initial.json(), { supported: true, enabled: false, reason: null });
    assert.equal(initial.headers["cache-control"], "no-store");
    const invalid = await call({ method: "POST", url: path, cookie, body: { enabled: "yes", password: PASSWORD } });
    assert.deepEqual([invalid.statusCode, invalid.json().code], [400, "STARTUP_INVALID_REQUEST"]);
    const wrong = await call({ method: "POST", url: path, cookie, body: { enabled: true, password: "wrong" } });
    assert.deepEqual([wrong.statusCode, wrong.json().code], [401, "INVALID_CREDENTIALS"]);
    assert.equal((await new WindowsStartup(startupConfig).status()).enabled, false);
    const enabled = await call({ method: "POST", url: path, body: { enabled: true, password: PASSWORD } });
    assert.deepEqual([enabled.statusCode, enabled.json().enabled], [200, true]);
    assert.equal(enabled.headers["cache-control"], "no-store");
    const disabled = await call({ method: "POST", url: path, cookie, body: { enabled: false, password: PASSWORD } });
    assert.deepEqual([disabled.statusCode, disabled.json().enabled], [200, false]);
    assert.equal((await new WindowsStartup(startupConfig).status()).enabled, false);
    await writeFile(entry(appData), "foreign");
    const conflict = await call({ method: "POST", url: path, cookie, body: { enabled: true, password: PASSWORD } });
    assert.deepEqual([conflict.statusCode, conflict.json().code], [409, "STARTUP_CONFLICT"]);
    assert.equal(await readFile(entry(appData), "utf8"), "foreign");
  } finally { await server.app.close(); }
}));
