import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// docs/contracts/identity-apikeys.md. Instants are UTC epoch milliseconds.
export const dashboardPassword = sqliteTable(
  "dashboard_password",
  {
    id: integer("id").primaryKey(),
    // scrypt$<N>$<r>$<p>$<salt>$<hash>, base64url parts; never a plaintext password.
    hash: text("hash").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [check("dashboard_password_single_row", sql`${table.id} = 1`)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    // SHA-256 of the random cookie token; the token itself is never stored.
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("sessions_expires_at").on(table.expiresAt), index("sessions_created_at").on(table.createdAt)],
);
