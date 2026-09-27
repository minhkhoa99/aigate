import type { CanonicalRequest } from "../cip.js";
import { list, record, text, type Json } from "../json.js";

// provider.claude-oauth and translator.claude-oauth-cloaking (docs/contracts/oauth.md), kept as 9router has them (user
// decision 2026-09-27): what 9router's prepareClaudeRequest and cloaking do to a Messages body for the claude provider.
// The body is the finished Messages JSON; nothing here calls the network.

export const CLAUDE_CODE_PROMPT = "You are Claude Code, Anthropic's official CLI for Claude.";
const CLI_VERSION = "2.1.280";
const DEFAULT_MAX_TOKENS = 64_000;
const THINKING_HEADROOM = 1_024;
const EPHEMERAL = { type: "ephemeral" };
const ONE_HOUR = { type: "ephemeral", ttl: "1h" };
const OAUTH_TOKEN = "sk-ant-oat";
const BILLING_PREFIX = "x-anthropic-billing-header:";
const TOOL_SUFFIX = "_ide";
const DECOY_NAMES = [
  "Task", "TaskOutput", "TaskStop", "TaskCreate", "TaskGet", "TaskUpdate", "TaskList", "Bash", "Glob", "Grep", "Read", "Edit", "Write",
  "NotebookEdit", "WebFetch", "WebSearch", "AskUserQuestion", "Skill", "EnterPlanMode", "ExitPlanMode",
];
const DECOYS = DECOY_NAMES.map((name) => ({ name, description: "This tool is currently unavailable.", input_schema: { type: "object", properties: {} } }));
// 9router's DEFAULT_THINKING_CLAUDE_SIGNATURE, sent on the placeholder thinking block.
const PLACEHOLDER_SIGNATURE = "EpwGCkYIChgCKkCzVUuRrg7CcglSUWEef4rH6o35g9UYS8ZPe0/VomQTBsFx6sttYNj5l8GqgW6ejuHyYqpFToxIbZl0bw17l5dJEgzCnqDO0Z8fRlMrNgsaDLS1cnCjC53KBqE0CCIwAADQdo1eO+7qPAmo8J4WR3JPmr92S97kmvr5K1iPMiOpkZNj8mEXW8uzBoOJs/9ZKoMFiqHJ3UObwaJDqFOW70E9oCwDoc6jesaWVAEdN5vWfKMpIkjFJjECdjIdkxyJNJ8Ib8yXVal3qwE7uThoPRqSZDdHB5mmwPEjWE/90cSYCbtX2YsJki1265CabBb8/QEkODXg4kgRrL+c8e8rRXz/dr1RswvaPuzEdGKHRNi9UooNUeOK4/ebx1KkP9YZttyohN9GWqlts36kOoW0Cfie/ABDgF9g534BPth/sstxDM6d79QlRmh6NxizyTF74DXJI34u0M4tTRchqE5pAq85SgdJaa+dix1yJPMji8m6nZkwJbscJb9rdc2MKyKWjz8QL2+rTSSuZ2F1k1qSsW0xNcI7qLcI12Vncfn/VqY6YOIZy/saZBR0ezXvN6g+UYbuIdyVg7AyIFZt3nbrO7/kmOEb2VKzygwklHGEIJHfFgMpH3JSrAzbZIowVHOF7VaJ+KXRFDCFin7hHTOiOsdg+1ij1mML9Z/x/9CP4b7OUcaQm1llDZPSHc6rZMNL3DdB+fW5YfmNgKU35S+7AMtA10nVILzDAk1UV4T2K9Do09JlI6rjOs9UuULlIN2Z0eE8YTlANR6uQcw7lMcdfqYE8tke4rDKc2dDiaS5vVe45VewICNpdXGN11yw8QqH7p27CR1HtN30e0tHXOR3bIwWk/Yb6O5fTaKG6Ri8e5ZCPvdD9HqepVi188nM0iTjJqL58F3ni04ECIhcbyaQWnuTes1Kw4CMwiZDLQkk8Hgz7HkUOf1btQTF/0nhD7ry0n0hAEg2PaDM3V6TjOjf4hEldRmeqERcQF1PfgKb6ZM12rlIIfUqKACczWJSzTV158+47HX36o0cgux6nFlv/DE+sEiRVxgB";
const SIGNATURE_MARKER = 0x12;

async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const decode = (value: string): Uint8Array => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const withoutCache = (block: Json): Json => Object.fromEntries(Object.entries(block).filter(([key]) => key !== "cache_control"));

// A Claude thinking signature: base64 whose first byte is 0x12, or that base64 encoded again (text after a "#" cache
// prefix is what counts).
export function isClaudeSignature(raw: unknown): boolean {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  const sig = trimmed.includes("#") ? trimmed.slice(trimmed.indexOf("#") + 1).trim() : trimmed;
  try {
    if (sig.startsWith("E")) return decode(sig)[0] === SIGNATURE_MARKER;
    if (sig.startsWith("R")) {
      const outer = decode(sig);
      return outer[0] === 0x45 && decode(new TextDecoder().decode(outer))[0] === SIGNATURE_MARKER;
    }
  } catch {
    return false;
  }
  return false;
}

const isThinking = (block: Json) => block.type === "thinking" || block.type === "redacted_thinking";
const hasContent = (block: Json) =>
  (block.type === "text" && typeof block.text === "string" && block.text.trim() !== "")
  || block.type === "tool_use" || block.type === "tool_result" || block.type === "image" || block.type === "document";

// An assistant turn with a tool call keeps its thinking, its tool calls and the text before the first call; then
// same-role turns merge with tool results first.
function fixToolUseOrdering(messages: readonly Json[]): Json[] {
  const merged: Json[] = [];
  for (const message of messages) {
    let content = list(message.content).map(record);
    if (message.role === "assistant" && content.some((block) => block.type === "tool_use")) {
      let seen = false;
      content = content.filter((block) => {
        if (block.type === "tool_use") seen = true;
        return block.type === "tool_use" || isThinking(block) || !seen;
      });
    }
    const last = merged.at(-1);
    if (last && last.role === message.role) {
      const both = [...list(last.content).map(record), ...content];
      last.content = [...both.filter((block) => block.type === "tool_result"), ...both.filter((block) => block.type !== "tool_result")];
    } else merged.push({ role: message.role, content });
  }
  return merged;
}

function prepareMessages(raw: readonly Json[], thinkingOn: boolean, claude: boolean): Json[] {
  const kept = raw.flatMap((message, i) => {
    const content = list(message.content).map((block) => withoutCache(record(block)));
    const finalAssistant = i === raw.length - 1 && message.role === "assistant";
    return finalAssistant || content.some(hasContent) ? [{ ...message, content }] : [];
  });
  const messages = fixToolUseOrdering(kept);
  // 9router also needs the last turn to be the user's; AnthropicAdapter already refuses thinking after an assistant turn.
  const thinkingEnabled = thinkingOn;
  let marked = false;
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role !== "assistant") continue;
    const content = list(message.content).map(record);
    if (!marked && content.length > 0) {
      const last = content.findLastIndex((block) => !isThinking(block));
      if (last >= 0) content[last] = { ...content[last], cache_control: EPHEMERAL };
      marked = true;
    }
    // Other providers keep their thinking blocks as they are (9router handlesThinkingBlocks is false for them).
    if (!claude) {
      message.content = content;
      continue;
    }
    // Only signed thinking survives; a turn with a tool call gets a placeholder when thinking is on and none survived.
    const signed = content.filter((block) => !isThinking(block) || isClaudeSignature(block.signature));
    if (thinkingEnabled && !signed.some(isThinking) && signed.some((block) => block.type === "tool_use")) {
      signed.unshift({ type: "thinking", thinking: ".", signature: PLACEHOLDER_SIGNATURE });
    }
    message.content = signed;
  }
  return messages;
}

// A tool result's images move out of it into the same user turn (other Anthropic-shaped hosts drop them inside a result).
function hoistToolResultImages(messages: Json[]): Json[] {
  return messages.map((message) => {
    if (message.role !== "user" || !Array.isArray(message.content)) return message;
    const hoisted: Json[] = [];
    const content = message.content.map(record).map((block) => {
      if (block.type !== "tool_result" || !Array.isArray(block.content)) return block;
      const inner = block.content.map(record);
      const images = inner.filter((part) => part.type === "image");
      if (images.length === 0) return block;
      const rest = inner.filter((part) => part.type !== "image");
      hoisted.push({ type: "text", text: `[Image from tool result ${text(block.tool_use_id) ?? ""}]` }, ...images);
      return { ...block, content: rest.length > 0 ? rest : [{ type: "text", text: "(image attached below)" }] };
    });
    return hoisted.length > 0 ? { ...message, content: [...content, ...hoisted] } : message;
  });
}

// 9router's prepareClaudeRequest, for provider "claude" or (claude false) another provider on a Messages endpoint. The
// client's cache marks give way to 9router's: 1 h on the last system block and tool, 5 min on the last assistant block.
function prepare(body: Json, ceiling: number | null, claude = true): Json {
  const out: Json = { ...body };
  if (typeof out.max_tokens === "number") {
    const cap = ceiling ?? DEFAULT_MAX_TOKENS;
    let maxTokens = Math.min(out.max_tokens, cap);
    const thinking = record(out.thinking);
    const budget = thinking.budget_tokens;
    if (thinking.type === "enabled" && typeof budget === "number" && budget >= maxTokens) {
      maxTokens = Math.min(budget + THINKING_HEADROOM, cap);
      if (budget >= maxTokens) out.thinking = { ...thinking, budget_tokens: Math.max(THINKING_HEADROOM, maxTokens - THINKING_HEADROOM) };
    }
    out.max_tokens = maxTokens;
  }
  if (Array.isArray(out.system)) {
    const system = out.system.map(record);
    out.system = system.map((block, i) => (i === system.length - 1 ? { ...withoutCache(block), cache_control: ONE_HOUR } : withoutCache(block)));
  }
  if (Array.isArray(out.messages)) out.messages = prepareMessages(out.messages.map(record), record(out.thinking).type === "enabled", claude);
  if (Array.isArray(out.tools)) {
    // Other providers lose typed server tools, and function-shaped ones are folded into the Messages shape.
    const tools = out.tools.map(record).flatMap((tool): Json[] => {
      if (claude) return [tool];
      if (tool.type && tool.type !== "function") return [];
      const fn = record(tool.function);
      if (tool.function) return [{ name: fn.name, description: fn.description, input_schema: fn.parameters }];
      return [Object.fromEntries(Object.entries(tool).filter(([key]) => key !== "type"))];
    });
    // A deferred tool cannot carry a cache mark, so the last one that can gets it.
    const anchor = tools.findLastIndex((tool) => tool.defer_loading !== true);
    out.tools = tools.map((tool, i) => (i === anchor ? { ...withoutCache(tool), cache_control: ONE_HOUR } : withoutCache(tool)));
    if (tools.length === 0) {
      delete out.tools;
      delete out.tool_choice;
    }
  }
  if (!claude && Array.isArray(out.messages)) out.messages = hoistToolResultImages(out.messages.map(record));
  return out;
}

// provider.github-copilot-oauth: Copilot's /v1/messages gets 9router's prepareClaudeRequest for a provider that is not
// claude (no thinking rules, no cloaking).
export const copilotMessagesBody = (body: Json, ceiling: number | null): Json => prepare(body, ceiling, false);

// A UUID-v4-shaped id derived from a seed (stable per account).
async function derivedUuid(seed: string): Promise<string> {
  const h = await sha256Hex(seed);
  const variant = ((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// The billing header in front of the system prompt and an invented user id, for an OAuth token only.
async function cloak(body: Json, token: string, sessionId: string | undefined): Promise<Json> {
  const buildHash = Array.from(crypto.getRandomValues(new Uint8Array(2)), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 3);
  const cch = (await sha256Hex(JSON.stringify(body))).slice(0, 5);
  const billing = { type: "text", text: `${BILLING_PREFIX} cc_version=${CLI_VERSION}.${buildHash}; cc_entrypoint=sdk-cli; cch=${cch};` };
  const out: Json = { ...body };
  if (Array.isArray(out.system)) {
    if (!(text(record(out.system[0]).text) ?? "").startsWith(BILLING_PREFIX)) out.system = [billing, ...out.system];
  } else if (typeof out.system === "string") out.system = [billing, { type: "text", text: out.system }];
  else out.system = [billing];
  const metadata = record(out.metadata);
  if (!metadata.user_id) {
    const device = await sha256Hex(`device:${token}`);
    const account = await derivedUuid(`account:${token}`);
    out.metadata = { ...metadata, user_id: `{"device_id":"${device}","account_uuid":"${account}","session_id":"${sessionId ?? crypto.randomUUID()}"}` };
  }
  return out;
}

// Client tools renamed with "_ide" (typed server tools kept), 20 decoy Claude Code tools after them, and the history and a
// forced choice renamed to match. The map gives each renamed name back.
function cloakTools(body: Json): { body: Json; names: Map<string, string> } {
  const names = new Map<string, string>();
  const tools = list(body.tools).map(record);
  if (tools.length === 0) return { body, names };
  const suffixed = (name: string) => `${name}${TOOL_SUFFIX}`;
  const renamed = tools.map((tool) => {
    const name = text(tool.name);
    if (tool.type || name === undefined) return tool;
    names.set(suffixed(name), name);
    return { ...tool, name: suffixed(name) };
  });
  const messages = list(body.messages).map(record).map((message) => (Array.isArray(message.content)
    ? { ...message, content: message.content.map(record).map((block) => (block.type === "tool_use" ? { ...block, name: suffixed(text(block.name) ?? "") } : block)) }
    : message));
  const out: Json = { ...body, tools: [...renamed, ...DECOYS], messages };
  const choice = record(body.tool_choice);
  const chosen = text(choice.name);
  if (choice.type === "tool" && chosen !== undefined && names.has(suffixed(chosen))) out.tool_choice = { ...choice, name: suffixed(chosen) };
  return { body: out, names };
}

// The Messages body the claude provider sends, and the tool names to give back in the answer.
export async function claudeCodeBody(body: Json, token: string, sessionId: string | undefined, ceiling: number | null): Promise<{ body: Json; names: Map<string, string> }> {
  const prepared = prepare(body, ceiling);
  if (!token.includes(OAUTH_TOKEN)) return { body: prepared, names: new Map() };
  return cloakTools(await cloak(prepared, token, sessionId));
}

// 9router's openai-to-claude: a request from a non-Claude client gets the Claude Code prompt in front, and its own system
// parts joined into one block after it (Claude clients keep their system prompt as sent).
export function withClaudeCodePrompt(request: CanonicalRequest): CanonicalRequest {
  const joined = (request.system ?? []).flatMap((part) => (part.type === "text" && part.text ? [part.text] : [])).join("\n");
  return { ...request, system: [{ type: "text", text: CLAUDE_CODE_PROMPT }, ...(joined ? [{ type: "text" as const, text: joined }] : [])] };
}
