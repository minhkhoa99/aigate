import { BadRequestException, Body, Controller, Get, Post } from "@nestjs/common";
import { CodexSettingsService } from "./codex-settings.service.js";

@Controller("api/tooling/cli-tools/codex")
export class CodexSettingsController {
  constructor(private readonly codex: CodexSettingsService) {}

  @Get()
  status() { return this.codex.status(); }

  @Post("preview")
  preview(@Body() body: unknown) { return this.codex.preview(body); }

  @Post("apply")
  apply(@Body() body: unknown) {
    if (typeof body !== "object" || body === null || !("previewId" in body) || typeof body.previewId !== "string") {
      throw new BadRequestException({ code: "INVALID_REQUEST", message: "previewId is required" });
    }
    return this.codex.apply(body.previewId);
  }
}
