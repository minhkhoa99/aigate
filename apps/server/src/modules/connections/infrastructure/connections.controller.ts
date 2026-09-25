import { randomUUID } from "node:crypto";
import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, Header, HttpCode, HttpStatus, Inject, NotFoundException, Param, Patch, Post,
} from "@nestjs/common";
import { builtinRegistry, EngineError, OpenAICompatibleAdapter, type HttpTransportPort, type ProviderDescriptor } from "@aigate/engine";
import { SecretUnreadableError } from "../../../secret-cipher.js";
import { HTTP_TRANSPORT } from "../../transport/transport.module.js";
import { parseChanges, parseNewConnection } from "../domain/connection.js";
import { ConnectionsRepository, type ConnectionView, type TestOutcome } from "./connections.repo.js";
import { nodeDescriptor, ProviderNodesRepository } from "./provider-nodes.repo.js";

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

// Only an answer about the key is invalid or no_quota; anything else means "not checked" (connection.test-single-connection).
async function runTest(provider: ProviderDescriptor, transport: HttpTransportPort, apiKey: string): Promise<TestOutcome> {
  const ctx = { signal: AbortSignal.timeout(TEST_BUDGET_MS), requestId: randomUUID() };
  try {
    const status = await new OpenAICompatibleAdapter(provider, transport).validateCredential({ kind: "api-key", apiKey }, ctx);
    if (status.valid) return { testStatus: "active", lastError: null, lastErrorCode: null };
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
    const node = await this.nodes.get(id);
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
    const created = await this.connections.create({ provider: provider.id, name: parsed.value.name ?? provider.name, apiKey: parsed.value.apiKey });
    if (!created) throw new ConflictException({ code: "ALREADY_CONNECTED", message: `${provider.name} is already connected. Replace its key instead.` });
    return this.withName(created);
  }

  @Patch(":id")
  @Header("Cache-Control", "no-store")
  async update(@Param("id") id: string, @Body() body: unknown): Promise<Named> {
    const parsed = parseChanges(body);
    if (!parsed.ok) throw invalid(parsed.message);
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
    const outcome = await runTest(provider, this.transport, stored.apiKey);
    const view = await this.connections.recordTest(id, stored.sealed, outcome);
    if (!view) throw notFound();
    return this.withName(view);
  }
}
