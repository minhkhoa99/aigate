import { BadRequestException, Body, Controller, Get, Post } from "@nestjs/common";
import { DroidSettingsService } from "./droid-settings.service.js";
@Controller("api/tooling/cli-tools/droid")
export class DroidSettingsController { constructor(private readonly droid: DroidSettingsService) {} @Get() status() { return this.droid.status(); } @Post("preview") preview(@Body() body: unknown) { return this.droid.preview(body); } @Post("apply") apply(@Body() body: unknown) { if (typeof body !== "object" || body === null || !("previewId" in body) || typeof body.previewId !== "string") throw new BadRequestException({ code: "INVALID_REQUEST", message: "previewId is required" }); return this.droid.apply(body.previewId); } }
