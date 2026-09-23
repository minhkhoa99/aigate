import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { REPO_ROOT } from "./paths.js";
import { validateMatrix, type ValidationResult } from "./validate.js";
import { buildInventory } from "./inventory.js";
import { computeCoverage, renderCoverage } from "./coverage.js";
import { renderCapabilities } from "./capabilities.js";

const MATRIX_DIR = join(REPO_ROOT, "docs/discovery/feature-matrix");
const OUT_DIR = join(REPO_ROOT, "docs/discovery");

function write(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
  console.log(`wrote ${path}`);
}

function loadOrExit(): ValidationResult {
  const r = validateMatrix(MATRIX_DIR);
  if (!r.ok) {
    for (const e of r.errors) console.error(e);
    console.error(`\n${r.errors.length} error(s)`);
    process.exit(1);
  }
  return r;
}

switch (process.argv[2]) {
  case "validate": {
    const r = loadOrExit();
    console.log(`OK — ${r.entries.length} entries`);
    break;
  }
  case "inventory": {
    write(join(OUT_DIR, "inventory.json"), JSON.stringify(buildInventory(), null, 2) + "\n");
    break;
  }
  case "coverage": {
    const r = loadOrExit();
    write(
      join(OUT_DIR, "coverage.md"),
      renderCoverage(computeCoverage(r.entries, buildInventory())),
    );
    break;
  }
  case "capabilities": {
    const r = loadOrExit();
    write(join(REPO_ROOT, "docs/capabilities.md"), renderCapabilities(r.entries));
    break;
  }
  default:
    console.error("usage: discovery <validate|inventory|coverage|capabilities>");
    process.exit(1);
}
