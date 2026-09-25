import { sql } from "drizzle-orm";
import { check, integer, sqliteTable } from "drizzle-orm/sqlite-core";

// One typed row (docs/contracts/settings.md). Column defaults are the settings defaults.
// Each context adds its own keys with a migration in the SP that needs them.
export const settings = sqliteTable(
  "settings",
  {
    id: integer("id").primaryKey(),
    requireLogin: integer("require_login", { mode: "boolean" }).notNull().default(true),
    requireApiKey: integer("require_api_key", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [check("settings_single_row", sql`${table.id} = 1`)],
);
