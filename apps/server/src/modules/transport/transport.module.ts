import { Module } from "@nestjs/common";
import { DirectTransport } from "./infrastructure/direct-transport.js";

// Inject HttpTransportPort with this token. SP8 binds the direct branch; SP18 adds relay and proxy.
export const HTTP_TRANSPORT = Symbol("HTTP_TRANSPORT");

@Module({ providers: [{ provide: HTTP_TRANSPORT, useClass: DirectTransport }], exports: [HTTP_TRANSPORT] })
export class TransportModule {}
