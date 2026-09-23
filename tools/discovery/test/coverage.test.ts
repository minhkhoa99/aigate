import { describe, expect, it } from "vitest";
import { computeCoverage, renderCoverage } from "../src/coverage.js";
import type { FeatureEntry } from "../src/schema.js";
import type { Inventory } from "../src/inventory.js";

const inv: Inventory = {
  routes: ["api/keys", "api/settings"],
  pages: ["login"],
  providers: ["anthropic", "openai"],
  executors: ["default"],
  translators: ["open-sse/translator/index.js"],
  repos: ["settingsRepo"],
  settingsKeys: ["requireApiKey", "rtkEnabled"],
};

const base = {
  group: "g", feature: "f", subFeature: "s", trigger: "t", input: "i", output: "o",
  businessRules: [], state: { reads: [], writes: [], runtimeOnly: [] }, dependencies: [],
  providerInteraction: null,
  fallback: { hasFallback: false, retry: null, timeout: null, quota: null },
  errorCases: [], sideEffects: [], persistence: [], performanceConcerns: [],
  behavior: { streaming: false, cancellation: null, concurrency: null },
  edgeCases: [], parityStatus: "traced" as const, labels: [],
};

const entries: FeatureEntry[] = [
  {
    ...base,
    id: "settings.read",
    newModule: "settings",
    businessRules: ["Reads requireApiKey on every request"],
    evidence: [
      { file: "src/app/api/settings/route.js", line: 1, note: "" },
      { file: "src/lib/db/repos/settingsRepo.js", line: 1, note: "" },
    ],
  },
  {
    ...base,
    id: "catalog.openai",
    newModule: "catalog",
    labels: ["IMPLEMENTATION_ACCIDENT"],
    evidence: [{ file: "open-sse/providers/registry/openai.js", line: 1, note: "" }],
  },
];

describe("computeCoverage", () => {
  const r = computeCoverage(entries, inv);
  const dim = (n: string) => r.dimensions.find((d) => d.name === n)!;

  it("counts a route as covered when an entry cites its route.js", () => {
    expect(dim("routes").covered).toBe(1);
    expect(dim("routes").missing).toEqual(["api/keys"]);
  });

  it("counts a provider as covered when an entry cites its registry file", () => {
    expect(dim("providers").covered).toBe(1);
    expect(dim("providers").missing).toEqual(["anthropic"]);
  });

  it("reports zero coverage for an untouched dimension", () => {
    expect(dim("pages").covered).toBe(0);
    expect(dim("executors").covered).toBe(0);
  });

  it("counts a settings key as covered when prose names it", () => {
    expect(dim("settingsKeys").covered).toBe(1);
    expect(dim("settingsKeys").missing).toEqual(["rtkEnabled"]);
  });

  it("tallies entries per bounded context", () => {
    expect(r.byModule).toMatchObject({ settings: 1, catalog: 1 });
  });

  it("tallies labels", () => {
    expect(r.labelCounts["IMPLEMENTATION_ACCIDENT"]).toBe(1);
  });

  it("renders a report naming the missing items", () => {
    const text = renderCoverage(r);
    expect(text).toContain("routes");
    expect(text).toContain("api/keys");
    expect(text).toContain("1/2");
  });
});
