import { Module } from "@nestjs/common";
import { ConnectionsController } from "./infrastructure/connections.controller.js";
import { ConnectionsRepository } from "./infrastructure/connections.repo.js";
import { OAuthController } from "./infrastructure/oauth.controller.js";
import { ProviderNodesController } from "./infrastructure/provider-nodes.controller.js";
import { ProviderNodesRepository } from "./infrastructure/provider-nodes.repo.js";
import { TokenRefresher } from "./infrastructure/token-refresher.js";

// Exports the repositories so routing (SP12, SP13b) can read the active key and resolve a custom provider prefix, and
// the token refresher (SP16) so routing refreshes an oauth token before and after a request.
@Module({
  controllers: [ConnectionsController, ProviderNodesController, OAuthController],
  providers: [ConnectionsRepository, ProviderNodesRepository, TokenRefresher],
  exports: [ConnectionsRepository, ProviderNodesRepository, TokenRefresher],
})
export class ConnectionsModule {}
