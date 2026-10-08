import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { NINEROUTER_ROOT, REPO_ROOT, resolveRef, resolveEvidence } from "../src/paths.js";

describe("paths", () => {
  it("allows explicit local evidence without expanding reference access", () => {
    expect(resolveEvidence("aigate:docs/PROGRESS_HANDOFF.md")).toBe(join(REPO_ROOT, "docs", "PROGRESS_HANDOFF.md"));
    for (const path of ["aigate:../outside", "aigate:/outside", "aigate:C:/outside", "aigate:"])
      expect(() => resolveEvidence(path)).toThrow();
    expect(() => resolveRef("../outside")).toThrow();
  });
  it("points NINEROUTER_ROOT at a real 9router checkout", () => {
    expect(existsSync(resolveRef("open-sse/providers/index.js"))).toBe(true);
    expect(existsSync(resolveRef("src/app/api"))).toBe(true);
  });

  it("points REPO_ROOT at the AIGate repo", () => {
    expect(existsSync(`${REPO_ROOT}/docs/superpowers/specs`)).toBe(true);
  });

  it("rejects paths that escape the 9router root", () => {
    expect(() => resolveRef("../secrets.txt")).toThrow(/escapes/);
  });

  it("exposes NINEROUTER_ROOT as an absolute path", () => {
    expect(NINEROUTER_ROOT).toMatch(/^([A-Za-z]:|\/)/);
  });
});
