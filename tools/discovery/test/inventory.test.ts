import { describe, expect, it } from "vitest";
import { buildInventory } from "../src/inventory.js";

const inv = buildInventory();

const KEYS = [
  "routes",
  "pages",
  "providers",
  "executors",
  "translators",
  "repos",
  "settingsKeys",
] as const;

describe("buildInventory", () => {
  it("finds every API route", () => {
    expect(inv.routes).toHaveLength(166);
    expect(inv.routes).toContain("api/settings");
    expect(inv.routes).toContain("api/oauth/[provider]/[action]");
  });

  it("finds every page", () => {
    expect(inv.pages).toHaveLength(28);
  });

  it("maps the root page (src/app/page.js) to the empty-string item, not the literal 'page.js'", () => {
    expect(inv.pages).toContain("");
    expect(inv.pages).not.toContain("page.js");
  });

  it("finds every provider registry entry", () => {
    expect(inv.providers).toHaveLength(124);
  });

  it("finds every executor and translator file", () => {
    expect(inv.executors).toHaveLength(31);
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
    for (const key of KEYS) {
      const arr = inv[key];
      expect([...arr].sort()).toEqual(arr);
      expect(new Set(arr).size).toBe(arr.length);
    }
  });
});
