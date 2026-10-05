import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { settings, type DatabaseHandle } from "@aigate/database";
import { DATABASE } from "../../../database.provider.js";
import type { Settings, SettingsPatch } from "../domain/settings.js";

const ROW_ID = 1;
const columns = {
  requireLogin: settings.requireLogin, requireApiKey: settings.requireApiKey, fallbackStrategy: settings.fallbackStrategy, comboStickyLimit: settings.comboStickyLimit,
  tokenSaverEnabled: settings.tokenSaverEnabled, rtkEnabled: settings.rtkEnabled, headroomEnabled: settings.headroomEnabled,
  headroomUrl: settings.headroomUrl, headroomCompressUserMessages: settings.headroomCompressUserMessages, headroomTimeoutMs: settings.headroomTimeoutMs,
  cavemanEnabled: settings.cavemanEnabled, cavemanLevel: settings.cavemanLevel, ponytailEnabled: settings.ponytailEnabled,
  ponytailLevel: settings.ponytailLevel, pxpipeEnabled: settings.pxpipeEnabled, pxpipeMinChars: settings.pxpipeMinChars,
  pxpipeTimeoutMs: settings.pxpipeTimeoutMs,
};

export class SettingsChangedError extends Error {}
export const settingsVersion = (value: Settings): string => createHash("sha256")
  .update(JSON.stringify(Object.keys(columns).map((key) => [key, Reflect.get(value, key)]))).digest("hex");

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

  async update(patch: SettingsPatch, expectedVersion?: string): Promise<Settings> {
    const current = await this.get();
    if (expectedVersion !== undefined && settingsVersion(current) !== expectedVersion) throw new SettingsChangedError("Settings changed since preview. Preview the document again.");
    if (Object.keys(patch).length === 0) return this.get();
    const unchanged = expectedVersion === undefined ? [] : Object.entries(columns).map(([key, column]) => eq(column, Reflect.get(current, key)));
    const [row] = await this.database.db.update(settings).set(patch).where(and(eq(settings.id, ROW_ID), ...unchanged)).returning(columns);
    if (!row) {
      this.current = undefined;
      if (expectedVersion !== undefined) throw new SettingsChangedError("Settings changed since preview. Preview the document again.");
      throw new Error("settings row disappeared during update");
    }
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
