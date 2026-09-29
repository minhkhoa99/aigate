import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { asc, count, eq, isNotNull } from "drizzle-orm";
import { proxyPools, providerConnections, providerProxyStrategies, type DatabaseHandle, type ProxyPoolTestStatus, type ProxyPoolType, type ProxyRotationStrategy } from "@aigate/database";
import type { ProxyConfig } from "@aigate/engine";
import { DATABASE } from "../../../database.provider.js";
import type { NewProxyPool, ProxyPoolChanges } from "../domain/proxy-pool.js";

const MAX_POOLS = 100;
const t = proxyPools;
const rotations = providerProxyStrategies;
const rotateState = new Map<string, number>();
const columns = { id: t.id, name: t.name, proxyUrl: t.proxyUrl, noProxy: t.noProxy, type: t.type, isActive: t.isActive, strictProxy: t.strictProxy, testStatus: t.testStatus, lastTestedAt: t.lastTestedAt, lastError: t.lastError, createdAt: t.createdAt, updatedAt: t.updatedAt };
type Row = Omit<ProxyPoolView, "lastTestedAt" | "createdAt" | "updatedAt"> & { lastTestedAt: Date | null; createdAt: Date; updatedAt: Date };
export interface ProxyPoolView { id: string; name: string; proxyUrl: string; noProxy: string; type: ProxyPoolType; isActive: boolean; strictProxy: boolean; testStatus: ProxyPoolTestStatus; lastTestedAt: string | null; lastError: string | null; createdAt: string; updatedAt: string; boundConnectionCount?: number }
const view = (row: Row): ProxyPoolView => ({ ...row, lastTestedAt: row.lastTestedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });

@Injectable()
export class ProxyPoolsRepository {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  async list(): Promise<ProxyPoolView[]> { return (await this.database.db.select(columns).from(t).orderBy(asc(t.name)).limit(MAX_POOLS)).map(view); }
  async get(id: string): Promise<ProxyPoolView | undefined> { const row = await this.database.db.select(columns).from(t).where(eq(t.id, id)).get(); return row ? view(row) : undefined; }
  async create(input: NewProxyPool): Promise<ProxyPoolView> {
    const now = new Date();
    const [row] = await this.database.db.insert(t).values({ id: randomUUID(), ...input, createdAt: now, updatedAt: now }).returning(columns);
    if (!row) throw new Error("proxy pool was not saved");
    return view(row);
  }
  async update(id: string, changes: ProxyPoolChanges): Promise<ProxyPoolView | undefined> {
    const [row] = await this.database.db.update(t).set({ ...changes, updatedAt: new Date() }).where(eq(t.id, id)).returning(columns);
    return row ? view(row) : undefined;
  }
  async remove(id: string): Promise<"removed" | "bound" | "missing"> {
    return this.database.db.transaction(async (tx) => {
      const exists = await tx.select({ id: t.id }).from(t).where(eq(t.id, id)).get();
      if (!exists) return "missing";
      const bound = await tx.select({ total: count() }).from(providerConnections).where(eq(providerConnections.proxyPoolId, id)).get();
      if ((bound?.total ?? 0) > 0) return "bound";
      await tx.delete(t).where(eq(t.id, id));
      return "removed";
    });
  }
  async usage(): Promise<Map<string, number>> {
    const rows = await this.database.db.select({ id: providerConnections.proxyPoolId, total: count() }).from(providerConnections).where(isNotNull(providerConnections.proxyPoolId)).groupBy(providerConnections.proxyPoolId).limit(MAX_POOLS);
    return new Map(rows.flatMap((row) => row.id ? [[row.id, row.total] as const] : []));
  }
  async resolve(id: string | null): Promise<ProxyConfig | undefined> {
    if (!id) return undefined;
    const pool = await this.get(id);
    if (!pool || !pool.isActive) return undefined;
    return { url: pool.proxyUrl, noProxy: pool.noProxy ? pool.noProxy.split(",") : [], relay: pool.type !== "http", strict: pool.strictProxy };
  }
  async rotation(providerId: string) {
    return await this.database.db.select({ rotateStrategy: rotations.rotateStrategy, proxyPoolId: rotations.proxyPoolId }).from(rotations).where(eq(rotations.providerId, providerId)).get()
      ?? { rotateStrategy: "none" as const, proxyPoolId: null };
  }
  async rotations() {
    return this.database.db.select({ providerId: rotations.providerId, rotateStrategy: rotations.rotateStrategy, proxyPoolId: rotations.proxyPoolId }).from(rotations).limit(MAX_POOLS);
  }
  async setRotation(providerId: string, rotateStrategy: ProxyRotationStrategy, proxyPoolId: string | null) {
    await this.database.db.insert(rotations).values({ providerId, rotateStrategy, proxyPoolId }).onConflictDoUpdate({
      target: rotations.providerId, set: { rotateStrategy, proxyPoolId },
    });
    return { providerId, rotateStrategy, proxyPoolId };
  }
  async resolveNoAuth(providerId: string): Promise<ProxyConfig | undefined> {
    const rotation = await this.rotation(providerId);
    if (rotation.rotateStrategy === "none") return this.resolve(rotation.proxyPoolId);
    const active = (await this.database.db.select(columns).from(t).where(eq(t.isActive, true)).orderBy(asc(t.name)).limit(MAX_POOLS)).map(view);
    if (active.length === 0) return undefined;
    const index = rotation.rotateStrategy === "random" ? Math.floor(Math.random() * active.length) : (rotateState.get(providerId) ?? 0) % active.length;
    if (rotation.rotateStrategy === "round-robin") rotateState.set(providerId, (index + 1) % active.length);
    const pool = active[index];
    return { url: pool.proxyUrl, noProxy: pool.noProxy ? pool.noProxy.split(",") : [], relay: pool.type !== "http", strict: pool.strictProxy };
  }
  async recordTest(id: string, ok: boolean, error: string | null): Promise<ProxyPoolView | undefined> {
    const [row] = await this.database.db.update(t).set({ testStatus: ok ? "active" : "error", lastTestedAt: new Date(), lastError: error, updatedAt: new Date() }).where(eq(t.id, id)).returning(columns);
    return row ? view(row) : undefined;
  }
}
