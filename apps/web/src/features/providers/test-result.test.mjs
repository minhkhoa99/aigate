// Reverse-thinking check: every stored test result reads as what it means, and only key answers blame the key.
import { test } from "node:test";
import assert from "node:assert/strict";
import { describeTest, needsAttention, statusPill } from "./test-result.ts";

const base = { providerName: "OpenAI", isActive: true, lastError: null, lastErrorCode: null };

test("each test status has its own toast; a network failure never blames the key", () => {
  assert.deepEqual(describeTest({ ...base, testStatus: "active" }), { tone: "success", message: "OpenAI accepted the key." });
  assert.equal(describeTest({ ...base, testStatus: "invalid" }).code, "AUTH_ERROR");
  assert.match(describeTest({ ...base, testStatus: "invalid" }).message, /rejected the key/);
  assert.match(describeTest({ ...base, testStatus: "no_quota" }).message, /no quota or credit/);
  const down = describeTest({ ...base, testStatus: "unreachable", lastError: "Could not reach api.openai.com", lastErrorCode: "PROVIDER_UNAVAILABLE" });
  assert.deepEqual([down.tone, down.code], ["error", "PROVIDER_UNAVAILABLE"]);
  assert.match(down.message, /Could not reach api\.openai\.com.*not judged/);
  assert.equal(describeTest({ ...base, testStatus: "unreachable", lastErrorCode: "TIMEOUT" }).code, "TIMEOUT");
  assert.match(describeTest({ ...base, testStatus: "untested" }).message, /changed while it was being tested/);
});

test("pills and the needs-attention filter", () => {
  assert.deepEqual(statusPill({ isActive: true, testStatus: "active" }), { tone: "healthy", label: "Working" });
  assert.deepEqual(statusPill({ isActive: false, testStatus: "active" }), { tone: "muted", label: "Disabled" });
  assert.equal(statusPill({ isActive: true, testStatus: "invalid" }).tone, "danger");
  assert.equal(needsAttention({ isActive: true, testStatus: "active" }), false);
  for (const testStatus of ["untested", "invalid", "no_quota", "unreachable"]) assert.equal(needsAttention({ isActive: true, testStatus }), true, testStatus);
  assert.equal(needsAttention({ isActive: false, testStatus: "active" }), true);
});
