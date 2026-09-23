import type { Inventory } from "./inventory.js";
import type { FeatureEntry } from "./schema.js";

export type Dimension = {
  name: string;
  total: number;
  covered: number;
  missing: string[];
};

export type CoverageReport = {
  dimensions: Dimension[];
  totalEntries: number;
  byModule: Record<string, number>;
  labelCounts: Record<string, number>;
};

/**
 * How an inventory item maps to the evidence path that would cover it.
 * null means the item has no file of its own and is matched in prose.
 */
const EVIDENCE_PATH: Record<keyof Inventory, (item: string) => string | null> = {
  routes: (r: string) => `src/app/${r}/route.js`,
  pages: (p: string) => `src/app/${p}/page.js`,
  providers: (p: string) => `open-sse/providers/registry/${p}.js`,
  executors: (e: string) => `open-sse/executors/${e}.js`,
  translators: (t: string) => t,
  repos: (r: string) => `src/lib/db/repos/${r}.js`,
  settingsKeys: () => null,
};

export function computeCoverage(
  entries: FeatureEntry[],
  inv: Inventory,
): CoverageReport {
  const cited = new Set(entries.flatMap((e) => e.evidence.map((v) => v.file)));
  const prose = entries
    .flatMap((e) => [
      ...e.businessRules,
      ...e.dependencies,
      ...e.state.reads,
      ...e.state.writes,
      ...e.sideEffects,
    ])
    .join("\n");

  const inventoryKeys = ["routes", "pages", "providers", "executors", "translators", "repos", "settingsKeys"] as const;

  // Compile-time exhaustiveness check: fails if any Inventory key is missing from inventoryKeys
  type MissingKeys = Exclude<keyof Inventory, (typeof inventoryKeys)[number]>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _inventoryKeysExhaustive: [MissingKeys] extends [never] ? true : never = true;

  const dimensions: Dimension[] = inventoryKeys.map((name) => {
    const items = inv[name];
    const missing = items.filter((item) => {
      const path = EVIDENCE_PATH[name](item);
      return path === null ? !prose.includes(item) : !cited.has(path);
    });
    return { name, total: items.length, covered: items.length - missing.length, missing };
  });

  const byModule: Record<string, number> = {};
  const labelCounts: Record<string, number> = {};
  for (const e of entries) {
    byModule[e.newModule] = (byModule[e.newModule] ?? 0) + 1;
    for (const l of e.labels) labelCounts[l] = (labelCounts[l] ?? 0) + 1;
  }

  return { dimensions, totalEntries: entries.length, byModule, labelCounts };
}

export function renderCoverage(r: CoverageReport): string {
  const lines = ["# Discovery coverage", "", `Entries: ${r.totalEntries}`, ""];
  lines.push("| Dimension | Covered | Missing (sample) |", "|---|---|---|");
  for (const d of r.dimensions) {
    const sample = d.missing.slice(0, 8).join(", ");
    const more = d.missing.length > 8 ? ` … +${d.missing.length - 8}` : "";
    lines.push(`| ${d.name} | ${d.covered}/${d.total} | ${sample}${more} |`);
  }
  lines.push("", "## Entries per bounded context", "");
  for (const [m, n] of Object.entries(r.byModule).sort()) lines.push(`- ${m}: ${n}`);
  lines.push("", "## Labels", "");
  for (const [l, n] of Object.entries(r.labelCounts).sort()) lines.push(`- ${l}: ${n}`);
  lines.push("");
  for (const d of r.dimensions.filter((x) => x.missing.length > 0)) {
    lines.push(`## Missing — ${d.name}`, "");
    for (const m of d.missing) lines.push(`- ${m}`);
    lines.push("");
  }
  return lines.join("\n");
}
