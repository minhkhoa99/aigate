import assert from "node:assert/strict";
import test from "node:test";
import { CONSOLE_ROW_HEIGHT, consoleWindow } from "./console-window.ts";

test("console window reaches all 200 events with at most 26 mounted rows", () => {
  assert.deepEqual(consoleWindow(0, 0), { start: 0, end: 0 });
  assert.deepEqual(consoleWindow(200, 0), { start: 0, end: 20 });
  assert.deepEqual(consoleWindow(200, 200 * CONSOLE_ROW_HEIGHT), { start: 180, end: 200 });
  assert.deepEqual(consoleWindow(3, 1000), { start: 0, end: 3 });
  for (let row = 0; row < 200; row++) {
    const { start, end } = consoleWindow(200, row * CONSOLE_ROW_HEIGHT);
    assert.ok(start <= row && row < end);
    assert.ok(end - start <= 26);
  }
});
