import { fork } from "node:child_process";
import { lstat, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const root = dirname(fileURLToPath(import.meta.url));
const validVersion = value => typeof value === "string" && value.length <= 128 &&
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(value) &&
  !value.split("-").slice(1).join("-").split(".").some(part => /^0\d+$/.test(part));

async function state() {
  const path = join(root, "state.json");
  const info = await lstat(path);
  if (!info.isFile() || info.size > 4096) throw new Error("Invalid managed state file.");
  const value = JSON.parse(await readFile(path, "utf8"));
  if (!value || Object.keys(value).sort().join(",") !== "current,format,pending,previous" ||
    value.format !== "aigate-managed-v1" || !validVersion(value.current) ||
    value.previous !== null && !validVersion(value.previous) ||
    value.pending !== null && !validVersion(value.pending)) throw new Error("Invalid managed state.");
  return value;
}

async function save(value) {
  const temporary = join(root, `.state-${randomBytes(8).toString("hex")}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify(value) + "\n", { flag: "wx", mode: 0o600 });
    await rename(temporary, join(root, "state.json"));
  } finally { await rm(temporary, { force: true }); }
}

async function withLock(callback) {
  const path = join(root, ".update.lock");
  const file = await open(path, "wx", 0o600);
  try { await callback(); }
  finally { await file.close(); await rm(path, { force: true }); }
}

function launch(version) {
  const entry = join(root, "releases", version, "apps", "server", "dist", "main.js");
  const child = fork(entry, [], { env: { ...process.env, AIGATE_MANAGED_ROOT: root, AIGATE_MANAGED_VERSION: version }, stdio: ["inherit", "inherit", "inherit", "ipc"] });
  const stop = () => child.kill();
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  child.once("exit", () => { process.off("SIGINT", stop); process.off("SIGTERM", stop); });
  const ready = new Promise(resolve => {
    child.on("message", message => { if (message === "aigate-ready") resolve(true); });
    child.on("exit", () => resolve(false));
    child.on("error", () => resolve(false));
  });
  const exited = new Promise(resolve => child.on("exit", code => resolve(code ?? 1)));
  return { child, ready, exited };
}

async function main() {
  const command = process.argv[2];
  if (command && command !== "rollback") throw new Error("Usage: node launcher.mjs [rollback]");
  let current = await state();
  if (command === "rollback") {
    await withLock(async () => {
      current = await state();
      if (!current.previous || current.pending) throw new Error("No previous release is available for rollback.");
      await lstat(join(root, "releases", current.previous, "apps", "server", "dist", "main.js"));
      await save({ ...current, pending: current.previous });
    });
    return;
  }
  if (current.pending) {
    const candidate = current.pending;
    const launched = launch(candidate);
    const ready = await Promise.race([launched.ready, new Promise(resolve => { setTimeout(() => resolve(false), 20_000).unref(); })]);
    if (ready) {
      const alive = await Promise.race([launched.exited.then(() => false), new Promise(resolve => { setTimeout(() => resolve(true), 3000).unref(); })]);
      if (alive) {
        // The dashboard cannot stage another version before this process is ready.
        await save({ format: "aigate-managed-v1", current: candidate, previous: current.current, pending: null });
        process.exitCode = await launched.exited;
        return;
      }
    }
    launched.child.kill();
    await launched.exited;
    current = { ...current, pending: null };
    await save(current);
    console.error(`AIGate ${candidate} did not start; returning to ${current.current}.`);
  }
  const launched = launch(current.current);
  process.exitCode = await launched.exited;
}

try { await main(); }
catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
