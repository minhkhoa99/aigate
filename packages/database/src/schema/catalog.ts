import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// docs/contracts/custom-models.md (SP16a). Chat model ids the operator added to a provider, by hand or from its /models.
// provider is a catalog provider id or a custom provider id, so it has no foreign key; like 9router, deleting a custom
// provider leaves its rows (catalog.custom-models-orphan-on-node-delete, kept by user decision).
export const customModels = sqliteTable("custom_models", {
  provider: text("provider").notNull(),
  modelId: text("model_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (t) => [primaryKey({ columns: [t.provider, t.modelId] })]);
