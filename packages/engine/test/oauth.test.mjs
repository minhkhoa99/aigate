// Contract: docs/contracts/oauth.md — OAuth sign-in and refresh for cline, clinepass, gitlab, kilocode, kimchi.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { builtinRegistry, clineAccessToken, createAdapter, EngineError, generatePkce, OAUTH_PROVIDERS, withConnection } from "../dist/index.js";

const reply = (status, value) => ({ status, headers: { "content-type": "application/json" }, body: new Response(typeof value === "string" ? value : JSON.stringify(value)).body });
function fakeTransport(...answers) {
  const calls = [];
  return {
    calls,
    async send(request) {
      calls.push(request);
      const next = answers.shift();
      if (next === undefined) throw new Error("unexpected transport call");
      if (next instanceof Error) throw next;
      return next;
    },
  };
}
const io = (transport) => ({ transport, ctx: { signal: new AbortController().signal, requestId: "r" } });
const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig";
const base64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64").replace(/=+$/, "");
const inAnHour = () => new Date(Date.now() + 3_600_000).toISOString();

test("PKCE is 9router's: a 32-byte base64url verifier, its S256 challenge, a 32-byte state", async () => {
  const { codeVerifier, codeChallenge, state } = await generatePkce();
  assert.match(codeVerifier, /^[A-Za-z0-9_-]{43}$/);
  assert.match(state, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(codeChallenge, createHash("sha256").update(codeVerifier).digest("base64url"));
  assert.notEqual((await generatePkce()).codeVerifier, codeVerifier);
});

test("cline: the code is base64 JSON of the tokens, else the token endpoint; refresh prefixes workos:", async () => {
  const cline = OAUTH_PROVIDERS.cline;
  assert.equal(cline.flow, "authorization_code");
  assert.equal(cline.authUrl("http://localhost:1/callback", "s", "c", {}),
    "https://api.cline.bot/api/v1/auth/authorize?client_type=extension&callback_url=http%3A%2F%2Flocalhost%3A1%2Fcallback&redirect_uri=http%3A%2F%2Flocalhost%3A1%2Fcallback");
  const none = fakeTransport();
  const code = base64({ accessToken: JWT, refreshToken: "r1", email: "a@x.dev", firstName: "Ada", lastName: "L", expiresAt: inAnHour() });
  const tokens = await cline.exchange(code, "cb", "", {}, io(none));
  assert.deepEqual({ ...tokens, expiresIn: tokens.expiresIn > 3500 && tokens.expiresIn <= 3600 }, { accessToken: JWT, refreshToken: "r1", expiresIn: true, email: "a@x.dev", data: { firstName: "Ada", lastName: "L" } });
  assert.equal(none.calls.length, 0);
  const trailing = await cline.exchange(Buffer.from(`${JSON.stringify({ accessToken: "t" })}xx`).toString("base64"), "cb", "", {}, io(none));
  assert.deepEqual([trailing.accessToken, trailing.expiresIn, trailing.data], ["t", 3600, {}], "text after the last } is ignored; no expiry means an hour");

  const exchanged = fakeTransport(reply(200, { data: { accessToken: "t2", refreshToken: "r2", userInfo: { email: "b@x.dev" }, expiresAt: inAnHour() } }));
  const fallback = await cline.exchange("not base64!", "http://cb", "", {}, io(exchanged));
  assert.deepEqual([fallback.accessToken, fallback.refreshToken, fallback.email], ["t2", "r2", "b@x.dev"]);
  assert.deepEqual([exchanged.calls[0].url, exchanged.calls[0].method, JSON.parse(exchanged.calls[0].body)],
    ["https://api.cline.bot/api/v1/auth/token", "POST", { grant_type: "authorization_code", code: "not base64!", client_type: "extension", redirect_uri: "http://cb" }]);
  const root = await cline.exchange("!!", "cb", "", {}, io(fakeTransport(reply(200, { accessToken: "t3" }))));
  assert.equal(root.accessToken, "t3", "the answer may carry the tokens at the root");
  await assert.rejects(OAUTH_PROVIDERS.clinepass.exchange("!!", "cb", "", {}, io(fakeTransport(reply(400, "bad code")))),
    (e) => e instanceof EngineError && e.code === "PROVIDER_UNAVAILABLE" && e.message === "ClinePass token exchange failed: bad code");
  await assert.rejects(cline.exchange(base64({ refreshToken: "only" }), "cb", "", {}, io(none)), /no access token/);

  const refreshing = fakeTransport(reply(200, { data: { accessToken: "new", expiresAt: new Date(Date.now() - 5000).toISOString() } }));
  assert.deepEqual(await cline.refresh("r1", io(refreshing)), { accessToken: "workos:new", refreshToken: "r1", expiresIn: 1, data: {} });
  assert.deepEqual([refreshing.calls[0].url, JSON.parse(refreshing.calls[0].body)], ["https://api.cline.bot/api/v1/auth/refresh", { refreshToken: "r1", grantType: "refresh_token", clientType: "extension" }]);
  assert.deepEqual(await cline.refresh("r1", io(fakeTransport(reply(200, { accessToken: "workos:kept", refreshToken: "r9" })))), { accessToken: "workos:kept", refreshToken: "r9", data: {} });
  assert.equal(await cline.refresh("r1", io(fakeTransport(reply(401, { data: { accessToken: "stale" } })))), null, "a refused refresh gives nothing, whatever its body");
  assert.equal(await cline.refresh("r1", io(fakeTransport(reply(200, { data: {} })))), null);
  assert.deepEqual([clineAccessToken(JWT), clineAccessToken(`workos:${JWT}`), clineAccessToken("clp_apikey123")], [`workos:${JWT}`, `workos:${JWT}`, "clp_apikey123"]);
});

test("gitlab: PKCE with the operator's application; user info in the data; no refresher", async () => {
  const gitlab = OAUTH_PROVIDERS.gitlab;
  const url = new URL(gitlab.authUrl("http://cb", "st", "ch", { baseUrl: "https://git.example", clientId: "app1" }));
  assert.equal(`${url.origin}${url.pathname}`, "https://git.example/oauth/authorize");
  assert.deepEqual(Object.fromEntries(url.searchParams), { client_id: "app1", redirect_uri: "http://cb", response_type: "code", state: "st", scope: "api read_user", code_challenge: "ch", code_challenge_method: "S256" });
  assert.equal(new URL(gitlab.authUrl("http://cb", "st", "ch", {})).origin, "https://gitlab.com");
  const transport = fakeTransport(reply(200, { access_token: "g1", refresh_token: "gr", expires_in: 7200, scope: "api" }), reply(200, { username: "ada", public_email: "ada@git.example", name: "Ada" }));
  const tokens = await gitlab.exchange("code1", "http://cb", "ver", { baseUrl: "https://git.example", clientId: "app1", clientSecret: "sec" }, io(transport));
  assert.deepEqual(tokens, { accessToken: "g1", refreshToken: "gr", expiresIn: 7200, data: { username: "ada", email: "ada@git.example", name: "Ada", baseUrl: "https://git.example", clientId: "app1", authKind: "oauth", scope: "api" } });
  assert.equal(transport.calls[0].url, "https://git.example/oauth/token");
  assert.deepEqual(Object.fromEntries(new URLSearchParams(transport.calls[0].body)), { client_id: "app1", grant_type: "authorization_code", code: "code1", redirect_uri: "http://cb", code_verifier: "ver", client_secret: "sec" });
  assert.deepEqual([transport.calls[1].url, transport.calls[1].headers.authorization], ["https://git.example/api/v4/user", "Bearer g1"]);
  const bare = await gitlab.exchange("c", "cb", "v", {}, io(fakeTransport(reply(200, { access_token: "g2" }), reply(403, { username: "not-read" }))));
  assert.deepEqual(bare, { accessToken: "g2", data: { baseUrl: "https://gitlab.com", authKind: "oauth" } });
  await assert.rejects(gitlab.exchange("c", "cb", "v", {}, io(fakeTransport(reply(400, "invalid_grant")))), /GitLab token exchange failed: invalid_grant/);
  assert.equal(gitlab.refresh, undefined);
});

test("kilocode: a device code, its poll statuses, and the organization from the profile", async () => {
  const kilo = OAUTH_PROVIDERS.kilocode;
  const start = fakeTransport(reply(200, { code: "ABCD", verificationUrl: "https://kilo.example/device/ABCD", expiresIn: 600 }));
  assert.deepEqual(await kilo.deviceCode(io(start)), { device_code: "ABCD", user_code: "ABCD", verification_uri: "https://kilo.example/device/ABCD", verification_uri_complete: "https://kilo.example/device/ABCD", expires_in: 600, interval: 3 });
  assert.deepEqual([start.calls[0].url, start.calls[0].method], ["https://api.kilo.ai/api/device-auth/codes", "POST"]);
  assert.equal((await kilo.deviceCode(io(fakeTransport(reply(200, { code: "X", verificationUrl: "u" }))))).expires_in, 300);
  await assert.rejects(kilo.deviceCode(io(fakeTransport(reply(429, {})))), (e) => e.code === "RATE_LIMIT" && /Too many pending/.test(e.message));
  await assert.rejects(kilo.deviceCode(io(fakeTransport(reply(500, "down")))), /Device auth initiation failed: down/);
  await assert.rejects(kilo.deviceCode(io(fakeTransport(reply(200, {})))), /no device code/);
  const poll = (...answers) => kilo.poll("A/B", io(fakeTransport(...answers)));
  assert.deepEqual(await poll(reply(202, {})), { status: "pending" });
  assert.deepEqual(await poll(reply(403, {})), { status: "error", error: "access_denied", description: "Authorization denied by user" });
  assert.deepEqual(await poll(reply(410, {})), { status: "error", error: "expired_token", description: "Authorization code expired" });
  assert.deepEqual(await poll(reply(500, {})), { status: "error", error: "poll_failed", description: "Poll failed: 500" });
  assert.deepEqual(await poll(reply(200, { status: "pending", token: "early" })), { status: "pending" }, "a token only counts once approved");
  const approved = fakeTransport(reply(200, { status: "approved", token: "k1", userEmail: "k@x.dev" }), reply(200, { organizations: [{ id: "org_7" }] }));
  assert.deepEqual(await kilo.poll("A/B", io(approved)), { status: "approved", tokens: { accessToken: "k1", email: "k@x.dev", data: { orgId: "org_7" } } });
  assert.deepEqual([approved.calls[0].url, approved.calls[1].url, approved.calls[1].headers.authorization],
    ["https://api.kilo.ai/api/device-auth/codes/A%2FB", "https://api.kilo.ai/api/profile", "Bearer k1"]);
  assert.deepEqual(await poll(reply(200, { status: "approved", token: "k2" }), new Error("network")), { status: "approved", tokens: { accessToken: "k2", data: {} } }, "a failed profile read is ignored");
  assert.deepEqual(await poll(reply(200, { status: "approved", token: "k3" }), reply(500, { organizations: [{ id: "org_x" }] })), { status: "approved", tokens: { accessToken: "k3", data: {} } });
  assert.equal(kilo.refresh, undefined);
});

test("kimchi: the browser token is checked against cast.ai; user info names the account", async () => {
  const kimchi = OAUTH_PROVIDERS.kimchi;
  assert.equal(kimchi.authUrl("http://cb", "st", "", {}), "https://app.kimchi.dev/cli-auth?callback=http%3A%2F%2Fcb&state=st");
  const transport = fakeTransport(reply(200, []), reply(200, { id: 42, username: "kim", email: "kim@x.dev" }));
  assert.deepEqual(await kimchi.exchange("  tok  ", "", "", {}, io(transport)), { accessToken: "tok", email: "kim@x.dev", displayName: "kim", data: { authMethod: "browser_token", userId: "42", username: "kim" } });
  assert.deepEqual([transport.calls[0].url, transport.calls[0].headers.authorization, transport.calls[1].url], ["https://api.cast.ai/v1/llm/openai/supported-providers", "Bearer tok", "https://app.kimchi.dev/api/v1/me"]);
  assert.deepEqual(await kimchi.exchange("tok", "", "", {}, io(fakeTransport(reply(200, []), reply(200, { id: "7", name: "Kim C" })))),
    { accessToken: "tok", email: "kimchi-user-7", displayName: "Kim C", data: { authMethod: "browser_token", userId: "7" } });
  assert.deepEqual(await kimchi.exchange("tok", "", "", {}, io(fakeTransport(reply(200, []), new Error("down")))), { accessToken: "tok", data: { authMethod: "browser_token" } });
  await assert.rejects(kimchi.exchange(" ", "", "", {}, io(fakeTransport())), (e) => e.code === "INVALID_REQUEST");
  await assert.rejects(kimchi.exchange("tok", "", "", {}, io(fakeTransport(reply(401, {})))), (e) => e.code === "AUTH_ERROR" && e.message === "Kimchi token validation failed: 401");
});

test("the registry signs in to the five providers; Cline tokens go as workos:, Kilo Code's organization in its header, Kimchi's body is adjusted", async () => {
  assert.deepEqual(["cline", "clinepass", "gitlab", "kilocode", "kimchi"].map((id) => builtinRegistry.provider(id).oauth),
    ["authorization_code", "authorization_code", "authorization_code_pkce", "device_code", "browser_token"]);
  assert.equal(builtinRegistry.provider("openai").oauth, undefined);
  const kilo = withConnection(builtinRegistry.provider("kilocode"), { organization: "org_7" });
  assert.equal(kilo.headers["x-kilocode-organizationid"], "org_7");
  assert.equal(withConnection(builtinRegistry.provider("openai"), { organization: "org_o" }).headers["openai-organization"], "org_o", "OpenAI-Organization otherwise");
  assert.equal(withConnection(builtinRegistry.provider("kilocode"), {}), builtinRegistry.provider("kilocode"));

  const answer = { id: "c", model: "m", choices: [{ message: { content: "hi" }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1 } };
  const ctx = { signal: new AbortController().signal, requestId: "r" };
  const cline = fakeTransport(reply(200, answer));
  await createAdapter(builtinRegistry.provider("cline"), cline).execute({ model: "anthropic/claude-sonnet-4.6", stream: false, messages: [{ role: "user", content: [{ type: "text", text: "q" }] }] }, { kind: "api-key", apiKey: JWT }, ctx);
  assert.deepEqual([cline.calls[0].headers.authorization, cline.calls[0].headers["x-client-type"], cline.calls[0].headers["x-title"]], [`Bearer workos:${JWT}`, "aigate", "Cline"]);

  const kimchi = fakeTransport(reply(200, answer), reply(200, answer));
  const history = [
    { role: "user", content: [{ type: "text", text: "q" }] },
    { role: "assistant", content: [{ type: "thinking", text: "a long line of reasoning" }, { type: "text", text: "ok" }] },
    { role: "assistant", content: [{ type: "thinking", text: " " }, { type: "text", text: "short" }] },
  ];
  const extensions = { openai: { top_k: 3, thinking: { type: "enabled" }, system: "be brief", mcp_servers: [] } };
  await createAdapter(builtinRegistry.provider("kimchi"), kimchi).execute({ model: "claude-sonnet-4-6", stream: false, system: [{ type: "text", text: "rules" }], messages: history, reasoning: { effort: "high" }, vendorExtensions: extensions }, { kind: "api-key", apiKey: "kimchi-token-1" }, ctx);
  const sent = JSON.parse(kimchi.calls[0].body);
  assert.deepEqual([sent.top_k, sent.thinking, sent.system, sent.mcp_servers, sent.reasoning_effort], [undefined, undefined, undefined, undefined, undefined]);
  assert.deepEqual(sent.messages, [
    { role: "system", content: "be brief\n\nrules" }, { role: "user", content: "q" }, { role: "assistant", content: "ok" }, { role: "assistant", content: "short", reasoning_content: " " },
  ], "the top-level system joins the system message; long reasoning history is removed, a placeholder stays");
  assert.equal(kimchi.calls[0].headers["user-agent"], "kimchi/0.1.50");
  await createAdapter(builtinRegistry.provider("kimchi"), kimchi).execute({ model: "kimi-k2.6", stream: false, messages: [history[0]], reasoning: { effort: "high" }, vendorExtensions: { openai: { system: ["x", { text: "y" }] } } }, { kind: "api-key", apiKey: "kimchi-token-1" }, ctx);
  const other = JSON.parse(kimchi.calls[1].body);
  assert.deepEqual([other.reasoning_effort, other.messages[0]], ["high", { role: "system", content: "x\ny" }], "effort stays for a non-Claude model; a system list is joined");
});
