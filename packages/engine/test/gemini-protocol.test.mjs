// Contract: docs/contracts/protocol-gemini.md — the client-facing Gemini generateContent protocol.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EngineError, GEMINI_TTS_TIMEOUT_MS, geminiModelList, GeminiStreamEncoder, geminiTtsRequest, isGeminiTtsRequest, parseGeminiGenerateRequest, parseGeminiPath,
  toGeminiResponse,
} from "../dist/index.js";

const route = parseGeminiPath("gemini/gemini-2.5-flash:generateContent");
const meta = { created: 1, fallbackId: "chatcmpl-fb" };
const usage = { inputTokens: 3, outputTokens: 2, cacheReadTokens: 1, reasoningTokens: 1 };

test("the path keeps two segments; only :streamGenerateContent streams", () => {
  assert.deepEqual(parseGeminiPath("gemini/gemini-2.5-flash:streamGenerateContent"), { model: "gemini/gemini-2.5-flash", stream: true, action: ":streamGenerateContent" });
  assert.deepEqual(parseGeminiPath("gemini-2.5-flash:generateContent"), { model: "gemini-2.5-flash", stream: false, action: ":generateContent" });
  assert.deepEqual(parseGeminiPath("openrouter/meta-llama/llama-3:streamGenerateContent"), { model: "openrouter/meta-llama", stream: false, action: ":generateContent" }, "later segments are ignored (9router)");
  assert.deepEqual(parseGeminiPath("gemini-2.5-flash:countTokens"), { model: "gemini-2.5-flash:countTokens", stream: false, action: ":generateContent" });
});

test("the body becomes 9router's text-only chat request", () => {
  const request = parseGeminiGenerateRequest({
    systemInstruction: { parts: [{ text: "be brief" }, { inlineData: { mimeType: "image/png", data: "AA" } }] },
    contents: [
      { role: "user", parts: [{ text: "hi" }, { inlineData: { mimeType: "image/png", data: "AA" } }, { functionCall: { name: "f", args: {} } }] },
      { role: "model", parts: [{ text: "hello" }] },
      { role: "function", parts: [{ functionResponse: { name: "f", response: {} } }] },
      { parts: "not a list" },
    ],
    tools: [{ functionDeclarations: [{ name: "f" }] }],
    generationConfig: { maxOutputTokens: 50, temperature: 0.5, topP: 0.9, stopSequences: ["x"], thinkingConfig: { thinkingBudget: 10 } },
    safetySettings: [],
  }, parseGeminiPath("gemini/gemini-2.5-flash:streamGenerateContent"));
  assert.deepEqual(request, {
    model: "gemini/gemini-2.5-flash",
    stream: true,
    system: [{ type: "text", text: "be brief\n" }],
    messages: [
      { role: "user", content: [{ type: "text", text: "hi\n\n" }] },
      { role: "assistant", content: [{ type: "text", text: "hello" }] },
      { role: "user", content: [{ type: "text", text: "" }] },
      { role: "user", content: [{ type: "text", text: "" }] },
    ],
    maxOutputTokens: 50, temperature: 0.5, topP: 0.9,
  });
  assert.deepEqual(parseGeminiGenerateRequest({}, route), { model: "gemini/gemini-2.5-flash", stream: false, messages: [] });
  assert.equal(parseGeminiGenerateRequest({ systemInstruction: { parts: [] } }, route).system, undefined);
  for (const [body, param] of [[[], "body"], [{ contents: [5] }, "contents[0]"], [{ generationConfig: { maxOutputTokens: 0 } }, "generationConfig.maxOutputTokens"], [{ generationConfig: { temperature: 3 } }, "generationConfig.temperature"], [{ generationConfig: { topP: 2 } }, "generationConfig.topP"]]) {
    assert.throws(() => parseGeminiGenerateRequest(body, route), (e) => e instanceof EngineError && e.details.param === param, param);
  }
  assert.throws(() => parseGeminiGenerateRequest({}, parseGeminiPath(":generateContent")), /model/);
});

test("the non-streaming answer is 9router's GenerateContentResponse; tool calls are dropped", () => {
  const answer = toGeminiResponse({ id: "x", model: "gpt-4.1", stopReason: "tool_use", usage, content: [{ type: "thinking", text: "hm" }, { type: "text", text: "Hi" }, { type: "tool_call", id: "c", name: "f", arguments: "{}" }] }, meta, "openai/gpt-4.1");
  assert.deepEqual(answer, {
    candidates: [{ content: { role: "model", parts: [{ text: "hm", thought: true }, { text: "Hi" }] }, finishReason: "STOP", index: 0 }],
    modelVersion: "gpt-4.1",
    usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2, totalTokenCount: 6, thoughtsTokenCount: 1 },
  });
  const finish = (stopReason, extra = {}) => toGeminiResponse({ id: "", model: "", stopReason, usage: { inputTokens: 1, outputTokens: 1 }, content: [], ...extra }, meta, "fallback");
  assert.deepEqual(finish("max_tokens"), {
    candidates: [{ content: { role: "model", parts: [{ text: "" }] }, finishReason: "MAX_TOKENS", index: 0 }], modelVersion: "fallback",
    usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
  });
  assert.equal(finish("content_filter").candidates[0].finishReason, "SAFETY");
  assert.equal(finish("end_turn", { vendorExtensions: { openai: { finish_reason: "recitation" } } }).candidates[0].finishReason, "STOP");
});

test("the stream is data frames with CRLF; tool calls dropped; usage only when the finish carries it; errors end it silently", () => {
  const encoder = new GeminiStreamEncoder({ model: "fallback", usageOnFinish: true });
  let text = encoder.encode({ type: "start", id: "s", model: "gemini-2.5-flash" });
  assert.equal(text, "");
  text += encoder.encode({ type: "thinking_delta", index: 0, text: "hm" }) + encoder.encode({ type: "thinking_delta", index: 0, text: "", signature: "S" });
  text += encoder.encode({ type: "text_delta", index: 0, text: "Hi" }) + encoder.encode({ type: "text_delta", index: 0, text: "" });
  text += encoder.encode({ type: "tool_call_delta", index: 0, id: "c", name: "f", argumentsDelta: "{}" }) + encoder.encode({ type: "image_delta", mediaType: "image/png", data: "AA" });
  text += encoder.encode({ type: "usage", usage }) + encoder.encode({ type: "stop", stopReason: "max_tokens" }) + encoder.end();
  assert.deepEqual(text.split("\r\n\r\n"), [
    "data: {\"candidates\":[{\"content\":{\"role\":\"model\",\"parts\":[{\"text\":\"hm\",\"thought\":true}]},\"index\":0}]}",
    "data: {\"candidates\":[{\"content\":{\"role\":\"model\",\"parts\":[{\"text\":\"Hi\"}]},\"index\":0}]}",
    "data: {\"candidates\":[{\"content\":{\"role\":\"model\",\"parts\":[{\"text\":\"\"}]},\"index\":0,\"finishReason\":\"MAX_TOKENS\"}],\"usageMetadata\":{\"promptTokenCount\":4,\"candidatesTokenCount\":2,\"totalTokenCount\":6,\"thoughtsTokenCount\":1},\"modelVersion\":\"gemini-2.5-flash\"}",
    "",
  ]);
  assert.throws(() => encoder.encode({ type: "stop", stopReason: "end_turn" }), /closed/);

  const trailing = new GeminiStreamEncoder({ model: "gpt-4.1", usageOnFinish: false });
  const last = trailing.encode({ type: "usage", usage }) + trailing.encode({ type: "stop", stopReason: "tool_use" });
  assert.equal(last, "data: {\"candidates\":[{\"content\":{\"role\":\"model\",\"parts\":[{\"text\":\"\"}]},\"index\":0,\"finishReason\":\"STOP\"}]}\r\n\r\n", "trailing usage is dropped");
  assert.equal(trailing.fail(new EngineError("TIMEOUT", "slow")), "", "an error frame is dropped");
  assert.throws(() => trailing.end(), /closed/);

  assert.match(new GeminiStreamEncoder({ model: "m", usageOnFinish: false }).encode({ type: "stop", stopReason: "content_filter" }), /"finishReason":"SAFETY"/);
  const noStart = new GeminiStreamEncoder({ model: "fallback", usageOnFinish: true });
  assert.match(noStart.encode({ type: "usage", usage }) + noStart.encode({ type: "stop", stopReason: "end_turn" }), /"finishReason":"STOP"\}\],"usageMetadata":.*"modelVersion":"fallback"/);
});

test("GET /v1beta/models lists the whole catalog, gemini models twice", () => {
  const { models } = geminiModelList();
  const names = models.map((m) => m.name);
  assert.equal(new Set(names).size, names.length);
  const bare = models.find((m) => m.name === "models/gemini-2.5-flash");
  assert.deepEqual(bare, { name: "models/gemini-2.5-flash", displayName: bare.displayName, description: `Gemini model: ${bare.displayName}`, supportedGenerationMethods: ["generateContent", "streamGenerateContent"], inputTokenLimit: 128000, outputTokenLimit: 8192 });
  const prefixed = models.find((m) => m.name === "models/gemini/gemini-2.5-flash");
  assert.deepEqual([prefixed.description, prefixed.supportedGenerationMethods], [`gemini model: ${prefixed.displayName}`, ["generateContent"]]);
  assert.ok(names.some((name) => name.startsWith("models/pplx-agent/")), "an aliased provider is listed under its alias");
  assert.ok(names.some((name) => name.startsWith("models/openai/")) && models.length > 900, "unconnected providers too");
});

test("TTS requests are detected and forwarded to Google unchanged", () => {
  const audio = { generationConfig: { responseModalities: ["audio"] } };
  assert.equal(isGeminiTtsRequest(parseGeminiPath("gemini-2.5-flash-preview-tts:generateContent"), {}), true);
  assert.equal(isGeminiTtsRequest(parseGeminiPath("gemini/gemini-2.5-flash:generateContent"), audio), true);
  assert.equal(isGeminiTtsRequest(parseGeminiPath("models/gemini-2.5-flash:generateContent"), audio), true);
  assert.equal(isGeminiTtsRequest(parseGeminiPath("openai/gpt-4o-audio:generateContent"), audio), false);
  assert.equal(isGeminiTtsRequest(parseGeminiPath("gemini/gemini-2.5-flash:generateContent"), { generationConfig: { responseModalities: ["TEXT"] } }), false);
  const body = { contents: [{ parts: [{ text: "Say hi" }] }], ...audio };
  assert.deepEqual(geminiTtsRequest(parseGeminiPath("gemini/gemini-2.5-flash-preview-tts:streamGenerateContent"), { alt: "sse", key: "client-key", x: ["1", "2"], n: 5 }, body, "gk"), {
    method: "POST",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:streamGenerateContent?alt=sse&x=1&x=2",
    headers: { "content-type": "application/json", "x-goog-api-key": "gk" },
    body: JSON.stringify(body),
    timeoutMs: GEMINI_TTS_TIMEOUT_MS,
  });
  assert.equal(GEMINI_TTS_TIMEOUT_MS, 45000);
  assert.equal(geminiTtsRequest(parseGeminiPath("models/gemini-2.5-flash-preview-tts:generateContent"), {}, body, "gk").url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent");
  assert.throws(() => geminiTtsRequest(parseGeminiPath("..%2Fx:generateContent"), {}, body, "gk"), (e) => e instanceof EngineError && e.details.param === "model");
});
