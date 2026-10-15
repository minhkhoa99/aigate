import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const SKILL_SOURCES = ["link", "file"] as const;
export type SkillSource = (typeof SKILL_SOURCES)[number];

// docs/contracts/skills.md. A link skill keeps only its URL (agents fetch it there); a file skill keeps its SKILL.md
// content, served by AIGate behind an API key. Names are unique ignoring case.
export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  source: text("source", { enum: SKILL_SOURCES }).notNull(),
  url: text("url"),
  content: text("content"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (t) => [
  uniqueIndex("skills_name_nocase").on(sql`lower(${t.name})`),
  index("skills_created_at").on(t.createdAt),
  check("skills_source", sql`source IN ('link', 'file')`),
  check("skills_source_shape", sql`(source = 'link' AND url IS NOT NULL AND content IS NULL) OR (source = 'file' AND content IS NOT NULL AND url IS NULL)`),
]);
