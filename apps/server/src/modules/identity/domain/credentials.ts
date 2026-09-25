// Body parsing for the auth routes. Bounds keep scrypt work per request predictable.
const MIN_NEW_PASSWORD = 8;
const MAX_PASSWORD = 256;

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

function field(body: unknown, key: string): unknown {
  return typeof body === "object" && body !== null && !Array.isArray(body) ? Object.getOwnPropertyDescriptor(body, key)?.value : undefined;
}

function newPassword(value: unknown, label: string): Parsed<string> {
  if (typeof value !== "string" || value.length < MIN_NEW_PASSWORD || value.length > MAX_PASSWORD) {
    return { ok: false, message: `${label} must be ${MIN_NEW_PASSWORD}-${MAX_PASSWORD} characters` };
  }
  return { ok: true, value };
}

function givenPassword(value: unknown, label: string): Parsed<string> {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_PASSWORD) {
    return { ok: false, message: `${label} is required and at most ${MAX_PASSWORD} characters` };
  }
  return { ok: true, value };
}

export function parseSetup(body: unknown): Parsed<string> {
  return newPassword(field(body, "password"), "password");
}

export function parseLogin(body: unknown): Parsed<string> {
  return givenPassword(field(body, "password"), "password");
}

export function parsePasswordChange(body: unknown): Parsed<{ currentPassword: string; newPassword: string }> {
  const current = givenPassword(field(body, "currentPassword"), "currentPassword");
  if (!current.ok) return current;
  const next = newPassword(field(body, "newPassword"), "newPassword");
  if (!next.ok) return next;
  return { ok: true, value: { currentPassword: current.value, newPassword: next.value } };
}

export function validateInitialPassword(value: string): Parsed<string> {
  return newPassword(value, "AIGATE_INITIAL_PASSWORD");
}
