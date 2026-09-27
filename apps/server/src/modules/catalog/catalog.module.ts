import { Module } from "@nestjs/common";
import { CatalogController } from "./infrastructure/catalog.controller.js";
import { CustomModelsController } from "./infrastructure/custom-models.controller.js";
import { CustomModelsRepository } from "./infrastructure/custom-models.repo.js";

// The catalog context (spec §4.4): the provider catalog served to the dashboard (SP13), and the operator's custom models
// (SP16a), exported so routing lists them on /v1/models.
@Module({ controllers: [CatalogController, CustomModelsController], providers: [CustomModelsRepository], exports: [CustomModelsRepository] })
export class CatalogModule {}
