// Contract: docs/contracts/settings.md
import { test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { settings } from "@aigate/database";
import { DATABASE } from "../dist/database.provider.js";
import { boot, setUp, withTempDb } from "./helpers.mjs";

async function signedIn(file, run) {
  const { app, call } = await boot(file);
  try {
    const status = (await call({ url: "/api/auth/status" })).json();
    const cookie = status.setupRequired
      ? await setUp(call)
      : (await call({ method: "POST", url: "/api/auth/login", body: { password: "correct horse battery" } })).headers["set-cookie"].split(";")[0];
    const request = (method, payload) => call({ method, url: "/api/settings", cookie, body: payload });
    await run(request);
  } finally {
    await app.close();
  }
}

test("GET returns every setting with its default and no-store", () =>
  withTempDb((file) => signedIn(file, async (request) => {
    const res = await request("GET");
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { requireLogin: true, requireApiKey: true, fallbackStrategy: "fill-first", comboStickyLimit: 1,
      tokenSaverEnabled: true, rtkEnabled: true, headroomEnabled: false, headroomUrl: "http://127.0.0.1:8787", headroomCompressUserMessages: false, headroomTimeoutMs: 3000,
      cavemanEnabled: false, cavemanLevel: "full", ponytailEnabled: false, ponytailLevel: "full", pxpipeEnabled: false, pxpipeMinChars: 25000, pxpipeTimeoutMs: 15000 });
    assert.equal(res.headers["cache-control"], "no-store");
  })));

test("PATCH applies, shows on the next GET, and survives a restart", () =>
  withTempDb(async (file) => {
    await signedIn(file, async (request) => {
      const res = await request("PATCH", { requireApiKey: false });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.json(), { requireLogin: true, requireApiKey: false, fallbackStrategy: "fill-first", comboStickyLimit: 1,
        tokenSaverEnabled: true, rtkEnabled: true, headroomEnabled: false, headroomUrl: "http://127.0.0.1:8787", headroomCompressUserMessages: false, headroomTimeoutMs: 3000,
        cavemanEnabled: false, cavemanLevel: "full", ponytailEnabled: false, ponytailLevel: "full", pxpipeEnabled: false, pxpipeMinChars: 25000, pxpipeTimeoutMs: 15000 });
      assert.equal((await request("GET")).json().requireApiKey, false);
      assert.deepEqual((await request("PATCH", {})).json(), { requireLogin: true, requireApiKey: false, fallbackStrategy: "fill-first", comboStickyLimit: 1,
        tokenSaverEnabled: true, rtkEnabled: true, headroomEnabled: false, headroomUrl: "http://127.0.0.1:8787", headroomCompressUserMessages: false, headroomTimeoutMs: 3000,
        cavemanEnabled: false, cavemanLevel: "full", ponytailEnabled: false, ponytailLevel: "full", pxpipeEnabled: false, pxpipeMinChars: 25000, pxpipeTimeoutMs: 15000 }, "empty patch is a no-op");
    });
    await signedIn(file, async (request) => {
      assert.equal((await request("GET")).json().requireApiKey, false);
    });
  }));

test("PATCH rejects unknown, secret, and wrongly typed keys without changing anything", () =>
  withTempDb((file) => signedIn(file, async (request) => {
    const cases = [
      [{ requireApiKey: false, password: "x" }, ["password"]],
      [{ mitmSudoEncrypted: "x" }, ["mitmSudoEncrypted"]],
      [{ requireLogin: "false" }, ["requireLogin"]],
      [{ headroomUrl: "javascript:alert(1)" }, ["headroomUrl"]],
      [{ headroomTimeoutMs: 100 }, ["headroomTimeoutMs"]],
      [{ cavemanLevel: "wenyan" }, ["cavemanLevel"]],
      [{ somethingNew: 1 }, ["somethingNew"]],
      // Boolean values, so only the allowlist (not the type check) can reject these.
      [{ somethingNew: true }, ["somethingNew"]],
      [{ id: true }, ["id"]],
      [[{ requireLogin: false }], []],
      ["true", []],
    ];
    for (const [body, keys] of cases) {
      const res = await request("PATCH", body);
      assert.equal(res.statusCode, 400, JSON.stringify(body));
      assert.equal(res.json().code, "INVALID_REQUEST");
      assert.deepEqual(res.json().keys, keys, JSON.stringify(body));
    }
    assert.equal((await request("GET")).json().requireApiKey, true, "nothing changed");
  })));

test("portable settings: safe export, preview, validation, merge and atomic stale-import refusal", () =>
  withTempDb(async (file) => {
    const { app, call } = await boot(file, { usageTimezone: "UTC", usageRetentionDays: 31 });
    try {
      assert.equal((await call({ url: "/api/settings/export" })).statusCode, 401);
      assert.equal((await call({ url: "/api/settings/runtime" })).statusCode, 401);
      for (const url of ["/api/settings/import/preview", "/api/settings/import"]) {
        assert.equal((await call({ method: "POST", url, body: {} })).statusCode, 401);
      }
      const cookie = await setUp(call);
      const dash = (request) => call({ ...request, cookie });
      await dash({ method: "PATCH", url: "/api/settings", body: { headroomUrl: "https://helper.example/compress?token=do-not-export" } });
      const exported = await dash({ url: "/api/settings/export" });
      const document = exported.json();
      assert.equal(exported.headers["cache-control"], "no-store");
      assert.match(exported.headers["content-disposition"], /aigate-settings.json/);
      assert.deepEqual([document.format, document.version], ["aigate-settings", 1]);
      assert.deepEqual(Object.keys(document.settings).sort(), [
        "requireLogin", "requireApiKey", "fallbackStrategy", "comboStickyLimit", "tokenSaverEnabled", "rtkEnabled",
        "headroomEnabled", "headroomCompressUserMessages", "headroomTimeoutMs", "cavemanEnabled", "cavemanLevel",
        "ponytailEnabled", "ponytailLevel", "pxpipeEnabled", "pxpipeMinChars", "pxpipeTimeoutMs",
      ].sort(), "only the 16 transferable keys are exported");
      assert.ok(!exported.body.includes("headroomUrl") && !exported.body.includes("do-not-export"));
      const runtime = (await dash({ url: "/api/settings/runtime" })).json();
      assert.deepEqual([runtime.usageTimezone, runtime.usageRetentionDays, runtime.dailyRetentionDays, runtime.port], ["UTC", 31, 400, null]);
      assert.ok(!JSON.stringify(runtime).includes("do-not-export"));

      const partial = { format: "aigate-settings", version: 1, settings: { comboStickyLimit: 8 } };
      const previewResponse = await dash({ method: "POST", url: "/api/settings/import/preview", body: partial });
      assert.equal(previewResponse.statusCode, 200, previewResponse.body);
      assert.equal(previewResponse.headers["cache-control"], "no-store");
      const preview = previewResponse.json();
      assert.deepEqual(preview.changes, [{ key: "comboStickyLimit", before: 1, after: 8 }]);
      assert.equal((await dash({ url: "/api/settings" })).json().comboStickyLimit, 1, "preview does not write");
      const imported = await dash({ method: "POST", url: "/api/settings/import", body: { document: partial, expectedVersion: preview.version } });
      assert.equal(imported.statusCode, 200, imported.body);
      assert.equal(imported.headers["cache-control"], "no-store");
      assert.equal(imported.json().comboStickyLimit, 8);
      assert.equal(imported.json().headroomUrl, "https://helper.example/compress?token=do-not-export", "omitted service URL stays on the target");
      const stale = await dash({ method: "POST", url: "/api/settings/import", body: { document: partial, expectedVersion: preview.version } });
      assert.deepEqual([stale.statusCode, stale.json().code], [409, "SETTINGS_CHANGED"]);

      for (const invalid of [
        { ...partial, version: 2 }, { ...partial, format: "9router" }, { ...partial, extra: true },
        { ...partial, settings: {} }, { ...partial, settings: { password: "x" } },
        { ...partial, settings: { headroomUrl: "https://helper.example" } },
        { ...partial, settings: { comboStickyLimit: 0 } }, { ...partial, padding: "x".repeat(65_536) },
      ]) {
        const answer = await dash({ method: "POST", url: "/api/settings/import/preview", body: invalid });
        assert.deepEqual([answer.statusCode, answer.json().code], [400, "INVALID_REQUEST"]);
      }
      assert.equal((await dash({ url: "/api/settings" })).json().comboStickyLimit, 8, "invalid documents change nothing");
      for (const body of [null, [], {}, { document: partial, expectedVersion: "bad-version" },
        { document: partial, expectedVersion: preview.version, extra: true }]) {
        const answer = await dash({ method: "POST", url: "/api/settings/import", body });
        assert.deepEqual([answer.statusCode, answer.json().code], [400, "INVALID_REQUEST"]);
      }

      const reviewed = (await dash({ method: "POST", url: "/api/settings/import/preview", body: partial })).json();
      // Simulate a write after the cached version was reviewed; SQL must guard even if the cache is stale.
      await app.get(DATABASE).db.update(settings).set({ comboStickyLimit: 9 }).where(eq(settings.id, 1));
      const raced = await dash({ method: "POST", url: "/api/settings/import", body: { document: partial, expectedVersion: reviewed.version } });
      assert.deepEqual([raced.statusCode, raced.json().code], [409, "SETTINGS_CHANGED"]);
      assert.equal((await dash({ url: "/api/settings" })).json().comboStickyLimit, 9);
    } finally { await app.close(); }
  }));
