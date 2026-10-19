// Model-loaded skills (docs/contracts/skills.md, "Model-loaded skills"). The hidden tool the model calls to read a
// skill, and the rounds it adds to a request. Pure: no I/O, no framework.
import type { CanonicalRequest, CanonicalResponse, ContentPart, ProviderProtocol, TokenUsage, ToolDefinition } from "@aigate/engine";

export const SKILL_TOOL = "aigate_load_skill";
// Extra provider calls one client request may cause.
export const MAX_SKILL_ROUNDS = 2;
// Adapter families that carry tool calls natively; the others get the lexical block instead.
export const TOOL_PROTOCOLS: ReadonlySet<ProviderProtocol> = new Set(["openai-compatible", "anthropic", "openai-responses", "ollama", "gemini", "vertex"]);

type ToolCall = Extract<ContentPart, { type: "tool_call" }>;

export function skillTool(names: readonly string[]): ToolDefinition {
  return {
    name: SKILL_TOOL,
    description: "Load the full instructions of one AIGate skill listed under \"Skills you can load\" in the system prompt. Call it before answering when a listed skill fits the task; do not call it otherwise.",
    parameters: {
      type: "object",
      properties: { name: { type: "string", enum: [...names], description: "The skill name, exactly as listed." } },
      required: ["name"],
      additionalProperties: false,
    },
  };
}

export const isSkillCall = (part: ContentPart): part is ToolCall => part.type === "tool_call" && part.name === SKILL_TOOL;

// The name a call asked for, or undefined for arguments that are not { name: string }.
export function requestedSkill(args: string): string | undefined {
  try {
    const value: unknown = JSON.parse(args || "{}");
    const name = typeof value === "object" && value !== null ? Reflect.get(value, "name") : undefined;
    return typeof name === "string" && name.trim() ? name.trim().slice(0, 64) : undefined;
  } catch {
    return undefined;
  }
}

// Whether a client request leaves room for the hidden tool: the model may choose freely and no client tool has its name.
export function toolAllowed(request: CanonicalRequest): boolean {
  const choice = request.toolChoice;
  return (choice === undefined || choice === "auto") && !(request.tools ?? []).some((tool) => tool.name === SKILL_TOOL);
}

export function withSkillTool(request: CanonicalRequest, names: readonly string[]): CanonicalRequest {
  return { ...request, tools: [...(request.tools ?? []), skillTool(names)] };
}

// The next round: the model's turn as it called the tool, keeping text, reasoning and the skill calls (the client's
// own calls of that turn are dropped, since nothing ran them), then one tool message with every answer.
export function followUp(request: CanonicalRequest, turn: readonly ContentPart[], answers: readonly { id: string; text: string }[]): CanonicalRequest {
  const assistant = turn.filter((part) => part.type === "text" || part.type === "thinking" || isSkillCall(part));
  const results: ContentPart[] = answers.map((answer) => ({ type: "tool_result", toolCallId: answer.id, content: [{ type: "text", text: answer.text }] }));
  return { ...request, messages: [...request.messages, { role: "assistant", content: assistant }, { role: "tool", content: results }] };
}

// The client's answer never shows the hidden tool; a turn that only called it ends normally.
export function withoutSkillCalls(response: CanonicalResponse): CanonicalResponse {
  if (!response.content.some(isSkillCall)) return response;
  const content: ContentPart[] = response.content.filter((part) => !isSkillCall(part));
  return { ...response, content, stopReason: finalStop(response.stopReason, content.some((part) => part.type === "tool_call")) };
}

export const finalStop = (stop: CanonicalResponse["stopReason"], clientCalls: boolean): CanonicalResponse["stopReason"] =>
  stop === "tool_use" && !clientCalls ? "end_turn" : stop;

const sum = (a: number | undefined, b: number | undefined): number | undefined => a === undefined && b === undefined ? undefined : (a ?? 0) + (b ?? 0);

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  const optional = { cacheReadTokens: sum(a.cacheReadTokens, b.cacheReadTokens), cacheWriteTokens: sum(a.cacheWriteTokens, b.cacheWriteTokens), reasoningTokens: sum(a.reasoningTokens, b.reasoningTokens) };
  return {
    inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens,
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined)),
  };
}
