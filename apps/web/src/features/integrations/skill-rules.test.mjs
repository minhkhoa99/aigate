import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { MAX_SKILL_BYTES, readFrontmatter, skillBytes, skillFileUrl } from "./skill-rules.ts";

test("frontmatter fills name and description from plain one-line pairs only", () => {
  assert.deepEqual(readFrontmatter("---\nname: deploy\ndescription: \"Ship it\"\nallowed-tools: Bash\n---\n# Body"), { name: "deploy", description: "Ship it" });
  assert.deepEqual(readFrontmatter("\uFEFF---\r\nname: 'quoted'\r\n---\r\n"), { name: "quoted" }, "BOM and CRLF");
  assert.deepEqual(readFrontmatter("# No frontmatter\nname: not-this"), {});
  assert.deepEqual(readFrontmatter("---\nname:\ndescription:   \n---\n"), {}, "empty values are ignored");
  assert.deepEqual(readFrontmatter("---\nname: unterminated\n"), {}, "an unclosed block is not frontmatter");
  assert.equal(readFrontmatter(`---\nname: ${"n".repeat(100)}\ndescription: ${"d".repeat(400)}\n---\n`).name?.length, 64);
  assert.equal(readFrontmatter(`---\ndescription: ${"d".repeat(400)}\n---\n`).description?.length, 280);
});

test("Skills dropdown rows reserve space for copy and stack on mobile", async () => {
  const source = await readFile(new URL("./skills-auto.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../../styles.css", import.meta.url), "utf8");
  assert.equal(source.match(/className="list-row skills-setting-row"/g)?.length, 2);
  for (const key of ["selection", "maxSelected"]) {
    assert.match(source, new RegExp(`className="list-row skills-setting-row"><(?:div><)?strong>\\{t\\("skills\\.${key}"\\)\\}`));
  }
  assert.match(css, /\.skills-setting-row\s*\{[^}]*display:grid;[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.skills-setting-row>\.input\s*\{[^}]*min-width:0;[^}]*max-width:320px/);
  assert.match(css, /@media\(max-width:740px\)\s*\{\s*\.skills-setting-row\s*\{[^}]*grid-template-columns:minmax\(0,1fr\)[^}]*\}\s*\.skills-setting-row>\.input\s*\{[^}]*max-width:none/);
});

test("skill size counts UTF-8 bytes and the file URL escapes the id", () => {
  assert.equal(skillBytes("é"), 2);
  assert.equal(skillBytes("é".repeat(131_072)), MAX_SKILL_BYTES);
  assert.equal(skillFileUrl("http://127.0.0.1:20200", "a/b"), "http://127.0.0.1:20200/v1/skills/a%2Fb/SKILL.md");
});
