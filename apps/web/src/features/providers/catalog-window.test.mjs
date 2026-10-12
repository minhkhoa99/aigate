import assert from "node:assert/strict";
import test from "node:test";
import { CATALOG_CARD_STEP, catalogWindow } from "./catalog-window.ts";

test("catalog window covers all cards at responsive widths without mounting the full API Key group", () => {
  for (const columns of [1, 2, 3, 4]) {
    const count = 43;
    const rows = Math.ceil(count / columns);
    assert.deepEqual(catalogWindow(0, columns, 0), { start: 0, end: 0, rows: 0 });
    assert.equal(catalogWindow(count, columns, 0).start, 0);
    assert.equal(catalogWindow(count, columns, Infinity).end, rows);
    for (let row = 0; row < rows; row++) {
      const { start, end } = catalogWindow(count, columns, row * CATALOG_CARD_STEP);
      assert.ok(start <= row && row < end);
      assert.ok((end - start) * columns < count);
    }
  }
  assert.deepEqual(catalogWindow(23, 4, Infinity), { start: 0, end: 6, rows: 6 });
});
