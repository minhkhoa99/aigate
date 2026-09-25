// Contract: docs/contracts/connections.md, "Secret storage".
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AesGcmCipher, loadSecretKey, SecretUnreadableError } from "../dist/secret-cipher.js";

const cipher = new AesGcmCipher(randomBytes(32));

test("sealed values open only with the same key and context", () => {
  const sealed = cipher.seal("sk-plaintext", "provider_connections:a:api_key");
  assert.match(sealed, /^v1\.[A-Za-z0-9_-]+$/);
  assert.ok(!sealed.includes("sk-plaintext"));
  assert.notEqual(sealed, cipher.seal("sk-plaintext", "provider_connections:a:api_key"), "a fresh IV each time");
  assert.equal(cipher.open(sealed, "provider_connections:a:api_key"), "sk-plaintext");
  assert.throws(() => cipher.open(sealed, "provider_connections:b:api_key"), SecretUnreadableError, "copied into another row");
  assert.throws(() => new AesGcmCipher(randomBytes(32)).open(sealed, "provider_connections:a:api_key"), SecretUnreadableError);
  const tampered = sealed.slice(0, -2) + (sealed.endsWith("A") ? "BB" : "AA");
  assert.throws(() => cipher.open(tampered, "provider_connections:a:api_key"), SecretUnreadableError);
  for (const junk of ["", "v1.", "plain-text", "v2.abc"]) assert.throws(() => cipher.open(junk, "x"), SecretUnreadableError, junk);
  assert.throws(() => new AesGcmCipher(randomBytes(16)), RangeError);
});

async function withDir(run) {
  const dir = await mkdtemp(join(tmpdir(), "aigate-key-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("the key file is created once, owner-only, and reused", () =>
  withDir(async (dir) => {
    const file = join(dir, "secret.key");
    const key = loadSecretKey(undefined, file);
    assert.equal(key.length, 32);
    assert.deepEqual(loadSecretKey(undefined, file), key);
    assert.deepEqual(loadSecretKey("", file), key, "an empty env value means unset");
    if (process.platform !== "win32") assert.equal(statSync(file).mode & 0o777, 0o600);
  }));

test("a bad key file stops startup and is never overwritten; the env value wins", () =>
  withDir(async (dir) => {
    const file = join(dir, "secret.key");
    writeFileSync(file, "too-short\n");
    assert.throws(() => loadSecretKey(undefined, file), /32-byte key/);
    assert.equal(readFileSync(file, "utf8"), "too-short\n");
    const hex = "ab".repeat(32);
    assert.deepEqual(loadSecretKey(hex, file), Buffer.from(hex, "hex"));
    const b64 = randomBytes(32).toString("base64");
    assert.deepEqual(loadSecretKey(b64, file), Buffer.from(b64, "base64"));
    assert.throws(() => loadSecretKey("not-a-key", file), /AIGATE_SECRET_KEY/);
  }));
