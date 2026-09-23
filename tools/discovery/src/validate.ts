import { readFileSync, existsSync } from "node:fs";
import fg from "fast-glob";
import { parse } from "yaml";
import { FeatureEntrySchema, type FeatureEntry } from "./schema.js";
import { resolveRef } from "./paths.js";

export type ValidationResult = {
  ok: boolean;
  entries: FeatureEntry[];
  errors: string[];
};

/** Count real lines in a string: normalize CRLF/LF, strip trailing newline, count lines.
 * Examples: "" → 0, "a" → 1, "a\n" → 1, "\n" → 1, "a\nb" → 2, "a\nb\n" → 2 */
export function countLines(content: string): number {
  if (!content) return 0;
  // Normalize line endings (CRLF -> LF, CR -> LF)
  content = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!content) return 0;
  // Special case: a single newline is one blank line
  if (content === "\n") return 1;
  // Remove trailing newline if present, then count
  if (content.endsWith("\n")) {
    content = content.slice(0, -1);
  }
  // Count lines by splitting on newlines
  return content.length === 0 ? 0 : content.split("\n").length;
}

/** Cache line counts so a file cited by 20 entries is read once. */
const lineCounts = new Map<string, number>();

function lineCount(refPath: string): number {
  const cached = lineCounts.get(refPath);
  if (cached !== undefined) return cached;
  let n = -1;
  try {
    const abs = resolveRef(refPath);
    if (!existsSync(abs)) {
      n = -1;
    } else {
      const content = readFileSync(abs, "utf8");
      n = countLines(content);
    }
  } catch {
    n = -1; // path escaped the 9router root
  }
  lineCounts.set(refPath, n);
  return n;
}

export function validateMatrix(dir: string): ValidationResult {
  const files = fg.sync("*.yaml", {
    cwd: dir,
    absolute: true,
    ignore: ["**/node_modules/**", "**/.git/**"],
  }).sort();
  const entries: FeatureEntry[] = [];
  const errors: string[] = [];
  const seen = new Map<string, string>();

  for (const file of files) {
    const raw: unknown = parse(readFileSync(file, "utf8"));
    if (!Array.isArray(raw)) {
      errors.push(`${file}: top level must be a list of entries`);
      continue;
    }
    raw.forEach((item, i) => {
      const parsed = FeatureEntrySchema.safeParse(item);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errors.push(`${file}[${i}] ${issue.path.join(".")}: ${issue.message}`);
        }
        return;
      }
      const entry = parsed.data;

      const prior = seen.get(entry.id);
      if (prior) {
        errors.push(`${file}[${i}]: duplicate id "${entry.id}" (also in ${prior})`);
        return;
      }
      seen.set(entry.id, file);

      for (const ev of entry.evidence) {
        const n = lineCount(ev.file);
        if (n === -1) {
          errors.push(`${entry.id}: evidence file not found in 9router: ${ev.file}`);
        } else if (ev.line > n) {
          errors.push(
            `${entry.id}: evidence ${ev.file} line ${ev.line} exceeds file length (${n})`,
          );
        }
      }
      entries.push(entry);
    });
  }

  return { ok: errors.length === 0, entries, errors };
}
