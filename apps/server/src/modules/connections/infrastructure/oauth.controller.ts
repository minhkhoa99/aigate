import { randomUUID } from "node:crypto";
import { access, constants } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  BadRequestException, Body, ConflictException, Controller, Get, Header, HttpCode, HttpException, HttpStatus, Inject, InternalServerErrorException, Param, Post, Query,
} from "@nestjs/common";
import { builtinRegistry, EngineError, generatePkce, OAUTH_PROVIDERS, type HttpTransportPort, type OAuthProvider, type OAuthTokens, type ProviderDescriptor } from "@aigate/engine";
import { HTTP_TRANSPORT } from "../../transport/transport.module.js";
import { ConnectionsRepository } from "./connections.repo.js";

// oauth.dashboard-flow (docs/contracts/oauth.md), kept as 9router has it (user decision 2026-09-27): authorize returns
// state and the PKCE verifier to the dashboard, which sends them back on exchange unchecked. Protected by the global
// dashboard guard, like every /api route.
const FLOW_BUDGET_MS = 30_000;
// 9router exchanges these without a PKCE verifier.
const NO_PKCE = new Set(["cline", "clinepass", "kimchi", "grok-cli"]);
const DEFAULT_REDIRECT = "http://localhost:8080/callback";

const invalid = (message: string) => new BadRequestException({ code: "INVALID_REQUEST", message });

const strings = (value: unknown): Record<string, string> =>
  typeof value === "object" && value !== null ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string")) : {};

// An upstream failure during sign-in, with the provider's words (9router answers 500 with the error message).
function flowError(error: unknown): never {
  if (error instanceof EngineError) {
    if (error.code === "INVALID_REQUEST") throw invalid(error.message);
    throw new HttpException({ code: "OAUTH_FAILED", message: error.message.slice(0, 500) }, HttpStatus.BAD_GATEWAY);
  }
  throw error;
}

@Controller("api/oauth")
export class OAuthController {
  constructor(
    private readonly connections: ConnectionsRepository,
    @Inject(HTTP_TRANSPORT) private readonly transport: HttpTransportPort,
  ) {}

  // GET /api/oauth/{provider}/authorize?redirect_uri=…[&meta] and /api/oauth/{provider}/device-code
  @Get(":provider/:action")
  @Header("Cache-Control", "no-store")
  async start(@Param("provider") id: string, @Param("action") action: string, @Query() query: unknown) {
    if (id === "cursor" && action === "auto-import") return this.cursorAutoImport();
    if (id === "cursor" && action === "import") return this.cursorInstructions();
    const { flow } = this.provider(id);
    if (action === "authorize") {
      const params = strings(query);
      // provider.codex-oauth: codex accepts only its CLI callback, which the dashboard pastes back.
      const redirectUri = flow.fixedRedirect ?? params.redirect_uri ?? DEFAULT_REDIRECT;
      // Every other query parameter is provider meta (gitlab: baseUrl, clientId, clientSecret).
      const meta = Object.fromEntries(Object.entries(params).filter(([key]) => key !== "redirect_uri"));
      const pkce = await generatePkce();
      // A device flow has no URL up front (it has no authUrl).
      // A Google sign-in without its client in .env names the missing variables (INVALID_REQUEST).
      let authUrl: string | null;
      try {
        authUrl = flow.authUrl?.(redirectUri, pkce.state, pkce.codeChallenge, meta) ?? null;
      } catch (error) {
        flowError(error);
      }
      return { authUrl, state: pkce.state, codeVerifier: pkce.codeVerifier, codeChallenge: pkce.codeChallenge, redirectUri, flowType: flow.flow, callbackPath: "/callback" };
    }
    if (action === "device-code") {
      if (!flow.deviceCode) throw invalid("This provider does not sign in with a device code");
      const pkce = await generatePkce();
      const device = await flow.deviceCode(this.io()).catch(flowError);
      return { ...device, codeVerifier: pkce.codeVerifier };
    }
    throw invalid(`Unknown sign-in step "${action}"`);
  }

  // POST /api/oauth/{provider}/exchange { code, redirectUri, codeVerifier, state, meta } and /poll { deviceCode }
  @Post(":provider/:action")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  async finish(@Param("provider") id: string, @Param("action") action: string, @Body() body: unknown) {
    const { descriptor, flow } = this.provider(id);
    if (typeof body !== "object" || body === null) throw invalid("The request body must be a JSON object");
    const fields = strings(body);
    if (id === "cursor" && action === "import") return this.cursorImport(descriptor, fields);
    if (action === "exchange") {
      const { code, redirectUri, codeVerifier } = fields;
      if (!code || !redirectUri || (!codeVerifier && !NO_PKCE.has(descriptor.id)) || !flow.exchange) throw invalid("Missing required fields: code, redirectUri, codeVerifier");
      // provider.claude-oauth: the state the dashboard sends back, used when the pasted code has none after "#".
      const meta = { ...strings("meta" in body ? body.meta : undefined), ...(fields.state ? { state: fields.state } : {}) };
      const tokens = await flow.exchange(code, redirectUri, codeVerifier ?? "", meta, this.io()).catch(flowError);
      const view = await this.save(descriptor, tokens);
      return { success: true, connection: { id: view.id, provider: view.provider, email: view.email, displayName: tokens.displayName ?? null } };
    }
    if (action === "poll") {
      if (!fields.deviceCode) throw invalid("Missing device code");
      if (!flow.poll) throw invalid("This provider does not sign in with a device code");
      const result = await flow.poll(fields.deviceCode, this.io()).catch(flowError);
      if (result.status === "approved") {
        const view = await this.save(descriptor, result.tokens);
        return { success: true, connection: { id: view.id, provider: view.provider } };
      }
      // provider.github-copilot-oauth: GitHub asks to slow down; the dashboard then polls 5 s slower (9router).
      if (result.status === "pending") return { success: false, error: result.slowDown ? "slow_down" : "authorization_pending", pending: true };
      return { success: false, error: result.error, errorDescription: result.description ?? null, pending: false };
    }
    throw invalid(`Unknown sign-in step "${action}"`);
  }

  private provider(id: string): { descriptor: ProviderDescriptor; flow: OAuthProvider } {
    const descriptor = builtinRegistry.provider(id);
    const flow = descriptor ? OAUTH_PROVIDERS[descriptor.id] : undefined;
    if (!descriptor || !flow) throw new BadRequestException({ code: "PROVIDER_NOT_SUPPORTED", message: `${id} does not support signing in from AIGate.` });
    return { descriptor, flow };
  }

  // provider.cursor-protobuf: fixed local Cursor state locations. The native SQLite reader replaces 9router's bundled
  // dependency/CLI fallback; a missing or unreadable database still leaves manual paste available.
  private async cursorAutoImport(): Promise<{ found: true; accessToken: string; machineId: string } | { found: false; error?: string; windowsManual?: true; dbPath?: string }> {
    const home = homedir();
    const appData = process.env.APPDATA || join(home, "AppData", "Roaming");
    const localAppData = process.env.LOCALAPPDATA || join(home, "AppData", "Local");
    const candidates = process.platform === "darwin"
      ? [join(home, "Library", "Application Support", "Cursor", "User", "globalStorage", "state.vscdb"), join(home, "Library", "Application Support", "Cursor - Insiders", "User", "globalStorage", "state.vscdb")]
      : process.platform === "win32"
        ? [join(appData, "Cursor", "User", "globalStorage", "state.vscdb"), join(appData, "Cursor - Insiders", "User", "globalStorage", "state.vscdb"), join(localAppData, "Cursor", "User", "globalStorage", "state.vscdb"), join(localAppData, "Programs", "Cursor", "User", "globalStorage", "state.vscdb")]
        : [join(home, ".config", "Cursor", "User", "globalStorage", "state.vscdb"), join(home, ".config", "cursor", "User", "globalStorage", "state.vscdb")];
    const dbPath = await this.firstReadable(candidates);
    if (!dbPath) return { found: false, error: `Cursor database not found. Checked locations:\n${candidates.join("\n")}\n\nMake sure Cursor IDE is installed and opened at least once.` };
    try {
      const { DatabaseSync } = await import("node:sqlite");
      const db = new DatabaseSync(dbPath, { readOnly: true });
      try {
        const query = (keys: readonly string[]) => keys.map((key) => db.prepare("SELECT value FROM itemTable WHERE key=? LIMIT 1").get(key)?.value).find((value): value is string => typeof value === "string" && value !== "") ?? "";
        const accessToken = this.cursorValue(query(["cursorAuth/accessToken", "cursorAuth/token"]));
        const machineId = this.cursorValue(query(["storage.serviceMachineId", "storage.machineId", "telemetry.machineId"]));
        if (accessToken && machineId) return { found: true, accessToken, machineId };
      } finally { db.close(); }
    } catch {
      // 9router's final manual path; its better-sqlite3 and sqlite3 CLI mechanics are intentionally not carried over.
    }
    return { found: false, windowsManual: true, dbPath };
  }

  private async firstReadable(paths: readonly string[]): Promise<string | undefined> {
    for (const path of paths) if (await access(path, constants.R_OK).then(() => true, () => false)) return path;
    return undefined;
  }

  private cursorValue(value: string): string {
    try { const parsed: unknown = JSON.parse(value); return typeof parsed === "string" ? parsed : value; } catch { return value; }
  }

  private cursorInstructions() {
    return {
      provider: "cursor", method: "import_token",
      requiredFields: [
        { name: "accessToken", label: "Access token", description: "cursorAuth/accessToken in Cursor state.vscdb", type: "textarea" },
        { name: "machineId", label: "Machine ID", description: "storage.serviceMachineId in Cursor state.vscdb", type: "text" },
      ],
    };
  }

  private async cursorImport(descriptor: ProviderDescriptor, fields: Record<string, string>) {
    try {
      const accessToken = fields.accessToken?.trim();
      const machineId = fields.machineId?.trim();
      if (!accessToken) throw new Error("Access token is required");
      if (!machineId) throw new Error("Machine ID is required");
      if (accessToken.length < 50 || /[\r\n]/.test(accessToken)) throw new Error("Invalid token format. Token appears too short.");
      if (!/^[a-f0-9-]{32,}$/i.test(machineId.replace(/-/g, ""))) throw new Error("Invalid machine ID format. Expected UUID format.");
      const email = this.cursorJwtEmail(accessToken);
      const saved = await this.save(descriptor, { accessToken, expiresIn: 86_400, ...(email ? { email } : {}), data: { machineId, authMethod: "imported", provider: "Imported" } });
      return { success: true, connection: { id: saved.id, provider: saved.provider, email: saved.email } };
    } catch (error) {
      // SUSPECTED_BUG, kept: 9router's broad handler turns bad operator input into HTTP 500.
      const message = error instanceof Error ? error.message : "Cursor token import failed";
      throw new InternalServerErrorException({ code: "INTERNAL_ERROR", message });
    }
  }

  private cursorJwtEmail(token: string): string | undefined {
    try {
      const part = token.split(".")[1];
      if (!part) return undefined;
      const parsed: unknown = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
      if (typeof parsed !== "object" || parsed === null) return undefined;
      const email = Reflect.get(parsed, "email"); const sub = Reflect.get(parsed, "sub");
      return typeof email === "string" ? email : typeof sub === "string" ? sub : undefined;
    } catch { return undefined; }
  }

  private io() {
    return { transport: this.transport, ctx: { signal: AbortSignal.timeout(FLOW_BUDGET_MS), requestId: randomUUID() } };
  }

  private async save(descriptor: ProviderDescriptor, tokens: OAuthTokens) {
    const saved = await this.connections.saveOAuth({
      provider: descriptor.id, name: tokens.displayName ?? tokens.email ?? descriptor.name, tokens,
      // provider.kilocode-device-auth: the organization goes in X-Kilocode-OrganizationID.
      ...(tokens.data.orgId ? { organization: tokens.data.orgId } : {}),
      // provider.codex-oauth: the ChatGPT account id goes in ChatGPT-Account-ID.
      ...(tokens.data.chatgptAccountId ? { accountId: tokens.data.chatgptAccountId } : {}),
    });
    if (saved === "conflict") {
      throw new ConflictException({
        code: "ALREADY_CONNECTED",
        message: `${descriptor.name} is already connected with another account or an API key. Delete that connection first; more accounts per provider arrive with SP17.`,
      });
    }
    return saved;
  }
}
