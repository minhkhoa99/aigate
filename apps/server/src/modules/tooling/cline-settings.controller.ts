import { BadRequestException, Body, Controller, Get, Post } from "@nestjs/common";
import { ClineSettingsService } from "./cline-settings.service.js";
@Controller("api/tooling/cli-tools/cline")
export class ClineSettingsController { constructor(private readonly cline: ClineSettingsService) {} @Get() status() { return this.cline.status(); } @Post("preview") preview(@Body() body: unknown) { return this.cline.preview(body); } @Post("apply") apply(@Body() body: unknown) { if (typeof body !== "object" || body === null || !("previewId" in body) || typeof body.previewId !== "string") throw new BadRequestException({ code: "INVALID_REQUEST", message: "previewId is required" }); return this.cline.apply(body.previewId); } }
