import { Module } from "@nestjs/common";
import { ConnectionsController } from "./infrastructure/connections.controller.js";
import { ConnectionsRepository } from "./infrastructure/connections.repo.js";

// Exports the repository so routing (SP12) can read the active key for a provider.
@Module({ controllers: [ConnectionsController], providers: [ConnectionsRepository], exports: [ConnectionsRepository] })
export class ConnectionsModule {}
