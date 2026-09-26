// Provider registry schema (spec §2 "schema thiết kế mới"). Entries are static data checked once at
// load: defineRegistry() rejects a bad entry loudly instead of letting it fail per request. SP13
// builds the entries from the extracted catalog (builtin-registry.ts; docs/contracts/catalog-providers.md).

export interface ModelCapabilities {
  readonly vision: boolean;
  readonly pdf: boolean;
  readonly audioInput: boolean;
  readonly videoInput: boolean;
  readonly tools: boolean;
  readonly reasoning: boolean;
}

// "chat" for the chat lane; the other catalog kinds (embedding, image, tts, stt, video, …) keep their names.
export type ModelKind = string;

export interface ModelDescriptor {
  readonly id: string;
  readonly name: string;
  readonly kind: ModelKind;
  // Declared capabilities are final: the name heuristic never changes them (catalog.capability-tier-fallback).
  readonly capabilities: ModelCapabilities;
  // null: the catalog declares no limit, and AIGate never invents one.
  readonly contextWindow: number | null;
  readonly maxOutputTokens: number | null;
}

export interface ProviderDescriptor {
  readonly id: string;
  readonly name: string;
  // Adapters are chosen by protocol family, not per vendor (spec §4.2 AIProviderPort; createAdapter).
  readonly protocol: ProviderProtocol;
  // The full chat request URL; modelsUrl lists models (the family layout when the catalog names none).
  readonly chatUrl: string;
  readonly modelsUrl: string;
  // Static request headers from the catalog; the auth header is always set after them.
  readonly headers: Readonly<Record<string, string>>;
  readonly aliases: readonly string[];
  readonly auth: { readonly kind: "api-key"; readonly header: string; readonly scheme: "bearer" | "raw" };
  readonly models: readonly ModelDescriptor[];
  // Catalog quirks an adapter reads (docs/contracts/provider-anthropic.md: requireClaudeToolType;
  // docs/contracts/stream-only-providers.md: reasoningSummary, neutralAgentPrompt).
  readonly quirks?: readonly string[];
  // The provider refuses non-streaming chat: execute() streams and collapses the answer (routing.forced-stream-json-collapse).
  readonly streamOnly?: boolean;
  // An Anthropic-compatible custom provider (connection.anthropic-compatible-node); official = 9router's api.anthropic.com test.
  readonly anthropicNode?: { readonly official: boolean };
}

export const PROVIDER_PROTOCOLS = ["openai-compatible", "anthropic", "openai-responses"] as const;
export type ProviderProtocol = (typeof PROVIDER_PROTOCOLS)[number];

// Why a catalog provider can or cannot be connected (the UI shows the reason).
export type ProviderStatus = { readonly connectable: true } | { readonly connectable: false; readonly reason: string };

export interface Registry {
  readonly providers: readonly ProviderDescriptor[];
  // By id or alias.
  provider(idOrAlias: string): ProviderDescriptor | undefined;
  model(providerId: string, modelId: string): ModelDescriptor | undefined;
  // Every catalog id, connectable or not; undefined for an id the catalog does not know.
  status(id: string): ProviderStatus | undefined;
}

const PROVIDER_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
// Model ids keep vendor spelling (dots, colons, slashes, "@cf/…"), but stay bounded and without whitespace.
export const MODEL_ID = /^[\x21-\x7e]{1,200}$/;
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

export class RegistryError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Invalid provider registry:\n- ${problems.join("\n- ")}`);
    this.name = "RegistryError";
    this.problems = problems;
  }
}

const positiveOrNull = (value: number | null) => value === null || (Number.isInteger(value) && value > 0);

function checkUrl(value: string, where: string, problems: string[]): void {
  try {
    const url = new URL(value);
    // Credentials never travel in clear text off this machine (the transport enforces the same rule).
    if (url.protocol !== "https:" && !(url.protocol === "http:" && LOOPBACK.has(url.hostname))) problems.push(`${where}: must use https (or http to this machine)`);
  } catch {
    problems.push(`${where}: is not a URL`);
  }
}

function checkProvider(provider: ProviderDescriptor, problems: string[]): void {
  const where = `provider ${provider.id}`;
  if (!PROVIDER_ID.test(provider.id)) problems.push(`${where}: id must match ${PROVIDER_ID}`);
  checkUrl(provider.chatUrl, `${where} chatUrl`, problems);
  checkUrl(provider.modelsUrl, `${where} modelsUrl`, problems);
  const seen = new Set<string>();
  for (const model of provider.models) {
    const at = `${where} model ${model.id}`;
    if (!MODEL_ID.test(model.id)) problems.push(`${at}: id must be 1-200 printable characters`);
    const key = `${model.kind}:${model.id}`;
    if (seen.has(key)) problems.push(`${at}: duplicate ${model.kind} model id`);
    seen.add(key);
    if (!positiveOrNull(model.contextWindow)) problems.push(`${at}: contextWindow must be a positive integer or null`);
    if (!positiveOrNull(model.maxOutputTokens)) problems.push(`${at}: maxOutputTokens must be a positive integer or null`);
    if (model.contextWindow !== null && model.maxOutputTokens !== null && model.maxOutputTokens > model.contextWindow) {
      problems.push(`${at}: maxOutputTokens exceeds contextWindow`);
    }
  }
}

// One model per id for lookups; when an id serves two lanes (Gemini 2.5: chat and stt), the chat model wins.
function modelIndex(models: readonly ModelDescriptor[]): Map<string, ModelDescriptor> {
  const index = new Map<string, ModelDescriptor>();
  for (const model of models) if (!index.has(model.id) || model.kind === "chat") index.set(model.id, model);
  return index;
}

export function defineRegistry(providers: readonly ProviderDescriptor[], statuses: ReadonlyMap<string, ProviderStatus> = new Map()): Registry {
  const problems: string[] = [];
  const byId = new Map<string, ProviderDescriptor>();
  for (const provider of providers) {
    checkProvider(provider, problems);
    if (byId.has(provider.id)) problems.push(`provider ${provider.id}: duplicate provider id`);
    byId.set(provider.id, provider);
  }
  if (problems.length > 0) throw new RegistryError(problems);
  // An alias never shadows an id; the first provider to claim an alias keeps it.
  const byAlias = new Map<string, ProviderDescriptor>();
  for (const provider of providers) for (const alias of provider.aliases) if (!byId.has(alias) && !byAlias.has(alias)) byAlias.set(alias, provider);
  const models = new Map(providers.map((p) => [p.id, modelIndex(p.models)]));
  return {
    providers,
    provider: (idOrAlias) => byId.get(idOrAlias) ?? byAlias.get(idOrAlias),
    model: (providerId, modelId) => models.get(providerId)?.get(modelId),
    status: (id) => (byId.has(id) ? { connectable: true } : statuses.get(id)),
  };
}
