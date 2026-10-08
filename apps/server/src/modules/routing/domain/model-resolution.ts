import { builtinRegistry, splitThinkingSuffix } from "@aigate/engine";

export type ModelResolution =
  | { ok: true; providerId: string; modelId: string; catalogModelId: string }
  | { ok: false; status: number; type: string; code: string; message: string };

// Prefix discovery is caller-owned I/O. Bare model IDs retain catalog order, including '/' inside an ID.
export function resolveModelTarget(ref: string, prefixedProviderId: string | undefined, active: ReadonlySet<string>): ModelResolution {
  const modelId = prefixedProviderId ? ref.slice(ref.indexOf("/") + 1) : ref;
  const catalogModelId = splitThinkingSuffix(modelId).model;
  const missing: ModelResolution = { ok: false, status: 404, type: "not_found_error", code: "model_not_found",
    message: `The model "${ref}" is not in the catalog. Use "<provider>/<model>" such as "openai/gpt-4.1"; GET /v1/models lists the models of your connected providers.` };
  if (!modelId) return missing;
  if (prefixedProviderId) return { ok: true, providerId: prefixedProviderId, modelId, catalogModelId };
  const declaring = builtinRegistry.providers.filter(p => builtinRegistry.model(p.id, catalogModelId) !== undefined);
  if (!declaring.length) return missing;
  const provider = declaring.find(p => active.has(p.id));
  if (provider) return { ok: true, providerId: provider.id, modelId, catalogModelId };
  const names = declaring.slice(0, 3).map(p => p.name).join(", ");
  return { ok: false, status: 404, type: "not_found_error", code: "no_active_connection",
    message: `No active connection serves "${ref}". Add or enable one for ${names}${declaring.length > 3 ? ", …" : ""} in AIGate: Providers → Connections.` };
}
