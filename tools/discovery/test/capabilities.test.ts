import { describe, expect, it } from "vitest";
import { renderCapabilities } from "../src/capabilities.js";
import type { FeatureEntry } from "../src/schema.js";

const base = {
  group: "Token Saver", feature: "PXPIPE", trigger: "t", input: "i", output: "o",
  businessRules: [], state: { reads: [], writes: [], runtimeOnly: [] }, dependencies: [],
  providerInteraction: null,
  fallback: { hasFallback: false, retry: null, timeout: null, quota: null },
  errorCases: [], sideEffects: [], persistence: [], performanceConcerns: [],
  behavior: { streaming: false, cancellation: null, concurrency: null },
  edgeCases: [], parityStatus: "traced" as const,
  evidence: [{ file: "open-sse/handlers/chatCore.js", line: 287, note: "gate" }],
  newModule: "routing" as const,
};

const entries: FeatureEntry[] = [
  {
    ...base,
    id: "tokensaver.pxpipe",
    subFeature: "Gate on pxpipeEnabled",
    labels: [],
    businessRules: ["Runs only when pxpipeEnabled is true"],
  },
  {
    ...base,
    id: "tokensaver.optout",
    subFeature: "Master opt-out header",
    labels: ["SUSPECTED_BUG"],
    suspicion: {
      expected: "opt-out disables pxpipe",
      actual: "pxpipe still runs",
      impact: "tokens burned against the client's wish",
    },
  },
];

describe("renderCapabilities", () => {
  const md = renderCapabilities(entries);

  it("is marked generated so nobody hand-edits it", () => {
    expect(md).toMatch(/GENERATED/);
  });

  it("groups capabilities under their feature group", () => {
    expect(md).toContain("## Token Saver");
  });

  it("lists a non-bug sub-feature as a capability AIGate must have", () => {
    expect(md).toContain("Gate on pxpipeEnabled");
  });

  it("carries business rules through", () => {
    expect(md).toContain("Runs only when pxpipeEnabled is true");
  });

  it("collects suspected bugs into their own section with expected vs actual", () => {
    expect(md).toContain("Suspected bugs");
    expect(md).toContain("pxpipe still runs");
  });

  it("does not present a suspected bug as a capability to reproduce", () => {
    const capSection = md.slice(0, md.indexOf("Suspected bugs"));
    expect(capSection).not.toContain("pxpipe still runs");
    expect(capSection).not.toContain("Master opt-out header");
  });
});
