import { test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { accountLocks, providerConnections } from "@aigate/database";
import { builtinRegistry } from "@aigate/engine";
import { DATABASE } from "../dist/database.provider.js";
import { SECRET_CIPHER } from "../dist/secret-cipher.js";
import { ConnectionsRepository } from "../dist/modules/connections/infrastructure/connections.repo.js";
import { withTempDb } from "./helpers.mjs";
import { fakeUpstream, ready } from "./lane-helpers.mjs";

test("routing status is authenticated, bounded, read-only and matches live keyless inclusion", () => withTempDb(async file => {
  const upstream = fakeUpstream();
  const { app, call, dash, connection } = await ready(file, upstream);
  try {
    const db = app.get(DATABASE).db;
    const now = Date.now();
    await db.insert(accountLocks).values([
      { connectionId: connection.id, model: "locked", until: new Date(now + 60_000) },
      { connectionId: connection.id, model: "expired", until: new Date(now - 1) },
    ]);
    const before = await db.select().from(accountLocks);
    const accountsBefore = await db.select().from(providerConnections);
    const cipher = app.get(SECRET_CIPHER), originalOpen = cipher.open;
    cipher.open = () => { throw new Error("status decrypted a credential"); };
    assert.equal((await call({ url: "/api/routing/status" })).statusCode, 401);
    const response = await dash({ url: "/api/routing/status" });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.headers["cache-control"], "no-store");
    const status = response.json();
    assert.equal(status.fallbackStrategy, "fill-first");
    assert.equal(status.routes.find(route => route.provider === "openai").activeAccounts, 1);
    for (const provider of builtinRegistry.providers.filter(p => p.auth.kind === "none"))
      assert.ok(status.routes.some(route => route.provider === provider.id), provider.id);
    assert.deepEqual(status.locks.map(lock => lock.model), ["locked"]);
    assert.equal(status.locks[0].connectionId, connection.id);
    assert.equal(status.locks[0].isActive, true);
    const boundary = new Date(now + 60_000);
    assert.equal((await app.get(ConnectionsRepository).routingActiveLocks(boundary)).rows.length, 1, "equal expiry remains locked");
    assert.deepEqual(await db.select().from(accountLocks), before);
    assert.deepEqual(await db.select().from(providerConnections), accountsBefore);
    assert.equal(upstream.calls.length, 0);

    cipher.open = originalOpen;

    const changed = await dash({ method: "PATCH", url: "/api/settings", body: { fallbackStrategy: "round-robin", comboStickyLimit: 5 } });
    assert.equal(changed.statusCode, 200, changed.body);
    const fresh = (await dash({ url: "/api/routing/status" })).json();
    assert.deepEqual([fresh.fallbackStrategy, fresh.comboStickyLimit], ["round-robin", 5]);

    await db.update(providerConnections).set({ isActive: false }).where(eq(providerConnections.id, connection.id));
    const disabled = (await dash({ url: "/api/routing/status" })).json();
    assert.equal(disabled.locks[0].isActive, false);
    assert.equal(disabled.routes.some(route => route.provider === "openai" && route.kind === "account"), false);
  } finally { await app.close(); }
}));

test("routing status caps routes and locks with explicit overflow flags", () => withTempDb(async file => {
  const { app, dash, connection } = await ready(file, fakeUpstream());
  try {
    const db = app.get(DATABASE).db;
    const template = (await db.select().from(providerConnections).limit(1))[0];
    await db.insert(providerConnections).values(Array.from({ length: 101 }, (_, i) => ({
      ...template, id: `route-${i}`, provider: `synthetic-${String(i).padStart(3, "0")}`,
    })));
    await db.insert(accountLocks).values(Array.from({ length: 101 }, (_, i) => ({
      connectionId: connection.id, model: `model-${i}`, until: new Date(Date.now() + 60_000 + i),
    })));
    const response = await dash({ url: "/api/routing/status" });
    assert.equal(response.statusCode, 200, response.body);
    const status = response.json();
    assert.equal(status.routes.length, 100);
    assert.equal(status.routesTruncated, true);
    assert.equal(status.locks.length, 100);
    assert.equal(status.locksTruncated, true);
  } finally { await app.close(); }
}));
