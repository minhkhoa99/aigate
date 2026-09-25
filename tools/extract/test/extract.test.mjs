// SP4 exit criterion (docs/contracts/registry-extract.md): the committed catalog matches 9router by diff.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, readSource } from "../src/extract.mjs";
import { verify } from "../src/verify.mjs";
import { CATALOG } from "@aigate/engine";

test("the committed catalog has no difference from the 9router source", async () => {
  const result = await verify();
  assert.deepEqual(result.differences, [], result.report);
});

test("the committed catalog is exactly what extraction produces today (no hand edits, no stale file)", async () => {
  const fresh = buildCatalog(await readSource());
  assert.deepEqual(JSON.parse(JSON.stringify(CATALOG)), fresh);
});

test("extraction restores 9router's defaults after using its sentinel", async () => {
  const source = await readSource();
  const before = { ...source.capabilities.DEFAULT_CAPABILITIES };
  buildCatalog(source);
  assert.deepEqual(source.capabilities.DEFAULT_CAPABILITIES, before);
});
