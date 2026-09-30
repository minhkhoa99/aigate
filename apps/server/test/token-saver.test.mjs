// Contract: docs/contracts/token-saver.md — request-wide opt-out and the implemented local stages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { completion, json, ready } from "./lane-helpers.mjs";

function upstream() {
  const calls = [];
  const headroomCalls = [];
  return {
    calls,
    headroomCalls,
    async send(request, ctx) {
      const body = JSON.parse(request.body);
      if (request.url.endsWith("/v1/compress")) {
        headroomCalls.push(body);
        return json(200, { messages: body.messages.map((message) => ({ ...message, content: message.content.slice(0, 1) })) })(request, ctx);
      }
      calls.push(body);
      return json(200, { ...completion, choices: [{ message: { content: "ok" }, finish_reason: "stop" }] })(request, ctx);
    },
  };
}
const textOf = (message) => typeof message.content === "string" ? message.content : message.content?.map((part) => part.text ?? "").join("") ?? "";

test("Caveman and Ponytail settings inject once; the case-insensitive opt-out bypasses both", () =>
  withTempDb(async (file) => {
    const fake = upstream();
    const { app, dash, chat } = await ready(file, fake);
    const saved = await dash({ method: "PATCH", url: "/api/settings", body: {
      cavemanEnabled: true, ponytailEnabled: true, headroomEnabled: true, headroomUrl: "http://127.0.0.1:1", headroomTimeoutMs: 250,
    } });
    assert.equal(saved.statusCode, 200, saved.body);
    const body = { model: "openai/gpt-4o-mini", messages: [{ role: "user", content: "hello" }] };
    await chat(body);
    const system = fake.calls[0].messages.filter((message) => message.role === "system").map(textOf).join("\n");
    assert.match(system, /Answer tersely/);
    assert.match(system, /smallest correct change/);
    assert.equal((system.match(/AIGate Token Saver/g) ?? []).length, 2);
    assert.equal(fake.headroomCalls.length, 1, "Headroom receives the request between RTK and prompt injection");
    assert.equal(textOf(fake.calls[0].messages.find((message) => message.role === "user")), "hello", "user text is retained unless explicitly opted in");
    await dash({ method: "PATCH", url: "/api/settings", body: { headroomCompressUserMessages: true } });
    await chat(body);
    assert.equal(textOf(fake.calls[1].messages.find((message) => message.role === "user")), "h", "explicit opt-in permits Headroom to compress user text");
    await chat(body, { "x-aigate-token-saver": "OFF" });
    assert.equal(fake.calls[2].messages.some((message) => message.role === "system"), false);
    assert.equal(fake.headroomCalls.length, 2, "opt-out bypasses Headroom too");
    await chat(body, { "x-9router-token-saver": "off" });
    assert.match(fake.calls[3].messages.filter((message) => message.role === "system").map(textOf).join("\n"), /Answer tersely/, "legacy 9router header does not control AIGate");
    await app.close();
  }));

test("RTK compresses repeated and structured tool output while preserving errors", () =>
  withTempDb(async (file) => {
    const fake = upstream();
    const { app, dash, chat } = await ready(file, fake);
    const content = Array.from({ length: 80 }, () => "same diagnostic output line").join("\n");
    await chat({ model: "openai/gpt-4o-mini", messages: [
      { role: "user", content: "run it" },
      { role: "assistant", content: null, tool_calls: [{ id: "t1", type: "function", function: { name: "run", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "t1", content },
    ] });
    assert.ok(textOf(fake.calls[0].messages.at(-1)).length < content.length);
    assert.equal(fake.calls[0].messages[0].content, "run it");

    const build = [...Array(80)].map((_, i) => `Compiling crate-${i} from registry package content`).join("\n")
      + "\nerror[E0425]: cannot find value `missing` in this scope\n  --> src/main.rs:8:4";
    await chat({ model: "openai/gpt-4o-mini", messages: [
      { role: "user", content: "build" },
      { role: "assistant", content: null, tool_calls: [{ id: "t2", type: "function", function: { name: "build", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "t2", content: build },
    ] });
    const buildResult = textOf(fake.calls[1].messages.at(-1));
    assert.ok(buildResult.length < build.length);
    assert.match(buildResult, /error\[E0425\]/);
    assert.doesNotMatch(buildResult, /Compiling crate-0/);

    const grep = Array.from({ length: 20 }, (_, i) => `src/feature.ts:${i + 1}: ${"matching result with useful source details ".repeat(2)}`).join("\n");
    await chat({ model: "openai/gpt-4o-mini", messages: [
      { role: "user", content: "search" },
      { role: "assistant", content: null, tool_calls: [{ id: "t3", type: "function", function: { name: "grep", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "t3", content: grep },
    ] });
    const grepResult = textOf(fake.calls[2].messages.at(-1));
    assert.ok(grepResult.length < grep.length);
    assert.match(grepResult, /20 matches in 1F/);
    assert.match(grepResult, /\+10/);
    await app.close();
  }));

test("Headroom failures fail open and RTK runs before Anthropic adapter serialization", () =>
  withTempDb(async (file) => {
    const calls = [];
    const repeated = Array.from({ length: 80 }, () => "same tool output line").join("\n");
    const fake = {
      calls,
      async send(request, ctx) {
        if (request.url.endsWith("/v1/compress")) return { status: 503, headers: {}, body: null };
        const body = JSON.parse(request.body);
        calls.push(body);
        return json(200, {
          id: "msg_saver", type: "message", model: "claude-sonnet-4-20250514", stop_reason: "end_turn",
          content: [{ type: "text", text: "ok" }], usage: { input_tokens: 1, output_tokens: 1 },
        })(request, ctx);
      },
    };
    const { app, dash, chat } = await ready(file, fake);
    await dash({ method: "POST", url: "/api/connections", body: { provider: "anthropic", apiKey: "sk-ant-saver-test-1234" } });
    await dash({ method: "PATCH", url: "/api/settings", body: { tokenSaverEnabled: true, rtkEnabled: true, headroomEnabled: true } });
    const response = await chat({
      model: "anthropic/claude-sonnet-4-20250514",
      messages: [
        { role: "user", content: "run command" },
        { role: "assistant", content: null, tool_calls: [{ id: "t1", type: "function", function: { name: "run", arguments: "{}" } }] },
        { role: "tool", tool_call_id: "t1", content: repeated },
      ],
    });
    assert.equal(response.statusCode, 200, "a Headroom 503 does not fail the request");
    const toolResult = calls[0].messages.flatMap((message) => Array.isArray(message.content) ? message.content : []).find((part) => part.type === "tool_result");
    assert.ok(toolResult);
    assert.ok(toolResult.content[0].text.length < repeated.length, "RTK rewrites the canonical tool result before Anthropic serialization");
    await app.close();
  }));
