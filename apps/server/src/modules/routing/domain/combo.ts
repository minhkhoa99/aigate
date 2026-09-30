import { COMBO_STRATEGIES, type ComboStrategy } from "@aigate/database";
import type { CanonicalMessage, CanonicalRequest, CanonicalResponse, ContentPart } from "@aigate/engine";

// Model combos (docs/contracts/combos.md): the fields a combo is saved with, and the pure rules the chat lane applies.

export const MAX_COMBO_MEMBERS = 16;
// combo.nested-member-recursion: nesting is allowed; this bound turns a cycle into an answer.
export const MAX_COMBO_DEPTH = 3;
const MAX_MODEL_LENGTH = 200;
const NAME = /^[A-Za-z0-9_.-]{1,64}$/;

export interface ComboFields {
  name: string;
  models: string[];
  strategy: ComboStrategy;
  // null: the first member judges (combo.judge-prompt-synthesis).
  judgeModel: string | null;
  minPanel: number;
  stragglerGraceMs: number;
  panelTimeoutMs: number;
}
export interface Combo extends ComboFields {
  id: string;
  createdAt: string;
  updatedAt: string;
}
export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };
export const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
export const fail = (message: string): Parsed<never> => ({ ok: false, message });

// combo.mode-fusion-panel-completion: 9router's FUSION_DEFAULTS.
const DEFAULTS: Omit<ComboFields, "name" | "models"> = { strategy: "fallback", judgeModel: null, minPanel: 2, stragglerGraceMs: 8000, panelTimeoutMs: 90000 };

function integer(value: unknown, field: string, min: number, max: number): Parsed<number> {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max ? ok(value) : fail(`${field} must be a whole number from ${min} to ${max}`);
}

// Combo members and capacity pools (capacity-adapter.md): distinct model strings, at most 16.
export function parseModelList(value: unknown, min: 0 | 1): Parsed<string[]> {
  if (!Array.isArray(value) || value.length < min || value.length > MAX_COMBO_MEMBERS) return fail(`models must list ${min} to ${MAX_COMBO_MEMBERS} models`);
  const list: string[] = [];
  for (const item of value) {
    const model = typeof item === "string" ? item.trim() : "";
    if (model.length < 1 || model.length > MAX_MODEL_LENGTH) return fail(`Each model must be 1-${MAX_MODEL_LENGTH} characters, such as "openai/gpt-4.1"`);
    if (list.includes(model)) return fail(`${model} is listed twice in models`);
    list.push(model);
  }
  return ok(list);
}

const PARSERS: { [K in keyof ComboFields]: (value: unknown) => Parsed<ComboFields[K]> } = {
  name: (value) => (typeof value === "string" && NAME.test(value.trim()) ? ok(value.trim()) : fail("name must be 1-64 letters, digits, underscores, periods, or hyphens")),
  models: (value) => parseModelList(value, 1),
  strategy: (value) => {
    const found = COMBO_STRATEGIES.find((strategy) => strategy === value);
    return found ? ok(found) : fail(`strategy must be one of ${COMBO_STRATEGIES.join(", ")}`);
  },
  judgeModel: (value) => {
    if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return ok(null);
    return typeof value === "string" && value.trim().length <= MAX_MODEL_LENGTH ? ok(value.trim()) : fail(`judgeModel must be a model of up to ${MAX_MODEL_LENGTH} characters, or empty for the first member`);
  },
  minPanel: (value) => integer(value, "minPanel", 2, MAX_COMBO_MEMBERS),
  stragglerGraceMs: (value) => integer(value, "stragglerGraceMs", 0, 60_000),
  panelTimeoutMs: (value) => integer(value, "panelTimeoutMs", 1_000, 300_000),
};

const isField = (key: string): key is keyof ComboFields => Object.hasOwn(PARSERS, key);

function assign<K extends keyof ComboFields>(target: Partial<ComboFields>, key: K, value: unknown): string | undefined {
  const parsed = PARSERS[key](value);
  if (!parsed.ok) return parsed.message;
  target[key] = parsed.value;
  return undefined;
}

export function parseComboChanges(input: unknown): Parsed<Partial<ComboFields>> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return fail("Body must be a JSON object");
  const changes: Partial<ComboFields> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!isField(key)) return fail(`${key} is not a field of a combo`);
    const problem = assign(changes, key, value);
    if (problem) return fail(problem);
  }
  return Object.keys(changes).length === 0 ? fail("Send at least one combo field") : ok(changes);
}

export function parseNewCombo(input: unknown): Parsed<ComboFields> {
  const parsed = parseComboChanges(input);
  if (!parsed.ok) return parsed;
  const { name, models: list, ...rest } = parsed.value;
  if (name === undefined) return fail("name is required");
  if (list === undefined) return fail("models is required");
  return ok({ ...DEFAULTS, ...rest, name, models: list });
}

// A combo that lists itself would only recurse (combo.nested-member-recursion).
export const selfReference = (combo: Pick<ComboFields, "name" | "models">): string | undefined =>
  (combo.models.includes(combo.name) ? `models must not include the combo's own name (${combo.name})` : undefined);

// ---- round-robin (combo.mode-round-robin, combo.rotation-state-lifecycle) ----

export interface Rotation {
  readonly index: number;
  readonly used: number;
  // A changed sticky limit starts the rotation over, as 9router's settings reset does (settings.combo-rotation-reset).
  readonly limit: number;
}

// Members in this request's order (the full list, rotated), and the state for the next request.
export function rotate(members: readonly string[], state: Rotation | undefined, limit: number): { order: readonly string[]; next: Rotation } {
  const current = state && state.limit === limit ? state : { index: 0, used: 0, limit };
  const index = current.index % members.length;
  const used = current.used + 1;
  const next = used >= limit ? { index: (index + 1) % members.length, used: 0, limit } : { index, used, limit };
  return { order: [...members.slice(index), ...members.slice(0, index)], next };
}

// ---- fallback between members (combo.mode-fallback, 9router checkFallbackError) ----

// Text rules first; a 502-504 matching one is given this long before the next member (9router's backoff starts at 2 s).
const WAIT_RULES: readonly (readonly [string, number])[] = [
  ["request not allowed", 5_000], ["rate limit", 2_000], ["too many requests", 2_000], ["quota exceeded", 2_000], ["capacity", 2_000], ["overloaded", 2_000],
];
const NEXT_RULES = ["no credentials", "improperly formed request"];
const ACCOUNT_STATUSES = new Set([401, 402, 403, 404, 429]);

// Milliseconds to wait before the next member (0: go on at once), or undefined when the failure is the client's and is
// returned as it is.
export function memberFailover(status: number, message: string): number | undefined {
  const text = message.toLowerCase();
  const rule = WAIT_RULES.find(([needle]) => text.includes(needle));
  if (rule) return status >= 502 && status <= 504 ? rule[1] : 0;
  if (NEXT_RULES.some((needle) => text.includes(needle))) return 0;
  if (status >= 400 && status < 500 && !ACCOUNT_STATUSES.has(status)) return undefined;
  return 0;
}

// ---- fusion (combo.mode-fusion-*, combo.tool-history-flatten, combo.judge-prompt-synthesis) ----

export interface FusionTuning {
  readonly minPanel: number;
  readonly stragglerGraceMs: number;
  readonly panelTimeoutMs: number;
}
export interface PanelAnswer {
  readonly model: string;
  readonly text: string;
}

const textOf = (parts: readonly ContentPart[], separator: string): string =>
  parts.flatMap((part) => (part.type === "text" && part.text ? [part.text] : [])).join(separator);

// Tool turns become prose so the panel keeps the context but cannot call tools.
function flattenToolTurn(message: CanonicalMessage): CanonicalMessage {
  const calls = message.content.flatMap((part) => (part.type === "tool_call" ? [part.name || "tool"] : []));
  const results = message.content.flatMap((part) => (part.type === "tool_result" ? [textOf(part.content, "\n")] : []));
  if (calls.length === 0 && results.length === 0) return message;
  const lines = [textOf(message.content, "\n"), calls.length > 0 ? `[Called tools: ${calls.join(", ")}]` : "", results.length > 0 ? `[Tool result: ${results.join("\n")}]` : ""];
  return { role: message.role === "tool" ? "assistant" : message.role, content: [{ type: "text", text: lines.filter(Boolean).join("\n") }] };
}

// Forwarded fields that ask for tools; the panel request carries none.
const PANEL_DROPPED = new Set(["tool_choice", "parallel_tool_calls"]);

// A panel member's request: non-streaming, no tools, tool turns as prose.
export function panelRequest(request: CanonicalRequest): CanonicalRequest {
  const openai = request.vendorExtensions?.openai;
  const vendorExtensions = openai
    ? { ...request.vendorExtensions, openai: Object.fromEntries(Object.entries(openai).filter(([key]) => !PANEL_DROPPED.has(key))) }
    : request.vendorExtensions;
  return { ...request, stream: false, tools: undefined, toolChoice: undefined, vendorExtensions, messages: request.messages.map(flattenToolTurn) };
}

const answerText = (response: CanonicalResponse): string => textOf(response.content, "");

// The quorum-grace panel: at most four calls in flight; closes when every member settled, when minPanel answered and the
// straggler grace passed, or at the hard timeout. Calls still running then are cancelled. Answers keep panel order.
// ponytail: four concurrent panel calls per request; add a worker to the list below to raise it.
export async function collectPanel(
  panel: readonly string[], tuning: FusionTuning, signal: AbortSignal, ask: (model: string, signal: AbortSignal) => Promise<CanonicalResponse>,
): Promise<PanelAnswer[]> {
  const quorum = Math.min(Math.max(2, tuning.minPanel), panel.length);
  const closed = new AbortController();
  const linked = AbortSignal.any([signal, closed.signal]);
  const close = () => closed.abort(new Error("The fusion panel closed"));
  const texts = panel.map(() => "");
  let next = 0;
  let answered = 0;
  let grace: ReturnType<typeof setTimeout> | undefined;
  const hard = setTimeout(close, tuning.panelTimeoutMs);
  async function worker(): Promise<void> {
    while (next < panel.length && !linked.aborted) {
      const index = next++;
      // A member that fails, times out, or is cancelled is dropped (combo.mode-fusion-degrade).
      const response = await ask(panel[index], linked).catch(() => undefined);
      const text = response && !closed.signal.aborted ? answerText(response) : "";
      if (text.trim() === "") continue;
      texts[index] = text;
      answered += 1;
      if (answered >= quorum) grace ??= setTimeout(close, tuning.stragglerGraceMs);
    }
  }
  try {
    await Promise.all([worker(), worker(), worker(), worker()]);
  } finally {
    clearTimeout(hard);
    clearTimeout(grace);
    close();
  }
  return texts.flatMap((text, index) => (text ? [{ model: panel[index], text }] : []));
}

// 9router's judge directive: the sources are anonymized so the judge weighs substance, not a model's name.
function judgePrompt(answers: readonly PanelAnswer[]): string {
  return [
    `You are the JUDGE in a model-fusion panel. ${answers.length} expert models independently answered the user's most recent request. Their responses are below, anonymized by source.`,
    "",
    "Do NOT mention that multiple models were used, and do NOT refer to the sources. Produce ONE authoritative final answer addressed directly to the user.",
    "",
    "First, internally analyze the panel along these dimensions: consensus (points most sources agree on — treat as higher-confidence), contradictions (where they disagree — resolve with your own judgment), partial coverage, unique insights only one source surfaced, and blind spots every source missed. Then write the best possible final answer grounded in that analysis — more complete and correct than any single response, with no filler.",
    "",
    "=== PANEL RESPONSES ===",
    answers.map((answer, index) => `[Source ${index + 1}]\n${answer.text}`).join("\n\n"),
    "=== END PANEL RESPONSES ===",
    "",
    "Now write the final answer to the user's original request.",
  ].join("\n");
}

// The client's own request (stream flag and tools intact) with the judge directive as a new user turn.
export function judgeRequest(request: CanonicalRequest, answers: readonly PanelAnswer[]): CanonicalRequest {
  return { ...request, messages: [...request.messages, { role: "user", content: [{ type: "text", text: judgePrompt(answers) }] }] };
}
