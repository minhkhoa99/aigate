// Contract: docs/contracts/provider-connection-data.md — azure, cloudflare-ai, and clinepass against a fake HttpTransportPort.
import { test } from "node:test";
import assert from "node:assert/strict";
import { builtinRegistry, createAdapter, OpenAICompatibleAdapter, UnsupportedFeatureError, withConnection } from "../dist/index.js";

const azure = builtinRegistry.provider("azure");
const cloudflare = builtinRegistry.provider("cloudflare-ai");
const clinepass = builtinRegistry.provider("clinepass");
const credential = { kind: "api-key", apiKey: "conn-data-secret-1234" };
const encoder = new TextEncoder();
const ctx = () => ({ signal: new AbortController().signal, requestId: "test" });
const stream = (text) => new ReadableStream({ start(controller) { controller.enqueue(encoder.encode(text)); controller.close(); } });
const json = (status, value) => ({ status, headers: { "content-type": "application/json" }, body: stream(JSON.stringify(value)) });
function fakeTransport(...answers) {
  const calls = [];
  return {
    calls,
    async send(request) {
      calls.push(request);
      const next = answers.shift();
      if (next === undefined) throw new Error(`unexpected transport call to ${request.url}`);
      return next;
    },
  };
}
const answer = (content = "ok") => json(200, { id: "c1", model: "m", choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] });
const hello = (model) => ({ model, stream: false, messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }] });

test("azure, cloudflare-ai, and clinepass are connectable; cline still needs OAuth", () => {
  for (const id of ["azure", "cloudflare-ai", "clinepass"]) assert.deepEqual(builtinRegistry.status(id), { connectable: true }, id);
  assert.deepEqual(builtinRegistry.status("cline"), { connectable: false, reason: "Needs OAuth sign-in (SP16)" });
  assert.deepEqual(azure.auth, { kind: "api-key", header: "api-key", scheme: "raw" });
  assert.deepEqual(azure.connectionFields.required, ["baseUrl"]);
  assert.deepEqual(cloudflare.connectionFields, { required: ["accountId"], optional: [] });
  assert.ok(createAdapter(azure, fakeTransport()) instanceof OpenAICompatibleAdapter);
});

test("azure: the connection fills the deployment URL, the key goes in api-key, and an organization is a header", async () => {
  const stored = withConnection(azure, { baseUrl: "https://res.openai.azure.com/", deployment: "prod dep", organization: "org-7" });
  assert.equal(stored.chatUrl, "https://res.openai.azure.com/openai/deployments/prod%20dep/chat/completions?api-version=2024-10-01-preview");
  assert.equal(stored.headers["openai-organization"], "org-7");
  const transport = fakeTransport(answer(), answer());
  await new OpenAICompatibleAdapter(stored, transport).execute(hello("gpt-4o"), credential, ctx());
  assert.equal(transport.calls[0].headers["api-key"], credential.apiKey);
  assert.equal(transport.calls[0].headers.authorization, undefined);
  const byModel = withConnection(azure, { baseUrl: "https://res.openai.azure.com", apiVersion: "2025-01-01" });
  await new OpenAICompatibleAdapter(byModel, transport).execute(hello("my/model"), credential, ctx());
  assert.equal(transport.calls[1].url, "https://res.openai.azure.com/openai/deployments/my%2Fmodel/chat/completions?api-version=2025-01-01", "no deployment: the request model, encoded");
  await assert.rejects(new OpenAICompatibleAdapter(azure, fakeTransport()).execute(hello("gpt-4o"), credential, ctx()),
    (e) => e.code === "INVALID_REQUEST" && e.message === "The Azure OpenAI connection has no baseUrl; set it in AIGate: Providers → Connections");
});

test("azure's connection test posts a one-token chat and only 401/403 fail it, as in 9router", async () => {
  const stored = withConnection(azure, { baseUrl: "https://res.openai.azure.com" });
  const transport = fakeTransport(json(404, { error: { code: "DeploymentNotFound", message: "no deployment" } }), json(401, { error: { message: `bad key ${credential.apiKey}` } }), json(500, {}));
  const adapter = new OpenAICompatibleAdapter(stored, transport);
  assert.deepEqual(await adapter.validateCredential(credential, ctx()), { valid: true }, "a missing deployment still passes (kept)");
  assert.equal(transport.calls[0].url, "https://res.openai.azure.com/openai/deployments/gpt-4/chat/completions?api-version=2024-10-01-preview");
  assert.deepEqual(JSON.parse(transport.calls[0].body), { messages: [{ role: "user", content: "test" }], max_completion_tokens: 1 });
  assert.deepEqual(await adapter.validateCredential(credential, ctx()), { valid: false, code: "AUTH_ERROR", message: "Azure OpenAI answered 401: bad key ***" });
  assert.deepEqual(await adapter.validateCredential(credential, ctx()), { valid: true });
});

test("cloudflare-ai: the account id fills the URL, text parts are joined, and an image is refused", async () => {
  const stored = withConnection(cloudflare, { accountId: "0123abcd" });
  assert.equal(stored.chatUrl, "https://api.cloudflare.com/client/v4/accounts/0123abcd/ai/v1/chat/completions");
  const transport = fakeTransport(answer());
  await new OpenAICompatibleAdapter(stored, transport).execute({ ...hello("@cf/meta/llama-3.1-8b-instruct"), messages: [{ role: "user", content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] }] }, credential, ctx());
  assert.deepEqual(JSON.parse(transport.calls[0].body).messages, [{ role: "user", content: "ab" }]);
  assert.equal(transport.calls[0].headers.authorization, `Bearer ${credential.apiKey}`);
  const withImage = { ...hello("@cf/x"), messages: [{ role: "user", content: [{ type: "text", text: "see" }, { type: "image", source: { kind: "url", url: "https://x.example/a.png" } }] }] };
  await assert.rejects(new OpenAICompatibleAdapter(stored, fakeTransport()).execute(withImage, credential, ctx()),
    (e) => e instanceof UnsupportedFeatureError && e.message === "openai-compatible cannot carry image_url content for a provider that takes text only");
  const probes = fakeTransport(json(404, { errors: [{ message: "account" }] }), json(400, {}));
  const adapter = new OpenAICompatibleAdapter(stored, probes);
  assert.deepEqual(await adapter.validateCredential(credential, ctx()), { valid: false, code: "AUTH_ERROR", message: "Cloudflare answered 404" });
  assert.deepEqual(JSON.parse(probes.calls[0].body), { model: cloudflare.models[0].id, messages: [{ role: "user", content: "test" }], max_tokens: 1 });
  assert.deepEqual(await adapter.validateCredential(credential, ctx()), { valid: true });
});

test("clinepass: Cline headers naming AIGate, the { success, data } envelope unwrapped, and a real test", async () => {
  assert.equal(clinepass.headers["user-agent"], "AIGate/0.1.0");
  assert.equal(clinepass.headers["x-client-type"], "aigate");
  assert.equal(clinepass.headers["x-platform"], process.platform);
  assert.deepEqual([clinepass.headers["http-referer"], clinepass.headers["x-title"], clinepass.headers["x-is-multiroot"]], ["https://cline.bot", "Cline", "false"]);
  const wrapped = json(200, { success: true, data: { id: "c9", model: "cline-pass/glm-5.2", choices: [{ index: 0, message: { role: "assistant", content: "inside" }, finish_reason: "stop" }] } });
  const transport = fakeTransport(wrapped, json(200, { success: false, error: "quota", data: { choices: [{ index: 0, message: { role: "assistant", content: "stale" } }] } }),
    json(401, { error: "Unauthorized: re-authenticate your Cline account." }));
  const adapter = new OpenAICompatibleAdapter(clinepass, transport);
  assert.deepEqual((await adapter.execute(hello("cline-pass/glm-5.2"), credential, ctx())).content, [{ type: "text", text: "inside" }]);
  assert.equal(transport.calls[0].headers["x-client-version"], "0.1.0");
  await assert.rejects(adapter.execute(hello("cline-pass/glm-5.2"), credential, ctx()), (e) => e.code === "PROVIDER_UNAVAILABLE", "a failure envelope is left as it is");
  assert.deepEqual(await adapter.validateCredential(credential, ctx()), { valid: false, code: "AUTH_ERROR", message: "ClinePass answered 401: Unauthorized: re-authenticate your Cline account." });
  assert.equal(transport.calls[2].url, "https://api.cline.bot/api/v1/chat/completions", "GET /models answers 200 without a key, so the test is a chat");
  assert.deepEqual(JSON.parse(transport.calls[2].body), { model: clinepass.models[0].id, messages: [{ role: "user", content: "test" }], max_tokens: 1 });
  const plain = fakeTransport(json(200, { success: true, data: { choices: [{ index: 0, message: { role: "assistant", content: "wrapped" } }] } }));
  await assert.rejects(new OpenAICompatibleAdapter(builtinRegistry.provider("groq"), plain).execute(hello("x"), credential, ctx()), (e) => e.code === "PROVIDER_UNAVAILABLE", "only clinepass unwraps");
});
