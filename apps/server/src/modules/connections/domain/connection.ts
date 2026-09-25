// Connection rules (docs/contracts/connections.md). Pure: no framework, database, or crypto imports.
export const MAX_NAME = 64;
// Printable ASCII, no spaces: a key can never break out of the Authorization header upstream.
const API_KEY = /^[\x21-\x7e]{8,4096}$/;

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

export interface NewConnection {
  provider: string;
  apiKey: string;
  name?: string;
}

export interface ConnectionChanges {
  name?: string;
  apiKey?: string;
  isActive?: boolean;
}

type Body = Record<string, unknown>;
const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

function asBody(body: unknown, allowed: readonly string[]): Parsed<Body> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return fail("Body must be a JSON object");
  const entries = Object.fromEntries(Object.entries(body));
  const unknown = Object.keys(entries).find((key) => !allowed.includes(key));
  return unknown === undefined ? { ok: true, value: entries } : fail(`${unknown} is not a field of a connection`);
}

function parseName(value: unknown): Parsed<string> {
  const name = typeof value === "string" ? value.trim() : "";
  return name.length > 0 && name.length <= MAX_NAME ? { ok: true, value: name } : fail(`name must be 1-${MAX_NAME} characters`);
}

function parseApiKey(value: unknown): Parsed<string> {
  const key = typeof value === "string" ? value.trim() : "";
  return API_KEY.test(key) ? { ok: true, value: key } : fail("apiKey must be 8-4096 printable characters without spaces");
}

export function parseNewConnection(input: unknown): Parsed<NewConnection> {
  const body = asBody(input, ["provider", "apiKey", "name"]);
  if (!body.ok) return body;
  const { provider, apiKey, name } = body.value;
  if (typeof provider !== "string" || provider === "") return fail("provider must be a provider id");
  const key = parseApiKey(apiKey);
  if (!key.ok) return key;
  if (name === undefined) return { ok: true, value: { provider, apiKey: key.value } };
  const parsedName = parseName(name);
  return parsedName.ok ? { ok: true, value: { provider, apiKey: key.value, name: parsedName.value } } : parsedName;
}

export function parseChanges(input: unknown): Parsed<ConnectionChanges> {
  const body = asBody(input, ["name", "apiKey", "isActive"]);
  if (!body.ok) return body;
  const changes: ConnectionChanges = {};
  const { name, apiKey, isActive } = body.value;
  if (name !== undefined) {
    const parsed = parseName(name);
    if (!parsed.ok) return parsed;
    changes.name = parsed.value;
  }
  if (apiKey !== undefined) {
    const parsed = parseApiKey(apiKey);
    if (!parsed.ok) return parsed;
    changes.apiKey = parsed.value;
  }
  if (isActive !== undefined) {
    if (typeof isActive !== "boolean") return fail("isActive must be a boolean");
    changes.isActive = isActive;
  }
  return Object.keys(changes).length > 0 ? { ok: true, value: changes } : fail("Send at least one of name, apiKey, isActive");
}

export const keyHint = (apiKey: string): string => apiKey.slice(-4);
export const maskHint = (hint: string): string => `••••${hint}`;
// Authenticated with the sealed value, so it only opens for this row and field.
export const sealContext = (id: string): string => `provider_connections:${id}:api_key`;
