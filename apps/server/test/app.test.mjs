import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { createServer, DATABASE } from "../dist/server.js";

async function start(webDist) {
  const dataDir = await mkdtemp(join(tmpdir(), "aigate-server-"));
  const app = await createServer({ databaseFile: join(dataDir, "aigate.db"), webDist });
  await app.init();
  const fastify = app.getHttpAdapter().getInstance();
  await fastify.ready();
  return {
    app,
    get: (url, method = "GET") => fastify.inject({ method, url }),
    // Windows can hold the database file briefly after close; cleanup is best effort.
    cleanup: () => rm(dataDir, { recursive: true, force: true }).catch(() => undefined),
  };
}

test("GET /health returns ok when the database answers", async () => {
  const { app, get, cleanup } = await start();
  try {
    const res = await get("/health");
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { status: "ok" });
  } finally {
    await app.close();
    await cleanup();
  }
});

test("GET /health returns 503 when the database is gone, and app.close() closes it", async () => {
  const { app, get, cleanup } = await start();
  const database = app.get(DATABASE);
  try {
    await database.close();
    const res = await get("/health");
    assert.equal(res.statusCode, 503);
    assert.equal(res.json().status, "unavailable");
  } finally {
    await app.close().catch(() => undefined);
    await cleanup();
  }

  const second = await start();
  const handle = second.app.get(DATABASE);
  await second.app.close();
  await assert.rejects(() => handle.db.run(sql`select 1`), "database closed with the app");
  await second.cleanup();
});

test("serves the built web app on the same port with an SPA fallback", async () => {
  const webDist = await mkdtemp(join(tmpdir(), "aigate-web-"));
  await mkdir(join(webDist, "assets"));
  await writeFile(join(webDist, "index.html"), "<html>aigate</html>");
  await writeFile(join(webDist, "assets", "app.js"), "console.log(1)");
  const { app, get, cleanup } = await start(webDist);
  try {
    for (const url of ["/", "/traffic/requests", "/traffic/requests?id=1"]) {
      const res = await get(url);
      assert.equal(res.statusCode, 200, url);
      assert.match(res.body, /aigate/, url);
    }
    assert.equal((await get("/assets/app.js")).statusCode, 200);
    assert.equal((await get("/health")).json().status, "ok");
    for (const url of ["/assets/missing.js", "/v1/nope", "/api/nope", "/v1beta/models"]) {
      const res = await get(url);
      assert.equal(res.statusCode, 404, url);
      assert.match(res.headers["content-type"], /json/, url);
    }
    assert.equal((await get("/traffic", "POST")).statusCode, 404);
  } finally {
    await app.close();
    await cleanup();
    await rm(webDist, { recursive: true });
  }
});
