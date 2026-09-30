import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { and, asc, count, eq } from "drizzle-orm";
import { pricingOverrides, type DatabaseHandle } from "@aigate/database";
import { resolvePrice, type Price, type PriceOverride, type PriceSource } from "@aigate/engine";
import { DATABASE } from "../../../database.provider.js";
import { MAX_OVERRIDES, type PriceEdit } from "../domain/pricing.js";

export interface OverrideView {
  provider: string;
  model: string;
  input: number | null;
  output: number | null;
  cached: number | null;
  reasoning: number | null;
  cache_creation: number | null;
  updatedAt: string;
}

const columns = {
  provider: pricingOverrides.provider, model: pricingOverrides.model, input: pricingOverrides.input, output: pricingOverrides.output,
  cached: pricingOverrides.cached, reasoning: pricingOverrides.reasoning, cacheCreation: pricingOverrides.cacheCreation, updatedAt: pricingOverrides.updatedAt,
};
type Row = { provider: string; model: string; input: number | null; output: number | null; cached: number | null; reasoning: number | null; cacheCreation: number | null; updatedAt: Date };

const key = (provider: string, model: string) => `${provider}\u0000${model}`;
function overrideOf(row: Row): PriceOverride {
  const set = { input: row.input, output: row.output, cached: row.cached, reasoning: row.reasoning, cache_creation: row.cacheCreation };
  return Object.fromEntries(Object.entries(set).filter((entry): entry is [string, number] => entry[1] !== null));
}
const view = (row: Row): OverrideView => ({
  provider: row.provider, model: row.model, input: row.input, output: row.output, cached: row.cached, reasoning: row.reasoning, cache_creation: row.cacheCreation, updatedAt: row.updatedAt.toISOString(),
});

export class TooManyOverrides extends Error {}

// pricing.crud-api. The recorder prices every call synchronously, so the overrides live in memory, reloaded after each write.
@Injectable()
export class PricingRepository implements OnModuleInit {
  private overrides = new Map<string, PriceOverride>();

  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  price(provider: string, model: string): { price: Price | null; source: PriceSource } {
    return resolvePrice(provider, model, this.overrides.get(key(provider, model)));
  }

  async list(): Promise<OverrideView[]> {
    const rows = await this.database.db.select(columns).from(pricingOverrides).orderBy(asc(pricingOverrides.provider), asc(pricingOverrides.model)).limit(MAX_OVERRIDES);
    return rows.map(view);
  }

  // A field the edit names replaces the stored one; the others stay (null keeps the built-in rate).
  async apply(edits: readonly PriceEdit[]): Promise<OverrideView[]> {
    const now = new Date();
    await this.database.db.transaction(async (tx) => {
      for (const { provider, model, fields } of edits) {
        const values = { input: fields.input, output: fields.output, cached: fields.cached, reasoning: fields.reasoning, cacheCreation: fields.cache_creation };
        const set = Object.fromEntries(Object.entries(values).filter((entry) => entry[1] !== undefined));
        await tx.insert(pricingOverrides).values({ provider, model, ...values, updatedAt: now }).onConflictDoUpdate({ target: [pricingOverrides.provider, pricingOverrides.model], set: { ...set, updatedAt: now } });
      }
      const total = await tx.select({ n: count() }).from(pricingOverrides).get();
      if ((total?.n ?? 0) > MAX_OVERRIDES) throw new TooManyOverrides(`At most ${MAX_OVERRIDES} price overrides are kept. Reset some first.`);
    });
    await this.reload();
    return this.list();
  }

  async reset(provider?: string, model?: string): Promise<OverrideView[]> {
    const where = provider === undefined ? undefined
      : model === undefined ? eq(pricingOverrides.provider, provider) : and(eq(pricingOverrides.provider, provider), eq(pricingOverrides.model, model));
    await this.database.db.delete(pricingOverrides).where(where);
    await this.reload();
    return this.list();
  }

  private async reload(): Promise<void> {
    const rows = await this.database.db.select(columns).from(pricingOverrides).limit(MAX_OVERRIDES);
    this.overrides = new Map(rows.map((row) => [key(row.provider, row.model), overrideOf(row)]));
  }
}
