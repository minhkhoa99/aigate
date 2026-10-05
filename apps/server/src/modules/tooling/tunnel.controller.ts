import { Controller, Get, Post } from "@nestjs/common";
import { TunnelService } from "./tunnel.service.js";

@Controller("api/tooling/tunnel")
export class TunnelController {
  constructor(private readonly tunnel: TunnelService) {}
  @Get() status() { return this.tunnel.status(); }
  @Post("enable") enable() { return this.tunnel.enable(); }
  @Post("disable") disable() { return this.tunnel.disable(); }
}
