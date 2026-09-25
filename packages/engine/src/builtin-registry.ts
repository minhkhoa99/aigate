import { CATALOG } from "./catalog/providers.generated.js";
import type { CatalogProvider } from "./catalog/schema.js";
import { defineRegistry, type ProviderDescriptor, type ProviderStatus } from "./registry.js";

// The runtime registry is the extracted catalog, filtered to what the openai-compatible adapter can
// serve today (docs/contracts/catalog-providers.md). The same rule gives every other provider its reason.

const CHAT_PATH = /\/chat\/completions$/;
// 9router forces streaming for these although the vendor answers non-streaming requests too
// (IMPLEMENTATION_ACCIDENT for OpenAI: the API accepts stream:false; SP3 tapes replay that way).
const STREAM_OPTIONAL = new Set(["openai"]);
const BLOCKING_QUIRKS = new Map([["clineEnvelope", "Needs a provider-specific request envelope (SP14)"]]);
const PROTOCOL_REASONS: Readonly<Record<string, string>> = {
  service: "Media and search services come with SP22/SP23",
};

// A reason why the provider cannot be connected yet, or undefined when it can.
export function unsupportedReason(provider: CatalogProvider): string | undefined {
  if (provider.protocol !== "openai-compatible") return PROTOCOL_REASONS[provider.protocol] ?? `Needs the ${provider.protocol} adapter (SP14)`;
  if (!provider.auth.kinds.includes("api-key")) {
    if (provider.auth.kinds.includes("oauth")) return "Needs OAuth sign-in (SP16)";
    if (provider.auth.kinds.includes("cookie")) return "Needs a web session (later)";
    return "Keyless providers come later";
  }
  if (provider.hidden) return "Hidden in the 9router catalog";
  if (provider.chatUrl === null) return "Each connection needs its own endpoint URL (later)";
  if (provider.chatUrl.includes("{")) return "The endpoint needs per-account data (later)";
  if (!CHAT_PATH.test(provider.chatUrl)) return "Non-standard endpoint (SP14)";
  const quirk = provider.quirks.find((q) => BLOCKING_QUIRKS.has(q));
  if (quirk) return BLOCKING_QUIRKS.get(quirk);
  if (provider.forceStream && !STREAM_OPTIONAL.has(provider.id)) return "Only answers streaming requests (SP14)";
  return undefined;
}

export function toDescriptor(provider: CatalogProvider, chatUrl: string): ProviderDescriptor {
  return {
    id: provider.id,
    name: provider.name,
    protocol: "openai-compatible",
    chatUrl,
    // The OpenAI layout when the catalog names no models endpoint.
    modelsUrl: provider.modelsUrl ?? chatUrl.replace(CHAT_PATH, "/models"),
    headers: Object.fromEntries(Object.entries(provider.headers).map(([name, value]) => [name.toLowerCase(), value])),
    aliases: provider.aliases,
    auth: { kind: "api-key", header: provider.auth.header ?? "authorization", scheme: provider.auth.scheme === "raw" ? "raw" : "bearer" },
    models: provider.models.map((m) => ({
      id: m.id, name: m.name, kind: m.kind === "llm" ? "chat" : m.kind, capabilities: m.capabilities, contextWindow: m.contextWindow,
      // 9router mixes sources: tencent's registry declares a 200000 context while the *hunyuan* pattern
      // gives a 262144 output. An output limit above the context window is not trusted, so it is unknown.
      maxOutputTokens: m.contextWindow !== null && m.maxOutputTokens !== null && m.maxOutputTokens > m.contextWindow ? null : m.maxOutputTokens,
    })),
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
