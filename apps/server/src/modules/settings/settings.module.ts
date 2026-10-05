import { Module } from "@nestjs/common";
import { SettingsController } from "./infrastructure/settings.controller.js";
import { SettingsRepository } from "./infrastructure/settings.repo.js";
import { SettingsTransferController } from "./infrastructure/settings-transfer.controller.js";

@Module({ controllers: [SettingsController, SettingsTransferController], providers: [SettingsRepository], exports: [SettingsRepository] })
export class SettingsModule {}
