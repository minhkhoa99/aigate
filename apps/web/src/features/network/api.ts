import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiVoid } from "../../shared/api";

export type ProxyPoolType = "http" | "vercel" | "cloudflare" | "deno";
export interface ProxyPool {
  id: string; name: string; proxyUrl: string; noProxy: string; type: ProxyPoolType; isActive: boolean; strictProxy: boolean;
  testStatus: "untested" | "active" | "error"; lastTestedAt: string | null; lastError: string | null; createdAt: string; updatedAt: string; boundConnectionCount: number;
}
export interface ProxyRotation { providerId: string; name: string; rotateStrategy: "none" | "round-robin" | "random"; proxyPoolId: string | null }
export type ProxyPoolInput = { name: string; proxyUrl: string; noProxy?: string; type: ProxyPoolType; isActive?: boolean; strictProxy?: boolean };
const key = ["proxy-pools"] as const;
const path = (id: string) => `/api/proxy-pools/${encodeURIComponent(id)}`;
export const useProxyPools = () => useQuery({ queryKey: key, queryFn: () => api<{ proxyPools: ProxyPool[] }>("/api/proxy-pools").then((value) => value.proxyPools) });
function mutation<T, V>(work: (value: V) => Promise<T>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: work, onSettled: () => client.invalidateQueries({ queryKey: key }) });
}
export const useCreateProxyPool = () => mutation((body: ProxyPoolInput) => api<{ proxyPool: ProxyPool }>("/api/proxy-pools", { method: "POST", body }).then((value) => value.proxyPool));
export const useUpdateProxyPool = () => mutation(({ id, ...body }: Partial<ProxyPoolInput> & { id: string }) => api<{ proxyPool: ProxyPool }>(path(id), { method: "PATCH", body }).then((value) => value.proxyPool));
export const useDeleteProxyPool = () => mutation((id: string) => apiVoid(path(id), "DELETE"));
export const useTestProxyPool = () => mutation((id: string) => api<{ ok: boolean; error?: string; proxyPool: ProxyPool }>(`${path(id)}/test`, { method: "POST", timeoutMs: 12_000 }));
export const useDeployVercelRelay = () => mutation((body: { vercelToken: string; projectName?: string }) => api<{ proxyPool: ProxyPool; deployUrl: string }>("/api/proxy-pools/vercel-deploy", { method: "POST", body, timeoutMs: 130_000 }));
export const useDeployCloudflareRelay = () => mutation((body: { apiToken: string; accountId: string; projectName?: string }) => api<{ proxyPool: ProxyPool; deployUrl: string }>("/api/proxy-pools/cloudflare-deploy", { method: "POST", body, timeoutMs: 30_000 }));
export const useDeployDenoRelay = () => mutation((body: { denoToken: string; orgDomain: string; projectName?: string }) => api<{ proxyPool: ProxyPool; deployUrl: string }>("/api/proxy-pools/deno-deploy", { method: "POST", body, timeoutMs: 75_000 }));
const rotationKey = ["proxy-rotations"] as const;
export const useProxyRotations = () => useQuery({ queryKey: rotationKey, queryFn: () => api<{ rotations: ProxyRotation[] }>("/api/proxy-pools/rotations").then((value) => value.rotations) });
export const useUpdateProxyRotation = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ providerId, ...body }: Pick<ProxyRotation, "providerId" | "rotateStrategy" | "proxyPoolId">) =>
      api<{ rotation: ProxyRotation }>("/api/proxy-pools/rotations/" + encodeURIComponent(providerId), { method: "PATCH", body }),
    onSettled: () => client.invalidateQueries({ queryKey: rotationKey }),
  });
};

export interface TunnelStatus { installed: boolean; enabled: boolean; running: boolean; publicUrl: string | null; routeConflict?: boolean; accessReady: boolean; blockedReason: string | null }
export const useTunnelStatus = () => useQuery({ queryKey: ["tooling", "tunnel"], queryFn: () => api<TunnelStatus>("/api/tooling/tunnel"), refetchInterval: 5_000 });
function useTunnelAction(action: "enable" | "disable") {
  const client = useQueryClient();
  return useMutation({ mutationFn: () => api<TunnelStatus | { success: boolean; enabled: boolean }>(`/api/tooling/tunnel/${action}`, { method: "POST" }),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ["tooling", "tunnel"] }); } });
}
export const useEnableTunnel = () => useTunnelAction("enable");
export const useDisableTunnel = () => useTunnelAction("disable");
export interface MitmStatus { listener: { configuredPort: number; available: boolean; running: boolean }; certificate: { path: string; present: boolean; keyPresent: boolean }; targets: { host: string; enabled: boolean; blockedReason: string | null }[] }
export interface MitmPreview { previewId: string; action: "generate" | "install" | "remove" | "start" | "stop"; certificatePath: string; keyPath: string; changes: string[]; expiresAt: string }
export const useMitmStatus = () => useQuery({ queryKey: ["tooling", "mitm"], queryFn: () => api<MitmStatus>("/api/tooling/mitm") });
export const useMitmPreview = () => useMutation({ mutationFn: (action: MitmPreview["action"]) => api<MitmPreview>("/api/tooling/mitm/preview", { method: "POST", body: { action } }) });
export function useApplyMitmPreview() { const client = useQueryClient(); return useMutation({ mutationFn: (previewId: string) => api<MitmStatus>("/api/tooling/mitm/apply", { method: "POST", body: { previewId } }), onSuccess: () => { void client.invalidateQueries({ queryKey: ["tooling", "mitm"] }); } }); }
