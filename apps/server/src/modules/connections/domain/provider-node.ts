// Custom provider rules (docs/contracts/custom-providers.md). Pure: no framework, database, or engine imports.
import type { Parsed } from "./connection.js";

export const MAX_NODES = 100;
const MAX_NAME = 64;
const MAX_URL = 2048;
const MAX_PREFIX = 200;
export const NODE_TYPES = ["openai-compatible", "anthropic-compatible"] as const;
export type NodeType = (typeof NODE_TYPES)[number];
// connection.provider-node-api-type: the OpenAI API an openai-compatible node speaks.
export const API_TYPES = ["chat", "responses"] as const;
export type ApiType = (typeof API_TYPES)[number];
// The 9router defaults when a custom provider names no base URL (user decisions 2026-09-26: keep 9router behavior).
export const DEFAULT_BASE_URLS: Readonly<Record<NodeType, string>> = {
  "openai-compatible": "https://api.openai.com/v1",
  "anthropic-compatible": "https://api.anthropic.com/v1",
};
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

export interface NodeFields {
  type: NodeType;
  apiType: ApiType;
  name: string;
  prefix: string;
  baseUrl: string;
}
export type NodeChanges = Partial<Omit<NodeFields, "type">>;

const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });
const isNodeType = (value: unknown): value is NodeType => NODE_TYPES.some((type) => type === value);
const isApiType = (value: unknown): value is ApiType => API_TYPES.some((apiType) => apiType === value);

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

// connection.anthropic-compatible-node: one trailing "/" and then a pasted "/messages" are removed, on create and update.
function stored(type: NodeType, base: string): string {
  if (type !== "anthropic-compatible") return base;
  const trimmed = base.replace(/\/$/, "");
  return trimmed.endsWith("/messages") ? trimmed.slice(0, -"/messages".length) : trimmed;
}

function asBody(input: unknown): Parsed<Record<string, unknown>> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return fail("Body must be a JSON object");
  const body = Object.fromEntries(Object.entries(input));
  const unknown = Object.keys(body).find((key) => !["type", "apiType", "name", "prefix", "baseUrl"].includes(key));
  return unknown === undefined ? { ok: true, value: body } : fail(`${unknown} is not a field of a custom provider`);
}

function parseFields(body: Record<string, unknown>, type: NodeType): Parsed<NodeChanges> {
  const changes: NodeChanges = {};
  if (body.apiType !== undefined) {
    if (type !== "openai-compatible") return fail("apiType applies only to OpenAI-compatible providers");
    if (!isApiType(body.apiType)) return fail(`apiType must be ${API_TYPES.join(" or ")}`);
    changes.apiType = body.apiType;
  }
  const parsers = { name: parseName, prefix: parsePrefix, baseUrl: parseBaseUrl } as const;
  for (const field of ["name", "prefix", "baseUrl"] as const) {
    if (body[field] === undefined) continue;
    const parsed = parsers[field](body[field]);
    if (!parsed.ok) return parsed;
    changes[field] = field === "baseUrl" ? stored(type, parsed.value) : parsed.value;
  }
  return { ok: true, value: changes };
}

// The type is fixed at creation (connection.provider-node-update-delete).
export function parseNodeChanges(input: unknown, type: NodeType): Parsed<NodeChanges> {
  const body = asBody(input);
  if (!body.ok) return body;
  if (body.value.type !== undefined) return fail("type cannot be changed; add a new custom provider instead");
  const parsed = parseFields(body.value, type);
  if (!parsed.ok) return parsed;
  return Object.keys(parsed.value).length > 0 ? parsed : fail("Send at least one of name, prefix, baseUrl, apiType");
}

export function parseNewNode(input: unknown): Parsed<NodeFields> {
  const body = asBody(input);
  if (!body.ok) return body;
  const type = body.value.type ?? "openai-compatible";
  if (!isNodeType(type)) return fail(`type must be ${NODE_TYPES.join(" or ")}`);
  const parsed = parseFields(body.value, type);
  if (!parsed.ok) return parsed;
  const { name, prefix, baseUrl, apiType } = parsed.value;
  if (name === undefined) return fail(`name must be 1-${MAX_NAME} characters`);
  if (prefix === undefined) return fail("prefix is required");
  // 9router refuses a missing apiType; AIGate keeps chat, the only API before SP14c, so older clients still work.
  return { ok: true, value: { type, apiType: apiType ?? "chat", name, prefix, baseUrl: baseUrl ?? stored(type, DEFAULT_BASE_URLS[type]) } };
}
