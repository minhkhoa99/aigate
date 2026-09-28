import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { asc, count, eq, sql } from "drizzle-orm";
import { providerConnections, providerNodes, type DatabaseHandle } from "@aigate/database";
import { ANTHROPIC_VERSION, CATALOG, type ProviderDescriptor } from "@aigate/engine";
import { DATABASE } from "../../../database.provider.js";
import { SECRET_CIPHER, SecretUnreadableError, type SecretCipherPort } from "../../../secret-cipher.js";
import { mergeHeaders, MAX_NODES, type ApiType, type NodeChanges, type NodeFields, type NodeType } from "../domain/provider-node.js";

// docs/contracts/custom-providers.md.
export interface NodeView {
  id: string;
  type: NodeType;
  // null for an anthropic-compatible node.
  apiType: ApiType | null;
  name: string;
  prefix: string;
  baseUrl: string;
  // Header values may be secrets: a view names each header with a hint of its value, never the value.
  customHeaders: { name: string; hint: string }[];
  retryStreamErrors: boolean;
  createdAt: string;
  updatedAt: string;
}
// A node with its opened header values, for building its descriptor; never sent to the dashboard.
export type StoredNode = NodeView & { headers: Readonly<Record<string, string>> };

const n = providerNodes;
const columns = {
  id: n.id, type: n.type, apiType: n.apiType, name: n.name, prefix: n.prefix, baseUrl: n.baseUrl, customHeadersSealed: n.customHeadersSealed,
  retryStreamErrors: n.retryStreamErrors, createdAt: n.createdAt, updatedAt: n.updatedAt,
};
type Row = { id: string; type: NodeType; apiType: ApiType; name: string; prefix: string; baseUrl: string; customHeadersSealed: string | null;
  retryStreamErrors: boolean; createdAt: Date; updatedAt: Date };

// Authenticated with the sealed value, so the headers only open for this node.
const headersContext = (id: string): string => `provider_nodes:${id}:custom_headers`;
const hintOf = (value: string): string => (value.length > 8 ? `••••${value.slice(-4)}` : "••••");

// Every catalog id and alias, connectable or not: they always win over a custom prefix at /v1, as in 9router.
const RESERVED = new Set(CATALOG.flatMap((p) => [p.id, ...p.aliases]));
export const isReservedPrefix = (prefix: string): boolean => RESERVED.has(prefix);

// A custom provider is served by the catalog adapter of its family; it declares no models. Its custom headers go first,
// so the key and the family's own headers (content type, accept) can never be replaced by one.
// routing.build-url: exactly one trailing "/" is removed before the path is appended.
export function nodeDescriptor(node: StoredNode): ProviderDescriptor {
  const base = node.baseUrl.replace(/\/$/, "");
  const shared = { id: node.id, name: node.name, modelsUrl: `${base}/models`, aliases: [], models: [], ...(node.retryStreamErrors ? { retryStreamErrors: true } : {}) };
  if (node.type === "openai-compatible") {
    // connection.provider-node-api-type: the stored apiType picks the endpoint and the adapter.
    const responses = node.apiType === "responses";
    return {
      ...shared, protocol: responses ? "openai-responses" : "openai-compatible", chatUrl: `${base}${responses ? "/responses" : "/chat/completions"}`,
      headers: { ...node.headers }, auth: { kind: "api-key", header: "authorization", scheme: "bearer" },
    };
  }
  // connection.anthropic-compatible-node: 9router calls a host official when the URL merely contains api.anthropic.com.
  return {
    ...shared, protocol: "anthropic", chatUrl: `${base}/messages`, headers: { "anthropic-version": ANTHROPIC_VERSION, ...node.headers },
    auth: { kind: "api-key", header: "x-api-key", scheme: "raw" }, anthropicNode: { official: node.baseUrl.includes("api.anthropic.com") },
  };
}

@Injectable()
export class ProviderNodesRepository {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipherPort,
  ) {}

  async list(): Promise<NodeView[]> {
    const rows = await this.database.db.select(columns).from(n).orderBy(asc(n.createdAt)).limit(MAX_NODES);
    return rows.map((row) => this.view(row, this.readableHeaders(row)));
  }

  async get(id: string): Promise<NodeView | undefined> {
    const row = await this.database.db.select(columns).from(n).where(eq(n.id, id)).get();
    return row ? this.view(row, this.readableHeaders(row)) : undefined;
  }

  async stored(id: string): Promise<StoredNode | undefined> {
    const row = await this.database.db.select(columns).from(n).where(eq(n.id, id)).get();
    return row ? this.open(row) : undefined;
  }

  // One indexed lookup on the /v1 path, only for a prefix that names no built-in provider. Prefixes may repeat;
  // as in 9router, OpenAI-compatible nodes are searched before Anthropic-compatible ones, and the oldest wins.
  async byPrefix(prefix: string): Promise<StoredNode | undefined> {
    const row = await this.database.db.select(columns).from(n).where(eq(n.prefix, prefix))
      .orderBy(sql`${n.type} <> 'openai-compatible'`, asc(n.createdAt)).limit(1).get();
    return row ? this.open(row) : undefined;
  }

  // The count and the insert share one transaction.
  create(fields: NodeFields): Promise<NodeView | "limit"> {
    return this.database.db.transaction(async (tx) => {
      const total = await tx.select({ n: count() }).from(n).get();
      if ((total?.n ?? 0) >= MAX_NODES) return "limit";
      const now = new Date();
      // 9router ids: openai-compatible-<apiType>-<id> (not renamed when apiType changes), anthropic-compatible-<id>.
      const kind = fields.type === "openai-compatible" ? `${fields.type}-${fields.apiType}` : fields.type;
      const id = `${kind}-${randomBytes(6).toString("hex")}`;
      const headers = Object.fromEntries(fields.customHeaders.map((header) => [header.name, header.value ?? ""]));
      const [row] = await tx.insert(n).values({
        id, type: fields.type, apiType: fields.apiType, name: fields.name, prefix: fields.prefix, baseUrl: fields.baseUrl,
        customHeadersSealed: this.seal(id, headers), retryStreamErrors: fields.retryStreamErrors, createdAt: now, updatedAt: now,
      }).returning(columns);
      if (!row) throw new Error("insert returned no row");
      return this.view(row, headers);
    });
  }

  // The stored headers are read, merged and written in one transaction; a header without a value keeps its old one.
  update(id: string, changes: NodeChanges): Promise<NodeView | undefined | { error: string }> {
    return this.database.db.transaction(async (tx) => {
      const current = await tx.select(columns).from(n).where(eq(n.id, id)).get();
      if (!current) return undefined;
      const { customHeaders, ...rest } = changes;
      let headers = this.readableHeaders(current);
      if (customHeaders !== undefined) {
        const merged = mergeHeaders(customHeaders, headers);
        if (!merged.ok) return { error: merged.message };
        headers = merged.value;
      }
      const sealed = customHeaders === undefined ? {} : { customHeadersSealed: this.seal(id, headers) };
      const [row] = await tx.update(n).set({ ...rest, ...sealed, updatedAt: new Date() }).where(eq(n.id, id)).returning(columns);
      return row ? this.view(row, headers) : undefined;
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

  private seal(id: string, headers: Readonly<Record<string, string>>): string | null {
    return Object.keys(headers).length > 0 ? this.cipher.seal(JSON.stringify(headers), headersContext(id)) : null;
  }

  // Throws SecretUnreadableError when the secret key changed since the headers were saved.
  private headers(row: Row): Record<string, string> {
    if (!row.customHeadersSealed) return {};
    const parsed: unknown = JSON.parse(this.cipher.open(row.customHeadersSealed, headersContext(row.id)));
    if (typeof parsed !== "object" || parsed === null) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  }

  // For the dashboard: headers sealed under an older secret key show as none, so the user can enter them again; routing
  // still refuses them (stored, byPrefix).
  private readableHeaders(row: Row): Record<string, string> {
    try {
      return this.headers(row);
    } catch (error) {
      if (error instanceof SecretUnreadableError) return {};
      throw error;
    }
  }

  private open(row: Row): StoredNode {
    const headers = this.headers(row);
    return { ...this.view(row, headers), headers };
  }

  private view(row: Row, headers: Readonly<Record<string, string>>): NodeView {
    return {
      id: row.id, type: row.type, apiType: row.type === "openai-compatible" ? row.apiType : null, name: row.name, prefix: row.prefix, baseUrl: row.baseUrl,
      customHeaders: Object.entries(headers).map(([name, value]) => ({ name, hint: hintOf(value) })), retryStreamErrors: row.retryStreamErrors,
      createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    };
  }
}
