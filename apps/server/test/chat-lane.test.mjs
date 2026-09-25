// Contract: docs/contracts/chat-lane.md — /v1/chat/completions and /v1/models end to end, with a fake upstream.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { chunk, completion, errorOf, fakeUpstream, frames, hello, json, listening, openStream, ready, SECRET, sse } from "./lane-helpers.mjs";

const encoder = new TextEncoder();

test("the key gate runs before the body is read; a valid key gets an OpenAI completion", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(json(200, completion));
    const { app, call, key, chat, raw } = await ready(file, upstream);
    const missing = await call({ method: "POST", url: "/v1/chat/completions", body: hello });
    assert.deepEqual(errorOf(missing), { status: 401, code: "missing_api_key", type: "invalid_request_error" });
    assert.equal(errorOf(await chat(hello, { authorization: "Bearer aigate_wrong" })).code, "invalid_api_key");
    assert.equal((await raw("{not json", { "content-type": "application/json" })).statusCode, 401, "no key: the body is never parsed");
    assert.equal(upstream.calls.length, 0);

    const ok = await chat(hello);
    assert.equal(ok.statusCode, 200);
    assert.match(ok.headers["x-request-id"], /^[0-9a-f-]{36}$/);
    assert.equal(ok.json().object, "chat.completion");
    assert.equal(ok.json().choices[0].message.content, "Hello!");
    assert.deepEqual(ok.json().usage, { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 });
    const sent = upstream.calls[0].request;
    assert.equal(sent.url, "https://api.openai.com/v1/chat/completions");
    assert.equal(sent.headers.authorization, `Bearer ${SECRET}`, "the sealed key is decrypted for the upstream only");
    assert.equal(JSON.parse(sent.body).model, "gpt-4.1");
    assert.equal(JSON.parse(sent.body).stream, false, "an omitted stream flag means JSON");
    assert.ok(!ok.body.includes(SECRET) && !ok.body.includes(key));
    await app.close();
  }));

test("keyless mode serves only this machine", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(json(200, completion));
    const { app, call, dash } = await ready(file, upstream);
    await dash({ method: "PATCH", url: "/api/settings", body: { requireApiKey: false } });
    const post = (extra) => call({ method: "POST", url: "/v1/chat/completions", body: hello, ...extra });
    assert.deepEqual(errorOf(await post({ remoteAddress: "10.0.0.7" })), { status: 403, code: "api_key_required", type: "permission_error" });
    assert.equal(errorOf(await post({ headers: { origin: "https://evil.example" } })).code, "api_key_required", "a cross-site page on this machine");
    assert.equal(errorOf(await post({ headers: { host: "evil.example" } })).code, "api_key_required", "DNS rebinding");
    assert.equal((await post({})).statusCode, 200);
    assert.equal(upstream.calls.length, 1);
    await app.close();
  }));

test("model resolution: bare catalog id, provider prefix, unknown model, no active connection", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(json(200, completion), json(200, completion), json(200, completion));
    const { app, dash, connection, chat } = await ready(file, upstream);
    assert.equal((await chat({ ...hello, model: "openai/gpt-5-mini" })).statusCode, 200, "an undeclared model with a provider prefix");
    assert.equal(JSON.parse(upstream.calls[0].request.body).model, "gpt-5-mini");
    assert.equal((await chat(hello)).statusCode, 200);
    for (const model of ["claude-sonnet", "openai/"]) {
      const res = await chat({ ...hello, model });
      assert.deepEqual([res.statusCode, res.json().error.code], [404, "model_not_found"], model);
      assert.match(res.json().error.message, /openai\//);
    }
    // A catalog provider without a connection, by id, alias, or a bare model id only it declares.
    for (const model of ["deepseek/deepseek-chat", "ds/deepseek-chat", "deepseek-chat"]) {
      const res = await chat({ ...hello, model });
      assert.deepEqual([res.statusCode, res.json().error.code], [404, "no_active_connection"], model);
      assert.match(res.json().error.message, /DeepSeek/);
    }
    const blocked = await chat({ ...hello, model: "claude/claude-sonnet-4" });
    assert.deepEqual([blocked.statusCode, blocked.json().error.code], [400, "provider_not_supported"]);
    assert.match(blocked.json().error.message, /Needs the anthropic adapter/);
    // Once connected, the alias routes to the provider's own chat URL with its own key.
    await dash({ method: "POST", url: "/api/connections", body: { provider: "deepseek", apiKey: "sk-deepseek-key-5555" } });
    assert.equal((await chat({ ...hello, model: "ds/deepseek-chat" })).statusCode, 200);
    assert.equal(upstream.calls[2].request.url, "https://api.deepseek.com/chat/completions");
    assert.equal(upstream.calls[2].request.headers.authorization, "Bearer sk-deepseek-key-5555");
    assert.equal(JSON.parse(upstream.calls[2].request.body).model, "deepseek-chat");
    await dash({ method: "PATCH", url: `/api/connections/${connection.id}`, body: { isActive: false } });
    const off = await chat(hello);
    assert.deepEqual([off.statusCode, off.json().error.code], [404, "no_active_connection"]);
    assert.match(off.json().error.message, /Providers → Connections/);
    assert.equal(upstream.calls.length, 3);
    await app.close();
  }));

test("a bare id declared by several providers goes to the one with an active connection", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(json(200, completion));
    const { app, dash, chat } = await ready(file, upstream);
    // glm-5 is declared by six catalog providers; the message names three and says there are more.
    const none = await chat({ ...hello, model: "glm-5" });
    assert.deepEqual([none.statusCode, none.json().error.code], [404, "no_active_connection"]);
    assert.match(none.json().error.message, /Alibaba Coding, Alibaba, GLM \(China\), …/);
    // A "/" inside a model id is not a provider prefix when no provider has that name.
    const slashed = await chat({ ...hello, model: "zai-org/GLM-5.2" });
    assert.deepEqual([slashed.statusCode, slashed.json().error.code], [404, "no_active_connection"]);
    assert.match(slashed.json().error.message, /Featherless/);
    await dash({ method: "POST", url: "/api/connections", body: { provider: "glm-cn", apiKey: "sk-glm-key-7777" } });
    assert.equal((await chat({ ...hello, model: "glm-5" })).statusCode, 200);
    assert.equal(upstream.calls[0].request.url, "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions", "the third declaring provider, the only one connected");
    assert.equal(JSON.parse(upstream.calls[0].request.body).model, "glm-5");
    await app.close();
  }));

test("every failure before the upstream answers in the OpenAI error shape", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(json(401, { error: { message: "Incorrect API key provided" } }), json(429, { error: { message: "slow down" } }));
    const { app, key, chat, raw } = await ready(file, upstream);
    const auth = { authorization: `Bearer ${key}` };
    assert.deepEqual(errorOf(await raw("{not json", { ...auth, "content-type": "application/json" })), { status: 400, code: "invalid_json", type: "invalid_request_error" });
    assert.equal(errorOf(await raw(JSON.stringify(hello), { ...auth, "content-type": "text/plain" })).code, "unsupported_media_type");
    assert.equal(errorOf(await raw(JSON.stringify({ ...hello, pad: "x".repeat(17 * 1024 * 1024) }), { ...auth, "content-type": "application/json" })).code, "request_too_large");
    const field = await chat({ ...hello, temperature: 9 });
    assert.deepEqual([field.statusCode, field.json().error.param], [400, "temperature"]);
    assert.equal(errorOf(await chat({ ...hello, messages: [{ role: "user", content: [{ type: "file", file: { file_id: "f" } }] }] })).code, "unsupported_feature");
    const audio = await chat({ ...hello, messages: [{ role: "user", content: [{ type: "input_audio", input_audio: { data: "AA", format: "wav" } }] }] });
    assert.equal(audio.statusCode, 404, "a missing capability stops before any upstream call");
    assert.match(audio.json().error.message, /audioInput/);
    assert.equal(upstream.calls.length, 0);
    assert.deepEqual(errorOf(await chat(hello)), { status: 502, code: "upstream_auth_error", type: "upstream_auth_error" });
    assert.equal(errorOf(await chat(hello)).status, 429);
    await app.close();
  }));

test("/v1/models lists the models of connected providers and needs the key", () =>
  withTempDb(async (file) => {
    const { app, call, dash, key, connection } = await ready(file, fakeUpstream());
    assert.equal((await call({ url: "/v1/models" })).statusCode, 401);
    const list = (await call({ url: "/v1/models", headers: { authorization: `Bearer ${key}` } })).json();
    assert.equal(list.object, "list");
    assert.ok(list.data.some((m) => m.id === "openai/gpt-4.1" && m.owned_by === "openai"));
    await dash({ method: "PATCH", url: `/api/connections/${connection.id}`, body: { isActive: false } });
    assert.deepEqual((await call({ url: "/v1/models", headers: { authorization: `Bearer ${key}` } })).json().data, []);
    await app.close();
  }));

test("a stream relays OpenAI chunks, usage on request, and ends with [DONE]", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(sse([chunk({ role: "assistant" }), chunk({ content: "Hel" }), chunk({ content: "lo" }), chunk({}, { finish_reason: "stop" }), { choices: [], usage: { prompt_tokens: 4, completion_tokens: 2 } }, "[DONE]"]));
    const { app, chat } = await ready(file, upstream);
    const res = await chat({ ...hello, stream: true, stream_options: { include_usage: true } });
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-type"], /text\/event-stream/);
    assert.ok(res.headers["x-request-id"]);
    const out = frames(res.body);
    assert.deepEqual(out.filter((f) => f !== "[DONE]" && typeof f.choices[0]?.delta?.content === "string").map((f) => f.choices[0].delta.content), ["", "Hel", "lo"]);
    assert.equal(out.at(-3).choices[0].finish_reason, "stop");
    assert.deepEqual(out.at(-2).usage, { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 });
    assert.equal(out.at(-1), "[DONE]");
    assert.equal(JSON.parse(upstream.calls[0].request.body).stream, true);
    await app.close();
  }));

test("a stream failing before its first chunk is a JSON error; after it, an error event without [DONE]", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(json(401, { error: { message: "bad key" } }), sse([chunk({ content: "partial" })]));
    const { app, chat } = await ready(file, upstream);
    const early = await chat({ ...hello, stream: true });
    assert.match(early.headers["content-type"], /application\/json/);
    assert.equal(errorOf(early).status, 502);
    const cut = await chat({ ...hello, stream: true });
    assert.equal(cut.statusCode, 200);
    const out = frames(cut.body);
    assert.equal(out.at(-1).error.code, "provider_unavailable");
    assert.ok(!out.includes("[DONE]"));
    await app.close();
  }));

test("an upstream that goes silent is cut by the idle timeout and cancelled", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(sse([chunk({ content: "thinking" })], { hang: true }));
    const { app, chat } = await ready(file, upstream, { streamIdleTimeoutMs: 1_000 });
    const started = Date.now();
    const res = await chat({ ...hello, stream: true });
    assert.ok(Date.now() - started < 3_000);
    const last = frames(res.body).at(-1);
    assert.equal(last.error.code, "timeout");
    assert.match(last.error.message, /no data for 1 s/);
    assert.equal(upstream.calls[0].ctx.signal.aborted, true, "the upstream read was aborted");
    await app.close();
  }));


test("a client that leaves mid-stream cancels the upstream at once", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(sse([chunk({ content: "first" })], { hang: true }));
    const { app, key, port } = await listening(file, upstream);
    const res = await openStream(port, key);
    assert.equal(res.statusCode, 200);
    await new Promise((resolve) => res.once("data", resolve));
    res.destroy();
    const ctx = upstream.calls[0].ctx;
    for (let i = 0; i < 50 && !ctx.signal.aborted; i++) await new Promise((r) => setTimeout(r, 20));
    assert.equal(ctx.signal.aborted, true, "the shared signal reached the upstream");
    await app.close();
  }));

test("backpressure: a client that stops reading stops the upstream reads", () =>
  withTempDb(async (file) => {
    const piece = `data: ${JSON.stringify(chunk({ content: "x".repeat(16 * 1024) }))}\n\n`;
    const total = 4_000; // about 64 MiB if nothing held it back
    let pulls = 0;
    const upstream = fakeUpstream((_request, ctx) => ({
      status: 200, headers: { "content-type": "text/event-stream" },
      body: new ReadableStream({
        start(controller) { ctx.signal.addEventListener("abort", () => { try { controller.error(ctx.signal.reason); } catch { /* closed */ } }, { once: true }); },
        pull(controller) { pulls++; if (pulls > total) controller.close(); else controller.enqueue(encoder.encode(piece)); },
      }, { highWaterMark: 1 }),
    }));
    const { app, key, port } = await listening(file, upstream);
    const res = await openStream(port, key);
    res.pause();
    await new Promise((r) => setTimeout(r, 600));
    const early = pulls;
    await new Promise((r) => setTimeout(r, 600));
    assert.equal(pulls, early, "no more upstream reads while the client is not reading");
    assert.ok(pulls < total / 4, `only a socket's worth was buffered (${pulls} of ${total} chunks)`);
    res.destroy();
    await app.close();
  }));
