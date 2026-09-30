// Settings keys and their editable shape (docs/contracts/settings.md).
export interface Settings {
  requireLogin: boolean;
  requireApiKey: boolean;
  fallbackStrategy: "fill-first" | "round-robin";
  // Round-robin combos: requests per member before the start rotates (docs/contracts/combos.md).
  comboStickyLimit: number;
  tokenSaverEnabled: boolean;
  rtkEnabled: boolean;
  headroomEnabled: boolean;
  headroomUrl: string;
  headroomCompressUserMessages: boolean;
  headroomTimeoutMs: number;
  cavemanEnabled: boolean;
  cavemanLevel: "lite" | "full" | "ultra";
  ponytailEnabled: boolean;
  ponytailLevel: "lite" | "full" | "ultra";
  pxpipeEnabled: boolean;
  pxpipeMinChars: number;
  pxpipeTimeoutMs: number;
}

export type SettingsPatch = Partial<Settings>;

export type PatchResult =
  | { ok: true; patch: SettingsPatch }
  | { ok: false; message: string; keys: string[] };

// Allowlist, not a blocklist: a key missing here cannot be written (CWE-915). The Record type
// makes the compiler fail when a Settings key is added without deciding whether it is editable.
const EDITABLE: Record<keyof Settings, true> = {
  requireLogin: true, requireApiKey: true, fallbackStrategy: true, comboStickyLimit: true,
  tokenSaverEnabled: true, rtkEnabled: true, headroomEnabled: true, headroomUrl: true, headroomCompressUserMessages: true, headroomTimeoutMs: true,
  cavemanEnabled: true, cavemanLevel: true, ponytailEnabled: true, ponytailLevel: true,
  pxpipeEnabled: true, pxpipeMinChars: true, pxpipeTimeoutMs: true,
};
const MAX_COMBO_STICKY_LIMIT = 1000;
// Bound the echoed key list; the body itself is bounded by the HTTP body limit.
const MAX_REPORTED_KEYS = 20;

export function parseSettingsPatch(body: unknown): PatchResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, message: "Body must be a JSON object of settings to change", keys: [] };
  }
  const patch: SettingsPatch = {};
  const rejected: string[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (!Object.hasOwn(EDITABLE, key)) rejected.push(key);
    else if (key === "requireLogin" && typeof value === "boolean") patch.requireLogin = value;
    else if (key === "requireApiKey" && typeof value === "boolean") patch.requireApiKey = value;
    else if (key === "fallbackStrategy" && (value === "fill-first" || value === "round-robin")) patch.fallbackStrategy = value;
    else if (key === "comboStickyLimit" && Number.isSafeInteger(value) && typeof value === "number" && value >= 1 && value <= MAX_COMBO_STICKY_LIMIT) patch.comboStickyLimit = value;
    else if (["tokenSaverEnabled", "rtkEnabled", "headroomEnabled", "cavemanEnabled", "ponytailEnabled", "pxpipeEnabled"].includes(key) && typeof value === "boolean") Object.assign(patch, { [key]: value });
    else if (key === "headroomCompressUserMessages" && typeof value === "boolean") patch.headroomCompressUserMessages = value;
    else if ((key === "cavemanLevel" || key === "ponytailLevel") && (value === "lite" || value === "full" || value === "ultra")) Object.assign(patch, { [key]: value });
    else if (key === "headroomUrl" && typeof value === "string" && value.length <= 500 && validHttpUrl(value)) patch.headroomUrl = value.replace(/\/+$/, "");
    else if (key === "headroomTimeoutMs" && Number.isSafeInteger(value) && typeof value === "number" && value >= 250 && value <= 15000) patch.headroomTimeoutMs = value;
    else if (key === "pxpipeMinChars" && Number.isSafeInteger(value) && typeof value === "number" && value >= 1000 && value <= 1_000_000) patch.pxpipeMinChars = value;
    else if (key === "pxpipeTimeoutMs" && Number.isSafeInteger(value) && typeof value === "number" && value >= 1000 && value <= 60_000) patch.pxpipeTimeoutMs = value;
    else rejected.push(key);
  }
  if (rejected.length > 0) {
    return { ok: false, message: "Unknown, read-only, or wrongly typed settings", keys: rejected.slice(0, MAX_REPORTED_KEYS) };
  }
  return { ok: true, patch };
}

function validHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "" && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}
