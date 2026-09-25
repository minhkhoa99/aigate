import type { CanonicalRequest, ContentPart } from "./cip.js";
import { EngineError } from "./errors.js";
import type { ModelCapabilities, ModelDescriptor } from "./registry.js";

export type Capability = keyof ModelCapabilities;

// The floor for a model nobody declared (9router capabilities.js:42): tools on, every modality off.
export const DEFAULT_CAPABILITIES: ModelCapabilities = {
  vision: false, pdf: false, audioInput: false, videoInput: false, tools: true, reasoning: false,
};

// Name-only vision signal for undeclared models (9router visionPatterns.js:12-41). NOT_VISION is
// tested first, so image-generation, embedding, and audio ids never pass as vision input
// (catalog.capability-vision-pattern-order).
const SEP = "[-_/:.]";
const NOT_VISION = new RegExp([
  `(^|${SEP})(image|img)(${SEP}|$)`, "stable-image", "gen[0-9]_image", "nanobanana", "imagine",
  "t2v", "i2v", "flux", "dall", "sdxl", "diffusion", "embed", "rerank", "guard", "moderation",
  "tts", "stt", "whisper", "voice", "speech", "audio",
].join("|"), "i");
const VISION_NAME = new RegExp([
  `(^|${SEP})(vision|vl|vlm|multimodal|omni|visual)(${SEP}|$)`,
  `[0-9]\\.[0-9]+v(${SEP}|$)`,
  `(^|${SEP})glm-[0-9]+v(${SEP}|$)`,
  "(^|[-_/:.])(llava|pixtral|internvl|cogvlm|minicpm-v|moondream|idefics|fuyu)",
].join("|"), "i");

export function looksLikeVisionModel(modelId: string): boolean {
  return !NOT_VISION.test(modelId) && VISION_NAME.test(modelId);
}

// A declared model is final. An undeclared one gets the floor, and the heuristic may only turn
// vision on, never off (catalog.capability-refine-additive-only).
// ponytail: tiers 2-3 of 9router (exact-id and pattern tables) arrive with the full registry (SP13).
export function resolveCapabilities(model: ModelDescriptor | undefined, modelId: string): ModelCapabilities {
  if (model) return model.capabilities;
  return looksLikeVisionModel(modelId) ? { ...DEFAULT_CAPABILITIES, vision: true } : DEFAULT_CAPABILITIES;
}

function partNeeds(part: ContentPart, needs: Set<Capability>, pending: ContentPart[]): void {
  switch (part.type) {
    case "image": needs.add("vision"); break;
    case "audio": needs.add("audioInput"); break;
    case "video": needs.add("videoInput"); break;
    case "file":
      // Attachments are classified by media type; any other document needs document input.
      if (part.mediaType.startsWith("image/")) needs.add("vision");
      else if (part.mediaType.startsWith("audio/")) needs.add("audioInput");
      else if (part.mediaType.startsWith("video/")) needs.add("videoInput");
      else needs.add("pdf");
      break;
    case "tool_call": needs.add("tools"); break;
    case "tool_result": needs.add("tools"); pending.push(...part.content); break;
    default: break;
  }
}

// What a model must support to take this request whole. Every message is scanned, including the
// system prompt and earlier turns, because all of it is sent upstream. 9router scanned only the
// trailing user turn, so an image from an earlier turn reached non-vision models (labeled
// SUSPECTED_BUG in docs/contracts/engine.md).
export function detectRequiredCapabilities(request: CanonicalRequest): Set<Capability> {
  const needs = new Set<Capability>();
  if (request.tools && request.tools.length > 0) needs.add("tools");
  if (request.reasoning) needs.add("reasoning");
  const pending: ContentPart[] = [...(request.system ?? []), ...request.messages.flatMap((message) => message.content)];
  // Iterative, so deeply nested tool results cannot overflow the stack; the body limit bounds the work.
  for (let part = pending.pop(); part !== undefined; part = pending.pop()) partNeeds(part, needs, pending);
  return needs;
}

// Throws a recoverable MODEL_UNAVAILABLE when the model cannot take the request, so routing can
// move to a candidate that can; a request no model could take is INVALID_REQUEST.
export function assertModelSupports(request: CanonicalRequest, providerId: string, model: ModelDescriptor | undefined, modelId: string): void {
  const target = `${providerId}/${modelId}`;
  if (model && model.kind !== "chat") {
    throw new EngineError("MODEL_UNAVAILABLE", `${target} is a ${model.kind} model and cannot serve chat requests`, { target, kind: model.kind });
  }
  const available = resolveCapabilities(model, modelId);
  const missing = [...detectRequiredCapabilities(request)].filter((capability) => !available[capability]).sort();
  if (missing.length > 0) throw new EngineError("MODEL_UNAVAILABLE", `${target} does not support: ${missing.join(", ")}`, { target, missing });
  // Checked only when the catalog declares the limit; an undeclared one is the vendor's to enforce.
  if (model && model.maxOutputTokens !== null && request.maxOutputTokens !== undefined && request.maxOutputTokens > model.maxOutputTokens) {
    throw new EngineError("INVALID_REQUEST", `maxOutputTokens ${request.maxOutputTokens} exceeds the ${model.maxOutputTokens} limit of ${target}`, {
      target, limit: model.maxOutputTokens,
    });
  }
}
