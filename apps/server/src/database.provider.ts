import { Inject, Injectable, type OnApplicationShutdown } from "@nestjs/common";
import type { DatabaseHandle } from "@aigate/database";

export const DATABASE = Symbol("DATABASE");

@Injectable()
export class DatabaseShutdown implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  onApplicationShutdown() {
    return this.database.close();
  }
}
