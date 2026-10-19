import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const SKILL_SOURCES = ["link", "file"] as const;
export type SkillSource = (typeof SKILL_SOURCES)[number];
export const SKILL_MODES = ["auto", "always", "off"] as const;
export type SkillMode = (typeof SKILL_MODES)[number];

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
  // 0028: auto (chosen when it matches a /v1 request), always (added to every one) or off. It carries forward the
  // 0027 boolean `auto` (false became off), which 0029 drops.
  mode: text("mode", { enum: SKILL_MODES }).notNull().default("auto"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (t) => [
  uniqueIndex("skills_name_nocase").on(sql`lower(${t.name})`),
  index("skills_created_at").on(t.createdAt),
  check("skills_source", sql`source IN ('link', 'file')`),
  check("skills_mode", sql`mode IN ('auto', 'always', 'off')`),
  check("skills_source_shape", sql`(source = 'link' AND url IS NOT NULL AND content IS NULL) OR (source = 'file' AND content IS NOT NULL AND url IS NULL)`),
]);

// docs/contracts/skills.md, "Automatic skills". The lexical graph index of one skill, rebuilt whenever the skill or its
// fetched link content changes; `linkContent` caches a link skill's document. JSON columns are read and written whole.
export const skillIndex = sqliteTable("skill_index", {
  skillId: text("skill_id").primaryKey().references(() => skills.id, { onDelete: "cascade" }),
  linkContent: text("link_content"),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }),
  fetchError: text("fetch_error"),
  document: text("document", { mode: "json" }).$type<unknown>().notNull(),
  indexedAt: integer("indexed_at", { mode: "timestamp_ms" }).notNull(),
});
