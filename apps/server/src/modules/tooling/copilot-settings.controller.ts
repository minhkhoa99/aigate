import { BadRequestException, Body, Controller, Get, Post } from "@nestjs/common";
import { CopilotSettingsService } from "./copilot-settings.service.js";

@Controller("api/tooling/cli-tools/copilot")
export class CopilotSettingsController {
  constructor(private readonly copilot: CopilotSettingsService) {}
  @Get() status() { return this.copilot.status(); }
  @Post("preview") preview(@Body() body: unknown) { return this.copilot.preview(body); }
  @Post("apply") apply(@Body() body: unknown) {
    if (typeof body !== "object" || body === null || !("previewId" in body) || typeof body.previewId !== "string") throw new BadRequestException({ code: "INVALID_REQUEST", message: "previewId is required" });
    return this.copilot.apply(body.previewId);
  }
}
