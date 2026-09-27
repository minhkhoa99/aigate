import type { FastifyInstance } from "fastify";
import type { ChatLane } from "./chat-lane.js";

// Room for base64 images and long histories; everything else on the server keeps Fastify's 1 MiB default.
export const CHAT_BODY_LIMIT = 16 * 1024 * 1024;

// Registered on Fastify directly, not as a Nest controller: the lane owns the raw response for
// streaming, and the dashboard session guard does not apply (the API-key gate does).
export function registerV1Routes(fastify: FastifyInstance, lane: ChatLane): void {
  const common = {
    onRequest: lane.authorize.bind(lane),
    errorHandler: (error: Parameters<ChatLane["bodyError"]>[0], _request: unknown, reply: Parameters<ChatLane["bodyError"]>[1]) => lane.bodyError(error, reply),
  };
  fastify.post("/v1/chat/completions", { ...common, bodyLimit: CHAT_BODY_LIMIT }, (request, reply) => lane.chat(request, reply));
  // docs/contracts/protocol-anthropic.md: Anthropic clients (Claude Code, the Anthropic SDK).
  fastify.post("/v1/messages", { ...common, bodyLimit: CHAT_BODY_LIMIT }, (request, reply) => lane.messages(request, reply));
  fastify.post("/v1/messages/count_tokens", { ...common, bodyLimit: CHAT_BODY_LIMIT }, (request, reply) => lane.countTokens(request, reply));
  // docs/contracts/protocol-responses.md: Responses clients; /responses and /codex/* are 9router's aliases (endpoint.rewrite-lanes).
  for (const path of ["/v1/responses", "/responses", "/codex", "/codex/*"]) {
    fastify.post(path, { ...common, bodyLimit: CHAT_BODY_LIMIT }, (request, reply) => lane.responses(request, reply));
  }
  fastify.post("/v1/responses/compact", { ...common, bodyLimit: CHAT_BODY_LIMIT }, (request, reply) => lane.responsesCompact(request, reply));
  fastify.get("/v1/models", common, (_request, reply) => lane.models(reply));
  // docs/contracts/protocol-gemini.md: Gemini clients. The listing has no key gate (9router); the key of a generate
  // request is checked in the handler, where the body shows whether the TTS passthrough applies.
  fastify.get("/v1beta/models", (_request, reply) => lane.geminiModels(reply));
  fastify.post<{ Params: { "*": string }; Querystring: Record<string, string | string[] | undefined> }>("/v1beta/models/*", {
    onRequest: lane.authorizeGemini.bind(lane), errorHandler: common.errorHandler, bodyLimit: CHAT_BODY_LIMIT,
  }, (request, reply) => lane.gemini(request, reply));
}
