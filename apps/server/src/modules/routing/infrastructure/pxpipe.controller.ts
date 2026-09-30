import { Controller, Get, Header, HttpCode, Post } from "@nestjs/common";
import { PxpipeService } from "./pxpipe.service.js";

@Controller("api/pxpipe")
export class PxpipeController {
  constructor(private readonly pxpipe: PxpipeService) {}

  @Get("status")
  @Header("Cache-Control", "no-store")
  status() {
    return this.pxpipe.status();
  }

  @Post("install")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  install() {
    return this.pxpipe.install();
  }
}
