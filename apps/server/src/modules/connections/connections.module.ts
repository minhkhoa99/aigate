import { Module } from "@nestjs/common";
import { ConnectionsController } from "./infrastructure/connections.controller.js";
import { ConnectionsRepository } from "./infrastructure/connections.repo.js";
import { ProviderNodesController } from "./infrastructure/provider-nodes.controller.js";
import { ProviderNodesRepository } from "./infrastructure/provider-nodes.repo.js";

// Exports the repositories so routing (SP12, SP13b) can read the active key and resolve a custom provider prefix.
@Module({
  controllers: [ConnectionsController, ProviderNodesController],
  providers: [ConnectionsRepository, ProviderNodesRepository],
  exports: [ConnectionsRepository, ProviderNodesRepository],
})
export class ConnectionsModule {}
