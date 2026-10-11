import { Module, type DynamicModule } from "@nestjs/common";
import { resolve } from "node:path";
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
import { InstallationBackupModule } from "./modules/settings/installation-backup.module.js";
import { WindowsStartupModule } from "./modules/settings/windows-startup.module.js";
import type { StartupConfig } from "./modules/settings/infrastructure/windows-startup.js";
import { RUNTIME_CONFIG, RuntimeController } from "./modules/settings/infrastructure/runtime.controller.js";
import { TransportModule } from "./modules/transport/transport.module.js";
import type { UsageConfig } from "./modules/usage/infrastructure/usage-recorder.js";
import { UsageModule } from "./modules/usage/usage.module.js";
import { toolingModule } from "./modules/tooling/tooling.module.js";
import { SecretsModule, type SecretCipherPort } from "./secret-cipher.js";

@Module({})
export class AppModule {
  static with(database: DatabaseHandle, cipher: SecretCipherPort, backup: { databaseFile: string; dataDir: string; key: Buffer; envKey: boolean }, startup: StartupConfig, limits: ChatLimits, dataDir: string, usage: UsageConfig, transport?: HttpTransportPort): DynamicModule {
    return {
      module: AppModule,
      imports: [
        DatabaseModule.with(database), SecretsModule.with(cipher), TransportModule.with(transport),
        SettingsModule, IdentityModule, InstallationBackupModule.with(backup), WindowsStartupModule.with(startup), ApiKeysModule, CatalogModule, ConnectionsModule, UsageModule.with(usage), toolingModule(dataDir), RoutingModule.with(limits, dataDir),
      ],
      controllers: [HealthController, RuntimeController],
      providers: [{ provide: RUNTIME_CONFIG, useValue: { dataDir: resolve(dataDir), streamIdleTimeoutMs: limits.streamIdleTimeoutMs } }],
    };
  }
}
