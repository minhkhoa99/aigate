import { readFileSync } from "node:fs";
import fg from "fast-glob";
import { NINEROUTER_ROOT, resolveRef } from "./paths.js";

export type Inventory = {
  routes: string[];
  pages: string[];
  providers: string[];
  executors: string[];
  translators: string[];
  repos: string[];
  settingsKeys: string[];
};

const IGNORE = ["**/node_modules/**", "**/.next/**", "**/dist/**"];

function glob(pattern: string): string[] {
  return fg.sync(pattern, { cwd: NINEROUTER_ROOT, ignore: IGNORE });
}

const sorted = (xs: string[]): string[] => [...new Set(xs)].sort();

const basename = (p: string): string =>
  p.slice(p.lastIndexOf("/") + 1).replace(/\.js$/, "");

/**
 * Top-level keys of DEFAULT_SETTINGS. Regex rather than import: the module
 * is ESM with `@/` aliases and would need the whole Next resolver to load.
 * The result is a denominator for coverage, not a runtime contract.
 */
function settingsKeys(): string[] {
  const src = readFileSync(resolveRef("src/lib/db/repos/settingsRepo.js"), "utf8");
  const start = src.indexOf("DEFAULT_SETTINGS");
  if (start === -1) throw new Error("DEFAULT_SETTINGS not found in settingsRepo.js");
  const open = src.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = src.slice(open + 1, end);
  const keys: string[] = [];
  let nesting = 0;
  for (const line of body.split("\n")) {
    if (nesting === 0) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(line);
      if (m?.[1]) keys.push(m[1]);
    }
    nesting += (line.match(/[{[]/g)?.length ?? 0) - (line.match(/[}\]]/g)?.length ?? 0);
  }
  return sorted(keys);
}

export function buildInventory(): Inventory {
  return {
    routes: sorted(
      glob("src/app/api/**/route.js").map((p) =>
        p.replace(/^src\/app\//, "").replace(/\/route\.js$/, ""),
      ),
    ),
    pages: sorted(
      glob("src/app/**/page.js").map((p) =>
        p.replace(/^src\/app\//, "").replace(/(^|\/)page\.js$/, ""),
      ),
    ),
    providers: sorted(
      glob("open-sse/providers/registry/*.js")
        .map(basename)
        .filter((n) => n !== "index"),
    ),
    executors: sorted(glob("open-sse/executors/*.js").map(basename)),
    translators: sorted(glob("open-sse/translator/**/*.js")),
    repos: sorted(glob("src/lib/db/repos/*.js").map(basename)),
    settingsKeys: settingsKeys(),
  };
}
