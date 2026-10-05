import { Global, Module, type DynamicModule } from "@nestjs/common";
import { ApiKeysModule } from "../apikeys/apikeys.module.js";
import { ConnectionsModule } from "../connections/connections.module.js";
import { DisplayNames } from "./infrastructure/display-names.js";
import { OverviewController } from "./infrastructure/overview.controller.js";
import { OverviewRepository } from "./infrastructure/overview.repo.js";
import { PricingController } from "./infrastructure/pricing.controller.js";
import { QuotaController } from "./infrastructure/quota.controller.js";
import { QuotaService } from "./infrastructure/quota.service.js";
import { RequestsController } from "./infrastructure/requests.controller.js";
import { RequestsRepository } from "./infrastructure/requests.repo.js";
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
      controllers: [UsageController, PricingController, RequestsController, QuotaController, OverviewController],
      providers: [PricingRepository, UsageRecorder, UsageRepository, RequestsRepository, QuotaService, DisplayNames, OverviewRepository, { provide: USAGE_CONFIG, useValue: config }],
      exports: [UsageRecorder],
    };
  }
}
