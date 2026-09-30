import assert from "node:assert/strict";
import test from "node:test";
import { mediaGroups } from "./catalog.ts";

test("media catalog lists all nine endpoints", () => {
  assert.deepEqual(mediaGroups.map((group) => group.id), ["embedding", "image", "imageToText", "tts", "stt", "webSearch", "webFetch", "video", "music"]);
  assert.equal(new Set(mediaGroups.map((group) => group.id)).size, 9);
  assert.ok(mediaGroups.filter((group) => group.endpoint).every((group) => group.endpoint.startsWith("/v1/")));
  assert.equal(mediaGroups.find((group) => group.id === "music").endpoint, null);
});
