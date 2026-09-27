import { randomUUID } from "node:crypto";
import {
  BadRequestException, Body, ConflictException, Controller, Get, Header, HttpCode, HttpException, HttpStatus, Inject, Param, Post, Query,
} from "@nestjs/common";
import { builtinRegistry, EngineError, generatePkce, OAUTH_PROVIDERS, type HttpTransportPort, type OAuthProvider, type OAuthTokens, type ProviderDescriptor } from "@aigate/engine";
import { HTTP_TRANSPORT } from "../../transport/transport.module.js";
import { ConnectionsRepository } from "./connections.repo.js";

// oauth.dashboard-flow (docs/contracts/oauth.md), kept as 9router has it (user decision 2026-09-27): authorize returns
// state and the PKCE verifier to the dashboard, which sends them back on exchange unchecked. Protected by the global
// dashboard guard, like every /api route.
const FLOW_BUDGET_MS = 30_000;
// 9router exchanges these without a PKCE verifier.
const NO_PKCE = new Set(["cline", "clinepass", "kimchi"]);
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
    const { flow } = this.provider(id);
    if (action === "authorize") {
      const params = strings(query);
      // provider.codex-oauth: codex accepts only its CLI callback, which the dashboard pastes back.
      const redirectUri = flow.fixedRedirect ?? params.redirect_uri ?? DEFAULT_REDIRECT;
      // Every other query parameter is provider meta (gitlab: baseUrl, clientId, clientSecret).
      const meta = Object.fromEntries(Object.entries(params).filter(([key]) => key !== "redirect_uri"));
      const pkce = await generatePkce();
      // A device flow has no URL up front (it has no authUrl).
      const authUrl = flow.authUrl?.(redirectUri, pkce.state, pkce.codeChallenge, meta) ?? null;
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
      if (result.status === "pending") return { success: false, error: "authorization_pending", pending: true };
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
