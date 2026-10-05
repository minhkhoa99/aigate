import { apiStream, ApiError } from "./api.ts";

export interface WriterState { queued: number; dropped: number; failed: number }
export interface RecentEvent {
  at: number; requestId: string; provider: string; model: string; connectionId: string | null; status: "success" | "error" | "aborted";
  errorCode: string | null; inputTokens: number; outputTokens: number; cost: number | null; estimated: boolean; latencyMs: number; ttftMs: number | null;
}
export interface LiveUsage { active: { provider: string; model: string; connectionId: string | null; count: number }[]; recent: RecentEvent[]; writer: WriterState; flushedAt: number }

export const USAGE_HEARTBEAT_MS = 60_000;
export const MAX_USAGE_LINE_CHARS = 1024 * 1024;
const invalid = () => new ApiError(200, "BAD_RESPONSE", "AIGate returned an invalid or oversized live usage snapshot.");
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const number = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const nonnegative = (value: unknown) => number(value) && value >= 0;
const nullableText = (value: unknown) => value === null || typeof value === "string";

function snapshot(value: unknown): value is LiveUsage {
  if (!record(value) || !Array.isArray(value.active) || !Array.isArray(value.recent) || value.recent.length > 20 ||
    !record(value.writer) || !nonnegative(value.flushedAt) ||
    ![value.writer.queued, value.writer.dropped, value.writer.failed].every((count) => number(count) && Number.isSafeInteger(count) && count >= 0)) return false;
  return value.active.every((row) => record(row) && typeof row.provider === "string" && typeof row.model === "string" &&
    nullableText(row.connectionId) && number(row.count) && Number.isSafeInteger(row.count) && row.count > 0) &&
    value.recent.every((row) => record(row) && typeof row.requestId === "string" && typeof row.provider === "string" && typeof row.model === "string" &&
      nullableText(row.connectionId) && nullableText(row.errorCode) && typeof row.status === "string" && ["success", "error", "aborted"].includes(row.status) &&
      typeof row.estimated === "boolean" && [row.at, row.inputTokens, row.outputTokens, row.latencyMs].every(nonnegative) &&
      (row.cost === null || nonnegative(row.cost)) && (row.ttftMs === null || nonnegative(row.ttftMs)));
}

// Server contract: one JSON data line per snapshot, comments for heartbeat. No generic SSE framework needed.
export async function readLiveUsage(signal: AbortSignal, receive: (snapshot: LiveUsage) => void): Promise<void> {
  const idle = new AbortController();
  const response = await apiStream("/api/usage/stream", AbortSignal.any([signal, idle.signal]));
  const body = response.body;
  if (!body) throw invalid();
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let heartbeat: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    clearTimeout(heartbeat);
    heartbeat = setTimeout(() => idle.abort(new ApiError(0, "TIMEOUT", "Live usage heartbeat timed out.", { timeoutSeconds: USAGE_HEARTBEAT_MS / 1000 })), USAGE_HEARTBEAT_MS);
  };
  let carry = "";
  arm();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) throw new ApiError(0, "USAGE_STREAM_DISCONNECTED", "Live usage stream disconnected.");
      // Split new text only; an unfinished line is bounded and joined when its newline arrives.
      const lines = decoder.decode(value, { stream: true }).split("\n");
      lines[0] = carry + lines[0];
      carry = lines.pop() ?? "";
      if (carry.length > MAX_USAGE_LINE_CHARS) throw invalid();
      for (const raw of lines) {
        if (raw.length > MAX_USAGE_LINE_CHARS) throw invalid();
        const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
        if (line.startsWith(":")) { arm(); continue; }
        if (!line.startsWith("data:")) continue;
        let next: unknown;
        try { next = JSON.parse(line.slice(5)); }
        catch { throw invalid(); }
        if (!snapshot(next)) throw invalid();
        arm();
        receive(next);
      }
    }
  } catch (error) {
    if (idle.signal.aborted) throw idle.signal.reason;
    if (error instanceof ApiError || signal.aborted) throw error;
    throw new ApiError(0, "NETWORK_ERROR", "Live usage connection failed.");
  } finally {
    clearTimeout(heartbeat);
    idle.abort();
    // Fetch may already have aborted/closed the body; cleanup must not hide the original failure.
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
