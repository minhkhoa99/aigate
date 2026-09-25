import assert from "node:assert/strict";
import test from "node:test";
import { mediaGroups } from "./catalog.ts";

test("9Router media provider lists baseline", () => {
  assert.deepEqual(mediaGroups.map((group) => group.providers.length), [15, 20, 15, 7, 1, 19, 4]);
  for (const group of mediaGroups) assert.equal(new Set(group.providers.map(([id]) => id)).size, group.providers.length);
});
