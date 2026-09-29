import { BadRequestException, Body, Controller, Get, Header, HttpCode, HttpStatus, Post, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { ChatLane, type ModelProbe } from "./chat-lane.js";

// Dashboard model choices and POST /api/models/test (docs/contracts/custom-models.md). Protected by the global dashboard guard.
@Controller("api/models")
export class ModelTestController {
  constructor(private readonly lane: ChatLane) {}

  @Get()
  models(@Res() reply: FastifyReply): Promise<FastifyReply> {
    return this.lane.models(reply);
  }

  @Post("test")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  test(@Body() body: unknown): Promise<ModelProbe> {
    const model = typeof body === "object" && body !== null && "model" in body ? body.model : undefined;
    if (typeof model !== "string" || model === "") throw new BadRequestException({ code: "INVALID_REQUEST", message: "Model required" });
    return this.lane.probe(model);
  }
}
