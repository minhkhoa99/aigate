import { Module, type DynamicModule } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module.js";
import { WindowsStartupController } from "./infrastructure/windows-startup.controller.js";
import { WindowsStartup, type StartupConfig } from "./infrastructure/windows-startup.js";

@Module({})
export class WindowsStartupModule {
  static with(config: StartupConfig): DynamicModule {
    return { module: WindowsStartupModule, imports: [IdentityModule], controllers: [WindowsStartupController],
      providers: [{ provide: WindowsStartup, useValue: new WindowsStartup(config) }] };
  }
}
