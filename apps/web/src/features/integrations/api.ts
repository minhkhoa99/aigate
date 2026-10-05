import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiVoid } from "../../shared/api";

export interface CliToolStatus {
  id: string;
  name: string;
  installed: boolean;
  configExists: boolean;
  status: "configured" | "available" | "not_detected";
  configPath: string | null;
}

export const useCliTools = () => useQuery({ queryKey: ["tooling", "cli-tools"], queryFn: () => api<CliToolStatus[]>("/api/tooling/cli-tools") });

export interface CodexStatus { installed: boolean; configured: boolean; configPath: string; model: string | null }
export interface CodexPreview { previewId: string; action: "configure" | "reset"; configPath: string; backupPath: string; diff: string[]; expiresAt: string }
export const useCodexStatus = () => useQuery({ queryKey: ["tooling", "codex"], queryFn: () => api<CodexStatus>("/api/tooling/cli-tools/codex") });
export function useCodexPreview() {
  return useMutation({ mutationFn: (body: { action: "configure"; baseUrl: string; apiKey: string; model: string; subagentModel: string } | { action: "reset" }) =>
    api<CodexPreview>("/api/tooling/cli-tools/codex/preview", { method: "POST", body }) });
}
export function useApplyCodexPreview() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (previewId: string) => api<{ success: boolean; action: string; configPath: string; backupPath: string | null }>("/api/tooling/cli-tools/codex/apply", { method: "POST", body: { previewId } }),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ["tooling", "codex"] }); void client.invalidateQueries({ queryKey: ["tooling", "cli-tools"] }); } });
}

export interface ClaudeStatus { installed: boolean; configured: boolean; configPath: string; baseUrl: string | null }
export interface ClaudePreview { previewId: string; action: "configure" | "reset"; configPath: string; backupPath: string; diff: string[]; expiresAt: string }
export const useClaudeStatus = () => useQuery({ queryKey: ["tooling", "claude"], queryFn: () => api<ClaudeStatus>("/api/tooling/cli-tools/claude") });
export function useClaudePreview() {
  return useMutation({ mutationFn: (body: { action: "configure"; baseUrl: string; apiKey: string } | { action: "reset" }) => api<ClaudePreview>("/api/tooling/cli-tools/claude/preview", { method: "POST", body }) });
}
export function useApplyClaudePreview() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (previewId: string) => api<{ success: boolean; action: string }>("/api/tooling/cli-tools/claude/apply", { method: "POST", body: { previewId } }), onSuccess: () => { void client.invalidateQueries({ queryKey: ["tooling", "claude"] }); void client.invalidateQueries({ queryKey: ["tooling", "cli-tools"] }); } });
}

export interface OpenCodeStatus { installed: boolean; configured: boolean; configPath: string; models: string[]; model: string | null }
export interface OpenCodePreview { previewId: string; action: "configure" | "reset"; configPath: string; backupPath: string; diff: string[]; expiresAt: string }
export const useOpenCodeStatus = () => useQuery({ queryKey: ["tooling", "opencode"], queryFn: () => api<OpenCodeStatus>("/api/tooling/cli-tools/opencode") });
export function useOpenCodePreview() { return useMutation({ mutationFn: (body: { action: "configure"; baseUrl: string; apiKey: string; model: string } | { action: "reset" }) => api<OpenCodePreview>("/api/tooling/cli-tools/opencode/preview", { method: "POST", body }) }); }
export function useApplyOpenCodePreview() { const client = useQueryClient(); return useMutation({ mutationFn: (previewId: string) => api<{ success: boolean; action: string }>("/api/tooling/cli-tools/opencode/apply", { method: "POST", body: { previewId } }), onSuccess: () => { void client.invalidateQueries({ queryKey: ["tooling", "opencode"] }); void client.invalidateQueries({ queryKey: ["tooling", "cli-tools"] }); } }); }

export interface ClineStatus { installed: boolean; configured: boolean; statePath: string; secretsPath: string; model: string | null; baseUrl: string | null }
export interface ClinePreview { previewId: string; action: "configure" | "reset"; statePath: string; secretsPath: string; diff: string[]; expiresAt: string }
export const useClineStatus = () => useQuery({ queryKey: ["tooling", "cline"], queryFn: () => api<ClineStatus>("/api/tooling/cli-tools/cline") });
export const useClinePreview = () => useMutation({ mutationFn: (body: { action: "configure"; baseUrl: string; apiKey: string; model: string } | { action: "reset" }) => api<ClinePreview>("/api/tooling/cli-tools/cline/preview", { method: "POST", body }) });
export function useApplyClinePreview() { const client = useQueryClient(); return useMutation({ mutationFn: (previewId: string) => api<{ success: boolean; action: string }>("/api/tooling/cli-tools/cline/apply", { method: "POST", body: { previewId } }), onSuccess: () => { void client.invalidateQueries({ queryKey: ["tooling", "cline"] }); void client.invalidateQueries({ queryKey: ["tooling", "cli-tools"] }); } }); }
export interface DroidStatus { installed: boolean; configured: boolean; configPath: string; models: string[] }
export interface DroidPreview { previewId: string; action: "configure" | "reset"; configPath: string; diff: string[]; expiresAt: string }
export const useDroidStatus = () => useQuery({ queryKey: ["tooling", "droid"], queryFn: () => api<DroidStatus>("/api/tooling/cli-tools/droid") });
export const useDroidPreview = () => useMutation({ mutationFn: (body: { action: "configure"; baseUrl: string; apiKey: string; model: string } | { action: "reset" }) => api<DroidPreview>("/api/tooling/cli-tools/droid/preview", { method: "POST", body }) });
export function useApplyDroidPreview() { const client = useQueryClient(); return useMutation({ mutationFn: (previewId: string) => api<{ success: boolean; action: string }>("/api/tooling/cli-tools/droid/apply", { method: "POST", body: { previewId } }), onSuccess: () => { void client.invalidateQueries({ queryKey: ["tooling", "droid"] }); } }); }
export interface CopilotStatus { installed: boolean; configured: boolean; configPath: string; models: string[] }
export interface CopilotPreview { previewId: string; action: "configure" | "reset"; configPath: string; diff: string[]; expiresAt: string }
export const useCopilotStatus = () => useQuery({ queryKey: ["tooling", "copilot"], queryFn: () => api<CopilotStatus>("/api/tooling/cli-tools/copilot") });
export const useCopilotPreview = () => useMutation({ mutationFn: (body: { action: "configure"; baseUrl: string; apiKey: string; model: string } | { action: "reset" }) => api<CopilotPreview>("/api/tooling/cli-tools/copilot/preview", { method: "POST", body }) });
export function useApplyCopilotPreview() { const client = useQueryClient(); return useMutation({ mutationFn: (previewId: string) => api<{ success: boolean; action: string }>("/api/tooling/cli-tools/copilot/apply", { method: "POST", body: { previewId } }), onSuccess: () => { void client.invalidateQueries({ queryKey: ["tooling", "copilot"] }); void client.invalidateQueries({ queryKey: ["tooling", "cli-tools"] }); } }); }
export type ManagedJsonTool = "crush" | "pi" | "smelt";
export interface ManagedJsonStatus { installed: boolean; configured: boolean; configPath: string }
export interface ManagedJsonPreview { previewId: string; action: "configure" | "reset"; configPath: string; diff: string[]; expiresAt: string }
export const useManagedJsonStatus = (tool: ManagedJsonTool) => useQuery({ queryKey: ["tooling", tool], queryFn: () => api<ManagedJsonStatus>(`/api/tooling/cli-tools/json/${tool}`) });
export const useManagedJsonPreview = (tool: ManagedJsonTool) => useMutation({ mutationFn: (body: { action: "configure"; baseUrl: string; apiKey: string; model: string } | { action: "reset" }) => api<ManagedJsonPreview>(`/api/tooling/cli-tools/json/${tool}/preview`, { method: "POST", body }) });
export function useApplyManagedJsonPreview(tool: ManagedJsonTool) { const client = useQueryClient(); return useMutation({ mutationFn: (previewId: string) => api<{ success: boolean; action: string }>(`/api/tooling/cli-tools/json/${tool}/apply`, { method: "POST", body: { previewId } }), onSuccess: () => { void client.invalidateQueries({ queryKey: ["tooling", tool] }); void client.invalidateQueries({ queryKey: ["tooling", "cli-tools"] }); } }); }
export type ManagedTomlTool = "codewhale" | "forge" | "deepseek-tui";
export interface ManagedTomlStatus { installed: boolean; configured: boolean; configPath: string }
export interface ManagedTomlPreview { previewId: string; action: "configure" | "reset"; configPath: string; diff: string[]; expiresAt: string }
export const useManagedTomlStatus = (tool: ManagedTomlTool) => useQuery({ queryKey: ["tooling", tool], queryFn: () => api<ManagedTomlStatus>(`/api/tooling/cli-tools/toml/${tool}`) });
export const useManagedTomlPreview = (tool: ManagedTomlTool) => useMutation({ mutationFn: (body: { action: "configure"; baseUrl: string; apiKey: string; model: string } | { action: "reset" }) => api<ManagedTomlPreview>(`/api/tooling/cli-tools/toml/${tool}/preview`, { method: "POST", body }) });
export function useApplyManagedTomlPreview(tool: ManagedTomlTool) { const client = useQueryClient(); return useMutation({ mutationFn: (previewId: string) => api<{ success: boolean; action: string }>(`/api/tooling/cli-tools/toml/${tool}/apply`, { method: "POST", body: { previewId } }), onSuccess: () => { void client.invalidateQueries({ queryKey: ["tooling", tool] }); void client.invalidateQueries({ queryKey: ["tooling", "cli-tools"] }); } }); }
export interface KiloStatus { installed: boolean; configured: boolean; authPath: string; vscodePath: string; model: string | null }
export interface KiloPreview { previewId: string; action: "configure" | "reset"; authPath: string; vscodePath: string; diff: string[]; expiresAt: string }
export const useKiloStatus = () => useQuery({ queryKey: ["tooling", "kilo"], queryFn: () => api<KiloStatus>("/api/tooling/cli-tools/kilo") });
export const useKiloPreview = () => useMutation({ mutationFn: (body: { action: "configure"; baseUrl: string; apiKey: string; model: string } | { action: "reset" }) => api<KiloPreview>("/api/tooling/cli-tools/kilo/preview", { method: "POST", body }) });
export function useApplyKiloPreview() { const client = useQueryClient(); return useMutation({ mutationFn: (previewId: string) => api<{ success: boolean; action: string }>("/api/tooling/cli-tools/kilo/apply", { method: "POST", body: { previewId } }), onSuccess: () => { void client.invalidateQueries({ queryKey: ["tooling", "kilo"] }); void client.invalidateQueries({ queryKey: ["tooling", "cli-tools"] }); } }); }

export interface OpenClawStatus { installed: boolean; configured: boolean; configPath: string; agents: { id: string; model: string }[] }
export interface OpenClawPreview { previewId: string; action: "configure" | "reset"; configPath: string; files: string[]; diff: string[]; expiresAt: string }
export const useOpenClawStatus = () => useQuery({ queryKey: ["tooling", "openclaw"], queryFn: () => api<OpenClawStatus>("/api/tooling/cli-tools/openclaw") });
export const useOpenClawPreview = () => useMutation({ mutationFn: (body: { action: "configure"; baseUrl: string; apiKey: string; model: string; agentModels: Record<string, string> } | { action: "reset" }) => api<OpenClawPreview>("/api/tooling/cli-tools/openclaw/preview", { method: "POST", body }) });
export function useApplyOpenClawPreview() { const client = useQueryClient(); return useMutation({ mutationFn: (previewId: string) => api<{ success: boolean; action: string }>("/api/tooling/cli-tools/openclaw/apply", { method: "POST", body: { previewId } }), onSuccess: () => { void client.invalidateQueries({ queryKey: ["tooling", "openclaw"] }); void client.invalidateQueries({ queryKey: ["tooling", "cli-tools"] }); } }); }

export interface HermesStatus { installed: boolean; configured: boolean; configPath: string; envPath: string }
export interface HermesPreview { previewId: string; action: "configure" | "reset"; configPath: string; envPath: string; diff: string[]; expiresAt: string }
export const useHermesStatus = () => useQuery({ queryKey: ["tooling", "hermes"], queryFn: () => api<HermesStatus>("/api/tooling/cli-tools/hermes") });
export const useHermesPreview = () => useMutation({ mutationFn: (body: { action: "configure"; baseUrl: string; apiKey: string; model: string } | { action: "reset" }) => api<HermesPreview>("/api/tooling/cli-tools/hermes/preview", { method: "POST", body }) });
export function useApplyHermesPreview() { const client = useQueryClient(); return useMutation({ mutationFn: (previewId: string) => api<{ success: boolean; action: string }>("/api/tooling/cli-tools/hermes/apply", { method: "POST", body: { previewId } }), onSuccess: () => { void client.invalidateQueries({ queryKey: ["tooling", "hermes"] }); void client.invalidateQueries({ queryKey: ["tooling", "cli-tools"] }); } }); }

export interface JcodeStatus { installed: boolean; configured: boolean; configPath: string; envPath: string }
export interface JcodePreview { previewId: string; action: "configure" | "reset"; configPath: string; envPath: string; diff: string[]; expiresAt: string }
export const useJcodeStatus = () => useQuery({ queryKey: ["tooling", "jcode"], queryFn: () => api<JcodeStatus>("/api/tooling/cli-tools/jcode") });
export const useJcodePreview = () => useMutation({ mutationFn: (body: { action: "configure"; baseUrl: string; apiKey: string; model: string } | { action: "reset" }) => api<JcodePreview>("/api/tooling/cli-tools/jcode/preview", { method: "POST", body }) });
export function useApplyJcodePreview() { const client = useQueryClient(); return useMutation({ mutationFn: (previewId: string) => api<{ success: boolean; action: string }>("/api/tooling/cli-tools/jcode/apply", { method: "POST", body: { previewId } }), onSuccess: () => { void client.invalidateQueries({ queryKey: ["tooling", "jcode"] }); void client.invalidateQueries({ queryKey: ["tooling", "cli-tools"] }); } }); }

export interface OmpStatus { installed: boolean; configured: boolean; configPath: string }
export interface OmpPreview { previewId: string; action: "configure" | "reset"; configPath: string; diff: string[]; expiresAt: string }
export const useOmpStatus = () => useQuery({ queryKey: ["tooling", "omp"], queryFn: () => api<OmpStatus>("/api/tooling/cli-tools/omp") });
export const useOmpPreview = () => useMutation({ mutationFn: (body: { action: "configure"; baseUrl: string; apiKey: string } | { action: "reset" }) => api<OmpPreview>("/api/tooling/cli-tools/omp/preview", { method: "POST", body }) });
export function useApplyOmpPreview() { const client = useQueryClient(); return useMutation({ mutationFn: (previewId: string) => api<{ success: boolean; action: string }>("/api/tooling/cli-tools/omp/apply", { method: "POST", body: { previewId } }), onSuccess: () => { void client.invalidateQueries({ queryKey: ["tooling", "omp"] }); void client.invalidateQueries({ queryKey: ["tooling", "cli-tools"] }); } }); }
export interface GrokBuildStatus { installed: boolean; configured: boolean; configPath: string; subagents: string[] }
export interface GrokBuildPreview { previewId: string; action: "configure" | "reset"; configPath: string; diff: string[]; expiresAt: string }
export const useGrokBuildStatus = () => useQuery({ queryKey: ["tooling", "grok-build"], queryFn: () => api<GrokBuildStatus>("/api/tooling/cli-tools/grok-build") });
export const useGrokBuildPreview = () => useMutation({ mutationFn: (body: { action: "configure"; baseUrl: string; apiKey: string; model: string; contextWindow?: number } | { action: "reset" }) => api<GrokBuildPreview>("/api/tooling/cli-tools/grok-build/preview", { method: "POST", body }) });
export function useApplyGrokBuildPreview() { const client = useQueryClient(); return useMutation({ mutationFn: (previewId: string) => api<{ success: boolean; action: string }>("/api/tooling/cli-tools/grok-build/apply", { method: "POST", body: { previewId } }), onSuccess: () => { void client.invalidateQueries({ queryKey: ["tooling", "grok-build"] }); void client.invalidateQueries({ queryKey: ["tooling", "cli-tools"] }); } }); }

export interface McpServer { id: string; name: string; url: string; scope: "user" | "project"; enabled: boolean; createdAt: string; updatedAt: string }
const mcpKey = ["tooling", "mcp-servers"] as const;
export const useMcpServers = () => useQuery({ queryKey: mcpKey, queryFn: () => api<McpServer[]>("/api/tooling/mcp/servers") });
export const useCreateMcpServer = () => {
  const client = useQueryClient();
  return useMutation({ mutationFn: (body: Pick<McpServer, "name" | "url" | "scope">) => api<McpServer>("/api/tooling/mcp/servers", { method: "POST", body }),
    onSettled: () => client.invalidateQueries({ queryKey: mcpKey }) });
};
export const useUpdateMcpServer = () => {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...body }: Partial<Pick<McpServer, "name" | "url" | "scope" | "enabled">> & { id: string }) => api<McpServer>(`/api/tooling/mcp/servers/${encodeURIComponent(id)}`, { method: "PATCH", body }),
    onSettled: () => client.invalidateQueries({ queryKey: mcpKey }) });
};
export const useDeleteMcpServer = () => {
  const client = useQueryClient();
  return useMutation({ mutationFn: (id: string) => apiVoid(`/api/tooling/mcp/servers/${encodeURIComponent(id)}`, "DELETE"),
    onSettled: () => client.invalidateQueries({ queryKey: mcpKey }) });
};
export interface McpMarketplaceServer { name: string; title: string; description: string; url: string; transport: "http" | "sse"; requiresAuth: boolean }
export const useMcpMarketplace = () => useQuery({ queryKey: ["tooling", "mcp-marketplace"], queryFn: () => api<{ cached: boolean; servers: McpMarketplaceServer[] }>("/api/tooling/mcp/marketplace") });
