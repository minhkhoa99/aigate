// Settings keys and their editable shape (docs/contracts/settings.md).
export interface Settings {
  requireLogin: boolean;
  requireApiKey: boolean;
}

export type SettingsPatch = Partial<Settings>;

export type PatchResult =
  | { ok: true; patch: SettingsPatch }
  | { ok: false; message: string; keys: string[] };

// Allowlist, not a blocklist: a key missing here cannot be written (CWE-915). The Record type
// makes the compiler fail when a Settings key is added without deciding whether it is editable.
const EDITABLE: Record<keyof Settings, true> = { requireLogin: true, requireApiKey: true };
// Bound the echoed key list; the body itself is bounded by the HTTP body limit.
const MAX_REPORTED_KEYS = 20;

function isEditable(key: string): key is keyof Settings {
  return Object.hasOwn(EDITABLE, key);
}

export function parseSettingsPatch(body: unknown): PatchResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, message: "Body must be a JSON object of settings to change", keys: [] };
  }
  const patch: SettingsPatch = {};
  const rejected: string[] = [];
  for (const [key, value] of Object.entries(body)) {
    // ponytail: every SP5 key is boolean; add per-key types when the first other type lands.
    if (isEditable(key) && typeof value === "boolean") patch[key] = value;
    else rejected.push(key);
  }
  if (rejected.length > 0) {
    return { ok: false, message: "Unknown, read-only, or wrongly typed settings", keys: rejected.slice(0, MAX_REPORTED_KEYS) };
  }
  return { ok: true, patch };
}
