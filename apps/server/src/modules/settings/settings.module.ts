import { Module } from "@nestjs/common";
import { SettingsController } from "./infrastructure/settings.controller.js";
import { SettingsRepository } from "./infrastructure/settings.repo.js";

@Module({ controllers: [SettingsController], providers: [SettingsRepository], exports: [SettingsRepository] })
export class SettingsModule {}
