import { Module, type DynamicModule } from "@nestjs/common";
import type { DatabaseHandle } from "@aigate/database";
import { DatabaseModule } from "./database.provider.js";
import { HealthController } from "./health.controller.js";
import { ApiKeysModule } from "./modules/apikeys/apikeys.module.js";
import { IdentityModule } from "./modules/identity/identity.module.js";
import { SettingsModule } from "./modules/settings/settings.module.js";
import { TransportModule } from "./modules/transport/transport.module.js";

@Module({})
export class AppModule {
  static with(database: DatabaseHandle): DynamicModule {
    return {
      module: AppModule,
      imports: [DatabaseModule.with(database), SettingsModule, IdentityModule, ApiKeysModule, TransportModule],
      controllers: [HealthController],
    };
  }
}
