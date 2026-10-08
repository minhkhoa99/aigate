import { ApiError } from "../../shared/api.ts";
import type { MessageKey } from "../../shared/i18n.ts";

type Capability = "vision" | "pdf" | "audioInput" | "videoInput" | "tools" | "reasoning";
export interface DecisionNode {
  id: number; parentId: number | null;
  kind: "request" | "combo" | "capacity" | "model" | "account" | "judge";
  status: "candidate" | "fallback" | "blocked" | "conditional" | "unknown";
  reason: string; model?: string; provider?: string; connectionId?: string; priority?: number; lockUntil?: string;
  errorCode?: string; missingCapabilities?: Capability[]; strategy?: "fill-first" | "round-robin" | "fallback" | "fusion";
  order?: number; trimmedMessages?: number;
  fusion?: { minPanel: number; stragglerGraceMs: number; panelTimeoutMs: number; concurrency: 4 };
}
export interface SimulationResult {
  observedAt: string; outcome: "candidate" | "blocked" | "conditional" | "inconclusive";
  requiredCapabilities: Capability[]; nodes: DecisionNode[]; warnings: string[]; truncated: boolean;
}
const REASONS: Readonly<Record<string, MessageKey>> = {
  "input-accepted": "simulator.reasonInputAccepted", "combo-fallback": "simulator.reasonComboFallback",
  "combo-round-robin": "simulator.reasonComboRoundRobin", "fusion-panel": "simulator.reasonFusionPanel",
  "fusion-judge": "simulator.reasonFusionJudge", "fusion-single-member": "simulator.reasonFusionSingleMember",
  "capacity-prepended": "simulator.reasonCapacityPrepended", "model-resolved": "simulator.reasonModelResolved",
  "keyless-provider": "simulator.reasonKeylessProvider", "account-selected": "simulator.reasonAccountSelected",
  "account-fallback": "simulator.reasonAccountFallback", "account-disabled": "simulator.reasonAccountDisabled",
  "account-locked": "simulator.reasonAccountLocked", "route-rejected": "simulator.reasonRouteRejected", "inspection-limit": "simulator.reasonInspectionLimit",
};
const WARNINGS: Readonly<Record<string, MessageKey>> = {
  "snapshot-not-reserved": "simulator.warningSnapshot", "credentials-unchecked": "simulator.warningCredentials",
  "headroom-skipped": "simulator.warningHeadroom", "pxpipe-skipped": "simulator.warningPxpipe",
  "provider-preparation-unchecked": "simulator.warningPreparation", "conditional-fallback": "simulator.warningFallback",
  "conditional-fusion": "simulator.warningFusion", "inspection-truncated": "simulator.warningTruncated",
};
export const reasonMessageKey = (reason: string): MessageKey => Object.hasOwn(REASONS, reason) ? REASONS[reason] : "simulator.reasonUnknown";
export const warningMessageKey = (warning: string): MessageKey => Object.hasOwn(WARNINGS, warning) ? WARNINGS[warning] : "simulator.warningUnknown";
const CAPABILITIES = ["vision", "pdf", "audioInput", "videoInput", "tools", "reasoning"];
const bad = () => new ApiError(200, "BAD_RESPONSE", "AIGate returned an invalid routing explanation.");
const capabilitiesValid = (value: readonly Capability[]) => Array.isArray(value) && value.length <= 6 && value.every(cap => CAPABILITIES.includes(cap));

export function simulationChildren(nodes: readonly DecisionNode[]): Map<number | null, DecisionNode[]> {
  if (!Array.isArray(nodes) || !nodes.length || nodes.length > 512) throw bad();
  const children = new Map<number | null, DecisionNode[]>(), depths = new Map<number, number>();
  for (const node of nodes) {
    if (!node || !Number.isSafeInteger(node.id) || node.id < 0 || depths.has(node.id) ||
      !["request", "combo", "capacity", "model", "account", "judge"].includes(node.kind) ||
      !["candidate", "fallback", "blocked", "conditional", "unknown"].includes(node.status) || typeof node.reason !== "string" || node.reason.length > 256) throw bad();
    const parentDepth = node.parentId === null ? -1 : depths.get(node.parentId);
    if (parentDepth === undefined || parentDepth >= 31 || (node.parentId === null && depths.size > 0)) throw bad();
    for (const text of [node.model, node.provider, node.connectionId, node.errorCode, node.lockUntil, node.strategy])
      if (text !== undefined && (typeof text !== "string" || text.length > 256)) throw bad();
    for (const number of [node.priority, node.order, node.trimmedMessages])
      if (number !== undefined && (!Number.isSafeInteger(number) || number < 0)) throw bad();
    if (node.lockUntil !== undefined && !Number.isFinite(Date.parse(node.lockUntil))) throw bad();
    if (node.missingCapabilities !== undefined && !capabilitiesValid(node.missingCapabilities)) throw bad();
    if (node.fusion && (node.fusion.concurrency !== 4 || ![node.fusion.minPanel, node.fusion.stragglerGraceMs, node.fusion.panelTimeoutMs].every(n => Number.isSafeInteger(n) && n >= 0))) throw bad();
    depths.set(node.id, parentDepth + 1);
    const siblings = children.get(node.parentId) ?? [];
    siblings.push(node); children.set(node.parentId, siblings);
  }
  return children;
}

export function validateSimulationResult(result: SimulationResult): Map<number | null, DecisionNode[]> {
  if (!result || typeof result.observedAt !== "string" || result.observedAt.length > 256 || !Number.isFinite(Date.parse(result.observedAt)) ||
    !["candidate", "blocked", "conditional", "inconclusive"].includes(result.outcome) || typeof result.truncated !== "boolean" ||
    !capabilitiesValid(result.requiredCapabilities) || !Array.isArray(result.warnings) || result.warnings.length > 32 ||
    result.warnings.some(w => typeof w !== "string" || w.length > 256)) throw bad();
  return simulationChildren(result.nodes);
}
