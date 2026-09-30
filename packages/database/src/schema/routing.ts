import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const COMBO_STRATEGIES = ["fallback", "round-robin", "fusion"] as const;
export type ComboStrategy = (typeof COMBO_STRATEGIES)[number];

// docs/contracts/combos.md. `models` is read and written whole (schema rule 1); the strategy and its fusion tuning are
// columns of the combo, so a rename keeps them (combo.strategy-keyed-by-name).
export const combos = sqliteTable("combos", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  models: text("models", { mode: "json" }).$type<string[]>().notNull(),
  strategy: text("strategy", { enum: COMBO_STRATEGIES }).notNull().default("fallback"),
  judgeModel: text("judge_model"),
  minPanel: integer("min_panel").notNull().default(2),
  stragglerGraceMs: integer("straggler_grace_ms").notNull().default(8000),
  panelTimeoutMs: integer("panel_timeout_ms").notNull().default(90000),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const CAPACITY_CAPABILITIES = ["vision", "pdf", "audioInput", "videoInput"] as const;
export type CapacityCapability = (typeof CAPACITY_CAPABILITIES)[number];

// docs/contracts/capacity-adapter.md: one row per capability pool, a missing row is off and empty. `models` is read and
// written whole (schema rule 1); the switches are typed booleans (rule 3).
export const capacityPools = sqliteTable("capacity_pools", {
  capability: text("capability", { enum: CAPACITY_CAPABILITIES }).primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  roundRobin: integer("round_robin", { mode: "boolean" }).notNull().default(false),
  models: text("models", { mode: "json" }).$type<string[]>().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
