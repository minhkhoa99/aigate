import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gt, lte, notInArray } from "drizzle-orm";
import { dashboardPassword, sessions, type DatabaseHandle } from "@aigate/database";
import { DATABASE } from "../../../database.provider.js";
import { SESSION_TTL_MS } from "./session-cookie.js";

const ROW_ID = 1;
// Retention (conventions §10): expired sessions go on every login; at most this many survive.
const MAX_SESSIONS = 20;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

@Injectable()
export class IdentityRepository {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  async passwordHash(): Promise<string | undefined> {
    const row = await this.database.db.select({ hash: dashboardPassword.hash }).from(dashboardPassword)
      .where(eq(dashboardPassword.id, ROW_ID)).get();
    return row?.hash;
  }

  // Resolves false when a password already exists; the single-row primary key settles races.
  async createPassword(hash: string): Promise<boolean> {
    const inserted = await this.database.db.insert(dashboardPassword).values({ id: ROW_ID, hash, updatedAt: new Date() })
      .onConflictDoNothing().returning({ id: dashboardPassword.id });
    return inserted.length === 1;
  }

  // One atomic batch, so no old session survives a successful password change.
  async replacePasswordAndRevokeSessions(hash: string): Promise<void> {
    const { db } = this.database;
    await db.batch([db.update(dashboardPassword).set({ hash, updatedAt: new Date() }).where(eq(dashboardPassword.id, ROW_ID)), db.delete(sessions)]);
  }

  async clearPasswordAndSessions(): Promise<void> {
    const { db } = this.database;
    await db.batch([db.delete(dashboardPassword), db.delete(sessions)]);
  }

  // Returns the cookie token; only its hash is stored.
  async createSession(): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    const now = Date.now();
    const { db } = this.database;
    const newest = db.select({ id: sessions.id }).from(sessions).orderBy(desc(sessions.createdAt)).limit(MAX_SESSIONS);
    await db.batch([
      db.delete(sessions).where(lte(sessions.expiresAt, new Date(now))),
      db.insert(sessions).values({ id: randomUUID(), tokenHash: sha256(token), createdAt: new Date(now), expiresAt: new Date(now + SESSION_TTL_MS) }),
      db.delete(sessions).where(notInArray(sessions.id, newest)),
    ]);
    return token;
  }

  async isSessionValid(token: string): Promise<boolean> {
    const row = await this.database.db.select({ id: sessions.id }).from(sessions)
      .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date()))).get();
    return row !== undefined;
  }

  async deleteSession(token: string): Promise<void> {
    await this.database.db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  }
}
