import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { copyFile, lstat, mkdir, open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
export const MAX_RELEASE_BYTES = 512 * 1024 * 1024;
const MAX_FILES = 10_000;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const coded = (code: string, message: string) => Object.assign(new Error(message), { code });
const missing = (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const allowed = (name: string) => ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml",
  "apps/server/package.json", "packages/database/package.json", "packages/engine/package.json",
  "tools/release/launcher.mjs", "tools/release/managed.mjs", "tools/release/release.mjs", "tools/release/prune.mjs"].includes(name) ||
  ["apps/server/dist/", "apps/web/dist/", "packages/database/dist/", "packages/database/drizzle/", "packages/engine/dist/"]
    .some(prefix => name.startsWith(prefix));

export interface ReleaseDescriptor { version: string; artifact: string; bytes: number; sha256: string }
export interface ManagedState { format: "aigate-managed-v1"; current: string; previous: string | null; pending: string | null }

export function validVersion(value: unknown): value is string {
  return typeof value === "string" && value.length <= 128 && VERSION.test(value) &&
    !value.split("-").slice(1).join("-").split(".").some(part => /^0\d+$/.test(part));
}

export async function readManagedState(root: string): Promise<ManagedState> {
  if (!isAbsolute(root)) throw coded("UPDATE_NOT_MANAGED", "A managed install root is required.");
  let value: unknown;
  try {
    const path = join(root, "state.json");
    const info = await lstat(path);
    if (!info.isFile() || info.size > 4096) throw new Error("invalid state file");
    value = JSON.parse(await readFile(path, "utf8"));
  } catch { throw coded("UPDATE_NOT_MANAGED", "The managed installation state is unavailable."); }
  if (!object(value)) throw coded("UPDATE_NOT_MANAGED", "The managed installation state is invalid.");
  const state = value;
  if (Object.keys(state).sort().join(",") !== "current,format,pending,previous" || state.format !== "aigate-managed-v1" ||
    !validVersion(state.current) || (state.previous !== null && !validVersion(state.previous)) ||
    (state.pending !== null && !validVersion(state.pending))) throw coded("UPDATE_NOT_MANAGED", "The managed installation state is invalid.");
  return { format: "aigate-managed-v1", current: state.current, previous: state.previous, pending: state.pending };
}

export async function writeManagedState(root: string, state: ManagedState): Promise<void> {
  const temporary = join(root, `.state-${randomBytes(8).toString("hex")}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify(state) + "\n", { flag: "wx", mode: 0o600 });
    await rename(temporary, join(root, "state.json"));
  } finally { await rm(temporary, { force: true }); }
}

export async function lockManaged(root: string): Promise<() => Promise<void>> {
  const path = join(root, ".update.lock");
  let file;
  try { file = await open(path, "wx", 0o600); }
  catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST") {
      throw coded("UPDATE_BUSY", "Another managed release operation is running.");
    }
    throw error;
  }
  try { await file.writeFile(String(process.pid)); }
  catch (error) { await file.close(); await rm(path, { force: true }); throw error; }
  return async () => { await file.close(); await rm(path, { force: true }); };
}

function releasePath(root: string, version: string): string {
  if (!validVersion(version)) throw coded("UPDATE_ARTIFACT_INVALID", "The release version is invalid.");
  return join(root, "releases", version);
}

async function validateArchive(archive: string, signal: AbortSignal): Promise<void> {
  const options = { signal, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 };
  let names: string, details: string;
  try {
    ({ stdout: names } = await run("tar", ["-tzf", archive], options));
    ({ stdout: details } = await run("tar", ["-tvzf", archive], options));
  } catch {
    if (signal.aborted) throw signal.reason;
    throw coded("UPDATE_ARTIFACT_INVALID", "The release archive cannot be read.");
  }
  const entries = names.trimEnd().split(/\r?\n/), types = details.trimEnd().split(/\r?\n/);
  if (entries.length < 10 || entries.length > MAX_FILES + 100 || entries.length !== types.length) throw coded("UPDATE_ARTIFACT_INVALID", "The release archive has an invalid entry count.");
  const seen = new Set<string>();
  let expandedBytes = 0;
  for (let index = 0; index < entries.length; index++) {
    const raw = entries[index];
    const name = raw.replace(/^\.\//, "").replace(/\/$/, "");
    if (!name || name === ".") continue;
    if (raw.length > 256 || raw.includes("\\") || raw.startsWith("/") || name.split("/").some(part => !part || part === "." || part === "..") ||
      seen.has(name) || !allowed(name) && !["apps", "apps/server", "apps/server/dist", "apps/web", "apps/web/dist", "packages", "packages/database", "packages/database/dist", "packages/database/drizzle", "packages/engine", "packages/engine/dist", "tools", "tools/release"].includes(name)) {
      throw coded("UPDATE_ARTIFACT_INVALID", "The release archive contains an unexpected path.");
    }
    seen.add(name);
    if (!["-", "d"].includes(types[index][0])) throw coded("UPDATE_ARTIFACT_INVALID", "The release archive contains a link or special file.");
    const size = /^\S+\s+(?:\d+\s+\d+|\S+)\s+(\d+)\s+/.exec(types[index]);
    if (!size) throw coded("UPDATE_ARTIFACT_INVALID", "The release archive has an unreadable entry size.");
    expandedBytes += Number(size[1]);
    if (!Number.isSafeInteger(expandedBytes) || expandedBytes > MAX_RELEASE_BYTES) throw coded("UPDATE_ARTIFACT_INVALID", "The release archive exceeds 512 MiB after extraction.");
  }
}

async function inspectExtracted(path: string, base: string, count: { files: number; bytes: number }): Promise<void> {
  const info = await lstat(path);
  const name = relative(base, path).split(sep).join("/");
  if (!info.isFile() && !info.isDirectory() || (name && !allowed(name) &&
    !["apps", "apps/server", "apps/server/dist", "apps/web", "apps/web/dist", "packages", "packages/database", "packages/database/dist", "packages/database/drizzle", "packages/engine", "packages/engine/dist", "tools", "tools/release"].includes(name))) {
    throw coded("UPDATE_ARTIFACT_INVALID", "The extracted release contains an unexpected file.");
  }
  if (info.isFile()) { count.files++; count.bytes += info.size; }
  else for (const child of await readdir(path)) await inspectExtracted(join(path, child), base, count);
  if (count.files > MAX_FILES || count.bytes > MAX_RELEASE_BYTES) throw coded("UPDATE_ARTIFACT_INVALID", "The extracted release exceeds its file bound.");
}

async function digest(path: string, signal: AbortSignal): Promise<{ bytes: number; sha256: string }> {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(path, { signal })) {
    bytes += chunk.length;
    if (bytes > MAX_RELEASE_BYTES) throw coded("UPDATE_ARTIFACT_INVALID", "The release archive exceeds 512 MiB.");
    hash.update(chunk);
  }
  return { bytes, sha256: hash.digest("hex") };
}

async function installDependencies(folder: string, signal: AbortSignal): Promise<void> {
  const args = ["install", "--prod", "--frozen-lockfile", ...(process.env.AIGATE_UPDATE_OFFLINE === "1" ? ["--offline"] : [])];
  const command = process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "pnpm";
  const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", `pnpm ${args.join(" ")}`] : args;
  await run(command, commandArgs, { cwd: folder, signal, timeout: 180_000, maxBuffer: 1024 * 1024 });
}

export async function installRelease(root: string, descriptor: ReleaseDescriptor, archive: string, signal: AbortSignal): Promise<void> {
  if (!validVersion(descriptor.version) || descriptor.artifact !== `aigate-${descriptor.version}.tar.gz` ||
    !Number.isSafeInteger(descriptor.bytes) || descriptor.bytes < 1 || descriptor.bytes > MAX_RELEASE_BYTES ||
    !/^[a-f0-9]{64}$/.test(descriptor.sha256)) throw coded("UPDATE_ARTIFACT_INVALID", "The release metadata is invalid.");
  const actual = await digest(archive, signal);
  if (actual.bytes !== descriptor.bytes || actual.sha256 !== descriptor.sha256) throw coded("UPDATE_ARTIFACT_INVALID", "The release archive digest does not match the signed manifest.");
  await validateArchive(archive, signal);
  const destination = releasePath(root, descriptor.version);
  try { await lstat(destination); throw coded("UPDATE_ALREADY_STAGED", "This release already exists in the managed installation."); }
  catch (error) { if (!missing(error)) throw error; }
  const temporary = join(root, "releases", `.stage-${randomBytes(8).toString("hex")}`);
  await mkdir(temporary, { recursive: false, mode: 0o700 });
  try {
    await run("tar", ["-xzf", archive, "-C", temporary], { signal, timeout: 120_000, maxBuffer: 1024 * 1024 });
    await inspectExtracted(temporary, temporary, { files: 0, bytes: 0 });
    const server = JSON.parse(await readFile(join(temporary, "apps/server/package.json"), "utf8"));
    if (server.version !== descriptor.version) throw coded("UPDATE_ARTIFACT_INVALID", "The release package version does not match the signed manifest.");
    await installDependencies(temporary, signal);
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    if (error instanceof Error && "code" in error && typeof error.code === "string" && error.code.startsWith("UPDATE_")) throw error;
    throw coded("UPDATE_INSTALL_FAILED", "The verified release could not be installed.");
  }
}

export async function createManagedInstall(root: string, descriptor: ReleaseDescriptor, archive: string, signal: AbortSignal): Promise<void> {
  const target = resolve(root);
  const data = resolve(process.env.AIGATE_DATA_DIR ?? join(homedir(), ".aigate"));
  const overlaps = (parent: string, child: string) => {
    const path = relative(parent, child);
    return !path || path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
  };
  if (overlaps(target, data) || overlaps(data, target)) throw coded("UPDATE_INSTALL_FAILED", "The managed release root must be separate from the application data directory.");
  try { await lstat(target); throw coded("UPDATE_ALREADY_STAGED", "The managed install root already exists."); }
  catch (error) { if (!missing(error)) throw error; }
  const temporary = join(dirname(target), `.aigate-managed-${randomBytes(8).toString("hex")}`);
  await mkdir(temporary, { recursive: false, mode: 0o700 });
  try {
    await mkdir(join(temporary, "releases"));
    await installRelease(temporary, descriptor, archive, signal);
    // The stable launcher comes from the verified archive, never the invoking checkout.
    await copyFile(join(temporary, "releases", descriptor.version, "tools/release/launcher.mjs"), join(temporary, "launcher.mjs"));
    await writeManagedState(temporary, { format: "aigate-managed-v1", current: descriptor.version, previous: null, pending: null });
    await rename(temporary, target);
  } catch (error) { await rm(temporary, { recursive: true, force: true }); throw error; }
}

export async function scheduleRollback(root: string, activeVersion: string): Promise<ManagedState> {
  const state = await readManagedState(root);
  if (state.current !== activeVersion) throw coded("UPDATE_NOT_MANAGED", "The managed state does not match the running release.");
  if (state.pending) throw coded("UPDATE_BUSY", "A release switch is already pending.");
  if (!state.previous) throw coded("UPDATE_NO_ROLLBACK", "There is no previous release to restore.");
  const previous = releasePath(root, state.previous);
  try {
    if (!(await lstat(join(previous, "apps/server/dist/main.js"))).isFile()) throw new Error("missing entry");
  } catch { throw coded("UPDATE_NO_ROLLBACK", "The previous release is missing."); }
  const next = { ...state, pending: state.previous };
  await writeManagedState(root, next);
  return next;
}
