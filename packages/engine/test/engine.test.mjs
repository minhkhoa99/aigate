// Contract: docs/contracts/engine.md
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertModelSupports, builtinRegistry, defineRegistry, detectRequiredCapabilities, EngineError, ERROR_CODES, FALLBACK_POLICY,
  isRecoverable, looksLikeVisionModel, MAX_ATTEMPTS_LIMIT, RegistryError, resolveCapabilities, UnsupportedFeatureError, withRetry,
} from "../dist/index.js";

const never = () => new AbortController().signal;
const retryable = () => true;
const fast = { baseDelayMs: 1, maxDelayMs: 2, shouldRetry: retryable };

test("withRetry returns once an attempt succeeds, passing the attempt number and signal", async () => {
  const signal = never();
  const seen = [];
  const value = await withRetry(async (attempt, given) => {
    seen.push(attempt);
    assert.equal(given, signal);
    if (attempt < 3) throw new Error("transient");
    return "ok";
  }, { ...fast, signal, maxAttempts: 5 });
  assert.equal(value, "ok");
  assert.deepEqual(seen, [1, 2, 3]);
});

test("withRetry stops at maxAttempts and rethrows the last error", async () => {
  let calls = 0;
  await assert.rejects(withRetry(async (attempt) => { calls++; throw new Error(`fail ${attempt}`); }, { ...fast, signal: never(), maxAttempts: 3 }), /fail 3/);
  assert.equal(calls, 3);
});

test("withRetry never retries an error the caller marks final", async () => {
  let calls = 0;
  const final = new EngineError("INVALID_REQUEST", "bad body");
  await assert.rejects(withRetry(async () => { calls++; throw final; }, {
    ...fast, signal: never(), maxAttempts: 5, shouldRetry: (error) => !(error instanceof EngineError && !isRecoverable(error.code)),
  }), (error) => error === final);
  assert.equal(calls, 1);
});

test("an abort during the backoff wait ends the retry at once with the abort reason", async () => {
  const controller = new AbortController();
  const started = Date.now();
  const run = withRetry(async () => { throw new Error("transient"); }, { signal: controller.signal, maxAttempts: 5, baseDelayMs: 10_000, maxDelayMs: 10_000, shouldRetry: retryable });
  setTimeout(() => controller.abort(new Error("client left")), 20);
  await assert.rejects(run, /client left/);
  assert.ok(Date.now() - started < 2_000, "the 10 s wait was cancelled");
});

test("an already aborted signal runs no attempt, and an abort mid-attempt is not retried", async () => {
  const controller = new AbortController();
  controller.abort(new Error("deadline"));
  let calls = 0;
  await assert.rejects(withRetry(async () => { calls++; return 1; }, { ...fast, signal: controller.signal, maxAttempts: 3 }), /deadline/);
  assert.equal(calls, 0);

  const mid = new AbortController();
  let midCalls = 0;
  await assert.rejects(withRetry(async () => { midCalls++; mid.abort(new Error("gone")); throw new Error("upstream"); }, { ...fast, signal: mid.signal, maxAttempts: 3 }), /upstream/);
  assert.equal(midCalls, 1);
});

test("withRetry rejects configurations that are not bounded", async () => {
  const run = (overrides) => withRetry(async () => 1, { ...fast, signal: never(), maxAttempts: 2, ...overrides });
  for (const maxAttempts of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_ATTEMPTS_LIMIT + 1]) await assert.rejects(run({ maxAttempts }), RangeError, String(maxAttempts));
  await assert.rejects(run({ baseDelayMs: -1 }), RangeError);
  await assert.rejects(run({ baseDelayMs: 10, maxDelayMs: 5 }), RangeError);
  await assert.rejects(run({ maxDelayMs: Number.POSITIVE_INFINITY }), RangeError);
});

test("backoff doubles and is capped by maxDelayMs", async () => {
  const waits = [];
  let last = Date.now();
  await assert.rejects(withRetry(async () => {
    const now = Date.now();
    waits.push(now - last);
    last = now;
    throw new Error("x");
  }, { signal: never(), maxAttempts: 4, baseDelayMs: 40, maxDelayMs: 60, shouldRetry: retryable }));
  // Waits before attempts 2-4: 40, then 60 (capped from 80), then 60 (capped from 160).
  const [, second, third, fourth] = waits;
  assert.ok(second >= 35 && third >= 55 && fourth >= 55, JSON.stringify(waits));
  assert.ok(fourth < 150, `capped: ${JSON.stringify(waits)}`);
});

test("every error code has an explicit fallback decision", () => {
  assert.deepEqual(Object.keys(FALLBACK_POLICY).sort(), [...ERROR_CODES].sort());
  assert.equal(isRecoverable("INVALID_REQUEST"), false, "a malformed request is never sent to another provider");
  assert.equal(isRecoverable("INTERNAL_ERROR"), false);
  assert.equal(isRecoverable("RATE_LIMIT"), true);
  assert.equal(FALLBACK_POLICY.AUTH_ERROR, "next-account");
});

test("the built-in registry is the connectable part of the catalog, with a reason for the rest", () => {
  assert.equal(builtinRegistry.providers.length, 52);
  assert.equal(builtinRegistry.model("openai", "gpt-4.1")?.contextWindow, 1_000_000);
  assert.equal(builtinRegistry.model("openai", "missing"), undefined);
  assert.equal(builtinRegistry.provider("ds")?.id, "deepseek", "aliases resolve");
  assert.equal(builtinRegistry.provider("anthropic")?.protocol, "anthropic");
  assert.deepEqual(builtinRegistry.status("anthropic"), { connectable: true });
  assert.deepEqual(builtinRegistry.status("gemini"), { connectable: false, reason: "Needs the gemini adapter (SP14)" });
  assert.deepEqual(builtinRegistry.status("openai"), { connectable: true });
  assert.equal(builtinRegistry.status("no-such-provider"), undefined);
  // 9router data defect: an output limit above the context window is not trusted.
  assert.equal(builtinRegistry.model("tencent", "hunyuan-turbos-latest")?.maxOutputTokens, null);
});

test("defineRegistry reports every bad entry at once", () => {
  const model = { id: "m", name: "M", kind: "chat", capabilities: resolveCapabilities(undefined, "m"), contextWindow: 10, maxOutputTokens: 5 };
  const provider = { id: "p", name: "P", protocol: "openai-compatible", chatUrl: "https://api.example.com/v1/chat/completions", modelsUrl: "https://api.example.com/v1/models", headers: {}, aliases: ["pp"], auth: { kind: "api-key", header: "authorization", scheme: "bearer" }, models: [model] };
  const registry = defineRegistry([provider]);
  assert.ok(registry.model("p", "m"));
  assert.equal(registry.provider("pp")?.id, "p");
  try {
    defineRegistry([
      provider,
      { ...provider },
      { ...provider, id: "Bad Id", chatUrl: "http://plain.example.com/chat/completions" },
      { ...provider, id: "q", models: [model, model, { ...model, id: "big", maxOutputTokens: 20 }, { ...model, id: " spaced" }, { ...model, id: "neg", contextWindow: -1 }] },
      { ...provider, id: "r", modelsUrl: "not a url" },
    ]);
    assert.fail("expected RegistryError");
  } catch (error) {
    assert.ok(error instanceof RegistryError);
    const text = error.problems.join("\n");
    for (const expected of ["duplicate provider id", "id must match", "must use https", "duplicate chat model id", "exceeds contextWindow", "is not a URL", "positive integer or null", "printable"]) {
      assert.ok(text.includes(expected), expected);
    }
  }
});

test("declared capabilities are final and undeclared models get the floor plus the vision heuristic", () => {
  const gpt41 = builtinRegistry.model("openai", "gpt-4.1");
  assert.deepEqual(resolveCapabilities(gpt41, "gpt-4.1"), gpt41.capabilities);
  assert.equal(resolveCapabilities(undefined, "some-custom-model").vision, false);
  assert.equal(resolveCapabilities(undefined, "some-custom-model").tools, true);
  assert.equal(resolveCapabilities(undefined, "qwen3-vl-plus").vision, true);
});

test("the vision name heuristic checks NOT_VISION first", () => {
  for (const id of ["qwen3-vl-plus", "glm-4.6v", "glm-5v-turbo", "deepseek-v4-flash-vision-exp", "llava-13b"]) assert.equal(looksLikeVisionModel(id), true, id);
  for (const id of ["nvidia/llama-nemotron-embed-vl-1b-v2:free", "flux-vision-gen", "gpt-4v", "text-embedding-3-large", "gpt-4o-mini-tts", "some-model"]) {
    assert.equal(looksLikeVisionModel(id), false, id);
  }
});

const user = (...content) => ({ role: "user", content });
const assistant = (...content) => ({ role: "assistant", content });
const text = (value) => ({ type: "text", text: value });
const image = { type: "image", source: { kind: "url", url: "https://example.com/cat.png" } };

test("required capabilities come from every message, the system prompt, and nested tool results", () => {
  const earlierImage = { model: "m", stream: false, messages: [user(text("look"), image), assistant(text("a cat")), user(text("and now?"))] };
  assert.deepEqual([...detectRequiredCapabilities(earlierImage)], ["vision"], "an image from an earlier turn still needs vision");
  assert.deepEqual([...detectRequiredCapabilities({ model: "m", stream: false, system: [image], messages: [user(text("hi"))] })], ["vision"]);
  const nested = { model: "m", stream: false, messages: [{ role: "tool", content: [{ type: "tool_result", toolCallId: "t1", content: [{ type: "file", mediaType: "application/pdf", source: image.source }] }] }] };
  assert.deepEqual([...detectRequiredCapabilities(nested)].sort(), ["pdf", "tools"]);
  const everything = {
    model: "m", stream: true, reasoning: { effort: "high" }, tools: [{ name: "f", parameters: {} }],
    messages: [user({ type: "audio", source: image.source }, { type: "video", source: image.source }, { type: "file", mediaType: "image/png", source: image.source })],
  };
  assert.deepEqual([...detectRequiredCapabilities(everything)].sort(), ["audioInput", "reasoning", "tools", "videoInput", "vision"]);
  assert.deepEqual([...detectRequiredCapabilities({ model: "m", stream: false, messages: [user(text("plain"))] })], []);
});

test("assertModelSupports names what is missing and enforces the output limit", () => {
  const model = (id) => builtinRegistry.model("openai", id);
  const expectCode = (fn, code, check) => assert.throws(fn, (error) => error instanceof EngineError && error.code === code && (check?.(error) ?? true));
  assertModelSupports({ model: "gpt-4.1", stream: false, messages: [user(image)] }, "openai", model("gpt-4.1"), "gpt-4.1");
  assertModelSupports({ model: "gpt-5", stream: false, reasoning: { effort: "low" }, messages: [user(text("x"))] }, "openai", model("gpt-5"), "gpt-5");
  expectCode(() => assertModelSupports({ model: "gpt-4.1", stream: false, reasoning: {}, messages: [user(text("x"))] }, "openai", model("gpt-4.1"), "gpt-4.1"),
    "MODEL_UNAVAILABLE", (error) => JSON.stringify(error.details.missing) === JSON.stringify(["reasoning"]));
  expectCode(() => assertModelSupports({ model: "gpt-5", stream: false, messages: [user({ type: "audio", source: image.source })] }, "openai", model("gpt-5"), "gpt-5"),
    "MODEL_UNAVAILABLE", (error) => error.message.includes("audioInput"));
  expectCode(() => assertModelSupports({ model: "gpt-4o-mini", stream: false, maxOutputTokens: 20_000, messages: [user(text("x"))] }, "openai", model("gpt-4o-mini"), "gpt-4o-mini"),
    "INVALID_REQUEST", (error) => error.details.limit === 16_384);
  expectCode(() => assertModelSupports({ model: "custom", stream: false, messages: [user(image)] }, "openai", undefined, "custom"), "MODEL_UNAVAILABLE");
  const embedding = { id: "embed-1", name: "E", kind: "embedding", capabilities: resolveCapabilities(undefined, "x"), contextWindow: 8, maxOutputTokens: 1 };
  expectCode(() => assertModelSupports({ model: "embed-1", stream: false, messages: [user(text("x"))] }, "openai", embedding, "embed-1"), "MODEL_UNAVAILABLE");
});

test("UnsupportedFeatureError names the feature and the target instead of dropping it", () => {
  const error = new UnsupportedFeatureError("thinking.signature", "openai-compatible");
  assert.equal(error.message, "openai-compatible cannot carry thinking.signature");
  assert.equal(error.feature, "thinking.signature");
});
