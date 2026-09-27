// Contract: docs/contracts/oauth.md (SP16b) — claude and codex sign-in, requests and model lists, kept as 9router has them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { builtinRegistry, CLAUDE_CODE_PROMPT, codexBody, codexModelIds, createAdapter, isClaudeSignature, OAUTH_PROVIDERS, withClaudeCodePrompt, withConnection } from "../dist/index.js";

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
const jwt = (payload) => `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;
const OAT = "sk-ant-oat01-secret";
const claude = builtinRegistry.provider("claude");
const codex = builtinRegistry.provider("codex");
const message = { id: "msg_1", model: "claude-sonnet-5", content: [{ type: "tool_use", id: "t1", name: "lookup_ide", input: { q: 1 } }], stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } };
const ok = { ...message, content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" };

test("claude sign-in: 9router's authorize URL, code#state exchange in JSON, no email; refresh keeps the old refresh token", async () => {
  const flow = OAUTH_PROVIDERS.claude;
  assert.equal(flow.flow, "authorization_code_pkce");
  assert.equal(flow.refreshLeadMs, 4 * 3_600_000);
  const url = new URL(flow.authUrl("http://localhost:20200/callback", "st", "ch", {}));
  assert.equal(`${url.origin}${url.pathname}`, "https://claude.ai/oauth/authorize");
  assert.deepEqual([...url.searchParams.keys()], ["code", "client_id", "response_type", "redirect_uri", "scope", "code_challenge", "code_challenge_method", "state"]);
  assert.deepEqual([url.searchParams.get("client_id"), url.searchParams.get("scope"), url.searchParams.get("code")], ["9d1c250a-e61b-44d9-88ed-5944d1962f5e", "org:create_api_key user:profile user:inference", "true"]);
  const transport = fakeTransport(json(200, { access_token: OAT, refresh_token: "r1", expires_in: 28800, scope: "user:inference" }), json(400, { error: "bad" }));
  const tokens = await flow.exchange("the-code#page-state", "http://localhost:20200/callback", "verifier", { state: "sent-state" }, io(transport));
  assert.deepEqual(tokens, { accessToken: OAT, refreshToken: "r1", expiresIn: 28800, data: { scope: "user:inference" } });
  const sent = transport.calls[0];
  assert.deepEqual([sent.method, sent.url, sent.headers["content-type"]], ["POST", "https://api.anthropic.com/v1/oauth/token", "application/json"]);
  assert.deepEqual(JSON.parse(sent.body), { code: "the-code", state: "page-state", grant_type: "authorization_code", client_id: "9d1c250a-e61b-44d9-88ed-5944d1962f5e", redirect_uri: "http://localhost:20200/callback", code_verifier: "verifier" });
  await assert.rejects(flow.exchange("c", "r", "v", { state: "s" }, io(transport)), /Token exchange failed: \{"error":"bad"\}/);
  const without = fakeTransport(json(200, { access_token: OAT }), json(200, {}));
  await flow.exchange("plain", "r", "v", { state: "sent-state" }, io(without));
  assert.equal(JSON.parse(without.calls[0].body).state, "sent-state", "no state after # uses the one sent back");
  await assert.rejects(flow.exchange("plain", "r", "v", {}, io(without)), /Claude returned no access token/);

  const refresh = fakeTransport(json(200, { access_token: "new", expires_in: 100 }), json(200, { access_token: "newer", refresh_token: "r2" }), json(401, {}), json(200, {}));
  assert.deepEqual(await flow.refresh("r1", io(refresh)), { accessToken: "new", refreshToken: "r1", expiresIn: 100, data: {} });
  assert.deepEqual(JSON.parse(refresh.calls[0].body), { grant_type: "refresh_token", refresh_token: "r1", client_id: "9d1c250a-e61b-44d9-88ed-5944d1962f5e" });
  assert.deepEqual(await flow.refresh("r1", io(refresh)), { accessToken: "newer", refreshToken: "r2", data: {} });
  assert.equal(await flow.refresh("r1", io(refresh)), null, "any failure is null (kept)");
  assert.equal(await flow.refresh("r1", io(refresh)), null, "no access token is a failure too");
});

test("codex sign-in: the fixed 1455 callback, %20 scope, form exchange with the id_token's account; refresh does not reread it", async () => {
  const flow = OAUTH_PROVIDERS.codex;
  assert.deepEqual([flow.fixedRedirect, flow.refreshLeadMs, flow.maxRefreshAgeMs], ["http://localhost:1455/auth/callback", 5 * 86_400_000, 8 * 86_400_000]);
  assert.equal(flow.authUrl(flow.fixedRedirect, "st", "ch", {}),
    "https://auth.openai.com/oauth/authorize?response_type=code&client_id=app_EMoamEEZ73f0CkXaXp7hrann&redirect_uri=http%3A%2F%2Flocalhost%3A1455%2Fauth%2Fcallback"
    + "&scope=openid%20profile%20email%20offline_access&code_challenge=ch&code_challenge_method=S256&id_token_add_organizations=true&codex_cli_simplified_flow=true&originator=codex_cli_rs&state=st");
  const idToken = jwt({ email: "a@x.dev", "https://api.openai.com/auth": { chatgpt_account_id: "acc_1", chatgpt_plan_type: "plus" } });
  const transport = fakeTransport(json(200, { access_token: "at", refresh_token: "rt", id_token: idToken, expires_in: 864000 }), json(401, "no"), json(200, {}));
  const tokens = await flow.exchange("code1", flow.fixedRedirect, "ver", {}, io(transport));
  assert.deepEqual(tokens, { accessToken: "at", refreshToken: "rt", expiresIn: 864000, email: "a@x.dev", data: { chatgptAccountId: "acc_1", chatgptPlanType: "plus" } });
  const sent = transport.calls[0];
  assert.deepEqual([sent.url, sent.headers["content-type"]], ["https://auth.openai.com/oauth/token", "application/x-www-form-urlencoded"]);
  assert.equal(sent.body, "grant_type=authorization_code&client_id=app_EMoamEEZ73f0CkXaXp7hrann&code=code1&redirect_uri=http%3A%2F%2Flocalhost%3A1455%2Fauth%2Fcallback&code_verifier=ver");
  await assert.rejects(flow.exchange("c", "r", "v", {}, io(transport)), /Token exchange failed: no/);
  await assert.rejects(flow.exchange("c", "r", "v", {}, io(transport)), /Codex returned no access token/);
  const fallback = fakeTransport(json(200, { access_token: jwt({ preferred_username: "ada" }), id_token: jwt({ account_id: "acc_2", plan_type: "pro" }) }), json(200, { access_token: jwt({ sub: "user-1" }), id_token: "broken" }));
  const other = await flow.exchange("c", "r", "v", {}, io(fallback));
  assert.deepEqual([other.email, other.data], ["ada", { chatgptAccountId: "acc_2", chatgptPlanType: "pro" }], "the access token's name when the id_token has no email");
  const bare = await flow.exchange("c", "r", "v", {}, io(fallback));
  assert.deepEqual([bare.email, bare.data], ["user-1", {}], "an unreadable id_token gives no account");

  const refresh = fakeTransport(json(200, { access_token: "at2", id_token: jwt({ email: "b@x.dev" }), expires_in: 5 }), json(400, { error: "invalid_grant" }), json(200, {}));
  assert.deepEqual(await flow.refresh("rt", io(refresh)), { accessToken: "at2", refreshToken: "rt", expiresIn: 5, data: {} });
  assert.deepEqual(JSON.parse(refresh.calls[0].body), { client_id: "app_EMoamEEZ73f0CkXaXp7hrann", grant_type: "refresh_token", refresh_token: "rt" });
  assert.equal(await flow.refresh("rt", io(refresh)), null);
  assert.equal(await flow.refresh("rt", io(refresh)), null);
});

test("claude requests: ?beta=true, Bearer, the beta list, 9router's cache marks and max tokens; cloaking only for an OAuth token", async () => {
  assert.deepEqual([claude.auth.header, claude.auth.scheme, claude.testByExpiry], ["authorization", "bearer", true]);
  const tools = [{ name: "lookup", description: "d", parameters: { type: "object" } }, { name: "late", parameters: { type: "object" } }];
  const request = {
    model: "claude-sonnet-5", stream: false, maxOutputTokens: 500_000,
    system: [{ type: "text", text: "sys", cacheControl: "ephemeral" }],
    tools, toolChoice: { name: "lookup" },
    messages: [
      { role: "user", content: [{ type: "text", text: "q", cacheControl: "ephemeral" }] },
      { role: "assistant", content: [{ type: "thinking", text: "unsigned" }, { type: "text", text: "before" }, { type: "tool_call", id: "t0", name: "lookup", arguments: "{}" }, { type: "text", text: "after" }] },
      { role: "tool", content: [{ type: "tool_result", toolCallId: "t0", content: [{ type: "text", text: "out" }] }] },
    ],
  };
  const plain = fakeTransport(json(200, ok));
  await createAdapter(claude, plain).execute(request, { kind: "api-key", apiKey: "sk-ant-api-key" }, ctx);
  const call = plain.calls[0];
  assert.equal(call.url, "https://api.anthropic.com/v1/messages?beta=true");
  assert.equal(call.headers.authorization, "Bearer sk-ant-api-key");
  assert.equal(call.headers["x-api-key"], undefined);
  assert.equal(call.headers["user-agent"], "claude-cli/2.1.280 (external, sdk-cli)");
  assert.equal(call.headers["anthropic-beta"].split(",").at(-1), "effort-2025-11-24", "opus/sonnet get the heavy-agent flags");
  const body = JSON.parse(call.body);
  assert.equal(body.max_tokens, 128000, "clamped to the model's output ceiling");
  assert.deepEqual(body.system, [{ type: "text", text: "sys", cache_control: { type: "ephemeral", ttl: "1h" } }]);
  assert.deepEqual(body.messages[0].content, [{ type: "text", text: "q" }], "the client's marks are replaced");
  assert.deepEqual(body.messages[1].content, [{ type: "text", text: "before" }, { type: "tool_use", id: "t0", name: "lookup", input: {}, cache_control: { type: "ephemeral" } }],
    "unsigned thinking and text after the call dropped; the last assistant block marked");
  assert.deepEqual(body.tools.map((t) => [t.name, t.cache_control]), [["lookup", undefined], ["late", { type: "ephemeral", ttl: "1h" }]]);
  assert.equal(body.metadata, undefined, "no cloaking for a key");

  const cloaked = fakeTransport(json(200, message));
  const answer = await createAdapter(claude, cloaked).execute(request, { kind: "api-key", apiKey: OAT, sessionId: "conn-1" }, ctx);
  assert.equal(answer.content[0].name, "lookup", "the cloaked name comes back");
  const sent = JSON.parse(cloaked.calls[0].body);
  const [billing, ...system] = sent.system;
  assert.match(billing.text, /^x-anthropic-billing-header: cc_version=2\.1\.280\.[0-9a-f]{3}; cc_entrypoint=sdk-cli; cch=[0-9a-f]{5};$/);
  const unrename = (name) => name.replace(/_ide$/, "");
  const before = {
    ...sent, system, tools: sent.tools.slice(0, 2).map((t) => ({ ...t, name: unrename(t.name) })), tool_choice: { type: "tool", name: "lookup" },
    messages: sent.messages.map((m) => ({ ...m, content: m.content.map((b) => (b.type === "tool_use" ? { ...b, name: unrename(b.name) } : b)) })),
  };
  delete before.metadata;
  assert.equal(billing.text.match(/cch=([0-9a-f]{5})/)[1], createHash("sha256").update(JSON.stringify(before)).digest("hex").slice(0, 5), "cch hashes the body before the billing block and the renaming");
  const user = JSON.parse(sent.metadata.user_id);
  assert.equal(user.device_id, createHash("sha256").update(`device:${OAT}`).digest("hex"));
  const seed = createHash("sha256").update(`account:${OAT}`).digest("hex");
  assert.equal(user.account_uuid, `${seed.slice(0, 8)}-${seed.slice(8, 12)}-4${seed.slice(13, 16)}-${((parseInt(seed[16], 16) & 3) | 8).toString(16)}${seed.slice(17, 20)}-${seed.slice(20, 32)}`);
  assert.equal(user.session_id, "conn-1");
  assert.deepEqual(sent.tools.slice(0, 2).map((t) => t.name), ["lookup_ide", "late_ide"]);
  assert.equal(sent.tools.length, 22, "20 decoy tools follow");
  assert.deepEqual(sent.tools[2], { name: "Task", description: "This tool is currently unavailable.", input_schema: { type: "object", properties: {} } });
  assert.equal(sent.tools.at(-1).name, "ExitPlanMode");
  assert.deepEqual(sent.tool_choice, { type: "tool", name: "lookup_ide" });
  assert.equal(sent.messages[1].content[1].name, "lookup_ide", "history renamed");

  const unnamed = fakeTransport(json(200, ok));
  await createAdapter(claude, unnamed).execute({ model: "future-model", stream: false, messages: [request.messages[0]] }, { kind: "api-key", apiKey: OAT }, ctx);
  assert.equal(unnamed.calls[0].headers["anthropic-beta"], "claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,context-management-2025-06-27,prompt-caching-scope-2026-01-05,structured-outputs-2025-12-15,fast-mode-2026-02-01,redact-thinking-2026-02-12,token-efficient-tools-2026-03-28", "the list chosen for any model id, not the catalog header");
  const server = fakeTransport(json(200, ok));
  await createAdapter(claude, server).execute({
    model: "claude-sonnet-5", stream: false, messages: [request.messages[0]],
    vendorExtensions: { anthropic: { tools: [{ name: "a", input_schema: {} }, { type: "web_search_20250305", name: "web_search" }, { name: "b", defer_loading: true, input_schema: {} }] } },
  }, { kind: "api-key", apiKey: OAT }, ctx);
  const serverTools = JSON.parse(server.calls[0].body).tools;
  assert.deepEqual(serverTools.slice(0, 3).map((t) => [t.name, t.cache_control]), [["a_ide", undefined], ["web_search", { type: "ephemeral", ttl: "1h" }], ["b_ide", undefined]],
    "a typed server tool keeps its name; a deferred tool cannot hold the mark");
  const client = fakeTransport(json(200, ok));
  await createAdapter(claude, client).execute({ model: "claude-sonnet-5", stream: false, messages: [request.messages[0]], vendorExtensions: { anthropic: { metadata: { user_id: "client" } } } }, { kind: "api-key", apiKey: OAT }, ctx);
  const clientBody = JSON.parse(client.calls[0].body);
  assert.equal(clientBody.metadata.user_id, "client", "a client's user id is kept");
  assert.equal(clientBody.tools, undefined, "no tools: none added");
  assert.match(clientBody.system[0].text, /^x-anthropic-billing-header:/, "a request without a system prompt still gets the billing block");
  assert.equal(clientBody.system.length, 1);
});

test("claude: thinking reconciled with max tokens, signed thinking kept, a placeholder added, empty turns dropped; stream names decloaked; models use x-api-key", async () => {
  const signed = Buffer.from([0x12, 1, 2]).toString("base64");
  assert.equal(isClaudeSignature(signed), true);
  assert.equal(isClaudeSignature(`cache#${signed}`), true);
  assert.equal(isClaudeSignature(Buffer.from(signed).toString("base64")), true, "the double-encoded R form");
  assert.equal(isClaudeSignature(Buffer.from(Buffer.from([0x13, 1, 2]).toString("base64")).toString("base64")), false, "an R form whose inner signature lacks the marker");
  assert.equal(isClaudeSignature("Rw=="), false, "an R form whose outer text does not start with E");
  assert.equal(isClaudeSignature("Enot-base64!!"), false);
  assert.equal(isClaudeSignature(Buffer.from([0x13]).toString("base64")), false);
  assert.equal(isClaudeSignature(undefined), false);
  const transport = fakeTransport(sse([
    { type: "message_start", message: { id: "m", model: "claude-haiku-4-5-20251001", usage: {} } },
    { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "t1", name: "lookup_ide" } },
    { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "t2", name: "Bash" } },
    { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 1 } },
    { type: "message_stop" },
  ]));
  const chunks = [];
  const request = {
    model: "claude-haiku-4-5-20251001", stream: true, maxOutputTokens: 100_000, reasoning: { budgetTokens: 64_000 },
    system: [{ type: "text", text: "one" }, { type: "text", text: "two" }],
    tools: [{ name: "lookup", parameters: { type: "object" } }],
    messages: [
      { role: "user", content: [{ type: "text", text: "q" }] },
      { role: "assistant", content: [{ type: "tool_call", id: "t0", name: "lookup", arguments: "{}" }] },
      { role: "tool", content: [{ type: "tool_result", toolCallId: "t0", content: [{ type: "text", text: "r" }] }] },
      { role: "assistant", content: [{ type: "thinking", text: "why", signature: signed }, { type: "tool_call", id: "t1", name: "lookup", arguments: "{}" }] },
      { role: "tool", content: [{ type: "tool_result", toolCallId: "t1", content: [{ type: "text", text: "r1" }] }] },
      { role: "assistant", content: [{ type: "thinking", text: "kept", signature: signed }, { type: "text", text: "a" }] },
      { role: "user", content: [{ type: "text", text: "go" }] },
      { role: "assistant", content: [{ type: "text", text: "  " }] },
      { role: "tool", content: [{ type: "tool_result", toolCallId: "t9", content: [{ type: "text", text: "late" }] }] },
    ],
  };
  for await (const chunk of createAdapter(claude, transport).stream(request, { kind: "api-key", apiKey: OAT }, ctx)) chunks.push(chunk);
  assert.deepEqual(chunks.filter((c) => c.type === "tool_call_delta").map((c) => c.name), ["lookup", "Bash"], "a decoy name passes as it is");
  const body = JSON.parse(transport.calls[0].body);
  assert.equal(body.max_tokens, 64000, "no declared ceiling: 9router's 64000");
  assert.deepEqual(body.thinking, { type: "enabled", budget_tokens: 62976 }, "a budget equal to the cap shrinks below it");
  assert.deepEqual(body.system.slice(1).map((b) => [b.text, b.cache_control]), [["one", undefined], ["two", { type: "ephemeral", ttl: "1h" }]], "only the last system block is marked");
  assert.equal(transport.calls[0].headers["anthropic-beta"].includes("effort-2025-11-24"), false, "haiku: no heavy-agent flags");
  assert.deepEqual(body.messages[1].content[0], { type: "thinking", thinking: ".", signature: body.messages[1].content[0].signature }, "a tool turn without thinking gets the placeholder");
  assert.ok(isClaudeSignature(body.messages[1].content[0].signature));
  assert.deepEqual(body.messages[3].content.map((b) => b.type), ["thinking", "tool_use"], "a tool turn with signed thinking gets no placeholder");
  assert.deepEqual(body.messages[5].content.map((b) => b.type), ["thinking", "text"], "signed thinking survives");
  const marks = body.messages.filter((m) => m.role === "assistant").flatMap((m) => m.content).filter((b) => b.cache_control);
  assert.deepEqual(marks.map((b) => b.text), ["a"], "only the last assistant turn is marked");
  assert.deepEqual(body.messages.at(-1).content.map((b) => b.type), ["tool_result", "text"], "a blank turn goes and its neighbours merge, tool results first");

  const models = fakeTransport(json(200, { data: [{ id: "claude-sonnet-5" }] }));
  const listed = await createAdapter(claude, models).getModels({ kind: "api-key", apiKey: OAT }, ctx);
  assert.deepEqual(listed.map((m) => m.id), ["claude-sonnet-5"]);
  assert.deepEqual(models.calls[0].headers, { "anthropic-version": "2023-06-01", "content-type": "application/json", "x-api-key": OAT }, "kept from 9router: x-api-key, no beta");
});

test("a non-Claude client's request to claude gets the Claude Code prompt and its own system joined after it", () => {
  const request = withClaudeCodePrompt({ model: "m", stream: false, system: [{ type: "text", text: "a" }, { type: "text", text: "" }, { type: "text", text: "b", cacheControl: "ephemeral" }], messages: [] });
  assert.deepEqual(request.system, [{ type: "text", text: CLAUDE_CODE_PROMPT }, { type: "text", text: "a\nb" }]);
  assert.deepEqual(withClaudeCodePrompt({ model: "m", stream: false, messages: [] }).system, [{ type: "text", text: "You are Claude Code, Anthropic's official CLI for Claude." }]);
});

test("codex body: 9router's CodexExecutor transform, allowlist and defaults", () => {
  const body = codexBody({
    model: "gpt-5.5-review", input: [
      { type: "message", role: "system", content: [{ type: "input_text", text: "s" }] },
      { type: "item_reference", id: "rs_1" }, "rs_2", "keep", 7,
      { type: "function_call", id: "fc_9", call_id: "c1", name: "f", arguments: "{}" },
      { type: "message", role: "system", id: "msg_2", content: [] },
      { type: "reasoning", role: "system", id: "item_3" },
    ],
    instructions: "  ", temperature: 1, max_output_tokens: 9, metadata: {}, previous_response_id: "resp_1", service_tier: "fast", unknown: 1, _compact: true,
    tools: [
      { type: "function", function: { name: "  f  ", description: "d", parameters: { type: "object", properties: { p: { type: "string", pattern: "^[^\\p{Cc}]+$" }, pattern: { type: "string", pattern: "ok" } } } } },
      { type: "web_search" }, { type: "custom", name: "c", format: {} }, { type: "unknown_hosted" }, { name: "x", function: {} }, "bad",
      { type: "function", name: "flat", parameters: { type: "object", items: [{ pattern: "\\\\p{literal}" }] } },
      { type: "function", function: { name: "   " } },
      { type: "namespace", tools: [{ name: "n1", parameters: { type: "object", pattern: "\\P{L}" } }, { name: "" }] },
      { type: "namespace", description: "no list" },
    ],
    tool_choice: { type: "function", name: "missing" },
  }, "sess-1");
  assert.deepEqual(Object.keys(body).sort(), ["include", "input", "instructions", "model", "prompt_cache_key", "reasoning", "service_tier", "store", "stream", "tools"]);
  assert.equal(body.model, "gpt-5.5", "a review model goes out as its base");
  assert.deepEqual([body.stream, body.store, body.prompt_cache_key, body.service_tier], [true, false, "sess-1", "priority"]);
  assert.match(body.instructions, /^You are Codex, based on GPT-5\./);
  assert.deepEqual(body.reasoning, { effort: "low", summary: "auto" });
  assert.deepEqual(body.include, ["reasoning.encrypted_content"]);
  assert.deepEqual(body.input, [
    { type: "message", role: "developer", content: [{ type: "input_text", text: "s" }] }, "keep", 7,
    { type: "function_call", call_id: "c1", name: "f", arguments: "{}" },
    { type: "message", role: "developer", content: [] },
    { type: "reasoning", role: "system", id: "item_3" },
  ]);
  assert.deepEqual(body.tools.map((t) => t.type), ["function", "web_search", "custom", "function", "namespace", "namespace"]);
  assert.deepEqual(body.tools[0], { type: "function", name: "f", description: "d", parameters: { type: "object", properties: { p: { type: "string" }, pattern: { type: "string", pattern: "ok" } } } });
  assert.deepEqual(body.tools[3], { type: "function", name: "flat", parameters: { type: "object", items: [{ pattern: "\\\\p{literal}" }] } }, "an escaped backslash is no property escape");
  assert.deepEqual(body.tools[4].tools.map((t) => t.parameters), [{ type: "object" }, undefined]);
  const kept = codexBody({ model: "gpt-5.4", input: "x", tools: [{ type: "function", name: "g" }], tool_choice: { type: "function", name: " g " } }, "s");
  assert.deepEqual(kept.tool_choice, { type: "function", name: " g " }, "a choice naming a known function stays");
  assert.deepEqual(kept.tools[0].parameters, { type: "object", properties: {} });
  const suffix = codexBody({ model: "gpt-5.4-high", input: "" }, "s");
  assert.deepEqual([suffix.model, suffix.reasoning, suffix.input], ["gpt-5.4", { effort: "high", summary: "auto" }, [{ type: "message", role: "user", content: [{ type: "input_text", text: "..." }] }]]);
  const none = codexBody({ model: "gpt-5.4", input: "hi", reasoning: { effort: "none" }, prompt_cache_key: "own", instructions: "mine" }, "s");
  assert.deepEqual([none.include, none.prompt_cache_key, none.instructions, none.reasoning, none.input[0].content[0].text], [undefined, "own", "mine", { effort: "none", summary: "auto" }, "hi"]);
  assert.deepEqual(codexBody({ model: "gpt-5.4", input: [], reasoning: { effort: "max", summary: "detailed" }, service_tier: "flex" }, "s").reasoning, { effort: "xhigh", summary: "detailed" });
  assert.deepEqual(codexBody({ model: "gpt-5.4", input: [], reasoning_effort: "ultra" }, "s").reasoning, { effort: "xhigh", summary: "auto" });
  assert.equal(codexBody({ model: "gpt-5.4", input: [], service_tier: "flex" }, "s").service_tier, undefined);
  assert.equal(codexBody({ model: "gpt-x-review", input: "x" }, "s").model, "gpt-x", "an unknown review id loses the suffix");
  assert.equal(codexBody({ model: "codex-auto-review", input: "x" }, "s").model, "codex-auto-review", "the catalog keeps codex-auto-review");
});

test("codex requests: headers, the account header, the stream collapsed for execute, and the model list with -review twins", async () => {
  assert.deepEqual([codex.streamOnly, codex.accountIdHeader, codex.chatProbe.invalidStatuses], [true, "chatgpt-account-id", [401]]);
  const events = [
    { type: "response.output_text.delta", delta: "Hi" },
    { type: "response.output_item.added", output_index: 1, item: { type: "function_call", call_id: "c1", name: "f" } },
    { type: "response.function_call_arguments.delta", output_index: 1, delta: "{}" },
    { type: "response.completed", response: { id: "resp_1", usage: { input_tokens: 3, output_tokens: 1 } } },
  ];
  const transport = fakeTransport(sse(events), sse(events));
  const connected = withConnection(codex, { accountId: "acc_1" });
  const answer = await createAdapter(connected, transport).execute({ model: "gpt-5.5", stream: false, messages: [{ role: "user", content: [{ type: "text", text: "q" }] }] }, { kind: "api-key", apiKey: "at", sessionId: "conn-9" }, ctx);
  assert.equal(answer.content[0].text, "Hi");
  assert.equal(answer.usage.inputTokens, 3);
  const call = transport.calls[0];
  assert.equal(call.url, "https://chatgpt.com/backend-api/codex/responses");
  assert.deepEqual([call.headers.authorization, call.headers.originator, call.headers["user-agent"], call.headers.session_id, call.headers["chatgpt-account-id"], call.headers.accept],
    ["Bearer at", "codex_cli_rs", "codex_cli_rs/0.154.0", "conn-9", "acc_1", "text/event-stream"]);
  assert.equal(JSON.parse(call.body).stream, true);
  await createAdapter(codex, transport).execute({ model: "gpt-5.5", stream: false, messages: [] }, { kind: "api-key", apiKey: "at" }, ctx);
  assert.deepEqual([transport.calls[1].headers.session_id, JSON.parse(transport.calls[1].body).prompt_cache_key, transport.calls[1].headers["chatgpt-account-id"]], ["default", "default", undefined]);

  const models = fakeTransport(json(200, { models: [{ slug: "gpt-5.5", display_name: "GPT" }, { slug: "gpt-image-2", type: "image" }, { id: "text-embed" }, { id: "gpt-5.4-review" }, { id: "has space" }] }));
  const listed = await createAdapter(connected, models).getModels({ kind: "api-key", apiKey: "at" }, ctx);
  assert.deepEqual(listed.map((m) => m.id), ["gpt-5.5", "gpt-5.5-review", "gpt-image-2", "text-embed", "gpt-5.4-review"]);
  assert.equal(listed[0].descriptor.id, "gpt-5.5", "a catalog id carries its descriptor");
  assert.equal(models.calls[0].url, "https://chatgpt.com/backend-api/codex/models?client_version=0.144.6");
  assert.deepEqual(models.calls[0].headers, { "content-type": "application/json", accept: "application/json", authorization: "Bearer at", originator: "codex_cli_rs" }, "kept: no user agent, no account id");
  assert.deepEqual(codexModelIds([{ id: "a" }]), ["a", "a-review"]);
  assert.deepEqual(codexModelIds({ data: [{ model: "b" }], models: [{ id: "ignored" }] }), ["b", "b-review"]);
  assert.deepEqual(codexModelIds({ results: [{ name: "c" }, {}] }), ["c", "c-review"]);
  assert.deepEqual(codexModelIds(null), []);
});

test("codex compaction: the URL follows the previous request's flag (kept from 9router)", async () => {
  const stream = () => sse([{ type: "response.completed", response: { id: "r", usage: {} } }]);
  const transport = fakeTransport(stream(), stream(), stream());
  const adapter = createAdapter(codex, transport);
  const send = (compact) => adapter.execute({ model: "gpt-5.5", stream: false, messages: [], vendorExtensions: { responses: { input: "q", ...(compact ? { _compact: true } : {}) } } }, { kind: "api-key", apiKey: "at" }, ctx);
  await send(true);
  await send(false);
  await send(false);
  assert.deepEqual(transport.calls.map((c) => c.url.endsWith("/compact")), [false, true, false]);
  assert.equal(JSON.parse(transport.calls[0].body)._compact, undefined, "the flag never reaches codex");
});
