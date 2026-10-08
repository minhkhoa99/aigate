// Contract: docs/contracts/oauth.md (SP16b) — signing in to claude and codex from the dashboard, and using them on /v1.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { fakeUpstream, json, ready, sse } from "./lane-helpers.mjs";
import { TokenRefresher } from "../dist/modules/connections/infrastructure/token-refresher.js";
import { fallbackCooldown } from "../dist/modules/routing/infrastructure/chat-lane.js";
import { EngineError } from "@aigate/engine";

const OAT = "sk-ant-oat01-token";
const jwt = (payload) => `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;
const anthropicAnswer = { id: "msg_1", model: "claude-sonnet-5", content: [{ type: "text", text: "Hello" }], stop_reason: "end_turn", usage: { input_tokens: 2, output_tokens: 1 } };
const texts = (system) => system.map((block) => block.text);

async function signInClaude(dash) {
  const begun = (await dash({ url: "/api/oauth/claude/authorize?redirect_uri=http%3A%2F%2F127.0.0.1%3A20200%2Fcallback" })).json();
  const signed = await dash({ method: "POST", url: "/api/oauth/claude/exchange", body: { code: "c1#page-state", redirectUri: begun.redirectUri, codeVerifier: begun.codeVerifier, state: begun.state } });
  return { begun, signed };
}

test("claude: sign in with code#state, then OpenAI clients get the Claude Code prompt and Claude clients do not; cloaked; the test calls nobody", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(
      json(200, { access_token: OAT, refresh_token: "r1", expires_in: 28800, scope: "user:inference" }),
      json(200, anthropicAnswer),
      json(200, anthropicAnswer),
      json(200, { data: [{ id: "claude-sonnet-5" }, { id: "claude-new" }] }),
    );
    const { app, call, dash, key } = await ready(file, upstream);
    const { begun, signed } = await signInClaude(dash);
    assert.deepEqual([begun.flowType, begun.redirectUri], ["authorization_code_pkce", "http://127.0.0.1:20200/callback"]);
    assert.ok(begun.authUrl.startsWith("https://claude.ai/oauth/authorize?code=true&client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e"));
    assert.equal(signed.statusCode, 200);
    const exchange = JSON.parse(upstream.calls[0].request.body);
    assert.deepEqual([exchange.code, exchange.state, exchange.code_verifier], ["c1", "page-state", begun.codeVerifier]);
    const connection = (await dash({ url: "/api/connections" })).json().find((c) => c.provider === "claude");
    assert.deepEqual([connection.authType, connection.name, connection.email, connection.testStatus], ["oauth", "Claude Code", null, "active"], "no email: named after the provider");

    const chat = await call({ method: "POST", url: "/v1/chat/completions", headers: { authorization: `Bearer ${key}` },
      body: { model: "claude/claude-sonnet-5", messages: [{ role: "system", content: "be brief" }, { role: "user", content: "hi" }] } });
    assert.equal(chat.statusCode, 200);
    assert.equal(chat.json().choices[0].message.content, "Hello");
    const sent = upstream.calls[1].request;
    assert.deepEqual([sent.url, sent.headers.authorization, sent.headers["x-app"]], ["https://api.anthropic.com/v1/messages?beta=true", `Bearer ${OAT}`, "cli"]);
    const body = JSON.parse(sent.body);
    assert.match(texts(body.system)[0], /^x-anthropic-billing-header: /);
    assert.deepEqual(texts(body.system).slice(1), ["You are Claude Code, Anthropic's official CLI for Claude.", "be brief"]);
    assert.equal(JSON.parse(body.metadata.user_id).session_id, connection.id, "the connection id is the session");

    const messages = await call({ method: "POST", url: "/v1/messages", headers: { "x-api-key": key },
      body: { model: "claude/claude-sonnet-5", max_tokens: 10, stream: false, system: "mine", messages: [{ role: "user", content: "hi" }] } });
    assert.equal(messages.statusCode, 200);
    assert.deepEqual(texts(JSON.parse(upstream.calls[2].request.body).system).slice(1), ["mine"], "a Claude client keeps its own system prompt");

    const tested = await dash({ method: "POST", url: `/api/connections/${connection.id}/test` });
    assert.deepEqual([tested.json().testStatus, upstream.calls.length], ["active", 3], "the test reads the expiry only");
    const models = await dash({ url: `/api/connections/${connection.id}/models` });
    assert.deepEqual(models.json().models, [{ id: "claude-sonnet-5", inCatalog: true }, { id: "claude-new", inCatalog: false }]);
    assert.deepEqual([upstream.calls[3].request.url, upstream.calls[3].request.headers["x-api-key"], upstream.calls[3].request.headers.authorization], ["https://api.anthropic.com/v1/models", OAT, undefined]);
    await app.close();
  }));

test("claude: a token within 4 hours of expiry is refreshed first; the test fails when that refresh fails", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(
      json(200, { access_token: OAT, refresh_token: "r1", expires_in: 3600 }),
      json(400, { error: "invalid_grant" }),
      json(200, { access_token: `${OAT}-2`, refresh_token: "r2", expires_in: 28800 }),
      json(200, anthropicAnswer),
    );
    const { app, call, dash, key } = await ready(file, upstream);
    await signInClaude(dash);
    const connection = (await dash({ url: "/api/connections" })).json().find((c) => c.provider === "claude");
    const failed = (await dash({ method: "POST", url: `/api/connections/${connection.id}/test` })).json();
    assert.deepEqual([failed.testStatus, failed.lastError, failed.lastErrorCode], ["invalid", "Token expired and refresh failed", "AUTH_ERROR"]);
    assert.deepEqual(JSON.parse(upstream.calls[1].request.body), { grant_type: "refresh_token", refresh_token: "r1", client_id: "9d1c250a-e61b-44d9-88ed-5944d1962f5e" });
    const passed = (await dash({ method: "POST", url: `/api/connections/${connection.id}/test` })).json();
    assert.equal(passed.testStatus, "active", "a refreshed token passes");
    const chat = await call({ method: "POST", url: "/v1/chat/completions", headers: { authorization: `Bearer ${key}` }, body: { model: "claude/claude-sonnet-5", messages: [{ role: "user", content: "hi" }] } });
    assert.equal(chat.statusCode, 200);
    assert.equal(upstream.calls[3].request.headers.authorization, `Bearer ${OAT}-2`, "no second refresh: 8 hours left");
    await app.close();
  }));

test("codex: the fixed 1455 callback, the account from the id_token, and a non-streaming chat collapsed from codex's stream", () =>
  withTempDb(async (file) => {
    const idToken = jwt({ email: "ada@x.dev", "https://api.openai.com/auth": { chatgpt_account_id: "acc_1", chatgpt_plan_type: "plus" } });
    const upstream = fakeUpstream(
      json(200, { access_token: "codex-at", refresh_token: "codex-rt", id_token: idToken, expires_in: 864000 }),
      sse([{ type: "response.output_text.delta", delta: "Hi there" }, { type: "response.completed", response: { id: "resp_1", usage: { input_tokens: 4, output_tokens: 2 } } }]),
      json(400, { error: { message: "input must not be empty" } }),
      json(200, { models: [{ slug: "gpt-5.5" }] }),
    );
    const { app, call, dash, key } = await ready(file, upstream);
    const begun = (await dash({ url: "/api/oauth/codex/authorize?redirect_uri=http%3A%2F%2F127.0.0.1%3A20200%2Fcallback" })).json();
    assert.equal(begun.redirectUri, "http://localhost:1455/auth/callback", "codex returns only to its CLI's address");
    assert.match(begun.authUrl, /redirect_uri=http%3A%2F%2Flocalhost%3A1455%2Fauth%2Fcallback/);
    const signed = await dash({ method: "POST", url: "/api/oauth/codex/exchange", body: { code: "cx1", redirectUri: begun.redirectUri, codeVerifier: begun.codeVerifier, state: begun.state } });
    assert.deepEqual([signed.statusCode, signed.json().connection.email], [200, "ada@x.dev"]);
    const connection = (await dash({ url: "/api/connections" })).json().find((c) => c.provider === "codex");
    assert.deepEqual([connection.name, connection.accountId], ["ada@x.dev", "acc_1"]);

    const chat = await call({ method: "POST", url: "/v1/chat/completions", headers: { authorization: `Bearer ${key}` }, body: { model: "codex/gpt-5.5", stream: false, messages: [{ role: "user", content: "hi" }] } });
    assert.equal(chat.statusCode, 200);
    assert.equal(chat.json().choices[0].message.content, "Hi there");
    const sent = upstream.calls[1].request;
    assert.deepEqual([sent.url, sent.headers["chatgpt-account-id"], sent.headers.session_id, sent.headers.authorization], ["https://chatgpt.com/backend-api/codex/responses", "acc_1", connection.id, "Bearer codex-at"]);
    const body = JSON.parse(sent.body);
    assert.deepEqual([body.stream, body.store, body.prompt_cache_key], [true, false, connection.id]);
    assert.match(body.instructions, /^You are Codex/);

    const tested = (await dash({ method: "POST", url: `/api/connections/${connection.id}/test` })).json();
    assert.equal(tested.testStatus, "active", "a 400 on the empty probe means the token works (kept)");
    assert.deepEqual(JSON.parse(upstream.calls[2].request.body), { model: "gpt-5.3-codex", input: [], stream: false, store: false });
    const models = (await dash({ url: `/api/connections/${connection.id}/models` })).json();
    assert.deepEqual(models.models.map((m) => m.id), ["gpt-5.5", "gpt-5.5-review"]);
    await app.close();
  }));

test("codex: AIGate listens on 1455 while the sign-in waits and sends the browser on to the dashboard's /callback", () =>
  withTempDb(async (file) => {
    const { app, dash } = await ready(file, fakeUpstream());
    const relay = (query) => fetch(`http://127.0.0.1:1455/auth/callback?${query}`, { redirect: "manual" });
    const stale = (await dash({ url: "/api/oauth/codex/authorize?redirect_uri=http%3A%2F%2F127.0.0.1%3A5173%2Fcallback" })).json();
    const begun = (await dash({ url: "/api/oauth/codex/authorize?redirect_uri=http%3A%2F%2F127.0.0.1%3A20200%2Fcallback" })).json();
    assert.equal(begun.relayed, true, "port 1455 must be free for this test");
    assert.equal((await relay(`code=c&state=${stale.state}`)).status, 400, "only the latest sign-in is relayed");
    assert.equal((await fetch("http://127.0.0.1:1455/other", { redirect: "manual" })).status, 404);
    const sent = await relay(`code=cx1&scope=openid&state=${begun.state}`);
    assert.deepEqual([sent.status, sent.headers.get("location")], [302, `http://127.0.0.1:20200/callback?code=cx1&scope=openid&state=${begun.state}`]);
    await assert.rejects(relay(`code=again&state=${begun.state}`), "the listener closes after one callback");
    const pasteOnly = (await dash({ url: "/api/oauth/codex/authorize" })).json();
    assert.equal(pasteOnly.relayed, false, "no dashboard callback to relay to: paste only");
    await dash({ url: "/api/oauth/codex/authorize?redirect_uri=http%3A%2F%2F127.0.0.1%3A20200%2Fcallback" });
    await app.close();
    await assert.rejects(relay(`code=c&state=${begun.state}`), "closing the server stops the listener");
  }));

test("codex usage_limit_reached: the model test shows the reset; the account lock follows it, at most 30 minutes", () =>
  withTempDb(async (file) => {
    const resetsAt = Math.floor(Date.now() / 1000) + 7200;
    const upstream = fakeUpstream(
      json(200, { access_token: "codex-at", refresh_token: "codex-rt", id_token: jwt({ email: "ada@x.dev" }), expires_in: 864000 }),
      json(429, { error: { type: "usage_limit_reached", message: "The usage limit has been reached", resets_at: resetsAt } }),
    );
    const { app, dash } = await ready(file, upstream);
    await dash({ method: "POST", url: "/api/oauth/codex/exchange", body: { code: "c", redirectUri: "http://localhost:1455/auth/callback", codeVerifier: "v", state: "s" } });
    const probe = (await dash({ method: "POST", url: "/api/models/test", body: { model: "codex/gpt-5.5" } })).json();
    assert.deepEqual([probe.ok, probe.status], [false, 429]);
    assert.ok(probe.error.endsWith(`The usage limit has been reached (resets at ${new Date(resetsAt * 1000).toISOString()})`), probe.error);
    await app.close();

    const now = 1_000_000;
    const quota = (resetsAtMs) => new EngineError("QUOTA_EXHAUSTED", "x", { status: 429, resetsAtMs });
    assert.equal(fallbackCooldown(quota(now + 90_000), now), 90_000, "locked until the reset");
    assert.equal(fallbackCooldown(quota(now + 5 * 3600_000), now), 30 * 60_000, "capped at 30 minutes");
    assert.equal(fallbackCooldown(new EngineError("RATE_LIMIT", "x", { status: 429, resetsAtMs: now - 1 }), now), 2_000, "a past reset leaves the code's cooldown");
  }));

test("codex: a token within 5 days of expiry is refreshed before the request", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(
      json(200, { access_token: "old", refresh_token: "rt", id_token: jwt({ email: "a@x.dev" }), expires_in: 4 * 86400 }),
      json(200, { access_token: "new", expires_in: 10 * 86400 }),
      sse([{ type: "response.completed", response: { id: "r", usage: {} } }]),
    );
    const { app, call, dash, key } = await ready(file, upstream);
    await dash({ method: "POST", url: "/api/oauth/codex/exchange", body: { code: "c", redirectUri: "http://localhost:1455/auth/callback", codeVerifier: "v", state: "s" } });
    const chat = await call({ method: "POST", url: "/v1/chat/completions", headers: { authorization: `Bearer ${key}` }, body: { model: "codex/gpt-5.5", messages: [{ role: "user", content: "hi" }] } });
    assert.equal(chat.statusCode, 200);
    assert.deepEqual(JSON.parse(upstream.calls[1].request.body), { client_id: "app_EMoamEEZ73f0CkXaXp7hrann", grant_type: "refresh_token", refresh_token: "rt" });
    assert.equal(upstream.calls[2].request.headers.authorization, "Bearer new");
    await app.close();
  }));

test("codex: a token whose last refresh is more than 8 days old is due, whatever its expiry; others follow their lead", () =>
  withTempDb(async (file) => {
    const { app } = await ready(file, fakeUpstream());
    const refresher = app.get(TokenRefresher);
    const days = (n) => new Date(Date.now() + n * 86_400_000);
    const stored = (oauth) => ({ id: "c", apiKey: "k", oauth: { refreshToken: "r", ...oauth } });
    assert.equal(refresher.due("codex", stored({ expiresAt: days(30), lastRefreshAt: days(-9) })), true);
    assert.equal(refresher.due("codex", stored({ expiresAt: days(30), lastRefreshAt: days(-7) })), false);
    assert.equal(refresher.due("codex", stored({ expiresAt: days(30), lastRefreshAt: null })), true, "never refreshed");
    assert.equal(refresher.due("claude", stored({ expiresAt: days(30), lastRefreshAt: null })), false, "only codex has a maximum age");
    assert.equal(refresher.due("cline", stored({ expiresAt: days(0.002), lastRefreshAt: null })), true, "5 minutes by default");
    assert.equal(refresher.due("cline", { id: "c", apiKey: "k" }), false, "an API key is never due");
    await app.close();
  }));

test("github: device sign-in (slow_down passed through), the Copilot token as bearer, a 401 renews it from the GitHub token, the test reads /user", () =>
  withTempDb(async (file) => {
    const inSeconds = (s) => Math.floor(Date.now() / 1000) + s;
    const upstream = fakeUpstream(
      json(200, { device_code: "dc", user_code: "ABCD-1234", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 5 }),
      json(200, { error: "slow_down" }),
      json(200, { access_token: "gho_1" }),
      json(200, { token: "tid=1", expires_at: inSeconds(1500) }),
      json(200, { id: 7, login: "ada", email: "ada@x.dev" }),
      json(401, { error: { message: "expired" } }),
      json(200, { token: "tid=2", expires_at: inSeconds(1500) }),
      json(200, { id: "c", model: "gpt-5.4", choices: [{ message: { content: "ok" }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1 } }),
      json(200, { login: "ada" }),
    );
    const { app, call, dash, key } = await ready(file, upstream, { refreshRetryDelayMs: 0 });
    const device = (await dash({ url: "/api/oauth/github/device-code" })).json();
    assert.deepEqual([device.user_code, device.verification_uri_complete], ["ABCD-1234", "https://github.com/login/device"]);
    const slow = (await dash({ method: "POST", url: "/api/oauth/github/poll", body: { deviceCode: device.device_code } })).json();
    assert.deepEqual(slow, { success: false, error: "slow_down", pending: true });
    const approved = (await dash({ method: "POST", url: "/api/oauth/github/poll", body: { deviceCode: device.device_code } })).json();
    assert.equal(approved.success, true);
    const connection = (await dash({ url: "/api/connections" })).json().find((c) => c.provider === "github");
    assert.deepEqual([connection.name, connection.email, connection.authType], ["ada", "ada@x.dev", "oauth"]);

    const chat = await call({ method: "POST", url: "/v1/chat/completions", headers: { authorization: `Bearer ${key}` }, body: { model: "github/gpt-5.4", messages: [{ role: "user", content: "hi" }] } });
    assert.equal(chat.statusCode, 200);
    assert.deepEqual([upstream.calls[5].request.url, upstream.calls[5].request.headers.authorization], ["https://api.githubcopilot.com/chat/completions", "Bearer tid=1"]);
    assert.deepEqual([upstream.calls[6].request.url, upstream.calls[6].request.headers.authorization], ["https://api.github.com/copilot_internal/v2/token", "token gho_1"], "a 401 renews the Copilot token");
    assert.equal(upstream.calls[7].request.headers.authorization, "Bearer tid=2");
    const tested = (await dash({ method: "POST", url: `/api/connections/${connection.id}/test` })).json();
    assert.equal(tested.testStatus, "active");
    assert.deepEqual([upstream.calls[8].request.url, upstream.calls[8].request.headers.authorization], ["https://api.github.com/user", "Bearer gho_1"], "the test uses the GitHub token");
    await app.get(TokenRefresher)["background"]();
    assert.equal(upstream.calls.length, 9, "the background loop leaves the short Copilot token alone");
    await app.close();
  }));

test("gemini-cli: Google sign-in finds the project, chat goes in the Cloud Code envelope with it, a 401 refreshes, test and models use Cloud Code", () =>
  withTempDb(async (file) => {
    const answer = { response: { responseId: "g", modelVersion: "gemini-2.5-flash", candidates: [{ content: { parts: [{ text: "hello" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 } } };
    const upstream = fakeUpstream(
      json(200, { access_token: "ya29.one", refresh_token: "1//rt", expires_in: 3599, scope: "s" }),
      json(200, { email: "ada@gmail.com" }),
      json(200, { cloudaicompanionProject: "proj-7" }),
      json(401, { error: { code: 401, message: "expired" } }),
      json(200, { access_token: "ya29.two", expires_in: 3599 }),
      json(200, answer),
      json(200, {}),
      json(200, { models: { "gemini-2.5-pro": {}, "gemini-x": {} } }),
    );
    const { app, call, dash, key } = await ready(file, upstream, { refreshRetryDelayMs: 0 });
    const authorize = () => dash({ url: "/api/oauth/gemini-cli/authorize?redirect_uri=http%3A%2F%2F127.0.0.1%3A20200%2Fcallback" });
    // The client comes from .env; without it the sign-in names the variables to set.
    delete process.env.AIGATE_GEMINI_CLI_OAUTH_CLIENT_ID;
    const missing = await authorize();
    assert.deepEqual([missing.statusCode, missing.json().code], [400, "INVALID_REQUEST"]);
    assert.match(missing.json().message, /AIGATE_GEMINI_CLI_OAUTH_CLIENT_ID and AIGATE_GEMINI_CLI_OAUTH_CLIENT_SECRET in AIGate's \.env/);
    process.env.AIGATE_GEMINI_CLI_OAUTH_CLIENT_ID = "test-gemini-client.apps.googleusercontent.com";
    process.env.AIGATE_GEMINI_CLI_OAUTH_CLIENT_SECRET = "test-gemini-secret";
    const begun = (await authorize()).json();
    assert.equal(begun.redirectUri, "http://127.0.0.1:20200/callback");
    assert.match(begun.authUrl, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?client_id=test-gemini-client/);
    const signed = await dash({ method: "POST", url: "/api/oauth/gemini-cli/exchange", body: { code: "4/c", redirectUri: begun.redirectUri, codeVerifier: begun.codeVerifier, state: begun.state } });
    assert.deepEqual([signed.statusCode, signed.json().connection.email], [200, "ada@gmail.com"]);
    const connection = (await dash({ url: "/api/connections" })).json().find((c) => c.provider === "gemini-cli");
    assert.deepEqual([connection.name, connection.authType], ["ada@gmail.com", "oauth"]);

    const chat = await call({ method: "POST", url: "/v1/chat/completions", headers: { authorization: `Bearer ${key}` }, body: { model: "gemini-cli/gemini-2.5-flash", stream: false, messages: [{ role: "user", content: "hi" }] } });
    assert.equal(chat.statusCode, 200);
    assert.equal(chat.json().choices[0].message.content, "hello");
    const [first, refresh, retried] = [3, 4, 5].map((i) => upstream.calls[i].request);
    assert.deepEqual([first.url, first.headers.authorization, JSON.parse(first.body).project], ["https://cloudcode-pa.googleapis.com/v1internal:generateContent", "Bearer ya29.one", "proj-7"]);
    assert.deepEqual([refresh.url, new URLSearchParams(refresh.body).get("refresh_token")], ["https://oauth2.googleapis.com/token", "1//rt"], "a 401 refreshes the Google token");
    assert.deepEqual([retried.headers.authorization, JSON.parse(retried.body).project], ["Bearer ya29.two", "proj-7"], "the refresh keeps the project");

    const tested = (await dash({ method: "POST", url: `/api/connections/${connection.id}/test` })).json();
    assert.equal(tested.testStatus, "active");
    assert.deepEqual([upstream.calls[6].request.url, upstream.calls[6].request.headers.authorization], ["https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist", "Bearer ya29.two"]);
    const models = (await dash({ url: `/api/connections/${connection.id}/models` })).json();
    assert.deepEqual(models.models, [{ id: "gemini-2.5-pro", inCatalog: true }, { id: "gemini-x", inCatalog: false }]);
    assert.deepEqual(JSON.parse(upstream.calls[7].request.body), { project: "proj-7" });
    await app.close();
  }));
