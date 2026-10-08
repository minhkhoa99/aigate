import { Controller, HttpCode, HttpException, HttpStatus, InternalServerErrorException, Post, Req, Res } from "@nestjs/common";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { EngineError, UnsupportedFeatureError } from "@aigate/engine";
import { parseSimulationInput, SIMULATION_BODY_BYTES, SIMULATION_DEADLINE_MS } from "../domain/routing-simulator.js";
import { deadline } from "./chat-lane.js";
import { RoutingSimulator } from "./routing-simulator.js";

const FIELD = /^(?:request|body|model|messages|tools|tool_choice|stream|stream_options|max_tokens|max_completion_tokens|temperature|top_p|stop|reasoning_effort|n)(?:\[\d+\]|\.(?:role|content|type|text|image_url|url|detail|input_audio|data|format|function|name|parameters|arguments|tool_calls|tool_call_id|include_usage|id|cache_control))*$/;
const INPUT_MESSAGES: Readonly<Record<string, string>> = {
  envelope: "Send only request and optional tokenSaverOptOut in the simulation JSON object.",
  nesting: "JSON nesting must be at most 32 levels.", size: "Simulation JSON must be at most 64 KiB.",
  tokenSaverOptOut: "tokenSaverOptOut must be true or false.", model: "model must be 1 to 256 printable ASCII characters.",
};

// Management guard remains at its existing global owner. No API-key/provider gate or traffic recording.
@Controller("api/routing")
export class RoutingSimulatorController {
  constructor(private readonly simulator: RoutingSimulator) {}

  @Post("simulate")
  @HttpCode(HttpStatus.OK)
  async simulate(@Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    reply.header("cache-control", "no-store");
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers["content-type"] ?? "")) {
      throw new HttpException({ code: "INVALID_REQUEST", message: "Send simulation input as application/json." }, 415);
    }
    const budget = deadline(SIMULATION_DEADLINE_MS, "Simulation deadline expired");
    const client = new AbortController();
    const closed = () => { if (!reply.raw.writableFinished) client.abort(new Error("Simulation client left")); };
    reply.raw.once("close", closed);
    const signal = AbortSignal.any([client.signal, budget.signal]);
    try {
      const input = parseSimulationInput(request.body);
      const result = await this.simulator.explain(input, signal);
      signal.throwIfAborted();
      reply.code(200).send(result);
    } catch (error) {
      if (client.signal.aborted) { reply.hijack(); reply.raw.destroy(); return; }
      if (budget.signal.aborted) throw new HttpException({ code: "TIMEOUT", message: "Routing inspection exceeded 5 seconds.", timeoutSeconds: 5 }, 504);
      if (error instanceof UnsupportedFeatureError) throw new HttpException({ code: "UNSUPPORTED_FEATURE", message: "This request contains a feature the OpenAI Chat parser cannot represent. Use a supported chat body." }, 400);
      if (error instanceof EngineError && error.code === "INVALID_REQUEST") {
        const param = typeof error.details.param === "string" ? error.details.param : "request";
        const field = param.length <= 160 && FIELD.test(param) ? param : "request";
        const message = Object.hasOwn(INPUT_MESSAGES, param) ? INPUT_MESSAGES[param] : `${field} is invalid. Check the OpenAI Chat JSON field format.`;
        throw new HttpException({ code: "INVALID_REQUEST", message }, param === "size" ? 413 : 400);
      }
      throw new InternalServerErrorException({ code: "INTERNAL_ERROR", message: "Could not inspect local routing state. Try again." }, { cause: error });
    } finally {
      budget.clear(); reply.raw.removeListener("close", closed);
    }
  }
}

// Nest RouteConfig nests its data under config; Fastify bodyLimit must be a top-level route option.
export function registerSimulationBoundary(fastify: FastifyInstance): void {
  fastify.addHook("onRoute", options => {
    if (options.url !== "/api/routing/simulate" || options.method !== "POST") return;
    options.bodyLimit = SIMULATION_BODY_BYTES;
    options.errorHandler = (error, _request, reply) => {
      reply.header("cache-control", "no-store");
      if (error.code === "FST_ERR_CTP_BODY_TOO_LARGE") return reply.code(413).send({ code: "INVALID_REQUEST", message: "Simulation JSON must be at most 64 KiB." });
      if (error.code === "FST_ERR_CTP_INVALID_JSON_BODY" || error.code === "FST_ERR_CTP_EMPTY_JSON_BODY") return reply.code(400).send({ code: "INVALID_REQUEST", message: "Send a valid simulation JSON object." });
      if (error.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") return reply.code(415).send({ code: "INVALID_REQUEST", message: "Send simulation input as application/json." });
      throw error;
    };
  });
}
