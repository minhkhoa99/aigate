import { CATALOG } from "./catalog/providers.generated.js";
import type { CatalogProvider } from "./catalog/schema.js";
import { OAUTH_PROVIDERS } from "./oauth.js";
import { defineRegistry, PROVIDER_PROTOCOLS, type ProviderDescriptor, type ProviderProtocol, type ProviderStatus } from "./registry.js";
import { ANTIGRAVITY_IDE_BASE_URL, ANTIGRAVITY_MODELS_URL } from "./adapters/antigravity-config.js";

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
  antigravity: { chat: /daily-cloudcode-pa\.googleapis\.com$/, models: "/v1internal:models" },
  cursor: { chat: /api2\.cursor\.sh$/, models: "" },
  // routing.vertex-endpoints: the catalog URL is the host; the adapter builds every path, and lists the catalog models.
  // translator.openai-to-commandcode-request: POST <host>/alpha/generate; the model list is the catalog.
  commandcode: { chat: /\/alpha\/generate$/, models: "/alpha/models" },
  kiro: { chat: /\/generateAssistantResponse$/, models: "/ListAvailableModels" },
  trae: { chat: /\/chat_sessions$/, models: "/chat_sessions" },
  vertex: { chat: /^https:\/\/aiplatform\.googleapis\.com$/, models: "https://aiplatform.googleapis.com/v1/publishers/google/models" },
};
// provider.vertex-google-auth: Google Cloud credentials; vertex-partner speaks OpenAI chat on a URL built from the project.
const GOOGLE_CLOUD = new Set(["vertex", "vertex-partner"]);
// Qoder CN's older agent transport remains outside the International integration.
const NOT_PORTED = new Map([
  ["qoder-cn", "Not supported: needs Qoder CLI impersonation"],
]);
// (IMPLEMENTATION_ACCIDENT for OpenAI: the API accepts stream:false; SP3 tapes replay that way).
const STREAM_OPTIONAL = new Set(["openai"]);
// connection.ollama-local-host: the key is optional and each connection may name its own host.
const OLLAMA_LOCAL = { connectionBaseUrl: { chatPath: "/api/chat", modelsPath: "/api/tags" } } as const;
// translator.cloudflare-content-flatten: Workers AI takes string content only.
const EXECUTOR_QUIRKS: Readonly<Record<string, readonly string[]>> = {
  "codebuddy-cn": ["reasoningSummary", "neutralAgentPrompt"],
  "codebuddy-intl": ["reasoningSummary"],
  "cloudflare-ai": ["flattenContent"],
  // provider.cline-oauth: a Cline OAuth token (a WorkOS JWT) is sent as "workos:<jwt>".
  cline: ["clineAuth"],
  clinepass: ["clineAuth"],
  // provider.kimchi-browser-token: the KimchiExecutor body adjustments, for both sign-ins.
  kimchi: ["kimchi"],
  // CodexExecutor body, URL and model list.
  claude: ["claudeCode"],
  codex: ["codex"],
  github: ["copilot"],
  "gemini-cli": ["geminiCli"],
  antigravity: ["antigravity"],
  "grok-cli": ["grokCli"],
  kimi: ["kimi"],
  iflow: ["iflow"],
  qoder: ["qoder"],
};
// itself). ponytail: AIGate has no release version yet; 0.1.0 until it does.
const CLIENT_VERSION = "0.1.0";
const CLINE_HEADERS = {
  "user-agent": `AIGate/${CLIENT_VERSION}`, "x-platform": process.platform, "x-platform-version": process.version, "x-client-type": "aigate",
  "x-client-version": CLIENT_VERSION, "x-core-version": CLIENT_VERSION, "x-is-multiroot": "false",
};
const EXTRA_HEADERS: Readonly<Record<string, Readonly<Record<string, string>>>> = { clinepass: CLINE_HEADERS, cline: CLINE_HEADERS };
const traeNames: readonly [string, string][] = [
  ["auto", "Auto (Server Picks)"], ["work", "Work (Fast)"], ["gemini-3.1-pro", "Gemini 3.1 Pro"], ["gemini-3-flash-solo", "Gemini 3 Flash"],
  ["minimax-m3", "MiniMax M3"], ["minimax-m2.7", "MiniMax M2.7"], ["kimi-k2.5", "Kimi K2.5"], ["gpt-5.4", "GPT 5.4"], ["gpt-5.2", "GPT 5.2"],
];
const TRAE: CatalogProvider = {
  id: "trae", name: "Trae", category: "oauth", aliases: ["tr", "marscode"], protocol: "trae",
  auth: { kinds: ["oauth"], header: null, scheme: null }, chatUrl: "https://core-normal.trae.ai/api/remote/v1/chat_sessions", modelsUrl: "https://core-normal.trae.ai/api/remote/v1/chat_sessions",
  headers: { "X-Trae-Client-Type": "web", "X-Preferenced-Language": "en", Referer: "https://solo.trae.ai/" }, forceStream: false, quirks: [], serviceKinds: [], hidden: false, deprecated: false, unmodelled: [],
  models: traeNames.map(([id, name]) => ({ id, name, kind: "llm", upstreamModelId: null, capabilities: { vision: false, pdf: false, audioInput: false, videoInput: false, tools: true, reasoning: false }, capabilitySource: "default", contextWindow: null, maxOutputTokens: null })),
};
const PORTED_CATALOG = [...CATALOG, TRAE];
// each connection fills the URL, and the connection test posts a one-token chat. provider.clinepass-headers-envelope:
// Cline answers GET /models with 200 even without a key, so its test is a one-token chat too (user decision 2026-09-26).
const PROBE_MESSAGES = [{ role: "user", content: "test" }];
const CLINE_RECOMMENDED_URL = "https://api.cline.bot/api/v1/ai/cline/recommended-models";
const firstModelProbe = (provider: CatalogProvider, invalidStatuses: readonly number[]): ProviderDescriptor["chatProbe"] => {
  const model = provider.models[0]?.id ?? "";
  return { model, body: { model, messages: PROBE_MESSAGES, max_tokens: 1 }, invalidStatuses };
};
const PER_CONNECTION: Readonly<Record<string, (provider: CatalogProvider) => Partial<ProviderDescriptor>>> = {
  azure: () => ({
    chatUrl: "{baseUrl}/openai/deployments/{deployment}/chat/completions?api-version={apiVersion}",
    modelsUrl: "{baseUrl}/openai/models?api-version={apiVersion}",
    auth: { kind: "api-key", header: "api-key", scheme: "raw" },
    connectionFields: { required: ["baseUrl"], optional: ["deployment", "apiVersion", "organization"], defaults: { deployment: "{model}", apiVersion: "2024-10-01-preview" } },
    chatProbe: { model: "gpt-4", body: { messages: PROBE_MESSAGES, max_completion_tokens: 1 }, invalidStatuses: [401, 403] },
  }),
  "cloudflare-ai": (provider) => ({ connectionFields: { required: ["accountId"], optional: [] }, chatProbe: firstModelProbe(provider, [401, 403, 404]) }),
  // provider.cline-recommended-models (AIGate addition, user decision 2026-10-08): Cline's free and Pass models are listed
  // only by its recommended-models endpoint, which the Cline extension reads; the model import adds them.
  cline: () => ({ recommendedModels: { url: CLINE_RECOMMENDED_URL, groups: ["free", "recommended"] } }),
  clinepass: (provider) => ({ chatProbe: firstModelProbe(provider, [401, 403]), recommendedModels: { url: CLINE_RECOMMENDED_URL, groups: ["clinePass"] } }),
  claude: () => ({ auth: { kind: "api-key", header: "authorization", scheme: "bearer" }, testByExpiry: true }),
  codex: () => ({
    accountIdHeader: "chatgpt-account-id",
    chatProbe: { model: "gpt-5.3-codex", body: { model: "gpt-5.3-codex", input: [], stream: false, store: false }, invalidStatuses: [401] },
  }),
  "gemini-cli": () => ({ auth: { kind: "api-key", header: "authorization", scheme: "bearer" }, modelsUrl: "https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels" }),
  antigravity: () => ({
    chatUrl: ANTIGRAVITY_IDE_BASE_URL,
    modelsUrl: ANTIGRAVITY_MODELS_URL,
    auth: { kind: "api-key", header: "authorization", scheme: "bearer" },
  }),
  // provider.cursor-protobuf: both paths are ConnectRPC HTTP/2; CursorAdapter builds their protobuf body and headers.
  cursor: () => ({ chatUrl: "https://api2.cursor.sh/aiserver.v1.ChatService/StreamUnifiedChatWithTools", modelsUrl: "https://agent.api5.cursor.sh/agent.v1.AgentService/GetUsableModels" }),
  trae: () => ({ testByExpiry: true }),
  qoder: () => ({ chatUrl: "https://api2-v2.qoder.sh/model/v1/chat/completions", modelsUrl: "https://api3.qoder.sh/algo/api/v2/model/list" }),
};
// provider.gemini-cli-oauth: Cloud Code speaks the Gemini protocol inside its own envelope.
const CLOUD_CODE_PROTOCOLS: Readonly<Record<string, ProviderProtocol>> = { "gemini-cli": "gemini" };
const PROTOCOL_REASONS: Readonly<Record<string, string>> = {
  service: "Media and search services come with SP22/SP23",
};
// provider.anthropic-auth-and-headers: the family always sends this version.
export const ANTHROPIC_VERSION = "2023-06-01";

const isProtocol = (value: string): value is ProviderProtocol => PROVIDER_PROTOCOLS.some((p) => p === value);
const protocolOf = (provider: CatalogProvider): string => CLOUD_CODE_PROTOCOLS[provider.protocol] ?? provider.protocol;

// A reason why the provider cannot be connected yet, or undefined when it can.
export function unsupportedReason(provider: CatalogProvider): string | undefined {
  const notPorted = NOT_PORTED.get(provider.id);
  if (notPorted) return notPorted;
  // assemblyai and deepgram have no transport format, so the catalog calls them openai-compatible; they only transcribe.
  // ponytail: speech-to-text only; nanobanana (image-only, connectable since SP13) is left for SP22 to decide.
  if (provider.serviceKinds.length > 0 && provider.serviceKinds.every((kind) => kind === "stt")) return PROTOCOL_REASONS.service;
  const protocol = protocolOf(provider);
  if (!isProtocol(protocol)) return PROTOCOL_REASONS[provider.protocol] ?? `Needs the ${provider.protocol} adapter (SP14)`;
  // docs/contracts/oauth.md: a provider AIGate can sign in to is connectable without an API key.
  const signIn = OAUTH_PROVIDERS[provider.id] !== undefined;
  if (!provider.auth.kinds.includes("api-key") && !signIn && !provider.auth.kinds.includes("none")) {
    if (provider.auth.kinds.includes("oauth")) return "Needs OAuth sign-in (SP16)";
    if (provider.auth.kinds.includes("cookie")) return "Needs a web session (later)";
    return "Keyless providers come later";
  }
  if (provider.hidden && !signIn) return "Hidden in the 9router catalog";
  // provider.opencode-free: its public models select Chat, Responses, or Messages at runtime (adapters/opencode.ts).
  if (provider.id === "opencode") return undefined;
  if (PER_CONNECTION[provider.id]) return undefined;
  if (provider.chatUrl === null) return "Each connection needs its own endpoint URL (later)";
  if (provider.chatUrl.includes("{")) return "The endpoint needs per-account data (later)";
  if (!GOOGLE_CLOUD.has(provider.id) && !PATHS[protocol].chat.test(provider.chatUrl)) return "Non-standard endpoint (SP14)";
  return undefined;
}

export function toDescriptor(provider: CatalogProvider, chatUrl: string): ProviderDescriptor {
  const signIn = OAUTH_PROVIDERS[provider.id];
  const named = protocolOf(provider);
  const protocol: ProviderProtocol = isProtocol(named) ? named : "openai-compatible";
  const paths = PATHS[protocol];
  const headers = { ...Object.fromEntries(Object.entries(provider.headers).map(([name, value]) => [name.toLowerCase(), value])), ...EXTRA_HEADERS[provider.id] };
  const opencode = provider.id === "opencode";
  const auth: ProviderDescriptor["auth"] = provider.auth.kinds.includes("none") && !provider.auth.kinds.includes("api-key") && !signIn
    ? { kind: "none" }
    : protocol === "anthropic"
    ? { kind: "api-key", header: "x-api-key", scheme: "raw" }
    // translator.openai-to-gemini-request: an API key goes in x-goog-api-key (the catalog records the OAuth header).
    : protocol === "gemini" ? { kind: "api-key", header: "x-goog-api-key", scheme: "raw" }
    : GOOGLE_CLOUD.has(provider.id) ? { kind: "api-key", header: "x-goog-api-key", scheme: "raw", googleCloud: true }
    : { kind: "api-key", header: provider.auth.header ?? "authorization", scheme: provider.auth.scheme === "raw" ? "raw" : "bearer", ...(provider.id === "ollama-local" ? { optional: true } : {}) };
  return {
    id: provider.id,
    name: provider.name,
    protocol,
    chatUrl: opencode ? "https://opencode.ai/zen/v1/chat/completions" : chatUrl,
    // The family layout when the catalog names no models endpoint.
    modelsUrl: opencode ? "https://opencode.ai/zen/v1/models" : provider.modelsUrl ?? chatUrl.replace(paths.chat, paths.models),
    headers: protocol === "anthropic" ? { "anthropic-version": ANTHROPIC_VERSION, ...headers } : headers,
    aliases: provider.aliases,
    auth,
    models: provider.models.map((m) => ({
      id: m.id, name: m.name, ...(m.upstreamModelId ? { upstreamModelId: m.upstreamModelId } : {}), kind: m.kind === "llm" ? "chat" : m.kind, capabilities: m.capabilities, contextWindow: m.contextWindow,
      // gives a 262144 output. An output limit above the context window is not trusted, so it is unknown.
      maxOutputTokens: m.contextWindow !== null && m.maxOutputTokens !== null && m.maxOutputTokens > m.contextWindow ? null : m.maxOutputTokens,
    })),
    quirks: [...provider.quirks, ...(opencode ? ["opencodeFree"] : []), ...(EXECUTOR_QUIRKS[provider.id] ?? [])],
    ...(provider.id === "ollama-local" ? OLLAMA_LOCAL : {}),
    ...(provider.forceStream && !STREAM_OPTIONAL.has(provider.id) ? { streamOnly: true } : {}),
    ...PER_CONNECTION[provider.id]?.(provider),
    ...(signIn ? { oauth: signIn.flow } : {}),
    ...(provider.id === "kilocode" ? { organizationHeader: "x-kilocode-organizationid" } : {}),
    ...(provider.id === "kiro" ? { testByExpiry: true } : {}),
  };
}

const statuses = new Map<string, ProviderStatus>();
const connectable: ProviderDescriptor[] = [];
for (const provider of PORTED_CATALOG) {
  const reason = unsupportedReason(provider);
  // unsupportedReason returns undefined only for a provider with a chat URL, or one whose connection supplies it (azure).
  if (reason === undefined) connectable.push(toDescriptor(provider, provider.chatUrl ?? ""));
  else statuses.set(provider.id, { connectable: false, reason });
}

// Validated once at load; a bad entry fails startup, not a user request.
export const builtinRegistry = defineRegistry(connectable, statuses);
