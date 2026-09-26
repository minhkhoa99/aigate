import { CATALOG } from "./catalog/providers.generated.js";
import type { CatalogProvider } from "./catalog/schema.js";
import { defineRegistry, PROVIDER_PROTOCOLS, type ProviderDescriptor, type ProviderProtocol, type ProviderStatus } from "./registry.js";

// The runtime registry is the extracted catalog, filtered to what the adapters can serve today
// (docs/contracts/catalog-providers.md, provider-anthropic.md). The same rule gives every other provider its reason.

// The request path each family posts to, and the path its model list lives at.
const PATHS: Readonly<Record<ProviderProtocol, { chat: RegExp; models: string }>> = {
  "openai-compatible": { chat: /\/chat\/completions$/, models: "/models" },
  anthropic: { chat: /\/messages$/, models: "/models" },
};
// 9router forces streaming for these although the vendor answers non-streaming requests too
// (IMPLEMENTATION_ACCIDENT for OpenAI: the API accepts stream:false; SP3 tapes replay that way).
const STREAM_OPTIONAL = new Set(["openai"]);
// provider.codebuddy-request-quirks: what the 9router CodeBuddy executors change in the body.
const EXECUTOR_QUIRKS: Readonly<Record<string, readonly string[]>> = {
  "codebuddy-cn": ["reasoningSummary", "neutralAgentPrompt"],
  "codebuddy-intl": ["reasoningSummary"],
};
const BLOCKING_QUIRKS = new Map([["clineEnvelope", "Needs a provider-specific request envelope (SP14)"]]);
const PROTOCOL_REASONS: Readonly<Record<string, string>> = {
  service: "Media and search services come with SP22/SP23",
};
// provider.anthropic-auth-and-headers: the family always sends this version.
export const ANTHROPIC_VERSION = "2023-06-01";

const isProtocol = (value: string): value is ProviderProtocol => PROVIDER_PROTOCOLS.some((p) => p === value);

// A reason why the provider cannot be connected yet, or undefined when it can.
export function unsupportedReason(provider: CatalogProvider): string | undefined {
  if (!isProtocol(provider.protocol)) return PROTOCOL_REASONS[provider.protocol] ?? `Needs the ${provider.protocol} adapter (SP14)`;
  if (!provider.auth.kinds.includes("api-key")) {
    if (provider.auth.kinds.includes("oauth")) return "Needs OAuth sign-in (SP16)";
    if (provider.auth.kinds.includes("cookie")) return "Needs a web session (later)";
    return "Keyless providers come later";
  }
  if (provider.hidden) return "Hidden in the 9router catalog";
  if (provider.chatUrl === null) return "Each connection needs its own endpoint URL (later)";
  if (provider.chatUrl.includes("{")) return "The endpoint needs per-account data (later)";
  if (!PATHS[provider.protocol].chat.test(provider.chatUrl)) return "Non-standard endpoint (SP14)";
  const quirk = provider.quirks.find((q) => BLOCKING_QUIRKS.has(q));
  if (quirk) return BLOCKING_QUIRKS.get(quirk);
  return undefined;
}

export function toDescriptor(provider: CatalogProvider, chatUrl: string): ProviderDescriptor {
  const protocol: ProviderProtocol = isProtocol(provider.protocol) ? provider.protocol : "openai-compatible";
  const paths = PATHS[protocol];
  const headers = Object.fromEntries(Object.entries(provider.headers).map(([name, value]) => [name.toLowerCase(), value]));
  // 9router authenticates every API key of the Anthropic family with a raw x-api-key, whatever the entry says.
  const auth: ProviderDescriptor["auth"] = protocol === "anthropic"
    ? { kind: "api-key", header: "x-api-key", scheme: "raw" }
    : { kind: "api-key", header: provider.auth.header ?? "authorization", scheme: provider.auth.scheme === "raw" ? "raw" : "bearer" };
  return {
    id: provider.id,
    name: provider.name,
    protocol,
    chatUrl,
    // The family layout when the catalog names no models endpoint.
    modelsUrl: provider.modelsUrl ?? chatUrl.replace(paths.chat, paths.models),
    headers: protocol === "anthropic" ? { "anthropic-version": ANTHROPIC_VERSION, ...headers } : headers,
    aliases: provider.aliases,
    auth,
    models: provider.models.map((m) => ({
      id: m.id, name: m.name, kind: m.kind === "llm" ? "chat" : m.kind, capabilities: m.capabilities, contextWindow: m.contextWindow,
      // 9router mixes sources: tencent's registry declares a 200000 context while the *hunyuan* pattern
      // gives a 262144 output. An output limit above the context window is not trusted, so it is unknown.
      maxOutputTokens: m.contextWindow !== null && m.maxOutputTokens !== null && m.maxOutputTokens > m.contextWindow ? null : m.maxOutputTokens,
    })),
    quirks: [...provider.quirks, ...(EXECUTOR_QUIRKS[provider.id] ?? [])],
    ...(provider.forceStream && !STREAM_OPTIONAL.has(provider.id) ? { streamOnly: true } : {}),
  };
}

const statuses = new Map<string, ProviderStatus>();
const connectable: ProviderDescriptor[] = [];
for (const provider of CATALOG) {
  const reason = unsupportedReason(provider);
  // unsupportedReason returns undefined only for a provider with a chat URL.
  if (reason === undefined && provider.chatUrl !== null) connectable.push(toDescriptor(provider, provider.chatUrl));
  else statuses.set(provider.id, { connectable: false, reason: reason ?? "Each connection needs its own endpoint URL (later)" });
}

// Validated once at load; a bad entry fails startup, not a user request.
export const builtinRegistry = defineRegistry(connectable, statuses);
