// Contract: docs/contracts/protocol-responses.md — Responses clients on POST /v1/responses, /v1/responses/compact, /responses and /codex/*.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { chunk, completion, fakeUpstream, json, ready, SECRET, sse } from "./lane-helpers.mjs";

const events = (text) => text.trim().split("\n\n").map((frame) => {
  const [head, data] = frame.split("\n");
  return { event: head.slice(7), data: JSON.parse(data.slice(6)) };
});
const geminiAnswer = { responseId: "g1", modelVersion: "gemini-2.5-flash", candidates: [{ content: { parts: [{ text: "from Gemini" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 } };
const responsesAnswer = { id: "resp_up", object: "response", model: "perplexity/sonar", status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "pp" }] }], usage: { input_tokens: 2, output_tokens: 1 } };

test("a Responses client is served through 9router's pivot: response objects, Responses SSE, passthrough, compact and the aliases", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(
      json(200, { ...completion, choices: [{ message: { content: "Hello!", reasoning_content: "hm" }, finish_reason: "stop" }] }),
      sse([chunk({ role: "assistant", content: "Hel" }), chunk({ content: "lo" }), chunk({}, { finish_reason: "stop" }), { id: "chatcmpl-s", model: "gpt-4.1", choices: [], usage: { prompt_tokens: 9, completion_tokens: 2 } }, "[DONE]"]),
      json(200, completion),
      json(200, completion),
      json(200, completion),
      json(200, geminiAnswer),
      json(200, responsesAnswer),
    );
    const { app, call, dash, key } = await ready(file, upstream);
    const post = (url, body, headers = {}) => call({ method: "POST", url, body, headers: { authorization: `Bearer ${key}`, ...headers } });
    const body = {
      model: "openai/gpt-4.1", instructions: "be brief",
      input: [
        { role: "user", content: [{ type: "input_text", text: "hi" }] },
        { type: "reasoning", summary: [{ type: "summary_text", text: "plan" }], encrypted_content: "ENC" },
        { type: "message", role: "assistant", content: [{ type: "output_text", text: "Hi there" }] },
        { role: "user", content: "again" },
      ],
      tool_choice: { type: "function", name: "shell" }, tools: [{ type: "function", name: "shell", parameters: { type: "object", properties: {} } }, { type: "web_search" }],
      text: { verbosity: "low" }, store: false, include: ["reasoning.encrypted_content"], max_output_tokens: 100,
    };

    const object = await post("/v1/responses", { ...body, stream: false });
    assert.equal(object.statusCode, 200);
    assert.deepEqual(object.json(), {
      id: "resp_up", object: "response", created_at: object.json().created_at, model: "gpt-4.1", status: "completed", background: false, error: null,
      output: [{ type: "reasoning", summary: [{ type: "summary_text", text: "hm" }] }, { type: "message", role: "assistant", content: [{ type: "output_text", text: "Hello!", annotations: [] }] }],
      usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
    });
    const sent = JSON.parse(upstream.calls[0].request.body);
    assert.equal(upstream.calls[0].request.headers.authorization, `Bearer ${SECRET}`);
    assert.deepEqual(sent.messages, [
      { role: "system", content: "be brief" }, { role: "user", content: "hi" },
      { role: "assistant", content: "Hi there", reasoning_content: "plan", encrypted_content: "ENC" }, { role: "user", content: "again" },
    ], "reasoning history rides on the next assistant turn (9router)");
    assert.deepEqual([sent.tool_choice, sent.text, sent.max_completion_tokens, sent.store, sent.include], [{ type: "function", name: "shell" }, { verbosity: "low" }, 100, undefined, undefined],
      "tool_choice and text are copied as sent; store and include are deleted");
    assert.deepEqual(sent.tools.map((tool) => tool.function.name), ["shell"], "the hosted tool is dropped");

    const streamed = await post("/v1/responses", { model: "openai/gpt-4.1", input: "hi" });
    assert.equal(streamed.headers["content-type"], "text/event-stream; charset=utf-8", "an omitted stream streams (9router)");
    const frames = events(streamed.body);
    assert.equal(frames.filter((f) => f.event === "response.output_text.delta").map((f) => f.data.delta).join(""), "Hello");
    assert.deepEqual(frames.at(-1), { event: "response.completed", data: {
      type: "response.completed", sequence_number: frames.length,
      response: { id: frames[0].data.response.id, object: "response", created_at: frames[0].data.response.created_at, status: "completed", background: false, error: null, usage: { input_tokens: 9, output_tokens: 2, total_tokens: 11 } },
    } }, "the trailing usage chunk reaches response.completed");
    assert.ok(!streamed.body.includes("[DONE]"));

    assert.equal((await post("/v1/responses/compact", { model: "openai/gpt-4.1", input: "hi", stream: false })).statusCode, 200);
    assert.equal(JSON.parse(upstream.calls[2].request.body)._compact, true, "_compact reaches the chat body (9router)");
    for (const url of ["/responses", "/codex/v1/responses"]) {
      const alias = await post(url, { model: "openai/gpt-4.1", input: "hi", stream: false });
      assert.deepEqual([alias.statusCode, alias.json().object], [200, "response"], url);
    }

    await dash({ method: "POST", url: "/api/connections", body: { provider: "gemini", apiKey: "gemini-lane-key-5555" } });
    const viaGemini = await post("/v1/responses", { model: "gemini/gemini-2.5-flash", input: "hi", stream: false });
    assert.equal(viaGemini.json().object, "chat.completion", "9router answers other providers with chat.completion (kept)");

    await dash({ method: "POST", url: "/api/connections", body: { provider: "perplexity-agent", apiKey: "pplx-lane-key-1234" } });
    const passthrough = { model: "pplx-agent/perplexity/sonar", input: [{ type: "item_reference", id: "x" }], tools: [{ type: "web_search" }], store: true, stream: false };
    const viaResponses = await post("/v1/responses", passthrough);
    assert.deepEqual(JSON.parse(upstream.calls[6].request.body), { ...passthrough, model: "perplexity/sonar" }, "a Responses provider gets the body as sent");
    assert.deepEqual([viaResponses.json().id, viaResponses.json().output[0].content[0].text], ["resp_up", "pp"]);

    const bad = await post("/v1/responses", { model: "openai/gpt-4.1", input: "" });
    assert.deepEqual([bad.statusCode, bad.json().error.type, bad.json().error.param], [400, "invalid_request_error", "input"], "errors stay OpenAI-shaped");
    assert.equal((await call({ method: "POST", url: "/codex/responses", body })).statusCode, 401);
    assert.equal(upstream.calls.length, 7);
    await app.close();
  }));
