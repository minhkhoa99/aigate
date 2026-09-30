import { BadRequestException, Body, Controller, Get, Header, NotFoundException, Param, Put } from "@nestjs/common";
import { isCapacityCapability, parsePool } from "../domain/capacity.js";
import { CapacityPoolsRepository } from "./capacity-pools.repo.js";

// docs/contracts/capacity-adapter.md. Every route needs a dashboard session.
@Controller("api/capacity-pools")
export class CapacityPoolsController {
  constructor(private readonly pools: CapacityPoolsRepository) {}

  @Get()
  @Header("Cache-Control", "no-store")
  async list() {
    return { pools: await this.pools.list() };
  }

  @Put(":capability")
  @Header("Cache-Control", "no-store")
  async save(@Param("capability") capability: string, @Body() body: unknown) {
    if (!isCapacityCapability(capability)) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "No capacity pool by that name; the pools are vision, pdf, audioInput, and videoInput" });
    }
    const parsed = parsePool(capability, body);
    if (!parsed.ok) throw new BadRequestException({ code: "INVALID_REQUEST", message: parsed.message });
    return { pool: await this.pools.save(capability, parsed.value) };
  }
}
