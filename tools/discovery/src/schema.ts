import { z } from "zod";

export const BOUNDED_CONTEXTS = [
  "identity", "apikeys", "catalog", "connections", "routing",
  "transport", "usage", "media", "tooling", "settings",
] as const;

export const LABELS = [
  "REFERENCE_BEHAVIOR", "SUSPECTED_BUG", "IMPLEMENTATION_ACCIDENT",
] as const;

export const ERROR_CODES = [
  "AUTH_ERROR", "RATE_LIMIT", "QUOTA_EXHAUSTED", "PROVIDER_UNAVAILABLE",
  "TIMEOUT", "INVALID_REQUEST", "MODEL_UNAVAILABLE", "INTERNAL_ERROR",
] as const;

/** Non-empty prose. Use null, not "", when a field does not apply. */
const Prose = z.string().min(1);

const Evidence = z.object({
  file: Prose,
  line: z.number().int().positive(),
  note: Prose,
});

const ErrorCase = z.object({
  code: z.enum(ERROR_CODES),
  when: Prose,
  partial: z.boolean(),
});

export const FeatureEntrySchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/, "id must be dotted.lowercase"),
    group: Prose,
    feature: Prose,
    subFeature: Prose,
    trigger: Prose,
    input: Prose,
    output: Prose,
    businessRules: z.array(Prose),
    state: z.object({
      reads: z.array(Prose),
      writes: z.array(Prose),
      runtimeOnly: z.array(Prose),
    }),
    dependencies: z.array(Prose),
    providerInteraction: Prose.nullable(),
    fallback: z.object({
      hasFallback: z.boolean(),
      retry: Prose.nullable(),
      timeout: Prose.nullable(),
      quota: Prose.nullable(),
    }),
    errorCases: z.array(ErrorCase),
    sideEffects: z.array(Prose),
    persistence: z.array(Prose),
    performanceConcerns: z.array(Prose),
    behavior: z.object({
      streaming: z.boolean(),
      cancellation: Prose.nullable(),
      concurrency: Prose.nullable(),
    }),
    edgeCases: z.array(Prose),
    evidence: z.array(Evidence).min(1, "every entry needs at least one file:line citation"),
    newModule: z.enum(BOUNDED_CONTEXTS),
    parityStatus: z.enum(["not-started", "traced", "contracted", "implemented", "verified"]),
    labels: z.array(z.enum(LABELS)),
    suspicion: z
      .object({ expected: Prose, actual: Prose, impact: Prose })
      .optional(),
  })
  .superRefine((entry, ctx) => {
    if (entry.labels.includes("SUSPECTED_BUG") && !entry.suspicion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["suspicion"],
        message: "SUSPECTED_BUG requires expected/actual/impact",
      });
    }
  });

export type FeatureEntry = z.infer<typeof FeatureEntrySchema>;
