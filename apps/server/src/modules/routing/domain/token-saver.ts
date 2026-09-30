import type { CanonicalRequest, ContentPart } from "@aigate/engine";
import type { Settings } from "../../settings/domain/settings.js";
import { compressToolOutput } from "./rtk.js";

const SEP = "\n\n--- AIGate Token Saver ---\n";
const CAVEMAN: Record<Settings["cavemanLevel"], string> = {
  lite: "Answer directly. Remove filler and hedging. Keep complete sentences and exact technical details.",
  full: "Answer tersely. Drop filler and pleasantries. Keep code, paths, commands, errors, URLs, security warnings, and ordered steps exact. Preserve the user's language.",
  ultra: "Answer with maximum brevity. Keep all technical details, code, paths, commands, errors, URLs, security warnings, and steps exact. Preserve the user's language.",
};
const PONYTAIL: Record<Settings["ponytailLevel"], string> = {
  lite: "When coding, build what was requested and mention a simpler alternative briefly.",
  full: "When coding, use the smallest correct change. Prefer existing helpers, standard library, and native features. Avoid speculative abstractions. Preserve validation, security, accessibility, and error handling.",
  ultra: "When coding, first ask whether the change is needed. Prefer deletion and the shortest correct implementation. Never simplify away security, validation, accessibility, or explicit requirements.",
};

function compressPart(part: ContentPart): ContentPart {
  if (part.type !== "tool_result" || part.isError) return part;
  const content = part.content.map((child) => child.type === "text" ? { ...child, text: compressToolOutput(child.text) } : child);
  return content.some((child, i) => child !== part.content[i]) ? { ...part, content } : part;
}

function compressRtk(request: CanonicalRequest): CanonicalRequest {
  let changed = false;
  const messages = request.messages.map((message) => {
    const content = message.content.map(compressPart);
    const messageChanged = content.some((part, i) => part !== message.content[i]);
    changed ||= messageChanged;
    return messageChanged ? { ...message, content } : message;
  });
  return changed ? { ...request, messages } : request;
}

function inject(request: CanonicalRequest, prompt: string): CanonicalRequest {
  const system = request.system ?? [];
  const text = system.filter((part) => part.type === "text").map((part) => part.text).join("\n");
  const segment = `${SEP}${prompt}`;
  if (text.split(SEP).includes(prompt)) return request;
  return { ...request, system: [...system, { type: "text", text: segment }] };
}

export interface HeadroomInput {
  readonly model: string;
  readonly messages: readonly { readonly role: string; readonly content: string }[];
  readonly config: { readonly compress_user_messages: boolean };
}

export function headroomInput(request: CanonicalRequest, compressUserMessages = false): HeadroomInput | undefined {
  if (request.tools?.length || request.system?.some((part) => part.type !== "text") || request.messages.some((message) => message.content.some((part) => part.type !== "text"))) return undefined;
  return {
    model: request.model, messages: request.messages.map((message) => ({ role: message.role, content: message.content.map((part) => part.type === "text" ? part.text : "").join("") })),
    config: { compress_user_messages: compressUserMessages },
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function applyHeadroomResult(request: CanonicalRequest, result: unknown, compressUserMessages = false): CanonicalRequest {
  if (!record(result) || !Array.isArray(result.messages) || result.messages.length !== request.messages.length) return request;
  const messages: string[] = [];
  for (const [i, item] of result.messages.entries()) {
    if (!record(item) || item.role !== request.messages[i].role || typeof item.content !== "string") return request;
    if (!compressUserMessages && item.role === "user" && item.content !== request.messages[i].content.map((part) => part.type === "text" ? part.text : "").join("")) return request;
    messages.push(item.content);
  }
  const before = request.messages.reduce((sum, message) => sum + message.content.reduce((n, part) => n + (part.type === "text" ? part.text.length : 0), 0), 0);
  if (messages.reduce((sum, message) => sum + message.length, 0) >= before) return request;
  return { ...request, messages: request.messages.map((message, i) => ({ ...message,
    content: [{ type: "text", text: !compressUserMessages && message.role === "user" ? message.content.map((part) => part.type === "text" ? part.text : "").join("") : messages[i] }],
  })) };
}

export async function applyTokenSaver(
  request: CanonicalRequest, settings: Settings, optOut: boolean,
  headroomCall: (request: CanonicalRequest, settings: Settings, signal: AbortSignal) => Promise<unknown>, signal: AbortSignal,
): Promise<CanonicalRequest> {
  if (!settings.tokenSaverEnabled || optOut) return request;
  let current = settings.rtkEnabled ? compressRtk(request) : request;
  if (settings.headroomEnabled && headroomInput(current)) {
    try { current = applyHeadroomResult(current, await headroomCall(current, settings, signal), settings.headroomCompressUserMessages); }
    catch { signal.throwIfAborted(); }
  }
  if (settings.cavemanEnabled) current = inject(current, CAVEMAN[settings.cavemanLevel]);
  if (settings.ponytailEnabled) current = inject(current, PONYTAIL[settings.ponytailLevel]);
  // PXPIPE runs last at the outbound Anthropic transport boundary; missing or failed installs stay fail-open.
  return current;
}
