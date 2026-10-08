import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiBlob, apiVoid } from "../../shared/api";

// docs/contracts/connections.md
export type TestStatus = "untested" | "active" | "invalid" | "no_quota" | "unreachable";

export interface Connection {
  id: string;
  provider: string;
  providerName: string;
  name: string;
  priority: number;
  keyHint: string;
  // The connection's own host (ollama-local) or endpoint (azure), or null.
  baseUrl: string | null;
  // SP14g (docs/contracts/provider-connection-data.md): azure deployment, api-version, organization; cloudflare-ai account.
  deployment: string | null;
  apiVersion: string | null;
  organization: string | null;
  accountId: string | null;
  proxyPoolId: string | null;
  // SP16 (docs/contracts/oauth.md): a signed-in connection shows its account and token expiry.
  authType: "api-key" | "oauth";
  email: string | null;
  expiresAt: string | null;
  isActive: boolean;
  testStatus: TestStatus;
  lastError: string | null;
  lastErrorCode: string | null;
  lastTestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// docs/contracts/catalog-providers.md
export interface ProviderSummary {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  protocol: string;
  authKinds: string[];
  hidden: boolean;
  connectable: boolean;
  reason: string | null;
  // SP16: how the dashboard signs in to the provider (null: API key only), and whether it takes no API key at all.
  signIn: OAuthFlow | null;
  signInOnly: boolean;
  modelCount: number;
  serviceKinds: string[];
  routeKinds: string[];
}

export type OAuthFlow = "authorization_code" | "authorization_code_pkce" | "device_code" | "browser_token";

export interface ProviderModel {
  id: string;
  name: string;
  kind: string;
  capabilities: Record<string, boolean>;
  contextWindow: number | null;
  maxOutputTokens: number | null;
}

// docs/contracts/provider-thinking.md: the level sent when a request carries no thinking of its own.
export type ThinkingLevel = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
export interface ThinkingView { level: ThinkingLevel | "auto"; levels: ThinkingLevel[] | null }

export interface ProviderDetailView extends ProviderSummary {
  chatUrl: string | null;
  models: ProviderModel[];
  thinking: ThinkingView;
}

export interface TtsVoice { id: string; name: string; locale: string; gender: string }
export const useTtsVoices = (provider: string, model: string, enabled: boolean) =>
  useQuery({ queryKey: ["tts-voices", provider, model], queryFn: () => api<{ voices: TtsVoice[]; live: boolean }>(`/api/providers/${encodeURIComponent(provider)}/voices?${new URLSearchParams({ model })}`), staleTime: Infinity, enabled });
export const previewTtsVoice = (provider: string, model: string, voice: string, signal: AbortSignal) =>
  apiBlob(`/api/providers/${encodeURIComponent(provider)}/voice-preview`, { model, voice }, 20_000, signal);

// The server allows 20 s for a test (the provider has 15 s); the client waits a little longer.
const TEST_TIMEOUT_MS = 25_000;
const connectionsKey = ["connections"] as const;

export const useConnections = () => useQuery({ queryKey: connectionsKey, queryFn: () => api<Connection[]>("/api/connections") });
export interface QuotaLine { name: string; used: number; total: number; remaining: number | null; resetAt: string | null; unlimited: boolean }
export interface ConnectionQuota { connectionId: string; provider: string; name: string; plan: string | null; quotas: QuotaLine[]; message: string | null; fetchedAt: number; cached: boolean }
const quotasKey = ["quotas"] as const;
export const useQuotas = () => useQuery({ queryKey: quotasKey, queryFn: () => api<ConnectionQuota[]>("/api/quotas"), refetchInterval: 60_000 });
export const useRefreshQuotas = () => {
  const client = useQueryClient();
  return useMutation({ mutationFn: () => api<ConnectionQuota[]>("/api/quotas/refresh", { method: "POST" }), onSuccess: (quotas) => client.setQueryData(quotasKey, quotas) });
};
// The catalog is built into the server, so it only changes with an AIGate upgrade.
export const useProviders = () => useQuery({ queryKey: ["providers"], queryFn: () => api<ProviderSummary[]>("/api/providers"), staleTime: Infinity });
export const useProvider = (id: string, enabled = true) =>
  useQuery({ queryKey: ["providers", id], queryFn: () => api<ProviderDetailView>(`/api/providers/${encodeURIComponent(id)}`), staleTime: Infinity, enabled });

// The detail is cached forever, so a saved level is written into it; a failure reads the server's value again.
export function useSetThinking(id: string) {
  const client = useQueryClient();
  const key = ["providers", id];
  return useMutation({
    mutationFn: (level: ThinkingLevel | "auto") => api<ThinkingView>(`/api/providers/${encodeURIComponent(id)}/thinking`, { method: "PUT", body: { level } }),
    onSuccess: (thinking) => client.setQueryData<ProviderDetailView>(key, (detail) => (detail ? { ...detail, thinking } : detail)),
    onError: () => client.invalidateQueries({ queryKey: key, exact: true }),
  });
}

function useConnectionMutation<T, V>(mutationFn: (variables: V) => Promise<T>) {
  const client = useQueryClient();
  // Settled, not just success: a 404 from another tab's delete must refresh the list too.
  return useMutation({ mutationFn, onSettled: () => client.invalidateQueries({ queryKey: connectionsKey, exact: true }) });
}

const path = (id: string) => `/api/connections/${encodeURIComponent(id)}`;

export type ConnectionField = "baseUrl" | "deployment" | "apiVersion" | "organization" | "accountId";
type FieldValues = Partial<Record<ConnectionField, string>>;

export const useCreateConnection = () =>
  useConnectionMutation((body: { provider: string; apiKey?: string; name?: string; priority?: number; proxyPoolId?: string } & FieldValues) => api<Connection>("/api/connections", { method: "POST", body }));
export const useUpdateConnection = () =>
  useConnectionMutation(({ id, ...body }: { id: string; name?: string; apiKey?: string; isActive?: boolean; priority?: number; proxyPoolId?: string } & FieldValues) =>
    api<Connection>(path(id), { method: "PATCH", body }));
export const useDeleteConnection = () => useConnectionMutation((id: string) => apiVoid(path(id), "DELETE"));
export const useTestConnection = () =>
  useConnectionMutation((id: string) => api<Connection>(`${path(id)}/test`, { method: "POST", timeoutMs: TEST_TIMEOUT_MS }));

// docs/contracts/custom-models.md: the connection's live model list, the operator's custom models, and the model test.
export interface ListedModel { id: string; inCatalog: boolean }
export interface CustomModel { provider: string; id: string; createdAt: string }
export interface ModelProbe { ok: boolean; latencyMs: number; status: number; error: string | null; note?: string }

const customKey = (provider: string) => ["custom-models", provider] as const;
const customPath = (params: Record<string, string>) => `/api/models/custom?${new URLSearchParams(params).toString()}`;
// The server allows 15 s for a model test; the client waits a little longer.
const PROBE_TIMEOUT_MS = 20_000;

export const fetchConnectionModels = (id: string) => api<{ models: ListedModel[] }>(`${path(id)}/models`, { timeoutMs: TEST_TIMEOUT_MS }).then((r) => r.models);
export const useCustomModels = (provider: string) =>
  useQuery({ queryKey: customKey(provider), queryFn: () => api<{ models: CustomModel[] }>(customPath({ provider })).then((r) => r.models) });
function useCustomMutation<T, V>(provider: string, mutationFn: (variables: V) => Promise<T>) {
  const client = useQueryClient();
  return useMutation({ mutationFn, onSettled: () => client.invalidateQueries({ queryKey: customKey(provider) }) });
}
export const useAddCustomModels = (provider: string) =>
  useCustomMutation(provider, (ids: string[]) => api<{ success: true; added: number }>("/api/models/custom", { method: "POST", body: { provider, ids } }));
export const useDeleteCustomModel = (provider: string) => useCustomMutation(provider, (id: string) => apiVoid(customPath({ provider, id }), "DELETE"));
export const testModel = (model: string) => api<ModelProbe>("/api/models/test", { method: "POST", body: { model }, timeoutMs: PROBE_TIMEOUT_MS });

// docs/contracts/oauth.md: the sign-in steps. The server allows 30 s for each step that calls the provider.
const OAUTH_TIMEOUT_MS = 35_000;
const oauthPath = (provider: string, step: string) => `/api/oauth/${encodeURIComponent(provider)}/${step}`;

// relayed: AIGate listens on the provider's fixed callback (codex: localhost:1455) and forwards it to /callback.
export interface OAuthStart { authUrl: string | null; state: string; codeVerifier: string; redirectUri: string; flowType: OAuthFlow; relayed?: boolean }
export interface DeviceCode { device_code: string; user_code: string; verification_uri_complete: string; expires_in: number; interval: number; providerData?: Record<string, string> }
export type PollAnswer = { success: true; connection: { id: string } } | { success: false; error: string; errorDescription?: string | null; pending: boolean };

export const oauthAuthorize = (provider: string, redirectUri: string, meta: Record<string, string>) =>
  api<OAuthStart>(`${oauthPath(provider, "authorize")}?${new URLSearchParams({ redirect_uri: redirectUri, ...meta }).toString()}`);
export const oauthDeviceCode = (provider: string, meta: Record<string, string> = {}) => {
  const query = new URLSearchParams(meta).toString();
  return api<DeviceCode>(`${oauthPath(provider, "device-code")}${query ? `?${query}` : ""}`, { timeoutMs: OAUTH_TIMEOUT_MS });
};
export const oauthPoll = (provider: string, deviceCode: string, providerData?: Record<string, string>) =>
  api<PollAnswer>(oauthPath(provider, "poll"), { method: "POST", body: { deviceCode, ...(providerData ? { providerData } : {}) }, timeoutMs: OAUTH_TIMEOUT_MS });
export interface TraeStart { authUrl: string; state: string; callbackUrl: string }
export interface TraeStatus { status: "unknown" | "pending" | "processing" | "done" | "error"; connectionId?: string; email?: string | null; error?: string }
export const traeStart = () => api<TraeStart>(oauthPath("trae", "start-proxy"), { timeoutMs: OAUTH_TIMEOUT_MS });
export const traePoll = (state: string) => api<TraeStatus>(`${oauthPath("trae", "poll-status")}?${new URLSearchParams({ state })}`);
export const traeStop = () => api<{ success: true }>(oauthPath("trae", "stop-proxy"));
export const traeExchange = (code: string) => api<{ success: true; connection: { id: string } }>(oauthPath("trae", "exchange"), { method: "POST", body: { code }, timeoutMs: OAUTH_TIMEOUT_MS });
export const useOAuthExchange = () =>
  useConnectionMutation(({ provider, ...body }: { provider: string; code: string; redirectUri: string; codeVerifier: string; state: string; meta: Record<string, string> }) =>
    api<{ success: true; connection: { id: string; email: string | null } }>(oauthPath(provider, "exchange"), { method: "POST", body, timeoutMs: OAUTH_TIMEOUT_MS }));

export interface CursorAutoImport { found: boolean; accessToken?: string; machineId?: string; error?: string; windowsManual?: boolean }
export const cursorAutoImport = () => api<CursorAutoImport>(oauthPath("cursor", "auto-import"), { timeoutMs: OAUTH_TIMEOUT_MS });
export const useCursorImport = () =>
  useConnectionMutation((body: { accessToken: string; machineId: string }) =>
    api<{ success: true; connection: { id: string; email: string | null } }>(oauthPath("cursor", "import"), { method: "POST", body, timeoutMs: OAUTH_TIMEOUT_MS }));

export interface KiroImportHint { found: boolean; refreshToken?: string; clientId?: string | null; clientSecret?: string | null; region?: string | null; authMethod?: string | null; profileArn?: string | null; error?: string }
export const kiroAutoImport = () => api<KiroImportHint>(oauthPath("kiro", "auto-import"), { timeoutMs: OAUTH_TIMEOUT_MS });
export const kiroImport = (body: { refreshToken: string; clientId?: string; clientSecret?: string; region?: string; profileArn?: string }) =>
  api<{ success: true; connection: { id: string; email: string | null } }>(oauthPath("kiro", "import"), { method: "POST", body, timeoutMs: OAUTH_TIMEOUT_MS });
export const kiroCliProxyImport = (json: string) =>
  api<{ success: true; connection: { id: string; email: string | null } }>(oauthPath("kiro", "import-cli-proxy"), { method: "POST", body: { json }, timeoutMs: OAUTH_TIMEOUT_MS });
export const kiroApiKeyImport = (body: { apiKey: string; region: string }) =>
  api<{ success: true; connection: { id: string; email: string | null } }>(oauthPath("kiro", "api-key"), { method: "POST", body, timeoutMs: OAUTH_TIMEOUT_MS });

// docs/contracts/custom-providers.md
export type NodeType = "openai-compatible" | "anthropic-compatible";
export type ApiType = "chat" | "responses";
export interface ProviderNode {
  id: string;
  type: NodeType;
  // null for an anthropic-compatible provider.
  apiType: ApiType | null;
  name: string;
  prefix: string;
  baseUrl: string;
  // Header values stay on the server: each header is shown by name and a hint of its value.
  customHeaders: { name: string; hint: string }[];
  retryStreamErrors: boolean;
  // docs/contracts/provider-thinking.md: the level every model of the provider gets, and the levels its family takes.
  thinking: ThinkingLevel | "auto";
  thinkingLevels: ThinkingLevel[];
  createdAt: string;
  updatedAt: string;
}
// A header to save; on an edit a header without a value keeps the one already saved.
export interface HeaderInput { name: string; value?: string }

const nodesKey = ["provider-nodes"] as const;
const nodePath = (id: string) => `/api/provider-nodes/${encodeURIComponent(id)}`;

export const useProviderNodes = () => useQuery({ queryKey: nodesKey, queryFn: () => api<ProviderNode[]>("/api/provider-nodes") });

function useNodeMutation<T, V>(mutationFn: (variables: V) => Promise<T>) {
  const client = useQueryClient();
  // A delete also removes the node's connection, so both lists are refreshed.
  return useMutation({
    mutationFn,
    onSettled: () => Promise.all([client.invalidateQueries({ queryKey: nodesKey }), client.invalidateQueries({ queryKey: connectionsKey, exact: true })]),
  });
}

type NodeFields = { name: string; prefix: string; baseUrl?: string; apiType?: ApiType; customHeaders: HeaderInput[]; retryStreamErrors: boolean; thinking: ThinkingLevel | "auto" };
// The type is chosen at creation only (docs/contracts/custom-providers.md).
export const useCreateNode = () => useNodeMutation((body: NodeFields & { type: NodeType }) => api<ProviderNode>("/api/provider-nodes", { method: "POST", body }));
export const useUpdateNode = () => useNodeMutation(({ id, ...body }: NodeFields & { id: string }) => api<ProviderNode>(nodePath(id), { method: "PATCH", body }));
export const useDeleteNode = () => useNodeMutation((id: string) => apiVoid(nodePath(id), "DELETE"));
