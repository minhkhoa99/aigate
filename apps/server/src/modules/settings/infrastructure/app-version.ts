import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The package is present in both the workspace build and the SP49 release archive.
export const APP_VERSION: string = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../../package.json"), "utf8")).version;
