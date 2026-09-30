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

// Shared with the providers feature by query key only (docs/contracts/chat-lane.md, "UI").
const connectionsKey = ["connections"] as const;
interface ConnectionState {
  isActive: boolean;
  testStatus: "untested" | "active" | "invalid" | "no_quota" | "unreachable";
}
export type ChatReadiness = "ready" | "no-connection" | "check-connection";

// Whether /v1 can answer: an active connection is required; a passed test means it should work.
export const useChatReadiness = () => useQuery({
  queryKey: connectionsKey,
  queryFn: () => api<ConnectionState[]>("/api/connections"),
  select: (connections): ChatReadiness => {
    const active = connections.filter((c) => c.isActive);
    if (active.length === 0) return "no-connection";
    return active.some((c) => c.testStatus === "active") ? "ready" : "check-connection";
  },
});

// The settings this feature reads (docs/contracts/settings.md); the query holds the whole settings object.
export interface GatewaySettings {
  requireApiKey: boolean;
  comboStickyLimit: number;
  tokenSaverEnabled: boolean;
  rtkEnabled: boolean;
  headroomEnabled: boolean;
  headroomUrl: string;
  headroomCompressUserMessages: boolean;
  headroomTimeoutMs: number;
  cavemanEnabled: boolean;
  cavemanLevel: "lite" | "full" | "ultra";
  ponytailEnabled: boolean;
  ponytailLevel: "lite" | "full" | "ultra";
  pxpipeEnabled: boolean;
  pxpipeMinChars: number;
  pxpipeTimeoutMs: number;
}
const readSettings = () => api<GatewaySettings>("/api/settings");

export const useRequireApiKey = () =>
  useQuery({ queryKey: settingsKey, queryFn: readSettings, select: (settings) => settings.requireApiKey });
export const useComboStickyLimit = () =>
  useQuery({ queryKey: settingsKey, queryFn: readSettings, select: (settings) => settings.comboStickyLimit });

export const useTokenSaverSettings = () => useQuery({ queryKey: settingsKey, queryFn: readSettings });

export interface PxpipeStatus { installed: boolean; loaded: boolean; installing: boolean; version: string | null }
const pxpipeKey = ["pxpipe-status"] as const;
export const usePxpipeStatus = () => useQuery({ queryKey: pxpipeKey, queryFn: () => api<PxpipeStatus>("/api/pxpipe/status") });
export const useInstallPxpipe = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<PxpipeStatus>("/api/pxpipe/install", { method: "POST" }),
    onSuccess: (status) => client.setQueryData(pxpipeKey, status),
    onSettled: () => client.invalidateQueries({ queryKey: pxpipeKey }),
  });
};

function useSettingsPatch<V>(body: (value: V) => Partial<GatewaySettings>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (value: V) => api<GatewaySettings>("/api/settings", { method: "PATCH", body: body(value) }),
    onSuccess: (settings) => client.setQueryData(settingsKey, settings),
    // A failed change re-reads the server so the control never shows a value that was not saved.
    onError: () => client.invalidateQueries({ queryKey: settingsKey }),
  });
}
export const useSetRequireApiKey = () => useSettingsPatch((requireApiKey: boolean) => ({ requireApiKey }));
export const useSetComboStickyLimit = () => useSettingsPatch((comboStickyLimit: number) => ({ comboStickyLimit }));
export function usePatchTokenSaverSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<GatewaySettings>) => api<GatewaySettings>("/api/settings", { method: "PATCH", body: patch }),
    onSuccess: (settings) => client.setQueryData(settingsKey, settings),
    onError: () => client.invalidateQueries({ queryKey: settingsKey }),
  });
}

// The dashboard's authenticated equivalent of GET /v1/models: only models the gateway can currently route to.
export const useConnectedModels = () => useQuery({
  queryKey: ["connected-models"],
  queryFn: () => api<{ data: { id: string }[] }>("/api/models").then((result) => result.data),
});

// docs/contracts/combos.md
export type ComboStrategy = "fallback" | "round-robin" | "fusion";
export interface ComboFields {
  name: string;
  models: string[];
  strategy: ComboStrategy;
  judgeModel: string | null;
  minPanel: number;
  stragglerGraceMs: number;
  panelTimeoutMs: number;
}
export interface Combo extends ComboFields {
  id: string;
  createdAt: string;
  updatedAt: string;
}

const combosKey = ["combos"] as const;
const comboPath = (id: string) => `/api/combos/${encodeURIComponent(id)}`;
export const useCombos = () => useQuery({ queryKey: combosKey, queryFn: () => api<{ combos: Combo[] }>("/api/combos").then((r) => r.combos) });

function useComboMutation<T, V>(mutationFn: (variables: V) => Promise<T>) {
  const client = useQueryClient();
  // Settled, not just success: a 404 or a name taken in another tab must refresh the list too.
  return useMutation({ mutationFn, onSettled: () => client.invalidateQueries({ queryKey: combosKey }) });
}
export const useCreateCombo = () => useComboMutation((fields: ComboFields) => api<{ combo: Combo }>("/api/combos", { method: "POST", body: fields }).then((r) => r.combo));
export const useUpdateCombo = () =>
  useComboMutation(({ id, ...fields }: ComboFields & { id: string }) => api<{ combo: Combo }>(comboPath(id), { method: "PATCH", body: fields }).then((r) => r.combo));
export const useDeleteCombo = () => useComboMutation((id: string) => apiVoid(comboPath(id), "DELETE"));

// docs/contracts/capacity-adapter.md
export type CapacityCapability = "vision" | "pdf" | "audioInput" | "videoInput";
export interface CapacityPoolFields {
  enabled: boolean;
  roundRobin: boolean;
  models: string[];
}
export interface CapacityPool extends CapacityPoolFields {
  capability: CapacityCapability;
  updatedAt: string | null;
}
const capacityKey = ["capacity-pools"] as const;
export const useCapacityPools = () => useQuery({ queryKey: capacityKey, queryFn: () => api<{ pools: CapacityPool[] }>("/api/capacity-pools").then((r) => r.pools) });
export function useSaveCapacityPool() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ capability, ...fields }: CapacityPoolFields & { capability: CapacityCapability }) =>
      api<{ pool: CapacityPool }>(`/api/capacity-pools/${capability}`, { method: "PUT", body: fields }).then((r) => r.pool),
    onSettled: () => client.invalidateQueries({ queryKey: capacityKey }),
  });
}

// POST /api/models/test (docs/contracts/custom-models.md): the server bounds the probe at 15 s.
export interface ModelProbe { ok: boolean; latencyMs: number; status: number; error: string | null; note?: string }
export const testModel = (model: string) => api<ModelProbe>("/api/models/test", { method: "POST", body: { model }, timeoutMs: 20_000 });
