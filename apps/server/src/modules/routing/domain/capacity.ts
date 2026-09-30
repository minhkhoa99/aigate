import { CAPACITY_CAPABILITIES, type CapacityCapability } from "@aigate/database";
import {
  builtinRegistry, resolveCapabilities, splitThinkingSuffix, type CanonicalMessage, type CanonicalRequest, type Capability, type ContentPart, type ModelCapabilities,
} from "@aigate/engine";
import { fail, ok, parseModelList, type Parsed } from "./combo.js";

// Capacity adapter (docs/contracts/capacity-adapter.md): the pools a user saves, and the pure rules the chat lane applies.

export interface PoolFields {
  enabled: boolean;
  roundRobin: boolean;
  models: string[];
}
export interface CapacityPool extends PoolFields {
  capability: CapacityCapability;
  // null: never saved.
  updatedAt: string | null;
}

const LABEL: Record<CapacityCapability, string> = { vision: "Vision", pdf: "PDF", audioInput: "Audio input", videoInput: "Video input" };
const POOL_FIELDS = new Set(["enabled", "roundRobin", "models"]);

export const isCapacityCapability = (value: string): value is CapacityCapability => CAPACITY_CAPABILITIES.some((capability) => capability === value);

// capacity.default-pools-free-model (corrected): a pool routes only to models the user chose.
export function parsePool(capability: CapacityCapability, input: unknown): Parsed<PoolFields> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return fail("Body must be a JSON object");
  const body = new Map(Object.entries(input));
  const unknown = [...body.keys()].find((key) => !POOL_FIELDS.has(key));
  if (unknown) return fail(`${unknown} is not a field of a capacity pool`);
  const enabled = body.get("enabled");
  const roundRobin = body.get("roundRobin");
  if (typeof enabled !== "boolean") return fail("enabled must be true or false");
  if (typeof roundRobin !== "boolean") return fail("roundRobin must be true or false");
  const models = parseModelList(body.get("models"), 0);
  if (!models.ok) return models;
  if (enabled && models.value.length === 0) return fail(`Add at least one model before turning the ${LABEL[capability]} pool on`);
  return ok({ enabled, roundRobin, models: models.value });
}

// ---- what a model string can read (the catalog view the lane's own capability check uses) ----

interface ModelFit {
  readonly capabilities: ModelCapabilities;
  readonly contextWindow: number | null;
}

// "<provider or alias>/<model>" reads that catalog model; a bare id the first provider declaring it; anything else
// (custom providers, unknown ids, combo names) the default floor and the vision name heuristic.
export function modelFit(ref: string): ModelFit {
  const slash = ref.indexOf("/");
  const prefixed = slash > 0 ? builtinRegistry.provider(ref.slice(0, slash)) : undefined;
  const id = splitThinkingSuffix(prefixed ? ref.slice(slash + 1) : ref).model;
  const provider = prefixed ?? builtinRegistry.providers.find((candidate) => builtinRegistry.model(candidate.id, id) !== undefined);
  const model = provider ? builtinRegistry.model(provider.id, id) : undefined;
  return { capabilities: resolveCapabilities(model, id), contextWindow: model?.contextWindow ?? null };
}

const HARD: ReadonlySet<Capability> = new Set<Capability>(CAPACITY_CAPABILITIES);
const hardNeeds = (required: ReadonlySet<Capability>): CapacityCapability[] => CAPACITY_CAPABILITIES.filter((capability) => required.has(capability));
// Only a request that needs an input modality can be widened.
export const needsMedia = (required: ReadonlySet<Capability>): boolean => CAPACITY_CAPABILITIES.some((capability) => required.has(capability));
const fits = (ref: string, needs: readonly Capability[]): boolean => {
  const { capabilities } = modelFit(ref);
  return needs.every((capability) => capabilities[capability]);
};

// combo.reorder-by-capabilities-tiers: stable; tier 0 reads everything required, tier 1 every hard capability, tier 2
// misses a hard one. Nobody is dropped.
export function reorderByCapabilities(models: readonly string[], required: ReadonlySet<Capability>): readonly string[] {
  if (required.size === 0 || models.length <= 1) return models;
  const hard = hardNeeds(required);
  const soft = [...required].filter((capability) => !HARD.has(capability));
  const tier = (ref: string): number => {
    const { capabilities } = modelFit(ref);
    if (!hard.every((capability) => capabilities[capability])) return 2;
    return soft.every((capability) => capabilities[capability]) ? 0 : 1;
  };
  return models.map((model, index) => ({ model, index, tier: tier(model) }))
    .sort((a, b) => a.tier - b.tier || a.index - b.index)
    .map((entry) => entry.model);
}

export interface Widening {
  // Capable pool models, tried before the originals.
  readonly pool: readonly string[];
  // capacity.pool-models-and-strategy: the first required capability's pool, when it rotates.
  readonly rotate: CapacityCapability | undefined;
}

// capacity.augment-models-priority-prepend: only when none of the originals reads every required hard capability.
// `pools` is in CAPACITY_CAPABILITIES order, so a model in two pools keeps its first place.
export function widen(originals: readonly string[], required: ReadonlySet<Capability>, pools: readonly CapacityPool[]): Widening | undefined {
  const hard = hardNeeds(required);
  if (hard.length === 0 || originals.some((model) => fits(model, hard))) return undefined;
  const on = pools.filter((pool) => pool.enabled && pool.models.length > 0);
  const pool = [...new Set(on.flatMap((entry) => entry.models))].filter((model) => !originals.includes(model) && fits(model, hard));
  if (pool.length === 0) return undefined;
  const active = on.find((entry) => hard.includes(entry.capability));
  return { pool, rotate: active?.roundRobin ? active.capability : undefined };
}

// ---- capacity.strip-history-budget-formula, capacity.strip-orphans-tool-calls (corrected) ----

const CHARS_PER_TOKEN = 4;
const HEAD_KEEP = 6;
const UNKNOWN_CONTEXT_WINDOW = 200_000;
// Any part that is not text (an image, audio, a tool call) counts this many characters; a tool result counts its text.
const OTHER_PART_CHARS = 50;

const textLength = (parts: readonly ContentPart[]): number => parts.reduce((sum, part) => sum + (part.type === "text" ? part.text.length : 0), 0);
const partsLength = (parts: readonly ContentPart[]): number => parts.reduce((sum, part) => sum + (part.type === "text" ? part.text.length
  : part.type === "tool_result" ? textLength(part.content) : OTHER_PART_CHARS), 0);
const messagesLength = (messages: readonly CanonicalMessage[]): number => messages.reduce((sum, message) => sum + partsLength(message.content), 0);
const callsTools = (message: CanonicalMessage): boolean => message.content.some((part) => part.type === "tool_call");
// Anthropic clients send tool results as user messages; those continue the turn, they do not start one.
const startsTurn = (message: CanonicalMessage): boolean => message.role === "user" && message.content.some((part) => part.type !== "tool_result");

// A pool model's request: the system prompt and the current turn (from the last user message on) stay whole; of the
// older turns, the first six are kept while they fit in 80% of the model's window. Unchanged: the same object.
export function trimHistory(request: CanonicalRequest, contextWindow: number | null): CanonicalRequest {
  const current = request.messages.findLastIndex(startsTurn);
  if (current <= 0) return request;
  const older = request.messages.slice(0, current);
  const tail = request.messages.slice(current);
  const budget = (contextWindow ?? UNKNOWN_CONTEXT_WINDOW) * 0.8 * CHARS_PER_TOKEN;
  const head = older.slice(0, HEAD_KEEP);
  let total = partsLength(request.system ?? []) + messagesLength(head) + messagesLength(tail);
  while (total > budget) {
    const dropped = head.pop();
    if (!dropped) break;
    total -= partsLength(dropped.content);
  }
  // A kept call whose results were dropped would be rejected upstream, so it goes too.
  while (head.length > 0 && head.length < older.length && callsTools(head[head.length - 1])) head.pop();
  return head.length === older.length ? request : { ...request, messages: [...head, ...tail] };
}
