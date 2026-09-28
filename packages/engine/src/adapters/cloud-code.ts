import { readBoundedText } from "../http.js";
import { list, parseJson, record, text, type Json } from "../json.js";
import type { CredentialStatus, ExecCtx, HttpTransportPort } from "../ports.js";
import { withRetry } from "../retry.js";

// Google Cloud Code Assist, shared by gemini-cli and antigravity (provider.gemini-cli-oauth), kept as 9router has it
// (user decision 2026-09-27): the project a Google account works in, found with loadCodeAssist, else provisioned with
// onboardUser, and the loadCodeAssist connection test.

export const CLOUD_CODE = "https://cloudcode-pa.googleapis.com/v1internal";
const CALL_TIMEOUT_MS = 30_000;
const BODY_BYTES = 64 * 1024;
const MAX_MESSAGE_CHARS = 300;

// 9router getPlatformEnum: the ClientMetadata.Platform of the machine AIGate runs on.
function platformEnum(): number {
  const arm = process.arch === "arm64";
  if (process.platform === "darwin") return arm ? 2 : 1;
  if (process.platform === "linux") return arm ? 4 : 3;
  return process.platform === "win32" ? 5 : 0;
}

// ideType ANTIGRAVITY (9) and pluginType GEMINI (2), sent by both providers (kept).
export const codeAssistMetadata = (): Json => ({ ideType: 9, platform: platformEnum(), pluginType: 2 });

// cloudaicompanionProject is the id, or an object holding it.
export function projectOf(value: unknown): string | undefined {
  const project = record(value).cloudaicompanionProject;
  const id = typeof project === "string" ? project : text(record(project).id);
  return id?.trim() || undefined;
}

// The allowed tier marked default, else legacy-tier.
export function defaultTier(value: unknown): string {
  const tier = list(record(value).allowedTiers).map(record).find((entry) => entry.isDefault === true && text(entry.id)?.trim());
  return text(tier?.id)?.trim() ?? "legacy-tier";
}

// 9router generateProjectId: the project a request names when none is known (kept; Google refuses it).
export function randomProjectId(): string {
  const pick = (words: readonly string[]) => words[Math.floor(Math.random() * words.length)] ?? words[0];
  return `${pick(["useful", "bright", "swift", "calm", "bold"])}-${pick(["fuze", "wave", "spark", "flow", "core"])}-${crypto.randomUUID().slice(0, 5)}`;
}

export async function cloudCodeCall(transport: HttpTransportPort, ctx: ExecCtx, method: string, headers: Readonly<Record<string, string>>, body: Json)
  : Promise<{ ok: boolean; status: number; raw: string }> {
  const response = await transport.send({ method: "POST", url: `${CLOUD_CODE}:${method}`, headers, body: JSON.stringify(body), timeoutMs: CALL_TIMEOUT_MS }, ctx);
  const raw = await readBoundedText(response.body, BODY_BYTES);
  return { ok: response.status >= 200 && response.status < 300, status: response.status, raw };
}

// ---- the request-path lookup (9router services/projectId.js) ----

const PROJECT_TTL_MS = 60 * 60_000;
const MAX_PROJECTS = 256;
// 9router aborts a lookup after 2 minutes; the shared lookup runs on its own budget, not on the first caller's.
const LOOKUP_BUDGET_MS = 120_000;
const ONBOARD_ATTEMPTS = 2;
const ONBOARD_WAIT_MS = 12_000;
const ONBOARD_JITTER_MS = 5_000;
const projects = new Map<string, { project: string; fetchedAt: number }>();
const pending = new Map<string, Promise<string | undefined>>();

function remember(key: string, project: string): void {
  projects.delete(key);
  projects.set(key, { project, fetchedAt: Date.now() });
  while (projects.size > MAX_PROJECTS) {
    const oldest = projects.keys().next().value;
    if (oldest === undefined) break;
    projects.delete(oldest);
  }
}

// onboardUser until done: 2 attempts, 12 s (plus up to 5 s) apart; not done, a refusal or no project is tried again.
// ponytail: 9router retries a timed-out attempt at once; here every retry waits.
async function onboard(auth: Readonly<Record<string, string>>, tierId: string, transport: HttpTransportPort, ctx: ExecCtx): Promise<string | undefined> {
  const wait = ONBOARD_WAIT_MS + Math.floor(Math.random() * ONBOARD_JITTER_MS);
  try {
    return await withRetry(async () => {
      const answer = await cloudCodeCall(transport, ctx, "onboardUser", auth, { tierId, metadata: codeAssistMetadata() });
      if (!answer.ok) throw new Error(`onboardUser answered ${answer.status}`);
      const data = record(parseJson(answer.raw));
      if (data.done !== true) throw new Error("onboardUser is not done yet");
      const project = projectOf(data.response);
      if (!project) throw new Error("onboardUser done without a project");
      return project;
    }, { signal: ctx.signal, maxAttempts: ONBOARD_ATTEMPTS, baseDelayMs: wait, maxDelayMs: wait, shouldRetry: () => true });
  } catch {
    return undefined;
  }
}

async function discover(token: string, headers: Readonly<Record<string, string>>, transport: HttpTransportPort): Promise<string | undefined> {
  const ctx = { signal: AbortSignal.timeout(LOOKUP_BUDGET_MS), requestId: crypto.randomUUID() };
  const auth = { ...headers, "content-type": "application/json", authorization: `Bearer ${token}` };
  const answer = await cloudCodeCall(transport, ctx, "loadCodeAssist", auth, { metadata: codeAssistMetadata() });
  if (!answer.ok) return undefined;
  const data = parseJson(answer.raw);
  return projectOf(data) ?? onboard(auth, defaultTier(data), transport, ctx);
}

// The connection's project, cached for an hour; concurrent lookups for one connection share one. Any failure is no
// project, and the request names a random one (kept). ponytail: not saved on the connection (9router saves it in the
// background), so a restart looks it up again.
export function lookupProject(key: string, token: string, headers: Readonly<Record<string, string>>, transport: HttpTransportPort): Promise<string | undefined> {
  const cached = projects.get(key);
  if (cached && Date.now() - cached.fetchedAt < PROJECT_TTL_MS) return Promise.resolve(cached.project);
  const running = pending.get(key);
  if (running) return running;
  const lookup = discover(token, headers, transport)
    .then((project) => {
      if (project) remember(key, project);
      return project;
    })
    .catch(() => undefined)
    .finally(() => pending.delete(key));
  pending.set(key, lookup);
  return lookup;
}

// ---- the connection test (9router probeCloudCodeAssistAccess) ----

const TEST_BODY = { metadata: { ideType: "IDE_UNSPECIFIED", platform: "PLATFORM_UNSPECIFIED", pluginType: "GEMINI" } };

// 9router parseProviderErrorMessage: error.message, message, or error itself, else the body, else the fallback.
function errorMessage(raw: string, fallback: string): string {
  const root = record(parseJson(raw));
  const found = record(root.error).message ?? root.message ?? root.error;
  const message = typeof found === "string" ? found.trim() : found === undefined ? "" : JSON.stringify(found);
  return (message || raw.trim() || fallback).slice(0, MAX_MESSAGE_CHARS);
}

export async function probeCodeAssist(token: string, userAgent: string, transport: HttpTransportPort, ctx: ExecCtx): Promise<CredentialStatus> {
  const answer = await cloudCodeCall(transport, ctx, "loadCodeAssist", { authorization: `Bearer ${token}`, "content-type": "application/json", "user-agent": userAgent }, TEST_BODY);
  if (answer.ok) return { valid: true };
  return { valid: false, code: answer.status === 401 || answer.status === 403 ? "AUTH_ERROR" : "PROVIDER_UNAVAILABLE", message: errorMessage(answer.raw, `API returned ${answer.status}`).split(token).join("***") };
}
