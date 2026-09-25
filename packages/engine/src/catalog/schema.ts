import type { ModelCapabilities } from "../registry.js";

// The provider catalog extracted from 9router (docs/contracts/registry-extract.md). Static data:
// providers.generated.ts was written by tools/extract (SP4; removed in SP13b, restorable from git d2783c1)
// and is never edited by hand. SP13 turned it into the runtime registry.

export const CATALOG_PROTOCOLS = [
  "openai-compatible", "anthropic", "openai-responses", "gemini", "gemini-cli", "vertex", "antigravity",
  "kiro", "cursor", "commandcode", "ollama", "grok-web", "perplexity-web", "service",
] as const;
export type CatalogProtocol = (typeof CATALOG_PROTOCOLS)[number];

export type AuthKind = "api-key" | "oauth" | "cookie" | "none";

export interface CatalogAuth {
  readonly kinds: readonly AuthKind[];
  // How an API key travels, when the provider takes one.
  readonly header: string | null;
  readonly scheme: "bearer" | "raw" | null;
}

export interface CatalogModel {
  readonly id: string;
  readonly name: string;
  // chat, embedding, image, tts, … as 9router names them.
  readonly kind: string;
  // The id sent upstream when it differs from the catalog id.
  readonly upstreamModelId: string | null;
  readonly capabilities: ModelCapabilities;
  // "declared": 9router's tiers named this model; "default": only the floor applied, so no limits are known.
  readonly capabilitySource: "declared" | "default";
  readonly contextWindow: number | null;
  readonly maxOutputTokens: number | null;
}

export interface CatalogProvider {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly aliases: readonly string[];
  readonly protocol: CatalogProtocol;
  readonly auth: CatalogAuth;
  // The request URL as 9router uses it; null when each connection brings its own (Azure).
  readonly chatUrl: string | null;
  readonly modelsUrl: string | null;
  // Static request headers the provider expects (public constants, e.g. OpenRouter attribution); never credentials.
  readonly headers: Readonly<Record<string, string>>;
  // The upstream answers only streaming requests.
  readonly forceStream: boolean;
  // Names of 9router request quirks (behaviour flags); their handling belongs to the SP that models each.
  readonly quirks: readonly string[];
  readonly serviceKinds: readonly string[];
  readonly hidden: boolean;
  readonly deprecated: boolean;
  readonly models: readonly CatalogModel[];
  // Names of 9router fields AIGate does not model yet (never their values); the SP that models one removes it.
  readonly unmodelled: readonly string[];
}

const PROVIDER_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
// Model ids keep vendor spelling (Cloudflare "@cf/…", Bedrock "…:0"), but stay bounded and without whitespace.
const MODEL_ID = /^[\x21-\x7e]{1,200}$/;
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

function checkUrl(url: string | null, where: string, problems: string[]): void {
  if (url === null) return;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && LOOPBACK.has(parsed.hostname))) problems.push(`${where}: ${url} is neither https nor http to loopback`);
  } catch {
    problems.push(`${where}: ${url} is not a URL`);
  }
}

const positiveOrNull = (value: number | null) => value === null || (Number.isInteger(value) && value > 0);

// Every problem at once, so a bad extraction is fixed in one pass.
export function validateCatalog(catalog: readonly CatalogProvider[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const provider of catalog) {
    const where = `provider ${provider.id}`;
    if (!PROVIDER_ID.test(provider.id)) problems.push(`${where}: id must match ${PROVIDER_ID}`);
    if (ids.has(provider.id)) problems.push(`${where}: duplicate id`);
    ids.add(provider.id);
    if (!CATALOG_PROTOCOLS.includes(provider.protocol)) problems.push(`${where}: unknown protocol ${provider.protocol}`);
    if (provider.auth.kinds.length === 0) problems.push(`${where}: no auth kind`);
    checkUrl(provider.chatUrl, `${where} chatUrl`, problems);
    checkUrl(provider.modelsUrl, `${where} modelsUrl`, problems);
    // One id may serve several lanes (Gemini 2.5 is both a chat and an stt model), so (kind, id) is the key.
    const models = new Set<string>();
    for (const model of provider.models) {
      const at = `${where} model ${model.id}`;
      if (!MODEL_ID.test(model.id)) problems.push(`${at}: id must be 1-200 printable characters`);
      const key = `${model.kind}:${model.id}`;
      if (models.has(key)) problems.push(`${at}: duplicate ${model.kind} model id`);
      models.add(key);
      if (!positiveOrNull(model.contextWindow) || !positiveOrNull(model.maxOutputTokens)) problems.push(`${at}: limits must be positive integers or null`);
      if (model.capabilitySource === "default" && (model.contextWindow !== null || model.maxOutputTokens !== null)) problems.push(`${at}: an undeclared model must not carry limits`);
    }
  }
  return problems;
}
