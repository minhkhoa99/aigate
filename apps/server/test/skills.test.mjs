// Contract: docs/contracts/skills.md — the persisted skill registry and the key-gated SKILL.md route.
import { test } from "node:test";
import assert from "node:assert/strict";
import { boot, setUp, withTempDb } from "./helpers.mjs";

const markdown = "---\nname: deploy\ndescription: Ship it\n---\n# Deploy\nRun `pnpm build`. Tiếng Việt.\n";

// Link fetches answer from this map; anything else is a 404, so no request leaves the machine.
export function linkTransport(pages = {}) {
  const calls = [];
  return {
    calls,
    async send(request) {
      calls.push(request);
      const page = pages[request.url];
      if (page instanceof Error) throw page;
      if (!page) return { status: 404, headers: {}, body: null };
      return { status: page.status ?? 200, headers: { "content-type": page.type ?? "text/markdown; charset=utf-8" }, body: new Response(page.text).body };
    },
  };
}

async function ready(file, transport = linkTransport()) {
  const { app, call } = await boot(file, { transport });
  const cookie = await setUp(call);
  const dash = (request) => call({ ...request, cookie });
  const { id: keyId, key } = (await dash({ method: "POST", url: "/api/keys", body: { name: "agent" } })).json();
  const skills = {
    list: () => dash({ url: "/api/tooling/skills" }),
    get: (id) => dash({ url: `/api/tooling/skills/${id}` }),
    create: (body) => dash({ method: "POST", url: "/api/tooling/skills", body }),
    update: (id, body) => dash({ method: "PATCH", url: `/api/tooling/skills/${id}`, body }),
    remove: (id) => dash({ method: "DELETE", url: `/api/tooling/skills/${id}` }),
  };
  const fetchFile = (id, headers = {}) => call({ url: `/v1/skills/${id}/SKILL.md`, headers });
  return { app, call, dash, key, keyId, skills, fetchFile };
}

test("skills: link and file CRUD, the list omits content, names are unique ignoring case", () =>
  withTempDb(async (file) => {
    const { app, call, skills } = await ready(file);
    assert.equal((await call({ url: "/api/tooling/skills" })).statusCode, 401, "behind the dashboard session");
    assert.deepEqual((await skills.list()).json(), []);

    const link = await skills.create({ name: "Docs", description: " Team docs ", source: "link", url: "https://example.com/skills/docs/SKILL.md?ref=main" });
    assert.equal(link.statusCode, 201);
    assert.deepEqual([link.json().source, link.json().url, link.json().content, link.json().description, link.json().enabled, link.json().bytes], ["link", "https://example.com/skills/docs/SKILL.md?ref=main", null, "Team docs", true, 0]);

    const uploaded = await skills.create({ name: "deploy", source: "file", content: markdown });
    assert.equal(uploaded.statusCode, 201);
    const fileSkill = uploaded.json();
    assert.deepEqual([fileSkill.source, fileSkill.url, fileSkill.content, fileSkill.bytes], ["file", null, markdown, Buffer.byteLength(markdown)]);

    const listed = await skills.list();
    assert.equal(listed.headers["cache-control"], "no-store");
    assert.deepEqual(listed.json().map((row) => [row.name, row.source, row.bytes, "content" in row]), [["Docs", "link", 0, false], ["deploy", "file", Buffer.byteLength(markdown), false]]);
    assert.equal((await skills.get(fileSkill.id)).json().content, markdown, "the detail carries content");

    const duplicate = await skills.create({ name: "DOCS", source: "link", url: "https://example.com/other.md" });
    assert.deepEqual([duplicate.statusCode, duplicate.json().code], [409, "SKILL_EXISTS"]);
    const renameClash = await skills.update(fileSkill.id, { name: "docs" });
    assert.deepEqual([renameClash.statusCode, renameClash.json().code], [409, "SKILL_EXISTS"]);

    const edited = await skills.update(fileSkill.id, { name: "Deploy v2", content: "# v2\n", enabled: false });
    assert.equal(edited.statusCode, 200);
    assert.deepEqual([edited.json().name, edited.json().content, edited.json().enabled], ["Deploy v2", "# v2\n", false]);
    assert.ok(Date.parse(edited.json().updatedAt) >= Date.parse(fileSkill.updatedAt));
    assert.equal((await skills.update(link.json().id, { url: "https://example.com/new.md" })).json().url, "https://example.com/new.md");

    assert.equal((await skills.remove(link.json().id)).statusCode, 204);
    assert.equal((await skills.remove(link.json().id)).statusCode, 404);
    assert.equal((await skills.get(link.json().id)).statusCode, 404);
    assert.equal((await skills.update(link.json().id, { name: "x" })).statusCode, 404);
    assert.deepEqual((await skills.list()).json().map((row) => row.name), ["Deploy v2"]);
    await app.close();
  }));

test("skills: invalid input is 400 INVALID_REQUEST and the source cannot change", () =>
  withTempDb(async (file) => {
    const { app, skills } = await ready(file);
    const big = "a".repeat(262_145);
    const bad = [
      {},
      { name: "", source: "link", url: "https://example.com/a.md" },
      { name: "x".repeat(65), source: "link", url: "https://example.com/a.md" },
      { name: "n", description: "d".repeat(281), source: "link", url: "https://example.com/a.md" },
      { name: "n", source: "git", url: "https://example.com/a.md" },
      { name: "n", source: "link", url: "http://example.com/a.md" },
      { name: "n", source: "link", url: "https://user:pass@example.com/a.md" },
      { name: "n", source: "link", url: "https://example.com/a.md#top" },
      { name: "n", source: "link", url: "ftp://example.com/a.md" },
      { name: "n", source: "link", url: "https://example.com/a.md", content: "# x" },
      { name: "n", source: "file", content: "   " },
      { name: "n", source: "file", content: big },
      { name: "n", source: "file", content: "a\u0000b" },
      { name: "n", source: "file", content: "# x", url: "https://example.com/a.md" },
    ];
    for (const body of bad) {
      const res = await skills.create(body);
      assert.deepEqual([res.statusCode, res.json().code], [400, "INVALID_REQUEST"], JSON.stringify(body).slice(0, 120));
    }
    assert.equal((await skills.create({ name: "local", source: "link", url: "http://localhost:3000/SKILL.md" })).statusCode, 201, "HTTP is allowed for localhost");
    const atLimit = await skills.create({ name: "max", source: "file", content: "é".repeat(131_072) });
    assert.equal(atLimit.statusCode, 201, "256 KiB of UTF-8 is accepted");
    assert.equal(atLimit.json().bytes, 262_144);

    const linkId = (await skills.list()).json()[0].id;
    for (const body of [{}, { source: "file" }, { content: "# x" }, { enabled: "yes" }, { other: 1 }, { name: "" }]) {
      const res = await skills.update(linkId, body);
      assert.deepEqual([res.statusCode, res.json().code], [400, "INVALID_REQUEST"], JSON.stringify(body));
    }
    assert.deepEqual([(await skills.update(atLimit.json().id, { url: "https://example.com/a.md" })).statusCode], [400], "a file skill has no url");
    await app.close();
  }));

test("skills: at most 200 can be saved", () =>
  withTempDb(async (file) => {
    const { app, skills } = await ready(file);
    for (let i = 0; i < 200; i += 1) assert.equal((await skills.create({ name: `s${i}`, source: "link", url: `https://example.com/${i}.md` })).statusCode, 201);
    const over = await skills.create({ name: "one-more", source: "link", url: "https://example.com/x.md" });
    assert.deepEqual([over.statusCode, over.json().code], [409, "SKILL_LIMIT"]);
    assert.equal((await skills.list()).json().length, 200);
    await app.close();
  }));

test("SKILL.md route: an active API key is always required; only enabled file skills are served", () =>
  withTempDb(async (file) => {
    const { app, dash, key, keyId, skills, fetchFile } = await ready(file);
    const fileSkill = (await skills.create({ name: "deploy", source: "file", content: markdown })).json();
    const linkSkill = (await skills.create({ name: "docs", source: "link", url: "https://example.com/SKILL.md" })).json();

    const missing = await fetchFile(fileSkill.id);
    assert.deepEqual([missing.statusCode, missing.json().code], [401, "MISSING_API_KEY"], "keyless mode does not open this route");
    assert.match(missing.headers["content-type"], /application\/json/);
    const wrong = await fetchFile(fileSkill.id, { authorization: "Bearer aigate_" + "x".repeat(43) });
    assert.deepEqual([wrong.statusCode, wrong.json().code], [401, "INVALID_API_KEY"]);

    const ok = await fetchFile(fileSkill.id, { authorization: `Bearer ${key}` });
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.body, markdown);
    assert.equal(ok.headers["content-type"], "text/markdown; charset=utf-8");
    assert.equal(ok.headers["cache-control"], "no-store");
    assert.equal(ok.headers["x-content-type-options"], "nosniff");
    assert.equal((await fetchFile(fileSkill.id, { "x-api-key": key })).statusCode, 200, "x-api-key works too");

    assert.equal((await fetchFile(linkSkill.id, { authorization: `Bearer ${key}` })).statusCode, 404, "a link skill is fetched at its own URL");
    assert.equal((await fetchFile("no-such-id", { authorization: `Bearer ${key}` })).statusCode, 404);
    await skills.update(fileSkill.id, { enabled: false });
    assert.equal((await fetchFile(fileSkill.id, { authorization: `Bearer ${key}` })).statusCode, 404, "a disabled skill is not served");
    await skills.update(fileSkill.id, { enabled: true });

    await dash({ method: "PATCH", url: `/api/keys/${keyId}`, body: { isActive: false } });
    assert.equal((await fetchFile(fileSkill.id, { authorization: `Bearer ${key}` })).statusCode, 401, "a disabled key is refused");
    await app.close();
  }));
