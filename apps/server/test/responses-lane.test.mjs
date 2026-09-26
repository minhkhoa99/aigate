// Contract: docs/contracts/provider-openai-responses.md — an OpenAI client on /v1 served by a Responses provider.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { fakeUpstream, frames, hello, ready, sse } from "./lane-helpers.mjs";

test("perplexity-agent streams through the Responses adapter; an error event reaches the client as text, as in 9router", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(sse([
      { type: "response.output_text.delta", delta: "Hi" },
      { type: "response.failed", response: { error: { message: "quota exceeded" } } },
    ]));
    const { app, dash, chat } = await ready(file, upstream);
    assert.equal((await dash({ method: "POST", url: "/api/connections", body: { provider: "perplexity-agent", apiKey: "pplx-lane-key-1234" } })).statusCode, 201);
    const res = await chat({ ...hello, model: "pplx-agent/perplexity/sonar", stream: true });
    assert.match(res.headers["content-type"], /text\/event-stream/);
    const { request } = upstream.calls[0];
    assert.equal(request.url, "https://api.perplexity.ai/v1/responses");
    assert.equal(JSON.parse(request.body).model, "perplexity/sonar");
    const events = frames(res.body);
    const text = events.filter((e) => e !== "[DONE]").map((e) => e.choices?.[0]?.delta?.content ?? "").join("");
    assert.equal(text, "Hi[Error] quota exceeded");
    assert.equal(events.at(-1), "[DONE]", "9router ends normally");
    assert.equal(events.at(-2).choices[0].finish_reason, "stop");
    await app.close();
  }));
