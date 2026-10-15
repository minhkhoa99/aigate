// docs/contracts/skills.md. Pure helpers for the Skills screen; the server re-validates everything.
export const MAX_SKILL_BYTES = 262_144;
export const MAX_SKILL_NAME = 64;
export const MAX_SKILL_DESCRIPTION = 280;

export const skillBytes = (text: string): number => new TextEncoder().encode(text).byteLength;

export const skillFileUrl = (origin: string, id: string): string => `${origin}/v1/skills/${encodeURIComponent(id)}/SKILL.md`;

// The name and description a SKILL.md declares in its leading YAML frontmatter, if any. Only plain one-line
// `key: value` pairs are read; anything else is left for the operator to type.
export function readFrontmatter(text: string): { name?: string; description?: string } {
  const match = /^\uFEFF?---\r?\n([\s\S]{0,8192}?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) return {};
  const found: { name?: string; description?: string } = {};
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const pair = /^(name|description)\s*:\s*(.*)$/.exec(line);
    if (!pair) continue;
    const value = (pair[2] ?? "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();
    if (!value) continue;
    if (pair[1] === "name") found.name = value.slice(0, MAX_SKILL_NAME);
    else found.description = value.slice(0, MAX_SKILL_DESCRIPTION);
  }
  return found;
}
