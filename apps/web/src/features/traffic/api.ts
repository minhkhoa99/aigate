import { useEffect, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiVoid } from "../../shared/api";
import type { WriterState } from "../../shared/live-usage";

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

export interface Price { input: number; output: number; cached?: number; reasoning?: number; cache_creation?: number }
export type PriceField = keyof Price;
export interface PriceOverride { provider: string; model: string; input: number | null; output: number | null; cached: number | null; reasoning: number | null; cache_creation: number | null; updatedAt: string }
export interface ResolvedPrice { price: Price | null; source: "override" | "provider" | "model" | "pattern" | "none" }

export interface PeriodQuery { period: string; from?: string; to?: string }
export const periodParams = ({ period, from, to }: PeriodQuery): string =>
  new URLSearchParams(period === "custom" ? { period, from: from ?? "", to: to ?? "" } : { period }).toString();

const summaryKey = ["usage", "summary"] as const;
const chartKey = ["usage", "chart"] as const;

export interface ConsoleEvent { id: string; at: string; level: "INFO" | "WARN" | "ERROR"; message: string }
const consoleKey = ["tooling", "logs"] as const;
export function useConsoleLogs(enabled = true) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: consoleKey, queryFn: () => api<ConsoleEvent[]>("/api/tooling/logs") });
  const [connected, setConnected] = useState(false);
  const [stopped, setStopped] = useState(false);
  useEffect(() => {
    if (!enabled) { setConnected(false); return; }
    setStopped(false);
    const source = new EventSource("/api/tooling/logs/stream");
    source.onopen = () => setConnected(true);
    source.onerror = () => { setConnected(false); if (source.readyState === EventSource.CLOSED) setStopped(true); };
    source.onmessage = (event: MessageEvent<string>) => {
      const row: ConsoleEvent = JSON.parse(event.data);
      client.setQueryData<ConsoleEvent[]>(consoleKey, (previous = []) => [...previous.filter((item) => item.id !== row.id), row].slice(-200));
    };
    source.addEventListener("clear", () => client.setQueryData<ConsoleEvent[]>(consoleKey, []));
    return () => { source.close(); setConnected(false); };
  }, [client, enabled]);
  const clear = async () => { await apiVoid("/api/tooling/logs", "DELETE"); client.setQueryData<ConsoleEvent[]>(consoleKey, []); };
  return { query, connected, stopped, clear };
}

export const useUsageSummary = (query: PeriodQuery, enabled = true) =>
  useQuery({ queryKey: [...summaryKey, query], queryFn: () => api<UsageSummary>(`/api/usage/summary?${periodParams(query)}`), enabled, placeholderData: (previous) => previous });
export const useUsageChart = (query: PeriodQuery, enabled = true) =>
  useQuery({ queryKey: [...chartKey, query], queryFn: () => api<UsageChart>(`/api/usage/chart?${periodParams(query)}`), enabled, placeholderData: (previous) => previous });

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
