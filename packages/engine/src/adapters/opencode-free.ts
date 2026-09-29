import { list, record, text, type Json } from "../json.js";

const NAMES = ["bash", "glob", "grep", "read"] as const;
const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const id = (prefix: "ses" | "msg") => {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return `${prefix}_${[...bytes.slice(0, 6)].map((value) => value.toString(16).padStart(2, "0")).join("")}${[...bytes.slice(6)].map((value) => CHARS[value % CHARS.length]).join("")}`;
};

// OpenCode Free accounts quota by upstream session. AIGate has no per-provider credential for this public provider,
// so one process session is the bounded equivalent of the reference's anonymous default session.
const SESSION = id("ses");
export const opencodeHeaders = (): Record<string, string> => ({ authorization: "Bearer public", "user-agent": "opencode/1.18.31", "x-opencode-client": "desktop", "x-opencode-session": SESSION, "x-opencode-request": id("msg"), "x-opencode-project": "global" });

const functionTool = (name: string, flat: boolean): Json => flat
  ? { type: "function", name, description: "This tool is currently unavailable and must not be used.", parameters: { type: "object", properties: {} } }
  : { type: "function", function: { name, description: "This tool is currently unavailable and must not be used.", parameters: { type: "object", properties: {} } } };

// The public endpoint verifies this exact quartet. Canonicalising avoids a client-supplied Bash plus injected bash.
export function applyOpenCodeFingerprint(body: Json, flat: boolean): void {
  const seen = new Set<string>();
  const tools = list(body.tools).flatMap((entry) => {
    const tool = record(entry);
    const holder = flat ? tool : record(tool.function);
    const original = text(holder.name);
    const name = original?.trim();
    const canonical = name?.toLowerCase();
    if (!canonical || !NAMES.some((known) => known === canonical)) return [tool];
    if (seen.has(canonical)) return [];
    seen.add(canonical);
    return flat ? [{ ...tool, name: canonical }] : [{ ...tool, function: { ...holder, name: canonical } }];
  });
  for (const name of NAMES) if (!seen.has(name)) tools.push(functionTool(name, flat));
  body.tools = tools;
  if (body.tool_choice === undefined) body.tool_choice = flat ? "auto" : "none";
}
