// Coverage (spec §8.5): docs/capabilities.md is the denominator; each tape marks the entries it covers.
// A second view counts parityStatus from the Feature Matrix (traced → contracted → implemented).
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

export async function capabilityIds() {
  const text = await readFile(join(ROOT, "docs/capabilities.md"), "utf8");
  return [...text.matchAll(/\*\*id:\*\* `([^`]+)` · \*\*module:\*\* `([^`]+)`/g)].map(([, id, module]) => ({ id, module }));
}

export async function parityStatuses() {
  const dir = join(ROOT, "docs/discovery/feature-matrix");
  const counts = {};
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".yaml"))) {
    for (const [, status] of (await readFile(join(dir, file), "utf8")).matchAll(/^  parityStatus: (\S+)$/gm)) counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

export async function coverage(tapes) {
  const capabilities = await capabilityIds();
  const covered = new Set(tapes.flatMap((t) => t.covers ?? []));
  const unknown = [...covered].filter((id) => !capabilities.some((c) => c.id === id));
  const byModule = {};
  for (const { id, module } of capabilities) {
    const row = (byModule[module] ??= { covered: 0, total: 0 });
    row.total++;
    if (covered.has(id)) row.covered++;
  }
  return { covered: capabilities.filter((c) => covered.has(c.id)).length, total: capabilities.length, byModule, unknown, statuses: await parityStatuses() };
}
