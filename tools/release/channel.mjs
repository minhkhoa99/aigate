import { copyFile, link, lstat, mkdtemp, open, rename, rm, rmdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyRelease } from "./release.mjs";

const LATEST = "latest.manifest.json";

function compareVersions(left, right) {
  const parse = value => {
    const [, major, minor, patch, prerelease] = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(value);
    return [major, minor, patch, prerelease];
  };
  const a = parse(left), b = parse(right);
  for (let i = 0; i < 3; i++) {
    const delta = BigInt(a[i]) - BigInt(b[i]);
    if (delta !== 0n) return delta > 0n ? 1 : -1;
  }
  if (a[3] === b[3]) return 0;
  if (!a[3]) return 1;
  if (!b[3]) return -1;
  const x = a[3].split("."), y = b[3].split(".");
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] === undefined) return -1;
    if (y[i] === undefined) return 1;
    if (x[i] === y[i]) continue;
    const xn = /^(0|[1-9]\d*)$/.test(x[i]);
    const yn = /^(0|[1-9]\d*)$/.test(y[i]);
    if (xn && yn) return BigInt(x[i]) > BigInt(y[i]) ? 1 : -1;
    if (xn !== yn) return xn ? -1 : 1;
    return x[i] > y[i] ? 1 : -1;
  }
  return 0;
}

async function regularOrMissing(path) {
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Channel path is not a regular file: ${path}`);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export async function publishRelease(manifestPath, publicKeyPath, channelDir) {
  const manifest = resolve(manifestPath), key = resolve(publicKeyPath), channel = resolve(channelDir);
  const info = await lstat(channel);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Channel must be an existing regular directory.");
  const keyInfo = await lstat(key);
  if (!keyInfo.isFile() || keyInfo.isSymbolicLink() || keyInfo.size > 4096) throw new Error("Pinned public key must be a regular file no larger than 4 KiB.");
  const source = await verifyRelease(manifest, key);
  const lockPath = join(channel, ".publish.lock");
  const lock = await open(lockPath, "wx");
  let stage;
  let archivePublished = false;
  let manifestPublished = false;
  const archivePath = join(channel, source.artifact);
  try {
    const latestPath = join(channel, LATEST);
    if (await regularOrMissing(latestPath)) {
      const current = await verifyRelease(latestPath, key);
      if (!await regularOrMissing(join(channel, current.artifact))) throw new Error("Channel archive disappeared during publication.");
      if (compareVersions(source.version, current.version) <= 0) throw new Error("Release version must be newer than the channel version.");
    }
    if (await regularOrMissing(archivePath)) throw new Error("Release archive already exists in channel.");
    stage = await mkdtemp(join(channel, ".publish-"));
    if (dirname(stage) !== channel) throw new Error("Publication stage escaped channel directory.");
    await copyFile(join(dirname(manifest), source.artifact), join(stage, source.artifact));
    await copyFile(manifest, join(stage, LATEST));
    await verifyRelease(join(stage, LATEST), key);
    await link(join(stage, source.artifact), archivePath);
    archivePublished = true;
    await rename(join(stage, LATEST), latestPath);
    manifestPublished = true;
    return { version: source.version, manifest: latestPath, artifact: archivePath };
  } catch (error) {
    if (archivePublished && !manifestPublished) await rm(archivePath, { force: true });
    throw error;
  } finally {
    try {
      if (stage) {
        await rm(join(stage, source.artifact), { force: true });
        await rm(join(stage, LATEST), { force: true });
        await rmdir(stage);
      }
    } finally {
      await lock.close();
      await rm(lockPath, { force: true });
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , manifest, key, channel] = process.argv;
  if (!manifest || !key || !channel || process.argv.length !== 5) {
    console.error("Usage: channel.mjs <signed-manifest> <public-key.pem> <existing-channel-dir>");
    process.exitCode = 2;
  } else {
    try { console.log(JSON.stringify(await publishRelease(manifest, key, channel))); }
    catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
  }
}
