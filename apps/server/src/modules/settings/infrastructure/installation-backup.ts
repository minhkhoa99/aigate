import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt } from "node:crypto";
import { copyFile, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gunzipSync, gzipSync } from "node:zlib";
import { MIGRATIONS_FOLDER, openDatabase, sessions } from "@aigate/database";
import { sql } from "drizzle-orm";

export const MAX_DATABASE_BYTES = 64 * 1024 * 1024;
export const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_FILES_BYTES = 8 * 1024 * 1024;
const MAX_PLAIN_BYTES = 100 * 1024 * 1024;
const FORMAT = "aigate-installation-backup";
const OWNED_FILES = ["mcp-servers.json", "mitm/aigate-local-ca.pem", "mitm/aigate-local-ca.key", "mitm/aigate-local-ca.pfx",
  "mitm/aigate-mitm-leaf.pem", "mitm/aigate-mitm-leaf.key", "mitm/aigate-mitm-leaf.pfx"] as const;
const sha = (value: Buffer) => createHash("sha256").update(value).digest("hex");
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const coded = (code: string, message: string) => Object.assign(new Error(message), { code });
const base64 = (value: unknown, max: number): Buffer => {
  if (typeof value !== "string" || value.length > max || !/^[A-Za-z0-9_-]+$/.test(value)) throw coded("BACKUP_INVALID", "The backup is malformed or incomplete.");
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) throw coded("BACKUP_INVALID", "The backup encoding is invalid.");
  return decoded;
};

export interface BackupPayload { database: Buffer; key: Buffer; files: Record<string, Buffer>; createdAt: string }
export interface BackupDocument { format: string; version: number; salt: string; iv: string; tag: string; data: string }
export const backupHash = (value: Buffer) => sha(value);

export function validPassphrase(value: unknown): value is string {
  return typeof value === "string" && value.length >= 12 && value.length <= 1024;
}

async function encryptionKey(passphrase: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(passphrase, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
    (error, key) => error ? reject(error) : resolve(key)));
}

export async function encryptBackup(payload: BackupPayload, passphrase: string): Promise<BackupDocument> {
  if (!validPassphrase(passphrase)) throw coded("INVALID_REQUEST", "The backup passphrase must be 12–1024 characters.");
  const plain = Buffer.from(JSON.stringify({ createdAt: payload.createdAt, database: payload.database.toString("base64url"),
    key: payload.key.toString("base64url"), files: Object.fromEntries(Object.entries(payload.files).map(([name, file]) => [name, file.toString("base64url")])) }));
  if (plain.length > MAX_PLAIN_BYTES) throw coded("BACKUP_TOO_LARGE", "The backup exceeds the 64 MiB database limit.");
  const salt = randomBytes(16), iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", await encryptionKey(passphrase, salt), iv);
  cipher.setAAD(Buffer.from(`${FORMAT}:1`));
  const data = Buffer.concat([cipher.update(gzipSync(plain)), cipher.final()]);
  return { format: FORMAT, version: 1, salt: salt.toString("base64url"), iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), data: data.toString("base64url") };
}

export async function decryptBackup(document: unknown, passphrase: string): Promise<BackupPayload> {
  if (!validPassphrase(passphrase) || !object(document) || Object.keys(document).length !== 6 || document.format !== FORMAT || document.version !== 1) throw coded("BACKUP_INVALID", "The backup format or passphrase is invalid.");
  const salt = base64(document.salt, 32), iv = base64(document.iv, 24), tag = base64(document.tag, 32), data = base64(document.data, MAX_ARCHIVE_BYTES * 2);
  if (salt.length !== 16 || iv.length !== 12 || tag.length !== 16 || data.length > MAX_ARCHIVE_BYTES) throw coded("BACKUP_INVALID", "The backup size or encryption metadata is invalid.");
  let raw: Buffer;
  try {
    const decipher = createDecipheriv("aes-256-gcm", await encryptionKey(passphrase, salt), iv);
    decipher.setAAD(Buffer.from(`${FORMAT}:1`)); decipher.setAuthTag(tag);
    raw = gunzipSync(Buffer.concat([decipher.update(data), decipher.final()]), { maxOutputLength: MAX_PLAIN_BYTES });
  } catch { throw coded("BACKUP_INVALID", "The passphrase is wrong or the backup was changed."); }
  let value: unknown;
  try { value = JSON.parse(raw.toString("utf8")); } catch { throw coded("BACKUP_INVALID", "The backup content is invalid."); }
  if (!object(value) || Object.keys(value).length !== 4 || typeof value.createdAt !== "string" || !object(value.files)) throw coded("BACKUP_INVALID", "The backup content is incomplete.");
  const database = base64(value.database, MAX_DATABASE_BYTES * 2), key = base64(value.key, 64);
  if (database.length > MAX_DATABASE_BYTES || database.subarray(0, 16).toString("binary") !== "SQLite format 3\0" || key.length !== 32) throw coded("BACKUP_INVALID", "The backup database or key is invalid.");
  const files: Record<string, Buffer> = {};
  let total = 0;
  for (const [name, encoded] of Object.entries(value.files)) {
    if (!OWNED_FILES.some(owned => owned === name)) throw coded("BACKUP_INVALID", "The backup contains an unknown file.");
    const file = base64(encoded, MAX_FILE_BYTES * 2);
    total += file.length;
    if (file.length > MAX_FILE_BYTES || total > MAX_FILES_BYTES) throw coded("BACKUP_INVALID", "The backup contains an oversized file.");
    files[name] = file;
  }
  return { database, key, files, createdAt: value.createdAt };
}

const missing = (error: unknown) => object(error) && error.code === "ENOENT";
async function ownedParent(dataDir: string, name: string): Promise<void> {
  if (!name.startsWith("mitm/")) return;
  try {
    const info = await lstat(join(dataDir, "mitm"));
    if (!info.isDirectory()) throw coded("BACKUP_INVALID", "The managed MITM path is not a directory.");
  } catch (error) { if (!missing(error)) throw error; }
}
async function readOwned(path: string): Promise<Buffer | undefined> {
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.size > MAX_FILE_BYTES) throw coded("BACKUP_TOO_LARGE", "A managed data file is not a bounded regular file.");
    const data = await readFile(path);
    if (data.length > MAX_FILE_BYTES) throw coded("BACKUP_TOO_LARGE", "A managed data file changed during backup.");
    return data;
  } catch (error) { if (missing(error)) return undefined; throw error; }
}

export async function collectOwnedFiles(dataDir: string): Promise<Record<string, Buffer>> {
  const files: Record<string, Buffer> = {};
  let total = 0;
  for (const name of OWNED_FILES) {
    await ownedParent(dataDir, name);
    const file = await readOwned(join(dataDir, name));
    if (!file) continue;
    total += file.length;
    if (total > MAX_FILES_BYTES) throw coded("BACKUP_TOO_LARGE", "Managed files exceed the 8 MiB backup limit.");
    files[name] = file;
  }
  return files;
}

export async function prepareDatabaseImage(image: Buffer): Promise<Buffer> {
  const directory = await mkdtemp(join(tmpdir(), "aigate-backup-check-"));
  const file = join(directory, "aigate.db");
  try {
    await writeFile(file, image, { mode: 0o600 });
    // openDatabase runs migrations. Reject missing or newer schema before it can
    // turn an incomplete image into an apparently valid installation.
    const journal: unknown = JSON.parse(await readFile(join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8"));
    if (!object(journal) || !Array.isArray(journal.entries)) throw coded("BACKUP_INVALID", "The local migration history is unavailable.");
    const entries: unknown[] = journal.entries;
    const expected = entries.map(entry => {
      if (!object(entry) || typeof entry.when !== "number") throw coded("BACKUP_INVALID", "The local migration history is invalid.");
      return entry.when;
    });
    const raw = new DatabaseSync(file, { readOnly: true });
    try {
      const actual = raw.prepare("SELECT created_at FROM __drizzle_migrations ORDER BY created_at").all().map(row => Number(row.created_at));
      if (actual.length !== expected.length || actual.some((when, index) => when !== expected[index])) throw coded("BACKUP_INVALID", "The backup schema does not match this installation.");
    } finally { raw.close(); }
    const database = await openDatabase({ file, driver: "node-sqlite" });
    try {
      const rows = await database.db.all(sql`PRAGMA integrity_check`);
      if (rows.length !== 1 || !Array.isArray(rows[0]) || rows[0][0] !== "ok") throw coded("BACKUP_INVALID", "The backup database failed its integrity check.");
      await database.db.delete(sessions);
    } finally { await database.close(); }
    const prepared = await readFile(file);
    if (prepared.length > MAX_DATABASE_BYTES) throw coded("BACKUP_TOO_LARGE", "The prepared database exceeds the backup limit.");
    return prepared;
  } catch { throw coded("BACKUP_INVALID", "The backup database cannot be opened safely."); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

export async function ownedFingerprint(database: Buffer, dataDir: string): Promise<string> {
  const hash = createHash("sha256").update(database);
  for (const [name, file] of Object.entries(await collectOwnedFiles(dataDir)).sort(([a], [b]) => a.localeCompare(b))) hash.update(name).update(file);
  return hash.digest("hex");
}

interface StageManifest { files: Record<string, string | null> }
const stagePath = (dataDir: string) => join(dataDir, ".restore-pending");
const target = (dataDir: string, databaseFile: string, name: string) => name === "database" ? databaseFile : name === "database-wal" ? `${databaseFile}-wal` : name === "database-shm" ? `${databaseFile}-shm` : name === "secret.key" ? join(dirname(databaseFile), name) : join(dataDir, name);
const NAMES = ["database", "database-wal", "database-shm", "secret.key", ...OWNED_FILES];

export async function stageRestore(dataDir: string, databaseFile: string, payload: BackupPayload): Promise<void> {
  const stage = stagePath(dataDir);
  try { await mkdir(stage, { mode: 0o700 }); }
  catch (error) { if (object(error) && error.code === "EEXIST") throw coded("BACKUP_PENDING", "A restore is already staged for restart."); throw error; }
  try {
    const entries: Record<string, Buffer> = { database: payload.database, "secret.key": Buffer.from(`${payload.key.toString("base64")}\n`), ...payload.files };
    const files: StageManifest["files"] = {};
    for (const name of NAMES) {
      const data = entries[name]; files[name] = data ? sha(data) : null;
      if (!data) continue;
      const path = join(stage, "new", name);
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await writeFile(path, data, { mode: 0o600, flag: "wx" });
    }
    await writeFile(join(stage, "manifest.json"), JSON.stringify({ files }), { mode: 0o600, flag: "wx" });
  } catch (error) { await rm(stage, { recursive: true, force: true }); throw error; }
}

async function readManifest(stage: string): Promise<StageManifest> {
  let value: unknown;
  try { value = JSON.parse(await readFile(join(stage, "manifest.json"), "utf8")); } catch { throw coded("BACKUP_INVALID", "The staged restore manifest is missing."); }
  if (!object(value) || !object(value.files)) throw coded("BACKUP_INVALID", "The staged restore manifest is invalid.");
  const files = value.files;
  if (Object.keys(files).length !== NAMES.length) throw coded("BACKUP_INVALID", "The staged restore manifest is invalid.");
  const parsed: StageManifest["files"] = {};
  for (const name of NAMES) {
    const digest = files[name];
    if (!Object.hasOwn(files, name) || !(digest === null || (typeof digest === "string" && /^[a-f0-9]{64}$/.test(digest)))) throw coded("BACKUP_INVALID", "The staged restore manifest is invalid.");
    parsed[name] = digest;
  }
  return { files: parsed };
}

async function restorePriors(stage: string, dataDir: string, databaseFile: string, prior: Record<string, boolean>): Promise<void> {
  for (const name of NAMES) {
    const path = target(dataDir, databaseFile, name);
    await ownedParent(dataDir, name);
    if (prior[name]) { await mkdir(dirname(path), { recursive: true, mode: 0o700 }); await rm(path, { force: true }); await copyFile(join(stage, "prior", name), path); }
    else await rm(path, { force: true });
  }
}

async function savePrior(path: string, copy: string): Promise<boolean> {
  try {
    const info = await lstat(path);
    if (!info.isFile()) throw coded("BACKUP_INVALID", "An owned restore target is not a regular file.");
    await mkdir(dirname(copy), { recursive: true, mode: 0o700 });
    await copyFile(path, copy);
    return true;
  } catch (error) { if (missing(error)) return false; throw error; }
}

export async function applyPendingRestore(dataDir: string, databaseFile: string, envKey?: string): Promise<{ finalize(): Promise<void>; rollback(): Promise<void> } | undefined> {
  const stage = stagePath(dataDir);
  try { const info = await lstat(stage); if (!info.isDirectory()) throw coded("BACKUP_INVALID", "The restore staging path is not a directory."); }
  catch (error) { if (missing(error)) return undefined; throw error; }
  const marker = join(stage, "applying.json");
  try {
    const prior: unknown = JSON.parse(await readFile(marker, "utf8"));
    if (!object(prior) || NAMES.some(name => typeof prior[name] !== "boolean")) throw coded("BACKUP_INVALID", "The restore rollback manifest is invalid.");
    await restorePriors(stage, dataDir, databaseFile, Object.fromEntries(NAMES.map(name => [name, prior[name] === true])));
    await rm(stage, { recursive: true, force: true });
    return undefined;
  } catch (error) { if (!missing(error)) throw error; }
  const manifest = await readManifest(stage);
  for (const [name, digest] of Object.entries(manifest.files)) {
    if (digest === null) continue;
    const file = await readFile(join(stage, "new", name));
    if (sha(file) !== digest) throw coded("BACKUP_INVALID", "A staged restore file was changed.");
  }
  if (envKey) {
    const incoming = Buffer.from((await readFile(join(stage, "new", "secret.key"), "utf8")).trim(), "base64");
    const current = /^[a-f0-9]{64}$/i.test(envKey.trim()) ? Buffer.from(envKey.trim(), "hex") : Buffer.from(envKey.trim(), "base64");
    if (current.length !== 32 || !incoming.equals(current)) throw coded("BACKUP_KEY_CONFLICT", "AIGATE_SECRET_KEY does not match the staged backup key.");
  }
  const prior: Record<string, boolean> = {};
  for (const name of NAMES) {
    const path = target(dataDir, databaseFile, name);
    await ownedParent(dataDir, name);
    prior[name] = await savePrior(path, join(stage, "prior", name));
  }
  await writeFile(marker, JSON.stringify(prior), { mode: 0o600, flag: "wx" });
  const rollback = async () => { await restorePriors(stage, dataDir, databaseFile, prior); await rm(stage, { recursive: true, force: true }); };
  try {
    for (const [name, digest] of Object.entries(manifest.files)) {
      const path = target(dataDir, databaseFile, name);
      await ownedParent(dataDir, name);
      if (digest === null) { await rm(path, { force: true }); continue; }
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      const replacement = `${path}.aigate-restore-${randomBytes(8).toString("hex")}.tmp`;
      try {
        await writeFile(replacement, await readFile(join(stage, "new", name)), { mode: 0o600, flag: "wx" });
        await rename(replacement, path);
      } finally { await rm(replacement, { force: true }); }
    }
  } catch (error) { await rollback(); throw error; }
  return { rollback, finalize: () => rm(stage, { recursive: true, force: true }) };
}
