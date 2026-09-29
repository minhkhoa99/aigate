import { Global, Module, type DynamicModule } from "@nestjs/common";
import type { HttpTransportPort } from "@aigate/engine";
import { DirectTransport } from "./infrastructure/direct-transport.js";
import { ProxyPoolsController } from "./infrastructure/proxy-pools.controller.js";
import { ProxyPoolsRepository } from "./infrastructure/proxy-pools.repo.js";
import { RelayDeployService } from "./infrastructure/relay-deploy.service.js";
import { HTTP_TRANSPORT } from "./transport.token.js";

// Inject HttpTransportPort with this token. SP8 binds the direct branch; SP18 adds relay and proxy.
export { HTTP_TRANSPORT } from "./transport.token.js";

// Global, so every context gets the one transport; tests pass a fake through createServer({ transport }).
@Global()
@Module({})
export class TransportModule {
  static with(transport?: HttpTransportPort): DynamicModule {
    return {
      module: TransportModule,
      controllers: [ProxyPoolsController],
      providers: [ProxyPoolsRepository, RelayDeployService, transport ? { provide: HTTP_TRANSPORT, useValue: transport } : { provide: HTTP_TRANSPORT, useClass: DirectTransport }],
      exports: [HTTP_TRANSPORT, ProxyPoolsRepository],
    };
  }
}
