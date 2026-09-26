import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { asc, count, eq, sql } from "drizzle-orm";
import { providerConnections, providerNodes, type DatabaseHandle } from "@aigate/database";
import { ANTHROPIC_VERSION, CATALOG, type ProviderDescriptor } from "@aigate/engine";
import { DATABASE } from "../../../database.provider.js";
import { MAX_NODES, type NodeChanges, type NodeFields, type NodeType } from "../domain/provider-node.js";

// docs/contracts/custom-providers.md.
export interface NodeView {
  id: string;
  type: NodeType;
  name: string;
  prefix: string;
  baseUrl: string;
  createdAt: string;
  updatedAt: string;
}

const n = providerNodes;
const columns = { id: n.id, type: n.type, name: n.name, prefix: n.prefix, baseUrl: n.baseUrl, createdAt: n.createdAt, updatedAt: n.updatedAt };
type Row = Omit<NodeView, "createdAt" | "updatedAt"> & { createdAt: Date; updatedAt: Date };
const toView = (row: Row): NodeView => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });

// Every catalog id and alias, connectable or not: they always win over a custom prefix at /v1, as in 9router.
const RESERVED = new Set(CATALOG.flatMap((p) => [p.id, ...p.aliases]));
export const isReservedPrefix = (prefix: string): boolean => RESERVED.has(prefix);

// A custom provider is served by the catalog adapter of its family; it declares no models.
// routing.build-url: exactly one trailing "/" is removed before the path is appended.
export function nodeDescriptor(node: NodeView): ProviderDescriptor {
  const base = node.baseUrl.replace(/\/$/, "");
  const shared = { id: node.id, name: node.name, modelsUrl: `${base}/models`, aliases: [], models: [] };
  if (node.type === "openai-compatible") {
    return { ...shared, protocol: "openai-compatible", chatUrl: `${base}/chat/completions`, headers: {}, auth: { kind: "api-key", header: "authorization", scheme: "bearer" } };
  }
  // connection.anthropic-compatible-node: 9router calls a host official when the URL merely contains api.anthropic.com.
  return {
    ...shared, protocol: "anthropic", chatUrl: `${base}/messages`, headers: { "anthropic-version": ANTHROPIC_VERSION },
    auth: { kind: "api-key", header: "x-api-key", scheme: "raw" }, anthropicNode: { official: node.baseUrl.includes("api.anthropic.com") },
  };
}

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

  // One indexed lookup on the /v1 path, only for a prefix that names no built-in provider. Prefixes may repeat;
  // as in 9router, OpenAI-compatible nodes are searched before Anthropic-compatible ones, and the oldest wins.
  async byPrefix(prefix: string): Promise<NodeView | undefined> {
    const row = await this.database.db.select(columns).from(n).where(eq(n.prefix, prefix))
      .orderBy(sql`${n.type} <> 'openai-compatible'`, asc(n.createdAt)).limit(1).get();
    return row ? toView(row) : undefined;
  }

  // The count and the insert share one transaction.
  create(fields: NodeFields): Promise<NodeView | "limit"> {
    return this.database.db.transaction(async (tx) => {
      const total = await tx.select({ n: count() }).from(n).get();
      if ((total?.n ?? 0) >= MAX_NODES) return "limit";
      const now = new Date();
      const [row] = await tx.insert(n).values({ id: `${fields.type}-${randomBytes(6).toString("hex")}`, ...fields, createdAt: now, updatedAt: now })
        .returning(columns);
      if (!row) throw new Error("insert returned no row");
      return toView(row);
    });
  }

  async update(id: string, changes: NodeChanges): Promise<NodeView | undefined> {
    const [row] = await this.database.db.update(n).set({ ...changes, updatedAt: new Date() }).where(eq(n.id, id)).returning(columns);
    return row ? toView(row) : undefined;
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
