// Records one tape per scenario from a running 9router (spec §8.2), against the scripted vendor.
// 9router's code is not touched. A temporary OpenAI-compatible provider node points at the vendor,
// with a connection and a client key; all three carry TEMP_NAME and are deleted by cleanup(), before
// and after recording. No real vendor is called and no credit is spent.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { render, startVendor } from "./vendor.mjs";
import { SCENARIOS } from "./scenarios.mjs";

export const TAPES_DIR = fileURLToPath(new URL("../tapes/", import.meta.url));
const TEMP_NAME = "AIGate parity (temporary)";
const PREFIX = "aigateparity";
const FAKE_KEY = "sk-parity-fake-key";
const TIMEOUT_MS = 60_000;

async function call(base, cookie, method, path, body) {
  const response = await fetch(new URL(path, base), {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status}: ${text.slice(0, 200)}`);
  return { response, json: text ? JSON.parse(text) : undefined };
}

async function login(base, password) {
  const { response } = await call(base, undefined, "POST", "/api/auth/login", { password });
  return response.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

// Deletes everything a recording run creates, matched by name only, so nothing of the user's is touched.
export async function cleanup(base, cookie) {
  const removed = [];
  const nodes = ((await call(base, cookie, "GET", "/api/provider-nodes")).json?.nodes ?? []).filter((n) => n.name === TEMP_NAME);
  const nodeIds = new Set(nodes.map((n) => n.id));
  const connections = ((await call(base, cookie, "GET", "/api/providers")).json?.connections ?? []).filter((c) => nodeIds.has(c.provider) || c.name === TEMP_NAME);
  for (const c of connections) { await call(base, cookie, "DELETE", `/api/providers/${c.id}`); removed.push(`connection ${c.id}`); }
  for (const n of nodes) { await call(base, cookie, "DELETE", `/api/provider-nodes/${n.id}`); removed.push(`node ${n.id}`); }
  const keys = ((await call(base, cookie, "GET", "/api/keys")).json?.keys ?? []).filter((k) => k.name === TEMP_NAME);
  for (const k of keys) { await call(base, cookie, "DELETE", `/api/keys/${k.id}`); removed.push(`key ${k.id}`); }
  return removed;
}

export async function record({ base, password, only }) {
  const cookie = await login(base, password);
  await cleanup(base, cookie);
  const vendor = await startVendor();
  const written = [];
  try {
    const version = (await call(base, cookie, "GET", "/api/version")).json?.currentVersion ?? "unknown";
    const { json: { node } } = await call(base, cookie, "POST", "/api/provider-nodes", {
      name: TEMP_NAME, prefix: PREFIX, apiType: "chat", baseUrl: `${vendor.url}/v1`, type: "openai-compatible",
    });
    await call(base, cookie, "POST", "/api/providers", { provider: node.id, apiKey: FAKE_KEY, name: TEMP_NAME });
    // A client key, in case 9router requires one on /v1.
    const { json: clientKey } = await call(base, cookie, "POST", "/api/keys", { name: TEMP_NAME });
    mkdirSync(TAPES_DIR, { recursive: true });
    for (const scenario of SCENARIOS.filter((s) => !only || only.includes(s.id))) {
      vendor.setScript(scenario.vendor);
      // A model per scenario: 9router locks a failing account per model, so errors cannot leak into later tapes.
      const clientBody = { model: `${PREFIX}/parity-${scenario.id}`, ...scenario.body };
      const response = await fetch(new URL("/v1/chat/completions", base), {
        method: "POST",
        // Token Saver rewrites prompts (a system message, inflated usage); AIGate has none until SP21,
        // so each tape asks 9router to bypass it for that request only, without touching its settings.
        headers: { "content-type": "application/json", authorization: `Bearer ${clientKey.key}`, "x-9router-token-saver": "off" },
        body: JSON.stringify(clientBody),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const text = await response.text();
      const [upstream] = vendor.requests();
      const spec = typeof scenario.vendor === "function" ? scenario.vendor(upstream?.body) : scenario.vendor;
      const tape = {
        id: scenario.id,
        title: scenario.title,
        gateway: `9router@${version}`,
        recordedAt: new Date().toISOString(),
        covers: scenario.covers,
        clientRequest: { method: "POST", path: "/v1/chat/completions", body: clientBody },
        upstreamRequest: upstream ?? null,
        upstreamCalls: vendor.requests().length,
        upstreamResponse: upstream ? render(spec) : null,
        clientResponse: { status: response.status, contentType: response.headers.get("content-type") ?? "", body: text },
      };
      writeFileSync(join(TAPES_DIR, `${scenario.id}.json`), `${JSON.stringify(tape, null, 2)}\n`);
      written.push(`${scenario.id}: 9router ${response.status}, upstream calls ${tape.upstreamCalls}`);
    }
  } finally {
    await vendor.close();
    const removed = await cleanup(base, cookie).catch((error) => [`cleanup failed: ${error.message}`]);
    written.push(`cleaned up: ${removed.join(", ") || "nothing left"}`);
  }
  return written;
}
