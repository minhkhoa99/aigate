import { Module } from "@nestjs/common";
import { ApiKeysModule } from "../apikeys/apikeys.module.js";
import { SettingsModule } from "../settings/settings.module.js";
import { SkillContext } from "./infrastructure/skill-context.js";
import { SkillFileController, SkillsController } from "./infrastructure/skills.controller.js";
import { SkillsRepository } from "./infrastructure/skills.repo.js";

// docs/contracts/skills.md. Exports SkillContext so the /v1 lane can add automatic skills.
@Module({ imports: [ApiKeysModule, SettingsModule], controllers: [SkillsController, SkillFileController], providers: [SkillsRepository, SkillContext], exports: [SkillContext] })
export class SkillsModule {}
