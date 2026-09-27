// Contract: docs/contracts/oauth.md — signing in to cline, kilocode, kimchi, gitlab from the dashboard, and the refresh.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { completion, fakeUpstream, json, ready } from "./lane-helpers.mjs";

const JWT = (n) => `eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ${n}In0.sig`;
const code = (value) => Buffer.from(JSON.stringify(value)).toString("base64");
const inSeconds = (s) => new Date(Date.now() + s * 1000).toISOString();
const hello = (model) => ({ model, messages: [{ role: "user", content: "hi" }] });
const empty = (status) => () => ({ status, headers: {}, body: new Response("").body });

test("cline: sign in with the callback code, refresh before a request and after a 401", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(
      json(200, { data: { accessToken: JWT(2), refreshToken: "r2", expiresAt: inSeconds(3600) } }),
      json(200, completion),
      json(403, { error: { message: "expired" } }),
      json(200, { data: { accessToken: `workos:${JWT(3)}`, refreshToken: "r3", expiresAt: inSeconds(3600) } }),
      json(200, completion),
      json(500, { error: { message: "down" } }),
      json(401, {}),
      json(401, {}), json(401, {}), json(401, {}),
    );
    const { app, call, dash, key } = await ready(file, upstream, { refreshRetryDelayMs: 0 });
    const chat = (model) => call({ method: "POST", url: "/v1/chat/completions", body: hello(model), headers: { authorization: `Bearer ${key}` } });

    const start = await dash({ url: "/api/oauth/cline/authorize?redirect_uri=http%3A%2F%2F127.0.0.1%3A20200%2Fcallback" });
    assert.equal(start.statusCode, 200);
    assert.equal(start.headers["cache-control"], "no-store");
    const begun = start.json();
    assert.deepEqual([begun.flowType, begun.redirectUri, begun.callbackPath, begun.codeVerifier.length], ["authorization_code", "http://127.0.0.1:20200/callback", "/callback", 43]);
    assert.ok(begun.authUrl.startsWith("https://api.cline.bot/api/v1/auth/authorize?client_type=extension&callback_url=http%3A%2F%2F127.0.0.1%3A20200%2Fcallback"));

    const signed = await dash({ method: "POST", url: "/api/oauth/cline/exchange", body: {
      code: code({ accessToken: JWT(1), refreshToken: "r1", email: "ada@x.dev", firstName: "Ada", expiresAt: inSeconds(60) }), redirectUri: begun.redirectUri, state: begun.state,
    } });
    assert.equal(signed.statusCode, 200);
    assert.deepEqual({ ...signed.json(), connection: { ...signed.json().connection, id: typeof signed.json().connection.id } },
      { success: true, connection: { id: "string", provider: "cline", email: "ada@x.dev", displayName: null } });
    const listed = (await dash({ url: "/api/connections" })).json().find((c) => c.provider === "cline");
    assert.deepEqual([listed.authType, listed.email, listed.name, listed.testStatus, listed.keyHint], ["oauth", "ada@x.dev", "ada@x.dev", "active", "••••.sig"]);
    assert.ok(new Date(listed.expiresAt).getTime() - Date.now() <= 60_000);
    assert.equal(upstream.calls.length, 0, "the code carried the tokens");
    const replaced = await dash({ method: "PATCH", url: `/api/connections/${listed.id}`, body: { apiKey: "sk-some-key-123" } });
    assert.deepEqual([replaced.statusCode, replaced.json().message], [400, "This connection signs in with OAuth; sign in again to replace its token"]);

    assert.equal((await chat("cline/anthropic/claude-sonnet-4.6")).statusCode, 200);
    assert.deepEqual([upstream.calls[0].request.url, JSON.parse(upstream.calls[0].request.body)], ["https://api.cline.bot/api/v1/auth/refresh", { refreshToken: "r1", grantType: "refresh_token", clientType: "extension" }],
      "a token that expires within 5 minutes is refreshed first");
    assert.deepEqual([upstream.calls[1].request.headers.authorization, upstream.calls[1].request.headers["x-client-type"]], [`Bearer workos:${JWT(2)}`, "aigate"]);
    const refreshed = (await dash({ url: "/api/connections" })).json().find((c) => c.provider === "cline");
    assert.ok(new Date(refreshed.expiresAt).getTime() - Date.now() > 3_000_000);

    assert.equal((await chat("cline/anthropic/claude-sonnet-4.6")).statusCode, 200, "a 401 refreshes the token and sends the request again");
    assert.deepEqual([upstream.calls[3].request.url, JSON.parse(upstream.calls[3].request.body).refreshToken], ["https://api.cline.bot/api/v1/auth/refresh", "r2"]);
    assert.equal(upstream.calls[4].request.headers.authorization, `Bearer workos:${JWT(3)}`);
    const down = await chat("cline/anthropic/claude-sonnet-4.6");
    assert.deepEqual([down.statusCode, upstream.calls.length], [502, 6], "only a 401 or 403 refreshes the token");

    const failed = await chat("cline/anthropic/claude-sonnet-4.6");
    assert.deepEqual([failed.statusCode, failed.json().error.code], [502, "upstream_auth_error"], "three refused refreshes, then the 401 reaches the client");
    assert.equal(upstream.calls.length, 10);
    await app.close();
  }));

test("concurrent requests share one proactive refresh of a connection", () =>
  withTempDb(async (file) => {
    const slowRefresh = async (_request, ctx) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return json(200, { data: { accessToken: JWT(5), refreshToken: "r5", expiresAt: inSeconds(3600) } })(_request, ctx);
    };
    const upstream = fakeUpstream(slowRefresh, json(200, completion), json(200, completion));
    const { app, call, dash, key } = await ready(file, upstream, { refreshRetryDelayMs: 0 });
    await dash({ method: "POST", url: "/api/oauth/cline/exchange", body: { code: code({ accessToken: JWT(4), refreshToken: "r4", email: "c@x.dev", expiresAt: inSeconds(30) }), redirectUri: "http://cb" } });
    const chat = () => call({ method: "POST", url: "/v1/chat/completions", body: hello("cline/anthropic/claude-sonnet-4.6"), headers: { authorization: `Bearer ${key}` } });
    const answers = await Promise.all([chat(), chat()]);
    assert.deepEqual(answers.map((res) => res.statusCode), [200, 200]);
    assert.equal(upstream.calls.filter((c) => c.request.url.endsWith("/auth/refresh")).length, 1, "one refresh for both requests");
    assert.deepEqual(upstream.calls.slice(1).map((c) => c.request.headers.authorization), [`Bearer workos:${JWT(5)}`, `Bearer workos:${JWT(5)}`]);
    await app.close();
  }));

test("kilocode: the device code is polled; the organization header follows; one account per provider", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(
      json(200, { code: "DEV1", verificationUrl: "https://kilo.example/device/DEV1", expiresIn: 600 }),
      empty(202),
      json(200, { status: "approved", token: "kilo-token-1", userEmail: "k@x.dev" }), json(200, { organizations: [{ id: "org_7" }] }),
      json(200, completion),
      json(200, { status: "approved", token: "kilo-token-2", userEmail: "other@x.dev" }), json(200, { organizations: [] }),
      json(200, { status: "approved", token: "kilo-token-3", userEmail: "k@x.dev" }), json(200, { organizations: [{ id: "org_8" }] }),
      json(401, {}),
    );
    const { app, call, dash, key } = await ready(file, upstream, { refreshRetryDelayMs: 0 });
    const poll = () => dash({ method: "POST", url: "/api/oauth/kilocode/poll", body: { deviceCode: "DEV1" } });

    const device = (await dash({ url: "/api/oauth/kilocode/device-code" })).json();
    assert.deepEqual([device.device_code, device.user_code, device.interval, device.codeVerifier.length], ["DEV1", "DEV1", 3, 43]);
    assert.deepEqual((await poll()).json(), { success: false, error: "authorization_pending", pending: true });
    const approved = (await poll()).json();
    assert.deepEqual([approved.success, approved.connection.provider], [true, "kilocode"]);
    const row = (await dash({ url: "/api/connections" })).json().find((c) => c.provider === "kilocode");
    assert.deepEqual([row.organization, row.email, row.expiresAt, row.authType], ["org_7", "k@x.dev", null, "oauth"]);

    const chat = await call({ method: "POST", url: "/v1/chat/completions", body: hello("kilocode/openai/gpt-4.1"), headers: { authorization: `Bearer ${key}` } });
    assert.equal(chat.statusCode, 200);
    assert.deepEqual([upstream.calls[4].request.headers["x-kilocode-organizationid"], upstream.calls[4].request.headers.authorization], ["org_7", "Bearer kilo-token-1"]);

    const other = await poll();
    assert.deepEqual([other.statusCode, other.json().code], [409, "ALREADY_CONNECTED"]);
    assert.match(other.json().message, /Kilo Code is already connected with another account/);
    const again = await poll();
    assert.equal(again.json().success, true, "the same account signs in again");
    assert.deepEqual((await dash({ url: "/api/connections" })).json().filter((c) => c.provider === "kilocode").map((c) => [c.id, c.organization]), [[row.id, "org_8"]]);

    // An API-key connection has no refresh token: the 401 goes back after the three attempts, with no refresh call.
    const openai = await call({ method: "POST", url: "/v1/chat/completions", body: hello("openai/gpt-4.1"), headers: { authorization: `Bearer ${key}` } });
    assert.equal(openai.statusCode, 502);
    assert.equal(upstream.calls.length, 10);
    await app.close();
  }));

test("sign-in rules and errors: sign-in-only providers, the provider's refusals, unknown steps", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(json(401, {}), json(400, "invalid_grant"));
    const { app, dash } = await ready(file, upstream, { refreshRetryDelayMs: 0 });
    const keyed = await dash({ method: "POST", url: "/api/connections", body: { provider: "kilocode", apiKey: "kilo-key-12345" } });
    assert.deepEqual([keyed.statusCode, keyed.json().message], [400, "Kilo Code connects by signing in, not with an API key"]);
    assert.equal((await dash({ method: "POST", url: "/api/connections", body: { provider: "kimchi", apiKey: "kimchi-key-12345" } })).statusCode, 201, "kimchi also takes a key");

    const blank = await dash({ method: "POST", url: "/api/oauth/kimchi/exchange", body: { code: "   ", redirectUri: "http://cb" } });
    assert.deepEqual([blank.statusCode, blank.json()], [400, { code: "INVALID_REQUEST", message: "Missing Kimchi token" }]);
    const kimchi = await dash({ method: "POST", url: "/api/oauth/kimchi/exchange", body: { code: "tok", redirectUri: "http://cb" } });
    assert.deepEqual([kimchi.statusCode, kimchi.json()], [502, { code: "OAUTH_FAILED", message: "Kimchi token validation failed: 401" }]);
    const gitlab = await dash({ method: "POST", url: "/api/oauth/gitlab/exchange", body: { code: "c", redirectUri: "http://cb" } });
    assert.deepEqual([gitlab.statusCode, gitlab.json().code], [400, "INVALID_REQUEST"], "gitlab needs the PKCE verifier");
    const refused = await dash({ method: "POST", url: "/api/oauth/gitlab/exchange", body: { code: "c", redirectUri: "http://cb", codeVerifier: "v", meta: { clientId: "app1" } } });
    assert.deepEqual([refused.statusCode, refused.json().message], [502, "GitLab token exchange failed: \"invalid_grant\""]);
    const start = (await dash({ url: "/api/oauth/gitlab/authorize?clientId=app1&baseUrl=https%3A%2F%2Fgit.example" })).json();
    assert.deepEqual([start.redirectUri, start.flowType, new URL(start.authUrl).searchParams.get("client_id"), new URL(start.authUrl).origin],
      ["http://localhost:8080/callback", "authorization_code_pkce", "app1", "https://git.example"]);
    assert.equal((await dash({ url: "/api/oauth/kilocode/authorize" })).json().authUrl, null, "a device flow has no URL");

    for (const [url, method, body, code] of [
      ["/api/oauth/openai/authorize", "GET", undefined, "PROVIDER_NOT_SUPPORTED"], ["/api/oauth/cline/nope", "GET", undefined, "INVALID_REQUEST"],
      ["/api/oauth/cline/device-code", "GET", undefined, "INVALID_REQUEST"], ["/api/oauth/cline/nope", "POST", {}, "INVALID_REQUEST"],
      ["/api/oauth/kilocode/poll", "POST", {}, "INVALID_REQUEST"], ["/api/oauth/cline/poll", "POST", { deviceCode: "x" }, "INVALID_REQUEST"],
    ]) {
      const res = await dash({ method, url, body });
      assert.deepEqual([res.statusCode, res.json().code], [400, code], url);
    }
    assert.equal(upstream.calls.length, 2);
    await app.close();
  }));
