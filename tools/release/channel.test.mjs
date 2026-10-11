import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { publishRelease } from "./channel.mjs";
import { verifyRelease } from "./release.mjs";

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

    const secondResult = await publishRelease(second.manifest, key, channel);
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
