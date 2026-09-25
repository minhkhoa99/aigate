import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// SPIKE-1 schema: exercises text/int/boolean/json columns and an aggregate target.
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  meta: text("meta", { mode: "json" }).$type<{ tier: string }>(),
  updatedAt: integer("updated_at").notNull(),
});

export const usage = sqliteTable("usage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: text("account_id").notNull().references(() => accounts.id),
  tokens: integer("tokens").notNull(),
});
