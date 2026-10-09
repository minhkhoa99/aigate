import assert from "node:assert/strict";
import test from "node:test";
import { mediaAvailability, providersForMediaKind } from "./media-rules.ts";

const provider = (id, serviceKinds, routeKinds, hidden = false) => ({ id, serviceKinds, routeKinds, hidden });
const connection = (providerId, isActive) => ({ provider: providerId, isActive });

test("media lists visible catalog claims while route availability is separate", () => {
  const catalog = [provider("advertised", ["tts"], []), provider("routed", ["tts"], ["tts"]),
    provider("other", ["image"], ["image"]), provider("hidden", ["tts"], ["tts"], true)];
  assert.deepEqual(providersForMediaKind(catalog, "tts").map(item => item.id), ["advertised", "routed"]);
  assert.equal(mediaAvailability(catalog[0], "tts", [connection("advertised", true)]).configured, false);
  assert.equal(mediaAvailability(catalog[1], "tts", []).configured, false);
});

test("media configuration requires a working route and an enabled saved account", () => {
  const routed = provider("routed", ["tts"], ["tts"]);
  const saved = [connection("routed", false), connection("routed", true), connection("other", true)];
  const snapshot = structuredClone(saved);
  const state = mediaAvailability(routed, "tts", saved);
  assert.equal(state.route, true);
  assert.equal(state.saved.length, 2);
  assert.equal(state.active.length, 1);
  assert.equal(state.configured, true);
  assert.equal(mediaAvailability(routed, "image", saved).configured, false);
  assert.equal(mediaAvailability(routed, "tts", saved.slice(0, 1)).configured, false);
  assert.deepEqual(saved, snapshot);
});
