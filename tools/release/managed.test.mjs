import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { pack } from "./release.mjs";
import { createManagedInstall, readManagedState } from "../../apps/server/dist/modules/settings/infrastructure/managed-release.js";

const run = promisify(execFile);

test("signed package installs in a new managed root without user data", async () => {
  const temp = await mkdtemp(resolve(".tmp-sp51-install-"));
  try {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const keyPath = join(temp, "private.pem");
    const publicPath = join(temp, "public.pem");
    await writeFile(keyPath, privateKey.export({ format: "pem", type: "pkcs8" }));
    await writeFile(publicPath, publicKey.export({ format: "pem", type: "spki" }));
    const output = join(temp, "release");
    const manifest = await pack(output, keyPath);
    const root = join(temp, "managed");
    const archive = join(output, manifest.artifact);
    const { stdout } = await run(process.execPath, [resolve("tools/release/managed.mjs"), "install",
      join(output, `aigate-${manifest.version}.manifest.json`), publicPath, root],
      { timeout: 120_000, env: { ...process.env, AIGATE_UPDATE_OFFLINE: "1" } });
    assert.match(stdout, /"installed":true/);
    const state = await readManagedState(root);
    assert.deepEqual(state, { format: "aigate-managed-v1", current: manifest.version, previous: null, pending: null });
    assert.match(await readFile(join(root, "launcher.mjs"), "utf8"), /aigate-ready/);
    assert.equal((await readFile(join(root, "releases", manifest.version, "apps/server/package.json"), "utf8")).includes(manifest.version), true);
    await assert.rejects(createManagedInstall(root, manifest, archive, new AbortController().signal), /already exists/);
    await writeFile(archive, "changed");
    await assert.rejects(createManagedInstall(join(temp, "other"), manifest, archive, new AbortController().signal), /digest/);
    const priorData = process.env.AIGATE_DATA_DIR;
    process.env.AIGATE_DATA_DIR = join(temp, "nested", "data");
    try { await assert.rejects(createManagedInstall(join(temp, "nested"), manifest, archive, new AbortController().signal), /separate/); }
    finally { if (priorData === undefined) delete process.env.AIGATE_DATA_DIR; else process.env.AIGATE_DATA_DIR = priorData; }
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test("stable launcher falls back after an early pending-version failure", async () => {
  const temp = await mkdtemp(resolve(".tmp-sp51-launcher-"));
  try {
    const root = join(temp, "managed");
    await mkdir(root);
    await writeFile(join(root, "launcher.mjs"), await readFile(resolve("tools/release/launcher.mjs")));
    await writeFile(join(root, "state.json"), JSON.stringify({ format: "aigate-managed-v1", current: "0.1.0-dev.0", previous: null, pending: "0.1.0-dev.1" }));
    for (const version of ["0.1.0-dev.0", "0.1.0-dev.1"]) await mkdir(join(root, "releases", version, "apps/server/dist"), { recursive: true });
    await writeFile(join(root, "releases/0.1.0-dev.1/apps/server/dist/main.js"), "process.exit(1);");
    await writeFile(join(root, "releases/0.1.0-dev.0/apps/server/dist/main.js"),
      `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(join(temp, "fallback.txt"))}, process.env.AIGATE_MANAGED_VERSION); process.send("aigate-ready");`);
    const { stderr } = await run(process.execPath, [join(root, "launcher.mjs")], { timeout: 30_000 });
    assert.match(stderr, /did not start; returning/);
    assert.equal(await readFile(join(temp, "fallback.txt"), "utf8"), "0.1.0-dev.0");
    assert.equal((await readManagedState(root)).pending, null);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test("stable launcher activates a ready release and can schedule rollback", async () => {
  const temp = await mkdtemp(resolve(".tmp-sp51-activate-"));
  try {
    const root = join(temp, "managed");
    await mkdir(root);
    await writeFile(join(root, "launcher.mjs"), await readFile(resolve("tools/release/launcher.mjs")));
    await writeFile(join(root, "state.json"), JSON.stringify({ format: "aigate-managed-v1", current: "0.1.0-dev.0", previous: null, pending: "0.1.0-dev.1" }));
    for (const version of ["0.1.0-dev.0", "0.1.0-dev.1"]) await mkdir(join(root, "releases", version, "apps/server/dist"), { recursive: true });
    await writeFile(join(root, "releases/0.1.0-dev.0/apps/server/dist/main.js"), "process.send?.('aigate-ready');");
    await writeFile(join(root, "releases/0.1.0-dev.1/apps/server/dist/main.js"), "process.send?.('aigate-ready'); setTimeout(() => process.exit(0), 3500);");
    await run(process.execPath, [join(root, "launcher.mjs")], { timeout: 10_000 });
    assert.deepEqual(await readManagedState(root), { format: "aigate-managed-v1", current: "0.1.0-dev.1", previous: "0.1.0-dev.0", pending: null });
    await run(process.execPath, [join(root, "launcher.mjs"), "rollback"], { timeout: 10_000 });
    assert.equal((await readManagedState(root)).pending, "0.1.0-dev.0");
  } finally { await rm(temp, { recursive: true, force: true }); }
});
