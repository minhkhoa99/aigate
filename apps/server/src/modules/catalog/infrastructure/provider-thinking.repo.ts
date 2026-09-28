import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { providerThinking, type DatabaseHandle } from "@aigate/database";
import type { ThinkingLevel } from "@aigate/engine";
import { DATABASE } from "../../../database.provider.js";

// docs/contracts/provider-thinking.md. One row per provider that is not auto; at most one per catalog provider.
const MAX_ROWS = 500;
const t = providerThinking;

// Read on every chat request, so the rows are cached and dropped on every write.
// ponytail: assumes this process is the only writer, like the settings row.
@Injectable()
export class ProviderThinkingRepository {
  private current: Promise<Map<string, ThinkingLevel>> | undefined;

  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  async get(provider: string): Promise<ThinkingLevel | undefined> {
    return (await this.all()).get(provider);
  }

  // auto deletes the provider's row, as 9router deletes its settings entry.
  async set(provider: string, level: ThinkingLevel | "auto"): Promise<void> {
    if (level === "auto") await this.database.db.delete(t).where(eq(t.provider, provider));
    else {
      const updatedAt = new Date();
      await this.database.db.insert(t).values({ provider, level, updatedAt }).onConflictDoUpdate({ target: t.provider, set: { level, updatedAt } });
    }
    this.current = undefined;
  }

  private all(): Promise<Map<string, ThinkingLevel>> {
    this.current ??= this.database.db.select({ provider: t.provider, level: t.level }).from(t).limit(MAX_ROWS)
      .then((rows) => new Map(rows.map((row) => [row.provider, row.level])))
      .catch((error: unknown) => {
        this.current = undefined;
        throw error;
      });
    return this.current;
  }
}
