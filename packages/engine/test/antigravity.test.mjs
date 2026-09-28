import { test } from "node:test";
import assert from "node:assert/strict";
import { AntigravityAdapter, builtinRegistry, createAdapter, OAUTH_PROVIDERS } from "../dist/index.js";

const json = (status, value, headers = { "content-type": "application/json" }) => ({ status, headers, body: new Response(typeof value === "string" ? value : JSON.stringify(value)).body });
const sse = (value) => ({ status: 200, headers: { "content-type": "text/event-stream" }, body: new Response(`data: ${JSON.stringify(value)}\n\n`).body });
const ctx = { signal: new AbortController().signal, requestId: "test" };
const io = (transport) => ({ transport, ctx });
const provider = builtinRegistry.provider("antigravity");
const flow = OAUTH_PROVIDERS.antigravity;
process.env.AIGATE_ANTIGRAVITY_OAUTH_CLIENT_ID = "test-antigravity-client.apps.googleusercontent.com";
process.env.AIGATE_ANTIGRAVITY_OAUTH_CLIENT_SECRET = "test-antigravity-secret";

function transport(...answers) {
  const calls = [];
  return { calls, async send(request) { calls.push(request); const answer = answers.shift(); if (!answer) throw new Error("unexpected transport call"); return answer; } };
}

test("antigravity is OAuth-only and uses the IDE adapter", () => {
  assert.deepEqual([builtinRegistry.status("antigravity"), provider.oauth, provider.protocol, provider.chatUrl, provider.modelsUrl, provider.quirks, provider.auth],
    [{ connectable: true }, "authorization_code", "antigravity", "https://daily-cloudcode-pa.googleapis.com", "https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:models", ["antigravity"], { kind: "api-key", header: "authorization", scheme: "bearer" }]);
  assert.ok(createAdapter(provider, transport()) instanceof AntigravityAdapter);
  assert.equal(builtinRegistry.provider("ag")?.id, "antigravity");
});

test("antigravity sign-in uses the IDE scopes and local Cloud Code headers", async () => {
  const url = new URL(flow.authUrl("http://127.0.0.1:20200/callback", "state", "ignored", {}));
  assert.equal(url.searchParams.get("scope"), "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/cclog https://www.googleapis.com/auth/experimentsandconfigs");
  const t = transport(json(200, { access_token: "ya29.a", refresh_token: "1//r", expires_in: 3600 }), json(200, { email: "ada@gmail.com" }), json(403, { error: { message: "no project" } }));
  const tokens = await flow.exchange("code", "http://127.0.0.1:20200/callback", "ignored", {}, io(t));
  assert.deepEqual(tokens, { accessToken: "ya29.a", refreshToken: "1//r", expiresIn: 3600, email: "ada@gmail.com", data: {} });
  assert.deepEqual([t.calls[1].headers["x-request-source"], t.calls[2].headers["x-request-source"], t.calls[2].headers["user-agent"]], ["local", "local", "antigravity/ide/2.11.0 darwin/arm64"]);
});

test("antigravity wraps Gemini requests, maps upstream thinking suffixes, and streams on the IDE endpoint", async () => {
  const t = transport(json(200, { candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }] }));
  const adapter = createAdapter(provider, t);
  const answer = await adapter.execute({ model: "gemini-3.8-flash-high", messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }], maxOutputTokens: 100000 }, { kind: "api-key", apiKey: "ya29.a", projectId: "proj", sessionId: "connection-1" }, ctx);
  assert.deepEqual(answer.content, [{ type: "text", text: "ok" }]);
  assert.equal(t.calls[0].url, "https://daily-cloudcode-pa.googleapis.com/v1internal:generateContent");
  assert.equal(t.calls[0].headers["x-request-source"], undefined);
  const body = JSON.parse(t.calls[0].body);
  assert.deepEqual([body.project, body.model, body.userAgent, body.request.generationConfig.maxOutputTokens, body.request.generationConfig.thinkingConfig], ["proj", "gemini-3.8-flash-high", "antigravity", 64000, { thinkingLevel: "high", includeThoughts: true }]);
  assert.match(body.request.sessionId, /^-?\d+$/);
  assert.equal(body.request.safetySettings, undefined);

  const streamTransport = transport(sse({ candidates: [{ content: { parts: [{ text: "hi" }] }, finishReason: "STOP" }] }));
  const chunks = [];
  for await (const chunk of createAdapter(provider, streamTransport).stream({ model: "gemini-3.8-flash-high", messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }], stream: true }, { kind: "api-key", apiKey: "t", projectId: "p", sessionId: "c" }, ctx)) chunks.push(chunk);
  assert.equal(streamTransport.calls[0].url, "https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse");
  assert.equal(chunks.at(-1).type, "stop");
});

test("antigravity reads models from the sandbox and retries a short Retry-After", async () => {
  const t = transport(json(429, { error: { message: "busy" } }, { "content-type": "application/json", "retry-after": "0.001" }), json(200, { models: [{ id: "gemini-new" }, { name: "bad space" }] }));
  const listed = await createAdapter(provider, t).getModels({ kind: "api-key", apiKey: "t" }, ctx);
  assert.deepEqual(listed.map((model) => model.id), ["gemini-new"]);
  assert.equal(t.calls[0].url, "https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:models");
  assert.equal(t.calls[0].method, "POST");
  assert.equal(t.calls.length, 2);

  const capped = transport(json(429, { error: { message: "too long" } }, { "content-type": "application/json", "retry-after": "11" }));
  await assert.rejects(
    () => createAdapter(provider, capped).getModels({ kind: "api-key", apiKey: "t" }, ctx),
    (error) => error?.details?.status === 429,
  );
  assert.equal(capped.calls.length, 1);
});

test("antigravity connection test is loadCodeAssist with the Antigravity VS Code user agent", async () => {
  const t = transport(json(200, {}));
  assert.deepEqual(await createAdapter(provider, t).validateCredential({ kind: "api-key", apiKey: "t" }, ctx), { valid: true });
  assert.equal(t.calls[0].url, "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist");
  assert.equal(t.calls[0].headers["user-agent"], "google-api-nodejs-client/9.15.1 vscode-antigravity/1.107.0");
});
