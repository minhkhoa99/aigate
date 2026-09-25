// Contract: docs/contracts/settings.md
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "../dist/server.js";

async function boot(databaseFile) {
  const app = await createServer({ databaseFile });
  await app.init();
  const fastify = app.getHttpAdapter().getInstance();
  await fastify.ready();
  const request = (method, payload, remoteAddress) =>
    fastify.inject({ method, url: "/api/settings", payload, remoteAddress, headers: payload === undefined ? {} : { "content-type": "application/json" } });
  return { app, request };
}

async function withServer(run) {
  const dir = await mkdtemp(join(tmpdir(), "aigate-settings-"));
  const file = join(dir, "aigate.db");
  try {
    await run(file);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

test("GET returns every setting with its default and no-store", () =>
  withServer(async (file) => {
    const { app, request } = await boot(file);
    try {
      const res = await request("GET");
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.json(), { requireLogin: true, requireApiKey: true });
      assert.equal(res.headers["cache-control"], "no-store");
    } finally {
      await app.close();
    }
  }));

test("PATCH applies, shows on the next GET, and survives a restart", () =>
  withServer(async (file) => {
    let { app, request } = await boot(file);
    try {
      const res = await request("PATCH", JSON.stringify({ requireApiKey: false }));
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.json(), { requireLogin: true, requireApiKey: false });
      assert.equal((await request("GET")).json().requireApiKey, false);
      assert.deepEqual((await request("PATCH", "{}")).json(), { requireLogin: true, requireApiKey: false }, "empty patch is a no-op");
    } finally {
      await app.close();
    }
    ({ app, request } = await boot(file));
    try {
      assert.deepEqual((await request("GET")).json(), { requireLogin: true, requireApiKey: false });
    } finally {
      await app.close();
    }
  }));

test("PATCH rejects unknown, secret, and wrongly typed keys without changing anything", () =>
  withServer(async (file) => {
    const { app, request } = await boot(file);
    try {
      const cases = [
        [{ requireApiKey: false, password: "x" }, ["password"]],
        [{ mitmSudoEncrypted: "x" }, ["mitmSudoEncrypted"]],
        [{ requireLogin: "false" }, ["requireLogin"]],
        [{ somethingNew: 1 }, ["somethingNew"]],
        // Boolean values, so only the allowlist (not the type check) can reject these.
        [{ somethingNew: true }, ["somethingNew"]],
        [{ id: true }, ["id"]],
        [[{ requireLogin: false }], []],
        ["true", []],
      ];
      for (const [body, keys] of cases) {
        const res = await request("PATCH", JSON.stringify(body));
        assert.equal(res.statusCode, 400, JSON.stringify(body));
        assert.equal(res.json().code, "INVALID_REQUEST");
        assert.deepEqual(res.json().keys, keys, JSON.stringify(body));
      }
      assert.deepEqual((await request("GET")).json(), { requireLogin: true, requireApiKey: true }, "nothing changed");
    } finally {
      await app.close();
    }
  }));

test("the management API refuses non-loopback clients until sign-in exists", () =>
  withServer(async (file) => {
    const { app, request } = await boot(file);
    try {
      for (const method of ["GET", "PATCH"]) {
        const res = await request(method, method === "PATCH" ? JSON.stringify({ requireApiKey: false }) : undefined, "192.168.1.20");
        assert.equal(res.statusCode, 403, method);
      }
      assert.equal((await request("GET", undefined, "::1")).statusCode, 200, "IPv6 loopback is local");
      assert.equal((await request("GET")).json().requireApiKey, true, "remote PATCH changed nothing");
    } finally {
      await app.close();
    }
  }));
