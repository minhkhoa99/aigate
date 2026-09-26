import { CATALOG } from "./catalog/providers.generated.js";
import type { CatalogProvider } from "./catalog/schema.js";
import { defineRegistry, PROVIDER_PROTOCOLS, type ProviderDescriptor, type ProviderProtocol, type ProviderStatus } from "./registry.js";

// The runtime registry is the extracted catalog, filtered to what the adapters can serve today
// (docs/contracts/catalog-providers.md, provider-anthropic.md). The same rule gives every other provider its reason.

// The request path each family posts to, and the path its model list lives at.
const PATHS: Readonly<Record<ProviderProtocol, { chat: RegExp; models: string }>> = {
  "openai-compatible": { chat: /\/chat\/completions$/, models: "/models" },
  anthropic: { chat: /\/messages$/, models: "/models" },
  "openai-responses": { chat: /\/responses$/, models: "/models" },
  ollama: { chat: /\/api\/chat$/, models: "/api/tags" },
  // Gemini posts to <base>/<model>:generateContent; the base itself lists the models.
  gemini: { chat: /\/models$/, models: "/models" },
  // routing.vertex-endpoints: the catalog URL is the host; the adapter builds every path, and lists the catalog models.
  // translator.openai-to-commandcode-request: POST <host>/alpha/generate; the model list is the catalog.
  commandcode: { chat: /\/alpha\/generate$/, models: "/alpha/models" },
  vertex: { chat: /^https:\/\/aiplatform\.googleapis\.com$/, models: "https://aiplatform.googleapis.com/v1/publishers/google/models" },
};
// provider.vertex-google-auth: Google Cloud credentials; vertex-partner speaks OpenAI chat on a URL built from the project.
const GOOGLE_CLOUD = new Set(["vertex", "vertex-partner"]);
// provider.qoder-agent-transport: user decision (2026-09-26), not ported.
const NOT_PORTED = new Map([
  ["qoder", "Not supported: needs Qoder CLI impersonation"],
  ["qoder-cn", "Not supported: needs Qoder CLI impersonation"],
]);
// 9router forces streaming for these although the vendor answers non-streaming requests too
// (IMPLEMENTATION_ACCIDENT for OpenAI: the API accepts stream:false; SP3 tapes replay that way).
const STREAM_OPTIONAL = new Set(["openai"]);
// provider.codebuddy-request-quirks: what the 9router CodeBuddy executors change in the body.
// connection.ollama-local-host: the key is optional and each connection may name its own host.
const OLLAMA_LOCAL = { connectionBaseUrl: { chatPath: "/api/chat", modelsPath: "/api/tags" } } as const;
// translator.cloudflare-content-flatten: Workers AI takes string content only.
const EXECUTOR_QUIRKS: Readonly<Record<string, readonly string[]>> = {
  "codebuddy-cn": ["reasoningSummary", "neutralAgentPrompt"],
  "codebuddy-intl": ["reasoningSummary"],
  "cloudflare-ai": ["flattenContent"],
};
// provider.clinepass-headers-envelope: the Cline client headers, naming AIGate (user decision 2026-09-26; 9router names
// itself). ponytail: AIGate has no release version yet; 0.1.0 until it does.
const CLIENT_VERSION = "0.1.0";
const EXTRA_HEADERS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  clinepass: {
    "user-agent": `AIGate/${CLIENT_VERSION}`, "x-platform": process.platform, "x-platform-version": process.version, "x-client-type": "aigate",
    "x-client-version": CLIENT_VERSION, "x-core-version": CLIENT_VERSION, "x-is-multiroot": "false",
  },
};
// connection.azure-openai-deployment (kept as 9router, user decision 2026-09-26) and connection.cloudflare-account-id:
// each connection fills the URL, and the connection test posts a one-token chat. provider.clinepass-headers-envelope:
// Cline answers GET /models with 200 even without a key, so its test is a one-token chat too (user decision 2026-09-26).
const PROBE_MESSAGES = [{ role: "user", content: "test" }];
const firstModelProbe = (provider: CatalogProvider, invalidStatuses: readonly number[]): ProviderDescriptor["chatProbe"] => {
  const model = provider.models[0]?.id ?? "";
  return { model, body: { model, messages: PROBE_MESSAGES, max_tokens: 1 }, invalidStatuses };
};
const PER_CONNECTION: Readonly<Record<string, (provider: CatalogProvider) => Partial<ProviderDescriptor>>> = {
  azure: () => ({
    chatUrl: "{baseUrl}/openai/deployments/{deployment}/chat/completions?api-version={apiVersion}",
    modelsUrl: "{baseUrl}/openai/models?api-version={apiVersion}",
    auth: { kind: "api-key", header: "api-key", scheme: "raw" },
    // An empty deployment is the request model, as in 9router.
    connectionFields: { required: ["baseUrl"], optional: ["deployment", "apiVersion", "organization"], defaults: { deployment: "{model}", apiVersion: "2024-10-01-preview" } },
    chatProbe: { model: "gpt-4", body: { messages: PROBE_MESSAGES, max_completion_tokens: 1 }, invalidStatuses: [401, 403] },
  }),
  "cloudflare-ai": (provider) => ({ connectionFields: { required: ["accountId"], optional: [] }, chatProbe: firstModelProbe(provider, [401, 403, 404]) }),
  clinepass: (provider) => ({ chatProbe: firstModelProbe(provider, [401, 403]) }),
};
const PROTOCOL_REASONS: Readonly<Record<string, string>> = {
  service: "Media and search services come with SP22/SP23",
};
// provider.anthropic-auth-and-headers: the family always sends this version.
export const ANTHROPIC_VERSION = "2023-06-01";

const isProtocol = (value: string): value is ProviderProtocol => PROVIDER_PROTOCOLS.some((p) => p === value);

// A reason why the provider cannot be connected yet, or undefined when it can.
export function unsupportedReason(provider: CatalogProvider): string | undefined {
  const notPorted = NOT_PORTED.get(provider.id);
  if (notPorted) return notPorted;
  // assemblyai and deepgram have no transport format, so the catalog calls them openai-compatible; they only transcribe.
  // ponytail: speech-to-text only; nanobanana (image-only, connectable since SP13) is left for SP22 to decide.
  if (provider.serviceKinds.length > 0 && provider.serviceKinds.every((kind) => kind === "stt")) return PROTOCOL_REASONS.service;
  if (!isProtocol(provider.protocol)) return PROTOCOL_REASONS[provider.protocol] ?? `Needs the ${provider.protocol} adapter (SP14)`;
  if (!provider.auth.kinds.includes("api-key")) {
    if (provider.auth.kinds.includes("oauth")) return "Needs OAuth sign-in (SP16)";
    if (provider.auth.kinds.includes("cookie")) return "Needs a web session (later)";
    return "Keyless providers come later";
  }
  if (provider.hidden) return "Hidden in the 9router catalog";
  if (PER_CONNECTION[provider.id]) return undefined;
  if (provider.chatUrl === null) return "Each connection needs its own endpoint URL (later)";
  if (provider.chatUrl.includes("{")) return "The endpoint needs per-account data (later)";
  if (!GOOGLE_CLOUD.has(provider.id) && !PATHS[provider.protocol].chat.test(provider.chatUrl)) return "Non-standard endpoint (SP14)";
  return undefined;
}

export function toDescriptor(provider: CatalogProvider, chatUrl: string): ProviderDescriptor {
  const protocol: ProviderProtocol = isProtocol(provider.protocol) ? provider.protocol : "openai-compatible";
  const paths = PATHS[protocol];
  const headers = { ...Object.fromEntries(Object.entries(provider.headers).map(([name, value]) => [name.toLowerCase(), value])), ...EXTRA_HEADERS[provider.id] };
  // 9router authenticates every API key of the Anthropic family with a raw x-api-key, whatever the entry says.
  const auth: ProviderDescriptor["auth"] = protocol === "anthropic"
    ? { kind: "api-key", header: "x-api-key", scheme: "raw" }
    // translator.openai-to-gemini-request: an API key goes in x-goog-api-key (the catalog records the OAuth header).
    : protocol === "gemini" ? { kind: "api-key", header: "x-goog-api-key", scheme: "raw" }
    // provider.vertex-google-auth: an API key goes in x-goog-api-key (9router: the URL); a JSON credential becomes a Bearer token.
    : GOOGLE_CLOUD.has(provider.id) ? { kind: "api-key", header: "x-goog-api-key", scheme: "raw", googleCloud: true }
    : { kind: "api-key", header: provider.auth.header ?? "authorization", scheme: provider.auth.scheme === "raw" ? "raw" : "bearer", ...(provider.id === "ollama-local" ? { optional: true } : {}) };
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
    ...(provider.id === "ollama-local" ? OLLAMA_LOCAL : {}),
    ...(provider.forceStream && !STREAM_OPTIONAL.has(provider.id) ? { streamOnly: true } : {}),
    ...PER_CONNECTION[provider.id]?.(provider),
  };
}

const statuses = new Map<string, ProviderStatus>();
const connectable: ProviderDescriptor[] = [];
for (const provider of CATALOG) {
  const reason = unsupportedReason(provider);
  // unsupportedReason returns undefined only for a provider with a chat URL, or one whose connection supplies it (azure).
  if (reason === undefined) connectable.push(toDescriptor(provider, provider.chatUrl ?? ""));
  else statuses.set(provider.id, { connectable: false, reason });
}

// Validated once at load; a bad entry fails startup, not a user request.
export const builtinRegistry = defineRegistry(connectable, statuses);
