// Shared fakes for /v1 lane tests (chat-lane.test.mjs, golden.test.mjs): a scripted upstream behind
// the transport port, and a server with a session, a client key, and an OpenAI connection.
import { request as httpRequest } from "node:http";
import { boot, setUp } from "./helpers.mjs";

export const SECRET = "sk-upstream-secret-4242";
const encoder = new TextEncoder();
export const hello = { model: "gpt-4.1", messages: [{ role: "user", content: "hi" }] };
export const completion = { id: "chatcmpl-up", model: "gpt-4.1", choices: [{ message: { content: "Hello!" }, finish_reason: "stop" }], usage: { prompt_tokens: 3, completion_tokens: 2 } };
export const chunk = (delta, extra = {}) => ({ id: "chatcmpl-s", model: "gpt-4.1", choices: [{ delta, ...extra }] });
const events = (list) => list.map((e) => `data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`).join("");

// An upstream body that honours the shared signal, like the direct transport: an abort errors the read.
export function body(text, ctx, { hang = false } = {}) {
  const bytes = encoder.encode(text);
  let sent = false;
  return new ReadableStream({
    start(controller) {
      ctx.signal.addEventListener("abort", () => { try { controller.error(ctx.signal.reason); } catch { /* already closed */ } }, { once: true });
    },
    pull(controller) {
      if (!sent) { sent = true; controller.enqueue(bytes); return; }
      if (hang) return new Promise(() => {});
      controller.close();
    },
  });
}

// One planned answer per upstream call: (request, ctx) => HttpResponse, or an Error to throw.
export function fakeUpstream(...answers) {
  const calls = [];
  return {
    calls,
    async send(request, ctx) {
      calls.push({ request, ctx });
      const next = answers.shift();
      if (!next) throw new Error("unexpected upstream call");
      if (next instanceof Error) throw next;
      return next(request, ctx);
    },
  };
}
export const json = (status, value) => (_request, ctx) => ({ status, headers: { "content-type": "application/json" }, body: body(JSON.stringify(value), ctx) });
export const sse = (list, options) => (_request, ctx) => ({ status: 200, headers: { "content-type": "text/event-stream" }, body: body(events(list), ctx, options) });

// A server with a dashboard session, one AIGate key, and an OpenAI connection.
export async function ready(file, transport, options = {}) {
  const { app, call } = await boot(file, { transport, ...options });
  const cookie = await setUp(call);
  const dash = (request) => call({ ...request, cookie });
  const { key } = (await dash({ method: "POST", url: "/api/keys", body: { name: "client" } })).json();
  const connection = (await dash({ method: "POST", url: "/api/connections", body: { provider: "openai", apiKey: SECRET } })).json();
  const chat = (payload, headers = {}) => call({ method: "POST", url: "/v1/chat/completions", body: payload, headers: { authorization: `Bearer ${key}`, ...headers } });
  // A raw body and headers, for what the JSON helper cannot send.
  const raw = (payload, headers) => app.getHttpAdapter().getInstance().inject({ method: "POST", url: "/v1/chat/completions", payload, headers });
  return { app, call, dash, key, connection, chat, raw };
}

export const errorOf = (res) => ({ status: res.statusCode, code: res.json().error.code, type: res.json().error.type });
export const frames = (text) => text.split("\n\n").filter(Boolean).map((f) => (f === "data: [DONE]" ? "[DONE]" : JSON.parse(f.slice(6))));

// Real sockets: inject cannot model a slow reader or a client that leaves.
export async function listening(file, transport) {
  const session = await ready(file, transport);
  await session.app.listen(0, "127.0.0.1");
  return { ...session, port: session.app.getHttpServer().address().port };
}

export function openStream(port, key, payload = { ...hello, stream: true }) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: "127.0.0.1", port, method: "POST", path: "/v1/chat/completions", headers: { "content-type": "application/json", authorization: `Bearer ${key}` } }, resolve);
    req.on("error", reject);
    req.end(JSON.stringify(payload));
  });
}
