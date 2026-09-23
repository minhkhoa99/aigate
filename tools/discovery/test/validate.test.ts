import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateMatrix, countLines } from "../src/validate.js";

const dirs: string[] = [];
let dir: string;

const entry = (over: Record<string, unknown> = {}) => ({
  id: "apikey.validate",
  group: "Endpoint & API Key",
  feature: "API key",
  subFeature: "Validate an inbound key",
  trigger: "Any /v1 request",
  input: "Authorization header",
  output: "Accepted or 401",
  businessRules: ["Inactive keys rejected"],
  state: { reads: ["apiKeys"], writes: [], runtimeOnly: [] },
  dependencies: [],
  providerInteraction: null,
  fallback: { hasFallback: false, retry: null, timeout: null, quota: null },
  errorCases: [],
  sideEffects: [],
  persistence: [],
  performanceConcerns: [],
  behavior: { streaming: false, cancellation: null, concurrency: null },
  edgeCases: [],
  evidence: [{ file: "src/shared/utils/apiKey.js", line: 1, note: "format" }],
  newModule: "apikeys",
  parityStatus: "traced",
  labels: [],
  ...over,
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "matrix-"));
  dirs.push(dir);
});
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe("validateMatrix", () => {
  it("passes when every entry is valid and its evidence exists", () => {
    writeFileSync(join(dir, "a.yaml"), JSON.stringify([entry()]));
    const r = validateMatrix(dir);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.entries).toHaveLength(1);
  });

  it("fails when evidence cites a file that does not exist", () => {
    writeFileSync(
      join(dir, "a.yaml"),
      JSON.stringify([
        entry({ evidence: [{ file: "src/nope.js", line: 1, note: "x" }] }),
      ]),
    );
    const r = validateMatrix(dir);
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/src\/nope\.js/);
  });

  it("fails when evidence cites a line past the end of the file", () => {
    writeFileSync(
      join(dir, "a.yaml"),
      JSON.stringify([
        entry({
          evidence: [
            { file: "src/shared/utils/apiKey.js", line: 999999, note: "x" },
          ],
        }),
      ]),
    );
    const r = validateMatrix(dir);
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/line 999999/);
  });

  it("fails when two entries share an id", () => {
    writeFileSync(join(dir, "a.yaml"), JSON.stringify([entry()]));
    writeFileSync(join(dir, "b.yaml"), JSON.stringify([entry()]));
    const r = validateMatrix(dir);
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/duplicate id/i);
  });

  it("fails when a file's top level is not a list", () => {
    writeFileSync(join(dir, "a.yaml"), JSON.stringify(entry()));
    const r = validateMatrix(dir);
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/must be a list/);
  });

});

describe("countLines", () => {
  it("returns 0 for empty string", () => {
    expect(countLines("")).toBe(0);
  });

  it("counts a single line without trailing newline", () => {
    expect(countLines("a")).toBe(1);
  });

  it("counts a single line with LF trailing newline", () => {
    expect(countLines("a\n")).toBe(1);
  });

  it("counts a single blank line (just newline)", () => {
    expect(countLines("\n")).toBe(1);
  });

  it("counts multiple lines separated by LF", () => {
    expect(countLines("a\nb\nc")).toBe(3);
  });

  it("counts multiple lines with trailing LF (trailing newline does not add line)", () => {
    expect(countLines("a\nb\nc\n")).toBe(3);
  });

  it("counts multiple blank lines", () => {
    expect(countLines("\n\n")).toBe(2);
  });

  it("handles CRLF line endings", () => {
    expect(countLines("a\r\nb\r\n")).toBe(2);
  });

  it("handles mixed CR/LF line endings", () => {
    expect(countLines("a\rb\nc")).toBe(3);
  });
});
