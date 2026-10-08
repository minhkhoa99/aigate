import { Inject, Injectable } from "@nestjs/common";
import { CAPACITY_CAPABILITIES, capacityPools, type CapacityCapability, type DatabaseHandle } from "@aigate/database";
import { DATABASE } from "../../../database.provider.js";
import { rotate, type Rotation } from "../domain/combo.js";
import type { CapacityPool, PoolFields } from "../domain/capacity.js";

const p = capacityPools;
const columns = { capability: p.capability, enabled: p.enabled, roundRobin: p.roundRobin, models: p.models, updatedAt: p.updatedAt };

// docs/contracts/capacity-adapter.md. The /v1 lane reads the four pools on every request that carries media, so they are
// cached and replaced on every write. ponytail: assumes this process is the only writer, as SettingsRepository does.
@Injectable()
export class CapacityPoolsRepository {
  private current: Promise<CapacityPool[]> | undefined;
  // capacity.solo-rotation-keyed-by-model (corrected): one rotation per pool, dropped when that pool is saved.
  private readonly rotations = new Map<CapacityCapability, Rotation>();

  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  // All four, in CAPACITY_CAPABILITIES order; a pool never saved is off and empty.
  list(): Promise<CapacityPool[]> {
    this.current ??= this.database.db.select(columns).from(p).limit(CAPACITY_CAPABILITIES.length)
      .then((rows) => CAPACITY_CAPABILITIES.map((capability): CapacityPool => {
        const row = rows.find((candidate) => candidate.capability === capability);
        return row ? { ...row, updatedAt: row.updatedAt.toISOString() } : { capability, enabled: false, roundRobin: false, models: [], updatedAt: null };
      }))
      .catch((error: unknown) => {
        this.current = undefined;
        throw error;
      });
    return this.current;
  }

  async save(capability: CapacityCapability, fields: PoolFields): Promise<CapacityPool> {
    try {
      const updatedAt = new Date();
      const [row] = await this.database.db.insert(p).values({ capability, ...fields, updatedAt })
        .onConflictDoUpdate({ target: p.capability, set: { ...fields, updatedAt } }).returning(columns);
      if (!row) throw new Error("capacity pool was not saved");
      return { ...row, updatedAt: row.updatedAt.toISOString() };
    } finally {
      this.current = undefined;
      this.rotations.delete(capability);
    }
  }

  // One request per member, as 9router's single-model adapter run (no sticky limit there). No await between the read
  // and the write, so requests cannot interleave.
  order(capability: CapacityCapability, models: readonly string[]): readonly string[] {
    const { order, next } = rotate(models, this.rotations.get(capability), 1);
    this.rotations.set(capability, next);
    return order;
  }

  peekOrder(capability: CapacityCapability, models: readonly string[]): readonly string[] {
    return rotate(models, this.rotations.get(capability), 1).order;
  }
}
