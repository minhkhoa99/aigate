import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { UsageRecorder, type RecentEvent } from "../usage/infrastructure/usage-recorder.js";

export interface ConsoleEvent { id: string; at: string; level: "INFO" | "WARN" | "ERROR"; message: string }

const MAX_LOGS = 200;
const REDACT = /("?(?:api[_-]?key|authorization|access[_-]?token|refresh[_-]?token|password|secret)"?\s*[:=]\s*)("?)[^\s,"']+\2/gi;

@Injectable()
export class ConsoleLogService implements OnModuleInit, OnModuleDestroy {
  private readonly logs: ConsoleEvent[] = [];
  private readonly listeners = new Set<(event: ConsoleEvent | null) => void>();
  private readonly seen = new Set<string>();
  private off?: () => void;
  private lastRequestId?: string;

  constructor(private readonly usage: UsageRecorder) {}

  onModuleInit(): void {
    this.off = this.usage.onChange(() => this.captureLatest());
  }

  onModuleDestroy(): void { this.off?.(); }

  list(): ConsoleEvent[] { return [...this.logs]; }

  clear(): void {
    this.logs.length = 0;
    this.seen.clear();
    for (const listener of this.listeners) listener(null);
  }

  subscribe(listener: (event: ConsoleEvent | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private captureLatest(): void {
    const event = this.usage.live().recent[0];
    if (!event || event.requestId === this.lastRequestId || this.seen.has(event.requestId)) return;
    this.lastRequestId = event.requestId;
    this.seen.add(event.requestId);
    if (this.seen.size > MAX_LOGS * 2) this.seen.delete(this.seen.values().next().value!);
    const line = this.format(event);
    this.logs.push(line);
    if (this.logs.length > MAX_LOGS) this.logs.shift();
    for (const listener of this.listeners) listener(line);
  }

  private format(event: RecentEvent): ConsoleEvent {
    const level = event.status === "success" ? "INFO" : event.status === "aborted" ? "WARN" : "ERROR";
    const parts = [event.status === "success" ? "request completed" : `request ${event.status}`, event.requestId,
      event.provider, event.model, event.errorCode, `${event.inputTokens + event.outputTokens} tokens`].filter(Boolean);
    return { id: event.requestId, at: new Date(event.at).toISOString(), level, message: parts.join(" · ").replace(REDACT, "$1[redacted]").slice(0, 512) };
  }
}
