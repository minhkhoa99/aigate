import assert from "node:assert/strict";
import test from "node:test";
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

test("skill size counts UTF-8 bytes and the file URL escapes the id", () => {
  assert.equal(skillBytes("é"), 2);
  assert.equal(skillBytes("é".repeat(131_072)), MAX_SKILL_BYTES);
  assert.equal(skillFileUrl("http://127.0.0.1:20200", "a/b"), "http://127.0.0.1:20200/v1/skills/a%2Fb/SKILL.md");
});
