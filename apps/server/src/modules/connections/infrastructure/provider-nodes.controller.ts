import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, Header, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post,
} from "@nestjs/common";
import { CATALOG } from "@aigate/engine";
import { MAX_NODES, parseNewNode, parseNodeChanges } from "../domain/provider-node.js";
import { ProviderNodesRepository, type NodeView } from "./provider-nodes.repo.js";

// Every catalog id and alias, connectable or not: a custom prefix may never shadow one (connection.provider-node-create-list).
const RESERVED = new Set(CATALOG.flatMap((p) => [p.id, ...p.aliases]));

const invalid = (message: string) => new BadRequestException({ code: "INVALID_REQUEST", message });
const notFound = () => new NotFoundException({ code: "NOT_FOUND", message: "No custom provider with that id" });
const reserved = (prefix: string) =>
  new ConflictException({ code: "PREFIX_RESERVED", message: `"${prefix}" is a built-in provider id or alias. Choose another prefix.` });
const taken = (prefix: string) => new ConflictException({ code: "PREFIX_TAKEN", message: `Another custom provider already uses the prefix "${prefix}".` });

// docs/contracts/custom-providers.md. Protected by the global dashboard guard.
@Controller("api/provider-nodes")
export class ProviderNodesController {
  constructor(private readonly nodes: ProviderNodesRepository) {}

  @Get()
  @Header("Cache-Control", "no-store")
  list(): Promise<NodeView[]> {
    return this.nodes.list();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header("Cache-Control", "no-store")
  async create(@Body() body: unknown): Promise<NodeView> {
    const parsed = parseNewNode(body);
    if (!parsed.ok) throw invalid(parsed.message);
    const { prefix } = parsed.value;
    if (RESERVED.has(prefix)) throw reserved(prefix);
    const created = await this.nodes.create(parsed.value);
    if (created === "limit") throw new ConflictException({ code: "NODE_LIMIT", message: `At most ${MAX_NODES} custom providers. Delete one first.` });
    if (created === "taken") throw taken(prefix);
    return created;
  }

  @Patch(":id")
  @Header("Cache-Control", "no-store")
  async update(@Param("id") id: string, @Body() body: unknown): Promise<NodeView> {
    const parsed = parseNodeChanges(body);
    if (!parsed.ok) throw invalid(parsed.message);
    const { prefix } = parsed.value;
    if (prefix !== undefined && RESERVED.has(prefix)) throw reserved(prefix);
    const updated = await this.nodes.update(id, parsed.value);
    if (updated === "taken") throw taken(prefix ?? "");
    if (!updated) throw notFound();
    return updated;
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string): Promise<void> {
    if (!(await this.nodes.remove(id))) throw notFound();
  }
}
