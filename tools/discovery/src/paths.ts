import { existsSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));

/** AIGate repo root — three levels up from tools/discovery/src/. */
export const REPO_ROOT = resolve(here, "..", "..", "..");

/** Read-only 9router checkout used as behavioral reference. */
const defaultReference = resolve(REPO_ROOT, ".reference", "9router");
const referenceCandidates = [
  process.env["NINEROUTER_PATH"],
  defaultReference,
  "D:/9router",
  "E:/9router",
].filter((path): path is string => Boolean(path));

export const NINEROUTER_ROOT = resolve(
  referenceCandidates.find((path) => existsSync(resolve(path, "package.json"))) ?? defaultReference,
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

/** Explicit AIGate extension evidence; ordinary paths retain reference-only resolution. */
export function resolveEvidence(path: string): string {
  if (!path.startsWith("aigate:")) return resolveRef(path);
  const relative = path.slice("aigate:".length);
  if (!relative || isAbsolute(relative)) throw new Error("Evidence escapes AIGate root");
  const full = resolve(REPO_ROOT, relative);
  if (!full.startsWith(REPO_ROOT + sep)) throw new Error("Evidence escapes AIGate root");
  return full;
}
