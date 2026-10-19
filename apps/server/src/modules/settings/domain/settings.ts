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
  // docs/contracts/skills.md, "Automatic skills".
  skillsAutoEnabled: boolean;
  skillsMaxSelected: number;
  skillsBudgetChars: number;
  skillsCatalogEnabled: boolean;
  // docs/contracts/skills.md, "Model-loaded skills".
  skillsSelection: "lexical" | "hybrid";
  authMode: "password" | "oidc" | "saml" | "both";
  oidcIssuerUrl: string;
  oidcClientId: string;
  oidcScopes: string;
  oidcLoginLabel: string;
  oidcConfigured: boolean;
  samlEntryPoint: string;
  samlIssuer: string;
  samlAttributeEmail: string;
  samlAttributeName: string;
  ssoPublicOrigin: string;
  samlConfigured: boolean;
}

export type SettingsPatch = Partial<Omit<Settings, "oidcConfigured" | "samlConfigured">> & { oidcClientSecret?: string; samlCert?: string };

export const MAX_SETTINGS_DOCUMENT_BYTES = 64 * 1024;
export interface SettingsDocument { format: "aigate-settings"; version: 1; settings: SettingsPatch }

// Service URLs can carry query tokens; portable settings never include them.
export function settingsDocument(settings: Settings): SettingsDocument {
  const excluded = new Set(["headroomUrl", "authMode", "oidcIssuerUrl", "oidcClientId", "oidcScopes", "oidcLoginLabel", "oidcConfigured",
    "samlEntryPoint", "samlIssuer", "samlAttributeEmail", "samlAttributeName", "ssoPublicOrigin", "samlConfigured"]);
  const transferable = Object.fromEntries(Object.entries(settings).filter(([key]) => !excluded.has(key)));
  return { format: "aigate-settings", version: 1, settings: transferable };
}

export function parseSettingsDocument(body: unknown): PatchResult {
  const invalid = (message: string): PatchResult => ({ ok: false, message, keys: [] });
  if (typeof body !== "object" || body === null || Array.isArray(body)) return invalid("Import must be an aigate-settings JSON document.");
  if (Object.keys(body).length !== 3 || !Object.hasOwn(body, "settings") || Reflect.get(body, "format") !== "aigate-settings" || Reflect.get(body, "version") !== 1) {
    return invalid("Settings document must contain only format (aigate-settings), version (1), and settings.");
  }
  const result = parseSettingsPatch(Reflect.get(body, "settings"));
  if (!result.ok) return result;
  if (Object.keys(result.patch).some(key => key === "headroomUrl" || key === "authMode" || key === "ssoPublicOrigin" || key.startsWith("oidc") || key.startsWith("saml"))) return invalid("Service URLs and authentication settings are not transferable. Configure them in the dashboard.");
  if (Object.keys(result.patch).length === 0) return invalid("Settings document must contain at least one transferable setting.");
  // Only fixed-count primitive settings reach serialization; nested invalid input cannot overflow its stack.
  if (new TextEncoder().encode(JSON.stringify(body)).byteLength > MAX_SETTINGS_DOCUMENT_BYTES) return invalid("Settings document must be at most 64 KiB.");
  return result;
}

export type PatchResult =
  | { ok: true; patch: SettingsPatch }
  | { ok: false; message: string; keys: string[] };

// Allowlist, not a blocklist: a key missing here cannot be written (CWE-915). The Record type
// makes the compiler fail when a Settings key is added without deciding whether it is editable.
const EDITABLE: Record<keyof SettingsPatch, true> = {
  requireLogin: true, requireApiKey: true, fallbackStrategy: true, comboStickyLimit: true,
  tokenSaverEnabled: true, rtkEnabled: true, headroomEnabled: true, headroomUrl: true, headroomCompressUserMessages: true, headroomTimeoutMs: true,
  cavemanEnabled: true, cavemanLevel: true, ponytailEnabled: true, ponytailLevel: true,
  pxpipeEnabled: true, pxpipeMinChars: true, pxpipeTimeoutMs: true,
  skillsAutoEnabled: true, skillsMaxSelected: true, skillsBudgetChars: true, skillsCatalogEnabled: true, skillsSelection: true,
  authMode: true, oidcIssuerUrl: true, oidcClientId: true, oidcClientSecret: true, oidcScopes: true, oidcLoginLabel: true,
  samlEntryPoint: true, samlIssuer: true, samlCert: true, samlAttributeEmail: true, samlAttributeName: true, ssoPublicOrigin: true,
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
    else if ((key === "skillsAutoEnabled" || key === "skillsCatalogEnabled") && typeof value === "boolean") Object.assign(patch, { [key]: value });
    else if (key === "skillsMaxSelected" && Number.isSafeInteger(value) && typeof value === "number" && value >= 1 && value <= 5) patch.skillsMaxSelected = value;
    else if (key === "skillsBudgetChars" && Number.isSafeInteger(value) && typeof value === "number" && value >= 1000 && value <= 32_000) patch.skillsBudgetChars = value;
    else if (key === "skillsSelection" && (value === "lexical" || value === "hybrid")) patch.skillsSelection = value;
    else if (key === "authMode" && (value === "password" || value === "oidc" || value === "saml" || value === "both")) patch.authMode = value;
    else if ((key === "oidcIssuerUrl" || key === "samlEntryPoint") && typeof value === "string" && value.length <= 2048 && (!value || validSsoUrl(value, key === "samlEntryPoint"))) Object.assign(patch, { [key]: value.trim() });
    else if (["oidcClientId", "oidcScopes", "oidcLoginLabel", "samlIssuer", "samlAttributeEmail", "samlAttributeName"].includes(key) && typeof value === "string" && value.length <= 256) Object.assign(patch, { [key]: value.trim() });
    else if (key === "ssoPublicOrigin" && typeof value === "string" && value.length <= 2048 && (!value || validPublicOrigin(value))) patch.ssoPublicOrigin = value.trim().replace(/\/+$/, "");
    else if ((key === "oidcClientSecret" || key === "samlCert") && typeof value === "string" && value.length <= 65536) { if (value.trim()) Object.assign(patch, { [key]: value }); }
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

function validPublicOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return (url.protocol === "https:" || (url.protocol === "http:" && loopback)) && url.username === "" && url.password === "" && url.hash === "" && url.search === "" && (url.pathname === "" || url.pathname === "/");
  } catch {
    return false;
  }
}

function validSsoUrl(value: string, allowQuery: boolean): boolean {
  try {
    const url = new URL(value);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return (url.protocol === "https:" || (url.protocol === "http:" && loopback)) && !url.username && !url.password && !url.hash && (allowQuery || !url.search);
  } catch { return false; }
}
