// Skill rules (docs/contracts/skills.md). Pure: no framework imports.
export type SkillSource = "link" | "file";

export const MAX_SKILLS = 200;
export const MAX_SKILL_NAME = 64;
export const MAX_SKILL_DESCRIPTION = 280;
export const MAX_SKILL_URL = 2048;
export const MAX_SKILL_BYTES = 262_144;

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };
export interface SkillFields { name: string; description: string; source: SkillSource; url: string | null; content: string | null }
export type SkillChanges = Partial<Pick<SkillFields, "name" | "description" | "url" | "content">> & { enabled?: boolean };

const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });
const object = (input: unknown): Record<string, unknown> | undefined =>
  typeof input === "object" && input !== null && !Array.isArray(input) ? Object.fromEntries(Object.entries(input)) : undefined;

function name(raw: unknown): Parsed<string> {
  const value = typeof raw === "string" ? raw.trim() : "";
  return value && value.length <= MAX_SKILL_NAME ? { ok: true, value } : fail(`name must be 1-${MAX_SKILL_NAME} characters.`);
}

function description(raw: unknown): Parsed<string> {
  if (raw === undefined) return { ok: true, value: "" };
  const value = typeof raw === "string" ? raw.trim() : null;
  return value !== null && value.length <= MAX_SKILL_DESCRIPTION ? { ok: true, value } : fail(`description must be a string of at most ${MAX_SKILL_DESCRIPTION} characters.`);
}

// The MCP registry's URL rule: HTTPS, or HTTP only for localhost; no credentials or fragment.
function url(raw: unknown): Parsed<string> {
  const text = typeof raw === "string" ? raw.trim() : "";
  const message = "url must be an absolute HTTPS URL (HTTP only for localhost) without credentials or a fragment, up to 2048 characters.";
  if (!text || text.length > MAX_SKILL_URL) return fail(message);
  let parsed: URL;
  try { parsed = new URL(text); } catch { return fail(message); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname.toLowerCase());
  if (!(parsed.protocol === "https:" || parsed.protocol === "http:" && local) || parsed.username || parsed.password || parsed.hash) return fail(message);
  return { ok: true, value: parsed.toString() };
}

function content(raw: unknown): Parsed<string> {
  if (typeof raw !== "string" || !raw.trim()) return fail("content must be the non-empty text of a SKILL.md file.");
  if (new TextEncoder().encode(raw).byteLength > MAX_SKILL_BYTES) return fail(`content must be at most ${MAX_SKILL_BYTES / 1024} KiB.`);
  if (raw.includes("\u0000")) return fail("content must be text, not binary data.");
  return { ok: true, value: raw };
}

export function parseSkill(input: unknown): Parsed<SkillFields> {
  const body = object(input);
  if (!body) return fail("Body must be a JSON object.");
  const parsedName = name(body.name);
  if (!parsedName.ok) return parsedName;
  const parsedDescription = description(body.description);
  if (!parsedDescription.ok) return parsedDescription;
  if (body.source === "link") {
    if (body.content !== undefined) return fail("A link skill has no content.");
    const parsedUrl = url(body.url);
    return parsedUrl.ok ? { ok: true, value: { name: parsedName.value, description: parsedDescription.value, source: "link", url: parsedUrl.value, content: null } } : parsedUrl;
  }
  if (body.source === "file") {
    if (body.url !== undefined) return fail("A file skill has no url.");
    const parsedContent = content(body.content);
    return parsedContent.ok ? { ok: true, value: { name: parsedName.value, description: parsedDescription.value, source: "file", url: null, content: parsedContent.value } } : parsedContent;
  }
  return fail("source must be link or file.");
}

// A patch keeps the skill's source: url only for a link skill, content only for a file skill.
export function parseSkillPatch(input: unknown, source: SkillSource): Parsed<SkillChanges> {
  const body = object(input);
  if (!body) return fail("Body must be a JSON object.");
  const known = new Set(["name", "description", "url", "content", "enabled"]);
  if (body.source !== undefined) return fail("source cannot be changed; create a new skill instead.");
  const unknown = Object.keys(body).find((key) => !known.has(key));
  if (unknown) return fail(`Unknown field: ${unknown}.`);
  const changes: SkillChanges = {};
  if (body.name !== undefined) { const parsed = name(body.name); if (!parsed.ok) return parsed; changes.name = parsed.value; }
  if (body.description !== undefined) { const parsed = description(body.description); if (!parsed.ok) return parsed; changes.description = parsed.value; }
  if (body.url !== undefined) {
    if (source !== "link") return fail("A file skill has no url.");
    const parsed = url(body.url); if (!parsed.ok) return parsed; changes.url = parsed.value;
  }
  if (body.content !== undefined) {
    if (source !== "file") return fail("A link skill has no content.");
    const parsed = content(body.content); if (!parsed.ok) return parsed; changes.content = parsed.value;
  }
  if (body.enabled !== undefined) { if (typeof body.enabled !== "boolean") return fail("enabled must be a boolean."); changes.enabled = body.enabled; }
  return Object.keys(changes).length ? { ok: true, value: changes } : fail("Send at least one field to change.");
}
