import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiVoid } from "../../shared/api";

// docs/contracts/identity-apikeys.md, "API keys"
export interface ApiKey {
  id: string;
  name: string;
  maskedKey: string;
  isActive: boolean;
  createdAt: string;
}

// The plaintext key exists only in this one response; it is never cached.
export interface CreatedApiKey extends ApiKey {
  key: string;
}

const keysKey = ["api-keys"] as const;
// Shared with the settings feature by query key only; features do not import each other.
const settingsKey = ["settings"] as const;

export const useApiKeys = () => useQuery({ queryKey: keysKey, queryFn: () => api<ApiKey[]>("/api/keys") });

function useKeyMutation<T, V>(mutationFn: (variables: V) => Promise<T>) {
  const client = useQueryClient();
  // Settled, not just success: a 404 from another tab's delete must refresh the list too.
  return useMutation({ mutationFn, onSettled: () => client.invalidateQueries({ queryKey: keysKey }) });
}

export const useCreateKey = () => useKeyMutation((name: string) => api<CreatedApiKey>("/api/keys", { method: "POST", body: { name } }));
export const useSetKeyActive = () =>
  useKeyMutation(({ id, isActive }: { id: string; isActive: boolean }) =>
    api<ApiKey>(`/api/keys/${encodeURIComponent(id)}`, { method: "PATCH", body: { isActive } }));
export const useDeleteKey = () => useKeyMutation((id: string) => apiVoid(`/api/keys/${encodeURIComponent(id)}`, "DELETE"));

interface RequireApiKey {
  requireApiKey: boolean;
}

export const useRequireApiKey = () =>
  useQuery({ queryKey: settingsKey, queryFn: () => api<RequireApiKey>("/api/settings"), select: (settings) => settings.requireApiKey });

export function useSetRequireApiKey() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (requireApiKey: boolean) => api<RequireApiKey>("/api/settings", { method: "PATCH", body: { requireApiKey } }),
    onSuccess: (settings) => client.setQueryData(settingsKey, settings),
    // A failed toggle re-reads the server so the checkbox never shows a value that was not saved.
    onError: () => client.invalidateQueries({ queryKey: settingsKey }),
  });
}
