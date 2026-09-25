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

export interface SupportedProvider {
  id: string;
  name: string;
}

// The server allows 20 s for a test (the provider has 15 s); the client waits a little longer.
const TEST_TIMEOUT_MS = 25_000;
const connectionsKey = ["connections"] as const;

export const useConnections = () => useQuery({ queryKey: connectionsKey, queryFn: () => api<Connection[]>("/api/connections") });
export const useSupportedProviders = () =>
  useQuery({ queryKey: ["connections", "providers"], queryFn: () => api<SupportedProvider[]>("/api/connections/providers"), staleTime: Infinity });

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
