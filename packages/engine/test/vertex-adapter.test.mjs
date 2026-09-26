// Contract: docs/contracts/provider-vertex.md — vertex and vertex-partner against a fake HttpTransportPort.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { builtinRegistry, createAdapter, parseGoogleCredential, VertexAdapter, VertexPartnerAdapter } from "../dist/index.js";

const vertex = builtinRegistry.provider("vertex");
const partner = builtinRegistry.provider("vertex-partner");
const encoder = new TextEncoder();
const ctx = () => ({ signal: new AbortController().signal, requestId: "test" });
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });

const stream = (text) => new ReadableStream({ start(controller) { controller.enqueue(encoder.encode(text)); controller.close(); } });
const json = (status, value) => ({ status, headers: { "content-type": "application/json" }, body: stream(JSON.stringify(value)) });
const sse = (events) => ({ status: 200, headers: { "content-type": "text/event-stream" }, body: stream(events.map((e) => `data: ${JSON.stringify(e)}\r\n\r\n`).join("")) });
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
async function collect(iterable) {
  const chunks = [];
  for await (const chunk of iterable) chunks.push(chunk);
  return chunks;
}
const serviceAccount = (email, extra = {}) => ({ kind: "api-key", apiKey: JSON.stringify({ type: "service_account", project_id: "my-proj", client_email: email, private_key: privateKey, ...extra }) });
const token = (value) => json(200, { access_token: value, expires_in: 3599, token_type: "Bearer" });
const reply = (parts) => json(200, { responseId: "r1", modelVersion: "gemini-2.5-flash", candidates: [{ content: { role: "model", parts }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 1 } });
const hello = { model: "gemini-2.5-flash", stream: false, messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }] };
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const b64url = (part) => Buffer.from(part, "base64url");

test("vertex and vertex-partner are connectable with Google Cloud credentials; qoder is not ported", () => {
  assert.equal(vertex.protocol, "vertex");
  assert.deepEqual(vertex.auth, { kind: "api-key", header: "x-goog-api-key", scheme: "raw", googleCloud: true });
  assert.equal(partner.protocol, "openai-compatible");
  assert.equal(partner.auth.googleCloud, true);
  assert.ok(createAdapter(vertex, fakeTransport()) instanceof VertexAdapter);
  assert.ok(createAdapter(partner, fakeTransport()) instanceof VertexPartnerAdapter);
  assert.deepEqual(builtinRegistry.status("qoder-cn"), { connectable: false, reason: "Not supported: needs Qoder CLI impersonation" });
});

test("parseGoogleCredential recognises service accounts, authorized_user credentials, and API keys", () => {
  assert.deepEqual(parseGoogleCredential("AQ.key-123"), { kind: "api-key", key: "AQ.key-123" });
  assert.equal(parseGoogleCredential(serviceAccount("a@p.iam").apiKey).kind, "service-account");
  const adc = parseGoogleCredential(JSON.stringify({ type: "authorized_user", client_id: "c", client_secret: "s", refresh_token: "r", quota_project_id: "q" }));
  assert.deepEqual(adc, { kind: "authorized-user", clientId: "c", clientSecret: "s", refreshToken: "r", projectId: "q" });
  assert.match(parseGoogleCredential(JSON.stringify({ type: "service_account", client_email: "a" })).error, /client_email, private_key, and project_id/);
  assert.match(parseGoogleCredential(JSON.stringify({ type: "authorized_user", client_id: "c", client_secret: "s", refresh_token: "r" })).error, /quota_project_id/);
  assert.match(parseGoogleCredential(JSON.stringify({ type: "external_account" })).error, /service_account or authorized_user/);
  assert.match(parseGoogleCredential("{not json").error, /not a JSON object/);
});

test("a service account mints a signed RS256 token, calls the project's global location with Bearer, and reuses the token", async () => {
  const credential = serviceAccount("sa-one@my-proj.iam.gserviceaccount.com");
  const transport = fakeTransport(token("tok-1"), reply([{ text: "ok" }]), reply([{ text: "again" }]));
  const adapter = new VertexAdapter(vertex, transport);
  await adapter.execute({ ...hello, messages: [
    { role: "user", content: [{ type: "text", text: "q" }] },
    { role: "assistant", content: [{ type: "tool_call", id: "call_1", name: "lookup", arguments: "{}" }] },
    { role: "tool", content: [{ type: "tool_result", toolCallId: "call_1", content: [{ type: "text", text: "{\"ok\":1}" }] }] },
  ] }, credential, ctx());
  const [mint, chat] = transport.calls;
  assert.equal(mint.url, TOKEN_URL);
  assert.equal(mint.headers["content-type"], "application/x-www-form-urlencoded");
  const form = new URLSearchParams(mint.body);
  assert.equal(form.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
  const [header, claims, signature] = form.get("assertion").split(".");
  assert.deepEqual(JSON.parse(b64url(header)), { alg: "RS256", typ: "JWT" });
  const payload = JSON.parse(b64url(claims));
  assert.deepEqual([payload.iss, payload.scope, payload.aud, payload.exp - payload.iat], ["sa-one@my-proj.iam.gserviceaccount.com", "https://www.googleapis.com/auth/cloud-platform", TOKEN_URL, 3600]);
  assert.ok(verify("RSA-SHA256", Buffer.from(`${header}.${claims}`), publicKey, b64url(signature)), "signed with the private key");
  assert.equal(chat.url, "https://aiplatform.googleapis.com/v1/projects/my-proj/locations/global/publishers/google/models/gemini-2.5-flash:generateContent");
  assert.equal(chat.headers.authorization, "Bearer tok-1");
  assert.equal(chat.headers["x-goog-api-key"], undefined);
  const contents = JSON.parse(chat.body).contents;
  assert.deepEqual(contents[1].parts[0].functionCall, { name: "lookup", args: {} }, "Vertex gets no call id");
  assert.equal(contents[1].parts[0].thoughtSignature.length, 1672, "the Vertex borrowed signature");
  assert.deepEqual(contents[2].parts[0], { functionResponse: { name: "lookup", response: { result: { ok: 1 } } } });
  await adapter.execute(hello, credential, ctx());
  assert.equal(transport.calls.length, 3, "the cached token is reused");
  assert.equal(transport.calls[2].headers.authorization, "Bearer tok-1");
});

test("a 401 re-mints the token once; a raw key is never retried and never goes in the URL", async () => {
  const credential = serviceAccount("sa-two@my-proj.iam.gserviceaccount.com");
  const transport = fakeTransport(token("old"), json(401, { error: { code: 401, message: "expired", status: "UNAUTHENTICATED" } }), token("new"), reply([{ text: "ok" }]));
  const answer = await new VertexAdapter(vertex, transport).execute(hello, credential, ctx());
  assert.deepEqual(answer.content, [{ type: "text", text: "ok" }]);
  assert.deepEqual(transport.calls.map((c) => c.url === TOKEN_URL ? "mint" : c.headers.authorization), ["mint", "Bearer old", "mint", "Bearer new"]);
  const keyed = fakeTransport(json(401, { error: { code: 401, message: "bad" } }));
  await assert.rejects(collect(new VertexAdapter(vertex, keyed).stream({ ...hello, stream: true }, { kind: "api-key", apiKey: "AQ.raw-key-1" }, ctx())), (e) => e.code === "AUTH_ERROR");
  assert.equal(keyed.calls.length, 1);
  assert.equal(keyed.calls[0].url, "https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:streamGenerateContent?alt=sse");
  assert.equal(keyed.calls[0].headers["x-goog-api-key"], "AQ.raw-key-1");
  assert.ok(!keyed.calls[0].url.includes("AQ.raw-key-1"));
});

test("a stream re-mints before its first chunk, and a real signature from Vertex is sent back unchanged", async () => {
  const credential = serviceAccount("sa-three@my-proj.iam.gserviceaccount.com");
  const transport = fakeTransport(
    token("t1"), json(401, { error: { code: 401, message: "expired" } }), token("t2"),
    sse([{ responseId: "s1", candidates: [{ content: { parts: [{ functionCall: { name: "lookup", args: { q: 1 } }, thoughtSignature: "SIG-VERTEX" }] }, finishReason: "STOP" }] }]),
    reply([{ text: "done" }]),
  );
  const adapter = new VertexAdapter(vertex, transport);
  const chunks = await collect(adapter.stream({ ...hello, stream: true }, credential, ctx()));
  const call = chunks.find((c) => c.type === "tool_call_delta");
  assert.equal(transport.calls[3].headers.authorization, "Bearer t2");
  await adapter.execute({ ...hello, messages: [{ role: "user", content: [{ type: "text", text: "q" }] }, { role: "assistant", content: [{ type: "tool_call", id: call.id, name: "lookup", arguments: "{}" }] }] }, credential, ctx());
  assert.equal(JSON.parse(transport.calls[4].body).contents[1].parts[0].thoughtSignature, "SIG-VERTEX", "corrected: 9router overwrites it");
});

test("an authorized_user credential refreshes once and keeps its token until it expires", async () => {
  const credential = { kind: "api-key", apiKey: JSON.stringify({ type: "authorized_user", client_id: "cid", client_secret: "csecret", refresh_token: "rtok", quota_project_id: "adc-proj" }) };
  const transport = fakeTransport(token("adc-1"), reply([{ text: "a" }]), reply([{ text: "b" }]));
  const adapter = new VertexAdapter(vertex, transport);
  await adapter.execute(hello, credential, ctx());
  await adapter.execute(hello, credential, ctx());
  assert.deepEqual(Object.fromEntries(new URLSearchParams(transport.calls[0].body)), { grant_type: "refresh_token", client_id: "cid", client_secret: "csecret", refresh_token: "rtok" });
  assert.equal(transport.calls.length, 3);
  assert.match(transport.calls[2].url, /\/projects\/adc-proj\/locations\/global\//);
});

test("the connection test mints a fresh token or probes the key", async () => {
  const refused = fakeTransport(json(400, { error: "invalid_grant", error_description: "Invalid JWT Signature." }));
  assert.deepEqual(await new VertexAdapter(vertex, refused).validateCredential(serviceAccount("sa-four@p.iam"), ctx()), {
    valid: false, code: "AUTH_ERROR", message: "Google's token endpoint answered 400 for the service-account key: invalid_grant: Invalid JWT Signature.",
  });
  await assert.rejects(new VertexAdapter(vertex, fakeTransport(json(503, {}))).validateCredential(serviceAccount("sa-five@p.iam"), ctx()), (e) => e.code === "PROVIDER_UNAVAILABLE");
  const badKey = await new VertexAdapter(vertex, fakeTransport()).validateCredential(serviceAccount("sa-six@p.iam", { private_key: "-----BEGIN PRIVATE KEY-----\nnope\n-----END PRIVATE KEY-----" }), ctx());
  assert.deepEqual([badKey.valid, badKey.message], [false, "The service-account private_key is not a PKCS#8 RSA private key"]);
  const minted = fakeTransport(token("fresh"));
  assert.deepEqual(await new VertexAdapter(vertex, minted).validateCredential(serviceAccount("sa-one@my-proj.iam.gserviceaccount.com"), ctx()), { valid: true });
  assert.equal(minted.calls.length, 1, "a cached token is not enough");
  // 9router: a key pasted with literal backslash-n sequences instead of line breaks still signs.
  const escaped = fakeTransport(token("escaped"));
  assert.deepEqual(await new VertexAdapter(vertex, escaped).validateCredential(serviceAccount("sa-seven@p.iam", { private_key: privateKey.replace(/\n/g, "\\n") }), ctx()), { valid: true });
  const probes = fakeTransport(
    json(400, { error: { code: 400, message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT" } }),
    json(404, { error: { code: 404, message: "Publisher Model `projects/proj-7/locations/us-central1/publishers/google/models/__probe__` not found." } }),
    json(404, { error: { code: 404, message: "not found" } }),
    json(500, {}),
    json(403, { error: { code: 403, message: "Permission denied on resource project projects/proj-8/ for AQ.denied." } }),
  );
  const adapter = new VertexAdapter(vertex, probes);
  assert.deepEqual(await adapter.validateCredential({ kind: "api-key", apiKey: "AQ.bad" }, ctx()), {
    valid: false, code: "AUTH_ERROR", message: "Google rejected the Vertex AI API key (400): API key not valid. Please pass a valid API key.",
  });
  assert.equal(probes.calls[0].url, "https://aiplatform.googleapis.com/v1/publishers/google/models/__probe__:generateContent");
  assert.equal(probes.calls[0].headers["x-goog-api-key"], "AQ.bad");
  assert.deepEqual(JSON.parse(probes.calls[0].body).contents[0].parts, [{ text: "ping" }]);
  assert.deepEqual(await adapter.validateCredential({ kind: "api-key", apiKey: "AQ.good" }, ctx()), { valid: true });
  assert.deepEqual(await adapter.validateCredential({ kind: "api-key", apiKey: "AQ.good2" }, ctx()), { valid: true }, "vertex needs no project for a key");
  await assert.rejects(adapter.validateCredential({ kind: "api-key", apiKey: "AQ.down" }, ctx()), (e) => e.code === "PROVIDER_UNAVAILABLE");
  assert.deepEqual(await adapter.validateCredential({ kind: "api-key", apiKey: "AQ.denied" }, ctx()), {
    valid: false, code: "AUTH_ERROR", message: "Google rejected the Vertex AI API key (403): Permission denied on resource project projects/proj-8/ for ***.",
  }, "a 403 naming a project is still a refusal, and the key is redacted");
  const invalidJson = await adapter.validateCredential({ kind: "api-key", apiKey: "{\"type\":\"service_account\"}" }, ctx());
  assert.match(invalidJson.message, /needs client_email, private_key, and project_id/);
});

test("vertex-partner posts OpenAI chat to the project's openapi endpoint; a key's project comes from the probe", async () => {
  const transport = fakeTransport(
    json(404, { error: { code: 404, message: "Publisher Model `projects/proj-9/locations/us-central1/publishers/google/models/__probe__` not found." } }),
    json(200, { id: "c1", model: "deepseek-ai/deepseek-v3.2-maas", choices: [{ index: 0, message: { role: "assistant", content: "hey" }, finish_reason: "stop" }] }),
    json(200, { id: "c2", model: "deepseek-ai/deepseek-v3.2-maas", choices: [{ index: 0, message: { role: "assistant", content: "again" }, finish_reason: "stop" }] }),
  );
  const adapter = new VertexPartnerAdapter(partner, transport);
  const request = { ...hello, model: "deepseek-ai/deepseek-v3.2-maas" };
  const answer = await adapter.execute(request, { kind: "api-key", apiKey: "AQ.partner-1" }, ctx());
  assert.deepEqual(answer.content, [{ type: "text", text: "hey" }]);
  assert.equal(transport.calls[1].url, "https://aiplatform.googleapis.com/v1/projects/proj-9/locations/global/endpoints/openapi/chat/completions");
  assert.equal(transport.calls[1].headers["x-goog-api-key"], "AQ.partner-1");
  assert.equal(JSON.parse(transport.calls[1].body).model, "deepseek-ai/deepseek-v3.2-maas");
  await adapter.execute(request, { kind: "api-key", apiKey: "AQ.partner-1" }, ctx());
  assert.equal(transport.calls.length, 3, "the project is cached");
  const listed = fakeTransport(
    json(404, [{ error: { code: 404, message: "Publisher Model `projects/proj-10/locations/us-central1/publishers/google/models/__probe__` not found." } }]),
    json(200, { id: "c4", model: "m", choices: [{ index: 0, message: { role: "assistant", content: "x" }, finish_reason: "stop" }] }),
  );
  await new VertexPartnerAdapter(partner, listed).execute(request, { kind: "api-key", apiKey: "AQ.partner-4" }, ctx());
  assert.match(listed.calls[1].url, /\/projects\/proj-10\//, "Google may answer with an array of errors");
  const noProject = new VertexPartnerAdapter(partner, fakeTransport(json(404, { error: { message: "not found" } }), json(404, { error: { message: "not found" } })));
  await assert.rejects(noProject.execute(request, { kind: "api-key", apiKey: "AQ.partner-2" }, ctx()), (e) => e.code === "AUTH_ERROR" && /did not name the project/.test(e.message));
  assert.deepEqual((await noProject.validateCredential({ kind: "api-key", apiKey: "AQ.partner-3" }, ctx())).valid, false);
  const sa = fakeTransport(token("p-tok"), json(200, { id: "c3", model: "m", choices: [{ index: 0, message: { role: "assistant", content: "x" }, finish_reason: "stop" }] }));
  await new VertexPartnerAdapter(partner, sa).execute(request, serviceAccount("sa-partner@my-proj.iam"), ctx());
  assert.equal(sa.calls[1].url, "https://aiplatform.googleapis.com/v1/projects/my-proj/locations/global/endpoints/openapi/chat/completions");
  assert.equal(sa.calls[1].headers.authorization, "Bearer p-tok");
});

test("both list the catalog models without calling Google", async () => {
  const transport = fakeTransport();
  const models = await new VertexAdapter(vertex, transport).getModels({ kind: "api-key", apiKey: "AQ.x" }, ctx());
  assert.deepEqual(models.map((m) => m.id), vertex.models.map((m) => m.id));
  assert.ok(models.every((m) => m.descriptor));
  assert.equal((await new VertexPartnerAdapter(partner, transport).getModels({ kind: "api-key", apiKey: "AQ.x" }, ctx())).length, partner.models.length);
  assert.equal(transport.calls.length, 0);
});
