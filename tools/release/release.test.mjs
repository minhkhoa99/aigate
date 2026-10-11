import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { pack, verifyRelease } from "./release.mjs";

const run = promisify(execFile);

test("release package is explicit, signed and rejects tampering", async () => {
  const temp = await mkdtemp(resolve(".tmp-sp49-test-"));
  try {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const other = generateKeyPairSync("ed25519");
    const privatePath = join(temp, "private.pem");
    const publicPath = join(temp, "public.pem");
    const wrongPath = join(temp, "wrong.pem");
    await writeFile(privatePath, privateKey.export({ format: "pem", type: "pkcs8" }));
    await writeFile(publicPath, publicKey.export({ format: "pem", type: "spki" }));
    await writeFile(wrongPath, other.publicKey.export({ format: "pem", type: "spki" }));
    const output = join(temp, "release");
    const manifest = await pack(output, privatePath);
    const manifestPath = join(output, `aigate-${manifest.version}.manifest.json`);
    assert.deepEqual(await verifyRelease(manifestPath, publicPath), {
      format: "aigate-release", version: manifest.version, artifact: manifest.artifact, bytes: manifest.bytes, sha256: manifest.sha256,
    });
    await assert.rejects(verifyRelease(manifestPath, wrongPath), /signature/);
    const { stdout } = await run("tar", ["-tzf", join(output, manifest.artifact)]);
    assert.match(stdout, /apps\/server\/dist\/main\.js/);
    assert.match(stdout, /apps\/web\/dist\/index\.html/);
    assert.match(stdout, /packages\/database\/drizzle\/meta\/\_journal\.json/);
    assert.match(stdout, /tools\/release\/prune\.mjs/);
    assert.doesNotMatch(stdout, /node_modules|\.env|secret\.key|aigate\.db|\/test\//);
    const extracted = join(temp, "extracted");
    await mkdir(extracted);
    await run("tar", ["-xzf", join(output, manifest.artifact), "-C", extracted]);
    assert.equal(JSON.parse(await readFile(join(extracted, "apps/server/package.json"), "utf8")).version, manifest.version);
    const installer = process.platform === "win32" ? [process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "pnpm install --offline --prod --frozen-lockfile"]] : ["pnpm", ["install", "--offline", "--prod", "--frozen-lockfile"]];
    await run(installer[0], installer[1], { cwd: extracted, timeout: 120_000 });
    const { createServer } = await import(pathToFileURL(join(extracted, "apps/server/dist/server.js")).href);
    const dataDir = join(temp, "data");
    await mkdir(dataDir);
    const app = await createServer({ databaseFile: join(dataDir, "aigate.db"), dataDir, webDist: join(extracted, "apps/web/dist") });
    try {
      const web = await app.getHttpAdapter().getInstance().inject({ method: "GET", url: "/" });
      assert.equal(web.statusCode, 200);
      assert.match(web.body, /<html/);
    } finally { await app.close(); }
    const original = JSON.parse(await readFile(manifestPath, "utf8"));
    await writeFile(manifestPath, JSON.stringify({ ...original, bytes: original.bytes + 1 }));
    await assert.rejects(verifyRelease(manifestPath, publicPath), /signature/);
    await writeFile(manifestPath, JSON.stringify(original));
    await writeFile(join(output, manifest.artifact), "tampered");
    await assert.rejects(verifyRelease(manifestPath, publicPath), /digest/);
    await assert.rejects(pack(output, privatePath), /already exists/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});
