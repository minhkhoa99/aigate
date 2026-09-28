import { sql } from "drizzle-orm";
import { check, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// docs/contracts/provider-thinking.md (routing.provider-thinking-default): the thinking level a provider applies to a
// request that carries none. No row means auto. provider is a catalog provider id; one row per provider.
export const THINKING_LEVEL_VALUES = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
export const providerThinking = sqliteTable("provider_thinking", {
  provider: text("provider").primaryKey(),
  level: text("level", { enum: THINKING_LEVEL_VALUES }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, () => [check("provider_thinking_level", sql.raw(`level IN (${THINKING_LEVEL_VALUES.map((level) => `'${level}'`).join(", ")})`))]);

// docs/contracts/custom-models.md (SP16a). Chat model ids the operator added to a provider, by hand or from its /models.
// provider is a catalog provider id or a custom provider id, so it has no foreign key; like 9router, deleting a custom
// provider leaves its rows (catalog.custom-models-orphan-on-node-delete, kept by user decision).
export const customModels = sqliteTable("custom_models", {
  provider: text("provider").notNull(),
  modelId: text("model_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (t) => [primaryKey({ columns: [t.provider, t.modelId] })]);
