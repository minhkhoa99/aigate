import { Module, type DynamicModule } from "@nestjs/common";
import { ApiKeysModule } from "../apikeys/apikeys.module.js";
import { CatalogModule } from "../catalog/catalog.module.js";
import { ConnectionsModule } from "../connections/connections.module.js";
import { SettingsModule } from "../settings/settings.module.js";
import { CHAT_LIMITS, ChatLane, type ChatLimits } from "./infrastructure/chat-lane.js";
import { ModelTestController } from "./infrastructure/model-test.controller.js";

// The routing context (spec §4.4). SP12: the OpenAI chat lane, one provider, one account. SP16a: the dashboard's model test.
@Module({})
export class RoutingModule {
  static with(limits: ChatLimits): DynamicModule {
    return {
      module: RoutingModule,
      imports: [SettingsModule, ApiKeysModule, ConnectionsModule, CatalogModule],
      controllers: [ModelTestController],
      providers: [ChatLane, { provide: CHAT_LIMITS, useValue: limits }],
      exports: [ChatLane],
    };
  }
}
