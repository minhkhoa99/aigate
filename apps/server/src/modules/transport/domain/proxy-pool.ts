import { PROXY_POOL_TYPES, type ProxyPoolType } from "@aigate/database";

export interface NewProxyPool {
  name: string;
  proxyUrl: string;
  noProxy: string;
  type: ProxyPoolType;
  isActive: boolean;
  strictProxy: boolean;
}
export type ProxyPoolChanges = Partial<NewProxyPool>;
export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };
const fail = (message: string): Parsed<never> => ({ ok: false, message });

function body(input: unknown, fields: readonly string[]): Parsed<Record<string, unknown>> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return fail("Body must be a JSON object");
  const value = Object.fromEntries(Object.entries(input));
  const unknown = Object.keys(value).find((key) => !fields.includes(key));
  return unknown ? fail(`${unknown} is not a field of a proxy pool`) : { ok: true, value };
}

function name(value: unknown): Parsed<string> {
  const parsed = typeof value === "string" ? value.trim() : "";
  return parsed.length >= 1 && parsed.length <= 64 ? { ok: true, value: parsed } : fail("name must be 1-64 characters");
}

function proxyUrl(value: unknown, type: ProxyPoolType): Parsed<string> {
  if (typeof value !== "string" || value.trim() === "") return fail("proxyUrl must be an HTTP(S) URL");
  let parsed: URL;
  try { parsed = new URL(value.trim()); } catch { return fail("proxyUrl must be an HTTP(S) URL"); }
  if (!parsed.hostname || !["http:", "https:"].includes(parsed.protocol)) return fail("proxyUrl must be an HTTP(S) URL");
  if (parsed.username || parsed.password) return fail("proxyUrl must not embed credentials; use a relay URL without a password");
  if (type !== "http" && parsed.protocol !== "https:") return fail("A relay proxyUrl must use HTTPS");
  return { ok: true, value: parsed.toString().replace(/\/$/, "") };
}

function noProxy(value: unknown): Parsed<string> {
  if (value === undefined || value === null || value === "") return { ok: true, value: "" };
  if (typeof value !== "string" || value.length > 1024) return fail("noProxy must be a comma-separated list up to 1024 characters");
  const items = value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return items.length <= 100 && items.every((item) => item === "*" || /^\.?[a-z0-9.-]+$/.test(item))
    ? { ok: true, value: items.join(",") }
    : fail("noProxy must contain host names, .suffixes, or *");
}

function type(value: unknown): Parsed<ProxyPoolType> {
  const found = typeof value === "string" ? PROXY_POOL_TYPES.find((candidate) => candidate === value) : undefined;
  return found ? { ok: true, value: found } : fail(`type must be one of ${PROXY_POOL_TYPES.join(", ")}`);
}

function bool(value: unknown, field: string): Parsed<boolean> {
  return typeof value === "boolean" ? { ok: true, value } : fail(`${field} must be a boolean`);
}

export function parseNewProxyPool(input: unknown): Parsed<NewProxyPool> {
  const parsed = body(input, ["name", "proxyUrl", "noProxy", "type", "isActive", "strictProxy"]);
  if (!parsed.ok) return parsed;
  const poolType: Parsed<ProxyPoolType> = parsed.value.type === undefined ? { ok: true, value: "http" } : type(parsed.value.type);
  if (!poolType.ok) return poolType;
  const parsedName = name(parsed.value.name); if (!parsedName.ok) return parsedName;
  const parsedUrl = proxyUrl(parsed.value.proxyUrl, poolType.value); if (!parsedUrl.ok) return parsedUrl;
  const parsedNoProxy = noProxy(parsed.value.noProxy); if (!parsedNoProxy.ok) return parsedNoProxy;
  const active: Parsed<boolean> = parsed.value.isActive === undefined ? { ok: true, value: true } : bool(parsed.value.isActive, "isActive"); if (!active.ok) return active;
  const strict: Parsed<boolean> = parsed.value.strictProxy === undefined ? { ok: true, value: false } : bool(parsed.value.strictProxy, "strictProxy"); if (!strict.ok) return strict;
  return { ok: true, value: { name: parsedName.value, proxyUrl: parsedUrl.value, noProxy: parsedNoProxy.value, type: poolType.value, isActive: active.value, strictProxy: strict.value } };
}

export function parseProxyPoolChanges(input: unknown): Parsed<ProxyPoolChanges> {
  const parsed = body(input, ["name", "proxyUrl", "noProxy", "type", "isActive", "strictProxy"]);
  if (!parsed.ok) return parsed;
  if (Object.keys(parsed.value).length === 0) return fail("Send at least one proxy pool field");
  const changes: ProxyPoolChanges = {};
  const poolType = parsed.value.type === undefined ? undefined : type(parsed.value.type);
  if (poolType && !poolType.ok) return poolType;
  if (parsed.value.name !== undefined) { const value = name(parsed.value.name); if (!value.ok) return value; changes.name = value.value; }
  if (parsed.value.proxyUrl !== undefined) {
    const value = proxyUrl(parsed.value.proxyUrl, poolType?.value ?? "http"); if (!value.ok) return value; changes.proxyUrl = value.value;
  }
  if (poolType) changes.type = poolType.value;
  if (parsed.value.noProxy !== undefined) { const value = noProxy(parsed.value.noProxy); if (!value.ok) return value; changes.noProxy = value.value; }
  for (const field of ["isActive", "strictProxy"] as const) if (parsed.value[field] !== undefined) { const value = bool(parsed.value[field], field); if (!value.ok) return value; changes[field] = value.value; }
  return { ok: true, value: changes };
}

export function parseProxyPoolId(value: unknown): Parsed<string | null> {
  if (value === undefined || value === null || value === "" || value === "__none__") return { ok: true, value: null };
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? { ok: true, value } : fail("proxyPoolId must be a proxy pool id or __none__");
}
