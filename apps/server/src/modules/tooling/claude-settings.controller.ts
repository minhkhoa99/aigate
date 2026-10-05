import { BadRequestException, Body, Controller, Get, Post } from "@nestjs/common";
import { ClaudeSettingsService } from "./claude-settings.service.js";

@Controller("api/tooling/cli-tools/claude")
export class ClaudeSettingsController {
  constructor(private readonly claude: ClaudeSettingsService) {}
  @Get() status() { return this.claude.status(); }
  @Post("preview") preview(@Body() body: unknown) { return this.claude.preview(body); }
  @Post("apply") apply(@Body() body: unknown) {
    if (typeof body !== "object" || body === null || !("previewId" in body) || typeof body.previewId !== "string") throw new BadRequestException({ code: "INVALID_REQUEST", message: "previewId is required" });
    return this.claude.apply(body.previewId);
  }
}
