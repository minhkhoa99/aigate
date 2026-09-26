import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const TEST_STATUSES = ["untested", "active", "invalid", "no_quota", "unreachable"] as const;
export type TestStatus = (typeof TEST_STATUSES)[number];

// docs/contracts/connections.md. SP11: one API-key account per provider (unique provider).
export const providerConnections = sqliteTable(
  "provider_connections",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull().unique(),
    name: text("name").notNull(),
    // SecretCipherPort output (v1.<base64url>); the plaintext key is never stored.
    apiKeySealed: text("api_key_sealed").notNull(),
    keyHint: text("key_hint").notNull(),
    // SP14d: the connection's own host for providers that take one (ollama-local); null means the catalog URL.
    baseUrl: text("base_url"),
    // SP14g: data the provider URL or headers need (azure deployment, api-version, organization; cloudflare-ai account).
    deployment: text("deployment"),
    apiVersion: text("api_version"),
    organization: text("organization"),
    accountId: text("account_id"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    testStatus: text("test_status", { enum: TEST_STATUSES }).notNull().default("untested"),
    lastError: text("last_error"),
    lastErrorCode: text("last_error_code"),
    lastTestedAt: integer("last_tested_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  () => [check("provider_connections_test_status", sql.raw(`test_status IN (${TEST_STATUSES.map((s) => `'${s}'`).join(", ")})`))],
);

// docs/contracts/custom-providers.md (SP13b, SP14b). OpenAI- or Anthropic-compatible endpoints the user defines;
// a connection under one stores this id as its provider. The prefix is how /v1 names it. Like 9router it may
// repeat (OpenAI-compatible nodes first, then the oldest wins), so it is indexed for the lookup but not unique.
export const providerNodes = sqliteTable("provider_nodes", {
  id: text("id").primaryKey(),
  type: text("type", { enum: ["openai-compatible", "anthropic-compatible"] }).notNull().default("openai-compatible"),
  // SP14c: the OpenAI API an openai-compatible node speaks; unused (left "chat") for anthropic-compatible nodes.
  apiType: text("api_type", { enum: ["chat", "responses"] }).notNull().default("chat"),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  baseUrl: text("base_url").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (t) => [index("provider_nodes_prefix_idx").on(t.prefix, t.createdAt)]);
