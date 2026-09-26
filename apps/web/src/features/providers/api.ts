import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiVoid } from "../../shared/api";

// docs/contracts/connections.md
export type TestStatus = "untested" | "active" | "invalid" | "no_quota" | "unreachable";

export interface Connection {
  id: string;
  provider: string;
  providerName: string;
  name: string;
  keyHint: string;
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
  modelCount: number;
}

export interface ProviderModel {
  id: string;
  name: string;
  kind: string;
  capabilities: Record<string, boolean>;
  contextWindow: number | null;
  maxOutputTokens: number | null;
}

export interface ProviderDetailView extends ProviderSummary {
  chatUrl: string | null;
  models: ProviderModel[];
}

// The server allows 20 s for a test (the provider has 15 s); the client waits a little longer.
const TEST_TIMEOUT_MS = 25_000;
const connectionsKey = ["connections"] as const;

export const useConnections = () => useQuery({ queryKey: connectionsKey, queryFn: () => api<Connection[]>("/api/connections") });
// The catalog is built into the server, so it only changes with an AIGate upgrade.
export const useProviders = () => useQuery({ queryKey: ["providers"], queryFn: () => api<ProviderSummary[]>("/api/providers"), staleTime: Infinity });
export const useProvider = (id: string) =>
  useQuery({ queryKey: ["providers", id], queryFn: () => api<ProviderDetailView>(`/api/providers/${encodeURIComponent(id)}`), staleTime: Infinity });

function useConnectionMutation<T, V>(mutationFn: (variables: V) => Promise<T>) {
  const client = useQueryClient();
  // Settled, not just success: a 404 from another tab's delete must refresh the list too.
  return useMutation({ mutationFn, onSettled: () => client.invalidateQueries({ queryKey: connectionsKey, exact: true }) });
}

const path = (id: string) => `/api/connections/${encodeURIComponent(id)}`;

export const useCreateConnection = () =>
  useConnectionMutation((body: { provider: string; apiKey: string; name?: string }) => api<Connection>("/api/connections", { method: "POST", body }));
export const useUpdateConnection = () =>
  useConnectionMutation(({ id, ...body }: { id: string; name?: string; apiKey?: string; isActive?: boolean }) =>
    api<Connection>(path(id), { method: "PATCH", body }));
export const useDeleteConnection = () => useConnectionMutation((id: string) => apiVoid(path(id), "DELETE"));
export const useTestConnection = () =>
  useConnectionMutation((id: string) => api<Connection>(`${path(id)}/test`, { method: "POST", timeoutMs: TEST_TIMEOUT_MS }));

// docs/contracts/custom-providers.md
export interface ProviderNode {
  id: string;
  name: string;
  prefix: string;
  baseUrl: string;
  createdAt: string;
  updatedAt: string;
}

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

type NodeFields = { name: string; prefix: string; baseUrl?: string };
export const useCreateNode = () => useNodeMutation((body: NodeFields) => api<ProviderNode>("/api/provider-nodes", { method: "POST", body }));
export const useUpdateNode = () => useNodeMutation(({ id, ...body }: NodeFields & { id: string }) => api<ProviderNode>(nodePath(id), { method: "PATCH", body }));
export const useDeleteNode = () => useNodeMutation((id: string) => apiVoid(nodePath(id), "DELETE"));
