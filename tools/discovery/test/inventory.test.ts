import { describe, expect, it } from "vitest";
import { buildInventory } from "../src/inventory.js";

const inv = buildInventory();

describe("buildInventory", () => {
  it("finds every API route", () => {
    expect(inv.routes).toHaveLength(154);
    expect(inv.routes).toContain("api/settings");
    expect(inv.routes).toContain("api/oauth/[provider]/[action]");
  });

  it("finds every page", () => {
    expect(inv.pages).toHaveLength(28);
  });

  it("finds every provider registry entry", () => {
    expect(inv.providers).toHaveLength(122);
  });

  it("finds every executor and translator file", () => {
    expect(inv.executors).toHaveLength(29);
    expect(inv.translators).toHaveLength(48);
  });

  it("finds every db repo", () => {
    expect(inv.repos).toHaveLength(11);
    expect(inv.repos).toContain("settingsRepo");
  });

  it("extracts settings keys including known ones", () => {
    expect(inv.settingsKeys.length).toBeGreaterThanOrEqual(40);
    expect(inv.settingsKeys).toContain("requireApiKey");
    expect(inv.settingsKeys).toContain("capacityAdapter");
  });

  it("returns sorted, de-duplicated arrays", () => {
    for (const key of Object.keys(inv) as (keyof typeof inv)[]) {
      const arr = inv[key];
      expect([...arr].sort()).toEqual(arr);
      expect(new Set(arr).size).toBe(arr.length);
    }
  });
});
