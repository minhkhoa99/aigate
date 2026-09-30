const MIN_SIZE = 500;
const MAX_SIZE = 10 * 1024 * 1024;
const WINDOW = 1024;
const HEAD = 120;
const TAIL = 60;

type Filter = (text: string) => string;

function compact(text: string, filter: Filter): string {
  try {
    const result = filter(text);
    return result && result.length < text.length ? result : text;
  } catch {
    return text;
  }
}

function groupPaths(lines: string[], limitPerGroup: number, limitGroups: number): string {
  const groups = new Map<string, string[]>();
  for (const line of lines) {
    const sep = Math.max(line.lastIndexOf("/"), line.lastIndexOf("\\"));
    const dir = sep < 0 ? "." : line.slice(0, sep) || "/";
    const name = sep < 0 ? line : line.slice(sep + 1);
    const group = groups.get(dir) ?? [];
    group.push(name);
    groups.set(dir, group);
  }
  const dirs = [...groups.keys()].sort();
  let out = `${lines.length} files in ${dirs.length} dirs:\n`;
  for (const dir of dirs.slice(0, limitGroups)) {
    const names = groups.get(dir)!;
    out += `\n${dir}/ (${names.length}):\n`;
    out += names.slice(0, limitPerGroup).map((name) => `  ${name}`).join("\n");
    if (names.length > limitPerGroup) out += `\n  +${names.length - limitPerGroup}`;
    out += "\n";
  }
  if (dirs.length > limitGroups) out += `\n+${dirs.length - limitGroups} more dirs`;
  return out.trimEnd();
}

function filterGitLog(text: string): string {
  const out: string[] = [];
  let inCommit = false;
  let subjectSeen = false;
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const value = line.trim();
    if (/^[*|/\\ ]*commit [0-9a-f]{7,40}$/i.test(value)) {
      inCommit = true;
      subjectSeen = false;
      out.push(value);
    } else if (inCommit && /^[*|/\\ ]*(Author|Date):/i.test(value)) out.push(value);
    else if (inCommit && !subjectSeen && /^[*|/\\ ]*    \S/.test(line)) {
      out.push(`  Subject: ${value}`);
      subjectSeen = true;
    } else if (inCommit && /^\d+ files? changed/.test(value)) out.push(`  ${value}`);
    else if (!inCommit && /^[0-9a-f]{7,40}\s+\S/i.test(value)) out.push(value);
    if (out.length >= 200) break;
  }
  return out.join("\n");
}

function filterDiff(text: string): string {
  const out: string[] = [];
  let file = "";
  let added = 0;
  let removed = 0;
  let inHunk = false;
  let shown = 0;
  let skipped = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith("diff --git")) {
      if (skipped) out.push(`  ... (${skipped} lines truncated)`);
      if (file && (added || removed)) out.push(`  +${added} -${removed}`);
      file = line.split(" b/").slice(1).join(" b/") || "unknown";
      added = removed = shown = skipped = 0;
      inHunk = false;
      out.push(`\n${file}`);
    } else if (line.startsWith("@@")) {
      if (skipped) out.push(`  ... (${skipped} lines truncated)`);
      skipped = shown = 0;
      inHunk = true;
      out.push(`  ${line}`);
    } else if (inHunk && line.startsWith("+") && !line.startsWith("+++")) {
      added++;
      if (shown++ < 100) out.push(`  ${line}`); else skipped++;
    } else if (inHunk && line.startsWith("-") && !line.startsWith("---")) {
      removed++;
      if (shown++ < 100) out.push(`  ${line}`); else skipped++;
    } else if (inHunk && shown > 0 && !line.startsWith("\\")) {
      if (shown++ < 100) out.push(`  ${line}`); else skipped++;
    }
    if (out.length >= 500) {
      out.push("... (more changes truncated)");
      break;
    }
  }
  if (skipped) out.push(`  ... (${skipped} lines truncated)`);
  if (file && (added || removed)) out.push(`  +${added} -${removed}`);
  return out.join("\n");
}

function filterStatus(text: string): string {
  let branch = "";
  let staged = 0;
  let modified = 0;
  let untracked = 0;
  let conflicts = 0;
  let inUntracked = false;
  const files: string[] = [];
  for (const line of text.split("\n")) {
    const head = line.match(/^On branch (\S+)/) ?? line.match(/^##\s*(.+)/);
    if (head) { branch = head[1]; inUntracked = false; continue; }
    if (/^Untracked files:/.test(line.trim())) { inUntracked = true; continue; }
    if (/^[ MADRCU?!][ MADRCU?!] /.test(line)) {
      inUntracked = false;
      const x = line[0]; const y = line[1]; const path = line.slice(3);
      if (x === "?" && y === "?") { untracked++; if (files.length < 10) files.push(path); }
      else {
        if ("MADRC".includes(x)) { staged++; if (files.length < 10) files.push(path); }
        if (x === "U" || y === "U") conflicts++;
        if (y === "M" || y === "D") { modified++; if (files.length < 10) files.push(path); }
      }
    } else {
      const long = line.match(/^\s*(modified|new file|deleted|renamed|both modified):\s+(.+)$/);
      if (long) {
        if (long[1] === "both modified") conflicts++;
        else if (long[1] === "new file" || long[1] === "renamed") staged++;
        else modified++;
        if (files.length < 10) files.push(long[2]);
      } else if (inUntracked && line.trim() && !/^\(use /.test(line.trim())) {
        untracked++;
        if (files.length < 10) files.push(line.trim());
      }
    }
  }
  return [branch && `* ${branch}`, staged && `+ Staged: ${staged} files`, modified && `~ Modified: ${modified} files`, untracked && `? Untracked: ${untracked} files`, conflicts && `conflicts: ${conflicts} files`, ...files.map((path) => `   ${path}`)].filter(Boolean).join("\n") || "clean — nothing to commit";
}

function filterBuild(text: string): string {
  const lines = text.split("\n");
  const keep: string[] = [];
  let inDiagnostic = false;
  for (const line of lines) {
    const value = line.trim();
    if (inDiagnostic && /^\s*(-->|\||\d+\s*\||=)/.test(line)) { keep.push(line); continue; }
    inDiagnostic = false;
    if (/\b(error|failed|warning|deprecated)\b|\[ERROR\]|BUILD (SUCCESS|FAILED)|Successfully (installed|built)|^Finished\b|\d+ (packages?|vulnerabilities|warnings?|errors?)/i.test(line)) {
      keep.push(line);
      inDiagnostic = /^\s*(error|warning)(\[|:)/i.test(value) || /^error -->/i.test(value);
    }
  }
  if (!keep.length) return text;
  return keep.slice(0, 100).join("\n");
}

function filterGrep(text: string): string {
  const matches = new Map<string, string[]>();
  const counts = new Map<string, number>();
  let total = 0;
  for (const line of text.split("\n")) {
    const match = line.match(/^(.*?):(\d+):(.*)$/);
    if (!match) continue;
    total++;
    counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
    const rows = matches.get(match[1]) ?? [];
    if (rows.length < 10) rows.push(`  ${match[2].padStart(4)}: ${match[3].trim()}`);
    matches.set(match[1], rows);
  }
  if (!total) return text;
  let out = `${total} matches in ${matches.size}F:\n`;
  for (const [file, rows] of [...matches].sort(([a], [b]) => a.localeCompare(b))) {
    out += `\n[file] ${file}:\n${rows.join("\n")}\n`;
    const omitted = Math.max(0, (counts.get(file) ?? 0) - rows.length);
    if (omitted) out += `  +${omitted}\n`;
  }
  return out;
}

function filterFind(text: string): string {
  return groupPaths(text.split("\n").map((line) => line.trim()).filter(Boolean), 10, 20);
}

function filterTree(text: string): string {
  const lines = text.split("\n").filter((line) => !(line.includes("director") && line.includes("file")));
  while (lines.at(-1)?.trim() === "") lines.pop();
  const result = lines.slice(0, 200);
  if (lines.length > result.length) result.push(`... +${lines.length - result.length} more lines`);
  return result.join("\n");
}

function filterLs(text: string): string {
  const rows: string[] = [];
  for (const line of text.split("\n")) {
    if (!/^[dl-][rwx-]{9}\s/.test(line)) continue;
    const date = /\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+(?:\d{4}|\d{2}:\d{2})\s+/.exec(line);
    if (!date) return text;
    const name = line.slice(date.index + date[0].length);
    if (![".", "..", "node_modules", ".git", "dist", "build"].includes(name)) rows.push(name);
  }
  return rows.join("\n");
}

function filterSearchList(text: string): string {
  const [header = "", ...rest] = text.split("\n");
  const paths = rest.map((line) => line.trim()).filter((line) => line.startsWith("- ")).map((line) => line.slice(2));
  return paths.length ? `${header}\n${groupPaths(paths, 10, 20)}` : text;
}

function deduplicate(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length;) {
    let end = i + 1;
    while (end < lines.length && lines[end] === lines[i]) end++;
    out.push(lines[i]);
    if (end - i > 1) out.push(`  ... (${end - i - 1} duplicate lines)`);
    i = end;
    if (out.length >= 2000) { out.push("... (output truncated)"); break; }
  }
  return out.join("\n");
}

function truncate(text: string): string {
  const lines = text.split("\n");
  if (lines.length < 250) return text;
  const cut = lines.length - HEAD - TAIL;
  return [...lines.slice(0, HEAD), `... +${cut} lines truncated`, ...lines.slice(-TAIL)].join("\n");
}

function autodetect(text: string): Filter | undefined {
  const head = text.slice(0, WINDOW);
  const lines = head.split("\n");
  const nonempty = lines.filter((line) => line.trim());
  if (/^[*|/\\ ]*commit [0-9a-f]{7,40}$/im.test(head)) return filterGitLog;
  if (/^diff --git |^@@ /m.test(head)) return filterDiff;
  if (/^On branch |^nothing to commit|^Changes (not |to be )|^Untracked files:/m.test(head)) return filterStatus;
  if (/^(npm (warn|error|ERR!)|yarn (warn|error)|\s*Compiling\s+\S+|\s*Downloading\s+\S+|\[ERROR\]|BUILD (SUCCESS|FAILED)|ERROR:)/im.test(head)) return filterBuild;
  if (nonempty.length >= 3 && nonempty.filter((line) => /^[ MADRCU?!][ MADRCU?!] \S/.test(line)).length / nonempty.length >= 0.6) return filterStatus;
  if (nonempty.slice(0, 5).some((line) => /^.*?:\d+:/.test(line))) return filterGrep;
  if (nonempty.length >= 3 && nonempty.every((line) => /^[A-Za-z]:[\\/]/.test(line.trim()) || (!line.includes(":") && (line.trim().startsWith(".") || line.includes("/"))))) return filterFind;
  if (/[├└]──|│  /.test(head)) return filterTree;
  if (/^total \d+$/m.test(head) || (head.match(/^[-dl][rwx-]{9}/gm)?.length ?? 0) >= 3) return filterLs;
  if (/^Result of search in '.+' \(total \d+ files?\):/m.test(head)) return filterSearchList;
  if (text.split("\n").length >= 250 && nonempty.filter((line) => /^\s*\d+\|/.test(line)).length / Math.max(1, nonempty.length) >= 0.7) return truncate;
  if (nonempty.length >= 5) return deduplicate;
  if (text.split("\n").length >= 250) return truncate;
}

export function compressToolOutput(text: string): string {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes < MIN_SIZE || bytes > MAX_SIZE) return text;
  const filter = autodetect(text);
  return filter ? compact(text, filter) : text;
}
