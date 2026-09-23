import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));

/** AIGate repo root — three levels up from tools/discovery/src/. */
export const REPO_ROOT = resolve(here, "..", "..", "..");

/** Read-only 9router checkout used as behavioral reference. */
export const NINEROUTER_ROOT = resolve(
  process.env["NINEROUTER_PATH"] ?? "E:/9router",
);

/**
 * Resolve a path inside the 9router checkout.
 * Throws if the result would land outside it — discovery never reads
 * arbitrary files off the machine.
 */
export function resolveRef(relative: string): string {
  const full = resolve(NINEROUTER_ROOT, relative);
  if (full !== NINEROUTER_ROOT && !full.startsWith(NINEROUTER_ROOT + sep)) {
    throw new Error(`Path escapes 9router root: ${relative}`);
  }
  return full;
}
