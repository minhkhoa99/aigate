import { Module, type DynamicModule } from "@nestjs/common";
import type { DatabaseHandle } from "@aigate/database";
import { DATABASE, DatabaseShutdown } from "./database.provider.js";
import { HealthController } from "./health.controller.js";

@Module({})
export class AppModule {
  static with(database: DatabaseHandle): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController],
      providers: [{ provide: DATABASE, useValue: database }, DatabaseShutdown],
    };
  }
}
