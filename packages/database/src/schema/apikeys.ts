import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// docs/contracts/identity-apikeys.md. The plaintext key is shown once at creation and never stored.
export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    lastFour: text("last_four").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("api_keys_created_at").on(table.createdAt)],
);
