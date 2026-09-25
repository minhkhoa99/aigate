import { Module } from "@nestjs/common";
import { CatalogController } from "./infrastructure/catalog.controller.js";

// The catalog context (spec §4.4): the provider catalog served to the dashboard (SP13).
@Module({ controllers: [CatalogController] })
export class CatalogModule {}
