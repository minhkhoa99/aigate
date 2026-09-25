import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { linkSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { Global, Module, type DynamicModule } from "@nestjs/common";

// SecretCipherPort (spec §4.2; docs/contracts/connections.md). Today: AES-256-GCM with a local key.
// The OS keychain is a later implementation behind the same port.
export interface SecretCipherPort {
  seal(plaintext: string, context: string): string;
  // Throws SecretUnreadableError when the value was sealed with another key, for another context, or tampered with.
  open(sealed: string, context: string): string;
}

export const SECRET_CIPHER = Symbol("SECRET_CIPHER");

export class SecretUnreadableError extends Error {
  constructor() {
    super("A stored secret could not be decrypted with the current secret key");
    this.name = "SecretUnreadableError";
  }
}

const VERSION = "v1.";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class AesGcmCipher implements SecretCipherPort {
  private readonly key: Buffer;

  constructor(key: Buffer) {
    if (key.length !== KEY_BYTES) throw new RangeError(`The secret key must be ${KEY_BYTES} bytes`);
    this.key = key;
  }

  seal(plaintext: string, context: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    // The context is authenticated, so a sealed value copied into another row does not open.
    cipher.setAAD(Buffer.from(context, "utf8"));
    const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return VERSION + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
  }

  open(sealed: string, context: string): string {
    const raw = sealed.startsWith(VERSION) ? Buffer.from(sealed.slice(VERSION.length), "base64url") : Buffer.alloc(0);
    if (raw.length < IV_BYTES + TAG_BYTES) throw new SecretUnreadableError();
    try {
      const decipher = createDecipheriv("aes-256-gcm", this.key, raw.subarray(0, IV_BYTES));
      decipher.setAAD(Buffer.from(context, "utf8"));
      decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
      return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
    } catch {
      throw new SecretUnreadableError();
    }
  }
}

function decodeKey(value: string, source: string): Buffer {
  const text = value.trim();
  const key = /^[0-9a-f]{64}$/i.test(text) ? Buffer.from(text, "hex") : Buffer.from(text, "base64");
  if (key.length !== KEY_BYTES) throw new Error(`${source} must hold a ${KEY_BYTES}-byte key as 64 hex characters or base64`);
  return key;
}

const errorCode = (error: unknown): unknown => (error instanceof Error && "code" in error ? error.code : undefined);

// AIGATE_SECRET_KEY wins; otherwise the key file, created once (owner-only) when absent. A file with
// the wrong content stops startup and is never overwritten: that would make every stored secret unreadable.
export function loadSecretKey(envValue: string | undefined, file: string): Buffer {
  if (envValue !== undefined && envValue !== "") return decodeKey(envValue, "AIGATE_SECRET_KEY");
  try {
    return decodeKey(readFileSync(file, "utf8"), file);
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
  }
  const key = randomBytes(KEY_BYTES);
  // Write a temp file whole, then link it into place: the link fails if the file exists, so the key
  // appears complete or not at all, and two processes starting together cannot write different keys.
  const temp = `${file}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  writeFileSync(temp, `${key.toString("base64")}\n`, { mode: 0o600, flag: "wx" });
  try {
    linkSync(temp, file);
    return key;
  } catch (error) {
    if (errorCode(error) === "EEXIST") return decodeKey(readFileSync(file, "utf8"), file);
    throw error;
  } finally {
    unlinkSync(temp);
  }
}

// Global, like DATABASE: every context that stores a secret injects SECRET_CIPHER.
@Global()
@Module({})
export class SecretsModule {
  static with(cipher: SecretCipherPort): DynamicModule {
    return { module: SecretsModule, providers: [{ provide: SECRET_CIPHER, useValue: cipher }], exports: [SECRET_CIPHER] };
  }
}
