import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api";

// docs/contracts/identity-apikeys.md and docs/contracts/settings.md
export interface AuthStatus {
  setupRequired: boolean;
  authenticated: boolean;
  requireLogin: boolean;
}

export interface Settings {
  requireLogin: boolean;
  requireApiKey: boolean;
}

export const authStatusKey = ["auth-status"] as const;
const settingsKey = ["settings"] as const;

export const useAuthStatus = () => useQuery({ queryKey: authStatusKey, queryFn: () => api<AuthStatus>("/api/auth/status") });

// A successful sign-in, setup, or password change replaces the session, so every cached query may be stale.
function useSessionMutation(path: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<{ ok: true }>(path, { method: "POST", body }),
    onSuccess: () => client.invalidateQueries(),
  });
}

export const useSetup = () => useSessionMutation("/api/auth/setup");
export const useLogin = () => useSessionMutation("/api/auth/login");
export const useChangePassword = () => useSessionMutation("/api/auth/password");

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: true }>("/api/auth/logout", { method: "POST" }),
    onSuccess: async () => {
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== authStatusKey[0] });
      await client.invalidateQueries({ queryKey: authStatusKey });
    },
  });
}

export const useSettings = () => useQuery({ queryKey: settingsKey, queryFn: () => api<Settings>("/api/settings") });

export function usePatchSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Settings>) => api<Settings>("/api/settings", { method: "PATCH", body: patch }),
    onSuccess: (settings) => {
      client.setQueryData(settingsKey, settings);
      void client.invalidateQueries({ queryKey: authStatusKey });
    },
  });
}
