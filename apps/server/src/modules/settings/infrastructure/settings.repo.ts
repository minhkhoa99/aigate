import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { settings, type DatabaseHandle } from "@aigate/database";
import { DATABASE } from "../../../database.provider.js";
import type { Settings, SettingsPatch } from "../domain/settings.js";

const ROW_ID = 1;
const columns = { requireLogin: settings.requireLogin, requireApiKey: settings.requireApiKey };

// Read on the request hot path, so the row is cached and replaced on every write.
// ponytail: assumes this process is the only writer; other tools must change settings through the API.
@Injectable()
export class SettingsRepository {
  private current: Promise<Settings> | undefined;

  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  get(): Promise<Settings> {
    this.current ??= this.load().catch((error: unknown) => {
      this.current = undefined;
      throw error;
    });
    return this.current;
  }

  async update(patch: SettingsPatch): Promise<Settings> {
    await this.get();
    if (Object.keys(patch).length === 0) return this.get();
    const [row] = await this.database.db.update(settings).set(patch).where(eq(settings.id, ROW_ID)).returning(columns);
    if (!row) throw new Error("settings row disappeared during update");
    this.current = Promise.resolve(row);
    return row;
  }

  private async load(): Promise<Settings> {
    const { db } = this.database;
    await db.insert(settings).values({ id: ROW_ID }).onConflictDoNothing();
    const row = await db.select(columns).from(settings).where(eq(settings.id, ROW_ID)).get();
    if (!row) throw new Error("settings row missing after insert");
    return row;
  }
}
