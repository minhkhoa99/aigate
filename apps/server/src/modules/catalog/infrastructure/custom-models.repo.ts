import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray } from "drizzle-orm";
import { customModels, type DatabaseHandle } from "@aigate/database";
import { DATABASE } from "../../../database.provider.js";

// docs/contracts/custom-models.md.
export interface CustomModelView {
  provider: string;
  id: string;
  createdAt: string;
}

const c = customModels;
// ponytail: rows grow only by operator action; paginate if one install ever keeps more than this.
export const MAX_LISTED = 10_000;

@Injectable()
export class CustomModelsRepository {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  async list(provider?: string): Promise<CustomModelView[]> {
    const rows = await this.database.db.select({ provider: c.provider, modelId: c.modelId, createdAt: c.createdAt }).from(c).where(provider === undefined ? undefined : eq(c.provider, provider))
      .orderBy(asc(c.createdAt), asc(c.modelId)).limit(MAX_LISTED);
    return rows.map((row) => ({ provider: row.provider, id: row.modelId, createdAt: row.createdAt.toISOString() }));
  }

  // The custom model ids of these providers, for /v1/models.
  async byProvider(providers: readonly string[]): Promise<Map<string, string[]>> {
    const grouped = new Map<string, string[]>();
    if (providers.length === 0) return grouped;
    const rows = await this.database.db.select({ provider: c.provider, modelId: c.modelId }).from(c).where(inArray(c.provider, [...providers]))
      .orderBy(asc(c.createdAt), asc(c.modelId)).limit(MAX_LISTED);
    for (const row of rows) {
      const ids = grouped.get(row.provider);
      if (ids) ids.push(row.modelId);
      else grouped.set(row.provider, [row.modelId]);
    }
    return grouped;
  }

  // An id already stored is skipped (catalog.model-custom-registration: a re-add adds nothing).
  async add(provider: string, ids: readonly string[]): Promise<number> {
    const now = new Date();
    const added = await this.database.db.insert(c).values(ids.map((modelId) => ({ provider, modelId, createdAt: now })))
      .onConflictDoNothing().returning({ modelId: c.modelId });
    return added.length;
  }

  async remove(provider: string, id: string): Promise<void> {
    await this.database.db.delete(c).where(and(eq(c.provider, provider), eq(c.modelId, id)));
  }
}
