import assert from "node:assert/strict";
import test from "node:test";
import { TABLE_ROW_HEIGHT, tableWindow } from "./table-window.ts";

test("traffic tables keep a bounded window from first through last loaded row", () => {
  assert.deepEqual(tableWindow(0, 0), { start: 0, end: 0 });
  assert.deepEqual(tableWindow(500, 0), { start: 0, end: 17 });
  const middle = tableWindow(500, 150 * TABLE_ROW_HEIGHT);
  assert.ok(middle.start <= 150 && middle.end > 150);
  assert.ok(middle.end - middle.start <= 23);
  assert.deepEqual(tableWindow(500, 500 * TABLE_ROW_HEIGHT), { start: 482, end: 500 });
  assert.deepEqual(tableWindow(3, 999), { start: 0, end: 3 });
  for (let row = 0; row < 500; row++) {
    const { start, end } = tableWindow(500, row * TABLE_ROW_HEIGHT);
    assert.ok(start <= row && row < end);
    assert.ok(end - start <= 23);
  }
  assert.deepEqual(tableWindow(200, 200 * TABLE_ROW_HEIGHT), { start: 182, end: 200 });
});
