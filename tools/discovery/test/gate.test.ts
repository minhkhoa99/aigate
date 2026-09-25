import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { REPO_ROOT } from "../src/paths.js";
import { validateMatrix } from "../src/validate.js";
import { buildInventory } from "../src/inventory.js";
import { computeCoverage } from "../src/coverage.js";

const MATRIX_DIR = join(REPO_ROOT, "docs/discovery/feature-matrix");

/** The 23 feature groups behavioral.md §5 requires. */
const REQUIRED_GROUPS = [
  "Endpoint & API Key", "Providers", "Provider authentication", "OAuth providers",
  "API-key providers", "Provider account management", "Multi-account",
  "Model registry", "Model mapping", "Request routing", "Auto fallback",
  "Combo / Vision Adapter", "Usage", "Quota Tracker", "Token Saver",
  "CLI Tools", "Media Providers", "Proxy Pools", "Skills", "Console Log",
  "Remote functionality", "Translation / language functionality", "Settings",
];

describe("M-1 exit gate", () => {
  const result = validateMatrix(MATRIX_DIR);
  const coverage = computeCoverage(result.entries, buildInventory());
  const dim = (n: string) => coverage.dimensions.find((d) => d.name === n)!;

  it("has a valid Feature Matrix", () => {
    expect(result.errors).toEqual([]);
  });

  it("covers all 23 feature groups", () => {
    const seen = new Set(result.entries.map((e) => e.group));
    expect(REQUIRED_GROUPS.filter((g) => !seen.has(g))).toEqual([]);
  });

  it("covers every API route", () => {
    expect(dim("routes").missing).toEqual([]);
  });

  it("covers every db repo", () => {
    expect(dim("repos").missing).toEqual([]);
  });

  it("assigns every entry to a bounded context and has traced it at least", () => {
    // Later SPs move entries past "traced"; the M-1 gate only forbids untraced ones.
    for (const e of result.entries) {
      expect(e.newModule).toBeTruthy();
      expect(["traced", "contracted", "implemented", "verified"]).toContain(e.parityStatus);
    }
  });

  it("gives every suspected bug an expected/actual/impact block", () => {
    for (const e of result.entries.filter((x) => x.labels.includes("SUSPECTED_BUG"))) {
      expect(e.suspicion?.expected).toBeTruthy();
      expect(e.suspicion?.actual).toBeTruthy();
      expect(e.suspicion?.impact).toBeTruthy();
    }
  });
});
