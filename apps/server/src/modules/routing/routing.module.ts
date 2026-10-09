import { Module, type DynamicModule } from "@nestjs/common";
import { ApiKeysModule } from "../apikeys/apikeys.module.js";
import { CatalogModule } from "../catalog/catalog.module.js";
import { ConnectionsModule } from "../connections/connections.module.js";
import { SettingsModule } from "../settings/settings.module.js";
import { CapacityPoolsController } from "./infrastructure/capacity-pools.controller.js";
import { CapacityPoolsRepository } from "./infrastructure/capacity-pools.repo.js";
import { CHAT_LIMITS, ChatLane, type ChatLimits } from "./infrastructure/chat-lane.js";
import { CombosController } from "./infrastructure/combos.controller.js";
import { CombosRepository } from "./infrastructure/combos.repo.js";
import { ModelTestController } from "./infrastructure/model-test.controller.js";
import { PxpipeController } from "./infrastructure/pxpipe.controller.js";
import { PXPIPE_DATA_DIR, PxpipeService } from "./infrastructure/pxpipe.service.js";
import { SpeechLane } from "./infrastructure/speech-lane.js";
import { VoicesController } from "./infrastructure/voices.controller.js";
import { RoutingSimulator } from "./infrastructure/routing-simulator.js";
import { RoutingSimulatorController } from "./infrastructure/routing-simulator.controller.js";
import { RoutingStatusController } from "./infrastructure/routing-status.controller.js";

// The routing context (spec §4.4). SP12: the OpenAI chat lane, one provider, one account. SP16a: the dashboard's model test.
// SP19: model combos (docs/contracts/combos.md). SP20: capacity pools (docs/contracts/capacity-adapter.md). SP23: speech (docs/contracts/speech.md).
@Module({})
export class RoutingModule {
  static with(limits: ChatLimits, dataDir: string): DynamicModule {
    return {
      module: RoutingModule,
      imports: [SettingsModule, ApiKeysModule, ConnectionsModule, CatalogModule],
      controllers: [ModelTestController, CombosController, CapacityPoolsController, PxpipeController, VoicesController, RoutingSimulatorController, RoutingStatusController],
      providers: [ChatLane, SpeechLane, RoutingSimulator, CombosRepository, CapacityPoolsRepository, PxpipeService, { provide: PXPIPE_DATA_DIR, useValue: dataDir }, { provide: CHAT_LIMITS, useValue: limits }],
      exports: [ChatLane, SpeechLane],
    };
  }
}
