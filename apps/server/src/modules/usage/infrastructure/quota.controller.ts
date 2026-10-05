import { Controller, Get, Header, NotFoundException, Param, Post } from "@nestjs/common";
import { QuotaService } from "./quota.service.js";

@Controller("api/quotas")
export class QuotaController {
  constructor(private readonly quotas: QuotaService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  list() { return this.quotas.list(); }

  @Post("refresh")
  @Header("Cache-Control", "no-store")
  refreshAll() { return this.quotas.list(true); }

  @Post(":id/refresh")
  @Header("Cache-Control", "no-store")
  async refresh(@Param("id") id: string) {
    const quota = await this.quotas.refresh(id);
    if (!quota) throw new NotFoundException({ code: "NOT_FOUND", message: "No connection with that id" });
    return quota;
  }
}
