import { Global, Inject, Injectable, Module, type DynamicModule, type OnApplicationShutdown } from "@nestjs/common";
import type { DatabaseHandle } from "@aigate/database";

export const DATABASE = Symbol("DATABASE");

@Injectable()
export class DatabaseShutdown implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  onApplicationShutdown() {
    return this.database.close();
  }
}

// Global so every bounded context can inject DATABASE without re-importing it.
@Global()
@Module({})
export class DatabaseModule {
  static with(database: DatabaseHandle): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [{ provide: DATABASE, useValue: database }, DatabaseShutdown],
      exports: [DATABASE],
    };
  }
}
