import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";
import { toProblem, type Problem } from "./errors";
import { readLiveUsage, type LiveUsage } from "./usage-stream";
export type { WriterState } from "./usage-stream";

// Overview and Usage consume the same bounded stream; no feature imports another feature.
export function useLiveUsage(): { live: LiveUsage | null; connected: boolean; failure: { error: unknown } | null; stopped: Problem | null; reconnect: () => void } {
  const client = useQueryClient();
  const [live, setLive] = useState<LiveUsage | null>(null);
  const [connected, setConnected] = useState(false);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  const lastRefetch = useRef(0);
  const [restart, setRestart] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let retry: ReturnType<typeof setTimeout> | undefined;
    let refresh: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    setConnected(false); setFailure(null);
    const receive = (next: LiveUsage) => {
      if (controller.signal.aborted) return;
      failures = 0;
      setConnected(true);
      setLive(next);
      if (next.writer.queued === 0 && refresh === undefined) {
        refresh = setTimeout(() => {
          refresh = undefined; lastRefetch.current = Date.now();
          void client.invalidateQueries({ queryKey: ["usage"] });
          void client.invalidateQueries({ queryKey: ["overview"] });
        }, Math.max(0, 5_000 - (Date.now() - lastRefetch.current)));
      }
    };
    const connect = async () => {
      try { await readLiveUsage(controller.signal, receive); }
      catch (error) {
        if (controller.signal.aborted) return;
        setConnected(false);
        failures += 1;
        const retryable = error instanceof ApiError && error.code !== "USAGE_STREAM_BUSY" &&
          (error.status >= 500 || (error.status === 0 && ["NETWORK_ERROR", "TIMEOUT", "USAGE_STREAM_DISCONNECTED"].includes(error.code)));
        if (retryable && failures < 3) retry = setTimeout(() => { void connect(); }, failures * 1_000);
        else setFailure({ error });
      }
    };
    void connect();
    return () => { controller.abort(); clearTimeout(retry); clearTimeout(refresh); };
  }, [client, restart]);
  return { live, connected, failure, stopped: failure ? toProblem(failure.error) : null, reconnect: () => setRestart((value) => value + 1) };
}
