import { Global, Module, type DynamicModule } from "@nestjs/common";
import type { HttpTransportPort } from "@aigate/engine";
import { DirectTransport } from "./infrastructure/direct-transport.js";

// Inject HttpTransportPort with this token. SP8 binds the direct branch; SP18 adds relay and proxy.
export const HTTP_TRANSPORT = Symbol("HTTP_TRANSPORT");

// Global, so every context gets the one transport; tests pass a fake through createServer({ transport }).
@Global()
@Module({})
export class TransportModule {
  static with(transport?: HttpTransportPort): DynamicModule {
    return {
      module: TransportModule,
      providers: [transport ? { provide: HTTP_TRANSPORT, useValue: transport } : { provide: HTTP_TRANSPORT, useClass: DirectTransport }],
      exports: [HTTP_TRANSPORT],
    };
  }
}
