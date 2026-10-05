import { BadRequestException, Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ManagedJsonSettingsService } from "./managed-json-settings.service.js";

@Controller("api/tooling/cli-tools/json")
export class ManagedJsonSettingsController {
  constructor(private readonly settings: ManagedJsonSettingsService) {}
  @Get(":tool") status(@Param("tool") tool: string) { return this.settings.status(tool); }
  @Post(":tool/preview") preview(@Param("tool") tool: string, @Body() body: unknown) { return this.settings.preview(tool, body); }
  @Post(":tool/apply") apply(@Param("tool") tool: string, @Body() body: unknown) {
    if (typeof body !== "object" || body === null || !("previewId" in body) || typeof body.previewId !== "string") throw new BadRequestException({ code: "INVALID_REQUEST", message: "previewId is required" });
    return this.settings.apply(body.previewId);
  }
}
