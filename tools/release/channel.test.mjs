import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { pruneChannel, publishRelease, restoreChannel, rollbackChannel } from "./channel.mjs";
import { verifyRelease } from "./release.mjs";

const run = promisify(execFile);

async function fixture(root, version, privateKey) {
  const folder = join(root, version);
  await mkdir(folder);
  const artifact = `aigate-${version}.tar.gz`;
  const body = Buffer.from(`synthetic release ${version}`);
  await writeFile(join(folder, artifact), body);
  const unsigned = { format: "aigate-release", version, artifact, bytes: body.length, sha256: createHash("sha256").update(body).digest("hex") };
  const signature = sign(null, Buffer.from(JSON.stringify(unsigned)), privateKey).toString("base64url");
  const manifest = join(folder, `aigate-${version}.manifest.json`);
  await writeFile(manifest, JSON.stringify({ ...unsigned, signature }));
  return { manifest, artifact };
}

test("static channel publishes verified immutable releases and preserves last good manifest", async () => {
  const root = await mkdtemp(resolve(".tmp-sp52-test-"));
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const wrong = generateKeyPairSync("ed25519");
  const key = join(root, "public.pem");
  const wrongKey = join(root, "wrong.pem");
  const channel = join(root, "channel");
  await writeFile(key, publicKey.export({ format: "pem", type: "spki" }));
  await writeFile(wrongKey, wrong.publicKey.export({ format: "pem", type: "spki" }));
  await mkdir(channel);
  try {
    const first = await fixture(root, "0.1.0-dev.1", privateKey);
    const second = await fixture(root, "0.1.0-dev.2", privateKey);
    const older = await fixture(root, "0.1.0-dev.0", privateKey);
    await assert.rejects(publishRelease(first.manifest, wrongKey, channel), /signature/);
    assert.deepEqual(await readdir(channel), []);
    const firstResult = await publishRelease(first.manifest, key, channel);
    assert.equal(firstResult.version, "0.1.0-dev.1");
    assert.equal((await verifyRelease(join(channel, "latest.manifest.json"), key)).version, firstResult.version);
    const before = await readFile(join(channel, "latest.manifest.json"));
    await assert.rejects(publishRelease(first.manifest, key, channel), /newer/);
    await assert.rejects(publishRelease(older.manifest, key, channel), /newer/);
    assert.deepEqual(await readFile(join(channel, "latest.manifest.json")), before);

    await writeFile(join(channel, ".publish.lock"), "held");
    await assert.rejects(publishRelease(second.manifest, key, channel), /EEXIST/);
    assert.deepEqual(await readFile(join(channel, ".publish.lock")), Buffer.from("held"));
    await rm(join(channel, ".publish.lock"));

    const secondResult = JSON.parse((await run(process.execPath, [resolve("tools/release/channel.mjs"), second.manifest, key, channel])).stdout);
    assert.equal(secondResult.version, "0.1.0-dev.2");
    assert.equal((await verifyRelease(join(channel, "latest.manifest.json"), key)).version, "0.1.0-dev.2");
    assert.equal((await readFile(join(channel, first.artifact))).toString(), "synthetic release 0.1.0-dev.1");
    assert.deepEqual((await readdir(channel)).sort(), [first.artifact, second.artifact, "latest.manifest.json"].sort());

    const stable = await readFile(join(channel, "latest.manifest.json"));
    const currentArchive = await readFile(join(channel, second.artifact));
    await writeFile(join(channel, second.artifact), "tampered channel archive");
    const next = await fixture(root, "0.1.0-dev.3", privateKey);
    await assert.rejects(publishRelease(next.manifest, key, channel), /digest/);
    assert.deepEqual(await readFile(join(channel, "latest.manifest.json")), stable);
    await writeFile(join(channel, second.artifact), currentArchive);
    await writeFile(second.manifest, "tampered");
    await assert.rejects(publishRelease(second.manifest, key, channel));
    assert.deepEqual(await readFile(join(channel, "latest.manifest.json")), stable);

    const response = await new Promise((resolveResponse, reject) => {
      const server = createServer(async (request, reply) => {
        try {
          const name = request.url === "/latest.manifest.json" ? "latest.manifest.json" :
            request.url === `/${second.artifact}` ? second.artifact : null;
          if (!name) { reply.writeHead(404).end(); return; }
          reply.writeHead(200).end(await readFile(join(channel, name)));
        } catch (error) { reply.writeHead(500).end(String(error)); }
      });
      server.once("error", reject);
      server.listen(0, "127.0.0.1", async () => {
        try {
          const base = `http://127.0.0.1:${server.address().port}`;
          const manifestResponse = await fetch(`${base}/latest.manifest.json`);
          const manifest = await manifestResponse.json();
          const artifactResponse = await fetch(`${base}/${manifest.artifact}`);
          resolveResponse({ manifestResponse, manifest, artifactResponse, bytes: Buffer.from(await artifactResponse.arrayBuffer()) });
        } catch (error) { reject(error); }
        finally { server.close(); }
      });
    });
    assert.equal(response.manifestResponse.status, 200);
    assert.equal(response.artifactResponse.status, 200);
    assert.equal(response.manifest.version, "0.1.0-dev.2");
    assert.equal(createHash("sha256").update(response.bytes).digest("hex"), response.manifest.sha256);

    const bad = next;
    await writeFile(join(channel, bad.artifact), "foreign archive");
    await assert.rejects(publishRelease(bad.manifest, key, channel), /already exists/);
    assert.deepEqual(await readFile(join(channel, "latest.manifest.json")), stable);
    await rm(join(channel, bad.artifact));
    let symlinkCreated = false;
    try { await symlink(join(root, bad.artifact), join(channel, bad.artifact)); symlinkCreated = true; }
    catch (error) {
      if (error.code !== "EPERM" || process.platform !== "win32") throw error;
    }
    if (symlinkCreated) await assert.rejects(publishRelease(bad.manifest, key, channel), /not a regular file/);
    assert.deepEqual(await readFile(join(channel, "latest.manifest.json")), stable);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("channel rollback requires an older signed manifest and explicit apply", async () => {
  const root = await mkdtemp(resolve(".tmp-sp54-test-"));
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const other = generateKeyPairSync("ed25519");
  const key = join(root, "public.pem"), wrongKey = join(root, "wrong.pem"), channel = join(root, "channel");
  await writeFile(key, publicKey.export({ format: "pem", type: "spki" }));
  await writeFile(wrongKey, other.publicKey.export({ format: "pem", type: "spki" }));
  await mkdir(channel);
  try {
    const first = await fixture(root, "1.0.0", privateKey);
    const second = await fixture(root, "1.1.0", privateKey);
    const newer = await fixture(root, "2.0.0", privateKey);
    await publishRelease(first.manifest, key, channel);
    await publishRelease(second.manifest, key, channel);
    const latest = join(channel, "latest.manifest.json");
    const before = await readFile(latest);
    const preview = await run(process.execPath, [resolve("tools/release/channel.mjs"), "rollback", first.manifest, key, channel]);
    assert.deepEqual(JSON.parse(preview.stdout), { currentVersion: "1.1.0", targetVersion: "1.0.0", artifactBytes: Buffer.byteLength("synthetic release 1.0.0"), applied: false });
    assert.deepEqual(await readFile(latest), before);
    assert.deepEqual((await readdir(channel)).sort(), [first.artifact, second.artifact, "latest.manifest.json"].sort());
    await assert.rejects(run(process.execPath, [resolve("tools/release/channel.mjs"), "rollback", first.manifest, key, channel, "--wrong"]), /Usage:/);

    await writeFile(join(channel, ".publish.lock"), "busy");
    await assert.rejects(rollbackChannel(first.manifest, key, channel), /EEXIST/);
    await rm(join(channel, ".publish.lock"));
    await assert.rejects(rollbackChannel(first.manifest, wrongKey, channel), /signature/);
    const oversizedKey = join(root, "oversized.pem");
    await writeFile(oversizedKey, "x".repeat(4097));
    await assert.rejects(rollbackChannel(first.manifest, oversizedKey, channel), /no larger than 4 KiB/);
    await assert.rejects(rollbackChannel(second.manifest, key, channel), /older/);
    await writeFile(join(channel, newer.artifact), await readFile(join(root, "2.0.0", newer.artifact)));
    await assert.rejects(rollbackChannel(newer.manifest, key, channel), /older/);
    await rm(join(channel, newer.artifact));

    const oldArchive = await readFile(join(channel, first.artifact));
    await writeFile(join(channel, first.artifact), "tampered");
    await assert.rejects(rollbackChannel(first.manifest, key, channel, true), /digest/);
    assert.deepEqual(await readFile(latest), before);
    await writeFile(join(channel, first.artifact), oldArchive);
    await rm(join(channel, first.artifact));
    await assert.rejects(rollbackChannel(first.manifest, key, channel), /ENOENT/);
    await mkdir(join(channel, first.artifact));
    await assert.rejects(rollbackChannel(first.manifest, key, channel), /not a regular file/);
    await rm(join(channel, first.artifact), { recursive: true });
    await writeFile(join(channel, first.artifact), oldArchive);

    const applied = await run(process.execPath, [resolve("tools/release/channel.mjs"), "rollback", first.manifest, key, channel, "--apply"]);
    assert.equal(JSON.parse(applied.stdout).applied, true);
    assert.equal((await verifyRelease(latest, key)).version, "1.0.0");
    assert.equal((await readFile(join(channel, second.artifact))).toString(), "synthetic release 1.1.0");
    assert.deepEqual((await readdir(channel)).sort(), [first.artifact, second.artifact, "latest.manifest.json"].sort());

    const server = createServer(async (request, reply) => {
      try {
        const name = request.url === "/latest.manifest.json" ? "latest.manifest.json" :
          request.url === `/${first.artifact}` ? first.artifact : null;
        if (!name) { reply.writeHead(404).end(); return; }
        reply.writeHead(200).end(await readFile(join(channel, name)));
      } catch (error) { reply.writeHead(500).end(String(error)); }
    });
    try {
      await new Promise((resolveListen, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolveListen); });
      const base = `http://127.0.0.1:${server.address().port}`;
      const manifest = await (await fetch(`${base}/latest.manifest.json`)).json();
      const archive = Buffer.from(await (await fetch(`${base}/${manifest.artifact}`)).arrayBuffer());
      assert.equal(manifest.version, "1.0.0");
      assert.equal(createHash("sha256").update(archive).digest("hex"), manifest.sha256);
    } finally { await new Promise(resolveClose => server.close(resolveClose)); }

    await writeFile(latest, await readFile(second.manifest));
    await writeFile(join(channel, second.artifact), "damaged current archive");
    assert.equal((await rollbackChannel(first.manifest, key, channel)).targetVersion, "1.0.0");
    assert.equal((await rollbackChannel(first.manifest, key, channel, true)).applied, true);
    assert.equal((await verifyRelease(latest, key)).version, "1.0.0");
    await writeFile(latest, "invalid current manifest");
    await assert.rejects(rollbackChannel(first.manifest, key, channel), /JSON|manifest/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("channel cleanup previews and removes only a verified unreferenced archive", async () => {
  const root = await mkdtemp(resolve(".tmp-sp55-test-"));
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const other = generateKeyPairSync("ed25519");
  const key = join(root, "public.pem"), wrongKey = join(root, "wrong.pem"), channel = join(root, "channel");
  await writeFile(key, publicKey.export({ format: "pem", type: "spki" }));
  await writeFile(wrongKey, other.publicKey.export({ format: "pem", type: "spki" }));
  await mkdir(channel);
  try {
    const first = await fixture(root, "1.0.0", privateKey);
    const second = await fixture(root, "1.1.0", privateKey);
    const third = await fixture(root, "1.2.0", privateKey);
    await publishRelease(first.manifest, key, channel);
    await publishRelease(second.manifest, key, channel);
    await publishRelease(third.manifest, key, channel);
    const latest = join(channel, "latest.manifest.json");
    const current = await readFile(latest);
    const preview = await run(process.execPath, [resolve("tools/release/channel.mjs"), "prune", first.manifest, key, channel]);
    assert.deepEqual(JSON.parse(preview.stdout), { currentVersion: "1.2.0", targetVersion: "1.0.0", artifact: first.artifact, artifactBytes: Buffer.byteLength("synthetic release 1.0.0"), applied: false });
    assert.deepEqual((await readdir(channel)).sort(), [first.artifact, second.artifact, third.artifact, "latest.manifest.json"].sort());
    await assert.rejects(run(process.execPath, [resolve("tools/release/channel.mjs"), "prune", first.manifest, key, channel, "--wrong"]), /Usage:/);
    await assert.rejects(pruneChannel(third.manifest, key, channel, true), /protected/);
    await assert.rejects(pruneChannel(first.manifest, wrongKey, channel, true), /signature/);
    const signedFirst = await readFile(first.manifest);
    await writeFile(first.manifest, "tampered manifest");
    await assert.rejects(pruneChannel(first.manifest, key, channel, true), /JSON|manifest/);
    await writeFile(first.manifest, signedFirst);
    await writeFile(join(channel, ".publish.lock"), "busy");
    await assert.rejects(pruneChannel(first.manifest, key, channel, true), /EEXIST/);
    await rm(join(channel, ".publish.lock"));

    const oldArchive = await readFile(join(channel, first.artifact));
    await writeFile(join(channel, first.artifact), "tampered");
    await assert.rejects(pruneChannel(first.manifest, key, channel, true), /digest/);
    await writeFile(join(channel, first.artifact), oldArchive);
    await rm(join(channel, first.artifact));
    await assert.rejects(pruneChannel(first.manifest, key, channel, true), /ENOENT/);
    await mkdir(join(channel, first.artifact));
    await assert.rejects(pruneChannel(first.manifest, key, channel, true), /not a regular file/);
    await rm(join(channel, first.artifact), { recursive: true });
    let linked = false;
    try { await symlink(join(root, "1.0.0", first.artifact), join(channel, first.artifact)); linked = true; }
    catch (error) { if (error.code !== "EPERM" || process.platform !== "win32") throw error; }
    if (linked) {
      await assert.rejects(pruneChannel(first.manifest, key, channel, true), /not a regular file/);
      await rm(join(channel, first.artifact));
    }
    await writeFile(join(channel, first.artifact), oldArchive);
    await writeFile(latest, "invalid current manifest");
    await assert.rejects(pruneChannel(first.manifest, key, channel, true), /JSON|manifest/);
    await writeFile(latest, current);
    await writeFile(join(channel, third.artifact), "damaged current archive");
    await assert.rejects(pruneChannel(first.manifest, key, channel, true), /digest/);
    await writeFile(join(channel, third.artifact), await readFile(join(root, "1.2.0", third.artifact)));
    assert.deepEqual(await readFile(join(channel, first.artifact)), oldArchive);

    const applied = await run(process.execPath, [resolve("tools/release/channel.mjs"), "prune", first.manifest, key, channel, "--apply"]);
    assert.equal(JSON.parse(applied.stdout).applied, true);
    assert.deepEqual((await readdir(channel)).sort(), [second.artifact, third.artifact, "latest.manifest.json"].sort());
    assert.deepEqual(await readFile(latest), current);
    assert.equal((await verifyRelease(latest, key)).version, "1.2.0");
    assert.equal((await readFile(join(channel, second.artifact))).toString(), "synthetic release 1.1.0");
    await assert.rejects(pruneChannel(first.manifest, key, channel, true), /ENOENT/);
    await assert.rejects(rollbackChannel(first.manifest, key, channel), /ENOENT/);
    await rollbackChannel(second.manifest, key, channel, true);
    assert.equal((await pruneChannel(third.manifest, key, channel, true)).targetVersion, "1.2.0");
    assert.equal((await verifyRelease(latest, key)).version, "1.1.0");
    assert.deepEqual((await readdir(channel)).sort(), [second.artifact, "latest.manifest.json"].sort());
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("channel restore stages a signed missing archive without changing latest", async () => {
  const root = await mkdtemp(resolve(".tmp-sp56-test-"));
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const other = generateKeyPairSync("ed25519");
  const key = join(root, "public.pem"), wrongKey = join(root, "wrong.pem"), channel = join(root, "channel");
  await writeFile(key, publicKey.export({ format: "pem", type: "spki" }));
  await writeFile(wrongKey, other.publicKey.export({ format: "pem", type: "spki" }));
  await mkdir(channel);
  try {
    const first = await fixture(root, "1.0.0", privateKey);
    const second = await fixture(root, "1.1.0", privateKey);
    await publishRelease(first.manifest, key, channel);
    await publishRelease(second.manifest, key, channel);
    const latest = join(channel, "latest.manifest.json"), archived = join(channel, first.artifact);
    const current = await readFile(latest);
    await assert.rejects(restoreChannel(first.manifest, key, channel, true), /already exists/);
    await pruneChannel(first.manifest, key, channel, true);
    const preview = await run(process.execPath, [resolve("tools/release/channel.mjs"), "restore", first.manifest, key, channel]);
    assert.deepEqual(JSON.parse(preview.stdout), { currentVersion: "1.1.0", targetVersion: "1.0.0", artifact: first.artifact, artifactBytes: Buffer.byteLength("synthetic release 1.0.0"), applied: false });
    assert.deepEqual((await readdir(channel)).sort(), [second.artifact, "latest.manifest.json"].sort());
    await assert.rejects(run(process.execPath, [resolve("tools/release/channel.mjs"), "restore", first.manifest, key, channel, "--wrong"]), /Usage:/);
    await assert.rejects(restoreChannel(first.manifest, wrongKey, channel, true), /signature/);
    await writeFile(join(channel, ".publish.lock"), "busy");
    await assert.rejects(restoreChannel(first.manifest, key, channel, true), /EEXIST/);
    await rm(join(channel, ".publish.lock"));
    const sourceArchive = join(root, "1.0.0", first.artifact);
    const bytes = await readFile(sourceArchive);
    await writeFile(sourceArchive, "tampered source");
    await assert.rejects(restoreChannel(first.manifest, key, channel, true), /digest/);
    await rm(sourceArchive);
    await assert.rejects(restoreChannel(first.manifest, key, channel, true), /ENOENT/);
    await writeFile(sourceArchive, bytes);
    const signedManifest = await readFile(first.manifest);
    await writeFile(first.manifest, "invalid source manifest");
    await assert.rejects(restoreChannel(first.manifest, key, channel, true), /JSON|manifest/);
    await writeFile(first.manifest, signedManifest);
    await writeFile(archived, "damaged existing archive");
    await assert.rejects(restoreChannel(first.manifest, key, channel, true), /already exists/);
    await rm(archived);
    await mkdir(archived);
    await assert.rejects(restoreChannel(first.manifest, key, channel, true), /not a regular file/);
    await rm(archived, { recursive: true });
    let linked = false;
    try { await symlink(sourceArchive, archived); linked = true; }
    catch (error) { if (error.code !== "EPERM" || process.platform !== "win32") throw error; }
    if (linked) {
      await assert.rejects(restoreChannel(first.manifest, key, channel, true), /not a regular file/);
      await rm(archived);
    }
    await writeFile(latest, "invalid current manifest");
    await assert.rejects(restoreChannel(first.manifest, key, channel, true), /JSON|manifest/);
    await writeFile(latest, current);

    const applied = await run(process.execPath, [resolve("tools/release/channel.mjs"), "restore", first.manifest, key, channel, "--apply"]);
    assert.equal(JSON.parse(applied.stdout).applied, true);
    assert.equal((await verifyRelease(first.manifest, key, channel)).version, "1.0.0");
    assert.deepEqual(await readFile(latest), current);
    assert.deepEqual((await readdir(channel)).sort(), [first.artifact, second.artifact, "latest.manifest.json"].sort());
    await assert.rejects(restoreChannel(first.manifest, key, channel, true), /already exists/);
    await rollbackChannel(first.manifest, key, channel, true);
    await rm(archived);
    assert.equal((await restoreChannel(first.manifest, key, channel, true)).currentVersion, "1.0.0");
    assert.equal((await verifyRelease(latest, key)).version, "1.0.0");
    assert.equal((await readFile(join(channel, second.artifact))).toString(), "synthetic release 1.1.0");
    assert.deepEqual((await readdir(channel)).sort(), [first.artifact, second.artifact, "latest.manifest.json"].sort());
  } finally { await rm(root, { recursive: true, force: true }); }
});
