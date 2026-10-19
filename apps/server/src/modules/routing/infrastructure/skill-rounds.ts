import type { AIProviderPort, CanonicalRequest, ContentPart, StreamChunk, TokenUsage } from "@aigate/engine";
import { injectSkills } from "../../skills/domain/skill-graph.js";
import { addUsage, finalStop, followUp, isSkillCall, MAX_SKILL_ROUNDS, SKILL_TOOL, withoutSkillCalls, withSkillTool } from "../../skills/domain/skill-tool.js";
import type { SkillContext, SkillSession } from "../../skills/infrastructure/skill-context.js";

type Call = { id: string; name: string; arguments: string };

// docs/contracts/skills.md, "Model-loaded skills". Wraps one target's metered adapter, so every round is one recorded
// attempt. It adds the skills block; when the target can call tools it also adds the hidden SKILL_TOOL, answers the
// model's calls itself and asks again, at most MAX_SKILL_ROUNDS more times. The client sees one answer without the
// hidden calls, with the usage of every round. `applied` gets the skill ids each time they change.
export function withSkillRounds(
  adapter: AIProviderPort, context: SkillContext, session: SkillSession, toolable: boolean, applied: (ids: readonly string[]) => void,
): AIProviderPort {
  const hybrid = toolable ? session.hybrid : null;
  const chosen = hybrid ?? session.lexical;
  const names = hybrid?.names ?? [];
  const prepare = (request: CanonicalRequest): CanonicalRequest => {
    const skilled = chosen.block ? injectSkills(request, chosen.block) : request;
    return names.length ? withSkillTool(skilled, names) : skilled;
  };
  const report = () => applied([...new Set([...chosen.ids, ...session.loaded])]);
  // Fails open: a skill that cannot be read is answered in words, and the request goes on.
  const answer = (calls: readonly { id: string; arguments: string }[]) => context.answer(session, calls)
    .catch(() => calls.map((call) => ({ id: call.id, text: "The skill could not be loaded; answer without it." })));

  return {
    getModels: (credential, ctx) => adapter.getModels(credential, ctx),
    validateCredential: (credential, ctx) => adapter.validateCredential(credential, ctx),

    async execute(request, credential, ctx) {
      let current = prepare(request);
      report();
      let usage: TokenUsage | undefined;
      for (let round = 0; ; round += 1) {
        const response = await adapter.execute(current, credential, ctx);
        usage = usage ? addUsage(usage, response.usage) : response.usage;
        const calls = response.content.filter(isSkillCall);
        if (!names.length || !calls.length || round >= MAX_SKILL_ROUNDS) return { ...withoutSkillCalls(response), usage };
        current = followUp(current, response.content, await answer(calls));
        report();
      }
    },

    // Text, reasoning and images stream through at once. Tool calls, usage and the stop wait for the end of each round:
    // a round that called the hidden tool is followed by the next one in the same stream; the last round releases the
    // client's own calls, the summed usage and its stop.
    async *stream(request, credential, ctx): AsyncGenerator<StreamChunk> {
      let current = prepare(request);
      report();
      if (!names.length) { yield* adapter.stream(current, credential, ctx); return; }
      let usage: TokenUsage | undefined;
      let started = false;
      for (let round = 0; ; round += 1) {
        const calls: Call[] = [];
        let text = "";
        let thinking = "";
        let signature: string | undefined;
        let roundUsage: TokenUsage | undefined;
        let stop: Extract<StreamChunk, { type: "stop" }> | undefined;
        for await (const chunk of adapter.stream(current, credential, ctx)) {
          if (chunk.type === "start") { if (!started) { started = true; yield chunk; } }
          else if (chunk.type === "tool_call_delta") {
            const call = calls[chunk.index] ?? { id: "", name: "", arguments: "" };
            calls[chunk.index] = { id: chunk.id ?? call.id, name: chunk.name ?? call.name, arguments: call.arguments + chunk.argumentsDelta };
          } else if (chunk.type === "usage") roundUsage = chunk.usage;
          else if (chunk.type === "stop") stop = chunk;
          else {
            if (chunk.type === "text_delta") text += chunk.text;
            else if (chunk.type === "thinking_delta") { thinking += chunk.text; signature = chunk.signature ?? signature; }
            yield chunk;
          }
        }
        if (roundUsage) usage = usage ? addUsage(usage, roundUsage) : roundUsage;
        const made = calls.filter(Boolean).map((call, i) => call.id ? call : { ...call, id: `call_${SKILL_TOOL}_${round}_${i}` });
        const hidden = made.filter((call) => call.name === SKILL_TOOL);
        if (hidden.length && round < MAX_SKILL_ROUNDS) {
          const turn: ContentPart[] = [
            ...(thinking ? [{ type: "thinking" as const, text: thinking, ...(signature ? { signature } : {}) }] : []),
            ...(text ? [{ type: "text" as const, text }] : []),
            ...hidden.map((call) => ({ type: "tool_call" as const, ...call })),
          ];
          current = followUp(current, turn, await answer(hidden));
          report();
          continue;
        }
        const visible = made.filter((call) => call.name !== SKILL_TOOL);
        for (const [index, call] of visible.entries()) yield { type: "tool_call_delta", index, id: call.id, name: call.name, argumentsDelta: call.arguments };
        if (usage) yield { type: "usage", usage };
        if (stop) yield { ...stop, stopReason: finalStop(stop.stopReason, visible.length > 0) };
        return;
      }
    },
  };
}
