// The parity harness itself (docs/contracts/parity.md): tapes replay clean, and the checks can fail.
import { test } from "node:test";
import assert from "node:assert/strict";
import { diff, normalizeResponse } from "../src/normalize.mjs";
import { judge, loadTapes, replayAll } from "../src/replay.mjs";
import { SCENARIOS } from "../src/scenarios.mjs";
import { coverage } from "../src/coverage.mjs";

const sse = (events) => ({ status: 200, contentType: "text/event-stream", body: events.map((e) => `data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`).join("") });

test("every recorded tape passes tier 1 against AIGate, and no deviation is stale", async () => {
  const tapes = await loadTapes();
  assert.ok(tapes.length >= SCENARIOS.length, "one tape per scenario");
  for (const result of await replayAll(tapes)) {
    assert.ok(result.tier1.pass, `${result.id}: ${result.tier1.problems.join("; ")}`);
    assert.deepEqual(result.tier1.stale, [], `${result.id}: a declared deviation no longer differs`);
    assert.ok(result.upstreamCalls.aigate <= Math.max(1, result.upstreamCalls.ninerouter), `${result.id}: no extra upstream attempts`);
  }
});

test("tapes never hold a credential", async () => {
  for (const tape of await loadTapes()) {
    const text = JSON.stringify(tape);
    assert.ok(!/sk-[A-Za-z0-9-]{20,}/.test(text.replaceAll("sk-parity-fake-key", "")), tape.id);
    if (tape.upstreamRequest) assert.match(tape.upstreamRequest.headers.authorization, /\*\*\*$/);
  }
});

test("SSE is compared by meaning: chunk boundaries and ids do not matter", () => {
  const a = sse([{ id: "x", choices: [{ delta: { content: "Hel" } }] }, { id: "x", choices: [{ delta: { content: "lo" }, finish_reason: "stop" }] }, "[DONE]"]);
  const b = sse([{ id: "y", created: 9, choices: [{ delta: { content: "H" } }] }, { choices: [{ delta: { content: "ello" } }] }, { choices: [{ delta: {}, finish_reason: "stop" }] }, "[DONE]"]);
  assert.deepEqual(diff(normalizeResponse(a), normalizeResponse(b)), []);
  const cut = sse([{ choices: [{ delta: { content: "Hello" } }] }]);
  assert.deepEqual(diff(normalizeResponse(a), normalizeResponse(cut)), ["finishReason", "terminal"], "a missing terminator is a difference");
});

test("tier 1 fails on an undeclared difference and on a deviation AIGate does not show", () => {
  const theirs = { kind: "error", status: 401, error: { type: null, code: null } };
  assert.equal(judge(theirs, { ...theirs, status: 502 }).pass, false, "undeclared");
  const deviation = { path: "status", aigate: 502, entry: "x", label: "SUSPECTED_BUG" };
  assert.equal(judge(theirs, { ...theirs, status: 502 }, [deviation]).pass, true);
  assert.equal(judge(theirs, { ...theirs, status: 503 }, [deviation]).pass, false, "wrong AIGate value");
  assert.deepEqual(judge(theirs, theirs, [deviation]).stale, ["status"]);
});

test("coverage counts tape entries against docs/capabilities.md", async () => {
  const cov = await coverage(await loadTapes());
  assert.ok(cov.total > 200);
  assert.ok(cov.covered > 0 && cov.covered <= cov.total);
  assert.deepEqual(cov.unknown, [], "every covered id is a real capability");
});
