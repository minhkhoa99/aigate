import { BadRequestException, Body, Controller, Header, HttpCode, HttpException, HttpStatus, Inject, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { DatabaseHandle } from "@aigate/database";
import { DATABASE } from "../../../database.provider.js";
import { LoginLimiter } from "../../identity/domain/login-limiter.js";
import { IdentityRepository } from "../../identity/infrastructure/identity.repo.js";
import { verifyPassword } from "../../identity/infrastructure/password-hasher.js";
import { readSessionToken } from "../../identity/infrastructure/session-cookie.js";
import { MAX_DATABASE_BYTES, backupHash, collectOwnedFiles, decryptBackup, encryptBackup, ownedFingerprint, prepareDatabaseImage, stageRestore, validPassphrase } from "./installation-backup.js";

export const BACKUP_CONFIG = Symbol("BACKUP_CONFIG");
export interface BackupConfig { dataDir: string; databaseFile: string; key: Buffer; envKey: boolean }
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const bad = (message: string) => new BadRequestException({ code: "INVALID_REQUEST", message });
const str = (body: Record<string, unknown>, key: string, min: number, max: number): string => {
  const value = body[key];
  if (typeof value !== "string" || value.length < min || value.length > max) throw bad(`${key} must be ${min}–${max} characters.`);
  return value;
};

@Controller("api/settings/backup")
export class InstallationBackupController {
  private readonly limiter = new LoginLimiter();
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle, private readonly identity: IdentityRepository,
    @Inject(BACKUP_CONFIG) private readonly config: BackupConfig) {}

  @Post("export") @HttpCode(200) @Header("Cache-Control", "no-store")
  async export(@Body() body: unknown, @Req() request: FastifyRequest) {
    const parsed = await this.authorize(body, request);
    try {
      const database = await prepareDatabaseImage(await this.database.snapshot(MAX_DATABASE_BYTES));
      const files = await collectOwnedFiles(this.config.dataDir);
      return await encryptBackup({ database, files, key: this.config.key, createdAt: new Date().toISOString() }, parsed.passphrase);
    } catch (error) { throw this.failure(error); }
  }

  @Post("preview") @HttpCode(200) @Header("Cache-Control", "no-store")
  async preview(@Body() body: unknown, @Req() request: FastifyRequest) {
    const parsed = await this.authorize(body, request);
    if (!Object.hasOwn(parsed.body, "document")) throw bad("document is required.");
    try {
      const imported = await decryptBackup(parsed.body.document, parsed.passphrase);
      await prepareDatabaseImage(imported.database);
      const current = await this.database.snapshot(MAX_DATABASE_BYTES);
      return { expectedVersion: await ownedFingerprint(current, this.config.dataDir), createdAt: imported.createdAt,
        databaseBytes: imported.database.length, files: Object.keys(imported.files).sort(),
        encrypted: true, restartRequired: true };
    } catch (error) { throw this.failure(error); }
  }

  @Post("apply") @HttpCode(200) @Header("Cache-Control", "no-store")
  async apply(@Body() body: unknown, @Req() request: FastifyRequest) {
    const parsed = await this.authorize(body, request);
    if (parsed.body.confirmation !== "RESTORE") throw bad("Type RESTORE to confirm replacement at next startup.");
    const version = str(parsed.body, "expectedVersion", 64, 64);
    if (!/^[a-f0-9]{64}$/.test(version) || !Object.hasOwn(parsed.body, "document")) throw bad("A reviewed backup and expectedVersion are required.");
    try {
      const imported = await decryptBackup(parsed.body.document, parsed.passphrase);
      imported.database = await prepareDatabaseImage(imported.database);
      if (this.config.envKey && !imported.key.equals(this.config.key)) throw Object.assign(new Error("AIGATE_SECRET_KEY conflicts with the backup key."), { code: "BACKUP_KEY_CONFLICT" });
      const current = await this.database.snapshot(MAX_DATABASE_BYTES);
      if (await ownedFingerprint(current, this.config.dataDir) !== version) throw Object.assign(new Error("The installation changed after preview."), { code: "BACKUP_CHANGED" });
      await stageRestore(this.config.dataDir, this.config.databaseFile, imported);
      return { staged: true, restartRequired: true, backupHash: backupHash(imported.database).slice(0, 16) };
    } catch (error) { throw this.failure(error); }
  }

  private async authorize(body: unknown, request: FastifyRequest): Promise<{ body: Record<string, unknown>; passphrase: string }> {
    const token = readSessionToken(request);
    if (!token || !(await this.identity.isSessionValid(token))) throw new HttpException({ code: "UNAUTHENTICATED", message: "Sign in before managing an installation backup." }, HttpStatus.UNAUTHORIZED);
    if (!object(body)) throw bad("A JSON object is required.");
    const password = str(body, "password", 1, 256);
    const passphrase = body.passphrase;
    if (!validPassphrase(passphrase)) throw bad("passphrase must be 12–1024 characters.");
    const lock = this.limiter.check(request.ip);
    if (lock.locked) throw new HttpException({ code: "RATE_LIMITED", message: "Too many incorrect passwords. Try again shortly." }, HttpStatus.TOO_MANY_REQUESTS);
    const hash = await this.identity.passwordHash();
    if (!hash || !(await verifyPassword(password, hash))) {
      this.limiter.fail(request.ip);
      throw new HttpException({ code: "INVALID_CREDENTIALS", message: "The current dashboard password did not match." }, HttpStatus.UNAUTHORIZED);
    }
    this.limiter.succeed(request.ip);
    return { body, passphrase };
  }

  private failure(error: unknown): HttpException {
    const known = ["BACKUP_INVALID", "BACKUP_TOO_LARGE", "BACKUP_CHANGED", "BACKUP_PENDING", "BACKUP_KEY_CONFLICT"];
    const supplied = object(error) && typeof error.code === "string" ? error.code : "";
    const code = known.includes(supplied) ? supplied : error instanceof RangeError ? "BACKUP_TOO_LARGE" : "INTERNAL_ERROR";
    const status = code === "BACKUP_TOO_LARGE" ? HttpStatus.PAYLOAD_TOO_LARGE : ["BACKUP_CHANGED", "BACKUP_PENDING", "BACKUP_KEY_CONFLICT"].includes(code) ? HttpStatus.CONFLICT : code === "INTERNAL_ERROR" ? HttpStatus.INTERNAL_SERVER_ERROR : HttpStatus.BAD_REQUEST;
    const message = error instanceof Error && ["BACKUP_TOO_LARGE", "BACKUP_CHANGED", "BACKUP_PENDING", "BACKUP_KEY_CONFLICT"].includes(code) ? error.message : "The backup could not be verified or applied.";
    return new HttpException({ code, message }, status);
  }
}
