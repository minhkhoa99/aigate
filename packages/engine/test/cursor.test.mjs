import { test } from "node:test";
import assert from "node:assert/strict";
import { builtinRegistry, createAdapter, CursorAdapter, OAUTH_PROVIDERS } from "../dist/index.js";

const encoder = new TextEncoder();
const ctx = { signal: new AbortController().signal, requestId: "test" };
const credential = { kind: "api-key", apiKey: "cursor-token-abcdefghijklmnopqrstuvwxyz-0123456789", providerData: { machineId: "12345678-1234-1234-1234-123456789abc" } };
const v = (value) => { const out = []; while (value >= 128) { out.push((value & 127) | 128); value = Math.floor(value / 128); } return new Uint8Array([...out, value]); };
const join = (...parts) => { const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0)); let at = 0; for (const part of parts) { out.set(part, at); at += part.length; } return out; };
const f = (key, value) => typeof value === "number" ? join(v(key << 3), v(value)) : join(v((key << 3) | 2), v(value.length), typeof value === "string" ? encoder.encode(value) : value);
const frame = (value) => join(new Uint8Array([0, 0, 0, 0, value.length]), value);
const frames = (...items) => join(...items.map(frame));
const collect = async (iterable) => { const out = []; for await (const item of iterable) out.push(item); return out; };

function fakeAgent(response) {
  const writes = [];
  let read = 0;
  return {
    writes,
    response: Promise.resolve({ status: 200, headers: {} }),
    write(value) { writes.push(value); }, end() {}, close() {},
    async read() { return read++ === 0 ? { done: false, value: response } : { done: true }; },
  };
}

test("Cursor is token-import sign-in and uses the HTTP/2 adapter", () => {
  const provider = builtinRegistry.provider("cursor");
  assert.deepEqual([builtinRegistry.status("cursor"), provider.oauth, provider.protocol, OAUTH_PROVIDERS.cursor.flow], [{ connectable: true }, "browser_token", "cursor", "browser_token"]);
  assert.ok(createAdapter(provider, {}) instanceof CursorAdapter);
});

test("Cursor refuses a saved token without its separate machine ID before opening HTTP/2", async () => {
  const adapter = createAdapter(builtinRegistry.provider("cursor"), {});
  await assert.rejects(collect(adapter.stream({ model: "cursor-small", messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }] }, { kind: "api-key", apiKey: credential.apiKey }, ctx)),
    (error) => error?.code === "INVALID_REQUEST" && error.message.includes("machine ID"));
});

test("Cursor AgentService streams deltas, acknowledges IDE requests, and keeps typed MCP arguments", async () => {
  const text = f(1, f(1, f(1, "hello")));
  const kv = f(4, join(f(1, 7), f(2, new Uint8Array())));
  const context = f(2, join(f(1, 8), f(15, "exec"), f(10, new Uint8Array())));
  const value = f(3, "world");
  const mcp = join(f(2, join(f(1, "query"), f(2, value))), f(3, "call_1"), f(5, "lookup"));
  const tool = f(2, join(f(1, 9), f(15, "exec-tool"), f(11, mcp)));
  const session = fakeAgent(frames(f(1, text), kv, context, tool));
  const adapter = createAdapter(builtinRegistry.provider("cursor"), { openHttp2: () => session });
  const chunks = await collect(adapter.stream({ model: "cursor-small", stream: true, messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }], tools: [{ name: "lookup", parameters: { type: "object" } }] }, credential, ctx));
  assert.deepEqual(chunks.map((chunk) => chunk.type), ["start", "text_delta", "tool_call_delta", "usage", "stop"]);
  assert.deepEqual(chunks[2], { type: "tool_call_delta", index: 0, id: "call_1", name: "lookup", argumentsDelta: '{"query":"world"}' });
  assert.equal(chunks.at(-1).stopReason, "tool_use");
  assert.equal(session.writes.length, 3, "initial request plus KV and context acknowledgements");
});

test("Cursor reads unframed HTTP/2 model responses and reports invalid credentials", async () => {
  const calls = [];
  const adapter = createAdapter(builtinRegistry.provider("cursor"), { async sendHttp2(request) { calls.push(request); return { status: 200, headers: {}, body: join(f(1, f(1, "cursor-new")), f(1, f(1, "cursor-new"))) }; } });
  assert.deepEqual((await adapter.getModels(credential, ctx)).map((model) => model.id), ["cursor-new"]);
  assert.deepEqual([calls[0].url, calls[0].headers["content-type"], calls[0].headers.accept, calls[0].body.length], ["https://agent.api5.cursor.sh/agent.v1.AgentService/GetUsableModels", "application/proto", "application/proto", 0]);

  const refused = createAdapter(builtinRegistry.provider("cursor"), { async sendHttp2() { return { status: 401, headers: {}, body: encoder.encode("no") }; } });
  assert.deepEqual(await refused.validateCredential(credential, ctx), { valid: false, code: "AUTH_ERROR", message: "Cursor answered 401: no" });
});
