import { CATALOG } from "../catalog/providers.generated.js";
import { isRecord, list, record, text, type Json } from "../json.js";
import { CODEX_DEFAULT_INSTRUCTIONS } from "./codex-instructions.js";

// provider.codex-oauth (docs/contracts/oauth.md), kept as 9router has it (user decision 2026-09-27): what 9router's
// CodexExecutor does to a Responses body, and how it reads the codex model list.

// Server-generated item ids that /responses cannot resolve with store false.
const SERVER_ID = /^(rs|fc|resp|msg)_/;
const HOSTED_TOOLS = new Set(["image_generation", "web_search", "web_search_preview", "file_search", "computer", "computer_use_preview", "code_interpreter", "mcp", "local_shell", "tool_search"]);
const ALLOWED = new Set(["model", "input", "instructions", "tools", "tool_choice", "stream", "store", "reasoning", "service_tier", "include", "prompt_cache_key", "client_metadata", "text"]);
const DROPPED = ["temperature", "top_p", "frequency_penalty", "presence_penalty", "logprobs", "top_logprobs", "n", "seed", "max_tokens", "max_completion_tokens",
  "max_output_tokens", "user", "prompt_cache_retention", "metadata", "stream_options", "safety_identifier", "previous_response_id"];
const EFFORT_SUFFIXES = ["none", "minimal", "low", "medium", "high", "xhigh"];
const MAX_TOOL_NAME = 128;
const REVIEW_SUFFIX = "-review";
const placeholder = () => [{ type: "message", role: "user", content: [{ type: "input_text", text: "..." }] }];
// `\p{...}` / `\P{...}` after an odd number of backslashes: codex's schema validator has no Unicode property escapes.
const UNICODE_PROPERTY_ESCAPE = /(^|[^\\])(\\\\)*\\[pP]\{/;
const CODEX_MODELS = new Map((CATALOG.find((provider) => provider.id === "codex")?.models ?? []).map((model) => [model.id, model.upstreamModelId ?? model.id]));

// A review model goes out as its base model: the catalog's upstream id, else an unknown id without "-review".
const upstreamModel = (model: string): string => CODEX_MODELS.get(model) ?? (model.endsWith(REVIEW_SUFFIX) ? model.slice(0, -REVIEW_SUFFIX.length) : model);

// Only the `pattern` keywords holding a property escape go; property names are never read as keywords.
function stripPatterns(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripPatterns);
  if (!isRecord(node)) return node;
  return Object.fromEntries(Object.entries(node).flatMap(([key, value]): [string, unknown][] => {
    if (key === "pattern" && typeof value === "string" && UNICODE_PROPERTY_ESCAPE.test(value)) return [];
    if (key === "properties" && isRecord(value)) return [[key, Object.fromEntries(Object.entries(value).map(([name, schema]) => [name, stripPatterns(schema)]))]];
    return [[key, stripPatterns(value)]];
  }));
}

// Chat-shaped function tools flattened to the Responses shape; hosted tools kept, custom tools passed, others dropped;
// a tool_choice naming an unknown function dropped.
function normalizeTools(body: Json): void {
  if (!Array.isArray(body.tools)) return;
  const names = new Set<string>();
  body.tools = body.tools.flatMap((raw): Json[] => {
    if (!isRecord(raw)) return [];
    const type = text(raw.type) ?? "";
    if (type === "namespace") {
      if (!Array.isArray(raw.tools)) return [raw];
      const tools = raw.tools.map(record).map((tool) => {
        const name = (text(tool.name) ?? "").trim().slice(0, MAX_TOOL_NAME);
        if (name) names.add(name);
        return isRecord(tool.parameters) ? { ...tool, parameters: stripPatterns(tool.parameters) } : tool;
      });
      return [{ ...raw, tools }];
    }
    if (type !== "function") {
      if (type === "custom") return [raw];
      if (!type || raw.function || typeof raw.name === "string") return [];
      return HOSTED_TOOLS.has(type) ? [raw] : [];
    }
    const fn = isRecord(raw.function) ? raw.function : undefined;
    const name = (text(raw.name) ?? text(fn?.name) ?? "").trim();
    if (!name) return [];
    const description = text(raw.description) ?? text(fn?.description) ?? "";
    const parameters = isRecord(raw.parameters) ? raw.parameters : isRecord(fn?.parameters) ? fn.parameters : { type: "object", properties: {} };
    names.add(name);
    return [{ type: "function", name: name.slice(0, MAX_TOOL_NAME), ...(description ? { description } : {}), parameters: stripPatterns(parameters) }];
  });
  const choice = body.tool_choice;
  if (isRecord(choice) && choice.type === "function" && !names.has((text(choice.name) ?? "").trim())) delete body.tool_choice;
}

// Codex declares auto, none, low, medium and high; max and ultra become xhigh.
const normalizeEffort = (value: unknown): unknown => (value === "max" || value === "ultra" ? "xhigh" : value);

// 9router's CodexExecutor.transformRequest.
export function codexBody(source: Json, sessionId: string): Json {
  const body: Json = { ...source };
  delete body._compact;
  if (typeof body.input === "string") body.input = [{ type: "message", role: "user", content: [{ type: "input_text", text: body.input.trim() === "" ? "..." : body.input }] }];
  if (!Array.isArray(body.input) || body.input.length === 0) body.input = placeholder();
  // System prompts stay in the input as developer messages (the cacheable prefix); stored item references go.
  body.input = list(body.input).flatMap((item): unknown[] => {
    if (typeof item === "string") return SERVER_ID.test(item) ? [] : [item];
    if (!isRecord(item)) return [item];
    if (item.type === "item_reference") return [];
    const out: Json = { ...item };
    if (out.role === "system" && (!out.type || out.type === "message")) out.role = "developer";
    if (typeof out.id === "string" && SERVER_ID.test(out.id)) delete out.id;
    return [out];
  });
  normalizeTools(body);
  body.stream = true;
  if (!(text(body.instructions) ?? "").trim()) body.instructions = CODEX_DEFAULT_INSTRUCTIONS;
  body.store = false;
  if (!body.prompt_cache_key) body.prompt_cache_key = sessionId;
  let model = upstreamModel(text(body.model) ?? "");
  let suffixEffort: string | undefined;
  for (const level of EFFORT_SUFFIXES) {
    if (model.endsWith(`-${level}`)) {
      suffixEffort = level;
      model = model.replace(`-${level}`, "");
      break;
    }
  }
  body.model = model;
  body.reasoning = isRecord(body.reasoning)
    ? { ...body.reasoning, effort: normalizeEffort(body.reasoning.effort), summary: body.reasoning.summary || "auto" }
    : { effort: normalizeEffort(body.reasoning_effort || suffixEffort || "low"), summary: "auto" };
  const effort = record(body.reasoning).effort;
  if (effort && effort !== "none") body.include = ["reasoning.encrypted_content"];
  for (const key of DROPPED) delete body[key];
  if (body.service_tier === "fast") body.service_tier = "priority";
  if (body.service_tier && body.service_tier !== "priority") delete body.service_tier;
  return Object.fromEntries(Object.entries(body).filter(([key]) => ALLOWED.has(key)));
}

// 9router's CodexExecutor keeps the compact flag on a shared instance and builds the URL before reading the request's
// flag, so a request goes to /compact when the one before it asked for compaction (kept by user decision 2026-09-27,
// provider.codex-oauth).
let previousCompact = false;
export function codexUrl(base: string, body: Json): string {
  const url = previousCompact ? `${base}/compact` : base;
  previousCompact = Boolean(body._compact);
  return url;
}

// The codex model list: an array or data/models/results; each chat model also listed as "<id>-review".
export function codexModelIds(root: unknown): string[] {
  const payload = record(root);
  const items = Array.isArray(root) ? root : list(payload.data ?? payload.models ?? payload.results);
  return items.flatMap((raw) => {
    const item = record(raw);
    const id = text(item.id) ?? text(item.slug) ?? text(item.model) ?? text(item.name);
    if (!id) return [];
    const chat = (text(item.type) ?? "llm") !== "image" && !id.toLowerCase().includes("embed");
    return chat && !id.endsWith(REVIEW_SUFFIX) ? [id, `${id}${REVIEW_SUFFIX}`] : [id];
  });
}
