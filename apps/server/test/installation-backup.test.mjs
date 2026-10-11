// SP47: all credentials and installation files here are synthetic and live in a temporary directory.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PASSWORD, boot, setUp, withTempDb } from "./helpers.mjs";
import { applyPendingRestore, encryptBackup, stageRestore } from "../dist/modules/settings/infrastructure/installation-backup.js";

const passphrase = "synthetic backup passphrase 47";
const post = (call, url, cookie, body) => call({ method: "POST", url: `/api/settings/backup/${url}`, cookie, body });

test("encrypted installation backup requires fresh auth, rejects tampering, and restores only after restart", () => withTempDb(async file => {
  const registry = join(dirname(file), "mcp-servers.json");
  await writeFile(registry, "[]");
  const first = await boot(file);
  let document, oldSession;
  try {
    const { call } = first;
    oldSession = await setUp(call);
    const body = { password: PASSWORD, passphrase };
    assert.equal((await post(call, "export", undefined, body)).statusCode, 401);
    assert.equal((await post(call, "export", oldSession, { ...body, password: "wrong" })).statusCode, 401);
    const configured = await call({ method: "PATCH", url: "/api/settings", cookie: oldSession, body: {
      authMode: "oidc", oidcIssuerUrl: "https://idp.example", oidcClientId: "synthetic-client", oidcClientSecret: "synthetic-secret",
    } });
    assert.equal(configured.statusCode, 200, configured.body);
    const exported = await post(call, "export", oldSession, body);
    assert.equal(exported.statusCode, 200, exported.body);
    assert.equal(exported.headers["cache-control"], "no-store");
    document = exported.json();
    assert.equal(JSON.stringify(document).includes("synthetic-secret"), false);
    assert.equal(JSON.stringify(document).includes("scrypt$"), false);
    assert.equal((await post(call, "preview", oldSession, { ...body, document, passphrase: "wrong passphrase value" })).json().code, "BACKUP_INVALID");
    const changed = { ...document, data: document.data.slice(0, -2) + "AA" };
    assert.equal((await post(call, "preview", oldSession, { ...body, document: changed })).json().code, "BACKUP_INVALID");
    const partial = await encryptBackup({ database: Buffer.from("SQLite format 3\0" + "x".repeat(4096)), key: Buffer.alloc(32, 1), files: {}, createdAt: new Date().toISOString() }, passphrase);
    assert.equal((await post(call, "preview", oldSession, { ...body, document: partial })).json().code, "BACKUP_INVALID", "a partial image cannot be migrated into an accepted backup");
    const oversizedBody = await post(call, "preview", oldSession, { ...body, document: { ...document, data: "a".repeat(1_100_000) } });
    assert.equal(oversizedBody.statusCode, 400, "preview accepts a bounded archive above Fastify's default 1 MiB body limit");

    await call({ method: "PATCH", url: "/api/settings", cookie: oldSession, body: { requireApiKey: false } });
    await writeFile(registry, '[{"synthetic":"changed"}]');
    const preview = await post(call, "preview", oldSession, { ...body, document });
    assert.equal(preview.statusCode, 200, preview.body);
    assert.deepEqual(preview.json().files, ["mcp-servers.json"]);
    const expectedVersion = preview.json().expectedVersion;
    await call({ method: "PATCH", url: "/api/settings", cookie: oldSession, body: { comboStickyLimit: 2 } });
    const stale = await post(call, "apply", oldSession, { ...body, document, expectedVersion, confirmation: "RESTORE" });
    assert.deepEqual([stale.statusCode, stale.json().code], [409, "BACKUP_CHANGED"]);
    const fresh = await post(call, "preview", oldSession, { ...body, document });
    const staged = await post(call, "apply", oldSession, { ...body, document, expectedVersion: fresh.json().expectedVersion, confirmation: "RESTORE" });
    assert.equal(staged.statusCode, 200, staged.body);
    assert.equal(staged.json().restartRequired, true);
    assert.equal((await call({ url: "/api/settings", cookie: oldSession })).json().requireApiKey, false, "stage does not mutate the live database");
    const pending = await post(call, "apply", oldSession, { ...body, document, expectedVersion: fresh.json().expectedVersion, confirmation: "RESTORE" });
    assert.deepEqual([pending.statusCode, pending.json().code], [409, "BACKUP_PENDING"]);
  } finally { await first.app.close(); }

  const restored = await boot(file);
  try {
    const status = await restored.call({ url: "/api/auth/status", cookie: oldSession });
    assert.equal(status.json().authenticated, false, "restored sessions must be revoked");
    const login = await restored.call({ method: "POST", url: "/api/auth/login", body: { password: PASSWORD } });
    assert.equal(login.statusCode, 200, login.body);
    const cookie = login.headers["set-cookie"].split(";")[0];
    const settings = (await restored.call({ url: "/api/settings", cookie })).json();
    assert.equal(settings.requireApiKey, true);
    assert.equal(settings.comboStickyLimit, 1);
    assert.equal(settings.oidcConfigured, true, "restored key opens the sealed OIDC secret");
    assert.equal(await readFile(registry, "utf8"), "[]");
  } finally { await restored.app.close(); }
}));

test("restore staging rolls back failed and interrupted replacements before opening SQLite", () => withTempDb(async file => {
  const dir = dirname(file), key = join(dir, "secret.key");
  await writeFile(file, "old database");
  await writeFile(key, "old key");
  const payload = { database: Buffer.from("new database"), key: Buffer.alloc(32, 7), files: {}, createdAt: new Date().toISOString() };
  await stageRestore(dir, file, payload);
  await assert.rejects(applyPendingRestore(dir, file, Buffer.alloc(32, 8).toString("base64")), error => error.code === "BACKUP_KEY_CONFLICT");
  assert.equal(await readFile(file, "utf8"), "old database");
  const pending = await applyPendingRestore(dir, file);
  assert.ok(pending);
  assert.equal(await readFile(file, "utf8"), "new database");
  await pending.rollback();
  assert.equal(await readFile(file, "utf8"), "old database");
  assert.equal(await readFile(key, "utf8"), "old key");

  await stageRestore(dir, file, payload);
  await applyPendingRestore(dir, file);
  const recovered = await applyPendingRestore(dir, file);
  assert.equal(recovered, undefined, "the next startup rolls back an interrupted apply");
  assert.equal(await readFile(file, "utf8"), "old database");
  assert.equal(await readFile(key, "utf8"), "old key");
}));
