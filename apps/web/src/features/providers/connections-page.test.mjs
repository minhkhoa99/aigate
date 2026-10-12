import assert from "node:assert/strict";
import test from "node:test";
import { connectionPage } from "./connections-page.ts";

test("connection pages bound mounted rows and clamp after the list shrinks", () => {
  assert.deepEqual(connectionPage(0, 0), { pages: 1, page: 0, start: 0, end: 0 });
  assert.deepEqual(connectionPage(25, 0), { pages: 1, page: 0, start: 0, end: 25 });
  assert.deepEqual(connectionPage(26, 1), { pages: 2, page: 1, start: 25, end: 26 });
  assert.deepEqual(connectionPage(100, 3), { pages: 4, page: 3, start: 75, end: 100 });
  assert.deepEqual(connectionPage(27, 3), { pages: 2, page: 1, start: 25, end: 27 });
  assert.deepEqual(connectionPage(100, -1), { pages: 4, page: 0, start: 0, end: 25 });
});
