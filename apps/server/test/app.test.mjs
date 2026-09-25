import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "../dist/server.js";

async function start(webDist) {
  const app = await createServer(webDist);
  await app.init();
  const fastify = app.getHttpAdapter().getInstance();
  await fastify.ready();
  return { app, get: (url, method = "GET") => fastify.inject({ method, url }) };
}

test("GET /health returns ok", async () => {
  const { app, get } = await start();
  try {
    const res = await get("/health");
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { status: "ok" });
  } finally {
    await app.close();
  }
});

test("serves the built web app on the same port with an SPA fallback", async () => {
  const webDist = await mkdtemp(join(tmpdir(), "aigate-web-"));
  await mkdir(join(webDist, "assets"));
  await writeFile(join(webDist, "index.html"), "<html>aigate</html>");
  await writeFile(join(webDist, "assets", "app.js"), "console.log(1)");
  const { app, get } = await start(webDist);
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
    await rm(webDist, { recursive: true });
  }
});
