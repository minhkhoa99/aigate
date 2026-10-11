import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { createReadStream } from "node:fs";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../../", import.meta.url));
const MAX_BYTES = 512 * 1024 * 1024;
const MAX_FILES = 10_000;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;
const files = ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "apps/server/package.json", "packages/database/package.json", "packages/engine/package.json"];
const directories = ["apps/server/dist", "apps/web/dist", "packages/database/dist", "packages/database/drizzle", "packages/engine/dist"];

async function inspect(path, count = { files: 0, bytes: 0 }) {
  const info = await lstat(path);
  if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory())) throw new Error(`Release input is not a regular file/directory: ${path}`);
  if (info.isFile()) { count.files++; count.bytes += info.size; }
  else for (const name of await readdir(path)) await inspect(join(path, name), count);
  if (count.files > MAX_FILES || count.bytes > MAX_BYTES) throw new Error("Release input exceeds the 10000-file/512-MiB bound.");
  return count;
}

async function digest(path) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(path)) {
    bytes += chunk.length;
    if (bytes > MAX_BYTES) throw new Error("Release artifact exceeds 512 MiB.");
    hash.update(chunk);
  }
  return { bytes, sha256: hash.digest("hex") };
}

function payload(version, artifact, bytes, sha256) {
  return { format: "aigate-release", version, artifact, bytes, sha256 };
}

export async function pack(outputDir, privateKeyPath) {
  const version = JSON.parse(await readFile(join(root, "apps/server/package.json"), "utf8")).version;
  if (typeof version !== "string" || !VERSION.test(version)) throw new Error("Server package version must be SemVer.");
  const key = createPrivateKey(await readFile(privateKeyPath));
  if (key.asymmetricKeyType !== "ed25519") throw new Error("An Ed25519 private key is required.");
  const output = resolve(outputDir);
  try { await lstat(output); throw new Error("Release output path already exists."); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  await mkdir(dirname(output), { recursive: true });
  const work = await mkdtemp(join(dirname(output), ".aigate-release-"));
  const stage = join(work, "payload");
  try {
    for (const relative of [...files, ...directories]) {
      const source = join(root, relative);
      await inspect(source);
      const destination = join(stage, relative);
      await mkdir(dirname(destination), { recursive: true });
      await cp(source, destination, { recursive: true, errorOnExist: true, force: false });
    }
    await inspect(stage);
    const artifact = `aigate-${version}.tar.gz`;
    const archivePath = join(work, artifact);
    await run("tar", ["-czf", archivePath, "-C", stage, "."], { timeout: 120_000 });
    const { bytes, sha256 } = await digest(archivePath);
    const unsigned = payload(version, artifact, bytes, sha256);
    const signature = sign(null, Buffer.from(JSON.stringify(unsigned)), key).toString("base64url");
    await writeFile(join(work, `aigate-${version}.manifest.json`), JSON.stringify({ ...unsigned, signature }, null, 2) + "\n", { flag: "wx" });
    await rm(stage, { recursive: true });
    await rename(work, output);
    return { ...unsigned, signature };
  } catch (error) {
    await rm(work, { recursive: true, force: true });
    throw error;
  }
}

export async function verifyRelease(manifestPath, publicKeyPath) {
  const info = await stat(manifestPath);
  if (info.size > 4096) throw new Error("Release manifest exceeds 4 KiB.");
  const value = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!value || typeof value !== "object" || Object.keys(value).sort().join(",") !== "artifact,bytes,format,sha256,signature,version" ||
      value.format !== "aigate-release" || typeof value.version !== "string" || !VERSION.test(value.version) ||
      value.artifact !== `aigate-${value.version}.tar.gz` || !Number.isSafeInteger(value.bytes) || value.bytes < 1 || value.bytes > MAX_BYTES ||
      typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sha256) ||
      typeof value.signature !== "string" || !/^[A-Za-z0-9_-]{86}$/.test(value.signature)) throw new Error("Invalid release manifest.");
  const key = createPublicKey(await readFile(publicKeyPath));
  if (key.asymmetricKeyType !== "ed25519") throw new Error("An Ed25519 public key is required.");
  const unsigned = payload(value.version, value.artifact, value.bytes, value.sha256);
  if (!verify(null, Buffer.from(JSON.stringify(unsigned)), key, Buffer.from(value.signature, "base64url"))) throw new Error("Release signature is invalid.");
  const actual = await digest(join(dirname(manifestPath), value.artifact));
  if (actual.bytes !== value.bytes || actual.sha256 !== value.sha256) throw new Error("Release artifact digest is invalid.");
  return unsigned;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , command, first, second] = process.argv;
  if (!first || !second || process.argv.length !== 5 || !["pack", "verify"].includes(command)) {
    console.error("Usage: release.mjs pack <new-output-dir> <private-key.pem> | verify <manifest.json> <public-key.pem>");
    process.exitCode = 2;
  } else {
    try { console.log(JSON.stringify(command === "pack" ? await pack(first, second) : await verifyRelease(first, second))); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
