// docs/contracts/overview.md: summary semantics and live-stream shutdown.
import { test } from "node:test";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { usageRequests } from "@aigate/database";
import { DATABASE } from "../dist/database.provider.js";
import { OverviewRepository, OVERVIEW_DAY_MS } from "../dist/modules/usage/infrastructure/overview.repo.js";
import { UsageRecorder } from "../dist/modules/usage/infrastructure/usage-recorder.js";
import { ConnectionsRepository } from "../dist/modules/connections/infrastructure/connections.repo.js";
import { PASSWORD, sessionCookie, withTempDb } from "./helpers.mjs";
import { ready, listening, fakeUpstream, json, completion, hello } from "./lane-helpers.mjs";

test("overview: client totals vs fallback attempts, bounded windows, auth, real locks and no vendor polling", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(json(429, { error: { message: "rate limit", type: "rate_limit" } }), json(200, completion));
    const { app, call, dash, chat, connection } = await ready(file, upstream, { usageFlushIntervalMs: 3_600_000 });
    try {
      assert.equal((await call({ url: "/api/overview/summary" })).statusCode, 401);
      const fresh = await dash({ url: "/api/overview/summary" });
      assert.equal(fresh.headers["cache-control"], "no-store");
      assert.deepEqual(fresh.json().current, { requests: 0, errors: 0, tokens: 0, cost: 0, unpriced: 0 });
      assert.equal(fresh.json().providers.find((row) => row.provider === "openai").health, "unknown");
      assert.equal(fresh.json().quotaChecked, 0);
      assert.equal(upstream.calls.length, 0, "Overview must not probe providers or quota");

      await dash({ method: "POST", url: "/api/combos", body: { name: "overview-pair", models: ["openai/gpt-4.1", "openai/gpt-4o"] } });
      assert.equal((await chat({ ...hello, model: "overview-pair" })).statusCode, 200);
      await app.get(UsageRecorder).flush();
      const fallbackOnly = (await dash({ url: "/api/overview/summary" })).json();
      assert.deepEqual([fallbackOnly.current.requests, fallbackOnly.current.errors], [1, 0], "successful fallback is one successful client request");
      assert.deepEqual(fallbackOnly.providers.filter((row) => row.requests).map((row) => [row.requests, row.errors]), [[2, 1]], "provider health counts both upstream attempts");
      assert.equal((await chat({ ...hello, model: "no-such-provider/no-model" })).statusCode, 404);
      await app.get(UsageRecorder).flush();
      const calls = upstream.calls.length;
      const data = (await dash({ url: "/api/overview/summary" })).json();
      assert.equal(data.current.requests, 2, "fallback is one client request; pre-upstream failure also counts");
      assert.equal(data.current.errors, 1);
      assert.equal(data.current.tokens, 5);
      assert.equal(data.previous.requests, 0);
      assert.equal(data.buckets.length, 24);
      assert.equal(data.buckets.reduce((sum, row) => sum + row.requests, 0), 2);
      assert.deepEqual(data.providers.filter((row) => row.requests).map((row) => [row.requests, row.errors]), [[2, 1]]);
      assert.equal(upstream.calls.length, calls);
      assert.ok(!JSON.stringify(data).includes("sk-upstream-secret"));

      const connections = app.get(ConnectionsRepository);
      await connections.lock(connection.id, "some-model", new Date(Date.now() + 60_000));
      const alerts = (await dash({ url: "/api/overview/summary" })).json().attention;
      assert.ok(alerts.some((row) => row.kind === "lock" && row.message.includes("model route")));
      await connections.update(connection.id, { isActive: false });
      const disabled = (await dash({ url: "/api/overview/summary" })).json();
      assert.equal(disabled.enabledConnections, 0);
      assert.equal(disabled.attention.length, 0);

      // Exact half-open boundaries are checked with one fixed repository clock.
      const now = Date.now() - 10 * OVERVIEW_DAY_MS;
      const template = { endpoint: "/v1/embeddings", status: "error", httpStatus: 400, attempts: 0, inputTokens: 0, outputTokens: 0,
        cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, cost: null, unpriced: 0, latencyMs: 1 };
      await app.get(DATABASE).db.insert(usageRequests).values([
        { ...template, id: "before", at: new Date(now - 2 * OVERVIEW_DAY_MS - 1) },
        { ...template, id: "previous", at: new Date(now - 2 * OVERVIEW_DAY_MS) },
        { ...template, id: "shared-boundary", at: new Date(now - OVERVIEW_DAY_MS) },
        { ...template, id: "end", at: new Date(now) },
      ]);
      const hourly = await app.get(OverviewRepository).hourly(now);
      assert.deepEqual(hourly.map((row) => [row.hour, row.requests]).sort((a, b) => a[0] - b[0]), [[0, 1], [24, 1]]);
    } finally { await app.close(); }
  }));

test("overview: server shutdown releases an open live usage socket", () =>
  withTempDb(async (file) => {
    const { app, call, port } = await listening(file, fakeUpstream());
    let response; let closing; let timer;
    try {
      const cookie = sessionCookie(await call({ method: "POST", url: "/api/auth/login", body: { password: PASSWORD } }));
      response = await new Promise((resolve, reject) => {
        const req = httpRequest({ host: "127.0.0.1", port, path: "/api/usage/stream", headers: { cookie } }, resolve);
        req.setTimeout(5000, () => req.destroy(new Error("live handshake timed out")));
        req.on("error", reject); req.end();
      });
      assert.equal(response.statusCode, 200);
      response.resume();
      closing = app.close();
      await Promise.race([closing, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("shutdown waited for the dashboard tab to close")), 2000);
      })]);
    } finally {
      clearTimeout(timer);
      response?.destroy();
      await (closing ?? app.close());
    }
  }));
