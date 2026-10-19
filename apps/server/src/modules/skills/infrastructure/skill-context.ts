import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { readBoundedText, type CanonicalRequest, type HttpTransportPort } from "@aigate/engine";
import { HTTP_TRANSPORT } from "../../transport/transport.token.js";
import { content as validContent, MAX_SKILL_BYTES } from "../domain/skill.js";
import {
  buildGraph, CATALOG_LIMIT, choose, excerpt, queryText, renderSkills, score, skillTag, type CatalogEntry, type Scored, type SelectedSkill, type SkillGraph,
} from "../domain/skill-graph.js";
import { requestedSkill } from "../domain/skill-tool.js";
import { SkillsRepository, type ContextSkill } from "./skills.repo.js";

export interface SkillSettings {
  readonly skillsMaxSelected: number; readonly skillsBudgetChars: number; readonly skillsCatalogEnabled: boolean; readonly skillsSelection: "lexical" | "hybrid";
}
export interface SkillPlan { scored: Scored[]; always: { id: string; name: string }[]; applied: Scored[]; block: string | null }
// The block one kind of target gets, and the ids it adds.
export interface PreparedSkills { readonly block: string | null; readonly ids: readonly string[] }
// docs/contracts/skills.md, "Model-loaded skills": one client request's skills. Every target can take `lexical`; a
// target that calls tools takes `hybrid`, whose `names` the model may load. `loaded` collects what it loaded.
export interface SkillSession {
  readonly text: string;
  readonly key: string | null;
  readonly plan: SkillPlan;
  readonly lexical: PreparedSkills;
  readonly hybrid: (PreparedSkills & { readonly preloaded: readonly { id: string; name: string }[]; readonly names: readonly string[]; readonly remaining: number }) | null;
  readonly share: number;
  readonly loaded: Set<string>;
}
interface Loaded { graph: SkillGraph; always: ContextSkill[] }

const FETCH_TIMEOUT_MS = 8000;
// Shared by the always-on skills, apart from the budget of the matched ones.
export const ALWAYS_BUDGET_CHARS = 4000;
const HTML_MESSAGE = "The link returned an HTML web page, not a markdown file. Use the raw file URL (on GitHub, the Raw button or raw.githubusercontent.com).";
const isHtml = (text: string) => /^\uFEFF?\s*<(?:!doctype\s+html|html[\s>])/i.test(text.slice(0, 1024));
// Skills a conversation loaded, offered again on its next turns (clients resend history without the hidden rounds).
const MEMORY_ENTRIES = 1000;
const MEMORY_TTL_MS = 30 * 60_000;
const MEMORY_IDS = 5;
const KEY_CHARS = 4096;

// The first user text and the AIGate key identify a conversation well enough to offer its skills again.
function conversationKey(request: CanonicalRequest, apiKeyId: string | null): string | null {
  const first = request.messages.find((message) => message.role === "user" && message.content.some((part) => part.type === "text" && part.text.trim()));
  if (!first) return null;
  const text = first.content.map((part) => part.type === "text" ? part.text : "").join("\n").slice(0, KEY_CHARS);
  return createHash("sha256").update(`${apiKeyId ?? ""}\n${text}`).digest("hex");
}

// docs/contracts/skills.md, "Automatic skills". The graph is built once per repository version (a write bumps it),
// so a request only scores in memory and reads the text of at most MAX_TEXTS skills.
@Injectable()
export class SkillContext {
  private cached: { version: number; loaded: Promise<Loaded> } | undefined;
  private readonly memory = new Map<string, { ids: string[]; until: number }>();

  constructor(private readonly skills: SkillsRepository, @Inject(HTTP_TRANSPORT) private readonly transport: HttpTransportPort) {}

  // The lexical selection: always-on skills, the best matches and the catalogue.
  async plan(text: string, settings: SkillSettings): Promise<SkillPlan> {
    const { graph, always } = await this.load();
    const scored = score(graph, text);
    const chosen = choose(scored, settings.skillsMaxSelected);
    if (!chosen.length && !always.length) return { scored, always: [], applied: [], block: null };
    const texts = await this.skills.texts([...always.map((skill) => skill.id), ...chosen.map((item) => item.id)]);
    const standing = this.standing(always, texts, text);
    const share = Math.floor(settings.skillsBudgetChars / Math.max(1, chosen.length));
    const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    const applied: Scored[] = [];
    const selected: SelectedSkill[] = [];
    for (const item of chosen) {
      const part = this.part(nodes.get(item.id), texts.get(item.id), text, share);
      if (!part) continue;
      applied.push(item);
      selected.push({ name: item.name, text: part });
    }
    if (!applied.length && !standing.parts.length) return { scored, always: standing.kept, applied, block: null };
    const chosenIds = new Set(applied.map((item) => item.id));
    const catalog: CatalogEntry[] = !applied.length || !settings.skillsCatalogEnabled ? [] : this.ranked(graph, scored)
      .sort((x, y) => Number(chosenIds.has(y.id)) - Number(chosenIds.has(x.id)))
      .slice(0, CATALOG_LIMIT).map((node) => ({ name: node.name, description: node.description, selected: chosenIds.has(node.id) }));
    return { scored, always: standing.kept, applied, block: renderSkills(catalog, selected, standing.parts) };
  }

  // Both selections for one request. Hybrid adds the always-on skills, the skills this conversation loaded before and
  // the single best match, then lists the rest for the model to load, while the per-request maximum allows.
  async session(text: string, settings: SkillSettings, key: string | null = null): Promise<SkillSession> {
    const plan = await this.plan(text, settings);
    const lexical = { block: plan.block, ids: [...plan.always, ...plan.applied].map((item) => item.id) };
    const max = settings.skillsMaxSelected;
    const share = Math.floor(settings.skillsBudgetChars / Math.max(1, max));
    const base = { text, key, plan, lexical, share, loaded: new Set<string>() };
    if (settings.skillsSelection !== "hybrid") return { ...base, hybrid: null };
    const { graph, always } = await this.load();
    const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    const wanted = [...new Set([...this.remembered(key), ...choose(plan.scored, 1).map((item) => item.id)])].filter((id) => nodes.has(id)).slice(0, max);
    const texts = await this.skills.texts([...always.map((skill) => skill.id), ...wanted]);
    const standing = this.standing(always, texts, text);
    const preloaded: { id: string; name: string }[] = [];
    const selected: SelectedSkill[] = [];
    for (const id of wanted) {
      const node = nodes.get(id);
      const part = this.part(node, texts.get(id), text, share);
      if (!node || !part) continue;
      preloaded.push({ id, name: node.name });
      selected.push({ name: node.name, text: part });
    }
    const remaining = max - preloaded.length;
    const loadable = remaining > 0 ? this.ranked(graph, plan.scored).filter((node) => !preloaded.some((item) => item.id === node.id)).slice(0, CATALOG_LIMIT) : [];
    const catalog = loadable.map((node) => ({ name: node.name, description: node.description, selected: false }));
    const block = standing.parts.length || selected.length || catalog.length ? renderSkills(catalog, selected, standing.parts, catalog.length > 0) : null;
    return { ...base, hybrid: { block, ids: [...standing.kept, ...preloaded].map((item) => item.id), preloaded, names: loadable.map((node) => node.name), remaining } };
  }

  // The session of a /v1 request: its query text and its conversation.
  sessionFor(request: CanonicalRequest, settings: SkillSettings, apiKeyId: string | null): Promise<SkillSession> {
    return this.session(queryText(request), settings, conversationKey(request, apiKeyId));
  }

  // The answers to one round of hidden tool calls, in call order. Each call loads at most one skill; the request's
  // maximum, unknown names and repeats are answered in words so the model can go on.
  async answer(session: SkillSession, calls: readonly { id: string; arguments: string }[]): Promise<{ id: string; text: string }[]> {
    const { graph } = await this.load();
    const byName = new Map(graph.nodes.map((node) => [node.name.toLowerCase(), node]));
    const offered = new Set((session.hybrid?.names ?? []).map((name) => name.toLowerCase()));
    const preloaded = new Set(session.hybrid?.ids ?? []);
    const plans = calls.map((call) => {
      const name = requestedSkill(call.arguments);
      const node = name && offered.has(name.toLowerCase()) ? byName.get(name.toLowerCase()) : undefined;
      return { call, name, node };
    });
    const fresh: SkillGraph["nodes"][number][] = [];
    for (const { node } of plans) {
      if (!node || preloaded.has(node.id) || session.loaded.has(node.id) || fresh.includes(node)) continue;
      if (session.loaded.size + fresh.length >= (session.hybrid?.remaining ?? 0)) break;
      fresh.push(node);
    }
    const texts = await this.skills.texts(fresh.map((node) => node.id));
    const answers = plans.map(({ call, name, node }) => {
      if (!node) return { id: call.id, text: `No skill named "${name ?? ""}" can be loaded. Use one of the names listed under "Skills you can load".` };
      if (preloaded.has(node.id) || session.loaded.has(node.id)) return { id: call.id, text: `The skill "${node.name}" is already in this conversation; follow it as given.` };
      const part = fresh.includes(node) ? this.part(node, texts.get(node.id), session.text, session.share) : "";
      if (!part) return { id: call.id, text: fresh.includes(node) ? `The skill "${node.name}" has no text to load.` : "The skill limit for this request is reached; answer with the skills you have." };
      session.loaded.add(node.id);
      return { id: call.id, text: skillTag({ name: node.name, text: part }) };
    });
    this.remember(session.key, [...session.loaded]);
    return answers;
  }

  // Fetches a link skill's document once (no retry); the outcome, success or error, is stored.
  async fetchLink(id: string, url: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const outcome = await this.download(url);
    await this.skills.storeLink(id, outcome.ok ? { content: outcome.content } : { error: outcome.message });
    return outcome.ok ? { ok: true } : outcome;
  }

  private standing(always: readonly ContextSkill[], texts: Map<string, string>, text: string): { kept: { id: string; name: string }[]; parts: SelectedSkill[] } {
    const kept: { id: string; name: string }[] = [];
    const parts: SelectedSkill[] = [];
    for (const skill of always) {
      const part = this.part(skill, texts.get(skill.id), text, Math.floor(ALWAYS_BUDGET_CHARS / always.length));
      if (!part) continue;
      kept.push({ id: skill.id, name: skill.name });
      parts.push({ name: skill.name, text: part });
    }
    return { kept, parts };
  }

  private part(skill: Pick<ContextSkill, "document"> | undefined, body: string | undefined, text: string, budget: number): string {
    return skill && body ? excerpt(body, skill.document, text, budget) : "";
  }

  // Auto skills by score, then by name.
  private ranked(graph: SkillGraph, scored: readonly Scored[]) {
    const rank = new Map(scored.map((item, index) => [item.id, index]));
    return [...graph.nodes].sort((x, y) => (rank.get(x.id) ?? Infinity) - (rank.get(y.id) ?? Infinity) || (x.name < y.name ? -1 : 1));
  }

  private remembered(key: string | null): string[] {
    const entry = key ? this.memory.get(key) : undefined;
    if (!key || !entry) return [];
    this.memory.delete(key);
    if (entry.until < Date.now()) return [];
    this.memory.set(key, entry);
    return entry.ids;
  }

  private remember(key: string | null, ids: readonly string[]): void {
    if (!key || !ids.length) return;
    const merged = [...new Set([...this.remembered(key), ...ids])].slice(-MEMORY_IDS);
    this.memory.delete(key);
    this.memory.set(key, { ids: merged, until: Date.now() + MEMORY_TTL_MS });
    while (this.memory.size > MEMORY_ENTRIES) { const oldest = this.memory.keys().next().value; if (oldest === undefined) break; this.memory.delete(oldest); }
  }

  private async download(url: string): Promise<{ ok: true; content: string } | { ok: false; message: string }> {
    let response;
    try {
      response = await this.transport.send({ method: "GET", url, headers: { accept: "text/markdown, text/plain;q=0.9, */*;q=0.1" }, timeoutMs: FETCH_TIMEOUT_MS },
        { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), requestId: randomUUID() });
    } catch {
      return { ok: false, message: "The link could not be reached within 8 seconds." };
    }
    const type = (response.headers["content-type"] ?? "").toLowerCase();
    if (response.status < 200 || response.status >= 300) { await response.body?.cancel().catch(() => undefined); return { ok: false, message: `The link answered HTTP ${response.status}.` }; }
    if (type && !type.startsWith("text/") && !type.includes("markdown") && !type.startsWith("application/octet-stream")) {
      await response.body?.cancel().catch(() => undefined);
      return { ok: false, message: `The link returned ${type.split(";")[0]}, not a text document.` };
    }
    if (type.startsWith("text/html")) { await response.body?.cancel().catch(() => undefined); return { ok: false, message: HTML_MESSAGE }; }
    let body: string;
    try { body = await readBoundedText(response.body, MAX_SKILL_BYTES); } catch { return { ok: false, message: `The document could not be read or is larger than ${MAX_SKILL_BYTES / 1024} KiB.` }; }
    if (isHtml(body)) return { ok: false, message: HTML_MESSAGE };
    const checked = validContent(body);
    return checked.ok ? { ok: true, content: checked.value } : checked;
  }

  private load(): Promise<Loaded> {
    const version = this.skills.version;
    if (this.cached?.version !== version) {
      const loaded = this.skills.contextSkills().then((skills) => ({
        graph: buildGraph(skills.filter((skill) => skill.mode === "auto")), always: skills.filter((skill) => skill.mode === "always"),
      }));
      loaded.catch(() => { if (this.cached?.loaded === loaded) this.cached = undefined; });
      this.cached = { version, loaded };
    }
    return this.cached.loaded;
  }
}
