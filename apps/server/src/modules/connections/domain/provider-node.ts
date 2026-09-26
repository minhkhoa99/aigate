// Custom provider rules (docs/contracts/custom-providers.md). Pure: no framework, database, or engine imports.
import type { Parsed } from "./connection.js";

export const MAX_NODES = 100;
const MAX_NAME = 64;
const MAX_URL = 2048;
const MAX_PREFIX = 200;
// The 9router default when a custom provider names no base URL (user decision 2026-09-26: keep 9router behavior).
export const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

export interface NodeFields {
  name: string;
  prefix: string;
  baseUrl: string;
}

const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

function parseName(value: unknown): Parsed<string> {
  const name = typeof value === "string" ? value.trim() : "";
  return name.length > 0 && name.length <= MAX_NAME ? { ok: true, value: name } : fail(`name must be 1-${MAX_NAME} characters`);
}

// 9router only trims the prefix (connection.provider-node-create-list). A reserved, duplicate, or "/"-containing
// prefix is stored as given; /v1 then never reaches it, and the dashboard marks the card Unreachable.
function parsePrefix(value: unknown): Parsed<string> {
  const prefix = typeof value === "string" ? value.trim() : "";
  return prefix.length > 0 && prefix.length <= MAX_PREFIX ? { ok: true, value: prefix } : fail(`prefix must be 1-${MAX_PREFIX} characters`);
}

// Stored trimmed, as 9router does: a pasted "/chat/completions" is kept, and one trailing "/" is dropped when the URL is built.
export function parseBaseUrl(value: unknown): Parsed<string> {
  const base = typeof value === "string" ? value.trim() : "";
  if (base === "" || base.length > MAX_URL || /\s/.test(base)) return fail(`baseUrl must be a URL of at most ${MAX_URL} characters, without spaces`);
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return fail("baseUrl is not a URL, e.g. https://api.example.com/v1");
  }
  // The key travels to this URL, so never in clear text off this machine (the transport enforces the same rule).
  if (url.protocol !== "https:" && !(url.protocol === "http:" && LOOPBACK.has(url.hostname))) {
    return fail("baseUrl must use https (http only to localhost, 127.0.0.1, or [::1])");
  }
  if (url.username || url.password) return fail("baseUrl must not contain a username or password; the API key goes on the connection");
  if (url.search || url.hash) return fail("baseUrl must not contain a query or fragment");
  return { ok: true, value: base };
}

function asBody(input: unknown): Parsed<Record<string, unknown>> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return fail("Body must be a JSON object");
  const body = Object.fromEntries(Object.entries(input));
  const unknown = Object.keys(body).find((key) => key !== "name" && key !== "prefix" && key !== "baseUrl");
  return unknown === undefined ? { ok: true, value: body } : fail(`${unknown} is not a field of a custom provider`);
}

export function parseNodeChanges(input: unknown): Parsed<Partial<NodeFields>> {
  const body = asBody(input);
  if (!body.ok) return body;
  const changes: Partial<NodeFields> = {};
  const parsers = { name: parseName, prefix: parsePrefix, baseUrl: parseBaseUrl } as const;
  for (const field of ["name", "prefix", "baseUrl"] as const) {
    if (body.value[field] === undefined) continue;
    const parsed = parsers[field](body.value[field]);
    if (!parsed.ok) return parsed;
    changes[field] = parsed.value;
  }
  return Object.keys(changes).length > 0 ? { ok: true, value: changes } : fail("Send at least one of name, prefix, baseUrl");
}

export function parseNewNode(input: unknown): Parsed<NodeFields> {
  const parsed = parseNodeChanges(input);
  if (!parsed.ok) return parsed;
  const { name, prefix, baseUrl } = parsed.value;
  if (name === undefined) return fail("name must be 1-64 characters");
  if (prefix === undefined) return fail("prefix is required");
  return { ok: true, value: { name, prefix, baseUrl: baseUrl ?? DEFAULT_BASE_URL } };
}
