import { BadRequestException, Body, Controller, Header, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ChatLane, type ModelProbe } from "./chat-lane.js";

// POST /api/models/test (docs/contracts/custom-models.md). Protected by the global dashboard guard.
@Controller("api/models/test")
export class ModelTestController {
  constructor(private readonly lane: ChatLane) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  test(@Body() body: unknown): Promise<ModelProbe> {
    const model = typeof body === "object" && body !== null && "model" in body ? body.model : undefined;
    if (typeof model !== "string" || model === "") throw new BadRequestException({ code: "INVALID_REQUEST", message: "Model required" });
    return this.lane.probe(model);
  }
}
