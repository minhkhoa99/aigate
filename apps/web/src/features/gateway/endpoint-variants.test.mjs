import { test } from "node:test";
import assert from "node:assert/strict";
import { clientProtocols, endpointSetup } from "./endpoint-variants.ts";

const origin = "http://127.0.0.1:20200";

test("the four endpoint variants use actual client lane paths and no real key", () => {
  assert.deepEqual(clientProtocols, ["openai", "anthropic", "responses", "gemini"]);
  const expected = {
    openai: ["/v1", "/v1/chat/completions", "Authorization: Bearer"],
    anthropic: ["", "/v1/messages", "x-api-key:"],
    responses: ["/v1", "/v1/responses", "Authorization: Bearer"],
    gemini: ["/v1beta/models/openai/gpt-4.1-mini:generateContent", "/v1beta/models/openai/gpt-4.1-mini:generateContent", "Authorization: Bearer"],
  };
  for (const protocol of clientProtocols) {
    const setup = endpointSetup(origin, protocol);
    const [display, route, header] = expected[protocol];
    assert.equal(setup.displayUrl, origin + display);
    assert.ok(setup.testRequest.includes(origin + route), protocol);
    assert.ok(setup.testRequest.includes(header), protocol);
    assert.ok(setup.testRequest.includes("<your AIGate key>"), protocol);
    assert.ok(!setup.testRequest.includes("aigate_"), protocol);
    if (setup.setup) assert.match(setup.setup, /KEY='<your AIGate key>'/);
  }
  assert.equal(endpointSetup(origin, "anthropic").setup.includes("/v1'"), false, "Anthropic SDK appends /v1/messages itself");
  assert.equal(endpointSetup(origin, "gemini").setup, null, "do not invent a Gemini SDK environment variable");
});
