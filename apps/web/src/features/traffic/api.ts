import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../shared/api";
import { toProblem, type Problem } from "../../shared/errors";

// docs/contracts/usage.md "Dashboard API".

export interface Counters {
  requests: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  cost: number;
  unpriced: number;
}
export interface WriterState { queued: number; dropped: number; failed: number }
export interface UsageSummary {
  timezone: string;
  period: string;
  totals: Counters;
  byProvider: (Counters & { provider: string; providerName: string })[];
  byModel: (Counters & { provider: string; providerName: string; model: string })[];
  byAccount: (Counters & { provider: string; providerName: string; connectionId: string | null; name: string | null })[];
  byApiKey: (Counters & { apiKeyId: string | null; name: string | null })[];
  byEndpoint: (Counters & { endpoint: string })[];
  writer: WriterState;
}
export interface ChartBucket { start: number; day?: string; requests: number; cost: number; tokens: Record<string, number> }
export interface UsageChart { timezone: string; bucket: "hour" | "day"; buckets: ChartBucket[] }
export interface RecentEvent {
  at: number; requestId: string; provider: string; model: string; connectionId: string | null; status: "success" | "error" | "aborted";
  errorCode: string | null; inputTokens: number; outputTokens: number; cost: number | null; estimated: boolean; latencyMs: number; ttftMs: number | null;
}
export interface LiveUsage { active: { provider: string; model: string; connectionId: string | null; count: number }[]; recent: RecentEvent[]; writer: WriterState; flushedAt: number }

export interface Price { input: number; output: number; cached?: number; reasoning?: number; cache_creation?: number }
export type PriceField = keyof Price;
export interface PriceOverride { provider: string; model: string; input: number | null; output: number | null; cached: number | null; reasoning: number | null; cache_creation: number | null; updatedAt: string }
export interface ResolvedPrice { price: Price | null; source: "override" | "provider" | "model" | "pattern" | "none" }

export interface PeriodQuery { period: string; from?: string; to?: string }
export const periodParams = ({ period, from, to }: PeriodQuery): string =>
  new URLSearchParams(period === "custom" ? { period, from: from ?? "", to: to ?? "" } : { period }).toString();

const summaryKey = ["usage", "summary"] as const;
const chartKey = ["usage", "chart"] as const;

export const useUsageSummary = (query: PeriodQuery, enabled = true) =>
  useQuery({ queryKey: [...summaryKey, query], queryFn: () => api<UsageSummary>(`/api/usage/summary?${periodParams(query)}`), enabled, placeholderData: (previous) => previous });
export const useUsageChart = (query: PeriodQuery, enabled = true) =>
  useQuery({ queryKey: [...chartKey, query], queryFn: () => api<UsageChart>(`/api/usage/chart?${periodParams(query)}`), enabled, placeholderData: (previous) => previous });

// usage.sse-live-stream: live counts, and a refetch of the figures at most every 5 s while writes land.
const REFETCH_EVERY_MS = 5_000;
export function useLiveUsage(): { live: LiveUsage | null; connected: boolean; stopped: Problem | null } {
  const client = useQueryClient();
  const [live, setLive] = useState<LiveUsage | null>(null);
  const [connected, setConnected] = useState(false);
  const [stopped, setStopped] = useState<Problem | null>(null);
  const lastFlush = useRef(0);
  const lastRefetch = useRef(0);
  useEffect(() => {
    const source = new EventSource("/api/usage/stream");
    source.onopen = () => setConnected(true);
    // A refused stream (16 open, or no session) closes for good; a dropped one reconnects on its own.
    source.onerror = () => {
      setConnected(false);
      if (source.readyState === EventSource.CLOSED) setStopped(toProblem(new ApiError(503, "USAGE_STREAM_BUSY", "")));
    };
    source.onmessage = (event: MessageEvent<string>) => {
      const next: LiveUsage = JSON.parse(event.data);
      setLive(next);
      if (next.writer.queued === 0 && next.flushedAt !== lastFlush.current && Date.now() - lastRefetch.current >= REFETCH_EVERY_MS) {
        lastFlush.current = next.flushedAt;
        lastRefetch.current = Date.now();
        void client.invalidateQueries({ queryKey: ["usage"] });
      }
    };
    return () => source.close();
  }, [client]);
  return { live, connected, stopped };
}

const pricingKey = ["pricing"] as const;
export const usePriceOverrides = () => useQuery({ queryKey: pricingKey, queryFn: () => api<{ overrides: PriceOverride[] }>("/api/pricing") });
export const useResolvedPrice = (provider: string, model: string) =>
  useQuery({ queryKey: [...pricingKey, "resolve", provider, model], queryFn: () => api<ResolvedPrice>(`/api/pricing/resolve?${new URLSearchParams({ provider, model })}`), enabled: Boolean(provider && model) });

export function usePricingEdits() {
  const client = useQueryClient();
  const settle = () => { void client.invalidateQueries({ queryKey: pricingKey }); void client.invalidateQueries({ queryKey: ["usage"] }); };
  const save = useMutation({
    mutationFn: ({ provider, model, fields }: { provider: string; model: string; fields: Partial<Price> }) =>
      api<{ overrides: PriceOverride[] }>("/api/pricing", { method: "PATCH", body: { [provider]: { [model]: fields } } }),
    onSuccess: settle,
  });
  const reset = useMutation({
    mutationFn: ({ provider, model }: { provider?: string; model?: string }) =>
      api<{ overrides: PriceOverride[] }>(`/api/pricing?${new URLSearchParams({ ...(provider ? { provider } : {}), ...(model ? { model } : {}) })}`, { method: "DELETE" }),
    onSuccess: settle,
  });
  return { save, reset };
}

// docs/contracts/usage.md "Requests".
export type UsageStatus = "success" | "error" | "aborted";
export interface RequestRow {
  id: string; at: number; endpoint: string; requestedModel: string | null; apiKeyId: string | null; keyName: string | null; stream: boolean;
  status: UsageStatus; httpStatus: number; errorCode: string | null; attempts: number;
  finalProvider: string | null; providerName: string | null; finalModel: string | null; finalConnectionId: string | null; connectionName: string | null;
  inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; reasoningTokens: number;
  cost: number | null; unpriced: number; latencyMs: number; ttftMs: number | null;
}
export interface Attempt {
  id: string; at: number; provider: string; providerName: string | null; model: string; connectionId: string | null; connectionName: string | null;
  status: UsageStatus; errorCode: string | null; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; reasoningTokens: number;
  estimated: boolean; cost: number | null; latencyMs: number; ttftMs: number | null;
}
export interface RequestFilters { status?: string; provider?: string; model?: string; endpoint?: string; fallback?: string }

export const REQUEST_PAGE = 100;
// A page holds at most five pages of rows; the filters narrow the rest.
export const MAX_REQUEST_ROWS = 500;
export const requestParams = (filters: RequestFilters, cursor?: string): string =>
  new URLSearchParams(Object.entries({ ...filters, limit: String(REQUEST_PAGE), ...(cursor ? { cursor } : {}) }).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString();

export const useRequests = (filters: RequestFilters) => useInfiniteQuery({
  queryKey: ["usage", "requests", filters],
  queryFn: ({ pageParam }) => api<{ items: RequestRow[]; nextCursor: string | null }>(`/api/requests?${requestParams(filters, pageParam)}`),
  initialPageParam: "",
  getNextPageParam: (page, pages) => (page.nextCursor && pages.length * REQUEST_PAGE < MAX_REQUEST_ROWS ? page.nextCursor : undefined),
});
export const useRequestFilters = () =>
  useQuery({ queryKey: ["usage", "request-filters"], queryFn: () => api<{ providers: { id: string; name: string }[]; models: { provider: string; model: string }[]; endpoints: string[] }>("/api/requests/filters") });
export const useRequestDetail = (id: string) =>
  useQuery({ queryKey: ["usage", "request", id], queryFn: () => api<{ request: RequestRow; attempts: Attempt[] }>(`/api/requests/${encodeURIComponent(id)}`), enabled: Boolean(id) });
