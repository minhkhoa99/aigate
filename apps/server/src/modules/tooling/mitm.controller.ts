import { Body, Controller, Get, Post } from "@nestjs/common";
import { MitmService } from "./mitm.service.js";
@Controller("api/tooling/mitm") export class MitmController { constructor(private readonly mitm: MitmService) {} @Get() status() { return this.mitm.status(); } @Post("preview") preview(@Body() body: unknown) { return this.mitm.preview(body); } @Post("apply") apply(@Body() body: { previewId?: string }) { return this.mitm.apply(body.previewId ?? ""); } }
