import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// One typed row (docs/contracts/settings.md). Column defaults are the settings defaults.
// Each context adds its own keys with a migration in the SP that needs them.
export const settings = sqliteTable(
  "settings",
  {
    id: integer("id").primaryKey(),
    requireLogin: integer("require_login", { mode: "boolean" }).notNull().default(true),
    requireApiKey: integer("require_api_key", { mode: "boolean" }).notNull().default(true),
    fallbackStrategy: text("fallback_strategy", { enum: ["fill-first", "round-robin"] }).notNull().default("fill-first"),
    comboStickyLimit: integer("combo_sticky_limit").notNull().default(1),
    tokenSaverEnabled: integer("token_saver_enabled", { mode: "boolean" }).notNull().default(true),
    rtkEnabled: integer("rtk_enabled", { mode: "boolean" }).notNull().default(true),
    headroomEnabled: integer("headroom_enabled", { mode: "boolean" }).notNull().default(false),
    headroomUrl: text("headroom_url").notNull().default("http://127.0.0.1:8787"),
    headroomCompressUserMessages: integer("headroom_compress_user_messages", { mode: "boolean" }).notNull().default(false),
    headroomTimeoutMs: integer("headroom_timeout_ms").notNull().default(3000),
    cavemanEnabled: integer("caveman_enabled", { mode: "boolean" }).notNull().default(false),
    cavemanLevel: text("caveman_level", { enum: ["lite", "full", "ultra"] }).notNull().default("full"),
    ponytailEnabled: integer("ponytail_enabled", { mode: "boolean" }).notNull().default(false),
    ponytailLevel: text("ponytail_level", { enum: ["lite", "full", "ultra"] }).notNull().default("full"),
    pxpipeEnabled: integer("pxpipe_enabled", { mode: "boolean" }).notNull().default(false),
    pxpipeMinChars: integer("pxpipe_min_chars").notNull().default(25000),
    pxpipeTimeoutMs: integer("pxpipe_timeout_ms").notNull().default(15000),
  },
  (table) => [check("settings_single_row", sql`${table.id} = 1`)],
);
