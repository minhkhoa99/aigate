import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { listManagedReleases, pruneManagedRelease } from "./prune.mjs";

const run = promisify(execFile);

async function release(root, version, matching = true) {
  const folder = join(root, "releases", version);
  await mkdir(join(folder, "apps/server"), { recursive: true });
  await mkdir(join(folder, "tools/release"), { recursive: true });
  await writeFile(join(folder, "apps/server/package.json"), JSON.stringify({ version: matching ? version : "wrong" }));
  await writeFile(join(folder, "tools/release/launcher.mjs"), "// marker\n");
  await writeFile(join(folder, "payload.txt"), version);
}

test("managed cleanup previews and removes only an exact unreferenced release", async () => {
  const temp = await mkdtemp(resolve(".tmp-sp53-test-"));
  const root = join(temp, "managed");
  const data = join(temp, "user-data.txt");
  const external = join(temp, "external");
  await mkdir(join(root, "releases"), { recursive: true });
  await mkdir(external);
  await writeFile(join(external, "sentinel.txt"), "keep");
  await writeFile(join(root, "launcher.mjs"), "// stable launcher\n");
  await writeFile(data, "untouched");
  const state = { format: "aigate-managed-v1", current: "1.0.3", previous: "1.0.2", pending: "1.0.4" };
  await writeFile(join(root, "state.json"), JSON.stringify(state));
  try {
    for (const version of ["1.0.1", "1.0.2", "1.0.3", "1.0.4"]) await release(root, version);
    await release(root, "1.0.0", false);
    assert.deepEqual(await listManagedReleases(root), {
      protected: ["1.0.2", "1.0.3", "1.0.4"], candidates: ["1.0.1"], ignored: 1,
    });
    const preview = await run(process.execPath, [resolve("tools/release/prune.mjs"), root]);
    assert.deepEqual(JSON.parse(preview.stdout), { protected: ["1.0.2", "1.0.3", "1.0.4"], candidates: ["1.0.1"], ignored: 1 });
    await assert.rejects(run(process.execPath, [resolve("tools/release/prune.mjs"), root, "1.0.1"]), /Usage:/);
    const currentPackage = join(root, "releases", "1.0.3", "apps/server/package.json");
    await writeFile(currentPackage, JSON.stringify({ version: "wrong" }));
    await assert.rejects(listManagedReleases(root), /Current managed release marker/);
    await writeFile(currentPackage, JSON.stringify({ version: "1.0.3" }));
    for (const version of ["1.0.2", "1.0.3", "1.0.4", "1.0.0"]) {
      await assert.rejects(pruneManagedRelease(root, version), /protected, missing or ineligible/);
      assert.equal((await lstat(join(root, "releases", version))).isDirectory(), true);
    }
    await writeFile(join(root, ".update.lock"), "busy");
    await assert.rejects(listManagedReleases(root), error => error.code === "UPDATE_BUSY");
    await rm(join(root, ".update.lock"));
    await writeFile(join(root, "state.json"), JSON.stringify({ ...state, pending: "1.0.1" }));
    await assert.rejects(pruneManagedRelease(root, "1.0.1"), /protected/);
    await writeFile(join(root, "state.json"), JSON.stringify(state));
    try { await symlink(external, join(root, "releases", "1.0.1", "node_modules"), "junction"); }
    catch (error) { if (error.code !== "EPERM" || process.platform !== "win32") throw error; }
    assert.deepEqual(await pruneManagedRelease(root, "1.0.1"), {
      removed: "1.0.1", protected: ["1.0.2", "1.0.3", "1.0.4"],
    });
    await assert.rejects(lstat(join(root, "releases", "1.0.1")), /ENOENT/);
    assert.equal(await readFile(data, "utf8"), "untouched");
    assert.equal(await readFile(join(external, "sentinel.txt"), "utf8"), "keep");
    assert.equal(await readFile(join(root, "releases", "1.0.2", "payload.txt"), "utf8"), "1.0.2");
    assert.deepEqual(JSON.parse(await readFile(join(root, "state.json"), "utf8")), state);
    await mkdir(join(external, "apps/server"), { recursive: true });
    await mkdir(join(external, "tools/release"), { recursive: true });
    await writeFile(join(external, "apps/server/package.json"), JSON.stringify({ version: "1.0.5" }));
    await writeFile(join(external, "tools/release/launcher.mjs"), "// outside root\n");
    await symlink(external, join(root, "releases", "1.0.5"), "junction");
    await assert.rejects(pruneManagedRelease(root, "1.0.5"), /ineligible/);
    assert.equal(await readFile(join(external, "sentinel.txt"), "utf8"), "keep");
    assert.throws(() => pruneManagedRelease(root, "../external"), /exact SemVer/);
    const alias = join(temp, "managed-alias");
    await symlink(root, alias, "junction");
    await assert.rejects(listManagedReleases(alias), /Invalid managed release root/);
    await assert.rejects(lstat(join(root, ".update.lock")), /ENOENT/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test("managed cleanup bounds the release scan", async () => {
  const temp = await mkdtemp(resolve(".tmp-sp53-limit-"));
  const root = join(temp, "managed");
  await mkdir(join(root, "releases"), { recursive: true });
  await writeFile(join(root, "launcher.mjs"), "// stable launcher\n");
  await writeFile(join(root, "state.json"), JSON.stringify({ format: "aigate-managed-v1", current: "1.0.0", previous: null, pending: null }));
  try {
    await release(root, "1.0.0");
    for (let index = 0; index < 257; index++) await mkdir(join(root, "releases", `.unknown-${index}`));
    await assert.rejects(listManagedReleases(root), /exceeds 256/);
    await assert.rejects(lstat(join(root, ".update.lock")), /ENOENT/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});
