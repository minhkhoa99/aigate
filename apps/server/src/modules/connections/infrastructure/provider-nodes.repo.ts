import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, asc, count, eq, ne } from "drizzle-orm";
import { providerConnections, providerNodes, type DatabaseHandle } from "@aigate/database";
import type { ProviderDescriptor } from "@aigate/engine";
import { DATABASE } from "../../../database.provider.js";
import { MAX_NODES, type NodeFields } from "../domain/provider-node.js";

// docs/contracts/custom-providers.md.
export interface NodeView {
  id: string;
  name: string;
  prefix: string;
  baseUrl: string;
  createdAt: string;
  updatedAt: string;
}

const n = providerNodes;
const columns = { id: n.id, name: n.name, prefix: n.prefix, baseUrl: n.baseUrl, createdAt: n.createdAt, updatedAt: n.updatedAt };
type Row = Omit<NodeView, "createdAt" | "updatedAt"> & { createdAt: Date; updatedAt: Date };
const toView = (row: Row): NodeView => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });

// A custom provider is served by the same OpenAI-compatible adapter as the catalog; it declares no models.
export const nodeDescriptor = (node: NodeView): ProviderDescriptor => ({
  id: node.id, name: node.name, protocol: "openai-compatible", chatUrl: `${node.baseUrl}/chat/completions`, modelsUrl: `${node.baseUrl}/models`,
  headers: {}, aliases: [], auth: { kind: "api-key", header: "authorization", scheme: "bearer" }, models: [],
});

@Injectable()
export class ProviderNodesRepository {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  async list(): Promise<NodeView[]> {
    const rows = await this.database.db.select(columns).from(n).orderBy(asc(n.createdAt)).limit(MAX_NODES);
    return rows.map(toView);
  }

  async get(id: string): Promise<NodeView | undefined> {
    const row = await this.database.db.select(columns).from(n).where(eq(n.id, id)).get();
    return row ? toView(row) : undefined;
  }

  // One indexed lookup on the /v1 path, only for a prefix that names no built-in provider.
  async byPrefix(prefix: string): Promise<NodeView | undefined> {
    const row = await this.database.db.select(columns).from(n).where(eq(n.prefix, prefix)).get();
    return row ? toView(row) : undefined;
  }

  // The count and the insert share one transaction; the unique index decides a taken prefix.
  create(fields: NodeFields): Promise<NodeView | "limit" | "taken"> {
    return this.database.db.transaction(async (tx) => {
      const total = await tx.select({ n: count() }).from(n).get();
      if ((total?.n ?? 0) >= MAX_NODES) return "limit";
      const now = new Date();
      const [row] = await tx.insert(n).values({ id: `openai-compatible-${randomBytes(6).toString("hex")}`, ...fields, createdAt: now, updatedAt: now })
        .onConflictDoNothing({ target: n.prefix }).returning(columns);
      return row ? toView(row) : "taken";
    });
  }

  // Inside one transaction the global lock makes the prefix check and the update atomic; the index still backs it.
  update(id: string, changes: Partial<NodeFields>): Promise<NodeView | "taken" | undefined> {
    return this.database.db.transaction(async (tx) => {
      if (changes.prefix !== undefined) {
        const clash = await tx.select({ id: n.id }).from(n).where(and(eq(n.prefix, changes.prefix), ne(n.id, id))).get();
        if (clash) return "taken";
      }
      const [row] = await tx.update(n).set({ ...changes, updatedAt: new Date() }).where(eq(n.id, id)).returning(columns);
      return row ? toView(row) : undefined;
    });
  }

  // Deleting a custom provider deletes its connection and sealed key too (connection.provider-node-update-delete).
  remove(id: string): Promise<boolean> {
    return this.database.db.transaction(async (tx) => {
      const deleted = await tx.delete(n).where(eq(n.id, id)).returning({ id: n.id });
      if (deleted.length === 0) return false;
      await tx.delete(providerConnections).where(eq(providerConnections.provider, id));
      return true;
    });
  }
}
