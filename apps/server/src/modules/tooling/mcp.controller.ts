import { Body, Controller, Delete, Get, Param, Patch, Post, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { McpServerStore } from "./mcp-server.store.js";

@Controller("api/tooling/mcp/servers")
export class McpController {
  constructor(private readonly servers: McpServerStore) {}
  @Get() list() { return this.servers.list(); }
  @Post() create(@Body() body: unknown) { return this.servers.create(body); }
  @Patch(":id") update(@Param("id") id: string, @Body() body: unknown) { return this.servers.update(id, body); }
  @Delete(":id") async remove(@Param("id") id: string, @Res({ passthrough: true }) reply: FastifyReply): Promise<void> {
    await this.servers.remove(id);
    reply.code(204);
  }
}
