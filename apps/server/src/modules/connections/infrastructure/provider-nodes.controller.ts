import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, Header, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post,
} from "@nestjs/common";
import { MAX_NODES, parseNewNode, parseNodeChanges } from "../domain/provider-node.js";
import { ProviderNodesRepository, type NodeView } from "./provider-nodes.repo.js";

const invalid = (message: string) => new BadRequestException({ code: "INVALID_REQUEST", message });
const notFound = () => new NotFoundException({ code: "NOT_FOUND", message: "No custom provider with that id" });

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
    const created = await this.nodes.create(parsed.value);
    if (created === "limit") throw new ConflictException({ code: "NODE_LIMIT", message: `At most ${MAX_NODES} custom providers. Delete one first.` });
    return created;
  }

  @Patch(":id")
  @Header("Cache-Control", "no-store")
  async update(@Param("id") id: string, @Body() body: unknown): Promise<NodeView> {
    const node = await this.nodes.get(id);
    if (!node) throw notFound();
    const parsed = parseNodeChanges(body, node.type);
    if (!parsed.ok) throw invalid(parsed.message);
    const updated = await this.nodes.update(id, parsed.value);
    if (!updated) throw notFound();
    return updated;
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string): Promise<void> {
    if (!(await this.nodes.remove(id))) throw notFound();
  }
}
