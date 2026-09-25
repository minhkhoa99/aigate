// A scripted OpenAI-compatible vendor that records what the gateway sends it (spec §8.2).
// No network: the gateway under test points a provider's baseUrl here.
import { createServer } from "node:http";

const SECRET_HEADERS = new Set(["authorization", "x-api-key", "api-key"]);
// Transport noise: never part of what the gateway decided to send.
const NOISE_HEADERS = new Set(["host", "content-length", "connection", "accept-encoding", "user-agent", "keep-alive", "transfer-encoding"]);

// Header values that could carry the key are masked to their scheme, so a tape never holds a secret.
function recordHeaders(headers) {
  const out = {};
  for (const [name, value] of Object.entries(headers)) {
    if (NOISE_HEADERS.has(name) || name.startsWith("x-stainless") || name.startsWith("sec-")) continue;
    const text = Array.isArray(value) ? value.join(", ") : String(value);
    out[name] = SECRET_HEADERS.has(name) ? (text.includes(" ") ? `${text.split(" ")[0]} ***` : "***") : text;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

const readBody = (req) => new Promise((resolve) => {
  let text = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => { text += chunk; });
  req.on("end", () => resolve(text));
});

// A response spec: { status, json, headers? } or { status?, sse: [event…], cut?: true }. The script may
// also be a function of the parsed request body, for scenarios where the gateway picks the mode.
export function render(spec) {
  if (spec.sse) {
    const body = spec.sse.map((e) => `data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`).join("");
    return { status: spec.status ?? 200, headers: { "content-type": "text/event-stream" }, body, cut: Boolean(spec.cut) };
  }
  return { status: spec.status, headers: { "content-type": "application/json", ...spec.headers }, body: JSON.stringify(spec.json), cut: false };
}

export async function startVendor() {
  const state = { script: undefined, requests: [] };
  const server = createServer(async (req, res) => {
    const text = await readBody(req);
    let body;
    try { body = text ? JSON.parse(text) : undefined; } catch { body = text; }
    if (req.method !== "POST" || !req.url.endsWith("/chat/completions")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ object: "list", data: [] }));
      return;
    }
    state.requests.push({ method: req.method, path: new URL(req.url, "http://vendor").pathname, headers: recordHeaders(req.headers), body });
    const spec = typeof state.script === "function" ? state.script(body) : state.script;
    if (!spec) {
      res.writeHead(500);
      res.end("no script");
      return;
    }
    const out = render(spec);
    res.writeHead(out.status, out.headers);
    if (!out.cut) {
      res.end(out.body);
      return;
    }
    // A cut stream: the events arrive, then the connection drops without a terminator.
    res.write(out.body);
    setTimeout(() => res.socket?.destroy(), 50);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    setScript(spec) { state.script = spec; state.requests = []; },
    requests: () => state.requests,
    close: () => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); },
  };
}
