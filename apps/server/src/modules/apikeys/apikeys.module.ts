import { Module } from "@nestjs/common";
import { ApiKeysController } from "./infrastructure/api-keys.controller.js";
import { ApiKeysRepository } from "./infrastructure/api-keys.repo.js";

// Exports the repository so the /v1 gate (SP12) can call isValid() with extractApiKey().
@Module({ controllers: [ApiKeysController], providers: [ApiKeysRepository], exports: [ApiKeysRepository] })
export class ApiKeysModule {}
