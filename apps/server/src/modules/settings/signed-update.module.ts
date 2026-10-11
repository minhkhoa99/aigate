import { Module, type DynamicModule } from "@nestjs/common";
import type { HttpTransportPort } from "@aigate/engine";
import { HTTP_TRANSPORT } from "../transport/transport.token.js";
import { SignedUpdateController } from "./infrastructure/signed-update.controller.js";
import { SignedUpdate, type UpdateConfig } from "./infrastructure/signed-update.js";

@Module({})
export class SignedUpdateModule {
  static with(config: UpdateConfig): DynamicModule {
    return { module: SignedUpdateModule, controllers: [SignedUpdateController], providers: [
      { provide: SignedUpdate, useFactory: (transport: HttpTransportPort) => new SignedUpdate(config, transport), inject: [HTTP_TRANSPORT] },
    ] };
  }
}
