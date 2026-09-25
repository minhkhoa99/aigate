import { Module, type DynamicModule } from "@nestjs/common";
import type { DatabaseHandle } from "@aigate/database";
import type { HttpTransportPort } from "@aigate/engine";
import { DatabaseModule } from "./database.provider.js";
import { HealthController } from "./health.controller.js";
import { ApiKeysModule } from "./modules/apikeys/apikeys.module.js";
import { CatalogModule } from "./modules/catalog/catalog.module.js";
import { ConnectionsModule } from "./modules/connections/connections.module.js";
import type { ChatLimits } from "./modules/routing/infrastructure/chat-lane.js";
import { RoutingModule } from "./modules/routing/routing.module.js";
import { IdentityModule } from "./modules/identity/identity.module.js";
import { SettingsModule } from "./modules/settings/settings.module.js";
import { TransportModule } from "./modules/transport/transport.module.js";
import { SecretsModule, type SecretCipherPort } from "./secret-cipher.js";

@Module({})
export class AppModule {
  static with(database: DatabaseHandle, cipher: SecretCipherPort, limits: ChatLimits, transport?: HttpTransportPort): DynamicModule {
    return {
      module: AppModule,
      imports: [
        DatabaseModule.with(database), SecretsModule.with(cipher), TransportModule.with(transport),
        SettingsModule, IdentityModule, ApiKeysModule, CatalogModule, ConnectionsModule, RoutingModule.with(limits),
      ],
      controllers: [HealthController],
    };
  }
}
