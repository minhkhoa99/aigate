// Contract: docs/contracts/oauth.md (SP16b2) — GitHub Copilot sign-in, token refresh, request routing and model list,
// kept as 9router has them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { builtinRegistry, createAdapter, GithubAdapter, OAUTH_PROVIDERS } from "../dist/index.js";

const json = (status, value) => ({ status, headers: { "content-type": "application/json" }, body: new Response(typeof value === "string" ? value : JSON.stringify(value)).body });
const sse = (events) => ({ status: 200, headers: { "content-type": "text/event-stream" }, body: new Response(events.map((e) => `data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`).join("")).body });
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
const github = builtinRegistry.provider("github");
const flow = OAUTH_PROVIDERS.github;
const inSeconds = (s) => Math.floor(Date.now() / 1000) + s;
const credential = { kind: "api-key", apiKey: "copilot-token" };
const user = (text) => ({ role: "user", content: [{ type: "text", text }] });
const chatAnswer = { id: "c", model: "m", choices: [{ message: { content: "ok" }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1 } };
const responsesStream = () => sse([{ type: "response.output_text.delta", delta: "via responses" }, { type: "response.completed", response: { id: "r", usage: { input_tokens: 1, output_tokens: 1 } } }]);

test("github sign-in: device code and poll as 9router, the Copilot token and the user read after approval", async () => {
  assert.deepEqual([flow.flow, flow.background, github.oauth, github.quirks], ["device_code", false, "device_code", ["copilot"]]);
  const device = fakeTransport(json(200, { device_code: "dc", user_code: "ABCD-1234", verification_uri: "https://github.com/login/device", expires_in: 899, interval: 5 }), json(500, "down"));
  assert.deepEqual(await flow.deviceCode(io(device)), { device_code: "dc", user_code: "ABCD-1234", verification_uri: "https://github.com/login/device", verification_uri_complete: "https://github.com/login/device", expires_in: 899, interval: 5 });
  assert.deepEqual([device.calls[0].url, device.calls[0].headers["content-type"], device.calls[0].body], ["https://github.com/login/device/code", "application/x-www-form-urlencoded", "client_id=Iv1.b507a08c87ecfe98&scope=read%3Auser"]);
  await assert.rejects(flow.deviceCode(io(device)), /Device code request failed: down/);

  const poll = fakeTransport(
    json(200, { error: "authorization_pending" }), json(200, { error: "slow_down", interval: 10 }), json(200, { error: "access_denied", error_description: "The user denied it" }),
    json(200, { error: "incorrect_device_code" }), json(502, "<html>bad gateway</html>"),
    json(200, { access_token: "gho_1", token_type: "bearer", refresh_token: "ghr_1", expires_in: 28800 }),
    json(200, { token: "tid=copilot", expires_at: inSeconds(1500) }), json(200, { id: 42, login: "ada", name: "Ada L", email: "ada@x.dev" }),
    json(200, { access_token: "gho_2" }), json(404, {}), json(401, {}),
  );
  assert.deepEqual(await flow.poll("dc", io(poll)), { status: "pending" });
  assert.equal(poll.calls[0].body, "client_id=Iv1.b507a08c87ecfe98&device_code=dc&grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code");
  assert.deepEqual(await flow.poll("dc", io(poll)), { status: "pending", slowDown: true });
  assert.deepEqual(await flow.poll("dc", io(poll)), { status: "error", error: "access_denied", description: "The user denied it" });
  assert.deepEqual(await flow.poll("dc", io(poll)), { status: "error", error: "incorrect_device_code" });
  await assert.rejects(flow.poll("dc", io(poll)), /GitHub answered 502/);
  const approved = await flow.poll("dc", io(poll));
  assert.equal(approved.status, "approved");
  const { tokens } = approved;
  assert.equal(tokens.accessToken, "tid=copilot", "the Copilot token is the access token");
  assert.deepEqual(JSON.parse(tokens.refreshToken), { github: "gho_1", refresh: "ghr_1" }, "the GitHub token (and its refresh token) is kept sealed as the refresh token");
  assert.ok(tokens.expiresIn > 1400 && tokens.expiresIn <= 1500, "from the Copilot token's unix expires_at");
  assert.deepEqual([tokens.email, tokens.displayName, tokens.data], ["ada@x.dev", "ada", { githubUserId: "42", githubLogin: "ada", githubName: "Ada L", githubEmail: "ada@x.dev" }]);
  const copilotRead = poll.calls[6];
  assert.deepEqual([copilotRead.url, copilotRead.headers.authorization, copilotRead.headers["x-github-api-version"], copilotRead.headers["user-agent"]],
    ["https://api.github.com/copilot_internal/v2/token", "Bearer gho_1", "2022-11-28", "GitHubCopilotChat/0.26.7"]);
  assert.equal(poll.calls[7].url, "https://api.github.com/user");
  const bare = await flow.poll("dc", io(poll));
  assert.deepEqual([bare.tokens.accessToken, JSON.parse(bare.tokens.refreshToken), bare.tokens.expiresIn, bare.tokens.email, bare.tokens.data], ["gho_2", { github: "gho_2" }, undefined, undefined, {}],
    "a failed Copilot or user read is ignored: the GitHub token goes as the bearer (kept)");
});

test("github refresh: a Copilot token from the GitHub token, else GitHub's refresh token first; the test reads /user", async () => {
  const packed = JSON.stringify({ github: "gho_1", refresh: "ghr_1" });
  const ok = fakeTransport(json(200, { token: "tid=2", expires_at: inSeconds(1700) }));
  const renewed = await flow.refresh(packed, io(ok));
  assert.deepEqual([renewed.accessToken, renewed.refreshToken], ["tid=2", packed]);
  assert.ok(renewed.expiresIn > 1600);
  assert.deepEqual([ok.calls[0].headers.authorization, ok.calls[0].headers["editor-version"], ok.calls[0].headers["editor-plugin-version"], ok.calls[0].headers["user-agent"], ok.calls[0].headers["x-github-api-version"]],
    ["token gho_1", "vscode/1.110.0", "copilot-chat/0.38.0", "GitHubCopilotChat/0.38.0", "2025-04-01"]);
  assert.equal((await flow.refresh("gho_plain", io(fakeTransport(json(200, { token: "tid=3", expires_at: new Date(Date.now() + 60_000).toISOString() }))))).accessToken, "tid=3", "a plain GitHub token and an ISO expiry work too");
  assert.equal(await flow.refresh(JSON.stringify({ github: "gho_1" }), io(fakeTransport(json(401, {})))), null, "no Copilot token and no GitHub refresh token");
  const chain = fakeTransport(json(401, {}), json(200, { access_token: "gho_9", refresh_token: "ghr_9", expires_in: 28800 }), json(200, { token: "tid=9", expires_at: inSeconds(1800) }));
  const viaGithub = await flow.refresh(packed, io(chain));
  assert.deepEqual([viaGithub.accessToken, JSON.parse(viaGithub.refreshToken)], ["tid=9", { github: "gho_9", refresh: "ghr_9" }]);
  assert.equal(chain.calls[1].body, "grant_type=refresh_token&refresh_token=ghr_1&client_id=Iv1.b507a08c87ecfe98");
  const fallback = fakeTransport(json(401, {}), json(200, { access_token: "gho_8", expires_in: 100 }), json(403, {}));
  assert.deepEqual(await flow.refresh(packed, io(fallback)), { accessToken: "gho_8", refreshToken: JSON.stringify({ github: "gho_8", refresh: "ghr_1" }), expiresIn: 100, data: {} },
    "no Copilot token after renewing: the GitHub token goes as the bearer (kept)");
  assert.equal(await flow.refresh(packed, io(fakeTransport(json(401, {}), json(400, { error: "bad_refresh_token" })))), null);

  const probe = fakeTransport(json(200, { login: "ada" }), json(401, {}), json(403, {}), json(500, {}));
  assert.deepEqual(await flow.test(packed, io(probe)), { valid: true });
  assert.deepEqual([probe.calls[0].url, probe.calls[0].headers.authorization, probe.calls[0].headers["user-agent"], probe.calls[0].headers.accept], ["https://api.github.com/user", "Bearer gho_1", "AIGate", "application/vnd.github+json"]);
  assert.deepEqual(await flow.test(packed, io(probe)), { valid: false, code: "AUTH_ERROR", message: "Token invalid or revoked" });
  assert.deepEqual(await flow.test(packed, io(probe)), { valid: false, code: "AUTH_ERROR", message: "Access denied" });
  assert.deepEqual(await flow.test(packed, io(probe)), { valid: false, code: "PROVIDER_UNAVAILABLE", message: "API returned 500" });
});

test("github chat: /chat/completions with the executor's headers, parts reduced to text, 9router's parameter rules", async () => {
  assert.ok(createAdapter(github, fakeTransport()) instanceof GithubAdapter);
  const transport = fakeTransport(json(200, chatAnswer), json(200, chatAnswer));
  const adapter = createAdapter(github, transport);
  await adapter.execute({ model: "gpt-5.4", stream: false, temperature: 0.3, maxOutputTokens: 50, reasoning: { effort: "low" },
    messages: [{ role: "user", content: [{ type: "text", text: "q" }, { type: "file", mediaType: "application/pdf", source: { kind: "base64", mediaType: "application/pdf", data: "AAAA" }, name: "a.pdf" }] }] }, credential, ctx);
  const call = transport.calls[0];
  assert.equal(call.url, "https://api.githubcopilot.com/chat/completions");
  assert.deepEqual([call.headers.authorization, call.headers["copilot-integration-id"], call.headers["editor-version"], call.headers["x-initiator"], call.headers["anthropic-version"], call.headers["openai-intent"]],
    ["Bearer copilot-token", "vscode-chat", "vscode/1.110.0", "user", "2023-06-01", "conversation-panel"]);
  assert.match(call.headers["x-request-id"], /^[0-9a-f-]{36}$/);
  const body = JSON.parse(call.body);
  assert.equal(body.temperature, undefined, "gpt-5.4 loses temperature");
  assert.equal(body.max_completion_tokens, 50, "gpt-5 keeps max_completion_tokens");
  assert.equal(body.messages[0].content[1].type, "text", "a file part goes as text");
  assert.equal(JSON.parse(body.messages[0].content[1].text).type, "file");
  await adapter.execute({ model: "gemini-2.5-pro", stream: false, temperature: 0.3, maxOutputTokens: 50, vendorExtensions: { openai: { reasoning_effort: "none" } },
    messages: [user("q"), { role: "user", content: [{ type: "text", text: "" }, { type: "text", text: "x" }] }, { role: "user", content: [{ type: "text", text: "" }, { type: "text", text: "" }] }] }, credential, ctx);
  const second = JSON.parse(transport.calls[1].body);
  assert.deepEqual([second.max_tokens, second.max_completion_tokens, second.temperature, second.reasoning_effort], [50, undefined, 0.3, undefined], "other models get max_tokens; effort none dropped");
  assert.deepEqual([second.messages[1].content, second.messages[2].content], [[{ type: "text", text: "x" }], null], "empty text parts go; a message left with none has null content");
  assert.notEqual(transport.calls[0].headers["x-request-id"], transport.calls[1].headers["x-request-id"], "a new request id each call");
});

test("github: a 400 saying the model needs /responses moves it there for good; gemini and claude never move", async () => {
  const moved = "gpt-5.3-codex";
  const refusal = json(400, { error: { message: `model ${moved} is not accessible via the /chat/completions endpoint`, code: "unsupported_api_for_model" } });
  const transport = fakeTransport(refusal, responsesStream(), responsesStream());
  const adapter = createAdapter(github, transport);
  const first = await adapter.execute({ model: moved, stream: false, messages: [user("q")] }, credential, ctx);
  assert.equal(first.content[0].text, "via responses");
  assert.deepEqual(transport.calls.map((c) => c.url), ["https://api.githubcopilot.com/chat/completions", "https://api.githubcopilot.com/responses"]);
  assert.equal(JSON.parse(transport.calls[1].body).stream, true, "/responses is always streamed");
  await adapter.execute({ model: moved, stream: false, messages: [user("again")] }, credential, ctx);
  assert.equal(transport.calls[2].url, "https://api.githubcopilot.com/responses", "remembered: straight to /responses");

  const gemini = fakeTransport(json(400, { error: { message: "The requested model is not supported" } }));
  await assert.rejects(createAdapter(github, gemini).execute({ model: "gemini-3-flash-preview", stream: false, messages: [user("q")] }, credential, ctx), /not supported/);
  const other = fakeTransport(json(400, { error: { message: "something else" } }));
  await assert.rejects(createAdapter(github, other).execute({ model: "gpt-5.2", stream: false, messages: [user("q")] }, credential, ctx), /something else/);
  const denied = fakeTransport(json(401, { error: { message: "The requested model is not supported" } }));
  await assert.rejects(createAdapter(github, denied).execute({ model: "gpt-5.2", stream: false, messages: [user("q")] }, credential, ctx), (error) => error.code === "AUTH_ERROR", "only a 400 moves");

  const streamed = fakeTransport(json(400, { error: { message: "The requested model is not supported" } }), responsesStream());
  const chunks = [];
  for await (const chunk of createAdapter(github, streamed).stream({ model: "gpt-5.2-codex", stream: true, messages: [user("q")] }, credential, ctx)) chunks.push(chunk);
  assert.deepEqual(streamed.calls.map((c) => c.url.split("/").at(-1)), ["completions", "responses"]);
  assert.ok(chunks.some((c) => c.type === "text_delta" && c.text === "via responses"));
  const refused = fakeTransport(json(400, { error: { message: "bad request" } }));
  await assert.rejects(async () => {
    for await (const chunk of createAdapter(github, refused).stream({ model: "gpt-5.2", stream: true, messages: [user("q")] }, credential, ctx)) assert.fail(`unexpected ${chunk.type}`);
  }, /bad request/);
  const plain = fakeTransport(sse([{ id: "s", model: "gpt-5.2", choices: [{ delta: { content: "hi" } }] }, { id: "s", model: "gpt-5.2", choices: [{ delta: {}, finish_reason: "stop" }] }, "[DONE]"]));
  const texts = [];
  for await (const chunk of createAdapter(github, plain).stream({ model: "gpt-5.2", stream: true, messages: [user("q")] }, credential, ctx)) if (chunk.type === "text_delta") texts.push(chunk.text);
  assert.deepEqual(texts, ["hi"], "a chat stream passes through");
});

test("github claude models: unsigned thinking in the history is refused before any call (AIGate's Messages mapping)", async () => {
  const transport = fakeTransport();
  await assert.rejects(createAdapter(github, transport).execute({
    model: "claude-sonnet-4.6", stream: false,
    messages: [user("q"), { role: "assistant", content: [{ type: "thinking", text: "no signature" }, { type: "text", text: "a" }] }, user("go")],
  }, credential, ctx), /thinking without a signature/);
  assert.equal(transport.calls.length, 0);
});

test("github claude models: /v1/messages, the Claude Code prompt, 9router's preparation for another provider, always streamed", async () => {
  const transport = fakeTransport(sse([
    { type: "message_start", message: { id: "m", model: "claude-sonnet-4.6", usage: {} } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "hello" } },
    { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 1 } },
    { type: "message_stop" },
  ]));
  const answer = await createAdapter(github, transport).execute({
    model: "claude-sonnet-4.6", stream: false, maxOutputTokens: 900_000, system: [{ type: "text", text: "be brief" }],
    tools: [{ name: "shot", parameters: { type: "object" } }],
    messages: [
      user("q"),
      { role: "assistant", content: [{ type: "text", text: "a" }, { type: "tool_call", id: "t1", name: "shot", arguments: "{}" }] },
      { role: "tool", content: [{ type: "tool_result", toolCallId: "t1", content: [{ type: "text", text: "see" }, { type: "image", source: { kind: "base64", mediaType: "image/png", data: "BBBB" } }] }] },
      { role: "tool", content: [{ type: "tool_result", toolCallId: "t2", content: [{ type: "image", source: { kind: "base64", mediaType: "image/png", data: "AAAA" } }] }] },
    ],
  }, credential, ctx);
  assert.equal(answer.content[0].text, "hello");
  const call = transport.calls[0];
  assert.equal(call.url, "https://api.githubcopilot.com/v1/messages");
  assert.deepEqual([call.headers.authorization, call.headers["x-api-key"], call.headers["anthropic-beta"], call.headers.accept], ["Bearer copilot-token", undefined, undefined, "text/event-stream"]);
  const body = JSON.parse(call.body);
  assert.equal(body.stream, true);
  assert.equal(body.max_tokens, 128000);
  assert.deepEqual(body.system.map((b) => [b.text, b.cache_control]), [["You are Claude Code, Anthropic's official CLI for Claude.", undefined], ["be brief", { type: "ephemeral", ttl: "1h" }]]);
  assert.deepEqual(body.tools[0].cache_control, { type: "ephemeral", ttl: "1h" });
  assert.deepEqual(body.messages[1].content.at(-1).cache_control, { type: "ephemeral" }, "the last assistant block is marked");
  assert.deepEqual(body.messages[2].content, [
    { type: "tool_result", tool_use_id: "t1", content: [{ type: "text", text: "see" }] },
    { type: "tool_result", tool_use_id: "t2", content: [{ type: "text", text: "(image attached below)" }] },
    { type: "text", text: "[Image from tool result t1]" },
    { type: "image", source: { type: "base64", media_type: "image/png", data: "BBBB" } },
    { type: "text", text: "[Image from tool result t2]" },
    { type: "image", source: { type: "base64", media_type: "image/png", data: "AAAA" } },
  ], "tool result images move into the user turn");
  assert.equal(body.metadata, undefined, "no cloaking");

  const typed = fakeTransport(sse([{ type: "message_start", message: { id: "m", model: "claude-sonnet-4.6", usage: {} } }, { type: "message_stop" }]));
  await createAdapter(github, typed).execute({ model: "claude-sonnet-4.6", stream: false, messages: [user("q")],
    vendorExtensions: { anthropic: { tools: [{ type: "web_search_20250305", name: "web_search" }, { name: "a", input_schema: {} }] } } }, credential, ctx);
  assert.deepEqual(JSON.parse(typed.calls[0].body).tools.map((t) => t.name), ["a"], "typed server tools are dropped off claude");
});

test("github model list: Copilot's chat models that are not disabled, with 9router's older headers", async () => {
  const transport = fakeTransport(json(200, { data: [
    { id: "gpt-5.4", capabilities: { type: "chat" }, policy: { state: "enabled" } },
    { id: "claude-new", capabilities: { type: "chat" }, policy: { state: "unconfigured" } },
    { id: "off", capabilities: { type: "chat" }, policy: { state: "disabled" } },
    { id: "text-embedding-3-small", capabilities: { type: "embeddings" } },
    { id: "bad id", capabilities: { type: "chat" } },
  ] }), json(401, {}), json(500, {}));
  const adapter = createAdapter(github, transport);
  const listed = await adapter.getModels(credential, ctx);
  assert.deepEqual(listed.map((m) => m.id), ["gpt-5.4", "claude-new"]);
  assert.equal(listed[0].descriptor.id, "gpt-5.4");
  assert.deepEqual(transport.calls[0].headers, {
    "content-type": "application/json", "copilot-integration-id": "vscode-chat", "editor-version": "vscode/1.107.1", "editor-plugin-version": "copilot-chat/0.26.7",
    "user-agent": "GitHubCopilotChat/0.26.7", authorization: "Bearer copilot-token",
  });
  await assert.rejects(adapter.getModels(credential, ctx), (error) => error.code === "AUTH_ERROR" && error.details.status === 401);
  await assert.rejects(adapter.getModels(credential, ctx), (error) => error.code === "PROVIDER_UNAVAILABLE" && error.details.status === 500);
});
