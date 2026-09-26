// Contract: docs/contracts/provider-commandcode.md — an OpenAI client on /v1 served by Command Code, and its connection test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { body, fakeUpstream, frames, json, ready } from "./lane-helpers.mjs";

const KEY = "user_commandcode_lane_key";
const ndjson = (events) => (_request, ctx) => ({ status: 200, headers: { "content-type": "application/x-ndjson" }, body: body(events.map((e) => JSON.stringify(e)).join("\n") + "\n", ctx) });
const answer = [{ type: "start" }, { type: "text-delta", text: "Hello " }, { type: "text-delta", text: "from Command Code" }, { type: "finish-step", finishReason: "stop", usage: { inputTokens: 4, outputTokens: 3 } }, { type: "finish" }];

test("a Command Code connection is tested with a ping and serves /v1 through the forced stream", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(
      json(401, { success: false, error: { code: "UNAUTHORIZED", status: 401, message: "Invalid 'Authorization' header or token." } }),
      ndjson(answer),
      ndjson(answer),
    );
    const { app, dash, chat } = await ready(file, upstream);
    const created = (await dash({ method: "POST", url: "/api/connections", body: { provider: "commandcode", apiKey: KEY } })).json();
    const tested = (await dash({ method: "POST", url: `/api/connections/${created.id}/test` })).json();
    assert.deepEqual([tested.testStatus, tested.lastError], ["invalid", "Command Code answered 401: Invalid 'Authorization' header or token."]);
    assert.equal(upstream.calls[0].request.url, "https://api.commandcode.ai/alpha/generate");
    const res = await chat({ model: "commandcode/deepseek/deepseek-v4-pro", messages: [{ role: "user", content: "hi" }] });
    assert.equal(res.statusCode, 200);
    const reply = res.json();
    assert.deepEqual([reply.choices[0].message.content, reply.choices[0].finish_reason, reply.usage.prompt_tokens, reply.usage.completion_tokens], ["Hello from Command Code", "stop", 4, 3]);
    assert.equal(JSON.parse(upstream.calls[1].request.body).params.model, "deepseek/deepseek-v4-pro");
    const streamed = await chat({ model: "commandcode/deepseek/deepseek-v4-pro", messages: [{ role: "user", content: "hi" }], stream: true });
    const events = frames(streamed.body);
    assert.equal(events.filter((e) => e.choices?.[0]?.delta?.content).map((e) => e.choices[0].delta.content).join(""), "Hello from Command Code");
    assert.equal(events.at(-1), "[DONE]", "AIGate ends the stream with [DONE] (9router does not)");
    await app.close();
  }));
