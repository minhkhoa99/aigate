// SP26 contract checks; run only when requested: node --test apps/web/src/shared/usage-stream.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, apiStream, SESSION_ENDED_EVENT } from "./api.ts";
import { readLiveUsage, MAX_USAGE_LINE_CHARS } from "./usage-stream.ts";
import { toProblem } from "./errors.ts";

const encoder = new TextEncoder();
const snapshot = { active: [{ provider: "openai", model: "m", connectionId: null, count: 2 }], recent: [], writer: { queued: 0, dropped: 0, failed: 0 }, flushedAt: 1 };
const headers = { "content-type": "text/event-stream; charset=utf-8" };
const error = (status, code) => new Response(JSON.stringify({ code, message: "actual server refusal" }), { status, headers: { "content-type": "application/json" } });

test("HTTP refusals retain their actual status/code and only the real 503 means tab limit", async (t) => {
  for (const [status, code] of [[401, "UNAUTHENTICATED"], [503, "USAGE_STREAM_BUSY"], [502, "HTTP_502"]]) {
    t.mock.method(globalThis, "fetch", async () => error(status, code));
    await assert.rejects(() => readLiveUsage(new AbortController().signal, () => assert.fail("refused stream emitted data")),
      (failure) => failure instanceof ApiError && failure.status === status && failure.code === code);
  }
  assert.match(toProblem(new ApiError(0, "USAGE_STREAM_DISCONNECTED", "")).message, /Reconnect/);
  t.mock.method(globalThis, "fetch", async () => new Response("html", { headers: { "content-type": "text/html" } }));
  await assert.rejects(() => apiStream("/api/usage/stream", new AbortController().signal), (failure) => failure.code === "BAD_RESPONSE");
});

test("an unauthenticated handshake dispatches the existing session-ended event", async (t) => {
  const previous = globalThis.window;
  const window = new EventTarget(); let ended = 0;
  globalThis.window = window;
  window.addEventListener(SESSION_ENDED_EVENT, () => ended += 1);
  t.mock.method(globalThis, "fetch", async () => error(401, "UNAUTHENTICATED"));
  try {
    await assert.rejects(() => apiStream("/api/usage/stream", new AbortController().signal), (failure) => failure.code === "UNAUTHENTICATED");
    assert.equal(ended, 1);
  } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
});

test("fragmented UTF-8/CRLF snapshots and comments parse; EOF is disconnected, never tab limit", async (t) => {
  const withText = { ...snapshot, active: [{ ...snapshot.active[0], provider: "Việt Nam" }] };
  const bytes = encoder.encode(`: ping\r\n\r\ndata: ${JSON.stringify(withText)}\r\n\r\n`);
  let cursor = 0;
  const body = new ReadableStream({ pull(controller) {
    if (cursor >= bytes.length) { controller.close(); return; }
    controller.enqueue(bytes.slice(cursor, ++cursor));
  } });
  t.mock.method(globalThis, "fetch", async () => new Response(body, { headers }));
  const received = [];
  await assert.rejects(() => readLiveUsage(new AbortController().signal, (row) => received.push(row)), (failure) => failure.code === "USAGE_STREAM_DISCONNECTED");
  assert.deepEqual(received, [withText]);
});

test("malformed, oversized or ill-shaped snapshots cancel the body with BAD_RESPONSE", async (t) => {
  for (const payload of ["data: broken\n", `data: ${JSON.stringify({ ...snapshot, active: [null] })}\n`,
    `data: ${JSON.stringify({ ...snapshot, recent: [null] })}\n`, "x".repeat(MAX_USAGE_LINE_CHARS + 1)]) {
    let cancelled = false;
    const body = new ReadableStream({ start(controller) { controller.enqueue(encoder.encode(payload)); }, cancel() { cancelled = true; } });
    t.mock.method(globalThis, "fetch", async () => new Response(body, { headers }));
    await assert.rejects(() => readLiveUsage(new AbortController().signal, () => assert.fail("invalid frame emitted")), (failure) => failure.code === "BAD_RESPONSE");
    assert.equal(cancelled, true);
  }
});

test("caller cancellation releases the reader and keeps its AbortError", async (t) => {
  const caller = new AbortController();
  let sink;
  const body = new ReadableStream({ start(controller) { sink = controller; controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`)); } });
  t.mock.method(globalThis, "fetch", async (_path, { signal }) => {
    signal.addEventListener("abort", () => sink.error(signal.reason), { once: true });
    return new Response(body, { headers });
  });
  let received = 0;
  await assert.rejects(() => readLiveUsage(caller.signal, () => { received += 1; caller.abort(); }), (failure) => failure.name === "AbortError");
  assert.equal(received, 1);
  assert.equal(body.locked, false);
});

test("the handshake deadline reports a real ten-second timeout", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(globalThis, "fetch", (_path, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }));
  const pending = apiStream("/api/usage/stream", new AbortController().signal);
  t.mock.timers.tick(10_001);
  await assert.rejects(() => pending, (failure) => failure.code === "TIMEOUT" && failure.body.timeoutSeconds === 10);
});
