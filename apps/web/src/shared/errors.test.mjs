// Reverse-thinking check: every failure the dashboard can meet maps to a precise, actionable message.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "./api.ts";
import { toProblem } from "./errors.ts";

test("transport failures get their own codes and advice", () => {
  assert.equal(toProblem(new ApiError(0, "NETWORK_ERROR", "x")).message, "Could not reach AIGate. Check that the server is running, then try again.");
  assert.match(toProblem(new ApiError(0, "TIMEOUT", "x")).message, /10 seconds/);
  assert.match(toProblem(new ApiError(200, "BAD_RESPONSE", "x")).message, /could not read/);
  assert.deepEqual(toProblem(new TypeError("boom")), { code: "UNEXPECTED", message: "Something went wrong in the dashboard. Refresh the page." });
});

test("server codes use the details the contract returns", () => {
  assert.match(toProblem(new ApiError(401, "INVALID_CREDENTIALS", "x", { remainingBeforeLock: 2 })).message, /2 attempt\(s\) left/);
  assert.match(toProblem(new ApiError(429, "RATE_LIMITED", "x", { retryAfter: 30 })).message, /Try again in 30s/);
  assert.match(toProblem(new ApiError(429, "RATE_LIMITED", "x")).message, /Wait a moment/, "no retryAfter still reads well");
  assert.match(toProblem(new ApiError(401, "UNAUTHENTICATED", "x")).message, /session ended/);
  assert.match(toProblem(new ApiError(409, "LIMIT_REACHED", "x")).message, /100 API keys/);
  assert.match(toProblem(new ApiError(404, "NOT_FOUND", "x")).message, /refreshed/);
});

test("validation messages pass through and unknown failures stay honest", () => {
  assert.deepEqual(toProblem(new ApiError(400, "INVALID_REQUEST", "name must be 1-64 characters")), { code: "INVALID_REQUEST", message: "name must be 1-64 characters" });
  assert.match(toProblem(new ApiError(502, "HTTP_502", "Bad Gateway")).message, /HTTP 502/);
  assert.equal(toProblem(new ApiError(418, "HTTP_418", "")).message, "Request failed (HTTP 418).");
});

test("connection codes tell the user what to do next", () => {
  assert.equal(toProblem(new ApiError(400, "PROVIDER_NOT_SUPPORTED", "x", { message: "deepseek cannot be connected yet. Supported: OpenAI." })).message, "deepseek cannot be connected yet. Supported: OpenAI.");
  assert.match(toProblem(new ApiError(409, "ALREADY_CONNECTED", "x")).message, /Replace key/);
  assert.equal(toProblem(new ApiError(409, "PREFIX_TAKEN", "x", { message: "Another custom provider already uses the prefix \"local\"." })).message, "Another custom provider already uses the prefix \"local\".");
  assert.match(toProblem(new ApiError(409, "PREFIX_RESERVED", "x", {})).message, /built-in provider/);
  assert.match(toProblem(new ApiError(409, "NODE_LIMIT", "x")).message, /100 custom providers/);
  assert.match(toProblem(new ApiError(409, "CREDENTIAL_UNREADABLE", "x")).message, /secret key file changed/);
  assert.match(toProblem(new ApiError(0, "TIMEOUT", "x", { timeoutSeconds: 25 })).message, /within 25 seconds/);
});
