import { test } from "node:test";
import assert from "node:assert/strict";
import { EngineError } from "../dist/errors.js";
import { UnsupportedFeatureError } from "../dist/cip.js";
import { createQoderDeviceAttempt, pollQoderDevice, qoderIdentity, qoderOAuth } from "../dist/qoder.js";
import { QoderAdapter, QODER_CHAT_URL, QODER_MODELS_URL } from "../dist/adapters/qoder.js";

// Synthetic protocol fixtures only. No vendor calls, live registration, entitlement or inference acceptance.
const ctx = { signal: new AbortController().signal, requestId: "qoder-fixture", proxy: { url: "http://proxy.invalid:8080", noProxy: [], relay: true, strict: true } };
const credential = { kind: "api-key", apiKey: "fixture-access-secret" };
const provider = { id: "qoder", name: "Qoder", protocol: "openai-compatible", chatUrl: QODER_CHAT_URL, modelsUrl: QODER_MODELS_URL, headers: {}, aliases: [], auth: { kind: "api-key", header: "authorization", scheme: "bearer" }, models: [] };
const request = { model: "operator-selected-model", stream: true, messages: [{ role: "user", content: [{ type: "text", text: "Hello" }] }] };
const encoder = new TextEncoder();
const reply = (status, value, headers = {}) => ({ status, headers: { "content-type": "application/json", ...headers }, body: value === undefined ? null : new Response(JSON.stringify(value)).body });
const sse = (raw, headers = {}) => ({ status: 200, headers: { "content-type": "text/event-stream", ...headers }, body: new Response(raw).body });
const event = (delta = {}, finish_reason = null, extra = {}) => `data: ${JSON.stringify({ id: "reply-1", model: request.model, choices: [{ index: 0, delta, finish_reason }], ...extra })}\n\n`;
const done = "data: [DONE]\n\n";
const success = () => event({ role: "assistant" }) + event({ content: "Hello!" }) + event({}, "stop") + `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 2 }, completion_tokens_details: { reasoning_tokens: 1 } } })}\n\n` + done;
function fake(...answers) {
  return { calls: [], contexts: [], async send(req, context) {
    this.calls.push(req);
    this.contexts.push(context);
    const answer = answers.shift();
    if (answer instanceof Error) throw answer;
    if (typeof answer === "function") return answer(req, context);
    assert.ok(answer, "unexpected extra outbound request");
    return answer;
  } };
}
const io = (transport, context = ctx) => ({ transport, ctx: context });

test("identity verification cannot extend or revive Qoder token expiry", async (t) => {
  let now = Date.now(); t.mock.method(Date, "now", () => now);
  const attempt = await createQoderDeviceAttempt();
  const transport = fake(reply(200, { token: "fixture-token", expires_in: 60 }), () => { now += 10_000; return reply(200, { id: "user-1" }); });
  assert.equal((await pollQoderDevice(attempt, io(transport))).tokens.expiresIn, 50);
  const expired = fake(reply(200, { token: "fixture-token", expires_in: 5 }), () => { now += 6000; return reply(200, { id: "user-1" }); });
  await assert.rejects(pollQoderDevice(attempt, io(expired)), (error) => error.code === "AUTH_ERROR");
});
const all = async (chunks) => { const result = []; for await (const chunk of chunks) result.push(chunk); return result; };
const adapter = (transport) => new QoderAdapter(provider, transport);
function failure(code, diagnostic, noReplay = false) {
  return (error) => {
    assert.ok(error instanceof EngineError);
    assert.equal(error.code, code);
    if (diagnostic) assert.equal(error.details.code, diagnostic);
    assert.equal(error.details.noReplay, noReplay ? true : undefined);
    const exposed = `${error.message} ${JSON.stringify(error.details)} ${String(error.cause)}`;
    for (const secret of [credential.apiKey, "fixture-refresh-secret", "verifier-should-not-leak", "raw-sensitive-message", "https://private.invalid"]) assert.ok(!exposed.includes(secret), exposed);
    return true;
  };
}
function fragmented(raw, step = 7) {
  const bytes = encoder.encode(raw);
  let offset = 0;
  const state = { cancelled: false };
  const body = new ReadableStream({
    pull(controller) {
      if (offset === bytes.length) return controller.close();
      controller.enqueue(bytes.slice(offset, offset + step));
      offset = Math.min(bytes.length, offset + step);
    },
    cancel() { state.cancelled = true; },
  });
  return { response: { status: 200, headers: { "content-type": "text/event-stream" }, body }, state };
}

test("Qoder creates independent S256 owned attempts without official-client impersonation", async () => {
  const first = await createQoderDeviceAttempt();
  const second = await createQoderDeviceAttempt("operator-public-client");
  assert.match(first.codeVerifier, /^[A-Za-z0-9_-]{43}$/);
  for (const value of [first.nonce, first.machineId]) assert.match(value, /^[0-9a-f-]{36}$/);
  assert.notEqual(first.nonce, second.nonce);
  assert.notEqual(first.machineId, second.machineId);
  assert.notEqual(first.codeVerifier, second.codeVerifier);
  const url = new URL(first.authUrl);
  assert.equal(url.origin + url.pathname, "https://qoder.com/device/selectAccounts");
  assert.deepEqual([...url.searchParams.keys()].sort(), ["challenge", "challenge_method", "machine_id", "nonce"]);
  assert.equal(url.searchParams.get("challenge_method"), "S256");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(first.codeVerifier));
  assert.equal(url.searchParams.get("challenge"), Buffer.from(digest).toString("base64url"));
  assert.equal(new URL(second.authUrl).searchParams.get("client_id"), "operator-public-client");
  assert.equal(url.searchParams.get("verifier"), null);
  await assert.rejects(createQoderDeviceAttempt("bad\nclient"), failure("INVALID_REQUEST", "QODER_INVALID_CLIENT_ID"));
});

test("Qoder pending poll is precisely 202/404 and releases non-JSON bodies", async () => {
  const attempt = await createQoderDeviceAttempt();
  for (const status of [202, 404]) {
    let cancelled = false;
    const transport = fake({ status, headers: {}, body: new ReadableStream({ cancel() { cancelled = true; } }) });
    assert.deepEqual(await pollQoderDevice(attempt, io(transport)), { status: "pending" });
    const outbound = transport.calls[0];
    const url = new URL(outbound.url);
    assert.equal(url.origin + url.pathname, "https://openapi.qoder.sh/api/v1/deviceToken/poll");
    assert.deepEqual(Object.fromEntries(url.searchParams), { nonce: attempt.nonce, verifier: attempt.codeVerifier, challenge_method: "S256" });
    assert.equal(outbound.method, "GET");
    assert.equal(outbound.timeoutMs, 15_000);
    assert.equal(transport.contexts[0].proxy, ctx.proxy);
    assert.equal(transport.contexts[0].requestId, ctx.requestId);
    assert.equal(cancelled, true);
    assert.equal(transport.calls.length, 1);
  }
});

test("Qoder approval requires actual upstream identity and allowlists token metadata", async () => {
  const attempt = await createQoderDeviceAttempt("my-client");
  const transport = fake(reply(200, { code: "0", data: { token: credential.apiKey, refresh_token: "fixture-refresh-secret", user_id: "u1", expires_in: 17, secret: "not-data" } }), reply(200, { data: { userId: "u1", displayName: "Example", email: "example@invalid.test" } }));
  const approved = await pollQoderDevice(attempt, io(transport));
  assert.equal(approved.status, "approved");
  assert.ok(approved.tokens.expiresIn > 0 && approved.tokens.expiresIn <= 17);
  assert.equal(approved.tokens.email, "example@invalid.test");
  assert.equal(approved.tokens.displayName, "Example");
  assert.equal(approved.tokens.refreshToken, "fixture-refresh-secret");
  assert.deepEqual(approved.tokens.data, { userId: "u1", machineId: attempt.machineId, clientId: "my-client" });
  assert.equal(transport.calls[1].url, "https://openapi.qoder.sh/api/v1/userinfo");
  assert.equal(transport.calls[1].headers.authorization, `Bearer ${credential.apiKey}`);
  assert.equal(transport.calls[1].timeoutMs, 15_000);
  assert.equal(transport.calls[1].headers["user-agent"], undefined);
});

test("Qoder root and data profile variants normalize only stable identity fields", async () => {
  for (const profile of [{ id: 42, name: "Name" }, { data: { user_id: "42", nickname: "Name" } }, { data: { uid: "42", display_name: "Name" } }]) {
    assert.deepEqual(await qoderIdentity(credential.apiKey, io(fake(reply(200, profile)))), { id: "42", name: "Name" });
  }
  await assert.rejects(qoderIdentity(credential.apiKey, io(fake(reply(200, { email: "not-an-id@invalid.test" })))), failure("PROVIDER_UNAVAILABLE", "QODER_PROTOCOL_ERROR"));
});

test("Qoder does not approve missing tokens, unverified accounts or mismatched identity", async () => {
  const attempt = await createQoderDeviceAttempt();
  for (const root of [{}, { code: 0, data: {} }]) await assert.rejects(pollQoderDevice(attempt, io(fake(reply(200, root)))), failure("PROVIDER_UNAVAILABLE", "QODER_PROTOCOL_ERROR"));
  const transport = fake(reply(200, { token: credential.apiKey }), reply(401, { error: { message: `raw-sensitive-message ${credential.apiKey}` } }));
  await assert.rejects(pollQoderDevice(attempt, io(transport)), failure("AUTH_ERROR", "QODER_AUTH_FAILED"));
  for (const response of [{ token: credential.apiKey, user_id: "u2" }, { userId: "u2", data: { token: credential.apiKey } }]) await assert.rejects(pollQoderDevice(attempt, io(fake(reply(200, response), reply(200, { id: "u1" })))), failure("AUTH_ERROR", "QODER_ACCOUNT_MISMATCH"));
  await assert.rejects(qoderIdentity(credential.apiKey, io(fake(reply(200, { id: "u2", data: { id: "u1" } })))), failure("AUTH_ERROR", "QODER_ACCOUNT_MISMATCH"));
});

test("Qoder refresh uses the observed POST once, preserves identity, drops extra data and never fakes expiry", async () => {
  assert.equal(qoderOAuth.flow, "device_code");
  assert.equal(qoderOAuth.background, false);
  // Owned attempt APIs, not the generic device API, keep the verifier private.
  assert.equal(qoderOAuth.deviceCode, undefined);
  const transport = fake(reply(200, { data: { device_token: "rotated-access", refresh_token: "rotated-refresh", expires_at: new Date(Date.now() + 20_000).toISOString() } }));
  const tokens = await qoderOAuth.refresh("fixture-refresh-secret", io(transport), undefined, { userId: "u1", machineId: "machine1", clientId: "client1", secret: "discard-me" });
  assert.equal(transport.calls.length, 1);
  const outbound = transport.calls[0];
  assert.equal(outbound.url, "https://openapi.qoder.sh/api/v1/deviceToken/refresh");
  assert.equal(outbound.method, "POST");
  assert.deepEqual(JSON.parse(outbound.body), { refresh_token: "fixture-refresh-secret", machine_id: "machine1" });
  assert.equal(tokens.accessToken, "rotated-access");
  assert.equal(tokens.refreshToken, "rotated-refresh");
  assert.ok(tokens.expiresIn > 0 && tokens.expiresIn <= 20);
  assert.deepEqual(tokens.data, { userId: "u1", machineId: "machine1", clientId: "client1" });
  const unknown = await qoderOAuth.refresh("fixture-refresh-secret", io(fake(reply(200, { token: "next" }))), undefined, { userId: "u1", machineId: "machine1" });
  assert.equal(unknown.expiresIn, undefined);
  assert.equal(unknown.refreshToken, "fixture-refresh-secret");
  const mismatch = fake(reply(200, { token: "next", user_id: "different" }));
  await assert.rejects(qoderOAuth.refresh("fixture-refresh-secret", io(mismatch), undefined, { userId: "u1", machineId: "machine1" }), failure("AUTH_ERROR", "QODER_ACCOUNT_MISMATCH"));
});

test("Qoder expiry accepts explicit seconds/RFC3339 only and never clamps expired or malformed values", async () => {
  const attempt = await createQoderDeviceAttempt();
  const cases = [
    [{ expires_at: 9999999999999 }, "PROVIDER_UNAVAILABLE", "QODER_INVALID_EXPIRY"],
    [{ expires_at: "2030-02-30T10:00:00Z" }, "PROVIDER_UNAVAILABLE", "QODER_INVALID_EXPIRY"],
    [{ expires_at: "2030-01-01" }, "PROVIDER_UNAVAILABLE", "QODER_INVALID_EXPIRY"],
    [{ expires_at: null }, "PROVIDER_UNAVAILABLE", "QODER_INVALID_EXPIRY"],
    [{ expires_in: "3600" }, "PROVIDER_UNAVAILABLE", "QODER_INVALID_EXPIRY"],
    [{ expires_in: -1 }, "PROVIDER_UNAVAILABLE", "QODER_INVALID_EXPIRY"],
    [{ expires_in: 0 }, "AUTH_ERROR", "QODER_AUTH_FAILED"],
    [{ expires_at: "2000-01-01T00:00:00Z" }, "AUTH_ERROR", "QODER_AUTH_FAILED"],
    [{ expires_in: 30, expires_at: "not-a-date" }, "PROVIDER_UNAVAILABLE", "QODER_INVALID_EXPIRY"],
  ];
  for (const [expiry, code, diagnostic] of cases) {
    const transport = fake(reply(200, { token: credential.apiKey, ...expiry }));
    await assert.rejects(pollQoderDevice(attempt, io(transport)), failure(code, diagnostic));
    assert.equal(transport.calls.length, 1);
    await assert.rejects(qoderOAuth.refresh("fixture-refresh-secret", io(fake(reply(200, { token: "next", ...expiry }))), undefined, { userId: "u1", machineId: "m1" }), failure(code, diagnostic));
  }
  const unknown = await pollQoderDevice(attempt, io(fake(reply(200, { token: credential.apiKey }), reply(200, { id: "u1" }))));
  assert.equal(unknown.tokens.expiresIn, undefined);
  const offset = await pollQoderDevice(attempt, io(fake(reply(200, { device_token: credential.apiKey, expires_at: "2035-01-01T12:30:00+05:30" }), reply(200, { id: "u1" }))));
  assert.ok(offset.tokens.expiresIn > 86400);
});

test("Qoder metadata classifies signature separately, redacts failures and never retries refresh or polls", async () => {
  const attempt = await createQoderDeviceAttempt();
  for (const [status, root, code, diagnostic] of [
    [403, { code: "101", message: `raw-sensitive-message ${credential.apiKey}` }, "PROVIDER_UNAVAILABLE", "QODER_SIGNATURE_REQUIRED"],
    [401, undefined, "AUTH_ERROR", "QODER_AUTH_FAILED"],
    [429, { code: "insufficient_quota" }, "QUOTA_EXHAUSTED", "QODER_QUOTA_EXHAUSTED"],
    [500, { code: credential.apiKey, message: "raw-sensitive-message" }, "PROVIDER_UNAVAILABLE", "QODER_PROTOCOL_ERROR"],
  ]) {
    const transport = fake(reply(status, root));
    await assert.rejects(pollQoderDevice(attempt, io(transport)), failure(code, diagnostic));
    assert.equal(transport.calls.length, 1);
  }
  const transport = fake(new EngineError("PROVIDER_UNAVAILABLE", `raw-sensitive-message fixture-refresh-secret https://private.invalid`, { token: "fixture-refresh-secret" }));
  await assert.rejects(qoderOAuth.refresh("fixture-refresh-secret", io(transport), undefined, { userId: "u1", machineId: "m1" }), failure("PROVIDER_UNAVAILABLE", "QODER_TRANSPORT_ERROR"));
  assert.equal(transport.calls.length, 1);
});

test("Qoder metadata has 64 KiB token / 1 MiB profile limits and rejects malformed JSON/UTF8", async () => {
  const attempt = await createQoderDeviceAttempt();
  await assert.rejects(pollQoderDevice(attempt, io(fake(reply(200, { token: credential.apiKey, padding: "x".repeat(64 * 1024) })))), failure("PROVIDER_UNAVAILABLE", "QODER_BODY_LIMIT"));
  assert.equal((await qoderIdentity(credential.apiKey, io(fake(reply(200, { id: "u1", padding: "x".repeat(70 * 1024) }))))).id, "u1");
  await assert.rejects(qoderIdentity(credential.apiKey, io(fake(reply(200, { id: "u1", padding: "x".repeat(1024 * 1024) })))), failure("PROVIDER_UNAVAILABLE", "QODER_BODY_LIMIT"));
  await assert.rejects(qoderIdentity(credential.apiKey, io(fake({ status: 200, headers: {}, body: new Response("not json raw-sensitive-message").body }))), failure("PROVIDER_UNAVAILABLE", "QODER_PROTOCOL_ERROR"));
  await assert.rejects(qoderIdentity(credential.apiKey, io(fake({ status: 200, headers: {}, body: new Response(new Uint8Array([255])).body }))), failure("PROVIDER_UNAVAILABLE", "QODER_PROTOCOL_ERROR"));
});

test("Qoder cancellation aborts metadata body reads, cancels readers and preserves proxy context", async () => {
  let cancel = false;
  const controller = new AbortController();
  const response = { status: 200, headers: {}, body: new ReadableStream({ cancel() { cancel = true; } }) };
  const transport = fake(response);
  const work = qoderIdentity(credential.apiKey, io(transport, { ...ctx, signal: controller.signal }));
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort(new Error("raw-sensitive-message"));
  await assert.rejects(work, failure("INVALID_REQUEST", "QODER_CANCELLED"));
  assert.equal(cancel, true);
  assert.equal(transport.contexts[0].signal.aborted, true);
  assert.equal(transport.contexts[0].proxy, ctx.proxy);
});

test("Qoder metadata deadline includes response-body consumption", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let cancelled = false;
  const transport = fake({ status: 200, headers: {}, body: new ReadableStream({ cancel() { cancelled = true; } }) });
  const work = qoderIdentity(credential.apiKey, io(transport));
  const rejected = assert.rejects(work, failure("TIMEOUT", "QODER_TIMEOUT"));
  await new Promise((resolve) => setImmediate(resolve));
  t.mock.timers.tick(15_000);
  await rejected;
  assert.equal(cancelled, true);
  assert.equal(transport.calls.length, 1);
});

test("Qoder streams text and collects nonstream only after a validated terminal", async () => {
  for (const stream of [true, false]) {
    const transport = fake(sse(success()));
    const instance = adapter(transport);
    if (stream) {
      const chunks = await all(instance.stream(request, credential, ctx));
      assert.deepEqual(chunks.map((chunk) => chunk.type), ["start", "text_delta", "usage", "stop"]);
      assert.equal(chunks[1].text, "Hello!");
      assert.equal(chunks.at(-1).stopReason, "end_turn");
      assert.deepEqual(chunks[2].usage, { inputTokens: 10, outputTokens: 5, cacheReadTokens: 2, reasoningTokens: 1 });
    } else {
      const answer = await instance.execute({ ...request, stream: false }, credential, ctx);
      assert.deepEqual(answer.content, [{ type: "text", text: "Hello!" }]);
      assert.equal(answer.id, "reply-1");
      assert.equal(answer.model, request.model);
      assert.equal(answer.stopReason, "end_turn");
    }
    assert.equal(transport.calls.length, 1);
    assert.equal(transport.calls[0].url, QODER_CHAT_URL);
    assert.equal(transport.calls[0].headers.authorization, `Bearer ${credential.apiKey}`);
    assert.equal(transport.calls[0].headers["user-agent"], undefined);
    const body = JSON.parse(transport.calls[0].body);
    assert.equal(body.stream, true);
    assert.deepEqual(body.stream_options, { include_usage: true });
    assert.equal(body.model, request.model);
    assert.equal(transport.contexts[0].requestId, ctx.requestId);
    assert.equal(transport.contexts[0].proxy, ctx.proxy);
    assert.equal(transport.contexts[0].signal.aborted, true, "operation context is closed after use");
  }
});

const toolStream = () => event({ tool_calls: [{ index: 0, id: "stable-call-1", type: "function", function: { name: "get_", arguments: '{"city":' } }] }) + event({ tool_calls: [{ index: 0, function: { name: "weather", arguments: '"Hà Nội"}' } }] }) + event({}, "tool_calls") + done;

test("Qoder preserves fragmented tool calls, schema, choice, call IDs and tool results without execution", async () => {
  for (const streaming of [true, false]) {
    const wire = fragmented(toolStream(), 1);
    const transport = fake(wire.response);
    const req = { ...request, stream: streaming, maxOutputTokens: 123, maxOutputTokensField: "max_completion_tokens", temperature: 0.2, topP: 0.8, stop: ["END"], system: [{ type: "text", text: "A system" }], tools: [{ name: "get_weather", description: "Weather", parameters: { type: "object", properties: { city: { type: "string" } }, required: ["city"], additionalProperties: false }, strict: true }], toolChoice: { name: "get_weather" }, messages: [...request.messages, { role: "assistant", content: [{ type: "tool_call", id: "prior-call", name: "get_weather", arguments: '{"city":"Paris"}' }] }, { role: "tool", content: [{ type: "tool_result", toolCallId: "prior-call", content: [{ type: "text", text: "Sunny" }] }] }], vendorExtensions: { openai: { max_completion_tokens: 999, stream: false, model: "must-not-use" } } };
    const instance = adapter(transport);
    if (streaming) {
      const chunks = await all(instance.stream(req, credential, ctx));
      const fragments = chunks.filter((chunk) => chunk.type === "tool_call_delta");
      assert.equal(fragments.map((chunk) => chunk.argumentsDelta).join(""), '{"city":"Hà Nội"}');
      assert.equal(fragments.at(-1).name, "get_weather");
      assert.equal(fragments.at(-1).id, "stable-call-1");
      assert.equal(chunks.at(-1).stopReason, "tool_use");
    } else assert.deepEqual((await instance.execute(req, credential, ctx)).content, [{ type: "tool_call", id: "stable-call-1", name: "get_weather", arguments: '{"city":"Hà Nội"}' }]);
    const body = JSON.parse(transport.calls[0].body);
    assert.equal(body.max_tokens, 123);
    assert.equal(body.max_completion_tokens, undefined);
    assert.equal(body.model, request.model);
    assert.deepEqual(body.tools[0].function, req.tools[0]);
    assert.deepEqual(body.tool_choice, { type: "function", function: { name: "get_weather" } });
    assert.deepEqual(body.messages.at(-1), { role: "tool", tool_call_id: "prior-call", content: "Sunny" });
    assert.deepEqual(body.messages.at(-2).tool_calls[0], { id: "prior-call", type: "function", function: { name: "get_weather", arguments: '{"city":"Paris"}' } });
    assert.equal(transport.calls.length, 1);
  }
});

test("Qoder ignores notification prefixes/SSE metadata, handles CRLF and never renders notices", async () => {
  const raw = ': heartbeat\n\nevent: notification\ndata: {"type":"notification","message":"notice"}\n\ndata: notification: notice\n\ndata: [NOTIFICATION]notice\n\n' + success();
  const wire = fragmented(raw.replaceAll("\n", "\r\n"), 1);
  const answer = await adapter(fake(wire.response)).execute(request, credential, ctx);
  assert.deepEqual(answer.content, [{ type: "text", text: "Hello!" }]);
  const bareCR = fragmented(success().replaceAll("\n", "\r"), 3);
  assert.equal((await adapter(fake(bareCR.response)).execute(request, credential, ctx)).stopReason, "end_turn");
});

test("Qoder requires finish reason AND DONE, rejects malformed/late errors and never emits success on failure", async () => {
  const cases = ["", done, event({ content: "partial" }), event({ content: "partial" }, "stop"), event({ content: "partial" }) + done, event({}, "unknown") + done, "data: raw-sensitive-message\n\n", "data: []\n\n", event({ content: 42 }) + done, event({}, "stop") + done + "data: {\"error\":{\"code\":\"invalid_token\"}}\n\n", event({}, "stop") + "data: {\"error\":{\"code\":\"invalid_token\"}}\n\n" + done, event({}, "stop") + done + event({ content: "late" }), event({}, "stop") + done.slice(0, -1), "event: error\ndata: raw-sensitive-message\n\n"];
  for (const raw of cases) {
    const transport = fake(sse(raw));
    const seen = [];
    await assert.rejects(async () => { for await (const chunk of adapter(transport).stream(request, credential, ctx)) seen.push(chunk); }, (error) => {
      assert.ok(error instanceof EngineError);
      assert.equal(error.details.noReplay, true);
      assert.ok(!error.message.includes("raw-sensitive-message"));
      return true;
    });
    assert.ok(!seen.some((chunk) => chunk.type === "stop"));
    assert.equal(transport.calls.length, 1);
    await assert.rejects(adapter(fake(sse(raw))).execute({ ...request, stream: false }, credential, ctx), (error) => error instanceof EngineError && error.details.noReplay === true);
  }
});

test("Qoder classifies HTTP 200 error frames including auth, rate, quota, signature and timeout", async () => {
  for (const [error, code, diagnostic] of [
    [{ code: "invalid_token" }, "AUTH_ERROR", "QODER_AUTH_FAILED"],
    [{ status: 401 }, "AUTH_ERROR", "QODER_AUTH_FAILED"],
    [{ code: "429" }, "RATE_LIMIT", "QODER_RATE_LIMIT"],
    [{ status: "429", code: "insufficient_quota" }, "QUOTA_EXHAUSTED", "QODER_QUOTA_EXHAUSTED"],
    [{ code: "model_not_found" }, "MODEL_UNAVAILABLE", "QODER_MODEL_UNAVAILABLE"],
    [{ status: 408 }, "TIMEOUT", "QODER_TIMEOUT"],
    [{ code: "101" }, "PROVIDER_UNAVAILABLE", "QODER_SIGNATURE_REQUIRED"],
    [{ code: credential.apiKey }, "PROVIDER_UNAVAILABLE", "QODER_PROTOCOL_ERROR"],
  ]) {
    const raw = `event: error\ndata: ${JSON.stringify({ error: { ...error, message: `raw-sensitive-message ${credential.apiKey}` } })}\n\n`;
    const transport = fake(sse(raw, { "retry-after": "3" }));
    await assert.rejects(adapter(transport).execute(request, credential, ctx), (failureValue) => {
      failure(code, diagnostic, true)(failureValue);
      assert.equal(failureValue.details.retryAfterMs, 3000);
      return true;
    });
    assert.equal(transport.calls.length, 1);
  }
});

test("Qoder generation has no transport/HTTP retries and marks even pre-header failures noReplay", async () => {
  for (const [response, code, diagnostic] of [
    [reply(503, { message: "raw-sensitive-message" }), "PROVIDER_UNAVAILABLE", "QODER_PROTOCOL_ERROR"],
    [reply(401), "AUTH_ERROR", "QODER_AUTH_FAILED"],
    [reply(403, { code: 101 }), "PROVIDER_UNAVAILABLE", "QODER_SIGNATURE_REQUIRED"],
    [reply(429, {}, { "retry-after": "999999999999999" }), "RATE_LIMIT", "QODER_RATE_LIMIT"],
    [reply(200, { error: { code: "invalid_token" } }), "AUTH_ERROR", "QODER_AUTH_FAILED"],
    [new EngineError("TIMEOUT", "raw-sensitive-message", { secret: credential.apiKey }), "TIMEOUT", "QODER_TIMEOUT"],
    [new Error(`raw-sensitive-message ${credential.apiKey}`), "PROVIDER_UNAVAILABLE", "QODER_TRANSPORT_ERROR"],
  ]) {
    const transport = fake(response);
    await assert.rejects(adapter(transport).execute(request, credential, ctx), failure(code, diagnostic, true));
    assert.equal(transport.calls.length, 1);
  }
});

test("Qoder rejects incomplete, duplicate, changed-ID and invalid JSON tool calls at terminal", async () => {
  const cases = [
    [{ index: 0, function: { name: "valid", arguments: "{}" } }],
    [{ index: 0, id: "c1", function: { arguments: "{}" } }],
    [{ index: 0, id: "c1", function: { name: "valid", arguments: '{"x":' } }],
    [{ index: 0, id: "c1", function: { name: "valid", arguments: "[]" } }],
    [{ index: 64, id: "c1", function: { name: "valid", arguments: "{}" } }],
    [{ index: 0, id: "c1", function: { name: "not valid", arguments: "{}" } }],
    [{ index: 0, id: "same", function: { name: "valid", arguments: "{}" } }, { index: 1, id: "same", function: { name: "valid", arguments: "{}" } }],
  ];
  for (const calls of cases) await assert.rejects(adapter(fake(sse(event({ tool_calls: calls }) + event({}, "tool_calls") + done))).execute(request, credential, ctx), (error) => error instanceof EngineError && error.details.noReplay === true);
  await assert.rejects(adapter(fake(sse(event({ tool_calls: [{ index: 0, id: "one", function: { name: "valid", arguments: "{" } }] }) + event({ tool_calls: [{ index: 0, id: "two", function: { arguments: "}" } }] }) + event({}, "tool_calls") + done))).execute(request, credential, ctx), failure("PROVIDER_UNAVAILABLE", "QODER_PROTOCOL_ERROR", true));
  await assert.rejects(adapter(fake(sse(event({}, "tool_calls") + done))).execute(request, credential, ctx), failure("PROVIDER_UNAVAILABLE", "QODER_PROTOCOL_ERROR", true));
});

test("Qoder accepts at most 64 validated calls and bounds each argument at 256 KiB UTF8", async () => {
  const calls = Array.from({ length: 64 }, (_, index) => ({ index, id: `call-${index}`, function: { name: "valid", arguments: "{}" } }));
  const answer = await adapter(fake(sse(event({ tool_calls: calls }) + event({}, "tool_calls") + done))).execute(request, credential, ctx);
  assert.equal(answer.content.length, 64);
  const args = JSON.stringify({ x: "a".repeat(256 * 1024 - 8) });
  assert.equal(encoder.encode(args).byteLength, 256 * 1024);
  const make = (argumentsText) => event({ tool_calls: [{ index: 0, id: "c1", function: { name: "valid", arguments: argumentsText } }] }) + event({}, "tool_calls") + done;
  assert.equal((await adapter(fake(sse(make(args)))).execute(request, credential, ctx)).content[0].arguments, args);
  await assert.rejects(adapter(fake(sse(make(args + " ")))).execute(request, credential, ctx), failure("PROVIDER_UNAVAILABLE", "QODER_TOOL_ARGUMENT_LIMIT", true));
  await assert.rejects(adapter(fake(sse(make(JSON.stringify({ x: "é".repeat(130 * 1024) }))))).execute(request, credential, ctx), failure("PROVIDER_UNAVAILABLE", "QODER_TOOL_ARGUMENT_LIMIT", true));
});

test("Qoder bounds records, total stream bytes, event count and cancels on limits", async () => {
  const recordTooLarge = fragmented("data: " + "x".repeat(2 * 1024 * 1024), 64 * 1024);
  await assert.rejects(adapter(fake(recordTooLarge.response)).execute(request, credential, ctx), failure("PROVIDER_UNAVAILABLE", "QODER_RECORD_LIMIT", true));
  assert.equal(recordTooLarge.state.cancelled, true);
  // Individually legal notifications still consume the total budget.
  const notices = "data: notification:" + "x".repeat(900 * 1024) + "\n\n";
  await assert.rejects(adapter(fake(sse(notices.repeat(10) + success()))).execute(request, credential, ctx), failure("PROVIDER_UNAVAILABLE", "QODER_STREAM_LIMIT", true));
  await assert.rejects(adapter(fake(sse("data: notification:n\n\n".repeat(32_769) + success()))).execute(request, credential, ctx), failure("PROVIDER_UNAVAILABLE", "QODER_EVENT_LIMIT", true));
  // A near-limit record followed in the same read by a different record must not share its byte budget.
  const near = "data: notification:" + "x".repeat(1024 * 1024 - 64) + "\n\n";
  assert.equal((await adapter(fake(sse(near + success()))).execute(request, credential, ctx)).stopReason, "end_turn");
});

test("Qoder stream reader failure and malformed UTF8 never become successful stop", async () => {
  let first = true;
  const body = new ReadableStream({ pull(controller) {
    if (first) { first = false; controller.enqueue(encoder.encode(event({ content: "partial" }, "stop") + done)); }
    else controller.error(new Error(`raw-sensitive-message ${credential.apiKey}`));
  } });
  await assert.rejects(adapter(fake({ status: 200, headers: { "content-type": "text/event-stream" }, body })).execute(request, credential, ctx), failure("PROVIDER_UNAVAILABLE", "QODER_TRANSPORT_ERROR", true));
  await assert.rejects(adapter(fake({ status: 200, headers: { "content-type": "text/event-stream" }, body: new Response(new Uint8Array([255])).body })).execute(request, credential, ctx), failure("PROVIDER_UNAVAILABLE", "QODER_PROTOCOL_ERROR", true));
});

test("Qoder generation cancellation and consumer early-return cancel the body without replay", async () => {
  let cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(encoder.encode(event({ content: "partial" }))); }, cancel() { cancelled = true; } });
  const controller = new AbortController();
  const transport = fake({ status: 200, headers: { "content-type": "text/event-stream" }, body });
  const stream = adapter(transport).stream(request, credential, { ...ctx, signal: controller.signal });
  assert.equal((await stream.next()).value.type, "start");
  assert.equal((await stream.next()).value.type, "text_delta");
  const next = stream.next();
  controller.abort(new Error("raw-sensitive-message"));
  await assert.rejects(next, failure("INVALID_REQUEST", "QODER_CANCELLED", true));
  assert.equal(cancelled, true);
  assert.equal(transport.calls.length, 1);
  let earlyCancelled = false;
  const earlyBody = new ReadableStream({ start(out) { out.enqueue(encoder.encode(event({ content: "partial" }))); }, cancel() { earlyCancelled = true; } });
  for await (const chunk of adapter(fake({ status: 200, headers: { "content-type": "text/event-stream" }, body: earlyBody })).stream(request, credential, ctx)) { assert.equal(chunk.type, "start"); break; }
  assert.equal(earlyCancelled, true);
});

test("Qoder generation timeout is bounded through body and carries noReplay", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let cancelled = false;
  const transport = fake({ status: 200, headers: { "content-type": "text/event-stream" }, body: new ReadableStream({ cancel() { cancelled = true; } }) });
  const rejected = assert.rejects(adapter(transport).execute(request, credential, ctx), failure("TIMEOUT", "QODER_TIMEOUT", true));
  await new Promise((resolve) => setImmediate(resolve));
  t.mock.timers.tick(300_000);
  await rejected;
  assert.equal(cancelled, true);
  assert.equal(transport.calls.length, 1);
});

test("Qoder preflight rejects PAT, media (including nested results), missing model and unsafe extensions without sending", async () => {
  const transport = fake();
  const instance = adapter(transport);
  await assert.rejects(instance.execute(request, { ...credential, apiKey: "pt-unsupported" }, ctx), failure("AUTH_ERROR", "QODER_PAT_UNSUPPORTED"));
  await assert.rejects(qoderIdentity("pt-unsupported", io(transport)), failure("AUTH_ERROR", "QODER_PAT_UNSUPPORTED"));
  for (const type of ["image", "audio", "video", "file"]) {
    const media = { type, source: { kind: "url", url: "https://media.invalid" } };
    for (const req of [{ ...request, messages: [{ role: "user", content: [media] }] }, { ...request, system: [media] }, { ...request, messages: [{ role: "tool", content: [{ type: "tool_result", toolCallId: "c1", content: [media] }] }] }]) await assert.rejects(instance.execute(req, credential, ctx), UnsupportedFeatureError);
  }
  await assert.rejects(instance.execute({ ...request, model: "" }, credential, ctx), failure("INVALID_REQUEST", "QODER_INVALID_MODEL"));
  await assert.rejects(instance.execute({ ...request, vendorExtensions: { openai: { n: 2 } } }, credential, ctx), UnsupportedFeatureError);
  assert.equal(transport.calls.length, 0);
});

test("Qoder credential Test performs real userinfo; token existence or declared expiry is insufficient", async () => {
  const transport = fake(reply(200, { data: { id: "u1" } }), reply(401, { message: `raw-sensitive-message ${credential.apiKey}` }));
  const instance = adapter(transport);
  assert.deepEqual(await instance.validateCredential({ ...credential, providerData: { expiresAt: "2000-01-01" } }, ctx), { valid: true });
  assert.deepEqual(await instance.validateCredential(credential, ctx), { valid: false, code: "AUTH_ERROR", message: "Qoder: QODER_AUTH_FAILED" });
  assert.ok(transport.calls.every((call) => call.method === "GET" && call.url === "https://openapi.qoder.sh/api/v1/userinfo"));
  assert.equal(transport.calls.length, 2);
});

test("Qoder live model import sends unsigned observed URL, rejects signature and never falls back to static IDs", async () => {
  const transport = fake(reply(403, { code: "101", message: "Signature invalid raw-sensitive-message" }));
  await assert.rejects(adapter(transport).getModels(credential, ctx), failure("PROVIDER_UNAVAILABLE", "QODER_SIGNATURE_REQUIRED"));
  assert.equal(transport.calls.length, 1);
  assert.equal(transport.calls[0].url, QODER_MODELS_URL);
  assert.deepEqual(transport.calls[0].headers, { accept: "application/json", authorization: `Bearer ${credential.apiKey}` });
  assert.equal(transport.calls[0].timeoutMs, 15_000);
  assert.equal(transport.contexts[0].proxy, ctx.proxy);
  await assert.rejects(adapter(fake(reply(200, { data: { unknown_shape: ["static-model"] } }))).getModels(credential, ctx), failure("PROVIDER_UNAVAILABLE", "QODER_MODEL_LIST_PROTOCOL_ERROR"));
  assert.deepEqual(await adapter(fake(reply(200, { data: [{ id: "real-returned-id" }, { id: "real-returned-id" }, { model_id: "second-returned-id" }] }))).getModels(credential, ctx), [{ id: "real-returned-id" }, { id: "second-returned-id" }]);
  await assert.rejects(adapter(fake(reply(200, { data: { models: [{ name: "not-a-model-id" }] } }))).getModels(credential, ctx), failure("PROVIDER_UNAVAILABLE", "QODER_MODEL_LIST_PROTOCOL_ERROR"));
  await assert.rejects(adapter(fake(reply(200, { data: [], padding: "x".repeat(64 * 1024) }))).getModels(credential, ctx), failure("PROVIDER_UNAVAILABLE", "QODER_BODY_LIMIT"));
});

test("Qoder cancels a late response even when a non-cooperative transport ignored abort", async () => {
  for (const generation of [false, true]) {
    const controller = new AbortController();
    let deliver;
    let cancelled = false;
    const transport = fake(() => new Promise((resolve) => { deliver = resolve; }));
    const context = { ...ctx, signal: controller.signal };
    const work = generation ? adapter(transport).execute(request, credential, context) : qoderIdentity(credential.apiKey, io(transport, context));
    const rejected = assert.rejects(work, failure("INVALID_REQUEST", "QODER_CANCELLED", generation));
    controller.abort(new Error("raw-sensitive-message"));
    await rejected;
    deliver({ status: 200, headers: {}, body: new ReadableStream({ cancel() { cancelled = true; } }) });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(cancelled, true);
    assert.equal(transport.calls.length, 1);
  }
});

test("Qoder cannot yield successful stop when cancelled after usage", async () => {
  const controller = new AbortController();
  const stream = adapter(fake(sse(success()))).stream(request, credential, { ...ctx, signal: controller.signal });
  for (;;) {
    const next = await stream.next();
    assert.equal(next.done, false);
    if (next.value.type === "usage") break;
  }
  controller.abort();
  await assert.rejects(stream.next(), failure("INVALID_REQUEST", "QODER_CANCELLED", true));
});

test("Qoder pre-aborted contexts submit nothing and transport details cannot impersonate safe diagnostics", async () => {
  const controller = new AbortController();
  controller.abort(new Error("raw-sensitive-message"));
  const transport = fake();
  await assert.rejects(adapter(transport).execute(request, credential, { ...ctx, signal: controller.signal }), failure("INVALID_REQUEST", "QODER_CANCELLED"));
  await assert.rejects(qoderIdentity(credential.apiKey, io(transport, { ...ctx, signal: controller.signal })), failure("INVALID_REQUEST", "QODER_CANCELLED"));
  assert.equal(transport.calls.length, 0);
  const unsafe = () => new EngineError("AUTH_ERROR", `raw-sensitive-message ${credential.apiKey}`, { provider: "qoder", code: credential.apiKey });
  await assert.rejects(qoderIdentity(credential.apiKey, io(fake(unsafe()))), failure("PROVIDER_UNAVAILABLE", "QODER_TRANSPORT_ERROR"));
  await assert.rejects(adapter(fake(unsafe())).execute(request, credential, ctx), failure("PROVIDER_UNAVAILABLE", "QODER_TRANSPORT_ERROR", true));
});
