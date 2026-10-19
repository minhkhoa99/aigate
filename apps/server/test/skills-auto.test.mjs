// Contract: docs/contracts/skills.md, "Automatic skills" — the lexical skill graph, link caching, preview, and the
// /v1 lane adding chosen skills for every client protocol and provider.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { withTempDb } from "./helpers.mjs";
import { completion, json, ready, sse, chunk } from "./lane-helpers.mjs";
import {
  buildDocument, buildGraph, choose, excerpt, injectSkills, queryText, renderSkills, score, SKILLS_SEPARATOR, tokenize,
} from "../dist/modules/skills/domain/skill-graph.js";
import { rawSkillUrl } from "../dist/modules/skills/domain/skill.js";

const REACT = "---\nname: react-ui\ndescription: React component rules\ntags: [frontend, jsx]\nrelated: testing-rules\n---\n# React components\nUse functional components with hooks. Type every prop.\n## Styling\nUse CSS modules, never inline styles.\n";
const SQL = "# SQL rules\nAlways use parameterized queries. Never build SQL from strings. Index foreign keys.\n";
const TESTING = "# Testing rules\nWrite a Vitest unit test for every component and hook.\n";
const GITHUB_RAW = "https://raw.githubusercontent.com/acme/skills/main/CLAUDE.md";
const GUIDELINES = "# Guidelines\nThink before coding.\n";

// One transport for the upstream provider and for link fetches: a URL in `pages` or on docs.example.com is a document
// (404 when missing); every other URL is the provider, answered with SSE for a streamed request and JSON otherwise.
function mixed(pages = {}) {
  const calls = [];
  return {
    calls,
    async send(request, ctx) {
      if (request.url in pages || request.url.startsWith("https://docs.example.com/")) {
        const page = pages[request.url];
        if (page instanceof Error) throw page;
        if (!page) return { status: 404, headers: {}, body: null };
        return { status: page.status ?? 200, headers: { "content-type": page.type ?? "text/plain" }, body: new Response(page.text).body };
      }
      calls.push({ request, ctx });
      const streamed = JSON.parse(sent({ request })).stream === true;
      return (streamed ? sse([chunk({ content: "Hi" }), chunk({}, { finish_reason: "stop" }), "[DONE]"]) : json(200, completion))(request, ctx);
    },
  };
}
const sent = (call) => typeof call.request.body === "string" ? call.request.body : new TextDecoder().decode(call.request.body);
const doc = (id, name, description, content) => ({ id, name, description, document: buildDocument(name, description, content) });

test("skill graph: folded tokens, field boosts, related edges, BM25 choice, budgeted excerpts and framing", () => {
  assert.deepEqual(tokenize("Lập trình React"), ["lap", "trinh", "react", "lap trinh", "trinh react"]);
  assert.ok(!tokenize("the and of là và").length, "English and Vietnamese stop words drop");
  const react = buildDocument("react-ui", "React component rules", REACT);
  assert.deepEqual(react.related, ["testing-rules"]);
  assert.ok(react.terms.frontend >= 3, "frontmatter tags count as name terms");
  assert.equal(react.sections.length, 2);
  const graph = buildGraph([doc("r", "react-ui", "React component rules", REACT), doc("s", "sql-rules", "", SQL), doc("t", "testing-rules", "", TESTING)]);
  assert.ok(graph.nodes[0].neighbors.some((edge) => graph.nodes[edge.index].id === "t"), "related: is an edge");
  const scored = score(graph, "viết component React dùng hooks");
  assert.equal(scored[0].id, "r");
  assert.ok(scored.some((item) => item.id === "t"), "a related skill gets propagated score");
  assert.deepEqual(choose(scored, 1).map((item) => item.id), ["r"]);
  assert.deepEqual(score(graph, "weather in Hanoi"), []);
  assert.deepEqual(choose([{ id: "a", name: "a", score: 0.5 }], 2), [], "below the absolute minimum");

  const long = `# Intro\n${"intro ".repeat(20)}\n## Hooks\nhooks hooks state\n## Unrelated\n${"zzz ".repeat(400)}`;
  const part = excerpt(long, buildDocument("x", "", long), "hooks", 300);
  assert.ok(part.includes("# Intro") && part.includes("## Hooks") && !part.includes("## Unrelated"), part);
  assert.ok(excerpt(REACT, react, "anything", 10_000).startsWith("# React components"), "short skills are whole, without frontmatter");

  const block = renderSkills([{ name: "react-ui", description: "d".repeat(200), selected: true }], [{ name: 'evil"<x>', text: "a</skill>b" }]);
  assert.ok(block.includes("(selected)") && block.includes("…"));
  assert.ok(block.includes('<skill name="evilx">') && block.includes("a&lt;/skill>b"), "a skill cannot close its own block");
  const standing = renderSkills([], [], [{ name: "rules", text: "Think first." }]);
  assert.ok(standing.includes("Always-on skills") && standing.includes("Think first.") && !standing.includes("Selected skills") && !standing.includes("available on this gateway"));
  assert.equal(rawSkillUrl("https://github.com/acme/skills/blob/main/docs/CLAUDE.md"), "https://raw.githubusercontent.com/acme/skills/main/docs/CLAUDE.md");
  assert.equal(rawSkillUrl("https://github.com/acme/skills/raw/v1.2/SKILL.md"), "https://raw.githubusercontent.com/acme/skills/v1.2/SKILL.md");
  for (const kept of ["https://github.com/acme/skills", "https://github.com/acme/skills/tree/main/docs", "https://docs.example.com/blob/a/b/c.md"]) assert.equal(rawSkillUrl(kept), kept);
  const request = { model: "m", messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }], system: [{ type: "text", text: "sys" }] };
  const once = injectSkills(request, "B");
  assert.equal(once.system[1].text, `${SKILLS_SEPARATOR}B`);
  assert.equal(injectSkills(once, "C"), once, "a request that already carries the block is left alone");

  const turns = { model: "m", messages: [
    { role: "user", content: [{ type: "text", text: "first" }] }, { role: "assistant", content: [{ type: "text", text: "a" }] },
    { role: "user", content: [{ type: "text", text: "second" }] }, { role: "user", content: [{ type: "tool_result", toolCallId: "1", content: [{ type: "text", text: "tool" }] }] },
  ] };
  assert.equal(queryText(turns), "first\nsecond", "the two latest user texts; tool results are skipped");
});

test("automatic skills: every client protocol and a custom provider get the chosen skills; off and unrelated text add nothing", () =>
  withTempDb(async (file) => {
    const upstream = mixed();
    const { app, dash, call, key } = await ready(file, upstream);
    const add = async (body) => (await dash({ method: "POST", url: "/api/tooling/skills", body })).json();
    const react = await add({ name: "react-ui", description: "React component rules", source: "file", content: REACT });
    await add({ name: "sql-rules", description: "SQL safety", source: "file", content: SQL });
    await add({ name: "legacy-react", description: "Old React class components", source: "file", content: "# React classes\nUse React class components with hooks.", mode: "off" });
    const auth = { authorization: `Bearer ${key}` };
    const ask = "Viết component React dùng hooks";

    let res = await call({ method: "POST", url: "/v1/chat/completions", headers: auth, body: { model: "gpt-4.1", messages: [{ role: "user", content: ask }] } });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["x-aigate-skills"], undefined, "off by default");
    assert.ok(!sent(upstream.calls.at(-1)).includes("AIGate Skills"));

    // Lexical selection here; skills-tool.test.mjs covers hybrid, the default.
    assert.equal((await dash({ method: "PATCH", url: "/api/settings", body: { skillsAutoEnabled: true, skillsSelection: "lexical" } })).statusCode, 200);
    res = await call({ method: "POST", url: "/v1/chat/completions", headers: auth, body: { model: "gpt-4.1", messages: [{ role: "system", content: "Be brief." }, { role: "user", content: ask }] } });
    assert.equal(res.headers["x-aigate-skills"], react.id);
    let body = sent(upstream.calls.at(-1));
    assert.ok(body.includes("AIGate Skills") && body.includes("Type every prop") && body.includes("sql-rules — SQL safety"), body);
    assert.ok(body.indexOf("Be brief.") < body.indexOf("AIGate Skills"), "appended after the client's own system text");
    assert.ok(!body.includes("legacy-react"), "mode off keeps a skill out of selection and the catalog");

    const off = await call({ method: "POST", url: "/v1/chat/completions", headers: { ...auth, "x-aigate-skills": "OFF" }, body: { model: "gpt-4.1", messages: [{ role: "user", content: ask }] } });
    assert.equal(off.headers["x-aigate-skills"], undefined);
    assert.ok(!sent(upstream.calls.at(-1)).includes("AIGate Skills"), "x-aigate-skills: off skips selection");
    await call({ method: "POST", url: "/v1/chat/completions", headers: auth, body: { model: "gpt-4.1", messages: [{ role: "user", content: "What is the weather in Hanoi?" }] } });
    assert.ok(!sent(upstream.calls.at(-1)).includes("AIGate Skills"), "nothing relevant, nothing added");

    res = await call({ method: "POST", url: "/v1/messages", headers: { "x-api-key": key }, body: { model: "gpt-4.1", max_tokens: 64, messages: [{ role: "user", content: ask }] } });
    assert.equal(res.statusCode, 200, res.body);
    assert.ok(sent(upstream.calls.at(-1)).includes("Type every prop"), "Anthropic Messages client");
    res = await call({ method: "POST", url: "/v1/responses", headers: auth, body: { model: "gpt-4.1", input: ask } });
    assert.equal(res.statusCode, 200, res.body);
    assert.ok(sent(upstream.calls.at(-1)).includes("Type every prop"), "Responses client");
    res = await call({ method: "POST", url: "/v1beta/models/openai/gpt-4.1:generateContent", headers: auth, body: { contents: [{ role: "user", parts: [{ text: ask }] }] } });
    assert.equal(res.statusCode, 200, res.body);
    assert.ok(sent(upstream.calls.at(-1)).includes("Type every prop"), "Gemini client");

    res = await call({ method: "POST", url: "/v1/chat/completions", headers: auth, body: { model: "gpt-4.1", stream: true, messages: [{ role: "user", content: ask }] } });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["x-aigate-skills"], react.id, "the header also reaches a streamed reply");
    assert.match(res.headers["content-type"], /text\/event-stream/);

    const node = (await dash({ method: "POST", url: "/api/provider-nodes", body: { name: "Local", prefix: "local", baseUrl: "https://llm.example.com/v1" } })).json();
    await dash({ method: "POST", url: "/api/connections", body: { provider: node.id, apiKey: "sk-node-key-1234" } });
    res = await call({ method: "POST", url: "/v1/chat/completions", headers: auth, body: { model: "local/llama-3", messages: [{ role: "user", content: ask }] } });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(upstream.calls.at(-1).request.url, "https://llm.example.com/v1/chat/completions");
    assert.ok(sent(upstream.calls.at(-1)).includes("Type every prop"), "custom provider");

    const rules = await add({ name: "house-rules", description: "Coding guidelines", source: "file", content: "# Guidelines\nThink before coding. Keep changes surgical.\n", mode: "always" });
    res = await call({ method: "POST", url: "/v1/chat/completions", headers: auth, body: { model: "gpt-4.1", messages: [{ role: "user", content: "What is the weather in Hanoi?" }] } });
    assert.equal(res.headers["x-aigate-skills"], rules.id, "an always-on skill needs no match");
    body = sent(upstream.calls.at(-1));
    assert.ok(body.includes("Always-on skills") && body.includes("Keep changes surgical") && !body.includes("available on this gateway"), body);
    res = await call({ method: "POST", url: "/v1/messages", headers: { "x-api-key": key }, body: { model: "gpt-4.1", max_tokens: 64, messages: [{ role: "user", content: ask }] } });
    assert.equal(res.headers["x-aigate-skills"], `${rules.id},${react.id}`, "always-on first, then the match, outside the per-request maximum");
    body = sent(upstream.calls.at(-1));
    assert.ok(body.indexOf("Keep changes surgical") < body.indexOf("Type every prop"), body);
    await call({ method: "POST", url: "/v1/chat/completions", headers: { ...auth, "x-aigate-skills": "off" }, body: { model: "gpt-4.1", messages: [{ role: "user", content: "hello" }] } });
    assert.ok(!sent(upstream.calls.at(-1)).includes("AIGate Skills"), "the opt-out header also skips always-on skills");
    await dash({ method: "PATCH", url: "/api/settings", body: { skillsAutoEnabled: false } });
    await call({ method: "POST", url: "/v1/chat/completions", headers: auth, body: { model: "gpt-4.1", messages: [{ role: "user", content: "hello" }] } });
    assert.ok(!sent(upstream.calls.at(-1)).includes("AIGate Skills"), "the global switch also covers always-on skills");
    await app.close();
  }));

test("link skills: fetched and cached on save, refreshed on demand, failures recorded; preview scores without a vendor call", () =>
  withTempDb(async (file) => {
    const pages = {
      "https://docs.example.com/sql.md": { text: SQL },
      "https://docs.example.com/page.html": { text: "<html></html>", type: "text/html" },
      "https://docs.example.com/sniff.md": { text: "\n<!DOCTYPE html>\n<html lang=\"en\"></html>", type: "text/plain" },
      [GITHUB_RAW]: { text: GUIDELINES },
      "https://docs.example.com/app.bin": { text: "x", type: "application/zip" },
      "https://docs.example.com/big.md": { text: "a".repeat(262_145) },
    };
    const upstream = mixed(pages);
    const { app, dash } = await ready(file, upstream);
    const add = (body) => dash({ method: "POST", url: "/api/tooling/skills", body });
    const sql = (await add({ name: "sql-rules", source: "link", url: "https://docs.example.com/sql.md" })).json();
    assert.deepEqual([sql.content, sql.bytes, sql.fetchError, typeof sql.fetchedAt], [SQL, Buffer.byteLength(SQL), null, "string"]);
    const listed = (await dash({ url: "/api/tooling/skills" })).json()[0];
    assert.deepEqual([listed.bytes, listed.mode, listed.fetchError, "content" in listed], [Buffer.byteLength(SQL), "auto", null, false]);

    for (const [url, pattern] of [["https://docs.example.com/missing.md", /HTTP 404/], ["https://docs.example.com/app.bin", /application\/zip/], ["https://docs.example.com/big.md", /256 KiB/],
      ["https://docs.example.com/page.html", /HTML web page/], ["https://docs.example.com/sniff.md", /HTML web page/]]) {
      const bad = (await add({ name: url, source: "link", url })).json();
      assert.equal(bad.content, null);
      assert.match(bad.fetchError, pattern, url);
    }
    const github = (await add({ name: "guidelines", source: "link", url: "https://github.com/acme/skills/blob/main/CLAUDE.md?plain=1" })).json();
    assert.deepEqual([github.url, github.content], [GITHUB_RAW, GUIDELINES], "a GitHub blob link is stored and fetched as its raw file");
    // A link saved before the rewrite still points at the page; Refresh moves it to the raw file and drops the old copy.
    const legacy = new DatabaseSync(file);
    try { legacy.prepare("UPDATE skills SET url = ? WHERE id = ?").run("https://github.com/acme/skills/blob/main/CLAUDE.md", github.id); } finally { legacy.close(); }
    const rewritten = await dash({ method: "POST", url: `/api/tooling/skills/${github.id}/refresh` });
    assert.deepEqual([rewritten.statusCode, rewritten.json().url, rewritten.json().content], [200, GITHUB_RAW, GUIDELINES]);

    const preview = await dash({ method: "POST", url: "/api/tooling/skills/preview", body: { text: "how do I avoid SQL injection with parameterized queries" } });
    assert.equal(preview.statusCode, 200);
    assert.deepEqual(preview.json().selected.map((item) => item.id), [sql.id]);
    assert.ok(preview.json().block.includes("parameterized queries") && preview.json().chars === preview.json().block.length);
    const { selection, hybrid } = preview.json();
    assert.deepEqual([selection, hybrid.preloaded.map((item) => item.id), hybrid.loadable.includes("sql-rules")], ["hybrid", [sql.id], false], "hybrid preloads the best match and offers the rest");
    assert.ok(hybrid.loadable.includes("guidelines") && hybrid.block.includes("aigate_load_skill") && hybrid.chars === hybrid.block.length, hybrid.block);
    assert.equal((await dash({ method: "POST", url: "/api/tooling/skills/preview", body: { text: "" } })).statusCode, 400);
    assert.equal(upstream.calls.length, 0, "no vendor call");

    pages["https://docs.example.com/sql.md"] = { text: "# SQL v2\nUse bind variables.\n" };
    const refreshed = await dash({ method: "POST", url: `/api/tooling/skills/${sql.id}/refresh` });
    assert.equal(refreshed.statusCode, 200);
    assert.equal(refreshed.json().content, "# SQL v2\nUse bind variables.\n");
    assert.deepEqual((await dash({ method: "POST", url: "/api/tooling/skills/preview", body: { text: "bind variables" } })).json().selected.map((item) => item.id), [sql.id], "the graph follows the refreshed copy");
    pages["https://docs.example.com/sql.md"] = new Error("network down");
    const failed = await dash({ method: "POST", url: `/api/tooling/skills/${sql.id}/refresh` });
    assert.deepEqual([failed.statusCode, failed.json().code], [502, "SKILL_FETCH_FAILED"]);
    const kept = (await dash({ url: `/api/tooling/skills/${sql.id}` })).json();
    assert.deepEqual([kept.content, typeof kept.fetchError], ["# SQL v2\nUse bind variables.\n", "string"], "a failed refresh keeps the previous copy");

    const moved = (await dash({ method: "PATCH", url: `/api/tooling/skills/${sql.id}`, body: { url: "https://docs.example.com/missing.md" } })).json();
    assert.deepEqual([moved.content, /HTTP 404/.test(moved.fetchError)], [null, true], "a new URL drops the old copy and fetches again");

    const fileSkill = (await add({ name: "local", source: "file", content: "# Local" })).json();
    assert.equal((await dash({ method: "POST", url: `/api/tooling/skills/${fileSkill.id}/refresh` })).statusCode, 400);
    assert.equal((await dash({ method: "PATCH", url: `/api/tooling/skills/${fileSkill.id}`, body: { mode: "sometimes" } })).statusCode, 400);
    assert.equal((await dash({ method: "PATCH", url: `/api/tooling/skills/${fileSkill.id}`, body: { auto: false } })).statusCode, 400, "the 0027 field is gone");
    assert.equal((await dash({ method: "PATCH", url: `/api/tooling/skills/${fileSkill.id}`, body: { mode: "off" } })).json().mode, "off");
    for (const n of [1, 2, 3]) assert.equal((await add({ name: `always-${n}`, source: "file", content: `# Always ${n}\nRule ${n}.`, mode: "always" })).statusCode, 201);
    const fourth = await add({ name: "always-4", source: "file", content: "# Always 4", mode: "always" });
    assert.deepEqual([fourth.statusCode, fourth.json().code], [409, "SKILL_ALWAYS_LIMIT"]);
    const promoted = await dash({ method: "PATCH", url: `/api/tooling/skills/${fileSkill.id}`, body: { mode: "always" } });
    assert.deepEqual([promoted.statusCode, promoted.json().code], [409, "SKILL_ALWAYS_LIMIT"]);
    const standing = (await dash({ method: "POST", url: "/api/tooling/skills/preview", body: { text: "weather" } })).json();
    assert.deepEqual([standing.always.map((item) => item.name), standing.selected], [["always-1", "always-2", "always-3"], []]);
    assert.ok(standing.block.includes("Always-on skills") && standing.block.includes("Rule 3."), standing.block);
    for (const body of [{ skillsMaxSelected: 0 }, { skillsMaxSelected: 6 }, { skillsBudgetChars: 999 }, { skillsBudgetChars: 32_001 }, { skillsCatalogEnabled: "yes" }, { skillsSelection: "model" }]) {
      assert.equal((await dash({ method: "PATCH", url: "/api/settings", body })).statusCode, 400, JSON.stringify(body));
    }
    await app.close();
  }));
