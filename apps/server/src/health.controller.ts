import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { DatabaseHandle } from "@aigate/database";
import { DATABASE } from "./database.provider.js";
import { Public } from "./modules/identity/infrastructure/public.decorator.js";

@Public()
@Controller("health")
export class HealthController {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  @Get()
  async health() {
    try {
      await this.database.db.run(sql`select 1`);
    } catch (error) {
      throw new ServiceUnavailableException({ status: "unavailable" }, { cause: error });
    }
    return { status: "ok" };
  }
}
