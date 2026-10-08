import { Buffer } from "node:buffer";
import { EngineError, parseOpenAIChatRequest, type CanonicalRequest, type Capability } from "@aigate/engine";

export const SIMULATION_BODY_BYTES = 64 * 1024;
export const SIMULATION_DEPTH = 32;
export const SIMULATION_NODES = 512;
export const SIMULATION_PROVIDERS = 32;
export const SIMULATION_DEADLINE_MS = 5_000;
export const SIMULATION_REASONS = ["input-accepted", "combo-fallback", "combo-round-robin", "fusion-panel", "fusion-judge", "fusion-single-member", "capacity-prepended", "model-resolved", "keyless-provider", "account-selected", "account-fallback", "account-disabled", "account-locked", "route-rejected", "inspection-limit"] as const;
export const SIMULATION_WARNINGS = ["snapshot-not-reserved", "credentials-unchecked", "headroom-skipped", "pxpipe-skipped", "provider-preparation-unchecked", "conditional-fallback", "conditional-fusion", "inspection-truncated"] as const;
export type SimulationReason = typeof SIMULATION_REASONS[number];
export type SimulationWarning = typeof SIMULATION_WARNINGS[number];
export interface DecisionNode {
  id: number;
  parentId: number | null;
  kind: "request" | "combo" | "capacity" | "model" | "account" | "judge";
  status: "candidate" | "fallback" | "blocked" | "conditional" | "unknown";
  reason: SimulationReason;
  model?: string;
  provider?: string;
  connectionId?: string;
  priority?: number;
  lockUntil?: string;
  errorCode?: string;
  missingCapabilities?: Capability[];
  strategy?: "fill-first" | "round-robin" | "fallback" | "fusion";
  order?: number;
  trimmedMessages?: number;
  fusion?: { minPanel: number; stragglerGraceMs: number; panelTimeoutMs: number; concurrency: 4 };
}
export interface SimulationResult {
  observedAt: string;
  outcome: "candidate" | "blocked" | "conditional" | "inconclusive";
  requiredCapabilities: Capability[];
  nodes: DecisionNode[];
  warnings: SimulationWarning[];
  truncated: boolean;
}
export interface SimulationInput { request: CanonicalRequest; tokenSaverOptOut: boolean }

export function parseSimulationInput(input: unknown): SimulationInput {
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw new EngineError("INVALID_REQUEST", "Simulation envelope must be a JSON object", { param: "envelope" });
  const pending: { value: unknown; depth: number }[] = [{ value: input, depth: 1 }];
  while (pending.length) {
    const entry = pending.pop();
    if (!entry || typeof entry.value !== "object" || entry.value === null) continue;
    if (entry.depth > SIMULATION_DEPTH) throw new EngineError("INVALID_REQUEST", "JSON nesting must be at most 32 levels", { param: "nesting" });
    for (const value of Object.values(entry.value)) if (typeof value === "object" && value !== null) pending.push({ value, depth: entry.depth + 1 });
  }
  if (Buffer.byteLength(JSON.stringify(input)) > SIMULATION_BODY_BYTES) throw new EngineError("INVALID_REQUEST", "Simulation JSON must be at most 64 KiB", { param: "size" });
  const envelope = new Map(Object.entries(input)), optOut = envelope.get("tokenSaverOptOut");
  if ([...envelope.keys()].some(key => key !== "request" && key !== "tokenSaverOptOut")) throw new EngineError("INVALID_REQUEST", "Simulation envelope accepts only request and tokenSaverOptOut", { param: "envelope" });
  if (optOut !== undefined && typeof optOut !== "boolean") throw new EngineError("INVALID_REQUEST", "tokenSaverOptOut must be true or false", { param: "tokenSaverOptOut" });
  return { request: parseOpenAIChatRequest(envelope.get("request")).request, tokenSaverOptOut: optOut === true };
}
