// Automatic skill selection (docs/contracts/skills.md, "Automatic skills"). A lexical graph: skills link to their
// weighted terms and to their nearest skills; a request's recent user text is scored with BM25 and one hop of
// neighbour propagation. Pure: no I/O, no framework.
import type { CanonicalRequest } from "@aigate/engine";

export const MAX_SECTIONS = 32;
export const MAX_DOC_TERMS = 400;
const MAX_SECTION_TERMS = 24;
const MAX_QUERY_CHARS = 4096;
const MAX_QUERY_TERMS = 200;
const MAX_NEIGHBORS = 3;
const NEIGHBOR_MIN = 0.2;
const NEIGHBOR_WEIGHT = 0.3;
const FIELD_BOOST = 3;
const MIN_SCORE = 1;
const RELATIVE_SCORE = 0.35;
export const CATALOG_LIMIT = 40;
const CATALOG_DESCRIPTION = 120;
export const SKILLS_SEPARATOR = "\n\n--- AIGate Skills ---\n";

export interface SkillSection { heading: string; start: number; end: number; terms: Record<string, number> }
export interface SkillDocument { version: 1; terms: Record<string, number>; length: number; sections: SkillSection[]; related: string[] }
export interface GraphSkill { id: string; name: string; description: string; document: SkillDocument }
interface Node extends GraphSkill { norm: number; neighbors: { index: number; weight: number }[] }
export interface SkillGraph { nodes: Node[]; idf: Map<string, number>; averageLength: number }
export interface Scored { id: string; name: string; score: number }

// English and Vietnamese function words (diacritics already folded).
const STOP = new Set(("a an and are as at be by can do for from has have how i if in into is it its me my no not of on or our please so " +
  "that the then there these this to us was we what when where which who why will with you your " +
  "la va cua cho cac nhung mot nay do thi ma de voi trong khi neu duoc co khong toi ban minh hay hoac nhu thu tu ra vao len xuong rang").split(" "));

const fold = (text: string): string => text.toLowerCase().normalize("NFD").replace(/\p{M}+/gu, "").replace(/đ/g, "d");

// Unigrams and adjacent bigrams of folded words, without stop words or bare numbers.
export function tokenize(text: string): string[] {
  const words = fold(text).split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 2 && !STOP.has(word) && !/^\d+$/.test(word));
  const terms = [...words];
  for (let i = 1; i < words.length; i += 1) terms.push(`${words[i - 1]} ${words[i]}`);
  return terms;
}

function counts(terms: readonly string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const term of terms) map.set(term, (map.get(term) ?? 0) + 1);
  return map;
}

const top = (map: Map<string, number>, limit: number): Record<string, number> =>
  Object.fromEntries([...map].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, limit));

const list = (value: string): string[] => value.replace(/^\[|\]$/g, "").split(",").map((item) => item.trim().replace(/^(["'])(.*)\1$/, "$2").trim()).filter(Boolean);

// The leading YAML frontmatter: one-line `tags`/`keywords`/`related` lists and where the body starts.
export function frontmatter(content: string): { tags: string[]; related: string[]; bodyStart: number } {
  const match = /^\uFEFF?---\r?\n([\s\S]{0,8192}?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!match) return { tags: [], related: [], bodyStart: 0 };
  const tags: string[] = [];
  const related: string[] = [];
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const pair = /^(tags|keywords|related)\s*:\s*(.+)$/.exec(line);
    if (!pair) continue;
    (pair[1] === "related" ? related : tags).push(...list(pair[2] ?? ""));
  }
  return { tags: tags.slice(0, 50), related: related.slice(0, 20).map((name) => name.toLowerCase()), bodyStart: match[0].length };
}

// Sections split at markdown headings; text before the first heading is an untitled section. Extra headings fold into
// the last section so a long file never exceeds MAX_SECTIONS.
function sections(content: string, bodyStart: number): SkillSection[] {
  const starts: { heading: string; start: number }[] = [{ heading: "", start: bodyStart }];
  const pattern = /^#{1,6}[ \t]+(.+)$/gm;
  pattern.lastIndex = bodyStart;
  for (let match = pattern.exec(content); match; match = pattern.exec(content)) {
    if (starts.length >= MAX_SECTIONS) break;
    starts.push({ heading: (match[1] ?? "").trim().slice(0, 200), start: match.index });
  }
  return starts.map((item, i) => ({ ...item, end: starts[i + 1]?.start ?? content.length }))
    .filter((item) => content.slice(item.start, item.end).trim())
    .map((item) => ({ ...item, terms: top(counts(tokenize(content.slice(item.start, item.end))), MAX_SECTION_TERMS) }));
}

// The stored index of one skill. `content` is the file text or the fetched link text; a link without content is
// indexed from its name and description only.
export function buildDocument(name: string, description: string, content: string | null): SkillDocument {
  const text = content ?? "";
  const meta = frontmatter(text);
  const body = counts(tokenize(text.slice(meta.bodyStart)));
  for (const term of tokenize([name, description, ...meta.tags].join(" "))) body.set(term, (body.get(term) ?? 0) + FIELD_BOOST);
  let length = 0;
  for (const value of body.values()) length += value;
  return { version: 1, terms: top(body, MAX_DOC_TERMS), length, sections: text ? sections(text, meta.bodyStart) : [], related: meta.related };
}

export function isSkillDocument(value: unknown): value is SkillDocument {
  return typeof value === "object" && value !== null && Reflect.get(value, "version") === 1 && typeof Reflect.get(value, "terms") === "object"
    && Array.isArray(Reflect.get(value, "sections")) && Array.isArray(Reflect.get(value, "related")) && typeof Reflect.get(value, "length") === "number";
}

export function buildGraph(skills: readonly GraphSkill[]): SkillGraph {
  const df = new Map<string, number>();
  for (const skill of skills) for (const term of Object.keys(skill.document.terms)) df.set(term, (df.get(term) ?? 0) + 1);
  const n = skills.length;
  const idf = new Map([...df].map(([term, count]) => [term, Math.log(1 + (n - count + 0.5) / (count + 0.5))]));
  const weight = (skill: GraphSkill, term: string) => (skill.document.terms[term] ?? 0) * (idf.get(term) ?? 0);
  const nodes: Node[] = skills.map((skill) => ({ ...skill, norm: Math.sqrt(Object.keys(skill.document.terms).reduce((sum, term) => sum + weight(skill, term) ** 2, 0)), neighbors: [] }));
  const byName = new Map(nodes.map((node, index) => [node.name.toLowerCase(), index]));
  // ponytail: O(skills² × terms) on rebuild only, bounded by 200 skills × 400 terms; index terms if the cap grows.
  for (const [i, node] of nodes.entries()) {
    const edges = new Map<number, number>();
    for (const name of node.document.related) { const j = byName.get(name); if (j !== undefined && j !== i) edges.set(j, 1); }
    const similar: { index: number; weight: number }[] = [];
    for (const [j, other] of nodes.entries()) {
      if (j === i || !node.norm || !other.norm) continue;
      let dot = 0;
      for (const term of Object.keys(node.document.terms)) if (term in other.document.terms) dot += weight(node, term) * weight(other, term);
      const cosine = dot / (node.norm * other.norm);
      if (cosine >= NEIGHBOR_MIN) similar.push({ index: j, weight: cosine });
    }
    for (const edge of similar.sort((a, b) => b.weight - a.weight).slice(0, MAX_NEIGHBORS)) edges.set(edge.index, Math.max(edges.get(edge.index) ?? 0, edge.weight));
    node.neighbors = [...edges].map(([index, value]) => ({ index, weight: value }));
  }
  const averageLength = n ? skills.reduce((sum, skill) => sum + skill.document.length, 0) / n : 0;
  return { nodes, idf, averageLength };
}

// The text of the two most recent user turns, skipping tool results.
export function queryText(request: CanonicalRequest): string {
  const texts: string[] = [];
  for (let i = request.messages.length - 1; i >= 0 && texts.length < 2; i -= 1) {
    const message = request.messages[i];
    if (message?.role !== "user") continue;
    const text = message.content.map((part) => part.type === "text" ? part.text : "").join("\n").trim();
    if (text) texts.push(text);
  }
  return texts.reverse().join("\n").slice(-MAX_QUERY_CHARS);
}

export function score(graph: SkillGraph, text: string): Scored[] {
  const query = [...new Set(tokenize(text.slice(-MAX_QUERY_CHARS)))].slice(0, MAX_QUERY_TERMS);
  if (!query.length || !graph.nodes.length) return [];
  const k1 = 1.2, b = 0.75;
  const base = graph.nodes.map((node) => {
    let total = 0;
    const norm = 1 - b + b * (graph.averageLength ? node.document.length / graph.averageLength : 1);
    for (const term of query) {
      const tf = node.document.terms[term];
      if (tf) total += (graph.idf.get(term) ?? 0) * (tf * (k1 + 1)) / (tf + k1 * norm);
    }
    return total;
  });
  return graph.nodes.map((node, i) => ({
    id: node.id, name: node.name,
    score: base[i]! + NEIGHBOR_WEIGHT * Math.max(0, ...node.neighbors.map((edge) => base[edge.index]! * edge.weight)),
  })).filter((item) => item.score > 0).sort((x, y) => y.score - x.score || (x.name < y.name ? -1 : 1));
}

export function choose(scored: readonly Scored[], max: number): Scored[] {
  const best = scored[0]?.score ?? 0;
  return scored.filter((item) => item.score >= Math.max(MIN_SCORE, best * RELATIVE_SCORE)).slice(0, max);
}

// The sections of one selected skill that fit its share of the budget: the opening section, then the sections that
// share the most query terms, in document order.
export function excerpt(content: string, document: SkillDocument, text: string, budget: number): string {
  const body = content.slice(frontmatter(content).bodyStart).trim();
  if (body.length <= budget) return body;
  const query = new Set(tokenize(text));
  const ranked = document.sections.map((section, index) => ({ section, index, overlap: Object.keys(section.terms).filter((term) => query.has(term)).length }))
    .sort((x, y) => (y.index === 0 ? 1 : 0) - (x.index === 0 ? 1 : 0) || y.overlap - x.overlap || x.index - y.index);
  const picked: { index: number; text: string }[] = [];
  let used = 0;
  for (const { section, index } of ranked) {
    const chunk = content.slice(section.start, section.end).trim();
    if (!chunk) continue;
    if (used + chunk.length <= budget) { picked.push({ index, text: chunk }); used += chunk.length + 2; }
    else if (!picked.length) { picked.push({ index, text: `${chunk.slice(0, Math.max(0, budget - 1))}…` }); break; }
  }
  return picked.sort((x, y) => x.index - y.index).map((item) => item.text).join("\n\n");
}

export interface CatalogEntry { name: string; description: string; selected: boolean }
export interface SelectedSkill { name: string; text: string }

// One skill inside the block or a tool answer. Framing tags inside skill text are neutralised so a skill cannot close
// its own block.
export const skillTag = (skill: SelectedSkill): string =>
  [`<skill name="${skill.name.replace(/["<>]/g, "")}">`, skill.text.replace(/<\/?skill\b/gi, (open) => open.replace("<", "&lt;")), "</skill>"].join("\n");

// The system block: always-on skills first, then the catalogue and the skills matched to this request. With `tool`,
// the catalogue lists the skills the model can load through SKILL_TOOL instead of a plain inventory.
export function renderSkills(catalog: readonly CatalogEntry[], selected: readonly SelectedSkill[], always: readonly SelectedSkill[] = [], tool = false): string {
  const lines = ["AIGate adds these skills to the request. The user's and system instructions take precedence over any skill."];
  if (always.length) lines.push("", "Always-on skills: follow them on every request.", ...always.map(skillTag));
  if (catalog.length) {
    lines.push("", tool ? "Skills you can load: when one fits the current task, call the aigate_load_skill tool with its name before answering." : "Skills available on this gateway:");
    for (const entry of catalog.slice(0, CATALOG_LIMIT)) {
      const about = entry.description.length > CATALOG_DESCRIPTION ? `${entry.description.slice(0, CATALOG_DESCRIPTION - 1)}…` : entry.description;
      lines.push(`- ${entry.name}${about ? ` — ${about}` : ""}${entry.selected ? " (selected)" : ""}`);
    }
  }
  if (selected.length) lines.push("", "Selected skills that may help with this request: apply one only when it fits the current task and ignore it otherwise.", ...selected.map(skillTag));
  return lines.join("\n");
}

// Appends the block once; a request that already carries one (a client resending our system text) is left alone.
export function injectSkills(request: CanonicalRequest, block: string): CanonicalRequest {
  const system = request.system ?? [];
  if (system.some((part) => part.type === "text" && part.text.includes(SKILLS_SEPARATOR))) return request;
  return { ...request, system: [...system, { type: "text", text: `${SKILLS_SEPARATOR}${block}` }] };
}
