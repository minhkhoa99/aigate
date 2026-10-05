import { Controller, Get, Query } from "@nestjs/common";
import { McpMarketplaceService } from "./mcp-marketplace.service.js";
@Controller("api/tooling/mcp/marketplace") export class McpMarketplaceController { constructor(private readonly marketplace: McpMarketplaceService) {} @Get() list(@Query("refresh") refresh?: string) { return this.marketplace.list(refresh === "1"); } }
