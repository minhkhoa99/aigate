// Replays tapes against AIGate (spec §8.2): the tape's client request goes in, the vendor is stubbed
// with the tape's upstream response, and the two client responses are compared semantically.
//   tier 1: every difference from 9router must be a declared, labeled deviation with AIGate's value.
//   tier 3: differences in the upstream request are reported, never failed ("different ≠ wrong").
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { EngineError } from "@aigate/engine";
import { createServer } from "../../../apps/server/dist/server.js";
import { diff, get, normalizeResponse, normalizeUpstream } from "./normalize.mjs";
import { render } from "./vendor.mjs";
import { TAPES_DIR } from "./record.mjs";
import { SCENARIOS } from "./scenarios.mjs";

const encoder = new TextEncoder();

export async function loadTapes() {
  const files = (await readdir(TAPES_DIR)).filter((f) => f.endsWith(".json")).sort();
  return Promise.all(files.map(async (f) => JSON.parse(await readFile(join(TAPES_DIR, f), "utf8"))));
}

// The stubbed vendor: serves the upstream response for the tape being replayed, records what AIGate sent.
function tapeTransport() {
  const state = { response: undefined, sent: [] };
  return {
    state,
    async send(request) {
      state.sent.push({ method: request.method, url: request.url, body: request.body ? JSON.parse(request.body) : undefined });
      const upstream = typeof state.response === "function" ? state.response(state.sent.at(-1).body) : state.response;
      if (!upstream) throw new EngineError("PROVIDER_UNAVAILABLE", "the tape has no upstream response", {});
      const bytes = encoder.encode(upstream.body);
      let delivered = false;
      return {
        status: upstream.status,
        headers: upstream.headers,
        body: new ReadableStream({
          // Pull-based, so a cut tape delivers its bytes first: error() in the same turn would discard them.
          pull(controller) {
            if (!delivered) {
              delivered = true;
              controller.enqueue(bytes);
              return;
            }
            // A cut tape: the connection drops after the recorded bytes, as the vendor did.
            if (upstream.cut) controller.error(new EngineError("PROVIDER_UNAVAILABLE", "Could not reach the vendor", {}));
            else controller.close();
          },
        }),
      };
    },
  };
}

// One AIGate for all tapes: keyless (local), one OpenAI connection with a fake key.
async function bootAigate(transport) {
  const dir = await mkdtemp(join(tmpdir(), "aigate-parity-"));
  const app = await createServer({ databaseFile: join(dir, "aigate.db"), transport });
  await app.init();
  const fastify = app.getHttpAdapter().getInstance();
  await fastify.ready();
  const inject = (options) => fastify.inject(options);
  const setup = await inject({ method: "POST", url: "/api/auth/setup", payload: { password: "parity replay password" } });
  const cookie = setup.headers["set-cookie"].split(";")[0];
  await inject({ method: "PATCH", url: "/api/settings", headers: { cookie }, payload: { requireApiKey: false } });
  await inject({ method: "POST", url: "/api/connections", headers: { cookie }, payload: { provider: "openai", apiKey: "sk-parity-fake-key" } });
  return { inject, close: async () => { await app.close(); await rm(dir, { recursive: true, force: true }); } };
}

const covers = (path, prefix) => prefix === "*" || path === prefix || path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[`);

// Tier 1 verdict: undeclared differences fail; each declared deviation must show AIGate's expected value.
export function judge(ninerouter, aigate, deviations = []) {
  const problems = [];
  const differing = diff(ninerouter, aigate);
  for (const path of differing) {
    if (!deviations.some((d) => covers(path, d.path))) {
      problems.push(`undeclared difference at ${path}: 9router ${JSON.stringify(get(ninerouter, path))}, AIGate ${JSON.stringify(get(aigate, path))}`);
    }
  }
  for (const d of deviations) {
    if (!isDeepStrictEqual(get(aigate, d.path), d.aigate)) {
      problems.push(`deviation ${d.path} (${d.entry}): expected AIGate ${JSON.stringify(d.aigate)}, got ${JSON.stringify(get(aigate, d.path))}`);
    }
  }
  const stale = deviations.filter((d) => !differing.some((p) => covers(p, d.path))).map((d) => d.path);
  return { pass: problems.length === 0, problems, stale };
}

export async function replayAll(tapes) {
  const transport = tapeTransport();
  const aigate = await bootAigate(transport);
  const results = [];
  try {
    for (const tape of tapes) {
      const scenario = SCENARIOS.find((s) => s.id === tape.id);
      transport.state.sent = [];
      transport.state.response = typeof scenario?.vendor === "function" ? (body) => render(scenario.vendor(body)) : tape.upstreamResponse;
      // Same request, routed to AIGate's OpenAI connection under the same upstream model id.
      const model = `openai/${tape.clientRequest.body.model.split("/").slice(1).join("/")}`;
      const res = await aigate.inject({ method: "POST", url: tape.clientRequest.path, payload: { ...tape.clientRequest.body, model } });
      const ours = normalizeResponse({ status: res.statusCode, contentType: String(res.headers["content-type"] ?? ""), body: res.body });
      const theirs = normalizeResponse(tape.clientResponse);
      const sent = transport.state.sent[0];
      results.push({
        id: tape.id, title: tape.title, gateway: tape.gateway,
        tier1: judge(theirs, ours, scenario?.deviations),
        tier3: tape.upstreamRequest && sent ? diff(normalizeUpstream(tape.upstreamRequest.body), normalizeUpstream(sent.body)) : [],
        upstreamCalls: { ninerouter: tape.upstreamCalls, aigate: transport.state.sent.length },
        ours, theirs, sent,
      });
    }
  } finally {
    await aigate.close();
  }
  return results;
}
