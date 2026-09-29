import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { asc, count, eq } from "drizzle-orm";
import { combos, type DatabaseHandle } from "@aigate/database";
import { DATABASE } from "../../../database.provider.js";
import { rotate, type Combo, type ComboFields, type Rotation } from "../domain/combo.js";

export const MAX_COMBOS = 200;
const c = combos;
const columns = {
  id: c.id, name: c.name, models: c.models, strategy: c.strategy, judgeModel: c.judgeModel, minPanel: c.minPanel,
  stragglerGraceMs: c.stragglerGraceMs, panelTimeoutMs: c.panelTimeoutMs, createdAt: c.createdAt, updatedAt: c.updatedAt,
};
type Row = Omit<Combo, "createdAt" | "updatedAt"> & { createdAt: Date; updatedAt: Date };
const view = (row: Row): Combo => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });

// Schema rule 6: the unique index decides a duplicate name. Every driver reports SQLite's own message, possibly wrapped.
function isUniqueViolation(error: unknown): boolean {
  for (let current = error, depth = 0; current instanceof Error && depth < 4; current = current.cause, depth += 1) {
    if (current.message.includes("UNIQUE constraint failed")) return true;
  }
  return false;
}

// docs/contracts/combos.md. The /v1 lane looks a bare model up here on every request, so the (bounded) list is cached and
// replaced on every write. ponytail: assumes this process is the only writer, as SettingsRepository does.
@Injectable()
export class CombosRepository {
  private current: Promise<Combo[]> | undefined;
  // combo.rotation-state-lifecycle: process memory, one entry per combo id, dropped when the combo changes.
  private readonly rotations = new Map<string, Rotation>();

  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  list(): Promise<Combo[]> {
    this.current ??= this.database.db.select(columns).from(c).orderBy(asc(c.name)).limit(MAX_COMBOS)
      .then((rows) => rows.map(view))
      .catch((error: unknown) => {
        this.current = undefined;
        throw error;
      });
    return this.current;
  }

  async byName(name: string): Promise<Combo | undefined> {
    return (await this.list()).find((combo) => combo.name === name);
  }

  async get(id: string): Promise<Combo | undefined> {
    return (await this.list()).find((combo) => combo.id === id);
  }

  // The count and the insert share one transaction.
  async create(fields: ComboFields): Promise<Combo | "limit" | "exists"> {
    try {
      return await this.database.db.transaction(async (tx) => {
        const total = await tx.select({ n: count() }).from(c).get();
        if ((total?.n ?? 0) >= MAX_COMBOS) return "limit";
        const now = new Date();
        const [row] = await tx.insert(c).values({ id: randomUUID(), ...fields, createdAt: now, updatedAt: now }).returning(columns);
        if (!row) throw new Error("combo was not saved");
        return view(row);
      });
    } catch (error) {
      if (isUniqueViolation(error)) return "exists";
      throw error;
    } finally {
      this.current = undefined;
    }
  }

  // Any saved change restarts the combo's rotation (9router resets it on every PUT).
  async update(id: string, changes: Partial<ComboFields>): Promise<Combo | "missing" | "exists"> {
    try {
      const [row] = await this.database.db.update(c).set({ ...changes, updatedAt: new Date() }).where(eq(c.id, id)).returning(columns);
      return row ? view(row) : "missing";
    } catch (error) {
      if (isUniqueViolation(error)) return "exists";
      throw error;
    } finally {
      this.current = undefined;
      this.rotations.delete(id);
    }
  }

  async remove(id: string): Promise<boolean> {
    try {
      const deleted = await this.database.db.delete(c).where(eq(c.id, id)).returning({ id: c.id });
      return deleted.length > 0;
    } finally {
      this.current = undefined;
      this.rotations.delete(id);
    }
  }

  // combo.mode-round-robin: the read and write run without an await between them, so requests cannot interleave.
  order(combo: Combo, stickyLimit: number): readonly string[] {
    const { order, next } = rotate(combo.models, this.rotations.get(combo.id), stickyLimit);
    this.rotations.set(combo.id, next);
    return order;
  }
}
