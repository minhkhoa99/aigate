import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, Header, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post,
} from "@nestjs/common";
import { familyLevels } from "@aigate/engine";
import { MAX_NODES, parseNewNode, parseNodeChanges } from "../domain/provider-node.js";
import { nodeProtocol, ProviderNodesRepository, takesThinking, type NodeView } from "./provider-nodes.repo.js";

const invalid = (message: string) => new BadRequestException({ code: "INVALID_REQUEST", message });
// docs/contracts/provider-thinking.md: a level the node's family does not take is refused before anything is stored.
function checkThinking(type: NodeView["type"], apiType: NodeView["apiType"], thinking: string | undefined): void {
  if (thinking === undefined || takesThinking(type, apiType, thinking)) return;
  throw invalid(`thinking must be auto or one of ${familyLevels(nodeProtocol(type, apiType)).join(", ")}`);
}
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
    checkThinking(parsed.value.type, parsed.value.type === "openai-compatible" ? parsed.value.apiType : null, parsed.value.thinking);
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
    checkThinking(node.type, parsed.value.apiType ?? node.apiType, parsed.value.thinking);
    const updated = await this.nodes.update(id, parsed.value);
    if (!updated) throw notFound();
    // A header sent without a value that is not stored yet.
    if ("error" in updated) throw invalid(updated.error);
    return updated;
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string): Promise<void> {
    if (!(await this.nodes.remove(id))) throw notFound();
  }
}
