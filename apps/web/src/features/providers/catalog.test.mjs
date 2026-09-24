import assert from "node:assert/strict";
import test from "node:test";
import { allProviders, mediaGroups, providerGroups, providers } from "./catalog.ts";

test("9Router provider catalog baseline", () => {
  assert.deepEqual(providerGroups.map((group) => group.providers.length), [16, 15, 41, 2]);
  assert.equal(providers.length, 74);
  assert.equal(new Set(providers.map((provider) => provider.id)).size, providers.length);
  assert.deepEqual(mediaGroups.map((group) => group.providers.length), [15, 20, 15, 7, 1, 19, 4]);
  for (const group of mediaGroups) assert.equal(new Set(group.providers.map(([id]) => id)).size, group.providers.length);
  assert.equal(new Set(allProviders.map((provider) => provider.id)).size, allProviders.length);
  assert.equal(allProviders.length, 111);
});
