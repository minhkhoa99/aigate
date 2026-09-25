import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// scrypt from node:crypto (no bcrypt dependency). 128 * N * r = 32 MiB per hash; libuv's default
// four-thread pool bounds concurrent hashes, so peak memory stays bounded under a login flood.
const PARAMS = { N: 2 ** 15, r: 8, p: 1 };
const MAX_MEMORY = 64 * 1024 * 1024;
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { ...options, maxmem: MAX_MEMORY }, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, key] = stored.split("$");
  // Only the parameters this build writes are accepted, so a stored value cannot demand more work.
  if (scheme !== "scrypt" || Number(n) !== PARAMS.N || Number(r) !== PARAMS.r || Number(p) !== PARAMS.p || !salt || !key) return false;
  const expected = Buffer.from(key, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"), PARAMS);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
