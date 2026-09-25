// Contract: docs/contracts/transport.md — every failure the direct branch can meet, against a real local server.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { builtinRegistry, EngineError, OpenAICompatibleAdapter, readBoundedText } from "@aigate/engine";
import { DirectTransport, MAX_TIMEOUT_MS } from "../dist/modules/transport/infrastructure/direct-transport.js";

const SECRET = "sk-test-secret-value";
const transport = new DirectTransport();

async function withUpstream(handler, run) {
  const hits = [];
  const server = createServer((req, res) => { hits.push(req.url); handler(req, res); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(base, hits);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

const ctx = (signal = new AbortController().signal) => ({ signal, requestId: "test" });
const request = (url, extra = {}) => ({ method: "POST", url, headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" }, body: "{}", timeoutMs: 2_000, ...extra });
const isCode = (code) => (error) => error instanceof EngineError && error.code === code && !error.message.includes(SECRET) && !JSON.stringify(error.details).includes(SECRET);

test("a normal exchange returns status, lower-case headers, and a readable body", () =>
  withUpstream((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json", "X-Echo-Auth": req.headers.authorization === `Bearer ${SECRET}` ? "yes" : "no" });
      res.end(JSON.stringify({ received: body }));
    });
  }, async (base) => {
    const response = await transport.send(request(`${base}/v1/chat/completions`), ctx());
    assert.equal(response.status, 200);
    assert.equal(response.headers["content-type"], "application/json");
    assert.equal(response.headers["x-echo-auth"], "yes");
    assert.deepEqual(JSON.parse(await readBoundedText(response.body)), { received: "{}" });
  }));

test("upstream 4xx and 5xx are returned to the adapter, not thrown", () =>
  withUpstream((req, res) => { res.writeHead(429, { "retry-after": "3" }); res.end('{"error":"slow down"}'); }, async (base) => {
    const response = await transport.send(request(base), ctx());
    assert.equal(response.status, 429);
    assert.equal(response.headers["retry-after"], "3");
  }));

test("only https, or http to this machine, is allowed", async () => {
  await assert.rejects(transport.send(request("http://api.example.com/v1"), ctx()), isCode("INVALID_REQUEST"));
  await assert.rejects(transport.send(request("ftp://example.com"), ctx()), isCode("INVALID_REQUEST"));
  await assert.rejects(transport.send(request("not a url"), ctx()), isCode("INVALID_REQUEST"));
});

test("no response headers within timeoutMs is TIMEOUT", () =>
  withUpstream(() => { /* never answers */ }, async (base) => {
    const started = Date.now();
    await assert.rejects(transport.send(request(base, { timeoutMs: 100 }), ctx()), isCode("TIMEOUT"));
    assert.ok(Date.now() - started < 1_500);
  }));

test("a body that stalls past timeoutMs fails the read with TIMEOUT", () =>
  withUpstream((req, res) => { res.writeHead(200); res.write("partial"); }, async (base) => {
    const response = await transport.send(request(base, { timeoutMs: 150 }), ctx());
    await assert.rejects(readBoundedText(response.body), isCode("TIMEOUT"));
  }));

test("a caller abort rejects with the caller reason, before or during the exchange", () =>
  withUpstream(() => { /* never answers */ }, async (base) => {
    const early = new AbortController();
    early.abort(new Error("client left"));
    await assert.rejects(transport.send(request(base), ctx(early.signal)), /client left/);

    const late = new AbortController();
    setTimeout(() => late.abort(new Error("budget spent")), 50);
    await assert.rejects(transport.send(request(base), ctx(late.signal)), (error) => error.message === "budget spent" && !(error instanceof EngineError));
  }));

test("a redirect is refused and never followed", () =>
  withUpstream((req, res) => {
    if (req.url === "/elsewhere") { res.writeHead(200); res.end("followed"); return; }
    res.writeHead(302, { location: "/elsewhere" });
    res.end();
  }, async (base, hits) => {
    await assert.rejects(transport.send(request(`${base}/start`), ctx()), isCode("PROVIDER_UNAVAILABLE"));
    assert.deepEqual(hits, ["/start"], "the credential never reached the redirect target");
  }));

test("an unreachable host is PROVIDER_UNAVAILABLE without leaking the credential", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  await assert.rejects(transport.send(request(`http://127.0.0.1:${port}`), ctx()), isCode("PROVIDER_UNAVAILABLE"));
});

test("an oversized body is cancelled instead of buffered", () =>
  withUpstream((req, res) => { res.writeHead(200); res.end("x".repeat(64 * 1024)); }, async (base) => {
    const response = await transport.send(request(base), ctx());
    await assert.rejects(readBoundedText(response.body, 1024), isCode("PROVIDER_UNAVAILABLE"));
  }));

test("timeoutMs must be a bounded integer", async () => {
  for (const timeoutMs of [0, -1, 1.5, Number.NaN, MAX_TIMEOUT_MS + 1]) {
    await assert.rejects(transport.send(request("https://api.example.com", { timeoutMs }), ctx()), RangeError, String(timeoutMs));
  }
});

test("the OpenAI-compatible adapter streams through the direct transport end to end", () =>
  withUpstream((req, res) => {
    res.writeHead(200, { "content-type": "text/event-stream" });
    const events = [
      { id: "c1", model: "local", choices: [{ delta: { content: "Hel" } }] },
      { choices: [{ delta: { content: "lo" }, finish_reason: "stop" }] },
    ];
    // Written in small pieces with pauses, so parsing never relies on one read per event.
    const text = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") + "data: [DONE]\n\n";
    let offset = 0;
    const timer = setInterval(() => {
      res.write(text.slice(offset, offset + 17));
      offset += 17;
      if (offset >= text.length) { clearInterval(timer); res.end(); }
    }, 2);
  }, async (base, hits) => {
    const provider = { ...builtinRegistry.provider("openai"), baseUrl: base };
    const adapter = new OpenAICompatibleAdapter(provider, transport);
    const chunks = [];
    for await (const chunk of adapter.stream({ model: "local", stream: true, messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }] }, { kind: "api-key", apiKey: SECRET }, ctx())) chunks.push(chunk);
    assert.deepEqual(hits, ["/chat/completions"]);
    assert.deepEqual(chunks.map((c) => c.type), ["start", "text_delta", "text_delta", "stop"]);
    assert.equal(chunks.filter((c) => c.type === "text_delta").map((c) => c.text).join(""), "Hello");
  }));
