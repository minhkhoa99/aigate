import assert from "node:assert/strict";
import test from "node:test";
import { REQUEST_ROW_HEIGHT, requestWindow } from "./request-window.ts";

test("request table keeps a bounded window from first through last loaded row", () => {
  assert.deepEqual(requestWindow(0, 0), { start: 0, end: 0 });
  assert.deepEqual(requestWindow(500, 0), { start: 0, end: 17 });
  const middle = requestWindow(500, 150 * REQUEST_ROW_HEIGHT);
  assert.ok(middle.start <= 150 && middle.end > 150);
  assert.ok(middle.end - middle.start <= 23);
  assert.deepEqual(requestWindow(500, 500 * REQUEST_ROW_HEIGHT), { start: 482, end: 500 });
  assert.deepEqual(requestWindow(3, 999), { start: 0, end: 3 });
  for (let row = 0; row < 500; row++) {
    const { start, end } = requestWindow(500, row * REQUEST_ROW_HEIGHT);
    assert.ok(start <= row && row < end);
    assert.ok(end - start <= 23);
  }
});
