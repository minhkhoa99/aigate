#!/usr/bin/env node
// tools/extract (docs/contracts/registry-extract.md): 9router's provider registry → AIGate catalog data.
//   pnpm extract          write packages/engine/src/catalog/providers.generated.ts (cli.mjs)
//   pnpm extract verify   diff the written catalog against the source, field by field (verify.mjs)
// Reads NINEROUTER_PATH (default .reference/9router). Imports 9router's own modules; changes no file there.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SOURCE = resolve(process.env.NINEROUTER_PATH ?? join(ROOT, ".reference/9router"));
const OUTPUT = join(ROOT, "packages/engine/src/catalog/providers.generated.ts");
const load = (path) => import(pathToFileURL(join(SOURCE, "open-sse/providers", path)).href);

const PROTOCOLS = {
  openai: "openai-compatible", claude: "anthropic", "openai-responses": "openai-responses", gemini: "gemini",
  "gemini-cli": "gemini-cli", vertex: "vertex", antigravity: "antigravity", kiro: "kiro", cursor: "cursor",
  commandcode: "commandcode", ollama: "ollama", "grok-web": "grok-web", "perplexity-web": "perplexity-web",
};
const CAPABILITY_KEYS = ["vision", "pdf", "audioInput", "videoInput", "tools", "reasoning"];
// Fields each part of the AIGate catalog models; any other field present is listed in `unmodelled`.
const MAPPED_TOP = new Set(["id", "alias", "aliases", "uiAlias", "display", "category", "transport", "models", "serviceKinds", "hidden", "noAuth", "authType", "authModes", "hasOAuth", "oauth", "priority"]);
const MAPPED_TRANSPORT = new Set(["baseUrl", "format", "auth", "modelsUrl", "validateUrl", "noAuth", "authType", "headers", "forceStream", "quirks"]);
const MAPPED_MODEL = new Set(["id", "name", "kind", "type", "upstreamModelId", "contextLength", "maxOutputTokens", "capabilities"]);
// A sentinel limit: any tier that states limits overwrites it, so a surviving sentinel means "not declared".
const UNDECLARED = -1;

export async function readSource() {
  const { default: registry } = await load("registry/index.js");
  const capabilities = await load("capabilities.js");
  const { normalizeModel, modelKind } = await load("models/schema.js");
  const commit = execFileSync("git", ["-C", SOURCE, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const version = JSON.parse(readFileSync(join(SOURCE, "package.json"), "utf8")).version;
  return { registry, capabilities, normalizeModel, modelKind, commit, version };
}

function protocolOf(entry) {
  if (!entry.transport) return "service";
  const format = entry.transport.format ?? "openai";
  const protocol = PROTOCOLS[format];
  if (!protocol) throw new Error(`${entry.id}: unknown transport.format "${format}"; add it to the catalog schema first`);
  return protocol;
}

function authOf(entry) {
  if (entry.noAuth || entry.transport?.noAuth) return { kinds: ["none"], header: null, scheme: null };
  const kinds = [];
  if (entry.category === "webCookie" || entry.authType === "cookie") kinds.push("cookie");
  if (entry.oauth || entry.hasOAuth || entry.authType === "oauth") kinds.push("oauth");
  if (entry.authModes?.includes("apikey") || kinds.length === 0) kinds.push("api-key");
  const auth = entry.transport?.auth;
  const header = kinds.includes("api-key") ? (auth?.header ?? "Authorization").toLowerCase() : null;
  const scheme = kinds.includes("api-key") ? (auth?.scheme === "raw" ? "raw" : "bearer") : null;
  return { kinds, header, scheme };
}

function modelOf(entry, raw, { capabilities, normalizeModel, modelKind }) {
  const model = normalizeModel(raw);
  const resolved = capabilities.getCapabilitiesForModel(entry.id, model.id);
  const caps = Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, Boolean(model.capabilities?.[key] ?? resolved[key])]));
  const contextWindow = model.contextLength ?? (resolved.contextWindow === UNDECLARED ? null : resolved.contextWindow);
  const maxOutputTokens = model.maxOutputTokens ?? (resolved.maxOutput === UNDECLARED ? null : resolved.maxOutput);
  const declared = contextWindow !== null || maxOutputTokens !== null;
  return {
    id: model.id,
    name: model.name ?? model.id,
    kind: modelKind(model),
    upstreamModelId: model.upstreamModelId ?? null,
    capabilities: caps,
    capabilitySource: declared ? "declared" : "default",
    contextWindow: declared ? contextWindow : null,
    maxOutputTokens: declared ? maxOutputTokens : null,
  };
}

function unmodelledOf(entry) {
  const names = new Set();
  for (const key of Object.keys(entry)) if (!MAPPED_TOP.has(key)) names.add(key);
  for (const key of Object.keys(entry.transport ?? {})) if (!MAPPED_TRANSPORT.has(key)) names.add(`transport.${key}`);
  if (entry.oauth) names.add("oauth");
  for (const model of entry.models ?? []) for (const key of Object.keys(model)) if (!MAPPED_MODEL.has(key)) names.add(`models[].${key}`);
  return [...names].sort();
}

export function buildCatalog(source) {
  const defaults = source.capabilities.DEFAULT_CAPABILITIES;
  const saved = { contextWindow: defaults.contextWindow, maxOutput: defaults.maxOutput };
  // In memory only, for this process: the floor's invented limits become the sentinel.
  Object.assign(defaults, { contextWindow: UNDECLARED, maxOutput: UNDECLARED });
  try {
    return source.registry.map((entry) => ({
      id: entry.id,
      name: entry.display?.name ?? entry.id,
      category: entry.category,
      aliases: [...new Set([entry.alias, ...(entry.aliases ?? []), entry.uiAlias].filter((a) => a && a !== entry.id))],
      protocol: protocolOf(entry),
      auth: authOf(entry),
      // An empty baseUrl means each connection brings its own (Azure).
      chatUrl: entry.transport?.baseUrl || null,
      modelsUrl: entry.transport?.modelsUrl ?? entry.transport?.validateUrl ?? null,
      headers: { ...entry.transport?.headers },
      forceStream: entry.transport?.forceStream === true,
      quirks: Object.keys(entry.transport?.quirks ?? {}).sort(),
      serviceKinds: entry.serviceKinds ?? [],
      hidden: Boolean(entry.hidden),
      deprecated: Boolean(entry.display?.deprecated),
      models: (entry.models ?? []).map((raw) => modelOf(entry, raw, source)),
      unmodelled: unmodelledOf(entry),
    }));
  } finally {
    Object.assign(defaults, saved);
  }
}

// One provider per block and one model per line, so a regenerated file diffs readably.
function render(catalog, source) {
  const provider = (p) => {
    const { models, ...rest } = p;
    const head = JSON.stringify(rest, null, 2).replace(/\n}$/, "").split("\n").map((l) => `  ${l}`).join("\n");
    const lines = models.map((m) => `      ${JSON.stringify(m)},`).join("\n");
    return `${head},\n    "models": [${models.length ? `\n${lines}\n    ` : ""}]\n  },`;
  };
  return [
    `// GENERATED by tools/extract from 9router ${source.version} (${source.commit}). Do not edit by hand:`,
    "// regenerate with `pnpm extract`, then check with `pnpm extract verify` (docs/contracts/registry-extract.md).",
    'import type { CatalogProvider } from "./schema.js";',
    "",
    "export const CATALOG: readonly CatalogProvider[] = [",
    ...catalog.map(provider),
    "];",
    "",
  ].join("\n");
}

export async function extract() {
  const source = await readSource();
  const catalog = buildCatalog(source);
  writeFileSync(OUTPUT, render(catalog, source));
  return { providers: catalog.length, models: catalog.reduce((n, p) => n + p.models.length, 0), version: source.version, commit: source.commit };
}

