import assert from "node:assert/strict";
import test from "node:test";
import { listPage } from "./list-page.ts";

test("list pages bound mounted rows and clamp after results shrink", () => {
  assert.deepEqual(listPage(0, 0), { pages: 1, page: 0, start: 0, end: 0 });
  assert.deepEqual(listPage(25, 0), { pages: 1, page: 0, start: 0, end: 25 });
  assert.deepEqual(listPage(26, 1), { pages: 2, page: 1, start: 25, end: 26 });
  assert.deepEqual(listPage(100, 3), { pages: 4, page: 3, start: 75, end: 100 });
  assert.deepEqual(listPage(27, 3), { pages: 2, page: 1, start: 25, end: 27 });
  assert.deepEqual(listPage(2_000, 79), { pages: 80, page: 79, start: 1975, end: 2000 });
  assert.deepEqual(listPage(100, -1), { pages: 4, page: 0, start: 0, end: 25 });
});
