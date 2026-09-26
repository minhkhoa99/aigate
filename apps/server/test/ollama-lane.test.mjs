// Contract: docs/contracts/provider-ollama.md — ollama-local connections (host, optional key) and /v1.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { body, errorOf, fakeUpstream, frames, hello, json, ready } from "./lane-helpers.mjs";

const ndjson = (lines) => (_request, ctx) => ({ status: 200, headers: { "content-type": "application/x-ndjson" }, body: body(lines.map((l) => JSON.stringify(l)).join("\n"), ctx) });
const reply = { model: "llama3", message: { role: "assistant", content: "Local hello" }, done: true, done_reason: "stop", prompt_eval_count: 4, eval_count: 2 };

test("a keyless ollama-local connection with its own host is tested and served there, without an auth header", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(json(200, { models: [{ name: "llama3" }] }), json(200, reply), ndjson([{ message: { content: "Hi" } }, { done: true, prompt_eval_count: 1, eval_count: 1 }]), json(200, reply));
    const { app, dash, chat } = await ready(file, upstream);
    const created = await dash({ method: "POST", url: "/api/connections", body: { provider: "ollama-local", baseUrl: "http://127.0.0.1:11500/" } });
    assert.equal(created.statusCode, 201);
    assert.deepEqual([created.json().keyHint, created.json().baseUrl], ["no key", "http://127.0.0.1:11500/"]);
    const tested = (await dash({ method: "POST", url: `/api/connections/${created.json().id}/test` })).json();
    assert.equal(tested.testStatus, "active");
    assert.equal(upstream.calls[0].request.url, "http://127.0.0.1:11500/api/tags");
    assert.equal(upstream.calls[0].request.headers.authorization, undefined);
    const res = await chat({ ...hello, model: "ollama-local/llama3" });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().choices[0].message.content, "Local hello");
    assert.equal(upstream.calls[1].request.url, "http://127.0.0.1:11500/api/chat");
    assert.equal(upstream.calls[1].request.headers.authorization, undefined);
    assert.equal(JSON.parse(upstream.calls[1].request.body).stream, false);
    const streamed = await chat({ ...hello, model: "ollama-local/llama3", stream: true });
    const events = frames(streamed.body);
    assert.equal(events.find((e) => e.choices?.[0]?.delta?.content)?.choices[0].delta.content, "Hi");
    assert.equal(events.at(-1), "[DONE]");
    // Clearing the host goes back to the catalog URL.
    const cleared = await dash({ method: "PATCH", url: `/api/connections/${created.json().id}`, body: { baseUrl: "" } });
    assert.equal(cleared.json().baseUrl, null);
    await chat({ ...hello, model: "ollama-local/llama3" });
    assert.equal(upstream.calls[3].request.url, "http://localhost:11434/api/chat");
    await app.close();
  }));

test("only ollama-local may skip the key or set a host; the host follows the https-or-loopback rule", () =>
  withTempDb(async (file) => {
    const { app, dash, connection } = await ready(file, fakeUpstream());
    const create = (payload) => dash({ method: "POST", url: "/api/connections", body: payload });
    for (const [payload, pattern] of [
      [{ provider: "ollama" }, /apiKey must be/],
      [{ provider: "deepseek", apiKey: "" }, /apiKey must be/],
      [{ provider: "deepseek", apiKey: "sk-deep-key-1234", baseUrl: "https://x.example" }, /baseUrl cannot be set on a DeepSeek connection/],
      [{ provider: "ollama-local", baseUrl: "http://192.168.1.20:11434" }, /https/],
      [{ provider: "ollama-local", baseUrl: "https://gpu.example/?k=1" }, /query or fragment/],
    ]) {
      const res = await create(payload);
      assert.deepEqual([res.statusCode, res.json().code], [400, "INVALID_REQUEST"], JSON.stringify(payload));
      assert.match(res.json().message, pattern);
    }
    const patchOpenai = await dash({ method: "PATCH", url: `/api/connections/${connection.id}`, body: { baseUrl: "https://x.example" } });
    assert.match(patchOpenai.json().message, /baseUrl cannot be set on a OpenAI connection/);
    const clearKey = await dash({ method: "PATCH", url: `/api/connections/${connection.id}`, body: { apiKey: "" } });
    assert.deepEqual([clearKey.statusCode, clearKey.json().code], [400, "INVALID_REQUEST"]);
    const cloud = await create({ provider: "ollama", apiKey: "ollama-cloud-key-1234" });
    assert.equal(cloud.statusCode, 201);
    assert.equal(cloud.json().baseUrl, null);
    await app.close();
  }));

test("an Ollama error line mid-stream reaches the client as an error event with no [DONE] (corrected)", () =>
  withTempDb(async (file) => {
    const upstream = fakeUpstream(ndjson([{ message: { content: "par" } }, { error: "model unloaded" }]), ndjson([{ error: "model not found" }]));
    const { app, dash, chat } = await ready(file, upstream);
    await dash({ method: "POST", url: "/api/connections", body: { provider: "ollama-local" } });
    const res = await chat({ ...hello, model: "ollama-local/llama3", stream: true });
    const events = frames(res.body);
    assert.notEqual(events.at(-1), "[DONE]");
    assert.match(JSON.stringify(events.at(-1)), /model unloaded/);
    const early = await chat({ ...hello, model: "ollama-local/llama3", stream: true });
    assert.deepEqual(errorOf(early), { status: 502, code: "provider_unavailable", type: "api_error" }, "before the first chunk it is a JSON error");
    await app.close();
  }));
