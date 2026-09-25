// API key rules (docs/contracts/identity-apikeys.md). Pure: no framework or crypto imports.
export const KEY_PREFIX = "aigate_";
// The prefix plus 32 random bytes in base64url.
const KEY_PATTERN = /^aigate_[A-Za-z0-9_-]{43}$/;
export const MAX_KEYS = 100;
const MAX_NAME = 64;

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

export function isWellFormedKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

export function maskKey(lastFour: string): string {
  return `${KEY_PREFIX}••••${lastFour}`;
}

type Headers = Record<string, string | string[] | undefined>;

// endpoint.extract-header-order: Bearer first, then x-api-key; any other Authorization scheme is ignored.
export function extractApiKey(headers: Headers): string | undefined {
  const authorization = headers.authorization;
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    const key = authorization.slice("Bearer ".length).trim();
    if (key) return key;
  }
  const header = headers["x-api-key"];
  return typeof header === "string" && header ? header : undefined;
}

function onlyKey(body: unknown, key: string): unknown {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return undefined;
  const keys = Object.keys(body);
  return keys.length === 1 && keys[0] === key ? Object.getOwnPropertyDescriptor(body, key)?.value : undefined;
}

export function parseKeyName(body: unknown): Parsed<string> {
  const raw = onlyKey(body, "name");
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name.length === 0 || name.length > MAX_NAME) return { ok: false, message: `name must be 1-${MAX_NAME} characters` };
  return { ok: true, value: name };
}

export function parseKeyStatus(body: unknown): Parsed<boolean> {
  const isActive = onlyKey(body, "isActive");
  return typeof isActive === "boolean" ? { ok: true, value: isActive } : { ok: false, message: "Body must be { isActive: boolean }" };
}
