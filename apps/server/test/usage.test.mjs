// Contract: docs/contracts/usage.md — per-call usage events, the buffered writer, summaries, chart, CSV, stream, pricing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { UsageRecorder } from "../dist/modules/usage/infrastructure/usage-recorder.js";
import { addDays, dayKey, parsePeriod, startOfDay } from "../dist/modules/usage/domain/usage.js";
import { PASSWORD, sessionCookie, withTempDb } from "./helpers.mjs";
import { body, chunk, completion, fakeUpstream, hello, json, listening, openStream, ready, sse } from "./lane-helpers.mjs";

const OPTIONS = { usageFlushIntervalMs: 3_600_000, usageTimezone: "Asia/Ho_Chi_Minh" };
const recorderOf = (app) => app.get(UsageRecorder);
const summary = async (dash, query = "period=today") => (await dash({ url: `/api/usage/summary?${query}` })).json();
// gpt-4.1: $2.50 in, $10 out per 1M.
const GPT41 = (input, output) => (input * 2.5 + output * 10) / 1e6;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const get = (port, path, cookie) => new Promise((resolve, reject) => {
  const req = httpRequest({ host: "127.0.0.1", port, path, headers: { cookie } }, resolve);
  req.on("error", reject);
  req.end();
});

test("domain: days, periods and DST come from the configured zone", () => {
  // 2026-09-30 17:30 UTC is already 1 October in Ho Chi Minh City (UTC+7).
  const at = Date.UTC(2026, 8, 30, 17, 30);
  assert.equal(dayKey(at, "Asia/Ho_Chi_Minh"), "2026-10-01");
  assert.equal(dayKey(at, "UTC"), "2026-09-30");
  assert.equal(startOfDay("2026-10-01", "Asia/Ho_Chi_Minh"), Date.UTC(2026, 8, 30, 17));
  // New York leaves DST on 1 November 2026: that day is 25 hours long.
  assert.equal(startOfDay("2026-11-02", "America/New_York") - startOfDay("2026-11-01", "America/New_York"), 25 * 3_600_000);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.deepEqual(parsePeriod({ period: "7d" }, at, "Asia/Ho_Chi_Minh"), { period: "7d", bucket: "day", fromDay: "2026-09-25", toDay: "2026-10-01" });
  assert.deepEqual(parsePeriod({ period: "today" }, at, "Asia/Ho_Chi_Minh"), { period: "today", bucket: "hour", fromMs: Date.UTC(2026, 8, 30, 17), toMs: at });
  assert.throws(() => parsePeriod({ period: "custom", from: "2025-01-01", to: "2026-03-01" }, at, "UTC"), /at most 400 days/);
  assert.throws(() => parsePeriod({ period: "custom", from: "2026-02-30", to: "2026-03-01" }, at, "UTC"), /YYYY-MM-DD/);
  assert.throws(() => parsePeriod({ period: "week" }, at, "UTC"), /period must be one of/);
});

test("writer: a full queue drops the oldest, a failed batch is counted, and recording never throws", async () => {
  const database = { db: { transaction: async () => { throw new Error("disk full"); }, delete: () => ({ where: async () => undefined }) } };
  const recorder = new UsageRecorder(database, { price: () => ({ price: null, source: "none" }) }, { timezone: "UTC", retentionDays: 90, flushIntervalMs: 3_600_000 });
  const call = { requestId: "r", provider: "openai", model: "gpt-4.1", connectionId: null, apiKeyId: null, endpoint: "/v1/chat/completions" };
  const outcome = { status: "success", errorCode: null, usage: { inputTokens: 1, outputTokens: 1 }, estimated: false, latencyMs: 1, ttftMs: null };
  // The 200th event starts a flush that takes those 200; the next 10 001 overflow the 10 000 cap by one.
  for (let index = 0; index < 10_201; index += 1) recorder.record(call, outcome);
  assert.deepEqual(recorder.writer(), { queued: 10_000, dropped: 1, failed: 0 });
  await recorder.flush();
  const { dropped, failed, queued } = recorder.writer();
  assert.deepEqual({ dropped, queued }, { dropped: 1, queued: 0 });
  assert.ok(failed >= 2, "every failed batch counts");
  recorder.record(call, { ...outcome, usage: undefined });
  assert.equal(recorder.writer().dropped, 2, "a malformed outcome is counted as dropped, never thrown to the lane");
});

test("chat lane: one event per upstream call, no dedup, cost, key and endpoint, combos, summary, chart, CSV", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(
      json(200, completion), json(200, completion),
      json(429, { error: { message: "Rate limit reached for gpt-4.1", type: "rate_limit" } }), json(200, { ...completion, model: "gpt-4o" }),
      sse([chunk({ content: "Hel" }), chunk({ content: "lo" }), { ...chunk({}, { finish_reason: "stop" }), usage: { prompt_tokens: 7, completion_tokens: 5 } }, "[DONE]"]),
    );
    const { app, dash, chat } = await ready(file, upstream, OPTIONS);
    assert.equal((await chat(hello)).statusCode, 200);
    // A second flush adds into the same daily row rather than replacing it.
    await recorderOf(app).flush();
    assert.equal((await chat(hello)).statusCode, 200, "an identical second request is its own event");
    await dash({ method: "POST", url: "/api/combos", body: { name: "pair", models: ["openai/gpt-4.1", "openai/gpt-4o"] } });
    assert.equal((await chat({ ...hello, model: "pair" })).statusCode, 200);
    assert.equal((await chat({ ...hello, stream: true })).statusCode, 200);
    await recorderOf(app).flush();

    const today = await summary(dash);
    assert.equal(today.timezone, "Asia/Ho_Chi_Minh");
    assert.deepEqual([today.totals.requests, today.totals.errors, today.totals.inputTokens, today.totals.outputTokens], [5, 1, 3 + 3 + 3 + 7, 2 + 2 + 2 + 5]);
    const gpt41 = today.byModel.find((row) => row.model === "gpt-4.1");
    assert.deepEqual([gpt41.requests, gpt41.errors, gpt41.providerName], [4, 1, "OpenAI"]);
    assert.ok(Math.abs(gpt41.cost - (GPT41(3, 2) * 2 + GPT41(7, 5))) < 1e-12, `cost ${gpt41.cost}`);
    assert.equal(today.byApiKey[0].name, "client");
    assert.deepEqual(today.byEndpoint.map((row) => [row.endpoint, row.requests]), [["/v1/chat/completions", 5]]);
    assert.equal(today.byAccount[0].name, "OpenAI");
    assert.deepEqual(today.writer, { queued: 0, dropped: 0, failed: 0 });

    const week = await summary(dash, "period=7d");
    assert.equal(week.totals.requests, 5, "the daily rollup adds up to the events");
    const chart = (await dash({ url: "/api/usage/chart?period=7d" })).json();
    assert.deepEqual([chart.bucket, chart.buckets.length, chart.buckets.at(-1).requests, chart.buckets.at(-1).tokens.openai], ["day", 7, 5, 3 + 3 + 3 + 7 + 2 + 2 + 2 + 5]);
    const hourly = (await dash({ url: "/api/usage/chart?period=24h" })).json();
    assert.deepEqual([hourly.bucket, hourly.buckets.length, hourly.buckets.reduce((sum, bucket) => sum + bucket.requests, 0)], ["hour", 24, 5]);

    const csv = await dash({ url: "/api/usage/export.csv?period=7d" });
    assert.match(csv.headers["content-type"], /text\/csv/);
    assert.match(csv.headers["content-disposition"], /attachment; filename="aigate-usage-/);
    assert.deepEqual(csv.body.trim().split("\r\n").map((line) => line.split(",")[2]), ["model", "gpt-4.1", "gpt-4o"]);

    const invalid = await dash({ url: "/api/usage/summary?period=week" });
    assert.deepEqual([invalid.statusCode, invalid.json().code], [400, "INVALID_REQUEST"]);
    assert.equal((await dash({ url: "/api/usage/summary?period=custom&from=2020-01-01&to=2026-01-01" })).statusCode, 400);
    assert.equal((await app.getHttpAdapter().getInstance().inject({ url: "/api/usage/summary" })).statusCode, 401, "the dashboard session guards usage");
  }));

test("pricing: overrides win field by field, validation, reset, unpriced models, retention", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(json(200, completion));
    const { app, dash, chat } = await ready(file, upstream, OPTIONS);
    assert.equal((await dash({ url: "/api/pricing/resolve?provider=openai&model=gpt-4.1" })).json().source, "model");
    const bad = await dash({ method: "PATCH", url: "/api/pricing", body: { openai: { "gpt-4.1": { input: -1 } } } });
    assert.deepEqual([bad.statusCode, bad.json().code], [400, "INVALID_REQUEST"]);
    assert.equal((await dash({ method: "PATCH", url: "/api/pricing", body: { openai: { "gpt-4.1": { bogus: 1 } } } })).statusCode, 400);
    const patched = await dash({ method: "PATCH", url: "/api/pricing", body: { openai: { "gpt-4.1": { output: 100 } } } });
    assert.equal(patched.statusCode, 200, patched.body);
    assert.deepEqual(patched.json().overrides.map((row) => [row.provider, row.model, row.input, row.output]), [["openai", "gpt-4.1", null, 100]]);
    assert.deepEqual((await dash({ url: "/api/pricing/resolve?provider=openai&model=gpt-4.1" })).json(), { price: { input: 2.5, output: 100, cached: 1.25, reasoning: 15, cache_creation: 2.5 }, source: "override" });

    assert.equal((await chat(hello)).statusCode, 200);
    const recorder = recorderOf(app);
    recorder.record({ requestId: "r2", provider: "house", model: "house-model", connectionId: null, apiKeyId: null, endpoint: "/v1/chat/completions" },
      { status: "success", errorCode: null, usage: { inputTokens: 10, outputTokens: 10 }, estimated: false, latencyMs: 5, ttftMs: null });
    await recorder.flush();
    const today = await summary(dash);
    const priced = today.byModel.find((row) => row.model === "gpt-4.1");
    assert.ok(Math.abs(priced.cost - (3 * 2.5 + 2 * 100) / 1e6) < 1e-12, "the override's output rate, the built-in input rate");
    const house = today.byModel.find((row) => row.model === "house-model");
    assert.deepEqual([house.cost, house.unpriced, today.totals.unpriced], [0, 1, 1], "an unpriced model is counted as unpriced, not billed $0 silently");

    const reset = await dash({ method: "DELETE", url: "/api/pricing?provider=openai&model=gpt-4.1" });
    assert.deepEqual(reset.json().overrides, []);
    assert.equal((await dash({ method: "DELETE", url: "/api/pricing?model=gpt-4.1" })).statusCode, 400);

    // Events past retention go; the daily rollup stays for its 400 days.
    await recorder.prune(Date.now() + 91 * 86_400_000);
    assert.equal((await summary(dash)).totals.requests, 0);
    assert.equal((await summary(dash, "period=7d")).totals.requests, 2);
  }));

test("streams: an aborted stream is recorded with an estimate; the live usage stream pushes and caps clients", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream((_request, ctx) => ({ status: 200, headers: { "content-type": "text/event-stream" }, body: body(`data: ${JSON.stringify(chunk({ content: "x".repeat(40) }))}\n\n`, ctx, { hang: true }) }));
    const { app, dash, key, port, call } = await listening(file, upstream, OPTIONS);
    const open = [];
    try {
      const session = sessionCookie(await call({ method: "POST", url: "/api/auth/login", body: { password: PASSWORD } }));
      const live = await get(port, "/api/usage/stream", session);
      open.push(live);
      assert.match(live.headers["content-type"], /text\/event-stream/);
      const pushes = [];
      live.setEncoding("utf8");
      live.on("data", (text) => { for (const frame of text.split("\n\n")) if (frame.startsWith("data: ")) pushes.push(JSON.parse(frame.slice(6))); });
      await wait(50);
      assert.deepEqual(pushes[0].active, [], "the first push arrives on connect");

      const response = await openStream(port, key);
      await new Promise((resolve) => response.once("data", resolve));
      await wait(400);
      assert.ok(pushes.some((push) => push.active.some((entry) => entry.model === "gpt-4.1" && entry.count === 1)), "the running call shows as active");
      response.destroy();
      await wait(200);
      await recorderOf(app).flush();
      const today = await summary(dash);
      assert.deepEqual([today.totals.requests, today.totals.errors, today.totals.outputTokens], [1, 1, 10]);
      const week = await summary(dash, "period=7d");
      assert.deepEqual([week.totals.requests, week.totals.errors], [1, 1], "the rollup counts an aborted call as an error too");
      const recent = recorderOf(app).live().recent[0];
      assert.deepEqual([recent.status, recent.errorCode, recent.estimated, typeof recent.ttftMs], ["aborted", "CLIENT_CLOSED", true, "number"]);

      const extra = [];
      for (let index = 0; index < 16; index += 1) extra.push(await get(port, "/api/usage/stream", session));
      open.push(...extra);
      assert.equal(extra.filter((res) => res.statusCode === 503).length, 1, "the 17th live stream is refused");
    } finally {
      for (const res of open) res.destroy();
      await app.close();
    }
  }));
