import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api";
import type { WriterState } from "../../shared/live-usage";

interface Metrics { requests: number; errors: number; tokens: number; cost: number; unpriced: number }
export interface OverviewSummary {
  at: number; timezone: string; uptimeSeconds: number; enabledConnections: number; quotaChecked: number;
  current: Metrics; previous: Metrics; buckets: (Metrics & { start: number })[];
  providers: { provider: string; name: string; enabledConnections: number; requests: number; errors: number; errorRate: number | null; health: "unknown" | "healthy" | "degraded" | "down" }[];
  providersTruncated: boolean;
  attention: { id: string; provider: string; name: string; kind: "lock" | "credential" | "expiry" | "quota"; tone: "warning" | "danger"; message: string; until: number | null }[];
  attentionTruncated: boolean; writer: WriterState;
}

export const useOverview = () => useQuery({
  queryKey: ["overview"], queryFn: () => api<OverviewSummary>("/api/overview/summary"), refetchInterval: 30_000,
});
