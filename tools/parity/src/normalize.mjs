// Semantic view of a client response (spec §8.3): what a client can observe, never byte layout.
// Frozen away: ids, created, system_fingerprint, header order, SSE chunk boundaries, error prose.

function parseSse(body) {
  const events = [];
  for (const block of body.split(/\r?\n\r?\n/)) {
    const data = block.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(l.startsWith("data: ") ? 6 : 5)).join("\n");
    if (data === "") continue;
    if (data === "[DONE]") { events.push("[DONE]"); continue; }
    try { events.push(JSON.parse(data)); } catch { events.push({ unparsable: data.slice(0, 80) }); }
  }
  return events;
}

const usageOf = (u) => (u ? { prompt: u.prompt_tokens ?? null, completion: u.completion_tokens ?? null, total: u.total_tokens ?? null } : null);
const errorOf = (e) => ({ type: e?.type ?? null, code: e?.code ?? null });

// Tool calls by index: id and name from the first delta, arguments concatenated.
function mergeToolCalls(target, deltas) {
  for (const call of deltas ?? []) {
    const slot = (target[call.index ?? 0] ??= { id: null, name: null, arguments: "" });
    if (call.id) slot.id = call.id;
    if (call.function?.name) slot.name = call.function.name;
    slot.arguments += call.function?.arguments ?? "";
  }
}

export function normalizeResponse({ status, contentType, body }) {
  if (!/event-stream/.test(contentType)) {
    let json;
    try { json = JSON.parse(body); } catch { return { kind: "unparsable", status }; }
    if (json?.error) return { kind: "error", status, error: errorOf(json.error) };
    const message = json?.choices?.[0]?.message ?? {};
    const toolCalls = (message.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function?.name, arguments: c.function?.arguments }));
    return {
      kind: "completion", status, object: json?.object ?? null,
      text: message.content ?? null, reasoning: message.reasoning_content ?? null, toolCalls,
      finishReason: json?.choices?.[0]?.finish_reason ?? null, usage: usageOf(json?.usage),
    };
  }
  const events = parseSse(body);
  const out = { kind: "stream", status, text: "", reasoning: "", toolCalls: [], finishReason: null, usage: null, terminal: "none", error: null, unparsable: 0 };
  for (const event of events) {
    if (event === "[DONE]") { out.terminal = "done"; continue; }
    if (event.unparsable) { out.unparsable++; continue; }
    if (event.error) { out.terminal = "error"; out.error = errorOf(event.error); continue; }
    if (event.usage) out.usage = usageOf(event.usage);
    const choice = event.choices?.[0];
    if (!choice) continue;
    out.text += choice.delta?.content ?? "";
    out.reasoning += choice.delta?.reasoning_content ?? "";
    mergeToolCalls(out.toolCalls, choice.delta?.tool_calls);
    if (choice.finish_reason) out.finishReason = choice.finish_reason;
  }
  out.toolCalls = out.toolCalls.filter(Boolean);
  return out;
}

// Semantic view of an upstream request body for tier 3: sorted keys, model plumbing dropped.
export function normalizeUpstream(body) {
  const sort = (value) => Array.isArray(value) ? value.map(sort)
    : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, sort(value[k])])) : value;
  const { model: _model, ...rest } = body ?? {};
  return sort(rest);
}

// Paths where two normalized values differ, as "a.b[0].c".
export function diff(a, b, path = "") {
  if (Object.is(a, b)) return [];
  if (a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].flatMap((k) => diff(a[k], b[k], Array.isArray(a) ? `${path}[${k}]` : path ? `${path}.${k}` : k));
  }
  return [path || "(root)"];
}

export const get = (value, path) => path === "*" ? value : path.split(/\.|\[|\]/).filter(Boolean).reduce((v, k) => (v == null ? v : v[k]), value);
