import { randomUUID } from "node:crypto";
import { access, constants, readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import {
  BadRequestException, Body, ConflictException, Controller, Get, Header, HttpCode, HttpException, HttpStatus, Inject, InternalServerErrorException, Param, Post, Query,
} from "@nestjs/common";
import { builtinRegistry, createAdapter, EngineError, generatePkce, OAUTH_PROVIDERS, type HttpTransportPort, type OAuthProvider, type OAuthTokens, type ProviderDescriptor } from "@aigate/engine";
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
const objectRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

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
  private traeProxy: Server | null = null;
  private traeTimeout: ReturnType<typeof setTimeout> | null = null;
  private traeSession: { state: string; status: "pending" | "processing" | "done" | "error"; connectionId?: string; email?: string | null; error?: string } | null = null;

  constructor(
    private readonly connections: ConnectionsRepository,
    @Inject(HTTP_TRANSPORT) private readonly transport: HttpTransportPort,
  ) {}

  onModuleDestroy() { this.stopTraeProxy(); }

  // GET /api/oauth/{provider}/authorize?redirect_uri=…[&meta] and /api/oauth/{provider}/device-code
  @Get(":provider/:action")
  @Header("Cache-Control", "no-store")
  async start(@Param("provider") id: string, @Param("action") action: string, @Query() query: unknown) {
    if (id === "cursor" && action === "auto-import") return this.cursorAutoImport();
    if (id === "cursor" && action === "import") return this.cursorInstructions();
    if (id === "kiro" && action === "auto-import") return this.kiroAutoImport();
    if (id === "trae" && action === "start-proxy") return this.startTraeProxy();
    if (id === "trae" && action === "poll-status") return this.pollTrae(stringifyQuery(query).state);
    if (id === "trae" && action === "stop-proxy") { this.stopTraeProxy(); return { success: true }; }
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
      const device = await flow.deviceCode(this.io(), strings(query)).catch(flowError);
      return { ...device, codeVerifier: pkce.codeVerifier };
    }
    throw invalid(`Unknown sign-in step "${action}"`);
  }

  // POST /api/oauth/{provider}/exchange { code, redirectUri, codeVerifier, state, meta } and /poll { deviceCode }
  @Post(":provider/:action")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  async finish(@Param("provider") id: string, @Param("action") action: string, @Body() body: unknown) {
    if (id === "trae" && action === "exchange") return this.traeExchange(body);
    const { descriptor, flow } = this.provider(id);
    if (typeof body !== "object" || body === null) throw invalid("The request body must be a JSON object");
    const fields = strings(body);
    if (id === "cursor" && action === "import") return this.cursorImport(descriptor, fields);
    if (id === "kiro" && action === "import") return this.kiroImport(descriptor, body);
    if (id === "kiro" && action === "api-key") return this.kiroApiKey(descriptor, body);
    if (id === "kiro" && action === "import-cli-proxy") return this.kiroCliProxyImport(descriptor, body);
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
      const providerData = strings("providerData" in body ? body.providerData : undefined);
      const result = await flow.poll(fields.deviceCode, this.io(), providerData).catch(flowError);
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

  private async startTraeProxy() {
    if (this.traeProxy && this.traeSession) {
      const address = this.traeProxy.address();
      if (address && typeof address !== "string") {
        const callbackUrl = `http://127.0.0.1:${address.port}/callback`;
        const login = await OAUTH_PROVIDERS.trae!.prepare!(callbackUrl, this.traeSession.state, {}, this.io()).catch(flowError);
        return { ...login, state: this.traeSession.state, callbackUrl };
      }
    }
    this.stopTraeProxy();
    const state = randomUUID();
    this.traeSession = { state, status: "pending" };
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const session = this.traeSession;
      const origin = request.headers.origin;
      const safeOrigin = !origin || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
      if (request.method !== "GET" || (url.pathname !== "/callback" && url.pathname !== "/auth/callback") || !safeOrigin) {
        response.writeHead(403, { "content-type": "text/plain; charset=utf-8" }); response.end("Callback rejected"); return;
      }
      if (!session) { response.writeHead(200, { "content-type": "text/plain; charset=utf-8" }); response.end("No active Trae login session"); return; }
      const callbackState = url.searchParams.get("state");
      if (callbackState && callbackState !== session.state) {
        session.status = "error"; session.error = "Trae callback state mismatch";
        response.writeHead(200, { "content-type": "text/plain; charset=utf-8" }); response.end(session.error); this.stopTraeProxy(false); return;
      }
      session.status = "processing";
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      response.end("<!doctype html><title>Trae connected</title><p>Trae sign-in received. Return to AIGate.</p>");
      void (async () => {
        try {
          const tokens = await OAUTH_PROVIDERS.trae!.exchange!(url.toString(), "", "", {}, this.io());
          const saved = await this.save(builtinRegistry.provider("trae")!, tokens);
          session.status = "done"; session.connectionId = saved.id; session.email = saved.email;
        } catch (error) { session.status = "error"; session.error = error instanceof Error ? error.message.slice(0, 500) : "Trae sign-in failed"; }
        finally { this.stopTraeProxy(false); }
      })();
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => { server.removeListener("error", reject); resolve(); });
    });
    this.traeProxy = server;
    this.traeTimeout = setTimeout(() => {
      if (this.traeSession?.status === "pending") { this.traeSession.status = "error"; this.traeSession.error = "Trae login timed out"; }
      this.stopTraeProxy(false);
    }, 600_000);
    const address = server.address();
    if (!address || typeof address === "string") { this.stopTraeProxy(); throw invalid("Trae callback listener failed to start"); }
    const callbackUrl = `http://127.0.0.1:${address.port}/callback`;
    try {
      const login = await OAUTH_PROVIDERS.trae!.prepare!(callbackUrl, state, {}, this.io());
      return { ...login, state, callbackUrl };
    } catch (error) { this.stopTraeProxy(); return flowError(error); }
  }

  private pollTrae(state: string | undefined) {
    if (!state) throw invalid("Missing state");
    const session = this.traeSession;
    if (!session || session.state !== state) return { status: "unknown" };
    const result = { ...session };
    if (session.status === "done" || session.status === "error") this.traeSession = null;
    return result;
  }

  private stopTraeProxy(clearSession = true) {
    if (this.traeTimeout) { clearTimeout(this.traeTimeout); this.traeTimeout = null; }
    if (this.traeProxy) { this.traeProxy.close(); this.traeProxy = null; }
    if (clearSession) this.traeSession = null;
  }

  private async traeExchange(body: unknown) {
    if (!objectRecord(body)) throw invalid("The request body must be a JSON object");
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code) throw invalid("Missing token or callback URL");
    const descriptor = builtinRegistry.provider("trae");
    if (!descriptor) throw invalid("Trae is unavailable");
    const tokens = await OAUTH_PROVIDERS.trae!.exchange!(code, "", "", {}, this.io()).catch(flowError);
    const saved = await this.save(descriptor, tokens);
    return { success: true, connection: { id: saved.id, provider: saved.provider, email: saved.email, displayName: tokens.displayName ?? null } };
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

  private async kiroAutoImport() {
    const directory = join(homedir(), ".aws", "sso", "cache");
    let files: string[];
    try { files = await readdir(directory); }
    catch { return { found: false, error: "AWS SSO cache not found. Sign in to Kiro IDE first." }; }
    let token: Record<string, string> | undefined;
    let source: string | undefined;
    // eslint-disable-next-line aigate/retry-through-helper -- scan independent cache files; select the first Kiro token, do not retry an upstream call.
    for (const name of ["kiro-auth-token.json", ...files.filter((file) => file.endsWith(".json") && file !== "kiro-auth-token.json")]) {
      try {
        const raw = await readFile(join(directory, name), "utf8");
        if (raw.length > 1024 * 1024) continue;
        const parsed: unknown = JSON.parse(raw);
        const candidate = strings(parsed);
        if (candidate.refreshToken?.startsWith("aorAAAAAG")) { token = candidate; source = name; break; }
      } catch { /* another cache entry may be the Kiro token */ }
    }
    if (!token || !source) return { found: false, error: "Kiro token not found in AWS SSO cache. Sign in to Kiro IDE first." };
    let clientId: string | undefined; let clientSecret: string | undefined;
    const region = token.region;
    if (token.clientIdHash) {
      try {
        const client = strings(JSON.parse(await readFile(join(directory, `${token.clientIdHash}.json`), "utf8")));
        clientId = client.clientId; clientSecret = client.clientSecret;
      } catch { /* a social token has no linked OIDC client */ }
    }
    let profileArn: string | undefined;
    const home = homedir(); const appData = process.env.APPDATA || join(home, "AppData", "Roaming");
    // eslint-disable-next-line aigate/retry-through-helper -- inspect both known local profile locations; this is a file scan, not a network retry.
    for (const path of [join(appData, "Kiro", "User", "globalStorage", "kiro.kiroagent", "profile.json"), join(home, ".config", "Kiro", "User", "globalStorage", "kiro.kiroagent", "profile.json")]) {
      try {
        const value = strings(JSON.parse(await readFile(path, "utf8")));
        if (value.arn) { profileArn = value.arn.replace(/arn:aws:codewhisperer:[^:]+:/, "arn:aws:codewhisperer:us-east-1:"); break; }
      } catch { /* try the other platform location */ }
    }
    return { found: true, refreshToken: token.refreshToken, source, clientId: clientId ?? null, clientSecret: clientSecret ?? null, region: region ?? null, authMethod: token.authMethod ?? null, profileArn: profileArn ?? null };
  }

  private async kiroImport(descriptor: ProviderDescriptor, body: unknown) {
    const fields = strings(body);
    const refreshToken = fields.refreshToken?.trim();
    if (!refreshToken) throw invalid("Refresh token is required");
    if (!refreshToken.startsWith("aorAAAAAG")) throw invalid("Invalid Kiro refresh token format");
    const data = {
      ...(fields.clientId && fields.clientSecret ? { clientId: fields.clientId, clientSecret: fields.clientSecret, region: fields.region || "us-east-1", authMethod: "idc" } : {}),
    };
    const tokens = await OAUTH_PROVIDERS.kiro!.refresh!(refreshToken, this.io(), undefined, data).catch(flowError);
    if (!tokens) throw new HttpException({ code: "OAUTH_FAILED", message: "Kiro refused the refresh token" }, HttpStatus.BAD_GATEWAY);
    const saved = await this.save(descriptor, { ...tokens, expiresIn: tokens.expiresIn ?? 3600, data: { ...tokens.data, authMethod: data.authMethod ?? "imported", provider: data.authMethod ? "Enterprise" : "Imported", ...(fields.profileArn ? { profileArn: fields.profileArn } : {}) } });
    return { success: true, connection: { id: saved.id, provider: saved.provider, email: saved.email } };
  }

  private async kiroApiKey(descriptor: ProviderDescriptor, body: unknown) {
    const fields = strings(body); const apiKey = fields.apiKey?.trim();
    if (!apiKey) throw invalid("API key is required");
    const region = fields.region || "us-east-1";
    const tokens: OAuthTokens = { accessToken: apiKey, expiresIn: 365 * 24 * 60 * 60, data: { authMethod: "api_key", provider: "API Key", region } };
    const credential = { kind: "api-key" as const, apiKey, providerData: tokens.data };
    const status = await createAdapter(descriptor, this.transport).validateCredential(credential, this.io().ctx).catch(() => ({ valid: false as const, code: "AUTH_ERROR" as const, message: "API key validation failed" }));
    if (!status.valid) throw new HttpException({ code: "OAUTH_FAILED", message: "API key validation failed" }, HttpStatus.BAD_GATEWAY);
    const saved = await this.save(descriptor, tokens);
    return { success: true, connection: { id: saved.id, provider: saved.provider, email: saved.email } };
  }

  private async kiroCliProxyImport(descriptor: ProviderDescriptor, body: unknown) {
    const root = objectRecord(body) ? body : {};
    let raw: unknown = root.cliProxyAuth ?? root.auth ?? root.json ?? root;
    if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { throw invalid("CLIProxyAPI auth JSON is invalid"); } }
    if (!objectRecord(raw)) throw invalid("CLIProxyAPI auth JSON is required");
    const source = strings(raw); const method = source.auth_method ?? source.authMethod;
    if (method && method !== "external_idp") throw invalid("Only external_idp Kiro auth is supported");
    const accessToken = source.access_token ?? source.accessToken; const refreshToken = source.refresh_token ?? source.refreshToken;
    const clientId = source.client_id ?? source.clientId; const endpointText = source.token_endpoint ?? source.tokenEndpoint;
    const profileArn = source.profile_arn ?? source.profileArn; const scopeValue = raw.scopes ?? raw.scope;
    const scope = Array.isArray(scopeValue) ? scopeValue.filter((item): item is string => typeof item === "string").join(" ") : typeof scopeValue === "string" ? scopeValue.trim() : "";
    let endpoint: URL;
    try { endpoint = new URL(endpointText ?? ""); } catch { throw invalid("token_endpoint must be a valid URL"); }
    if (endpoint.protocol !== "https:" || !["login.microsoftonline.com", "login.microsoft.com", "login.windows.net"].includes(endpoint.hostname.toLowerCase())) throw invalid("token_endpoint must be a Microsoft login endpoint");
    if (!accessToken || !refreshToken || !clientId || !profileArn || !scope) throw invalid("CLIProxyAPI auth JSON is missing a required token, client, scope, or profile field");
    const expires = Number(source.expires_in ?? source.expiresIn ?? 0);
    const absoluteExpiry = source.expired ?? source.expires_at ?? source.expiresAt;
    const absoluteMs = absoluteExpiry ? new Date(absoluteExpiry).getTime() : NaN;
    let expiresIn = Number.isFinite(absoluteMs) ? Math.max(1, Math.floor((absoluteMs - Date.now()) / 1000)) : Number.isFinite(expires) && expires > 0 ? Math.floor(expires) : 0;
    if (!expiresIn) {
      try {
        const payload = accessToken.split(".")[1];
        const claims: unknown = payload ? JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "="))) : {};
        const exp = objectRecord(claims) ? claims.exp : undefined;
        expiresIn = typeof exp === "number" ? Math.max(1, Math.floor(exp - Date.now() / 1000)) : 3600;
      } catch { expiresIn = 3600; }
    }
    const tokens: OAuthTokens = { accessToken, refreshToken, expiresIn, data: { authMethod: "external_idp", provider: "CLIProxyAPI", clientId, tokenEndpoint: endpoint.toString(), region: source.region || "us-east-1", scope, profileArn } };
    const saved = await this.save(descriptor, tokens);
    return { success: true, connection: { id: saved.id, provider: saved.provider, email: source.email ?? null } };
  }
}

function stringifyQuery(value: unknown): Record<string, string> { return strings(value); }
