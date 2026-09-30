import { Global, Module, type DynamicModule } from "@nestjs/common";
import { ApiKeysModule } from "../apikeys/apikeys.module.js";
import { ConnectionsModule } from "../connections/connections.module.js";
import { PricingController } from "./infrastructure/pricing.controller.js";
import { PricingRepository } from "./infrastructure/pricing.repo.js";
import { USAGE_CONFIG, UsageRecorder, type UsageConfig } from "./infrastructure/usage-recorder.js";
import { UsageController } from "./infrastructure/usage.controller.js";
import { UsageRepository } from "./infrastructure/usage.repo.js";

// The usage context (spec §4.4, SP24a; docs/contracts/usage.md). Global so the chat lane can record without a cycle.
@Global()
@Module({})
export class UsageModule {
  static with(config: UsageConfig): DynamicModule {
    return {
      module: UsageModule,
      imports: [ConnectionsModule, ApiKeysModule],
      controllers: [UsageController, PricingController],
      providers: [PricingRepository, UsageRecorder, UsageRepository, { provide: USAGE_CONFIG, useValue: config }],
      exports: [UsageRecorder],
    };
  }
}
