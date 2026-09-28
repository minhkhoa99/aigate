import type { Tone } from "../../shared/ui";
import type { ListedModel, ModelProbe } from "./api";

// docs/contracts/custom-models.md, "Dashboard". An id the provider already lists (catalog or custom) cannot be added again.
export const DUPLICATE = "Model already exists for this provider.";

// routing.model-thinking-suffix: the dashboard only copies a suffix for a model the provider says can reason.
export const useAs = (prefix: string, id: string, thinking: string, reasons: boolean): string =>
  `${prefix}/${id}${thinking !== "auto" && reasons ? `(${thinking})` : ""}`;

export interface ImportChoice { id: string; state: "new" | "catalog" | "added" }

export function importChoices(fetched: readonly ListedModel[], listed: ReadonlySet<string>): ImportChoice[] {
  return fetched.map((m) => ({ id: m.id, state: m.inCatalog ? "catalog" : listed.has(m.id) ? "added" : "new" }));
}

// 9router's two messages; null means there is something to pick.
export function importMessage(choices: readonly ImportChoice[]): string | null {
  if (choices.length === 0) return "No models returned from /models.";
  return choices.some((c) => c.state === "new") ? null : "No new models were added.";
}

export function describeProbe(probe: ModelProbe): { tone: Tone; label: string; detail: string | null } {
  if (!probe.ok) return { tone: "danger", label: "Failed", detail: probe.error };
  return { tone: "healthy", label: `OK · ${probe.latencyMs} ms`, detail: probe.note ?? null };
}
