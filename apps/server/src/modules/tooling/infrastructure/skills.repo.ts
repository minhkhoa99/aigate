import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { skills, type DatabaseHandle } from "@aigate/database";
import { DATABASE } from "../../../database.provider.js";
import { MAX_SKILLS, type SkillChanges, type SkillFields, type SkillSource } from "../domain/skill.js";

// docs/contracts/skills.md. The list never carries content, so it stays small however large the files are.
export interface SkillSummary { id: string; name: string; description: string; source: SkillSource; url: string | null; bytes: number; enabled: boolean; createdAt: string; updatedAt: string }
export interface SkillDetail extends SkillSummary { content: string | null }

const s = skills;
const summary = { id: s.id, name: s.name, description: s.description, source: s.source, url: s.url, enabled: s.enabled, createdAt: s.createdAt, updatedAt: s.updatedAt };
// length() of a TEXT value counts characters; a blob cast counts UTF-8 bytes.
const sqlBytes = sql<number>`coalesce(length(cast(${s.content} as blob)), 0)`;
type Row = { id: string; name: string; description: string; source: SkillSource; url: string | null; enabled: boolean; createdAt: Date; updatedAt: Date };
const view = (row: Row, bytes: number): SkillSummary => ({ ...row, bytes, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
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
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  async list(): Promise<SkillSummary[]> {
    const rows = await this.database.db.select({ ...summary, bytes: sqlBytes }).from(s).orderBy(asc(s.createdAt), asc(s.id)).limit(MAX_SKILLS);
    return rows.map(({ bytes, ...row }) => view(row, Number(bytes ?? 0)));
  }

  async get(id: string): Promise<SkillDetail | undefined> {
    const row = await this.database.db.select({ ...summary, content: s.content }).from(s).where(eq(s.id, id)).get();
    if (!row) return undefined;
    const { content, ...rest } = row;
    return { ...view(rest, size(content)), content };
  }

  // The SKILL.md an agent may fetch: an enabled file skill only.
  async servable(id: string): Promise<string | undefined> {
    const row = await this.database.db.select({ content: s.content }).from(s).where(and(eq(s.id, id), eq(s.source, "file"), eq(s.enabled, true))).get();
    return row?.content ?? undefined;
  }

  // The count and the insert share one transaction, so concurrent creates cannot pass the limit together.
  async create(fields: SkillFields): Promise<SkillDetail | "limit" | "exists"> {
    try {
      return await this.database.db.transaction(async (tx) => {
        const total = await tx.select({ n: count() }).from(s).get();
        if ((total?.n ?? 0) >= MAX_SKILLS) return "limit";
        const now = new Date();
        const [row] = await tx.insert(s).values({ id: randomUUID(), ...fields, enabled: true, createdAt: now, updatedAt: now }).returning({ ...summary, content: s.content });
        if (!row) throw new Error("skill was not saved");
        const { content, ...rest } = row;
        return { ...view(rest, size(content)), content };
      });
    } catch (error) {
      if (isUniqueViolation(error)) return "exists";
      throw error;
    }
  }

  async update(id: string, changes: SkillChanges): Promise<SkillDetail | "missing" | "exists"> {
    try {
      const [row] = await this.database.db.update(s).set({ ...changes, updatedAt: new Date() }).where(eq(s.id, id)).returning({ ...summary, content: s.content });
      if (!row) return "missing";
      const { content, ...rest } = row;
      return { ...view(rest, size(content)), content };
    } catch (error) {
      if (isUniqueViolation(error)) return "exists";
      throw error;
    }
  }

  async remove(id: string): Promise<boolean> {
    const deleted = await this.database.db.delete(s).where(eq(s.id, id)).returning({ id: s.id });
    return deleted.length > 0;
  }
}
