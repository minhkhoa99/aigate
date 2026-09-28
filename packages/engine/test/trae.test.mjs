import { test } from "node:test";
import assert from "node:assert/strict";
import { builtinRegistry, createAdapter, OAUTH_PROVIDERS } from "../dist/index.js";

const ctx = { signal: new AbortController().signal, requestId: "trae-test" };
const reply = (status, value) => ({ status, headers: { "content-type": "application/json" }, body: new Response(JSON.stringify(value)).body });
const transport = (...answers) => ({ calls: [], async send(request) { this.calls.push(request); const answer = answers.shift(); if (!answer) throw new Error("unexpected request"); return answer; } });
const io = (value) => ({ transport: value, ctx });
const sse = (value) => ({ status: 200, headers: { "content-type": "text/event-stream" }, body: new Response(value).body });

test("Trae authorize, callback exchange, and pasted Cloud-IDE-JWT preserve provider behavior", async () => {
  const guidance = transport(reply(200, { Result: { LoginHost: "https://login.trae.ai" } }));
  const prepared = await OAUTH_PROVIDERS.trae.prepare("http://127.0.0.1:32100/callback", "state-1", {}, io(guidance));
  const login = new URL(prepared.authUrl);
  assert.equal(login.origin, "https://login.trae.ai");
  assert.equal(login.searchParams.get("login_trace_id"), "state-1");
  assert.equal(login.searchParams.get("auth_callback_url"), "http://127.0.0.1:32100/callback");

  const callback = "http://127.0.0.1/callback?refreshToken=refresh&loginHost=https%3A%2F%2Fevil.invalid&x-cloudide-token=cloud";
  const exchange = transport(reply(200, { Result: { AccessToken: "access", RefreshToken: "next", ExpiresAt: new Date(Date.now() + 3600_000).toISOString() } }), reply(200, { Result: { Email: "user@trae.dev", AIRegion: "SG", Region: "SG", UserID: "u1" } }));
  const tokens = await OAUTH_PROVIDERS.trae.exchange(callback, "", "", {}, io(exchange));
  assert.equal(exchange.calls[0].url, "https://api.marscode.com/cloudide/api/v3/trae/oauth/ExchangeToken");
  assert.equal(exchange.calls[0].headers["x-cloudide-token"], "cloud");
  assert.equal(tokens.email, "user@trae.dev");
  assert.deepEqual([tokens.data.aiRegion, tokens.data.scope, tokens.refreshToken], ["SG", "marscode-sg", "next"]);
  const imported = await OAUTH_PROVIDERS.trae.exchange("Cloud-IDE-JWT pasted", "", "", {}, io(transport()));
  assert.deepEqual([imported.accessToken, imported.refreshToken, imported.data.authMethod], ["pasted", undefined, "imported"]);
});

test("Trae retries the next fixed guidance, exchange, and profile origin", async () => {
  const guidance = transport(reply(502, {}), reply(200, { Result: { LoginHost: "login.trae.test" } }));
  await OAUTH_PROVIDERS.trae.prepare("http://127.0.0.1/callback", "state", {}, io(guidance));
  assert.equal(guidance.calls[1].url, "https://api.trae.ai/cloudide/api/v3/trae/GetLoginGuidance");
  const exchange = transport(reply(502, {}), reply(200, { Result: { AccessToken: "access", RefreshToken: "refresh" } }), reply(503, {}), reply(200, { Result: { Email: "fallback@trae.dev" } }));
  const tokens = await OAUTH_PROVIDERS.trae.exchange("?refreshToken=refresh&loginHost=login.trae.test", "", "", {}, io(exchange));
  assert.deepEqual(exchange.calls.map((call) => new URL(call.url).origin), ["https://api.marscode.com", "https://api.trae.ai", "https://api.marscode.com", "https://api.trae.ai"]);
  assert.equal(tokens.email, "fallback@trae.dev");
});

test("Trae SOLO maps auto mode and cumulative event thoughts into bounded canonical chunks", async () => {
  const descriptor = builtinRegistry.provider("trae");
  const value = transport(
    reply(200, { code: 0, data: { chat_session_id: "session", message_id: "message" } }),
    sse("event: plan_item\ndata: {\"id\":\"p1\",\"thought\":\"Hello\"}\n\nevent: plan_item\ndata: {\"id\":\"p1\",\"thought\":\"Hello!\"}\n\nevent: token_usage\ndata: {\"prompt_tokens\":4,\"completion_tokens\":2,\"total_tokens\":6}\n\nevent: done\ndata: {}\n\n"),
  );
  const adapter = createAdapter(descriptor, value);
  const chunks = [];
  for await (const chunk of adapter.stream({ model: "auto", messages: [{ role: "user", content: [{ type: "text", text: "Hi" }] }], stream: true }, { kind: "api-key", apiKey: "jwt", sessionId: "connection-session" }, ctx)) chunks.push(chunk);
  const body = JSON.parse(value.calls[0].body);
  assert.deepEqual([value.calls[0].url, body.mode, body.initial_message.model_selection_strategy, body.initial_message.model_name], ["https://core-normal.trae.ai/api/remote/v1/chat_sessions", "code", "auto", ""]);
  assert.equal(JSON.parse(body.initial_message.common_params).biz_session_id, "connection-session");
  assert.equal(value.calls[1].url, "https://core-normal.trae.ai/api/remote/v1/chat_sessions/session/events?reply_to_message_id=message");
  assert.deepEqual(chunks.filter((chunk) => chunk.type === "text_delta").map((chunk) => chunk.text), ["Hello", "!"]);
  assert.deepEqual(chunks.find((chunk) => chunk.type === "usage").usage, { inputTokens: 4, outputTokens: 2 });
  assert.equal((await adapter.getModels())[0].id, "auto");
  assert.equal(builtinRegistry.providers.length, 72);
});
