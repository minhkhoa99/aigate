import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, asc, count, eq, inArray, ne, sql } from "drizzle-orm";
import { skillIndex, skills, type DatabaseHandle } from "@aigate/database";
import { DATABASE } from "../../../database.provider.js";
import { MAX_ALWAYS_SKILLS, MAX_SKILLS, type SkillChanges, type SkillFields, type SkillMode, type SkillSource } from "../domain/skill.js";
import { buildDocument, isSkillDocument, type GraphSkill } from "../domain/skill-graph.js";

// docs/contracts/skills.md. The list never carries content, so it stays small however large the files are.
export interface SkillSummary {
  id: string; name: string; description: string; source: SkillSource; url: string | null; bytes: number; enabled: boolean; mode: SkillMode;
  fetchedAt: string | null; fetchError: string | null; createdAt: string; updatedAt: string;
}
// content is the uploaded file, or the cached copy of a link (null until fetched).
export interface SkillDetail extends SkillSummary { content: string | null }
export type ContextSkill = GraphSkill & { mode: "auto" | "always" };
// Five matched skills plus every always-on skill.
export const MAX_TEXTS = 5 + MAX_ALWAYS_SKILLS;

const s = skills;
const x = skillIndex;
const summary = {
  id: s.id, name: s.name, description: s.description, source: s.source, url: s.url, enabled: s.enabled, mode: s.mode,
  fetchedAt: x.fetchedAt, fetchError: x.fetchError, createdAt: s.createdAt, updatedAt: s.updatedAt,
};
// length() of a TEXT value counts characters; a blob cast counts UTF-8 bytes.
const sqlBytes = sql<number>`coalesce(length(cast(${s.content} as blob)), length(cast(${x.linkContent} as blob)), 0)`;
type Row = { id: string; name: string; description: string; source: SkillSource; url: string | null; enabled: boolean; mode: SkillMode; fetchedAt: Date | null; fetchError: string | null; createdAt: Date; updatedAt: Date };
const view = (row: Row, bytes: number): SkillSummary => ({
  ...row, bytes, fetchedAt: row.fetchedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
});
const size = (content: string | null): number => content === null ? 0 : Buffer.byteLength(content, "utf8");

// Schema rule 6: the unique index decides a duplicate name. Every driver reports SQLite's own message, possibly wrapped.
function isUniqueViolation(error: unknown): boolean {
  for (let current = error, depth = 0; current instanceof Error && depth < 4; current = current.cause, depth += 1) {
    if (current.message.includes("UNIQUE constraint failed")) return true;
  }
  return false;
}

@Injectable()
export class SkillsRepository {
  // Bumped on every write so the automatic-selection graph knows to rebuild. ponytail: assumes one writer process.
  version = 0;

  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  async list(): Promise<SkillSummary[]> {
    const rows = await this.database.db.select({ ...summary, bytes: sqlBytes }).from(s).leftJoin(x, eq(x.skillId, s.id))
      .orderBy(asc(s.createdAt), asc(s.id)).limit(MAX_SKILLS);
    return rows.map(({ bytes, ...row }) => view(row, Number(bytes ?? 0)));
  }

  async get(id: string): Promise<SkillDetail | undefined> {
    const row = await this.database.db.select({ ...summary, content: s.content, linkContent: x.linkContent }).from(s).leftJoin(x, eq(x.skillId, s.id)).where(eq(s.id, id)).get();
    if (!row) return undefined;
    const { content, linkContent, ...rest } = row;
    const text = content ?? linkContent;
    return { ...view(rest, size(text)), content: text };
  }

  // The SKILL.md an agent may fetch: an enabled file skill only.
  async servable(id: string): Promise<string | undefined> {
    const row = await this.database.db.select({ content: s.content }).from(s).where(and(eq(s.id, id), eq(s.source, "file"), eq(s.enabled, true))).get();
    return row?.content ?? undefined;
  }

  // The counts, the insert and the index share one transaction, so concurrent creates cannot pass a limit together.
  async create(fields: SkillFields): Promise<SkillDetail | "limit" | "always-limit" | "exists"> {
    const document = buildDocument(fields.name, fields.description, fields.content);
    const id = randomUUID();
    try {
      const created = await this.database.db.transaction(async (tx) => {
        const total = await tx.select({ n: count() }).from(s).get();
        if ((total?.n ?? 0) >= MAX_SKILLS) return "limit";
        if (fields.mode === "always") {
          const always = await tx.select({ n: count() }).from(s).where(eq(s.mode, "always")).get();
          if ((always?.n ?? 0) >= MAX_ALWAYS_SKILLS) return "always-limit";
        }
        const now = new Date();
        await tx.insert(s).values({ id, ...fields, enabled: true, createdAt: now, updatedAt: now });
        await tx.insert(x).values({ skillId: id, document, indexedAt: now });
        return "created";
      });
      if (created !== "created") return created;
    } catch (error) {
      if (isUniqueViolation(error)) return "exists";
      throw error;
    }
    this.version += 1;
    const saved = await this.get(id);
    if (!saved) throw new Error("skill was not saved");
    return saved;
  }

  // A changed link URL drops the cached copy; the caller fetches the new one.
  async update(id: string, changes: SkillChanges): Promise<SkillDetail | "missing" | "always-limit" | "exists"> {
    const current = await this.database.db.select({ name: s.name, description: s.description, url: s.url, content: s.content, linkContent: x.linkContent })
      .from(s).leftJoin(x, eq(x.skillId, s.id)).where(eq(s.id, id)).get();
    if (!current) return "missing";
    const urlChanged = changes.url !== undefined && changes.url !== current.url;
    const linkContent = urlChanged ? null : current.linkContent;
    const document = buildDocument(changes.name ?? current.name, changes.description ?? current.description, changes.content ?? current.content ?? linkContent);
    try {
      const updated = await this.database.db.transaction(async (tx) => {
        if (changes.mode === "always") {
          const always = await tx.select({ n: count() }).from(s).where(and(eq(s.mode, "always"), ne(s.id, id))).get();
          if ((always?.n ?? 0) >= MAX_ALWAYS_SKILLS) return "always-limit";
        }
        const now = new Date();
        const [row] = await tx.update(s).set({ ...changes, updatedAt: now }).where(eq(s.id, id)).returning({ id: s.id });
        if (!row) return "missing";
        const reset = urlChanged ? { linkContent: null, fetchedAt: null, fetchError: null } : {};
        await tx.insert(x).values({ skillId: id, document, indexedAt: now, ...reset }).onConflictDoUpdate({ target: x.skillId, set: { document, indexedAt: now, ...reset } });
        return "updated";
      });
      if (updated !== "updated") return updated;
    } catch (error) {
      if (isUniqueViolation(error)) return "exists";
      throw error;
    }
    this.version += 1;
    return (await this.get(id)) ?? "missing";
  }

  // The outcome of fetching a link skill. A failed refresh keeps the previous copy and records the error.
  async storeLink(id: string, outcome: { content: string } | { error: string }): Promise<SkillDetail | undefined> {
    const current = await this.database.db.select({ name: s.name, description: s.description, linkContent: x.linkContent })
      .from(s).leftJoin(x, eq(x.skillId, s.id)).where(and(eq(s.id, id), eq(s.source, "link"))).get();
    if (!current) return undefined;
    const now = new Date();
    const values = "content" in outcome
      ? { linkContent: outcome.content, fetchedAt: now, fetchError: null, document: buildDocument(current.name, current.description, outcome.content), indexedAt: now }
      : { fetchError: outcome.error.slice(0, 500), document: buildDocument(current.name, current.description, current.linkContent), indexedAt: now };
    await this.database.db.insert(x).values({ skillId: id, ...values }).onConflictDoUpdate({ target: x.skillId, set: values });
    this.version += 1;
    return this.get(id);
  }

  async remove(id: string): Promise<boolean> {
    const deleted = await this.database.db.delete(s).where(eq(s.id, id)).returning({ id: s.id });
    if (deleted.length) this.version += 1;
    return deleted.length > 0;
  }

  // Enabled auto and always skills with their index. A skill saved before migration 0027 has no index row; it is
  // indexed here once and stored.
  async contextSkills(): Promise<ContextSkill[]> {
    const rows = await this.database.db.select({ id: s.id, name: s.name, description: s.description, mode: s.mode, content: s.content, document: x.document })
      .from(s).leftJoin(x, eq(x.skillId, s.id)).where(and(eq(s.enabled, true), ne(s.mode, "off"))).orderBy(asc(s.createdAt), asc(s.id)).limit(MAX_SKILLS);
    const out: ContextSkill[] = [];
    for (const { content, document: stored, mode, ...row } of rows) {
      const skillMode = mode === "always" ? "always" : "auto";
      if (isSkillDocument(stored)) { out.push({ ...row, mode: skillMode, document: stored }); continue; }
      const document = buildDocument(row.name, row.description, content);
      const now = new Date();
      await this.database.db.insert(x).values({ skillId: row.id, document, indexedAt: now }).onConflictDoUpdate({ target: x.skillId, set: { document, indexedAt: now } });
      out.push({ ...row, mode: skillMode, document });
    }
    return out;
  }

  // The text of up to MAX_TEXTS chosen skills.
  async texts(ids: readonly string[]): Promise<Map<string, string>> {
    if (!ids.length) return new Map();
    const rows = await this.database.db.select({ id: s.id, content: s.content, linkContent: x.linkContent }).from(s).leftJoin(x, eq(x.skillId, s.id))
      .where(inArray(s.id, ids.slice(0, MAX_TEXTS))).limit(MAX_TEXTS);
    return new Map(rows.flatMap((row) => { const text = row.content ?? row.linkContent; return text ? [[row.id, text] as const] : []; }));
  }
}
