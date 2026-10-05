import { BadRequestException, Body, Controller, Get, Post } from "@nestjs/common";
import { OpenCodeSettingsService } from "./opencode-settings.service.js";

@Controller("api/tooling/cli-tools/opencode")
export class OpenCodeSettingsController {
  constructor(private readonly opencode: OpenCodeSettingsService) {}
  @Get() status() { return this.opencode.status(); }
  @Post("preview") preview(@Body() body: unknown) { return this.opencode.preview(body); }
  @Post("apply") apply(@Body() body: unknown) {
    if (typeof body !== "object" || body === null || !("previewId" in body) || typeof body.previewId !== "string") throw new BadRequestException({ code: "INVALID_REQUEST", message: "previewId is required" });
    return this.opencode.apply(body.previewId);
  }
}
