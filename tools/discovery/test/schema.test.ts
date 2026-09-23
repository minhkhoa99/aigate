import { describe, expect, it } from "vitest";
import { FeatureEntrySchema } from "../src/schema.js";

const valid = {
  id: "apikey.validate",
  group: "Endpoint & API Key",
  feature: "API key",
  subFeature: "Validate an inbound key",
  trigger: "Any /v1 request while settings.requireApiKey is true",
  input: "Authorization: Bearer sk-... or x-api-key header",
  output: "Accepted request, or 401 with an error body",
  businessRules: ["Inactive keys are rejected even when the string matches"],
  state: { reads: ["apiKeys table"], writes: [], runtimeOnly: [] },
  dependencies: ["settings.requireApiKey"],
  providerInteraction: null,
  fallback: { hasFallback: false, retry: null, timeout: null, quota: null },
  errorCases: [
    { code: "AUTH_ERROR", when: "key missing or inactive", partial: false },
  ],
  sideEffects: [],
  persistence: ["apiKeys.lastUsedAt is not updated today"],
  performanceConcerns: ["Plaintext equality lookup on every request"],
  behavior: { streaming: false, cancellation: null, concurrency: null },
  edgeCases: ["Legacy sk-{random8} keys predate the machineId format"],
  evidence: [
    { file: "src/shared/utils/apiKey.js", line: 1, note: "key format" },
  ],
  newModule: "apikeys",
  parityStatus: "traced",
  labels: [],
};

describe("FeatureEntrySchema", () => {
  it("accepts a fully populated entry", () => {
    expect(FeatureEntrySchema.parse(valid)).toMatchObject({ id: "apikey.validate" });
  });

  it("rejects an entry with no evidence", () => {
    const r = FeatureEntrySchema.safeParse({ ...valid, evidence: [] });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown bounded context", () => {
    const r = FeatureEntrySchema.safeParse({ ...valid, newModule: "misc" });
    expect(r.success).toBe(false);
  });

  it("rejects an empty string where null means not-applicable", () => {
    const r = FeatureEntrySchema.safeParse({ ...valid, trigger: "" });
    expect(r.success).toBe(false);
  });

  it("rejects an id that is not dotted lowercase", () => {
    const r = FeatureEntrySchema.safeParse({ ...valid, id: "API Key Validate" });
    expect(r.success).toBe(false);
  });

  it("requires expected/actual/impact when labelled SUSPECTED_BUG", () => {
    const r = FeatureEntrySchema.safeParse({ ...valid, labels: ["SUSPECTED_BUG"] });
    expect(r.success).toBe(false);
  });

  it("accepts SUSPECTED_BUG when the suspicion block is present", () => {
    const r = FeatureEntrySchema.safeParse({
      ...valid,
      labels: ["SUSPECTED_BUG"],
      suspicion: {
        expected: "opt-out disables it",
        actual: "still runs",
        impact: "wasted tokens",
      },
    });
    expect(r.success).toBe(true);
  });
});
