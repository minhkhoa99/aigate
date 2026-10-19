// Contract: docs/contracts/skills.md, "Model-loaded skills" — hybrid selection: the gate preloads the best match, lists
// the rest behind the hidden aigate_load_skill tool, answers the model's calls itself and asks again; the client
// never sees the tool, gets the usage of every round, and targets that cannot take it get the lexical block.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTempDb } from "./helpers.mjs";
import { body, chunk, completion, frames, json, ready, sse } from "./lane-helpers.mjs";
import { UsageRecorder } from "../dist/modules/usage/infrastructure/usage-recorder.js";
import { withSkillRounds } from "../dist/modules/routing/infrastructure/skill-rounds.js";

const SQL = "# SQL rules\nAlways use parameterized queries. Never build SQL from strings. Index foreign keys.\n";
const REACT = "# React components\nUse functional components with hooks. Type every prop.\n";
const TESTING = "# Testing rules\nWrite a Vitest unit test for every component and hook.\n";
const ASK = "how do I avoid SQL injection with parameterized queries";
const TOOL = "aigate_load_skill";
const weather = [{ type: "function", function: { name: "get_weather", description: "Weather for a city", parameters: { type: "object", properties: { city: { type: "string" } } } } }];

// One queue of upstream answers; Headroom calls are answered apart.
function scripted() {
  const calls = [];
  const queue = [];
  const headroom = [];
  return {
    calls, queue, headroom,
    async send(request, ctx) {
      if (request.url.endsWith("/v1/compress")) {
        const sent = JSON.parse(request.body);
        headroom.push(sent);
        return json(200, { messages: sent.messages })(request, ctx);
      }
      calls.push({ request, ctx });
      const next = queue.shift();
      if (!next) throw new Error("unexpected upstream call");
      return next(request, ctx);
    },
  };
}
const raw = (call) => typeof call.request.body === "string" ? call.request.body : new TextDecoder().decode(call.request.body);
const load = (name, id = "call_s1") => [id, TOOL, { name }];
const toolCalls = (calls) => calls.map(([id, name, args]) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } }));
const toolTurn = (calls) => json(200, { id: "chatcmpl-t", model: "gpt-4.1", choices: [{ message: { content: null, tool_calls: toolCalls(calls) }, finish_reason: "tool_calls" }], usage: { prompt_tokens: 10, completion_tokens: 4 } });
const usageChunk = (prompt, completionTokens) => ({ id: "chatcmpl-s", model: "gpt-4.1", choices: [], usage: { prompt_tokens: prompt, completion_tokens: completionTokens } });
const toolStream = (calls) => sse([
  ...toolCalls(calls).map((call, index) => chunk({ tool_calls: [{ index, ...call }] })), chunk({}, { finish_reason: "tool_calls" }), usageChunk(10, 4), "[DONE]",
]);
const textStream = (text = "Hi") => sse([chunk({ content: text }), chunk({}, { finish_reason: "stop" }), usageChunk(3, 2), "[DONE]"]);

// Some client lanes ask the provider for a stream even when their client did not.
const either = (whole, streamed) => (request, ctx) => (JSON.parse(raw({ request })).stream ? streamed : whole)(request, ctx);

async function setup(file, settings = {}) {
  const upstream = scripted();
  const session = await ready(file, upstream);
  const add = async (name, description, content) => (await session.dash({ method: "POST", url: "/api/tooling/skills", body: { name, description, source: "file", content } })).json();
  const sql = await add("sql-rules", "SQL safety", SQL);
  const react = await add("react-ui", "React component rules", REACT);
  const testing = await add("testing-rules", "Unit tests", TESTING);
  const saved = await session.dash({ method: "PATCH", url: "/api/settings", body: { skillsAutoEnabled: true, ...settings } });
  assert.equal(saved.statusCode, 200, saved.body);
  const auth = { authorization: `Bearer ${session.key}` };
  const rows = async (limit) => { await session.app.get(UsageRecorder).flush(); return (await session.dash({ url: `/api/requests?limit=${limit}` })).json().items; };
  return { ...session, upstream, sql, react, testing, auth, rows };
}

// The four client protocols, each with its own conversation (a distinct first user text).
const clients = (auth, key) => ({
  chat: (text, extra = {}) => ({ method: "POST", url: "/v1/chat/completions", headers: auth, body: { model: "gpt-4.1", messages: [{ role: "user", content: text }], ...extra } }),
  messages: (text, extra = {}) => ({ method: "POST", url: "/v1/messages", headers: { "x-api-key": key }, body: { model: "gpt-4.1", max_tokens: 64, messages: [{ role: "user", content: text }], ...extra } }),
  responses: (text, extra = {}) => ({ method: "POST", url: "/v1/responses", headers: auth, body: { model: "gpt-4.1", input: text, ...extra } }),
  gemini: (text, extra = {}) => ({
    method: "POST", url: `/v1beta/models/openai/gpt-4.1:${extra.stream ? "streamGenerateContent?alt=sse" : "generateContent"}`, headers: auth,
    body: { contents: [{ role: "user", parts: [{ text }] }] },
  }),
});

test("hybrid, every client protocol: the model loads a listed skill through the hidden tool; the client sees one answer", () =>
  withTempDb(async (file) => {
    const { app, call, upstream, sql, react, auth, key, rows } = await setup(file);
    for (const [name, request] of Object.entries(clients(auth, key))) {
      upstream.queue.push(either(toolTurn([load("react-ui")]), toolStream([load("react-ui")])), either(json(200, completion), textStream("Hello!")));
      const before = upstream.calls.length;
      const res = await call(request(`${ASK} (${name})`));
      assert.equal(res.statusCode, 200, `${name}: ${res.body}`);
      assert.equal(upstream.calls.length, before + 2, `${name}: one extra round`);
      const [first, second] = upstream.calls.slice(before).map(raw);
      const tool = JSON.parse(first).tools.find((item) => item.function.name === TOOL);
      assert.deepEqual(tool.function.parameters.properties.name.enum.sort(), ["react-ui", "testing-rules"], `${name}: the preloaded match is not offered`);
      assert.ok(first.includes("Skills you can load") && first.includes("Always use parameterized queries") && !first.includes("Type every prop"), first);
      assert.ok(second.includes("Type every prop") && second.includes('"tool_call_id":"call_s1"'), `${name}: the skill goes back as the tool result`);
      assert.ok(!res.body.includes(TOOL) && res.body.includes("Hello!"), `${name}: ${res.body}`);
      // Some lanes (Messages, Responses) stream from the provider even for a whole answer; their header leaves with the
      // first chunk, before the extra round, so only an answer held whole lists the loaded skill.
      const held = JSON.parse(first).stream !== true;
      assert.equal(res.headers["x-aigate-skills"], held ? `${sql.id},${react.id}` : sql.id, `${name}: header`);
      if (name === "chat") {
        assert.deepEqual([res.json().choices[0].finish_reason, res.json().usage], ["stop", { prompt_tokens: 13, completion_tokens: 6, total_tokens: 19 }], "usage of both rounds");
      }
    }
    const items = await rows(4);
    assert.deepEqual(items.map((row) => row.skills), Array(4).fill(`${sql.id},${react.id}`));
    await app.close();
  }));

test("hybrid streams: one continuous stream per protocol, one terminal event, summed usage; the row has the loaded skill", () =>
  withTempDb(async (file) => {
    const { app, call, upstream, sql, react, auth, key, rows } = await setup(file);
    const terminal = { chat: /data: \[DONE\]/g, messages: /event: message_stop/g, responses: /event: response\.completed/g, gemini: /"finishReason"/g };
    for (const [name, request] of Object.entries(clients(auth, key))) {
      upstream.queue.push(toolStream([load("react-ui")]), textStream());
      const extra = name === "chat" ? { stream: true, stream_options: { include_usage: true } } : { stream: true };
      const res = await call(request(`${ASK} (stream ${name})`, extra));
      assert.equal(res.statusCode, 200, `${name}: ${res.body}`);
      assert.match(res.headers["content-type"], /text\/event-stream/);
      assert.equal(res.headers["x-aigate-skills"], sql.id, `${name}: a stream's header carries the preloaded skills only`);
      assert.ok(res.body.includes("Hi") && !res.body.includes(TOOL), `${name}: ${res.body}`);
      assert.equal(res.body.match(terminal[name])?.length, 1, `${name}: one terminal event`);
      assert.ok(raw(upstream.calls.at(-1)).includes("Type every prop"));
      if (name === "chat") {
        const out = frames(res.body);
        assert.deepEqual(out.filter((f) => f !== "[DONE]" && f.choices?.[0]?.finish_reason).map((f) => f.choices[0].finish_reason), ["stop"]);
        assert.ok(!out.some((f) => f !== "[DONE]" && f.choices?.[0]?.delta?.tool_calls));
        assert.deepEqual(out.find((f) => f !== "[DONE]" && f.usage)?.usage, { prompt_tokens: 13, completion_tokens: 6, total_tokens: 19 });
      }
      if (name === "messages") assert.ok(res.body.includes('"stop_reason":"end_turn"'), res.body);
    }
    assert.deepEqual((await rows(4)).map((row) => row.skills), Array(4).fill(`${sql.id},${react.id}`));
    await app.close();
  }));

test("hybrid with client tools: the client's calls of a loading turn are dropped, and its calls of the last turn reach it", () =>
  withTempDb(async (file) => {
    const { app, call, upstream, auth, key } = await setup(file);
    const { chat } = clients(auth, key);
    upstream.queue.push(toolTurn([load("react-ui"), ["call_w0", "get_weather", {}]]), toolTurn([["call_w1", "get_weather", { city: "Hanoi" }]]));
    let res = await call(chat(`${ASK} (tools)`, { tools: weather }));
    assert.equal(res.statusCode, 200, res.body);
    const message = res.json().choices[0];
    assert.deepEqual([message.finish_reason, message.message.tool_calls.map((item) => [item.id, item.function.name, item.function.arguments])], ["tool_calls", [["call_w1", "get_weather", '{"city":"Hanoi"}']]]);
    const turn = JSON.parse(raw(upstream.calls.at(-1))).messages.find((item) => item.role === "assistant");
    assert.deepEqual(turn.tool_calls.map((item) => item.function.name), [TOOL], "nothing ran get_weather, so the follow-up drops it");

    upstream.queue.push(toolStream([load("react-ui"), ["call_w0", "get_weather", {}]]), toolStream([["call_w1", "get_weather", { city: "Hanoi" }]]));
    res = await call(chat(`${ASK} (tools, stream)`, { tools: weather, stream: true }));
    const out = frames(res.body).filter((f) => f !== "[DONE]");
    const deltas = out.flatMap((f) => f.choices?.[0]?.delta?.tool_calls ?? []);
    assert.deepEqual(deltas.map((item) => [item.index, item.id, item.function?.name]), [[0, "call_w1", "get_weather"]], res.body);
    assert.deepEqual(out.filter((f) => f.choices?.[0]?.finish_reason).map((f) => f.choices[0].finish_reason), ["tool_calls"]);
    await app.close();
  }));

test("lexical fallback: forced tool choices, the lexical setting, a protocol without tool calls and fusion panels get no hidden tool", () =>
  withTempDb(async (file) => {
    const { app, call, dash, upstream, sql, auth, key } = await setup(file);
    const { chat } = clients(auth, key);
    const choices = ["none", "required", { type: "function", function: { name: "get_weather" } }];
    for (const [index, choice] of choices.entries()) {
      upstream.queue.push(json(200, completion));
      const res = await call(chat(`${ASK} (choice ${index})`, { tools: weather, tool_choice: choice }));
      assert.equal(res.statusCode, 200, res.body);
      const sent = raw(upstream.calls.at(-1));
      assert.ok(sent.includes("AIGate Skills") && sent.includes("parameterized") && !sent.includes(TOOL), JSON.stringify(choice));
      assert.equal(res.headers["x-aigate-skills"], sql.id);
    }

    const ndjson = (events) => (_request, ctx) => ({ status: 200, headers: { "content-type": "application/x-ndjson" }, body: body(events.map((e) => JSON.stringify(e)).join("\n") + "\n", ctx) });
    await dash({ method: "POST", url: "/api/connections", body: { provider: "commandcode", apiKey: "user_commandcode_skill_key" } });
    upstream.queue.push(ndjson([{ type: "start" }, { type: "text-delta", text: "ok" }, { type: "finish-step", finishReason: "stop", usage: { inputTokens: 1, outputTokens: 1 } }, { type: "finish" }]));
    let res = await call({ ...chat(`${ASK} (commandcode)`), body: { model: "commandcode/deepseek/deepseek-v4-pro", messages: [{ role: "user", content: `${ASK} (commandcode)` }] } });
    assert.equal(res.statusCode, 200, res.body);
    assert.ok(raw(upstream.calls.at(-1)).includes("parameterized") && !raw(upstream.calls.at(-1)).includes(TOOL), "an adapter outside the tool allowlist");

    await dash({ method: "POST", url: "/api/combos", body: { name: "fuse", models: ["openai/m1", "openai/m2"], strategy: "fusion" } });
    upstream.queue.push(json(200, completion), json(200, completion), json(200, completion));
    const before = upstream.calls.length;
    res = await call({ ...chat(ASK), body: { model: "fuse", messages: [{ role: "user", content: `${ASK} (fusion)` }] } });
    assert.equal(res.statusCode, 200, res.body);
    const panel = upstream.calls.slice(before, before + 2).map((item) => JSON.parse(raw(item)));
    for (const sent of panel) assert.deepEqual(["tools" in sent, JSON.stringify(sent).includes("parameterized")], [false, true], "a panel member gets the lexical block");

    await dash({ method: "PATCH", url: "/api/settings", body: { skillsSelection: "lexical" } });
    upstream.queue.push(json(200, completion));
    res = await call(chat(`${ASK} (lexical)`));
    assert.ok(!raw(upstream.calls.at(-1)).includes(TOOL) && raw(upstream.calls.at(-1)).includes("parameterized"), "the lexical setting");
    await app.close();
  }));

test("hybrid limits: two extra rounds, the per-request skill maximum, unknown names; the next turn preloads what was loaded", () =>
  withTempDb(async (file) => {
    const { app, call, upstream, sql, react, auth, key } = await setup(file);
    const { chat } = clients(auth, key);
    upstream.queue.push(toolTurn([load("react-ui")]), toolTurn([load("testing-rules", "call_s2")]), toolTurn([load("react-ui", "call_s3")]));
    let res = await call(chat(`${ASK} (limits)`));
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(upstream.calls.length, 3, "at most two extra rounds");
    assert.deepEqual([res.json().choices[0].finish_reason, res.json().choices[0].message.tool_calls], ["stop", undefined], "a last turn that only called the tool ends normally");
    assert.ok(raw(upstream.calls[2]).includes("The skill limit for this request is reached") && !raw(upstream.calls[2]).includes("Vitest"), "skillsMaxSelected caps preloaded plus loaded");

    upstream.queue.push(toolTurn([load("nope")]), json(200, completion));
    await call(chat(`${ASK} (unknown)`));
    assert.ok(raw(upstream.calls.at(-1)).includes('No skill named \\"nope\\"'), raw(upstream.calls.at(-1)));

    // The client resends the first conversation; react-ui is preloaded, so the maximum is reached and no tool is offered.
    upstream.queue.push(json(200, completion));
    res = await call({ ...chat(""), body: { model: "gpt-4.1", messages: [
      { role: "user", content: `${ASK} (limits)` }, { role: "assistant", content: "Use bind parameters." }, { role: "user", content: "and in React forms?" },
    ] } });
    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual(res.headers["x-aigate-skills"].split(",").sort(), [sql.id, react.id].sort());
    assert.ok(raw(upstream.calls.at(-1)).includes("Type every prop") && !raw(upstream.calls.at(-1)).includes(TOOL));
    assert.equal(upstream.queue.length, 0);
    await app.close();
  }));

test("hybrid runs after Token Saver, so Headroom still compresses a request whose client sent no tools", () =>
  withTempDb(async (file) => {
    const { app, call, upstream, auth, key } = await setup(file, { tokenSaverEnabled: true, headroomEnabled: true });
    upstream.queue.push(json(200, completion));
    const res = await call(clients(auth, key).chat(`${ASK} (headroom)`));
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(upstream.headroom.length, 1);
    assert.ok(!JSON.stringify(upstream.headroom[0]).includes("AIGate Skills"), "Headroom sees the client's messages, not the skills");
    assert.ok(raw(upstream.calls.at(-1)).includes(TOOL));
    await app.close();
  }));

// The decorator alone: stream merging, renumbered client calls, fail-open answers and the lexical block.
test("withSkillRounds: merges rounds into one stream, renumbers the client's calls, and fails open", async () => {
  const session = () => ({
    text: "q", key: null, plan: {}, share: 100, loaded: new Set(),
    lexical: { block: "LEXICAL BLOCK", ids: ["l"] }, hybrid: { block: "HYBRID BLOCK", ids: ["h"], preloaded: [], names: ["x"], remaining: 1 },
  });
  const failing = { answer: async () => { throw new Error("index broken"); } };
  const adapter = (rounds, requests) => ({
    getModels: async () => [], validateCredential: async () => ({ ok: true }),
    execute: async (request) => { requests.push(request); return rounds.shift(); },
    async *stream(request) { requests.push(request); yield* rounds.shift(); },
  });
  const request = { model: "m", messages: [{ role: "user", content: [{ type: "text", text: "q" }] }] };
  const requests = [];
  const applied = [];
  const port = withSkillRounds(adapter([
    [{ type: "start" }, { type: "text_delta", text: "A" }, { type: "tool_call_delta", index: 0, id: "s", name: TOOL, argumentsDelta: '{"name":"x"}' },
      { type: "tool_call_delta", index: 1, id: "c1", name: "get_weather", argumentsDelta: "{}" }, { type: "usage", usage: { inputTokens: 1, outputTokens: 1 } }, { type: "stop", stopReason: "tool_use" }],
    [{ type: "start" }, { type: "text_delta", text: "B" }, { type: "tool_call_delta", index: 3, id: "w", name: "get_weather", argumentsDelta: "{}" },
      { type: "usage", usage: { inputTokens: 2, outputTokens: 3, cacheReadTokens: 1 } }, { type: "stop", stopReason: "tool_use" }],
  ], requests), failing, session(), true, (ids) => applied.push(ids));
  const out = [];
  for await (const item of port.stream(request, {}, {})) out.push(item);
  assert.deepEqual(out, [
    { type: "start" }, { type: "text_delta", text: "A" }, { type: "text_delta", text: "B" },
    { type: "tool_call_delta", index: 0, id: "w", name: "get_weather", argumentsDelta: "{}" },
    { type: "usage", usage: { inputTokens: 3, outputTokens: 4, cacheReadTokens: 1 } }, { type: "stop", stopReason: "tool_use" },
  ]);
  assert.equal(requests[0].tools.at(-1).name, TOOL);
  assert.ok(JSON.stringify(requests[0].system).includes("HYBRID BLOCK"));
  const followUp = requests[1].messages.slice(-2);
  assert.deepEqual(followUp.map((message) => message.role), ["assistant", "tool"]);
  assert.deepEqual(followUp[0].content.map((part) => part.type === "tool_call" ? part.name : part.text), ["A", TOOL], "the dropped client call is not replayed");
  assert.match(followUp[1].content[0].content[0].text, /could not be loaded/);
  assert.deepEqual(applied.at(-1), ["h"]);

  const lexical = [];
  const plain = withSkillRounds(adapter([{ content: [{ type: "text", text: "ok" }], stopReason: "end_turn", usage: { inputTokens: 1, outputTokens: 1 } }], lexical), failing, session(), false, () => {});
  assert.equal((await plain.execute(request, {}, {})).content[0].text, "ok");
  assert.deepEqual(["tools" in lexical[0], JSON.stringify(lexical[0].system).includes("LEXICAL BLOCK")], [false, true], "a target without tool calls gets the lexical block");
});
