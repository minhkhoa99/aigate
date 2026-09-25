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
  fastify.get("/v1/models", common, (_request, reply) => lane.models(reply));
}
