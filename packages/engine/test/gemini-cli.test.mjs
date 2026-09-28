// Contract: docs/contracts/oauth.md (SP16c) — Gemini CLI sign-in, refresh, the Cloud Code envelope, project lookup,
// model list and connection test, kept as 9router has them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { builtinRegistry, createAdapter, GeminiCliAdapter, OAUTH_PROVIDERS } from "../dist/index.js";

const json = (status, value) => ({ status, headers: { "content-type": "application/json" }, body: new Response(typeof value === "string" ? value : JSON.stringify(value)).body });
const sse = (events) => ({ status: 200, headers: { "content-type": "text/event-stream" }, body: new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("")).body });
function fakeTransport(...answers) {
  const calls = [];
  return {
    calls,
    async send(request) {
      calls.push(request);
      const next = answers.shift();
      if (next === undefined) throw new Error("unexpected transport call");
      return next;
    },
  };
}
const ctx = { signal: new AbortController().signal, requestId: "r" };
const io = (transport) => ({ transport, ctx });
const provider = builtinRegistry.provider("gemini-cli");
const flow = OAUTH_PROVIDERS["gemini-cli"];
// The client comes from the environment (.env); the tests use a fake one.
const CLIENT_ID = "test-gemini-cli-client.apps.googleusercontent.com";
const CLIENT_SECRET = "test-gemini-cli-secret";
process.env.AIGATE_GEMINI_CLI_OAUTH_CLIENT_ID = CLIENT_ID;
process.env.AIGATE_GEMINI_CLI_OAUTH_CLIENT_SECRET = CLIENT_SECRET;
const PLATFORM = { darwin: process.arch === "arm64" ? 2 : 1, linux: process.arch === "arm64" ? 4 : 3, win32: 5 }[process.platform] ?? 0;
const METADATA = { ideType: 9, platform: PLATFORM, pluginType: 2 };
const user = (text) => ({ role: "user", content: [{ type: "text", text }] });
const answer = (text) => ({ response: { responseId: "g1", modelVersion: "gemini-2.5-flash", candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 } } });

test("gemini-cli is connectable by Google sign-in, with the Cloud Code adapter and a Bearer token", () => {
  assert.deepEqual([builtinRegistry.status("gemini-cli"), provider.oauth, provider.protocol, provider.chatUrl, provider.quirks, provider.auth],
    [{ connectable: true }, "authorization_code", "gemini", "https://cloudcode-pa.googleapis.com/v1internal", ["geminiCli"], { kind: "api-key", header: "authorization", scheme: "bearer" }]);
  assert.ok(createAdapter(provider, fakeTransport()) instanceof GeminiCliAdapter);
  assert.equal(builtinRegistry.provider("gc")?.id, "gemini-cli", "the alias");
});

test("gemini-cli sign-in: Google's authorize URL, the form exchange, then userinfo and loadCodeAssist for the project", async () => {
  const url = new URL(flow.authUrl("http://127.0.0.1:20200/callback", "st", "challenge-ignored", {}));
  assert.equal(`${url.origin}${url.pathname}`, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    client_id: CLIENT_ID, response_type: "code", redirect_uri: "http://127.0.0.1:20200/callback", state: "st", access_type: "offline", prompt: "consent",
    scope: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
  }, "no PKCE challenge, as 9router");

  const transport = fakeTransport(
    json(200, { access_token: "ya29.a", refresh_token: "1//r", expires_in: 3599, scope: "s1 s2" }),
    json(200, { email: "ada@gmail.com" }),
    json(200, { cloudaicompanionProject: "proj-123", allowedTiers: [] }),
  );
  const tokens = await flow.exchange("4/code", "http://127.0.0.1:20200/callback", "verifier", {}, io(transport));
  assert.deepEqual(tokens, { accessToken: "ya29.a", refreshToken: "1//r", expiresIn: 3599, email: "ada@gmail.com", data: { scope: "s1 s2", projectId: "proj-123" } });
  const [exchange, info, load] = transport.calls;
  assert.deepEqual([exchange.url, exchange.headers["content-type"], Object.fromEntries(new URLSearchParams(exchange.body))], ["https://oauth2.googleapis.com/token", "application/x-www-form-urlencoded", {
    grant_type: "authorization_code", client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code: "4/code", redirect_uri: "http://127.0.0.1:20200/callback",
  }]);
  assert.deepEqual([info.method, info.url, info.headers.authorization], ["GET", "https://www.googleapis.com/oauth2/v1/userinfo?alt=json", "Bearer ya29.a"]);
  assert.deepEqual([load.url, load.headers, JSON.parse(load.body)], ["https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist",
    { authorization: "Bearer ya29.a", "content-type": "application/json" }, { metadata: METADATA, mode: 1 }], "no client headers on the sign-in lookup (kept)");

  const objectProject = await flow.exchange("c", "r", "v", {}, io(fakeTransport(json(200, { access_token: "t" }), json(401, { email: "not-signed-in@x.dev" }), json(200, { cloudaicompanionProject: { id: " p-obj " } }))));
  assert.deepEqual([objectProject.email, objectProject.data], [undefined, { projectId: "p-obj" }], "a failed userinfo gives no email; the project may be an object");
  const noProject = await flow.exchange("c", "r", "v", {}, io(fakeTransport(json(200, { access_token: "t" }), json(200, {}), json(403, { error: { message: "no" } }))));
  assert.deepEqual(noProject.data, {}, "a failed lookup still saves the connection, without a project (kept)");
  const lookupThrows = { calls: [], async send(request) { this.calls.push(request); if (request.url.includes("loadCodeAssist")) throw new Error("socket"); return this.calls.length === 1 ? json(200, { access_token: "t" }) : json(200, {}); } };
  assert.deepEqual((await flow.exchange("c", "r", "v", {}, io(lookupThrows))).data, {}, "a lookup that throws is ignored too");
  await assert.rejects(flow.exchange("c", "r", "v", {}, io(fakeTransport(json(400, "invalid_grant")))), /Token exchange failed: invalid_grant/);
  await assert.rejects(flow.exchange("c", "r", "v", {}, io(fakeTransport(json(200, {})))), /Gemini CLI returned no access token/);
});

test("gemini-cli refresh: Google's form refresh; the old refresh token stays; any failure is a refused refresh", async () => {
  const transport = fakeTransport(json(200, { access_token: "ya29.b", expires_in: 3599 }), json(200, { access_token: "ya29.c", refresh_token: "1//new" }), json(400, { error: "invalid_grant" }), json(200, {}));
  assert.deepEqual(await flow.refresh("1//r", io(transport)), { accessToken: "ya29.b", refreshToken: "1//r", expiresIn: 3599, data: {} });
  assert.deepEqual(Object.fromEntries(new URLSearchParams(transport.calls[0].body)), { grant_type: "refresh_token", refresh_token: "1//r", client_id: CLIENT_ID, client_secret: CLIENT_SECRET });
  assert.deepEqual(await flow.refresh("1//r", io(transport)), { accessToken: "ya29.c", refreshToken: "1//new", data: {} });
  assert.equal(await flow.refresh("1//r", io(transport)), null);
  assert.equal(await flow.refresh("1//r", io(transport)), null, "an answer without an access token");
  assert.equal(flow.refreshLeadMs, undefined, "refreshed 5 minutes before expiry (the default lead)");
});

test("gemini-cli requests: the Gemini body inside the Cloud Code envelope, with the Gemini CLI headers", async () => {
  const transport = fakeTransport(json(200, answer("hi")));
  const adapter = createAdapter(provider, transport);
  const request = {
    model: "gemini-2.5-flash", messages: [user("hello"), { role: "assistant", content: [{ type: "tool_call", id: "call_1", name: "look", arguments: "{\"q\":1}" }] },
      { role: "tool", content: [{ type: "tool_result", toolCallId: "call_1", content: [{ type: "text", text: "found" }] }] }],
    system: [{ type: "text", text: "be brief" }], tools: [{ name: "look", description: "d", parameters: { type: "object", properties: { q: { type: "number" } } } }], temperature: 0.2,
  };
  const out = await adapter.execute(request, { kind: "api-key", apiKey: "ya29.a", projectId: "proj-123", sessionId: "conn-1" }, ctx);
  assert.deepEqual([out.content, out.usage], [[{ type: "text", text: "hi" }], { inputTokens: 3, outputTokens: 2 }], "the answer inside { response }");
  const sent = transport.calls[0];
  assert.equal(sent.url, "https://cloudcode-pa.googleapis.com/v1internal:generateContent");
  const arch = process.arch === "ia32" ? "x86" : process.arch;
  assert.deepEqual([sent.headers.authorization, sent.headers["user-agent"], sent.headers["x-goog-api-client"], sent.headers.accept, sent.headers["content-type"]],
    ["Bearer ya29.a", `GeminiCLI/0.34.0/gemini-2.5-flash (${process.platform}; ${arch}; terminal)`, "google-genai-sdk/1.41.0 gl-node/v22.19.0", "application/json", "application/json"]);
  const body = JSON.parse(sent.body);
  assert.deepEqual(Object.keys(body), ["project", "model", "userAgent", "requestId", "request"]);
  assert.deepEqual([body.project, body.model, body.userAgent], ["proj-123", "gemini-2.5-flash", "gemini-cli"]);
  assert.match(body.requestId, /^agent-[0-9a-f-]{36}$/);
  assert.match(body.request.sessionId, /^[0-9a-f-]{36}\d{13}$/, "a new session per request (kept)");
  assert.deepEqual(Object.keys(body.request), ["sessionId", "contents", "systemInstruction", "generationConfig", "tools", "safetySettings", "toolConfig"]);
  assert.deepEqual(body.request.systemInstruction, { role: "user", parts: [{ text: "be brief" }] });
  assert.deepEqual(body.request.generationConfig, { temperature: 0.2 });
  assert.equal(body.request.safetySettings.length, 5, "Gemini CLI keeps the safety settings");
  assert.deepEqual(body.request.toolConfig, { functionCallingConfig: { mode: "VALIDATED" } });
  assert.deepEqual(body.request.tools, [{ functionDeclarations: [{ name: "look", description: "d", parameters: { type: "object", properties: { q: { type: "number" } } } }] }]);
  const call = body.request.contents[1].parts[0];
  assert.deepEqual(call.functionCall, { id: "call_1", name: "look", args: { q: 1 } });
  assert.match(call.thoughtSignature, /^CiQBjz1rX\/AlslZWMe5RgBt4/, "the Gemini CLI signature on the first call without a cached one");
  assert.deepEqual(body.request.contents[2], { role: "user", parts: [{ functionResponse: { id: "call_1", name: "look", response: { result: { result: "found" } } } }] });

  const plain = fakeTransport(json(200, answer("x")));
  await createAdapter(provider, plain).execute({ model: "gemini-2.5-pro", messages: [user("q")] }, { kind: "api-key", apiKey: "t", projectId: "p" }, ctx);
  const plainBody = JSON.parse(plain.calls[0].body).request;
  assert.deepEqual(Object.keys(plainBody), ["sessionId", "contents", "generationConfig", "safetySettings"], "no system, tools or toolConfig when the request has none");
});

test("gemini-cli streams from streamGenerateContent?alt=sse, each chunk inside { response }", async () => {
  const transport = fakeTransport(sse([
    { response: { responseId: "s1", modelVersion: "gemini-2.5-flash", candidates: [{ content: { parts: [{ text: "Hel" }] } }] } },
    { response: { candidates: [{ content: { parts: [{ text: "lo" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2 } } },
  ]));
  const chunks = [];
  for await (const chunk of createAdapter(provider, transport).stream({ model: "gemini-2.5-flash", messages: [user("hi")], stream: true }, { kind: "api-key", apiKey: "t", projectId: "p" }, ctx)) chunks.push(chunk);
  assert.equal(transport.calls[0].url, "https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse");
  assert.equal(transport.calls[0].headers.accept, "text/event-stream");
  assert.deepEqual(chunks, [
    { type: "start", id: "chatcmpl-s1", model: "gemini-2.5-flash" }, { type: "text_delta", index: 0, text: "Hel" }, { type: "text_delta", index: 0, text: "lo" },
    { type: "usage", usage: { inputTokens: 4, outputTokens: 2 } }, { type: "stop", stopReason: "end_turn" },
  ]);
});

test("gemini-cli without a project looks it up once per connection (loadCodeAssist, else onboardUser), else sends a random one", async () => {
  const transport = fakeTransport(json(200, { cloudaicompanionProject: { id: "found-1" } }), json(200, answer("a")), json(200, answer("b")));
  const adapter = createAdapter(provider, transport);
  const bare = { kind: "api-key", apiKey: "ya29.a", sessionId: "conn-lookup" };
  await adapter.execute({ model: "gemini-2.5-flash", messages: [user("1")] }, bare, ctx);
  await adapter.execute({ model: "gemini-2.5-flash", messages: [user("2")] }, bare, ctx);
  const [lookup, first, second] = transport.calls;
  assert.deepEqual([lookup.url, lookup.headers["user-agent"], lookup.headers["x-goog-api-client"], JSON.parse(lookup.headers["client-metadata"]), lookup.headers.authorization, JSON.parse(lookup.body)],
    ["https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist", "google-api-nodejs-client/9.15.1", "google-cloud-sdk vscode_cloudshelleditor/0.1", METADATA, "Bearer ya29.a", { metadata: METADATA }]);
  assert.deepEqual([JSON.parse(first.body).project, JSON.parse(second.body).project], ["found-1", "found-1"], "the second request uses the cached project");

  const onboarding = fakeTransport(json(200, { allowedTiers: [{ id: "free-tier", isDefault: false }, { id: " standard-tier ", isDefault: true }] }),
    json(200, { done: true, response: { cloudaicompanionProject: { id: "onboarded-1" } } }), json(200, answer("c")));
  await createAdapter(provider, onboarding).execute({ model: "gemini-2.5-flash", messages: [user("3")] }, { ...bare, sessionId: "conn-onboard" }, ctx);
  assert.deepEqual([onboarding.calls[1].url, JSON.parse(onboarding.calls[1].body)], ["https://cloudcode-pa.googleapis.com/v1internal:onboardUser", { tierId: "standard-tier", metadata: METADATA }]);
  assert.equal(JSON.parse(onboarding.calls[2].body).project, "onboarded-1");

  const legacy = fakeTransport(json(200, { allowedTiers: [{ id: "free-tier" }] }), json(200, { done: true, response: { cloudaicompanionProject: "legacy-1" } }), json(200, answer("l")));
  await createAdapter(provider, legacy).execute({ model: "gemini-2.5-flash", messages: [user("7")] }, { ...bare, sessionId: "conn-legacy" }, ctx);
  assert.equal(JSON.parse(legacy.calls[1].body).tierId, "legacy-tier", "no default tier: legacy-tier");

  const refused = fakeTransport(json(403, { error: { message: "denied" } }), json(200, answer("d")));
  await createAdapter(provider, refused).execute({ model: "gemini-2.5-flash", messages: [user("4")] }, { ...bare, sessionId: "conn-refused" }, ctx);
  assert.match(JSON.parse(refused.calls[1].body).project, /^(useful|bright|swift|calm|bold)-(fuze|wave|spark|flow|core)-[0-9a-f]{5}$/, "no project: a random one (kept)");

  const signedIn = fakeTransport(json(200, answer("e")));
  await createAdapter(provider, signedIn).execute({ model: "gemini-2.5-flash", messages: [user("5")] }, { ...bare, sessionId: "conn-signed", projectId: "stored" }, ctx);
  assert.equal(signedIn.calls.length, 1, "a stored project needs no lookup");
  const noConnection = fakeTransport(json(200, answer("f")));
  await createAdapter(provider, noConnection).execute({ model: "gemini-2.5-flash", messages: [user("6")] }, { kind: "api-key", apiKey: "t" }, ctx);
  assert.equal(noConnection.calls.length, 1, "without a connection id there is nothing to look up (9router: no connectionId)");
});

test("gemini-cli models come from fetchAvailableModels; the test is loadCodeAssist with the Gemini CLI client", async () => {
  const transport = fakeTransport(
    json(200, { models: { "gemini-2.5-pro": { displayName: "Pro" }, "internal-x": { isInternal: true }, "gemini-new": {} } }),
    json(200, { models: [{ id: "a-1" }, { model: "b-2" }, { name: "c-3" }, {}] }),
  );
  const adapter = createAdapter(provider, transport);
  const listed = await adapter.getModels({ kind: "api-key", apiKey: "ya29.a", projectId: "proj-123" }, ctx);
  assert.deepEqual(listed.map((m) => [m.id, m.descriptor?.id]), [["gemini-2.5-pro", "gemini-2.5-pro"], ["gemini-new", undefined]]);
  const list = transport.calls[0];
  assert.deepEqual([list.method, list.url, list.headers.authorization, list.headers["user-agent"], list.headers["x-goog-api-client"], JSON.parse(list.body)],
    ["POST", "https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels", "Bearer ya29.a", "google-api-nodejs-client/9.15.1", "google-cloud-sdk vscode_cloudshelleditor/0.1", { project: "proj-123" }]);
  assert.deepEqual((await adapter.getModels({ kind: "api-key", apiKey: "t" }, ctx)).map((m) => m.id), ["a-1", "b-2", "c-3"]);
  assert.deepEqual(JSON.parse(transport.calls[1].body), {}, "no project: an empty body");

  const probes = fakeTransport(json(200, {}), json(401, { error: { code: 401, message: "Request had invalid authentication credentials." } }), json(500, "backend down"), json(403, {}));
  const probing = createAdapter(provider, probes);
  assert.deepEqual(await probing.validateCredential({ kind: "api-key", apiKey: "ya29.a" }, ctx), { valid: true });
  assert.deepEqual([probes.calls[0].url, probes.calls[0].headers["user-agent"], probes.calls[0].headers.authorization, JSON.parse(probes.calls[0].body)],
    ["https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist", "google-api-nodejs-client/9.15.1 gemini-cli/0.34.0", "Bearer ya29.a",
      { metadata: { ideType: "IDE_UNSPECIFIED", platform: "PLATFORM_UNSPECIFIED", pluginType: "GEMINI" } }]);
  assert.deepEqual(await probing.validateCredential({ kind: "api-key", apiKey: "ya29.a" }, ctx), { valid: false, code: "AUTH_ERROR", message: "Request had invalid authentication credentials." });
  assert.deepEqual(await probing.validateCredential({ kind: "api-key", apiKey: "ya29.a" }, ctx), { valid: false, code: "PROVIDER_UNAVAILABLE", message: "backend down" });
  assert.deepEqual(await probing.validateCredential({ kind: "api-key", apiKey: "ya29.a" }, ctx), { valid: false, code: "AUTH_ERROR", message: "{}" }, "an empty error body is shown as is");
});

test("gemini-cli without its client in the environment names the missing variables, before any call", async () => {
  const saved = process.env.AIGATE_GEMINI_CLI_OAUTH_CLIENT_SECRET;
  process.env.AIGATE_GEMINI_CLI_OAUTH_CLIENT_SECRET = "  ";
  try {
    const missing = (error) => error.code === "INVALID_REQUEST" && /AIGATE_GEMINI_CLI_OAUTH_CLIENT_ID and AIGATE_GEMINI_CLI_OAUTH_CLIENT_SECRET in AIGate's \.env/.test(error.message);
    assert.throws(() => flow.authUrl("http://127.0.0.1:20200/callback", "st", "c", {}), missing);
    const transport = fakeTransport();
    await assert.rejects(flow.exchange("c", "r", "v", {}, io(transport)), missing);
    await assert.rejects(flow.refresh("1//r", io(transport)), missing);
    assert.equal(transport.calls.length, 0);
  } finally {
    process.env.AIGATE_GEMINI_CLI_OAUTH_CLIENT_SECRET = saved;
  }
});
