// The 13 golden scenarios (spec §8.4; .agents/skills/porting-behavior-not-code/golden-scenarios.md) on the
// /v1 chat lane. Each asserts what a client can observe
// (status, error code, body, stream shape) and how many upstream attempts were made — never calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EngineError } from "@aigate/engine";
import { withTempDb } from "./helpers.mjs";
import { SECRET, chunk, completion, errorOf, fakeUpstream, frames, hello, json, listening, openStream, ready, sse } from "./lane-helpers.mjs";
import { UsageRecorder } from "../dist/modules/usage/infrastructure/usage-recorder.js";

const stream = { ...hello, stream: true, stream_options: { include_usage: true } };
const text = (out) => out.filter((f) => f !== "[DONE]" && typeof f.choices?.[0]?.delta?.content === "string").map((f) => f.choices[0].delta.content).join("");

test("golden: normal completion — 200, translated body, usage once", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(json(200, completion));
    const { app, chat } = await ready(file, upstream);
    const res = await chat(hello);
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().choices[0].message.content, "Hello!");
    assert.deepEqual(res.json().usage, { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 });
    assert.equal(upstream.calls.length, 1);
    await app.close();
  }));

test("golden: stream completion — every chunk in order, a terminal event, usage once", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(sse([chunk({ role: "assistant" }), chunk({ content: "A" }), chunk({ content: "B" }), chunk({ content: "C" }), chunk({}, { finish_reason: "stop" }), { choices: [], usage: { prompt_tokens: 1, completion_tokens: 3 } }, "[DONE]"]));
    const { app, chat } = await ready(file, upstream);
    const out = frames((await chat(stream)).body);
    assert.equal(text(out), "ABC");
    assert.equal(out.at(-1), "[DONE]");
    assert.equal(out.filter((f) => f !== "[DONE]" && f.usage).length, 1);
    await app.close();
  }));

test("golden: provider timeout — TIMEOUT, and no second attempt", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(new EngineError("TIMEOUT", "api.openai.com did not finish within 300000 ms", { host: "api.openai.com" }), json(200, completion));
    const { app, chat } = await ready(file, upstream);
    assert.deepEqual(errorOf(await chat(hello)), { status: 504, code: "timeout", type: "timeout_error" });
    assert.equal(upstream.calls.length, 1, "a timeout is not retried in place");
    await app.close();
  }));

test("golden: rate limit — RATE_LIMIT, no blind retry (next candidate: SP17)", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(json(429, { error: { message: "Rate limit reached", code: "rate_limit_exceeded" } }), json(200, completion));
    const { app, chat } = await ready(file, upstream);
    assert.deepEqual(errorOf(await chat(hello)), { status: 429, code: "rate_limit_exceeded", type: "rate_limit_error" });
    assert.equal(upstream.calls.length, 1);
    await app.close();
  }));

test("golden: quota exhausted — QUOTA_EXHAUSTED, the account is not retried (skip until reset: SP17)", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(json(429, { error: { message: "You exceeded your current quota", type: "insufficient_quota", code: "insufficient_quota" } }), json(200, completion));
    const { app, chat } = await ready(file, upstream);
    assert.deepEqual(errorOf(await chat(hello)), { status: 429, code: "insufficient_quota", type: "insufficient_quota" });
    assert.equal(upstream.calls.length, 1);
    await app.close();
  }));

test("golden: invalid credentials — AUTH_ERROR, no retry with the same credential", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(json(401, { error: { message: "Incorrect API key provided" } }), json(200, completion));
    const { app, chat } = await ready(file, upstream);
    assert.deepEqual(errorOf(await chat(hello)), { status: 502, code: "upstream_auth_error", type: "upstream_auth_error" });
    assert.equal(upstream.calls.length, 1);
    await app.close();
  }));

test("golden: token refresh — one refresh, request succeeds, new token persists", () =>
  withTempDb(async (file) => {
    const token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJnb2xkZW4ifQ.sig";
    const fresh = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJyZWZyZXNoZWQifQ.sig";
    const upstream = fakeUpstream(
      json(200, { data: { accessToken: fresh, refreshToken: "rt-new", expiresAt: new Date(Date.now() + 3_600_000).toISOString() } }),
      json(200, completion), json(200, completion),
    );
    const { app, dash, chat } = await ready(file, upstream);
    const code = Buffer.from(JSON.stringify({ accessToken: token, refreshToken: "rt-old", email: "golden@example.test", expiresAt: new Date(Date.now() + 60_000).toISOString() })).toString("base64");
    assert.equal((await dash({ method: "POST", url: "/api/oauth/cline/exchange", body: { code, redirectUri: "http://cb" } })).statusCode, 200);
    const request = { ...hello, model: "cline/anthropic/claude-sonnet-4.6" };
    assert.equal((await chat(request)).statusCode, 200);
    assert.equal((await chat(request)).statusCode, 200);
    assert.equal(upstream.calls.filter(({ request }) => request.url.endsWith("/auth/refresh")).length, 1);
    assert.deepEqual(upstream.calls.slice(1).map(({ request }) => request.headers.authorization), [`Bearer workos:${fresh}`, `Bearer workos:${fresh}`]);
    assert.ok(Date.parse((await dash({ url: "/api/connections" })).json().find((row) => row.provider === "cline").expiresAt) > Date.now() + 3_000_000);
    await app.close();
  }));

test("golden: account failover — the second account serves a rejected first account", () =>
  withTempDb(async (file) => {
    const backup = "sk-golden-backup-9876";
    const upstream = fakeUpstream(json(401, { error: { message: "bad key" } }), json(200, completion));
    const { app, dash, chat } = await ready(file, upstream);
    assert.equal((await dash({ method: "POST", url: "/api/connections", body: { provider: "openai", apiKey: backup } })).statusCode, 201);
    const result = await chat(hello);
    assert.deepEqual([result.statusCode, result.json().choices[0].message.content], [200, "Hello!"]);
    assert.deepEqual(upstream.calls.map(({ request }) => request.headers.authorization), [`Bearer ${SECRET}`, `Bearer ${backup}`]);
    await app.close();
  }));

test("golden: provider fallback — another provider serves the request and both attempts are recorded", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(json(429, { error: { message: "rate limit" } }), json(200, completion));
    const { app, dash, chat } = await ready(file, upstream);
    assert.equal((await dash({ method: "POST", url: "/api/connections", body: { provider: "deepseek", apiKey: "sk-deepseek-golden-1234" } })).statusCode, 201);
    assert.equal((await dash({ method: "POST", url: "/api/combos", body: { name: "golden-fallback", models: ["deepseek/deepseek-chat", "openai/gpt-4.1"] } })).statusCode, 201);
    const result = await chat({ ...hello, model: "golden-fallback" });
    assert.deepEqual([result.statusCode, result.json().choices[0].message.content], [200, "Hello!"]);
    assert.deepEqual(upstream.calls.map(({ request }) => new URL(request.url).host), ["api.deepseek.com", "api.openai.com"]);
    await app.get(UsageRecorder).flush();
    const [row] = (await dash({ url: "/api/requests?limit=1" })).json().items;
    assert.equal(row.attempts, 2);
    assert.deepEqual((await dash({ url: `/api/requests/${row.id}` })).json().attempts.map(({ provider, status }) => [provider, status]), [["deepseek", "error"], ["openai", "success"]]);
    await app.close();
  }));

test("golden: client cancellation — upstream aborted, no further attempts", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(sse([chunk({ content: "first" })], { hang: true }));
    const { app, key, port } = await listening(file, upstream);
    const res = await openStream(port, key);
    await new Promise((resolve) => res.once("data", resolve));
    res.destroy();
    const ctx = upstream.calls[0].ctx;
    for (let i = 0; i < 50 && !ctx.signal.aborted; i++) await new Promise((r) => setTimeout(r, 20));
    assert.equal(ctx.signal.aborted, true);
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(upstream.calls.length, 1, "no attempt after the client left");
    await app.close();
  }));

test("golden: partial stream failure — an error event, no [DONE], no retry", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(sse([chunk({ content: "Once upon" })]), json(200, completion));
    const { app, chat } = await ready(file, upstream);
    const res = await chat(stream);
    assert.equal(res.statusCode, 200);
    const out = frames(res.body);
    assert.equal(text(out), "Once upon");
    assert.equal(out.at(-1).error.code, "provider_unavailable");
    assert.ok(!out.includes("[DONE]"));
    assert.equal(upstream.calls.length, 1);
    await app.close();
  }));

test("golden: model unavailable — MODEL_UNAVAILABLE without calling any upstream", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream();
    const { app, chat } = await ready(file, upstream);
    assert.equal(errorOf(await chat({ ...hello, model: "no-such-model" })).code, "model_not_found");
    const audio = await chat({ ...hello, messages: [{ role: "user", content: [{ type: "input_audio", input_audio: { data: "AA", format: "wav" } }] }] });
    assert.equal(errorOf(audio).code, "model_not_found", "no candidate offers the capability");
    assert.equal(upstream.calls.length, 0);
    await app.close();
  }));

test("golden: all providers unavailable — last classified error, attempts bounded", () =>
  withTempDb(async (file) => {
    const down = () => json(503, { error: { message: "overloaded" } });
    const upstream = fakeUpstream(down(), down(), down(), json(200, completion));
    const { app, chat } = await ready(file, upstream);
    assert.deepEqual(errorOf(await chat(hello)), { status: 502, code: "provider_unavailable", type: "api_error" });
    assert.equal(upstream.calls.length, 3, "the in-place retry budget bounds the attempts (one candidate in M1)");
    await app.close();
  }));
