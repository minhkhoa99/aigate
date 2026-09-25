import { Module, type DynamicModule } from "@nestjs/common";
import { ApiKeysModule } from "../apikeys/apikeys.module.js";
import { ConnectionsModule } from "../connections/connections.module.js";
import { SettingsModule } from "../settings/settings.module.js";
import { CHAT_LIMITS, ChatLane, type ChatLimits } from "./infrastructure/chat-lane.js";

// The routing context (spec §4.4). SP12: the OpenAI chat lane, one provider, one account.
@Module({})
export class RoutingModule {
  static with(limits: ChatLimits): DynamicModule {
    return {
      module: RoutingModule,
      imports: [SettingsModule, ApiKeysModule, ConnectionsModule],
      providers: [ChatLane, { provide: CHAT_LIMITS, useValue: limits }],
      exports: [ChatLane],
    };
  }
}
