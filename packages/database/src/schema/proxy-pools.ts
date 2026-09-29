import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const PROXY_POOL_TYPES = ["http", "vercel", "cloudflare", "deno"] as const;
export type ProxyPoolType = (typeof PROXY_POOL_TYPES)[number];
export const PROXY_POOL_TEST_STATUSES = ["untested", "active", "error"] as const;
export type ProxyPoolTestStatus = (typeof PROXY_POOL_TEST_STATUSES)[number];
export const PROXY_ROTATION_STRATEGIES = ["none", "round-robin", "random"] as const;
export type ProxyRotationStrategy = (typeof PROXY_ROTATION_STRATEGIES)[number];

// docs/contracts/proxy-pools.md. Fields are relational because selection, health, and bindings query them independently.
export const proxyPools = sqliteTable("proxy_pools", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  proxyUrl: text("proxy_url").notNull(),
  noProxy: text("no_proxy").notNull().default(""),
  type: text("type", { enum: PROXY_POOL_TYPES }).notNull().default("http"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  strictProxy: integer("strict_proxy", { mode: "boolean" }).notNull().default(false),
  testStatus: text("test_status", { enum: PROXY_POOL_TEST_STATUSES }).notNull().default("untested"),
  lastTestedAt: integer("last_tested_at", { mode: "timestamp_ms" }),
  lastError: text("last_error"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (t) => [index("proxy_pools_active_updated").on(t.isActive, t.updatedAt)]);

export const providerProxyStrategies = sqliteTable("provider_proxy_strategies", {
  providerId: text("provider_id").primaryKey(),
  rotateStrategy: text("rotate_strategy", { enum: PROXY_ROTATION_STRATEGIES }).notNull().default("none"),
  proxyPoolId: text("proxy_pool_id").references(() => proxyPools.id, { onDelete: "set null" }),
});
