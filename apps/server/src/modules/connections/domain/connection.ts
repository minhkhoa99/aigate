// Connection rules (docs/contracts/connections.md). Pure: no framework, database, or crypto imports.
import { parseBaseUrl } from "./provider-node.js";
export const MAX_NAME = 64;
// Printable ASCII, no spaces: a key can never break out of the Authorization header upstream.
const API_KEY = /^[\x21-\x7e]{8,4096}$/;

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

// apiKey "" means no key; the controller allows it only where the provider's auth is optional (ollama-local).
export interface NewConnection {
  provider: string;
  apiKey: string;
  name?: string;
  baseUrl?: string;
}

export interface ConnectionChanges {
  name?: string;
  apiKey?: string;
  isActive?: boolean;
  // null clears the connection's own base URL.
  baseUrl?: string | null;
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

// A missing or empty key is "" (connection.ollama-local-host); anything else must be a valid key.
const parseOptionalKey = (value: unknown): Parsed<string> => (value === undefined || value === "" ? { ok: true, value: "" } : parseApiKey(value));

export function parseNewConnection(input: unknown): Parsed<NewConnection> {
  const body = asBody(input, ["provider", "apiKey", "name", "baseUrl"]);
  if (!body.ok) return body;
  const { provider, apiKey, name, baseUrl } = body.value;
  if (typeof provider !== "string" || provider === "") return fail("provider must be a provider id");
  const key = parseOptionalKey(apiKey);
  if (!key.ok) return key;
  const value: NewConnection = { provider, apiKey: key.value };
  if (name !== undefined) {
    const parsedName = parseName(name);
    if (!parsedName.ok) return parsedName;
    value.name = parsedName.value;
  }
  if (baseUrl !== undefined && baseUrl !== "") {
    const parsedUrl = parseBaseUrl(baseUrl);
    if (!parsedUrl.ok) return parsedUrl;
    value.baseUrl = parsedUrl.value;
  }
  return { ok: true, value };
}

export function parseChanges(input: unknown): Parsed<ConnectionChanges> {
  const body = asBody(input, ["name", "apiKey", "isActive", "baseUrl"]);
  if (!body.ok) return body;
  const changes: ConnectionChanges = {};
  const { name, apiKey, isActive, baseUrl } = body.value;
  if (baseUrl !== undefined) {
    if (baseUrl === "" || baseUrl === null) changes.baseUrl = null;
    else {
      const parsed = parseBaseUrl(baseUrl);
      if (!parsed.ok) return parsed;
      changes.baseUrl = parsed.value;
    }
  }
  if (name !== undefined) {
    const parsed = parseName(name);
    if (!parsed.ok) return parsed;
    changes.name = parsed.value;
  }
  if (apiKey !== undefined) {
    const parsed = parseOptionalKey(apiKey);
    if (!parsed.ok) return parsed;
    changes.apiKey = parsed.value;
  }
  if (isActive !== undefined) {
    if (typeof isActive !== "boolean") return fail("isActive must be a boolean");
    changes.isActive = isActive;
  }
  return Object.keys(changes).length > 0 ? { ok: true, value: changes } : fail("Send at least one of name, apiKey, isActive, baseUrl");
}

export const keyHint = (apiKey: string): string => apiKey.slice(-4);
// A keyless connection (ollama-local) shows "no key".
export const maskHint = (hint: string): string => (hint === "" ? "no key" : `••••${hint}`);
// Authenticated with the sealed value, so it only opens for this row and field.
export const sealContext = (id: string): string => `provider_connections:${id}:api_key`;
