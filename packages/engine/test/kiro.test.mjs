import { test } from "node:test";
import assert from "node:assert/strict";
import { builtinRegistry, createAdapter, OAUTH_PROVIDERS } from "../dist/index.js";

const encoder = new TextEncoder();
const ctx = { signal: new AbortController().signal, requestId: "kiro-test" };
const reply = (status, value) => ({ status, headers: { "content-type": "application/json" }, body: new Response(JSON.stringify(value)).body });
const fakeTransport = (...answers) => ({ calls: [], async send(request) { this.calls.push(request); const answer = answers.shift(); if (!answer) throw new Error("unexpected request"); return answer; } });
const io = (transport) => ({ transport, ctx });
const join = (...parts) => { const out = new Uint8Array(parts.reduce((size, part) => size + part.length, 0)); let at = 0; for (const part of parts) { out.set(part, at); at += part.length; } return out; };
const crc32 = (bytes) => { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1; } return (crc ^ 0xffffffff) >>> 0; };
const eventFrame = (type, payload) => {
  const name = encoder.encode(":event-type"); const value = encoder.encode(type);
  const headers = join(new Uint8Array([name.length]), name, new Uint8Array([7, value.length >> 8, value.length & 255]), value);
  const body = encoder.encode(JSON.stringify(payload));
  const frame = new Uint8Array(12 + headers.length + body.length + 4);
  const view = new DataView(frame.buffer);
  view.setUint32(0, frame.length); view.setUint32(4, headers.length); frame.set(headers, 12); frame.set(body, 12 + headers.length);
  view.setUint32(8, crc32(frame.subarray(0, 8))); view.setUint32(frame.length - 4, crc32(frame.subarray(0, frame.length - 4)));
  return frame;
};
const streamBody = (bytes, corrupt = false) => new ReadableStream({ start(controller) { const data = new Uint8Array(bytes); if (corrupt) data[data.length - 1] ^= 1; controller.enqueue(data.slice(0, 7)); controller.enqueue(data.slice(7)); controller.close(); } });
const collect = async (iterable) => { const values = []; for await (const value of iterable) values.push(value); return values; };

test("Kiro Builder/IDC device flow carries client credentials only in the sealed refresh token", async () => {
  const provider = OAUTH_PROVIDERS.kiro;
  const transport = fakeTransport(
    reply(200, { clientId: "client", clientSecret: "secret" }),
    reply(200, { deviceCode: "device", userCode: "ABCD", verificationUri: "https://example.test/device", expiresIn: 300 }),
  );
  const device = await provider.deviceCode(io(transport), { authMethod: "idc", region: "eu-west-1", startUrl: "https://org.awsapps.com/start" });
  assert.deepEqual([device.device_code, device.interval, device.providerData.region, transport.calls[0].url], ["device", 5, "eu-west-1", "https://oidc.eu-west-1.amazonaws.com/client/register"]);

  const tokensTransport = fakeTransport(reply(200, { accessToken: "eyJhbGci.eyJzdWIiOiJ1c2VyIn0.sig", refreshToken: "aorAAAAAG-refresh", expiresIn: 3600 }), reply(200, { profiles: [{ arn: "arn:aws:codewhisperer:eu-west-1:123:profile/abc" }] }));
  const result = await provider.poll("device", io(tokensTransport), device.providerData);
  assert.equal(result.status, "approved");
  assert.equal(result.tokens.data.clientSecret, undefined);
  assert.equal(result.tokens.data.profileArn, "arn:aws:codewhisperer:eu-west-1:123:profile/abc");
  const packed = JSON.parse(Buffer.from(result.tokens.refreshToken.slice(6), "base64url").toString());
  assert.deepEqual([packed.token, packed.clientId, packed.clientSecret, packed.region], ["aorAAAAAG-refresh", "client", "secret", "eu-west-1"]);

  const refreshTransport = fakeTransport(reply(200, { accessToken: "new-token", expiresIn: 1800 }));
  const refreshed = await provider.refresh(result.tokens.refreshToken, io(refreshTransport), undefined, result.tokens.data);
  assert.equal(refreshTransport.calls[0].url, "https://oidc.eu-west-1.amazonaws.com/token");
  assert.equal(JSON.parse(Buffer.from(refreshed.refreshToken.slice(6), "base64url").toString()).clientSecret, "secret");
});

test("Kiro adapter selects the Kiro protocol, shapes the request, and validates EventStream CRCs", async () => {
  const provider = builtinRegistry.provider("kiro");
  assert.deepEqual([builtinRegistry.status("kiro"), provider.protocol, provider.oauth], [{ connectable: true }, "kiro", "authorization_code_pkce"]);
  const bytes = join(eventFrame("assistantResponseEvent", { content: "hello" }), eventFrame("messageStopEvent", { stopReason: "end_turn" }));
  const transport = { calls: [], async send(request) { this.calls.push(request); return { status: 200, headers: { "content-type": "application/vnd.amazon.eventstream" }, body: streamBody(bytes) }; } };
  const adapter = createAdapter(provider, transport);
  const chunks = await collect(adapter.stream({ model: "claude-sonnet-4.5-thinking", stream: true, messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }] }, { kind: "api-key", apiKey: "token", sessionId: "conn-1", providerData: { authMethod: "idc", region: "eu-west-1" } }, ctx));
  const sent = JSON.parse(transport.calls[0].body);
  assert.deepEqual([transport.calls[0].url, transport.calls[0].headers.tokentype, sent.conversationState.currentMessage.userInputMessage.origin, sent.conversationState.currentMessage.userInputMessage.modelId], ["https://q.eu-west-1.amazonaws.com/generateAssistantResponse", undefined, "AI_EDITOR", "claude-sonnet-4.5"]);
  assert.ok(sent.conversationState.currentMessage.userInputMessage.content.includes("<thinking_mode>enabled</thinking_mode>"));
  assert.equal(chunks.find((chunk) => chunk.type === "text_delta").text, "hello");
  const badTransport = { async send() { return { status: 200, headers: {}, body: streamBody(eventFrame("assistantResponseEvent", { content: "bad" }), true) }; } };
  await assert.rejects(collect(createAdapter(provider, badTransport).stream({ model: "m", stream: true, messages: [] }, { kind: "api-key", apiKey: "token" }, ctx)), /CRC check failed/);
});

test("Kiro catalog omits agentic variants for auto and validates API keys against the live catalog", async () => {
  const provider = builtinRegistry.provider("kiro");
  const transport = fakeTransport(reply(200, { models: [{ modelId: "auto" }, { modelId: "claude-sonnet-4.5" }] }));
  const adapter = createAdapter(provider, transport);
  const models = await adapter.getModels({ kind: "api-key", apiKey: "api-key", sessionId: "kiro-auto-variant-test" }, ctx);
  assert.deepEqual(models.map((model) => model.id), [
    "auto", "auto-thinking", "claude-sonnet-4.5", "claude-sonnet-4.5-thinking", "claude-sonnet-4.5-agentic", "claude-sonnet-4.5-thinking-agentic",
  ]);

  const validateTransport = fakeTransport(reply(200, { models: [{ modelId: "auto" }] }));
  const status = await createAdapter(provider, validateTransport).validateCredential({ kind: "api-key", apiKey: "kiro-key", providerData: { authMethod: "api_key" } }, ctx);
  assert.deepEqual([status.valid, validateTransport.calls[0].url, validateTransport.calls[0].headers.tokentype], [true, "https://q.us-east-1.amazonaws.com/ListAvailableModels?origin=AI_EDITOR", "API_KEY"]);
});
