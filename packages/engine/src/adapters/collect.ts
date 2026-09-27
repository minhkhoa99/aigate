import type { CanonicalResponse, ContentPart, StopReason, StreamChunk, TokenUsage } from "../cip.js";

// A stream folded into one answer, for a provider that only streams (routing.forced-stream-json-collapse).
export async function collected(chunks: AsyncIterable<StreamChunk>, fallbackModel: string): Promise<CanonicalResponse> {
  let id = "";
  let model = fallbackModel;
  let answer = "";
  let thinking = "";
  let signature: string | undefined;
  let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  let stopReason: StopReason = "end_turn";
  const calls: { id: string; name: string; arguments: string }[] = [];
  for await (const chunk of chunks) {
    if (chunk.type === "start") {
      id = chunk.id;
      model = chunk.model || model;
    } else if (chunk.type === "text_delta") answer += chunk.text;
    else if (chunk.type === "thinking_delta") {
      thinking += chunk.text;
      signature = chunk.signature ?? signature;
    } else if (chunk.type === "tool_call_delta") {
      const call = calls[chunk.index] ?? { id: "", name: "", arguments: "" };
      calls[chunk.index] = { id: chunk.id ?? call.id, name: chunk.name ?? call.name, arguments: call.arguments + chunk.argumentsDelta };
    } else if (chunk.type === "usage") usage = chunk.usage;
    else if (chunk.type === "stop") stopReason = chunk.stopReason;
  }
  const content: ContentPart[] = [
    ...(thinking ? [{ type: "thinking" as const, text: thinking, ...(signature ? { signature } : {}) }] : []),
    ...(answer ? [{ type: "text" as const, text: answer }] : []),
    ...calls.filter(Boolean).map((call) => ({ type: "tool_call" as const, ...call })),
  ];
  return { id, model, content, stopReason, usage };
}
