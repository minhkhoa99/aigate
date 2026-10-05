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
  fallbackStrategy: "fill-first" | "round-robin";
  comboStickyLimit: number;
  tokenSaverEnabled: boolean; rtkEnabled: boolean; headroomEnabled: boolean; headroomUrl: string;
  headroomCompressUserMessages: boolean; headroomTimeoutMs: number; cavemanEnabled: boolean; cavemanLevel: "lite" | "full" | "ultra";
  ponytailEnabled: boolean; ponytailLevel: "lite" | "full" | "ultra"; pxpipeEnabled: boolean; pxpipeMinChars: number; pxpipeTimeoutMs: number;
}

export interface RuntimeInfo {
  at: number; bindAddress: string | null; port: number | null; dataDir: string; nodeVersion: string; databaseDriver: string;
  uptimeSeconds: number; streamIdleTimeoutMs: number; usageTimezone: string; usageRetentionDays: number; dailyRetentionDays: number;
  writer: { queued: number; dropped: number; failed: number };
}
export interface SettingsPreview { version: string; changes: { key: string; before: boolean | string | number; after: boolean | string | number }[]; settings: Partial<Settings> }
export const useRuntimeInfo = () => useQuery({ queryKey: ["settings", "runtime"], queryFn: () => api<RuntimeInfo>("/api/settings/runtime"), refetchInterval: 30_000 });

export function useSettingsImport() {
  const client = useQueryClient();
  const preview = useMutation({ mutationFn: (document: unknown) => api<SettingsPreview>("/api/settings/import/preview", { method: "POST", body: document }) });
  const apply = useMutation({
    mutationFn: (body: { document: unknown; expectedVersion: string }) => api<Settings>("/api/settings/import", { method: "POST", body }),
    onSuccess: (settings) => { client.setQueryData(settingsKey, settings); void client.invalidateQueries(); },
    onError: () => client.invalidateQueries({ queryKey: settingsKey }),
  });
  return { preview, apply };
}

// Both small downloads are sanitized by the server; revoke the object URL after the browser has started it.
export async function downloadSettingsFile(kind: "export" | "runtime") {
  const data = await api<unknown>(`/api/settings/${kind}`);
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `aigate-${kind === "export" ? "settings" : "runtime"}.json`;
  document.body.append(anchor);
  try { anchor.click(); }
  finally { anchor.remove(); URL.revokeObjectURL(url); }
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
    // A failed toggle re-reads the server so the checkbox never shows a value that was not saved.
    onError: () => client.invalidateQueries({ queryKey: settingsKey }),
  });
}
