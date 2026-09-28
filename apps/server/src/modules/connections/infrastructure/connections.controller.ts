import { randomUUID } from "node:crypto";
import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, Header, HttpCode, HttpException, HttpStatus, Inject, NotFoundException, Param, Patch, Post,
} from "@nestjs/common";
import {
  builtinRegistry, CATALOG, createAdapter, EngineError, OAUTH_PROVIDERS, parseGoogleCredential, withConnection, type AIProviderPort, type CredentialStatus,
  type Credential, type HttpTransportPort, type OAuthIO, type ProviderDescriptor,
} from "@aigate/engine";
import { SecretUnreadableError } from "../../../secret-cipher.js";
import { HTTP_TRANSPORT } from "../../transport/transport.module.js";
import { DATA_FIELD_NAMES, isJsonCredential, parseChanges, parseNewConnection, type ConnectionChanges } from "../domain/connection.js";
import { ConnectionsRepository, type ConnectionView, type StoredCredential, type TestOutcome } from "./connections.repo.js";
import { nodeDescriptor, ProviderNodesRepository } from "./provider-nodes.repo.js";
import { TokenRefresher } from "./token-refresher.js";

// Above the adapter's own 15 s /models budget, so its TIMEOUT is what normally fires.
const TEST_BUDGET_MS = 20_000;

type Named = ConnectionView & { providerName: string };

const invalid = (message: string) => new BadRequestException({ code: "INVALID_REQUEST", message });
const notFound = () => new NotFoundException({ code: "NOT_FOUND", message: "No connection with that id" });
// The catalog says why a provider cannot be connected yet (docs/contracts/catalog-providers.md).
const notSupported = (id: string) => {
  const status = builtinRegistry.status(id);
  const message = status === undefined ? `${id} is not in the catalog or a custom provider.` : `${id} cannot be connected yet: ${status.connectable ? "unknown reason" : status.reason}.`;
  return new BadRequestException({ code: "PROVIDER_NOT_SUPPORTED", message });
};
// Built-in names from the registry, custom ones from their node (docs/contracts/custom-providers.md).
const named = (view: ConnectionView, nodeNames: ReadonlyMap<string, string>): Named =>
  ({ ...view, providerName: builtinRegistry.provider(view.provider)?.name ?? nodeNames.get(view.provider) ?? view.provider });

// connection.ollama-local-host: only a provider with optional auth may have no key. A connection field is taken only
// by a provider that declares it (connectionBaseUrl, connectionFields), and a required one cannot be missing or cleared.
// provider.vertex-google-auth: only a Google Cloud provider takes a JSON credential.
function checkForProvider(provider: ProviderDescriptor, fields: ConnectionChanges, creating: boolean): void {
  // docs/contracts/oauth.md: a provider whose catalog entry takes no API key connects only by signing in.
  if (fields.apiKey !== undefined && provider.oauth && CATALOG.find((entry) => entry.id === provider.id)?.auth.kinds.includes("api-key") === false) {
    throw invalid(`${provider.name} connects by signing in, not with an API key`);
  }
  if (fields.apiKey === "" && !provider.auth.optional) throw invalid("apiKey must be 8-4096 printable characters without spaces");
  const declared = provider.connectionFields;
  const takes = (field: string) => (field === "baseUrl" && provider.connectionBaseUrl !== undefined)
    || declared?.required.some((name) => name === field) === true || declared?.optional.some((name) => name === field) === true;
  for (const field of ["baseUrl", ...DATA_FIELD_NAMES] as const) {
    const value = fields[field];
    if (value && !takes(field)) throw invalid(`${field} cannot be set on a ${provider.name} connection`);
    const required = declared?.required.some((name) => name === field) === true;
    if (required && (creating ? !value : value === null)) throw invalid(`${field} is required for a ${provider.name} connection`);
  }
  if (fields.apiKey !== undefined && isJsonCredential(fields.apiKey)) {
    if (!provider.auth.googleCloud) throw invalid("apiKey must be 8-4096 printable characters without spaces");
    const parsed = parseGoogleCredential(fields.apiKey);
    if ("error" in parsed) throw invalid(`apiKey is not a usable Google Cloud credential: ${parsed.error}`);
  }
}

// provider.gemini-cli-oauth: the model list names the connection's Cloud Code project.
const credentialOf = (stored: StoredCredential): Credential => ({ kind: "api-key", apiKey: stored.apiKey, sessionId: stored.id, ...(stored.projectId ? { projectId: stored.projectId } : {}), ...(stored.providerData ? { providerData: stored.providerData } : {}) });

// Only an answer about the key is invalid or no_quota; anything else means "not checked" (connection.test-single-connection).
async function runTest(provider: ProviderDescriptor, transport: HttpTransportPort, credential: Credential): Promise<TestOutcome> {
  const ctx = { signal: AbortSignal.timeout(TEST_BUDGET_MS), requestId: randomUUID() };
  try {
    const status = await createAdapter(provider, transport).validateCredential(credential, ctx);
    if (status.valid) return { testStatus: "active", lastError: null, lastErrorCode: null };
    if (status.code === "AUTH_ERROR" && status.message.includes("Check it in AIGate: Gateway → Endpoint & Keys.")) {
      return { testStatus: "unreachable", lastError: `${provider.name} points back to AIGate. Edit its Base URL to the upstream provider API.`, lastErrorCode: "INVALID_REQUEST" };
    }
    return { testStatus: status.code === "QUOTA_EXHAUSTED" ? "no_quota" : "invalid", lastError: status.message, lastErrorCode: status.code };
  } catch (error) {
    if (error instanceof EngineError) return { testStatus: "unreachable", lastError: error.message, lastErrorCode: error.code };
    if (ctx.signal.aborted) {
      return { testStatus: "unreachable", lastError: `${provider.name} did not answer within ${TEST_BUDGET_MS / 1000} s`, lastErrorCode: "TIMEOUT" };
    }
    throw error;
  }
}

// docs/contracts/connections.md. Protected by the global dashboard guard.
@Controller("api/connections")
export class ConnectionsController {
  constructor(
    private readonly connections: ConnectionsRepository,
    private readonly nodes: ProviderNodesRepository,
    @Inject(HTTP_TRANSPORT) private readonly transport: HttpTransportPort,
    private readonly refresher: TokenRefresher,
  ) {}

  @Get()
  @Header("Cache-Control", "no-store")
  async list(): Promise<Named[]> {
    const names = await this.nodeNames();
    return (await this.connections.list()).map((view) => named(view, names));
  }

  // A built-in provider by id or alias, or a custom provider by id.
  private async provider(id: string): Promise<ProviderDescriptor | undefined> {
    const builtin = builtinRegistry.provider(id);
    if (builtin) return builtin;
    const node = await this.nodes.stored(id);
    return node ? nodeDescriptor(node) : undefined;
  }

  private async nodeNames(): Promise<Map<string, string>> {
    return new Map((await this.nodes.list()).map((node) => [node.id, node.name]));
  }

  private async withName(view: ConnectionView): Promise<Named> {
    return named(view, await this.nodeNames());
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header("Cache-Control", "no-store")
  async create(@Body() body: unknown): Promise<Named> {
    const parsed = parseNewConnection(body);
    if (!parsed.ok) throw invalid(parsed.message);
    const provider = await this.provider(parsed.value.provider);
    if (!provider) throw notSupported(parsed.value.provider);
    checkForProvider(provider, parsed.value, true);
    // The id replaces the alias the client may have sent.
    const { name, ...fields } = parsed.value;
    const created = await this.connections.create({ ...fields, provider: provider.id, name: name ?? provider.name });
    if (!created) throw new ConflictException({ code: "ALREADY_CONNECTED", message: `${provider.name} is already connected. Replace its key instead.` });
    return this.withName(created);
  }

  @Patch(":id")
  @Header("Cache-Control", "no-store")
  async update(@Param("id") id: string, @Body() body: unknown): Promise<Named> {
    const parsed = parseChanges(body);
    if (!parsed.ok) throw invalid(parsed.message);
    // Renaming or disabling needs no provider check; a key or connection field does.
    const checked: ConnectionChanges = { ...parsed.value };
    delete checked.name;
    delete checked.isActive;
    if (Object.keys(checked).length > 0) {
      const current = await this.connections.get(id);
      if (!current) throw notFound();
      if (current.authType === "oauth" && checked.apiKey !== undefined) throw invalid("This connection signs in with OAuth; sign in again to replace its token");
      const provider = await this.provider(current.provider);
      if (!provider) throw notSupported(current.provider);
      checkForProvider(provider, checked, false);
    }
    const view = await this.connections.update(id, parsed.value);
    if (!view) throw notFound();
    return this.withName(view);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string): Promise<void> {
    if (!(await this.connections.remove(id))) throw notFound();
  }

  // The upstream call runs outside any transaction (SCHEMA_CONVENTIONS rule 7).
  @Post(":id/test")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  async test(@Param("id") id: string): Promise<Named> {
    const { stored, provider, fresh } = await this.credential(id);
    const flowTest = OAUTH_PROVIDERS[provider.id]?.test;
    const refreshToken = fresh.oauth?.refreshToken;
    const outcome = provider.testByExpiry ? this.expiryTest(provider, stored, fresh)
      : flowTest && refreshToken ? await this.flowTest((io) => flowTest(refreshToken, io))
      : await runTest(withConnection(provider, fresh), this.transport, credentialOf(fresh));
    // After a refresh the sealed token changed, so the result is recorded against the new one.
    const sealed = fresh === stored ? stored.sealed : (await this.connections.readKey(id))?.sealed ?? stored.sealed;
    const view = await this.connections.recordTest(id, sealed, outcome);
    if (!view) throw notFound();
    return this.withName(view);
  }

  // catalog.provider-models-live-fetch (docs/contracts/custom-models.md): the ids the connection's upstream lists.
  @Get(":id/models")
  @Header("Cache-Control", "no-store")
  async models(@Param("id") id: string) {
    const { provider, fresh } = await this.credential(id);
    const ctx = { signal: AbortSignal.timeout(TEST_BUDGET_MS), requestId: randomUUID() };
    let listed: Awaited<ReturnType<AIProviderPort["getModels"]>>;
    try {
      listed = await createAdapter(withConnection(provider, fresh), this.transport).getModels(credentialOf(fresh), ctx);
    } catch (error) {
      // Kept from 9router (user decision 2026-09-27): only the upstream status, not its reason, and "Failed to fetch
      // models" for anything else. 502, not the upstream status, so that a provider's 401 does not read as the dashboard
      // session ending.
      const status = error instanceof EngineError ? error.details.status : undefined;
      throw new HttpException({ code: "MODELS_FETCH_FAILED", message: typeof status === "number" ? `Failed to fetch models: ${status}` : "Failed to fetch models" }, HttpStatus.BAD_GATEWAY);
    }
    return { provider: provider.id, connectionId: id, models: listed.map((m) => ({ id: m.id, inCatalog: builtinRegistry.model(provider.id, m.id) !== undefined })) };
  }

  // provider.github-copilot-oauth (kept from 9router): the provider's own test (github: GET /user with the GitHub token).
  private async flowTest(test: (io: OAuthIO) => Promise<CredentialStatus>): Promise<TestOutcome> {
    try {
      const status = await test({ transport: this.transport, ctx: { signal: AbortSignal.timeout(TEST_BUDGET_MS), requestId: randomUUID() } });
      if (status.valid) return { testStatus: "active", lastError: null, lastErrorCode: null };
      return { testStatus: "invalid", lastError: status.message, lastErrorCode: status.code };
    } catch (error) {
      if (error instanceof EngineError) return { testStatus: "unreachable", lastError: error.message, lastErrorCode: error.code };
      throw error;
    }
  }

  // provider.claude-oauth (kept from 9router): no request, only the expiry. A token due for refresh is valid when the
  // refresh (already tried by credential()) gave a new one.
  private expiryTest(provider: ProviderDescriptor, stored: StoredCredential, fresh: StoredCredential): TestOutcome {
    if (!this.refresher.due(provider.id, stored) || fresh !== stored) return { testStatus: "active", lastError: null, lastErrorCode: null };
    const lastError = stored.oauth?.refreshToken ? "Token expired and refresh failed" : "Token expired";
    return { testStatus: "invalid", lastError, lastErrorCode: "AUTH_ERROR" };
  }

  // The connection's key and provider; an oauth token about to expire is refreshed first, as 9router does
  // (oauth.refresh-lifecycle).
  private async credential(id: string) {
    let stored: Awaited<ReturnType<ConnectionsRepository["readKey"]>>;
    try {
      stored = await this.connections.readKey(id);
    } catch (error) {
      if (!(error instanceof SecretUnreadableError)) throw error;
      throw new ConflictException({
        code: "CREDENTIAL_UNREADABLE", message: "The saved key cannot be decrypted, because the secret key changed. Enter the API key again.",
      });
    }
    if (!stored) throw notFound();
    const provider = await this.provider(stored.provider);
    if (!provider) throw notSupported(stored.provider);
    return { stored, provider, fresh: await this.refresher.fresh(provider.id, stored) };
  }
}
