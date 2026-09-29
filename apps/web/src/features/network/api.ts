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
