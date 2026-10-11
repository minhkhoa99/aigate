import { lstat, opendir, readFile, realpath, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lockManaged, readManagedState, validVersion } from "../../apps/server/dist/modules/settings/infrastructure/managed-release.js";

const MAX_RELEASE_ENTRIES = 256;

async function regular(path, maxBytes) {
  try {
    const info = await lstat(path);
    return info.isFile() && !info.isSymbolicLink() && info.size <= maxBytes;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function managedRoot(root) {
  const target = resolve(root);
  const releases = join(target, "releases");
  const rootInfo = await lstat(target);
  const releasesInfo = await lstat(releases);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink() ||
      !releasesInfo.isDirectory() || releasesInfo.isSymbolicLink() ||
      !await regular(join(target, "launcher.mjs"), 64 * 1024) ||
      dirname(await realpath(releases)) !== await realpath(target)) {
    throw new Error("Invalid managed release root.");
  }
  return { root: target, releases };
}

async function releaseMarker(releases, version) {
  const folder = join(releases, version);
  const info = await lstat(folder);
  if (!info.isDirectory() || info.isSymbolicLink() || dirname(await realpath(folder)) !== await realpath(releases) ||
      !await regular(join(folder, "apps/server/package.json"), 4096) ||
      !await regular(join(folder, "tools/release/launcher.mjs"), 64 * 1024)) return false;
  try {
    const value = JSON.parse(await readFile(join(folder, "apps/server/package.json"), "utf8"));
    return value && typeof value === "object" && value.version === version;
  } catch { return false; }
}

async function scan(releases, state) {
  const protectedVersions = [...new Set([state.current, state.previous, state.pending].filter(Boolean))].sort();
  const protectedSet = new Set(protectedVersions);
  const candidates = [];
  let entries = 0, ignored = 0;
  for await (const entry of await opendir(releases)) {
    if (++entries > MAX_RELEASE_ENTRIES) throw new Error("Managed release directory exceeds 256 entries.");
    if (!validVersion(entry.name) || !entry.isDirectory()) { ignored++; continue; }
    if (protectedSet.has(entry.name)) continue;
    if (await releaseMarker(releases, entry.name)) candidates.push(entry.name);
    else ignored++;
  }
  return { protected: protectedVersions, candidates: candidates.sort(), ignored };
}

async function withManagedRoot(root, action) {
  const paths = await managedRoot(root);
  const unlock = await lockManaged(paths.root);
  try {
    const state = await readManagedState(paths.root);
    if (!await releaseMarker(paths.releases, state.current)) throw new Error("Current managed release marker is invalid.");
    return await action(paths.releases, state);
  } finally { await unlock(); }
}

export function listManagedReleases(root) {
  return withManagedRoot(root, scan);
}

export function pruneManagedRelease(root, version) {
  if (!validVersion(version)) throw new Error("An exact SemVer release version is required.");
  return withManagedRoot(root, async (releases, state) => {
    const result = await scan(releases, state);
    if (!result.candidates.includes(version)) throw new Error("Release is protected, missing or ineligible for cleanup.");
    const target = join(releases, version);
    if (dirname(resolve(target)) !== resolve(releases)) throw new Error("Release path escaped managed root.");
    await rm(target, { recursive: true, force: false, maxRetries: 0 });
    return { removed: version, protected: result.protected };
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 1 && (args.length !== 3 || args[2] !== "--apply")) {
    console.error("Usage: prune.mjs <managed-root> [<exact-version> --apply]");
    process.exitCode = 2;
  } else {
    try { console.log(JSON.stringify(args.length === 1 ? await listManagedReleases(args[0]) : await pruneManagedRelease(args[0], args[1]))); }
    catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
  }
}
